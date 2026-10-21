import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseColor, composite, contrastRatio, readTokens } from './contrast.js';
import { tokens } from '../../mobile/lib/tokens.js';

// mobile/lib/tokens.js is the web token set (src/app/globals.css) in React Native's spelling.
// These tests keep the two equal, so the web contrast proof (contrast.test.mjs) carries over to
// the phone and drift between the apps fails here.

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const webDark = readTokens(css, '@tokens dark');
const web = { dark: webDark, light: { ...webDark, ...readTokens(css, '@tokens light') } };

const PILLS = ['blue', 'green', 'amber', 'red', 'violet', 'cyan', 'gray'];
const COLOURS = [
  '--ink', '--surface', '--surface-solid', '--surface-strong', '--raised', '--line', '--line-strong',
  '--text-1', '--text-2', '--text-3',
  '--primary', '--primary-hover', '--primary-text', '--primary-soft',
  '--cyan', '--cyan-text',
  '--orange', '--orange-hover', '--orange-soft',
  '--unpaid', '--dots',
  ...PILLS.flatMap((p) => [`--pb-${p}`, `--pf-${p}`]),
];

// --text-1 -> text1, --surface-solid -> surfaceSolid, --pb-blue -> pbBlue
const camel = (name) => name.replace(/^--/, '').replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

for (const theme of ['dark', 'light']) {
  const mobile = tokens[theme];
  const w = web[theme];

  test(`${theme}: every web colour token has the same colour on mobile`, () => {
    for (const name of COLOURS) {
      const key = camel(name);
      assert.ok(mobile[key] !== undefined, `${theme}: no mobile token ${key} for ${name}`);
      assert.deepEqual(
        parseColor(mobile[key]),
        parseColor(w[name]),
        `${theme}: ${key} is ${mobile[key]} but web ${name} is ${w[name]}`,
      );
    }
  });

  test(`${theme}: glassHi is the colour of the web --glass-hi highlight`, () => {
    const inset = w['--glass-hi'].match(/inset 0 1px 0 (rgba?\([^)]*\))/);
    assert.ok(inset, `${theme}: no inset highlight in --glass-hi: ${w['--glass-hi']}`);
    assert.deepEqual(parseColor(mobile.glassHi), parseColor(inset[1]), `${theme}: glassHi is ${mobile.glassHi}`);
  });

  test(`${theme}: text on the tab bar fill meets 4.5:1 (AC 10)`, () => {
    const bar = composite(parseColor(mobile.surfaceStrong), parseColor(mobile.ink));
    for (const key of ['text1', 'text2', 'text3', 'primaryText', 'cyanText']) {
      const ratio = contrastRatio(parseColor(mobile[key]), bar);
      assert.ok(ratio >= 4.5, `${theme} ${key} on the tab bar: ${ratio.toFixed(2)} < 4.5`);
    }
  });
}

test('fonts name exactly the loaded families', () => {
  assert.deepEqual(tokens.fonts, {
    display: 'SpaceGrotesk_700Bold',
    displaySemibold: 'SpaceGrotesk_600SemiBold',
    displayMedium: 'SpaceGrotesk_500Medium',
    body: 'IBMPlexSans_400Regular',
    bodyItalic: 'IBMPlexSans_400Regular_Italic',
    bodyMedium: 'IBMPlexSans_500Medium',
    bodySemibold: 'IBMPlexSans_600SemiBold',
    mono: 'JetBrainsMono_400Regular',
    monoMedium: 'JetBrainsMono_500Medium',
  });
});

test('radius is the Foundations shape scale', () => {
  assert.deepEqual(tokens.radius, { sm: 10, md: 12, lg: 16, xl: 20, sheet: 24, pill: 9999 });
});

// Text drawn straight on the page (the top bar's eyebrow and title, screen headers) sits on ink
// tinted by the aurora, not on glass. On the phone those strings use text1, text2 and pageEyebrow
// only, and each must stay readable over the strongest point of every blob (AC 10).
const hexToRgba = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

for (const theme of ['dark', 'light']) {
  test(`${theme}: page text meets 4.5:1 over every aurora blob (AC 10)`, () => {
    const t = tokens[theme];
    assert.ok(Array.isArray(tokens.aurora?.[theme]) && tokens.aurora[theme].length === 4, `${theme}: four aurora blobs`);
    for (const blob of tokens.aurora[theme]) {
      const bg = composite(parseColor(hexToRgba(blob.color, blob.alpha)), parseColor(t.ink));
      for (const key of ['text1', 'text2', 'pageEyebrow']) {
        assert.ok(t[key], `${theme}: ${key} is defined`);
        const ratio = contrastRatio(parseColor(t[key]), bg);
        assert.ok(ratio >= 4.5, `${theme} ${key} over the ${blob.color} blob: ${ratio.toFixed(2)} < 4.5`);
      }
    }
  });
}

// Colours the app draws that the web keeps outside its pill set: the fixed green and red of the
// figure dots and the over-quota meter (the web's --accent-green, --accent-red).
test('green and red are the web accent colours, the same in both themes', () => {
  for (const theme of ['dark', 'light']) {
    assert.deepEqual(parseColor(tokens[theme].green), parseColor(web[theme]['--accent-green']), `${theme} green`);
    assert.deepEqual(parseColor(tokens[theme].red), parseColor(web[theme]['--accent-red']), `${theme} red`);
  }
});

// The glows and shadows, as React Native boxShadow lists. Where the web has the token (--glow,
// --shadow, --shadow-lift, --shadow-glow-indigo) the phone's equals it; the rest are a token colour
// at an alpha, so a palette change reaches them through their base colour.
const parseShadow = (value) => {
  const m = String(value).match(/^(-?[\d.]+)(?:px)? (-?[\d.]+)(?:px)? ([\d.]+)(?:px)? (rgba?\([^)]*\))$/);
  assert.ok(m, `not a single shadow: ${value}`);
  return [{ offsetX: +m[1], offsetY: +m[2], blurRadius: +m[3], color: parseColor(m[4]) }];
};
const asParsed = (list) => list.map((s) => ({ ...s, color: parseColor(s.color) }));
const sameRgb = (a, b) => {
  const x = parseColor(a);
  const y = parseColor(b);
  return x.r === y.r && x.g === y.g && x.b === y.b;
};

for (const theme of ['dark', 'light']) {
  test(`${theme}: glows and shadows equal the web's where it has them`, () => {
    const t = tokens[theme];
    const w = web[theme];
    assert.deepEqual(asParsed(t.glow), parseShadow(w['--glow']), `${theme} glow`);
    assert.deepEqual(asParsed(t.shadowCard), parseShadow(w['--shadow']), `${theme} shadowCard`);
    assert.deepEqual(asParsed(t.shadowLift), parseShadow(w['--shadow-lift']), `${theme} shadowLift`);
    assert.deepEqual(asParsed(t.glowPrimary), parseShadow(w['--shadow-glow-indigo']), `${theme} glowPrimary`);
  });

  test(`${theme}: every edge and glow is its token colour at an alpha`, () => {
    const t = tokens[theme];
    const base = {
      primaryEdge: t.primary,
      orangeEdge: t.orange,
      cyanEdge: t.cyanDot,
      amberEdge: t.unpaid,
      redEdge: t.red,
      glowPrimarySm: t.primary,
      glowPrimaryLg: t.primary,
      glowOrangeSm: t.orange,
      glowOrange: t.orange,
      glowOrangeDot: t.orange,
      glowCyanSoft: t.cyanDot,
    };
    for (const [key, colour] of Object.entries(base)) {
      const value = t[key];
      assert.ok(value, `${theme}: no token ${key}`);
      const colours = Array.isArray(value) ? value.map((s) => s.color) : [value];
      for (const c of colours) assert.ok(sameRgb(c, colour), `${theme} ${key} is ${c}, not ${colour} at an alpha`);
    }
  });
}

test('the canvas figure dot cyan is the dark cyan in both themes', () => {
  assert.equal(tokens.dark.cyanDot, tokens.dark.cyan);
  assert.equal(tokens.light.cyanDot, tokens.dark.cyan);
});
