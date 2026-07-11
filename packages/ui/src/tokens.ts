export const colors = {
  background: {
    canvas: "#090D14",
    elevated: "#101722",
    surface: "#151E2B",
    overlay: "rgba(3, 7, 12, 0.72)",
  },
  text: {
    primary: "#F4F7FB",
    secondary: "#A8B3C2",
    muted: "#748196",
    inverse: "#07111C",
  },
  accent: {
    primary: "#76A9FF",
    primaryStrong: "#4E8FF7",
    success: "#5DD6C0",
    danger: "#F26B75",
    warning: "#E8B86D",
  },
  border: {
    subtle: "rgba(255, 255, 255, 0.08)",
    default: "rgba(255, 255, 255, 0.14)",
    strong: "rgba(255, 255, 255, 0.22)",
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
  card: "0 18px 50px rgba(0, 0, 0, 0.28)",
  floating: "0 22px 70px rgba(0, 0, 0, 0.42)",
  focus: "0 0 0 3px rgba(118, 169, 255, 0.42)",
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
