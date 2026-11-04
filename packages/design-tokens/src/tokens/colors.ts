/**
 * Color tokens for Gearboxe design system
 *
 * Brand: Gearboxe 2026 — "Dark by default."
 * Torque (blue) leads; a cool Midnight → Gunmetal → Chrome neutral chassis
 * carries surfaces and text; Bone is the warm light canvas. A small status
 * trio — Coral (due), Signal (upcoming), Mint (done) — keeps the product
 * legible. See the brand guidelines (Rev. 2026.02).
 */

/**
 * Primary blue scale — "Torque". Used for the single most important action
 * per screen, focus rings, and brand identity. 500 is Torque (#007FFF).
 */
export const primary = {
  50: "hsl(210, 100%, 95%)", // #E6F2FF - Lightest
  100: "hsl(210, 100%, 90%)", // #CCE5FF
  200: "hsl(210, 100%, 80%)", // #99CCFF
  300: "hsl(210, 100%, 70%)", // #66B2FF
  400: "hsl(210, 100%, 60%)", // #3399FF
  500: "hsl(210, 100%, 50%)", // #007FFF - TORQUE / PRIMARY
  600: "hsl(210, 100%, 45%)", // #0072E6
  700: "hsl(210, 100%, 35%)", // #0059B3
  800: "hsl(210, 100%, 25%)", // #004080
  900: "hsl(210, 100%, 15%)", // #002B55 - Darkest
} as const;

/**
 * Cool neutral scale — the Midnight chassis.
 * Anchored on the three brand neutrals: Chrome (#C8CCD1) at 300,
 * Gunmetal (#2B2F36) at 800, and Midnight (#0C0E12) at 900.
 * Replaces the previous warm-gray ramp.
 */
export const neutral = {
  50: "hsl(216, 14%, 96%)", // #F3F4F6 - Lightest cool surface
  100: "hsl(214, 12%, 92%)", // #E8EAED
  200: "hsl(213, 10%, 86%)", // #D8DBDF
  300: "hsl(213, 8%, 80%)", // #C8CCD1 - CHROME / Muted
  400: "hsl(214, 7%, 62%)", // #969BA3
  500: "hsl(215, 8%, 48%)", // #71767E - Muted foreground
  600: "hsl(216, 9%, 36%)", // #535860
  700: "hsl(217, 10%, 26%)", // #3B3F47
  800: "hsl(218, 11%, 19%)", // #2B2F36 - GUNMETAL / Surface
  900: "hsl(220, 20%, 6%)", // #0C0E12 - MIDNIGHT / Canvas
  950: "hsl(220, 24%, 4%)", // #07090C - Deepest dark
} as const;

/**
 * Named brand colors — the canonical palette from the 2026 guidelines.
 * Use these when a specific brand color is intended rather than a scale step.
 */
export const brand = {
  /** Canvas — grounds every dark screen */
  midnight: "hsl(220, 20%, 6%)", // #0C0E12
  /** Primary action — leads and glows */
  torque: "hsl(210, 100%, 50%)", // #007FFF
  /** Text & warmth — the light canvas */
  bone: "hsl(42, 26%, 94%)", // #F4F1EA
  /** Spark — upcoming/attention */
  signal: "hsl(44, 89%, 61%)", // #F4C542
  /** Surface — elevated cards on Midnight */
  gunmetal: "hsl(218, 11%, 19%)", // #2B2F36
  /** Muted — icons & secondary marks */
  chrome: "hsl(213, 8%, 80%)", // #C8CCD1
  /** Due — overdue/attention status */
  coral: "hsl(8, 100%, 70%)", // #FF7A66
  /** Done — completed status */
  mint: "hsl(148, 58%, 52%)", // #3CCB7F
} as const;

/**
 * Status tokens — the brand's maintenance status trio.
 * These are distinct from the semantic feedback colors below: they describe
 * a maintenance item's state in lists/timelines, not generic error/success UI.
 */
export const status = {
  due: brand.coral, // Coral - overdue / due now
  upcoming: brand.signal, // Signal - coming up
  done: brand.mint, // Mint - completed
} as const;

/**
 * Semantic color tokens for generic UI feedback states.
 * Kept as conventional error-red / success-green; `warning` uses brand Signal.
 */
export const semantic = {
  destructive: "hsl(0, 84%, 60%)", // #EF4444 - Error/danger states
  success: "hsl(160, 84%, 39%)", // #10B981 - Success states (emerald)
  warning: brand.signal, // #F4C542 - Signal - warning states
} as const;

/**
 * Common color values
 */
export const common = {
  white: "hsl(0, 0%, 100%)", // #FFFFFF
  black: "hsl(0, 0%, 0%)", // #000000
  transparent: "transparent",
} as const;

/**
 * Complete color palette
 */
export const colors = {
  primary,
  neutral,
  brand,
  status,
  semantic,
  common,
} as const;

export type ColorScale = typeof primary | typeof neutral;
export type Colors = typeof colors;
