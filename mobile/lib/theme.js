import { useApp } from "../context/AppContext";
import { tokens } from "./tokens";

// What a screen reads through useThemeColors(): the design tokens (tokens.js, held equal to the
// web's src/app/globals.css by src/lib/mobileTokens.test.mjs), for the theme the user picked.
export const themes = {
  dark: tokens.dark,
  light: tokens.light,
};

// Font family names (register them with useFonts in app/_layout.js) and the shape scale.
export const fonts = tokens.fonts;
export const radius = tokens.radius;

export function useThemeColors() {
  const { theme } = useApp();
  return themes[theme];
}
