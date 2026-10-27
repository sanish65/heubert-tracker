import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// mobile/lib/standupText.js is the web's src/lib/standupText.js with a one-line header: the
// app can't import from src/. Any drift fails here.
test('mobile/lib/standupText.js mirrors src/lib/standupText.js', () => {
  const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
  const mobile = read('../../mobile/lib/standupText.js');
  assert.equal(mobile.slice(mobile.indexOf('\n\n') + 2), read('./standupText.js'));
});
