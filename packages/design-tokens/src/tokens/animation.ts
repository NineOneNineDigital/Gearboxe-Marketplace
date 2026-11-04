/**
 * Animation tokens for Gearboxe design system
 *
 * Provides timing, easing, and keyframe definitions
 * for consistent animations across platforms
 */

/**
 * Animation duration tokens
 */
export const duration = {
  /** 0ms - Instant changes */
  instant: "0ms",

  /** 100ms - Fast micro-interactions */
  fast: "100ms",

  /** 200ms - Standard transitions */
  normal: "200ms",

  /** 300ms - Slower, more noticeable animations */
  slow: "300ms",

  /** 500ms - Deliberate, attention-grabbing animations */
  slower: "500ms",
} as const;

/**
 * Animation easing functions
 */
export const easing = {
  /** Linear progression - no acceleration */
  linear: "linear",

  /** Ease in - starts slow, ends fast */
  easeIn: "cubic-bezier(0.4, 0, 1, 1)",

  /** Ease out - starts fast, ends slow */
  easeOut: "cubic-bezier(0, 0, 0.2, 1)",

  /** Ease in out - slow at both ends */
  easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",

  /** Spring - bouncy, playful effect */
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

/**
 * Keyframe definitions for common animations
 */
export const keyframes = {
  /** Fade in from transparent to opaque */
  fadeIn: {
    from: { opacity: "0" },
    to: { opacity: "1" },
  },

  /** Fade out from opaque to transparent */
  fadeOut: {
    from: { opacity: "1" },
    to: { opacity: "0" },
  },

  /** Scale in with fade - common for modals */
  scaleIn: {
    from: { opacity: "0", transform: "scale(0.95)" },
    to: { opacity: "1", transform: "scale(1)" },
  },

  /** Slide in from bottom - common for mobile sheets */
  slideInFromBottom: {
    from: { opacity: "0", transform: "translateY(10px)" },
    to: { opacity: "1", transform: "translateY(0)" },
  },

  /** Press animation - subtle button feedback */
  press: {
    "0%": { transform: "scale(1)" },
    "50%": { transform: "scale(0.98)" },
    "100%": { transform: "scale(1)" },
  },
} as const;

/**
 * Complete animation system
 */
export const animation = {
  duration,
  easing,
  keyframes,
} as const;

export type Animation = typeof animation;
export type Duration = typeof duration;
export type Easing = typeof easing;
export type Keyframes = typeof keyframes;
