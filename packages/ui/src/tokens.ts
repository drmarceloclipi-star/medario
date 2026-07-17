export const colors = {
  background: {
    canvas: "#F1FAEE",
    elevated: "#EAF6F5",
    surface: "#FFFFFF",
    overlay: "rgba(29, 53, 87, 0.28)",
  },
  text: {
    primary: "#1D3557",
    secondary: "#344D66",
    muted: "#52687D",
    inverse: "#FFFFFF",
  },
  accent: {
    primary: "#356F91",
    primaryStrong: "#1D3557",
    success: "#246D49",
    danger: "#B33A45",
    warning: "#76521E",
  },
  border: {
    subtle: "rgba(29, 53, 87, 0.12)",
    default: "rgba(29, 53, 87, 0.20)",
    strong: "rgba(29, 53, 87, 0.34)",
  },
} as const;

export const spacing = {
  0: "0",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
} as const;

export const radii = {
  sm: "0.75rem",
  md: "1rem",
  lg: "1.375rem",
  xl: "1.75rem",
  pill: "999px",
} as const;

export const shadows = {
  card: "none",
  floating: "0 4px 8px rgba(29, 53, 87, 0.16)",
  focus: "0 0 0 3px #356F91",
} as const;

export const motion = {
  fast: "140ms",
  normal: "220ms",
  slow: "320ms",
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

export const typography = {
  display: '"Source Serif 4", Georgia, serif',
  ui: 'Sora, "Avenir Next", system-ui, sans-serif',
  size: {
    xs: "0.75rem",
    sm: "0.875rem",
    md: "1rem",
    lg: "1.125rem",
    xl: "1.5rem",
    display: "2.5rem",
  },
} as const;

export const theme = { colors, spacing, radii, shadows, motion, typography } as const;
