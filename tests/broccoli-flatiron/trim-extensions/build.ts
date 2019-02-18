import { ReadableDir } from 'broccoli-test-helper';
import { BroccoliMergeFiles } from '../../..';
import flatiron from '../../../flatiron';

export default (src: ReadableDir) =>
  new BroccoliMergeFiles([src.path()], {
    outputFileName: 'merged',
    merge: files => flatiron(files, { trimExtensions: true })
  });
