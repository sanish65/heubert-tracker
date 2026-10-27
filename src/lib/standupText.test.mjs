import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAnswer, plainFirstLine, continueList, readLine } from './standupText.js';

test('bullets with *, -, +, • and numbers become lists; plain lines stay text', () => {
  assert.deepEqual(parseAnswer('* First debugged finance\n* Tested the report'), [
    { type: 'ul', items: ['First debugged finance', 'Tested the report'] },
  ]);
  assert.deepEqual(parseAnswer('Worked on:\n- auth\n•review\n+ docs'), [
    { type: 'p', text: 'Worked on:' },
    { type: 'ul', items: ['auth', 'review', 'docs'] },
  ]);
  assert.deepEqual(parseAnswer('3. three\n4) four'), [{ type: 'ol', start: 3, items: ['three', 'four'] }]);
  assert.deepEqual(parseAnswer('line one\nline two'), [{ type: 'p', text: 'line one\nline two' }]);
});

test('lists end at a blank line or a switch of kind; an indented line continues an item', () => {
  assert.deepEqual(parseAnswer('* a\n  more about a\n\n* b\n1. c'), [
    { type: 'ul', items: ['a\nmore about a'] },
    { type: 'ul', items: ['b'] },
    { type: 'ol', start: 1, items: ['c'] },
  ]);
});

test('emphasis, negatives and a lone * are not bullets', () => {
  assert.equal(readLine('*bold* move').kind, 'text');
  assert.equal(readLine('-5 bugs').kind, 'text');
  assert.equal(readLine('*').kind, 'text');
  assert.deepEqual(parseAnswer(''), []);
  assert.deepEqual(parseAnswer(null), []);
});

test('the one-line summary drops the bullet', () => {
  assert.equal(plainFirstLine('* First debugged finance report\n* more'), 'First debugged finance report');
  assert.equal(plainFirstLine('\n  2. second'), 'second');
  assert.equal(plainFirstLine('tested'), 'tested');
});

test('Enter on a bullet carries it on; on an empty bullet it ends the list', () => {
  assert.deepEqual(continueList('* one', 5), { value: '* one\n* ', caret: 8 });
  assert.deepEqual(continueList('  - one', 7), { value: '  - one\n  - ', caret: 12 });
  assert.deepEqual(continueList('1. one', 6), { value: '1. one\n2. ', caret: 10 });
  assert.deepEqual(continueList('* one\n* ', 8), { value: '* one\n', caret: 6 });
  // Mid-item: the rest of the line moves to the new bullet.
  assert.deepEqual(continueList('* onetwo', 5), { value: '* one\n* two', caret: 8 });
  assert.equal(continueList('plain', 5), null);
  // In front of the marker, Enter is a plain new line.
  assert.equal(continueList('* one', 0), null);
});
