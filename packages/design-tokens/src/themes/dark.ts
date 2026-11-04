/**
 * Dark theme configuration for Gearboxe design system
 *
 * Brand: "Dark by default." Midnight (#0C0E12) grounds every screen; cards
 * float one step above on a Gunmetal-leaning surface. Bone carries text;
 * Torque marks the one primary action per screen.
 */

import { brand, common, neutral, primary, semantic } from "../tokens/colors.js";

export const darkTheme = {
  /** Main background color — Midnight canvas */
  background: neutral[900], // #0C0E12

  /** Primary foreground/text color — Bone */
  foreground: brand.bone, // #F4F1EA

  /** Card background — elevated one step above Midnight */
  card: "hsl(218, 11%, 11%)",

  /** Card foreground/text — Bone */
  cardForeground: brand.bone,

  /** Popover background */
  popover: "hsl(218, 11%, 11%)",

  /** Popover foreground/text — Bone */
  popoverForeground: brand.bone,

  /** Primary brand color — Torque */
  primary: primary[500], // #007FFF

  /** Primary foreground — white text on Torque */
  primaryForeground: common.white,

  /** Secondary background — Gunmetal */
  secondary: neutral[800], // #2B2F36

  /** Secondary foreground — Bone */
  secondaryForeground: brand.bone,

  /** Muted background — between Midnight and Gunmetal */
  muted: "hsl(218, 11%, 14%)",

  /** Muted foreground — Chrome-leaning gray */
  mutedForeground: "hsl(213, 8%, 65%)",

  /** Accent background — subtle elevated surface */
  accent: "hsl(218, 11%, 14%)",

  /** Accent foreground — Bone */
  accentForeground: brand.bone,

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

  /** Border color — low-contrast on Midnight */
  border: "hsl(218, 11%, 16%)",

  /** Input border */
  input: "hsl(218, 11%, 16%)",

  /** Focus ring color — Torque */
  ring: primary[500],
} as const;

export type DarkTheme = typeof darkTheme;
