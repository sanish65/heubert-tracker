import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from './csv.js';

test('CSV quotes what needs quoting and defuses formulas', () => {
  assert.equal(
    toCsv(['Key', 'Summary'], [['POR-1', 'Plain'], ['POR-2', 'Has, comma'], ['POR-3', 'Says "hi"'], ['POR-4', '=HYPERLINK("x")'], ['POR-5', null]]),
    'Key,Summary\r\nPOR-1,Plain\r\nPOR-2,"Has, comma"\r\nPOR-3,"Says ""hi"""\r\nPOR-4,"\'=HYPERLINK(""x"")"\r\nPOR-5,'
  );
  assert.equal(toCsv(['a'], [['line\nbreak'], ['-5']]), 'a\r\n"line\nbreak"\r\n\'-5');
});
