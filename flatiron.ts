import { parse, sep } from 'path';
import { File } from './';

/**
 * Deeply sets `value` on `obj` at the nested field specified by `keyPath`.
 *
 * @param obj Object to set the value on. Mutates in place.
 * @param keyPath Array of key path segments.
 * @param value The nested value to set on `obj`.
 */
function deepSet(obj: any, keyPath: string[], value: any): void {
  let currentNode = obj;
  for (const segment of keyPath.slice(0, -1)) {
    if (segment in currentNode) {
      if (currentNode[segment] instanceof Object) {
        currentNode = currentNode[segment];
      } else {
        throw new TypeError(
          `Could not set '${keyPath.join(
            '.'
          )} on '${obj}', because '${segment}' is resent, but not an object.`
        );
      }
    } else {
      currentNode = currentNode[segment] = {};
    }
  }
  currentNode[keyPath[keyPath.length - 1]] = value;
}

interface FlatironOptions {
  /**
   * Whether or not to keep file extensions.
   * @default false
   */
  trimExtensions?: boolean;

  /**
   * String that shall precede the JSON serialization.
   * @default 'export default '
   */
  prefix?: string;

  /**
   * String that shall follow the JSON serialization.
   * @default ';'
   */
  suffix?: string;
}

/**
 * Compatibility utility function to mimic the behavior of `broccoli-flatiron`
 * with `broccoli-merge-files`.
 *
 * @see https://github.com/buschtoens/broccoli-flatiron
 *
 * @param files Array of files as received by `merge`.
 * @param options
 * @param options.trimExtensions Whether or not to keep file extensions.
 * @param options.prefix String that shall precede the JSON serialization.
 * @param options.suffix String that shall follow the JSON serialization.
 */
export default function flatiron(
  files: File[],
  {
    trimExtensions = false,
    prefix = 'export default ',
    suffix = ';'
  }: FlatironOptions = {}
): string {
  const tree = {};

  for (const [fileName, contents] of files) {
    const { name, base, dir } = parse(fileName);
    const keyPath = [
      ...dir.split(sep).filter(Boolean),
      trimExtensions ? name : base
    ];
    deepSet(tree, keyPath, contents);
  }

  return `${prefix}${JSON.stringify(tree, null, 2)}${suffix}`;
}
