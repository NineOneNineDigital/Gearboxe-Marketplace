/**
 * Light theme configuration for Gearboxe design system
 *
 * Brand: the light counterpart sits on a warm Bone (#F4F1EA) canvas with
 * Midnight text. Torque still marks the one primary action per screen.
 */

import { brand, common, neutral, primary, semantic } from "../tokens/colors.js";

export const lightTheme = {
  /** Main background color — Bone canvas */
  background: brand.bone, // #F4F1EA

  /** Primary foreground/text color — Midnight */
  foreground: neutral[900], // #0C0E12

  /** Card background — pure white */
  card: common.white,

  /** Card foreground/text — Midnight */
  cardForeground: neutral[900],

  /** Popover background */
  popover: common.white,

  /** Popover foreground/text — Midnight */
  popoverForeground: neutral[900],

  /** Primary brand color — Torque */
  primary: primary[500], // #007FFF

  /** Primary foreground — white text on Torque */
  primaryForeground: common.white,

  /** Secondary background — Bone, one step deeper */
  secondary: "hsl(42, 18%, 90%)",

  /** Secondary foreground — Midnight */
  secondaryForeground: neutral[900],

  /** Muted background — Bone, one step deeper */
  muted: "hsl(42, 18%, 90%)",

  /** Muted foreground — mid Gunmetal gray */
  mutedForeground: neutral[600], // ~hsl(216, 9%, 36%)

  /** Accent background — Bone, two steps deeper */
  accent: "hsl(42, 14%, 86%)",

  /** Accent foreground — Midnight */
  accentForeground: neutral[900],

  /** Destructive/error color */
  destructive: semantic.destructive,

  /** Destructive foreground — white text on error */
  destructiveForeground: common.white,

  /** Success color */
  success: semantic.success,

  /** Success foreground — white text on success */
  successForeground: common.white,

  /** Warning color — Signal */
  warning: semantic.warning,

  /** Warning foreground — dark Midnight text on Signal */
  warningForeground: neutral[900],

  /** Border color — warm Bone gray */
  border: "hsl(42, 12%, 84%)",

  /** Input border — matches card borders */
  input: "hsl(42, 12%, 84%)",

  /** Focus ring color — Torque */
  ring: primary[500],
} as const;

export type LightTheme = typeof lightTheme;
