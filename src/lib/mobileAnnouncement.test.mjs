import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, composite, contrastRatio } from './contrast.js';
import { tokens } from '../../mobile/lib/tokens.js';
import { announcementTone } from '../../mobile/lib/announcement.js';

// Home's Announcement card (components/EventBanner.js) takes its tone from the kind of banner:
// orange only for people moments, birthdays and work anniversaries (intent AC3); company events,
// public holidays and the new fiscal year take the cyan tone. Its text sits on the tinted fill
// straight over the page, so it must read at 4.5:1 over every aurora blob (AC10).

const hexToRgba = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};
const pagesBehind = (theme) => {
  const t = tokens[theme];
  return [parseColor(t.ink), ...tokens.aurora[theme].map((b) => composite(parseColor(hexToRgba(b.color, b.alpha)), parseColor(t.ink)))];
};

for (const theme of ['dark', 'light']) {
  const t = tokens[theme];

  test(`${theme}: birthdays and anniversaries are orange`, () => {
    const tone = announcementTone(t, 'celebration');
    assert.equal(tone.fill, t.orangeSoft);
    assert.equal(tone.tile, t.orange);
  });

  test(`${theme}: events, holidays and the fiscal year are cyan, never orange`, () => {
    for (const kind of ['event', 'holiday', 'fiscal-year', undefined]) {
      const tone = announcementTone(t, kind);
      assert.equal(tone.fill, t.pbCyan, `${kind}`);
      assert.equal(tone.tile, t.cyan, `${kind}`);
      assert.notEqual(tone.edge, t.orangeEdge, `${kind}`);
    }
  });

  test(`${theme}: the title and line meet 4.5:1 on every tone, the icon 3:1 on its tile`, () => {
    for (const kind of ['celebration', 'event']) {
      const tone = announcementTone(t, kind);
      for (const page of pagesBehind(theme)) {
        const bg = composite(parseColor(tone.fill), page);
        for (const key of ['title', 'text']) {
          const ratio = contrastRatio(parseColor(tone[key]), bg);
          assert.ok(ratio >= 4.5, `${theme} ${kind} ${key}: ${ratio.toFixed(2)} < 4.5`);
        }
      }
      const icon = contrastRatio(parseColor(tone.ink), parseColor(tone.tile));
      assert.ok(icon >= 3, `${theme} ${kind} icon on its tile: ${icon.toFixed(2)} < 3`);
    }
  });
}
