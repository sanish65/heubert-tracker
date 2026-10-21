import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// React Native 0.86 exports StyleSheet.absoluteFill only; absoluteFillObject is gone, and
// spreading it gives nothing, so a layer meant to sit behind the content takes up the page and
// pushes everything off the screen (the blank-screen update of 2026-10-21).
const root = fileURLToPath(new URL('../../mobile/', import.meta.url));
const rn = readFileSync(join(root, 'node_modules/react-native/Libraries/StyleSheet/StyleSheetExports.js'), 'utf8');

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (['node_modules', 'dist', '.expo'].includes(name)) return [];
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sources(p) : /\.(js|jsx)$/.test(name) ? [p] : [];
  });
}

test('every StyleSheet helper the app uses exists in the installed React Native', () => {
  const used = new Set();
  for (const file of sources(root)) {
    for (const m of readFileSync(file, 'utf8').matchAll(/StyleSheet\.(absoluteFill\w*|hairlineWidth)/g)) used.add(`${m[1]} (${file.slice(root.length)})`);
  }
  for (const entry of used) {
    const name = entry.split(' ')[0];
    assert.match(rn, new RegExp(`^\\s+${name},?$`, 'm'), `StyleSheet.${entry} is not exported by react-native`);
  }
});
