// The design tokens: dark and light colours, font names, radii. Pure (no imports), so the unit test
// src/lib/mobileTokens.test.mjs loads it under plain Node and holds every colour equal to the web
// tokens in src/app/globals.css (the `@tokens dark` and `@tokens light` blocks). Change a colour
// there and here together; the test fails when they drift.
//
// Light overrides dark the way the web's [data-theme="light"] block does: `primary`, `orange`,
// `orangeHover` and `unpaid` are not overridden and stay as dark.
//
// `glassHi` is the colour of the web's `--glass-hi` (`inset 0 1px 0 <colour>`). React Native has no
// inset shadow, so it is drawn as a 1px top border. The shadow numbers are React Native's spelling
// of the web `--shadow` (0 8px 24px): `shadowOffsetY` 8, `shadowRadius` 12, `elevation` on Android.

const dark = {
  ink: "#070A12",
  surface: "rgba(22, 29, 47, 0.55)",
  surfaceSolid: "#121828",
  surfaceStrong: "rgba(22, 29, 47, 0.78)",
  raised: "rgba(255, 255, 255, 0.05)",
  line: "rgba(255, 255, 255, 0.09)",
  lineStrong: "rgba(255, 255, 255, 0.17)",
  text1: "#EDF1F8",
  text2: "#B6BFCF",
  text3: "#8E98AC",
  primary: "#3D63F0",
  primaryHover: "#5174FF",
  primaryText: "#8EA6FF",
  primarySoft: "rgba(61, 99, 240, 0.18)",
  cyan: "#2DD4EF",
  cyanText: "#67E3F5",
  // Eyebrows drawn straight on the page, over the aurora (mobile only; see `aurora`).
  pageEyebrow: "#67E3F5",
  orange: "#FF6A1F",
  orangeHover: "#FF8340",
  orangeSoft: "rgba(255, 106, 31, 0.14)",
  unpaid: "#F5A524",
  dots: "rgba(255, 255, 255, 0.03)",
  glassHi: "rgba(255, 255, 255, 0.07)",
  // Status pills: `pb*` is the tinted fill, `pf*` the text on it.
  pbBlue: "rgba(61, 99, 240, 0.2)",
  pfBlue: "#A5B8FF",
  pbGreen: "rgba(34, 197, 94, 0.16)",
  pfGreen: "#6EE7A0",
  pbAmber: "rgba(245, 165, 36, 0.16)",
  pfAmber: "#FCC560",
  pbRed: "rgba(244, 63, 94, 0.16)",
  pfRed: "#FDA4B4",
  pbViolet: "rgba(167, 139, 250, 0.18)",
  pfViolet: "#C4B5FD",
  pbCyan: "rgba(45, 212, 239, 0.14)",
  pfCyan: "#67E3F5",
  pbGray: "rgba(255, 255, 255, 0.07)",
  pfGray: "#B6BFCF",
  shadowOpacity: 0.28,
  shadowRadius: 12,
  shadowOffsetY: 8,
  elevation: 4,
  // Fixed colours, the same in both themes: the web's --accent-green and --accent-red (figure dots,
  // the over-quota meter, a live production link), and the canvas's figure-dot cyan, which keeps
  // the dark cyan in the light theme too.
  green: "#22C55E",
  red: "#F43F5E",
  cyanDot: "#2DD4EF",
  // The edge of a tinted panel or a chosen control: its colour at the canvas's alpha, both themes.
  primaryEdge: "rgba(61, 99, 240, 0.45)",
  orangeEdge: "rgba(255, 106, 31, 0.35)",
  cyanEdge: "rgba(45, 212, 239, 0.4)",
  amberEdge: "rgba(245, 165, 36, 0.4)",
  redEdge: "rgba(244, 63, 94, 0.4)",
  // Glows and shadows as React Native `boxShadow` lists. `glow` is the web's --glow (the live cyan
  // dot), `shadowCard` / `shadowLift` its --shadow / --shadow-lift, `glowPrimary` its
  // --shadow-glow-indigo (a primary button); the Sm and Lg sizes are the canvas's smaller chips and
  // its floating add buttons, the orange ones its people moments.
  glow: [{ offsetX: 0, offsetY: 0, blurRadius: 10, color: "rgba(45, 212, 239, 0.7)" }],
  glowCyanSoft: [{ offsetX: 0, offsetY: 0, blurRadius: 16, color: "rgba(45, 212, 239, 0.3)" }],
  shadowCard: [{ offsetX: 0, offsetY: 8, blurRadius: 24, color: "rgba(0, 0, 0, 0.28)" }],
  shadowLift: [{ offsetX: 0, offsetY: 16, blurRadius: 40, color: "rgba(0, 0, 0, 0.45)" }],
  glowPrimarySm: [{ offsetX: 0, offsetY: 4, blurRadius: 14, color: "rgba(61, 99, 240, 0.35)" }],
  glowPrimary: [{ offsetX: 0, offsetY: 6, blurRadius: 20, color: "rgba(61, 99, 240, 0.35)" }],
  glowPrimaryLg: [{ offsetX: 0, offsetY: 10, blurRadius: 28, color: "rgba(61, 99, 240, 0.45)" }],
  glowOrangeSm: [{ offsetX: 0, offsetY: 4, blurRadius: 14, color: "rgba(255, 106, 31, 0.35)" }],
  glowOrange: [{ offsetX: 0, offsetY: 6, blurRadius: 20, color: "rgba(255, 106, 31, 0.35)" }],
  glowOrangeDot: [{ offsetX: 0, offsetY: 0, blurRadius: 8, color: "rgba(255, 106, 31, 0.8)" }],
};

const light = {
  ...dark,
  ink: "#EDF1F8",
  surface: "rgba(255, 255, 255, 0.6)",
  surfaceSolid: "#FFFFFF",
  surfaceStrong: "rgba(255, 255, 255, 0.82)",
  raised: "rgba(255, 255, 255, 0.65)",
  line: "rgba(14, 21, 37, 0.08)",
  lineStrong: "rgba(14, 21, 37, 0.16)",
  text1: "#0E1525",
  text2: "#3B4558",
  text3: "#5A6478",
  primaryHover: "#3254D6",
  primaryText: "#2F52D8",
  primarySoft: "rgba(61, 99, 240, 0.1)",
  cyan: "#06B6D4",
  cyanText: "#0E7490",
  // cyanText fails 4.5:1 over the light aurora's blue blob, so on-page eyebrows go deeper.
  pageEyebrow: "#0A5C72",
  orangeSoft: "rgba(255, 106, 31, 0.1)",
  dots: "rgba(14, 21, 37, 0.04)",
  glassHi: "rgba(255, 255, 255, 0.9)",
  pbBlue: "rgba(61, 99, 240, 0.1)",
  pfBlue: "#2F52D8",
  pbGreen: "rgba(34, 197, 94, 0.12)",
  pfGreen: "#166534",
  pbAmber: "rgba(245, 165, 36, 0.16)",
  pfAmber: "#92400E",
  pbRed: "rgba(244, 63, 94, 0.1)",
  pfRed: "#BE123C",
  pbViolet: "rgba(124, 92, 224, 0.1)",
  pfViolet: "#6D28D9",
  pbCyan: "rgba(6, 182, 212, 0.12)",
  pfCyan: "#0E7490",
  pbGray: "rgba(14, 21, 37, 0.06)",
  pfGray: "#3B4558",
  shadowOpacity: 0.08,
  glow: [{ offsetX: 0, offsetY: 0, blurRadius: 8, color: "rgba(6, 182, 212, 0.55)" }],
  shadowCard: [{ offsetX: 0, offsetY: 8, blurRadius: 24, color: "rgba(30, 41, 82, 0.08)" }],
  shadowLift: [{ offsetX: 0, offsetY: 16, blurRadius: 40, color: "rgba(30, 41, 82, 0.14)" }],
};

// Family names as _layout.js registers them with useFonts. A custom family carries its weight in
// its name, so never combine one of these with `fontWeight`.
const fonts = {
  display: "SpaceGrotesk_700Bold",
  displaySemibold: "SpaceGrotesk_600SemiBold",
  displayMedium: "SpaceGrotesk_500Medium",
  body: "IBMPlexSans_400Regular",
  // The italic is its own family: `fontStyle: "italic"` on `body` draws upright on iOS.
  bodyItalic: "IBMPlexSans_400Regular_Italic",
  bodyMedium: "IBMPlexSans_500Medium",
  bodySemibold: "IBMPlexSans_600SemiBold",
  mono: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
};

// Foundations "Shape": cards 16, inner tiles 10-12, inputs and buttons 10, dialogs 20, pills and
// avatars round; the bottom sheets (MobileRecordFine) are 24 at the top.
const radius = { sm: 10, md: 12, lg: 16, xl: 20, sheet: 24, pill: 9999 };

// The canvas aurora behind every screen: the mobile artboards' `.ht .aurora` rule (the same in all
// of docs/mobile-ui-revamp/design/Mobile*.dc.html). Each blob is a CSS radial-gradient: an ellipse
// of radii rx by ry centred at cx, cy, from `color` at `alpha` to transparent at 70%. Drawn by
// mobile/components/Aurora.js; page text over it is held to 4.5:1 by src/lib/mobileTokens.test.mjs.
const aurora = {
  dark: [
    { cx: "10%", cy: "4%", rx: 360, ry: 300, color: "#3D63F0", alpha: 0.38 },
    { cx: "95%", cy: "22%", rx: 320, ry: 280, color: "#7C5CE0", alpha: 0.28 },
    { cx: "80%", cy: "70%", rx: 360, ry: 320, color: "#2DD4EF", alpha: 0.16 },
    { cx: "10%", cy: "92%", rx: 300, ry: 260, color: "#FF6A1F", alpha: 0.12 },
  ],
  light: [
    { cx: "10%", cy: "4%", rx: 360, ry: 300, color: "#3D63F0", alpha: 0.22 },
    { cx: "95%", cy: "22%", rx: 320, ry: 280, color: "#7C5CE0", alpha: 0.16 },
    { cx: "80%", cy: "70%", rx: 360, ry: 320, color: "#06B6D4", alpha: 0.14 },
    { cx: "10%", cy: "92%", rx: 300, ry: 260, color: "#FF6A1F", alpha: 0.1 },
  ],
};

export const tokens = { dark, light, fonts, radius, aurora };
