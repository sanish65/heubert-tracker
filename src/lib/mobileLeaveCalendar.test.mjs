import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, composite, contrastRatio } from './contrast.js';
import { tokens } from '../../mobile/lib/tokens.js';
import { dayCellTone, holidayStripTone } from '../../mobile/lib/leaveCalendar.js';

// mobile/lib/leaveCalendar.js picks the colours of a day in the Leaves calendar. Orange is kept for
// people moments (intent AC3), so a holiday takes the grey pill tone, and every number on a cell
// must read at 4.5:1 (AC10) on that cell, inside the glass card, over the strongest point of every
// aurora blob behind the page.

const hexToRgba = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

// The card's fill over the plain ink and over each blob.
const cardsBehind = (theme) => {
  const t = tokens[theme];
  const pages = [parseColor(t.ink), ...tokens.aurora[theme].map((b) => composite(parseColor(hexToRgba(b.color, b.alpha)), parseColor(t.ink)))];
  return pages.map((page) => composite(parseColor(t.surface), page));
};

const onFill = (fill, card) => (fill === 'transparent' ? card : composite(parseColor(fill), card));

const DAYS = [];
for (const weekend of [false, true])
  for (const holiday of [false, true])
    for (const today of [false, true])
      for (const selected of [false, true])
        for (const bsFirst of [false, true]) DAYS.push({ weekend, holiday, today, selected, bsFirst });

const name = (d) => Object.entries(d).filter(([, v]) => v).map(([k]) => k).join('+') || 'plain';

for (const theme of ['dark', 'light']) {
  const t = tokens[theme];

  test(`${theme}: a holiday is grey, never orange (AC3)`, () => {
    const cell = dayCellTone(t, { weekend: false, holiday: true, today: false, selected: false, bsFirst: false });
    assert.equal(cell.fill, t.pbGray);
    assert.equal(cell.num, t.pfGray);
    const strip = holidayStripTone(t);
    assert.equal(strip.fill, t.pbGray);
    for (const tone of [cell, strip]) {
      for (const colour of Object.values(tone)) {
        if (typeof colour !== 'string' || colour === 'transparent') continue;
        const c = parseColor(colour);
        const o = parseColor(t.orange);
        assert.ok(!(c.r === o.r && c.g === o.g && c.b === o.b), `${theme}: holiday drawn in orange (${colour})`);
      }
    }
  });

  test(`${theme}: today stays cyan, a weekend dashed, the picked day edged in primary`, () => {
    const today = dayCellTone(t, { weekend: false, holiday: true, today: true, selected: false, bsFirst: false });
    assert.equal(today.fill, t.pbCyan);
    assert.equal(today.edge, t.cyan);
    assert.equal(dayCellTone(t, { weekend: true, holiday: false, today: false, selected: false, bsFirst: false }).dashed, true);
    assert.equal(dayCellTone(t, { weekend: true, holiday: true, today: false, selected: false, bsFirst: false }).dashed, false);
    assert.equal(dayCellTone(t, { weekend: false, holiday: false, today: false, selected: true, bsFirst: false }).edge, t.primary);
  });

  test(`${theme}: every day number and BS day meets 4.5:1 on its cell (AC10)`, () => {
    for (const day of DAYS) {
      const tone = dayCellTone(t, day);
      for (const card of cardsBehind(theme)) {
        const bg = onFill(tone.fill, card);
        for (const key of ['num', 'bs']) {
          const ratio = contrastRatio(parseColor(tone[key]), bg);
          assert.ok(ratio >= 4.5, `${theme} ${name(day)} ${key} ${tone[key]} on ${tone.fill}: ${ratio.toFixed(2)} < 4.5`);
        }
      }
    }
  });

  test(`${theme}: the holiday strip's title and date meet 4.5:1`, () => {
    const strip = holidayStripTone(t);
    for (const card of cardsBehind(theme)) {
      const bg = onFill(strip.fill, card);
      for (const key of ['title', 'date']) {
        const ratio = contrastRatio(parseColor(strip[key]), bg);
        assert.ok(ratio >= 4.5, `${theme} strip ${key}: ${ratio.toFixed(2)} < 4.5`);
      }
    }
  });
}
