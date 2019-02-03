import flatiron from './flatiron';
import { File } from '.';

const FILES: File[] = [
  ['some/deeply/nested/file.txt', 'This is file.txt'],
  ['some/deeply/nested/other-file.txt', 'This is other-file.txt'],
  ['some/not-so-deeply-nested/file.txt', 'not-so-deeply-nested'],
  ['another/file.txt', 'another file']
];

const OUTPUT_WITH_EXTENSIONS = {
  some: {
    deeply: {
      nested: {
        'file.txt': 'This is file.txt',
        'other-file.txt': 'This is other-file.txt'
      }
    },
    'not-so-deeply-nested': {
      'file.txt': 'not-so-deeply-nested'
    }
  },
  another: {
    'file.txt': 'another file'
  }
};

const OUTPUT_WITHOUT_EXTENSIONS = {
  some: {
    deeply: {
      nested: {
        file: 'This is file.txt',
        'other-file': 'This is other-file.txt'
      }
    },
    'not-so-deeply-nested': {
      file: 'not-so-deeply-nested'
    }
  },
  another: {
    file: 'another file'
  }
};

const serialize = (obj: object, prefix = 'export default ', suffix = ';') =>
  `${prefix}${JSON.stringify(obj, null, 2)}${suffix}`;

test('it basically works', () => {
  expect(flatiron(FILES)).toEqual(serialize(OUTPUT_WITH_EXTENSIONS));
});

test('it can trim file extensions', () => {
  expect(flatiron(FILES, { trimExtensions: true })).toEqual(
    serialize(OUTPUT_WITHOUT_EXTENSIONS)
  );
});

test('it can accept custom prefix and suffix', () => {
  expect(flatiron(FILES, { prefix: 'FOO', suffix: 'BAR' })).toEqual(
    serialize(OUTPUT_WITH_EXTENSIONS, 'FOO', 'BAR')
  );
});

test('it can accept empty prefix and suffix', () => {
  expect(flatiron(FILES, { prefix: '', suffix: '' })).toEqual(
    serialize(OUTPUT_WITH_EXTENSIONS, '', '')
  );
});
