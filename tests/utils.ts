import fg from 'fast-glob';
import { resolve } from 'path';
import { fromDir, ReadableDir } from 'broccoli-test-helper';
import BroccoliMergeFiles from '../';

interface Scenario {
  build: (src: ReadableDir) => BroccoliMergeFiles;
  input: ReadableDir;
  output: ReadableDir;
}

export function loadScenarios(
  dir: string
): { [scenarioName: string]: Scenario } {
  const scenarioNames = fg.sync<string>('*', {
    cwd: dir,
    onlyDirectories: true,
    unique: true
  });

  const scenarios: {
    [scenarioName: string]: Scenario;
  } = {};

  for (const name of scenarioNames) {
    scenarios[name] = {} as Scenario;
  }

  beforeAll(() =>
    Promise.all(
      scenarioNames.map(async name => {
        scenarios[name].build = (await import(resolve(dir, name, 'build.ts')))
          .default as (src: ReadableDir) => BroccoliMergeFiles;
        scenarios[name].input = fromDir(resolve(dir, name, 'input'));
        scenarios[name].output = fromDir(resolve(dir, name, 'output'));
      })
    )
  );

  return scenarios;
}
