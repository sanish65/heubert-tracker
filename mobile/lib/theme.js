import { useApp } from "../context/AppContext";

// Mirrors the CSS variable tokens in the web app's globals.css :root / [data-theme="light"]
// blocks exactly, so the two apps read as one product. Notably, web keeps every accent hue
// (indigo/violet/green/red/amber/orange/sky) identical across both themes — only
// backgrounds, text, and borders shift — so this does the same instead of inventing
// separate light-mode accent shades.
export const themes = {
  dark: {
    bg: "#0b0e14",
    bgElevated: "#111827",
    bgInput: "rgba(255, 255, 255, 0.06)",
    card: "rgba(17, 24, 39, 0.7)",
    border: "rgba(255, 255, 255, 0.08)",
    textPrimary: "#f3f4f6",
    textSecondary: "#9ca3af",
    textMuted: "#6b7280",
    accentIndigo: "#6366f1",
    accentIndigoSoft: "rgba(99, 102, 241, 0.15)",
    accentViolet: "#8b5cf6",
    accentGreen: "#22c55e",
    accentGreenSoft: "rgba(34, 197, 94, 0.15)",
    accentRed: "#ef4444",
    accentRedSoft: "rgba(239, 68, 68, 0.15)",
    accentAmber: "#f59e0b",
    accentAmberSoft: "rgba(245, 158, 11, 0.15)",
    accentOrange: "#f97316",
    accentOrangeSoft: "rgba(249, 115, 22, 0.15)",
    accentSky: "#0ea5e9",
    shadowOpacity: 0.5,
  },
  light: {
    bg: "#f1f5f9",
    bgElevated: "#e2e8f0",
    bgInput: "rgba(0, 0, 0, 0.05)",
    card: "rgba(255, 255, 255, 0.85)",
    border: "rgba(0, 0, 0, 0.09)",
    textPrimary: "#0f172a",
    textSecondary: "#475569",
    textMuted: "#94a3b8",
    accentIndigo: "#6366f1",
    accentIndigoSoft: "rgba(99, 102, 241, 0.15)",
    accentViolet: "#8b5cf6",
    accentGreen: "#22c55e",
    accentGreenSoft: "rgba(34, 197, 94, 0.15)",
    accentRed: "#ef4444",
    accentRedSoft: "rgba(239, 68, 68, 0.15)",
    accentAmber: "#f59e0b",
    accentAmberSoft: "rgba(245, 158, 11, 0.15)",
    accentOrange: "#f97316",
    accentOrangeSoft: "rgba(249, 115, 22, 0.15)",
    accentSky: "#0ea5e9",
    shadowOpacity: 0.1,
  },
};

// Matches the web app's --radius-sm/md/lg/xl scale exactly (unchanged between themes there too).
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
};

export function useThemeColors() {
  const { theme } = useApp();
  return themes[theme];
}
