/**
 * @workspace/design-tokens
 *
 * Single source of truth for design tokens across Gearboxe web and mobile apps
 *
 * @example
 * ```ts
 * // Import all tokens
 * import { colors, spacing, typography } from '@workspace/design-tokens';
 *
 * // Import specific tokens
 * import { primary, neutral } from '@workspace/design-tokens/colors';
 * import { lightTheme, darkTheme } from '@workspace/design-tokens/themes';
 * ```
 */

export * from "./themes/dark.js";
export { darkTheme } from "./themes/dark.js";
// Theme exports
export * from "./themes/light.js";
export { lightTheme } from "./themes/light.js";
export * from "./tokens/animation.js";
export { animation, duration, easing, keyframes } from "./tokens/animation.js";
// Token exports
export * from "./tokens/colors.js";
// Re-export for convenient access
export {
  brand,
  colors,
  common,
  neutral,
  primary,
  semantic,
  status,
} from "./tokens/colors.js";
// Entry-type category colors
export * from "./tokens/entry-types.js";
export {
  entryTypeColors,
  getEntryTypeColor,
} from "./tokens/entry-types.js";
export * from "./tokens/radius.js";
export { radius } from "./tokens/radius.js";
export * from "./tokens/shadows.js";
export { shadows } from "./tokens/shadows.js";
export * from "./tokens/spacing.js";
export { spacing } from "./tokens/spacing.js";
export * from "./tokens/typography.js";
export {
  fontFamily,
  fontSize,
  fontWeight,
  typography,
} from "./tokens/typography.js";
