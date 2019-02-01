import { createTempDir, TempDir, createBuilder } from 'broccoli-test-helper';
import BroccoliMergeFiles, { DuplicateStrategy } from './';
import { deepStrictEqual } from 'assert';

let srcDir: TempDir;
beforeEach(async () => {
  srcDir = await createTempDir();
  srcDir.copy('./fixtures');
});
afterEach(async () => srcDir.dispose());

test('weaksauce test', async () => {
  const builder = createBuilder(
    new BroccoliMergeFiles([srcDir.path('a'), srcDir.path('b')], {
      merge: files => JSON.stringify(files),
      duplicates: DuplicateStrategy.KeepLast,
      outputFileName: 'merged.json'
    })
  );
  try {
    await builder.build();

    const merged = JSON.parse(builder.readText('merged.json')!);

    deepStrictEqual(merged, [['bar.txt', 'bar'], ['foo.txt', 'qux']]);
  } finally {
    await builder.dispose();
  }
});
