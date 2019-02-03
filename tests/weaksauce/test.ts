import { createBuilder, fromDir } from 'broccoli-test-helper';
import BroccoliMergeFiles, { DuplicateStrategy } from '../../';
import { deepStrictEqual } from 'assert';

const srcDir = fromDir('./input');

async function buildAndAssert(outputNode: any, expected?: object) {
  const builder = createBuilder(outputNode);
  try {
    await builder.build();
    if (expected) deepStrictEqual(builder.read(), expected);
    return builder.read();
  } catch (error) {
    throw error;
  } finally {
    await builder.dispose();
  }
}

test('weaksauce test', async () => {
  const node = new BroccoliMergeFiles([srcDir.path('a'), srcDir.path('b')], {
    merge: files => JSON.stringify(files),
    duplicates: DuplicateStrategy.KeepLast,
    outputFileName: 'merged.json'
  });

  buildAndAssert(node, {
    'merged.json': JSON.stringify([['bar.txt', 'bar'], ['foo.txt', 'qux']])
  });
});
