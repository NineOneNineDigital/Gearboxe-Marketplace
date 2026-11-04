/**
 * Typography tokens for Gearboxe design system
 *
 * Brand: Plus Jakarta Sans is the primary voice — a warm geometric sans with
 * real personality at heavy weights (Display 800, Headline 700, Body 500/1.6).
 * Azeret Mono handles data, metrics, and precision moments: mileage, VIN
 * plates, part numbers. See the brand guidelines (Rev. 2026.02).
 */

interface FontSize {
  fontSize: string;
  lineHeight: string;
}

/**
 * Font family definitions for web and native platforms
 */
export const fontFamily = {
  sans: {
    /** Web font stack using CSS variable — Plus Jakarta Sans for body text */
    web: [
      "var(--font-jakarta)",
      "-apple-system",
      "BlinkMacSystemFont",
      "'Segoe UI'",
      "sans-serif",
    ] as const,

    /** React Native font weights — Plus Jakarta Sans for body */
    native: {
      regular: "PlusJakartaSans_400Regular",
      medium: "PlusJakartaSans_500Medium",
    } as const,
  },
  heading: {
    /** Web font stack using CSS variable — Plus Jakarta Sans for headings */
    web: [
      "var(--font-jakarta)",
      "-apple-system",
      "BlinkMacSystemFont",
      "'Segoe UI'",
      "sans-serif",
    ] as const,

    /** React Native font weights — Plus Jakarta Sans for headings */
    native: {
      semibold: "PlusJakartaSans_600SemiBold",
      bold: "PlusJakartaSans_700Bold",
      extrabold: "PlusJakartaSans_800ExtraBold",
    } as const,
  },
  mono: {
    /** Web font stack using CSS variable — Azeret Mono for data/metrics */
    web: [
      "var(--font-azeret-mono)",
      "ui-monospace",
      "SFMono-Regular",
      "Menlo",
      "monospace",
    ] as const,

    /** React Native font weights — Azeret Mono for data/metrics */
    native: {
      medium: "AzeretMono_500Medium",
      semibold: "AzeretMono_600SemiBold",
      bold: "AzeretMono_700Bold",
    } as const,
  },
} as const;

/**
 * Font size scale with corresponding line heights
 *
 * Format: [fontSize, { lineHeight }]
 */
export const fontSize = {
  /** 11px / 15.4px line height — footnotes */
  "2xs": ["0.6875rem", { lineHeight: "0.9625rem" }] as const,

  /** 12px / 16.8px line height */
  xs: ["0.75rem", { lineHeight: "1.05rem" }] as const,

  /** 14px / 21px line height */
  sm: ["0.875rem", { lineHeight: "1.3125rem" }] as const,

  /** 16px / 24px line height - Base size */
  base: ["1rem", { lineHeight: "1.5rem" }] as const,

  /** 18px / 27px line height */
  lg: ["1.125rem", { lineHeight: "1.6875rem" }] as const,

  /** 20px / 26px line height */
  xl: ["1.25rem", { lineHeight: "1.625rem" }] as const,

  /** 24px / 31.2px line height */
  "2xl": ["1.5rem", { lineHeight: "1.95rem" }] as const,

  /** 30px / 36px line height */
  "3xl": ["1.875rem", { lineHeight: "2.25rem" }] as const,

  /** 36px / 43.2px line height */
  "4xl": ["2.25rem", { lineHeight: "2.7rem" }] as const,
} as const;

/**
 * Font weight scale
 */
export const fontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
} as const;

/**
 * Complete typography system
 */
export const typography = {
  fontFamily,
  fontSize,
  fontWeight,
} as const;

export type Typography = typeof typography;
export type { FontSize };
