/**
 * Border radius tokens for Gearboxe design system
 *
 * Standard controls use a 12px radius. Cards and feature surfaces step up to
 * 16px and 24px, matching the mobile welcome and authentication flow.
 */

export const radius = {
  /** No border radius - 0px */
  none: "0",
  /** Extra small - 2px */
  xs: "0.125rem",
  /** Small controls and menu items - 8px */
  sm: "0.5rem",
  /** Medium controls and menus - 10px */
  md: "0.625rem",
  /** Standard controls - 12px */
  DEFAULT: "0.75rem",
  /** Standard controls - 12px */
  lg: "0.75rem",
  /** Cards and grouped surfaces - 16px */
  xl: "1rem",
  /** Feature panels and hero surfaces - 24px */
  "2xl": "1.5rem",
  /** Full circle/pill - 9999px */
  full: "9999px",
} as const;

export type Radius = typeof radius;
