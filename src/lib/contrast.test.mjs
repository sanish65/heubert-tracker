import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseColor, composite, contrastRatio, readTokens } from './contrast.js';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const dark = readTokens(css, '@tokens dark');
const light = { ...dark, ...readTokens(css, '@tokens light') };
const PILLS = ['blue', 'green', 'amber', 'red', 'violet', 'cyan', 'gray'];

test('contrastRatio matches the WCAG reference values', () => {
  assert.equal(Math.round(contrastRatio(parseColor('#000000'), parseColor('#FFFFFF')) * 100) / 100, 21);
  assert.equal(contrastRatio(parseColor('#777777'), parseColor('#777777')), 1);
});

test('composite paints a translucent colour over an opaque base', () => {
  assert.deepEqual(composite(parseColor('rgba(255, 255, 255, 0.5)'), parseColor('#000000')), { r: 127.5, g: 127.5, b: 127.5, a: 1 });
});

test('readTokens finds the marked token blocks', () => {
  assert.equal(dark['--primary'], '#3D63F0');
  assert.ok(light['--ink'] && light['--ink'] !== dark['--ink']);
});

for (const [name, t] of [['dark', dark], ['light', light]]) {
  const glass = composite(parseColor(t['--surface']), parseColor(t['--ink']));
  const pass = (fg, bg, label) =>
    assert.ok(contrastRatio(fg, bg) >= 4.5, `${name} ${label}: ${contrastRatio(fg, bg).toFixed(2)} < 4.5`);

  test(`${name}: text on glass meets 4.5:1 (AC 15)`, () => {
    for (const k of ['--text-1', '--text-2', '--text-3', '--primary-text', '--cyan-text']) pass(parseColor(t[k]), glass, k);
  });

  test(`${name}: every status pill meets 4.5:1 (AC 11, 15)`, () => {
    for (const p of PILLS) pass(parseColor(t[`--pf-${p}`]), composite(parseColor(t[`--pb-${p}`]), glass), `pill ${p}`);
  });

  test(`${name}: button labels meet 4.5:1 (AC 10, 15)`, () => {
    pass(parseColor('#FFFFFF'), parseColor(t['--primary']), 'white on primary');
    pass(parseColor('#0A0E17'), parseColor(t['--orange']), 'ink on orange');
  });
}
