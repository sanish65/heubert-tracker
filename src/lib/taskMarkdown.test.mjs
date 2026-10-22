import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInline, parseMarkdown } from './taskMarkdown.js';

const ctx = { names: ['Alice Admin', 'Al'], keys: new Set(['HTT']) };

test('bold, italic and code', () => {
  assert.deepEqual(parseInline('a **b** *c* _d_ `e`', ctx), [
    { t: 'text', v: 'a ' },
    { t: 'b', children: [{ t: 'text', v: 'b' }] },
    { t: 'text', v: ' ' },
    { t: 'i', children: [{ t: 'text', v: 'c' }] },
    { t: 'text', v: ' ' },
    { t: 'i', children: [{ t: 'text', v: 'd' }] },
    { t: 'text', v: ' ' },
    { t: 'code', v: 'e' },
  ]);
});

test('snake_case and 2*3*4 stay plain text', () => {
  assert.deepEqual(parseInline('snake_case_name', ctx), [{ t: 'text', v: 'snake_case_name' }]);
  assert.deepEqual(parseInline('2*3*4', ctx), [{ t: 'text', v: '2*3*4' }]);
});

test('links only take http(s), and bare URLs drop trailing punctuation', () => {
  assert.deepEqual(parseInline('[docs](https://x.test/a)', ctx), [{ t: 'link', href: 'https://x.test/a', children: [{ t: 'text', v: 'docs' }] }]);
  assert.deepEqual(parseInline('[bad](javascript:alert(1))', ctx)[0], { t: 'text', v: '[bad](javascript:alert(1))' });
  assert.deepEqual(parseInline('see https://x.test/p.', ctx), [
    { t: 'text', v: 'see ' },
    { t: 'link', href: 'https://x.test/p', children: [{ t: 'text', v: 'https://x.test/p' }] },
    { t: 'text', v: '.' },
  ]);
});

test('issue keys of known projects link; others stay text', () => {
  assert.deepEqual(parseInline('fixes HTT-12, not ABC-3', ctx), [
    { t: 'text', v: 'fixes ' },
    { t: 'issue', key: 'HTT-12' },
    { t: 'text', v: ', not ABC-3' },
  ]);
});

test('mentions match the longest known name, at a word boundary', () => {
  assert.deepEqual(parseInline('cc @Alice Admin and @Al.', ctx), [
    { t: 'text', v: 'cc ' },
    { t: 'mention', name: 'Alice Admin' },
    { t: 'text', v: ' and ' },
    { t: 'mention', name: 'Al' },
    { t: 'text', v: '.' },
  ]);
  assert.deepEqual(parseInline('me@Alice Admin', ctx), [{ t: 'text', v: 'me@Alice Admin' }]);
  assert.deepEqual(parseInline('@Alicia', ctx), [{ t: 'text', v: '@Alicia' }]);
});

test('blocks: paragraphs with line breaks, lists, quotes and code fences', () => {
  const blocks = parseMarkdown('Line one\nline two\n\n- a\n- **b**\n\n1. x\n2) y\n\n> quoted\n\n```\nconst a = 1 * 2;\n```', ctx);
  assert.deepEqual(blocks.map((b) => b.type), ['p', 'ul', 'ol', 'quote', 'code']);
  assert.deepEqual(blocks[0].inlines, [{ t: 'text', v: 'Line one' }, { t: 'br' }, { t: 'text', v: 'line two' }]);
  assert.equal(blocks[1].items.length, 2);
  assert.deepEqual(blocks[2].items[1], [{ t: 'text', v: 'y' }]);
  assert.equal(blocks[4].text, 'const a = 1 * 2;');
});

test('an unclosed fence runs to the end, and empty text gives no blocks', () => {
  assert.deepEqual(parseMarkdown('```\nopen', ctx), [{ type: 'code', text: 'open' }]);
  assert.deepEqual(parseMarkdown('', ctx), []);
  assert.deepEqual(parseMarkdown('<script>x</script>', ctx), [{ type: 'p', inlines: [{ t: 'text', v: '<script>x</script>' }] }]);
});

test('a link label never holds another link or issue key', () => {
  assert.deepEqual(parseInline('[see https://a.io and HTT-1](https://b.io)', ctx), [
    { t: 'link', href: 'https://b.io', children: [{ t: 'text', v: 'see https://a.io and HTT-1' }] },
  ]);
});
