// Outside — warm, light, calm. Built around a soft cream background
// with a single accent (coral) for CTAs and an evergreen for "we're here" states.

export const COLORS = {
  background: "#FFFBF2",     // warm off-white — easier on the eyes than pure white
  surface: "#FFFFFF",
  surfaceAlt: "#F6F0E4",     // subtle elevated surface (cards on cards)
  border: "#EBE3D3",

  textPrimary: "#1F2A2E",
  textSecondary: "#6B7A80",
  textTertiary: "#A4B0B6",

  accent: "#FF7A59",          // coral — primary CTA, broadcast button
  accentDark: "#E5613F",
  accentLight: "#FFE5DC",

  ever: "#3F7D5B",            // evergreen — "live now" / active broadcasts
  everLight: "#DEEBE3",

  warn: "#E5A13F",
  danger: "#D9534F",
};

export const FONT_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34,
};

export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
};

export const SHADOW = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
};
