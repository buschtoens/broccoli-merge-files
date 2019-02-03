import Plugin from 'broccoli-plugin';
import defaults from 'lodash.defaults';
import fg from 'fast-glob';
import pEvent, { Emitter } from 'p-event';
import { resolve } from 'path';
import { promises as fs } from 'fs';

const { readFile, writeFile } = fs;

type Without<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

type Encoding = string;

/**
 * If multiple input nodes contain a file with the same relative file path...
 */
export enum DuplicateStrategy {
  /**
   * an error will be thrown and the pipeline crashes.
   */
  Prohibit = 'prohibit',

  /**
   * the file from the first input node containing it is kept.
   */
  KeepFirst = 'keep-first',

  /**
   * the file from the last input node containing it is kept.
   */
  KeepLast = 'keep-last',

  /**
   * all files will be passed through to `merge`.
   */
  KeepAll = 'keep-all'
}

/**
 * 0. Relative file path
 * 1. File contents
 */
export type File = [string, any];

/**
 * 0. Input node index
 * 1. Relative file path
 * 2. File contents
 */
export type Entry = [number, string, string | Buffer];

/**
 * 0. Input node index
 * 1. Relative file path
 * 2. File contents
 */
type ProcessedEntry = [number, string, any];

type MergeReturnType = string | Buffer | [string, string | Buffer][];

interface Options {
  /**
   * A descriptive annotation. Useful for debugging, to tell multiple
   * instances of the same plugin apart.
   */
  annotation?: string;

  /**
   * Glob pattern for files to include. Passed through to `fast-glob`.
   *
   * @see https://github.com/mrmlnc/fast-glob/#patterns
   */
  patterns: string | string[];

  /**
   * These options are passed through to `fast-glob`.
   *
   * @see https://github.com/mrmlnc/fast-glob/#options-1
   */
  globOptions?: object;

  /**
   * If multiple input nodes contain a file with the same relative file path...
   *
   * @default DuplicateStrategy.Prohibit
   */
  duplicates: DuplicateStrategy;

  /**
   * The file encoding to be used when both reading and writing the files.
   *
   * @default 'utf8'
   */
  encoding: Encoding;

  /**
   * Allows you to transform each file individually before passing it to `merge`.
   */
  transformFile?(path: Entry[1], contents: Entry[2]): Promise<any> | any;

  /**
   * Files are read asynchronously in non-deterministic order from the all input
   * nodes in parallel to improve performance.
   *
   * - `true` (default): Sort in order of input nodes and then relative file path
   * - `false`: Skip any sorting. Must not be used in conjunction with
   *   `DuplicateStrategy.KeepFirst` or `DuplicateStrategy.KeepLast`.
   * - `(a: Entry, b: Entry) => number`: Compare function that gets
   *   passed two entries. Basically what you would pass to `[].sort()`.
   *
   * @default true
   */
  sort: boolean | ((a: Entry, b: Entry) => number);

  /**
   * Receives all files as an array `[fileName, contents][]`.
   *
   * If `outputFileName` is set, this function is expected to return a `string`
   * or `Buffer` that will be used as the contents.
   *
   * If `outputFileName` is not set, this function is expected to return the
   * following shape: `[fileName, contents][]`, where `fileName` is a `string`
   * and `contents` is either a `string` or `Buffer`.
   */
  merge(files: File[]): MergeReturnType | Promise<MergeReturnType>;

  /**
   * If `merge` is intended to return singular file contents, this will be used
   * as the output file name.
   */
  outputFileName?: string;
}

type RequiredOptions = 'merge';

const DEFAULT_OPTIONS: Without<Options, RequiredOptions> = {
  patterns: '**/*',
  duplicates: DuplicateStrategy.Prohibit,
  encoding: 'utf8',
  sort: true
};

export default class BroccoliMergeFiles extends Plugin {
  private options: Options;

  constructor(
    inputNodes: Plugin.BroccoliNode[],
    options: Partial<Options> & Pick<Options, RequiredOptions>
  ) {
    super(inputNodes, {
      annotation: options.annotation,
      persistentOutput: false,
      needsCache: false
    });

    this.options = defaults({}, options, DEFAULT_OPTIONS);
  }

  async build(): Promise<void> {
    const entries = await this.readFiles();
    const sorted = this.sort(entries);
    const deduplicated = this.deduplicate(sorted);
    const merged = await this.options.merge(deduplicated);
    await this.writeOutput(merged);
  }

  async readFiles(): Promise<Entry[]> {
    const streams: [string, NodeJS.ReadableStream][] = this.inputPaths.map(
      (path): [string, NodeJS.ReadableStream] => [
        path,
        fg.stream(this.options.patterns, {
          ...this.options.globOptions,
          cwd: path,

          // we rely on these options to be set this way, so we override any
          // potential options in `globOptions`
          absolute: false,
          unique: true,
          onlyFiles: true,
          onlyDirectories: false,
          transform: null,
          stats: false
        })
      ]
    );

    const waiters = [];
    const entries: Promise<Entry>[] = [];

    for (const [i, [cwd, stream]] of streams.entries()) {
      // eslint-disable-next-line no-loop-func
      stream.on('data', path => entries.push(this.processFile(i, cwd, path)));
      waiters.push(pEvent(stream as Emitter, 'end'));
    }

    // wait for all streams to finish
    await Promise.all(waiters);

    // wait for all entries to be read and processed
    return Promise.all(entries);
  }

  async processFile(
    i: number,
    cwd: string,
    path: string
  ): Promise<ProcessedEntry> {
    const absolutePath = resolve(cwd, path);
    const content = await readFile(absolutePath, {
      encoding: this.options.encoding
    });

    if (typeof this.options.transformFile === 'function') {
      return [i, path, await this.options.transformFile(path, content)];
    }

    return [i, path, content];
  }

  sort(entries: Entry[]): Entry[] {
    if (typeof this.options.sort === 'function') {
      return entries.sort(this.options.sort);
    }
    if (this.options.sort === true) {
      return entries.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
    }
    return entries;
  }

  deduplicate(entries: Entry[]): File[] {
    if (this.options.duplicates === DuplicateStrategy.KeepAll)
      return entries.map(
        ([, fileName, contents]): File => [fileName, contents]
      );

    const map = new Map<string, File[1]>();
    for (const [node, fileName, contents] of entries) {
      if (map.has(fileName)) {
        if (this.options.duplicates === DuplicateStrategy.Prohibit)
          throw new Error(
            `File '${fileName}' appears in node ${node}, but was already seen in a previous node.`
          );

        if (this.options.duplicates === DuplicateStrategy.KeepFirst) continue;
      }

      map.set(fileName, contents);
    }

    return [...map.entries()];
  }

  async writeOutput(merged: MergeReturnType): Promise<void> {
    if (typeof this.options.outputFileName === 'string') {
      if (Array.isArray(merged))
        throw new TypeError(
          `Expected 'merge' to return file contents for a single file, since 'outputFileName' has been specified.`
        );
      await this.writeOutputFile(this.options.outputFileName, merged);
    } else {
      if (!Array.isArray(merged))
        throw new TypeError(
          `Expected 'merge' to return multiple file contents, since 'outputFileName' has not been specified.`
        );
      await Promise.all(
        merged.map(([fileName, contents]) =>
          this.writeOutputFile(fileName, contents)
        )
      );
    }
  }

  async writeOutputFile(
    fileName: string,
    contents: string | Buffer
  ): Promise<void> {
    await writeFile(resolve(this.outputPath, fileName), contents, {
      encoding: this.options.encoding
    });
  }
}
