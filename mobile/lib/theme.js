import { useApp } from "../context/AppContext";

// Mirrors the CSS variable tokens in the web app's globals.css.
export const themes = {
  dark: {
    bg: "#0b0d14",
    bgElevated: "#12141f",
    card: "#161925",
    border: "#252938",
    textPrimary: "#f3f4f6",
    textSecondary: "#c9cbd6",
    textMuted: "#8b8fa3",
    accentIndigo: "#6366f1",
    accentGreen: "#22c55e",
    accentRed: "#ef4444",
    accentAmber: "#f59e0b",
    accentSky: "#0ea5e9",
  },
  light: {
    bg: "#f5f6fa",
    bgElevated: "#ffffff",
    card: "#ffffff",
    border: "#e2e4ea",
    textPrimary: "#111827",
    textSecondary: "#374151",
    textMuted: "#6b7280",
    accentIndigo: "#6366f1",
    accentGreen: "#16a34a",
    accentRed: "#dc2626",
    accentAmber: "#d97706",
    accentSky: "#0284c7",
  },
};

export function useThemeColors() {
  const { theme } = useApp();
  return themes[theme];
}
