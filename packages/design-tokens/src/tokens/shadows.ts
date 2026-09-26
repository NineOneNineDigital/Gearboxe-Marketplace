/**
 * Elevation scale for the Gearboxe design system.
 * Tactile depth: soft on light, deeper with a hairline top-highlight on dark.
 * (Web consumes the runtime tokens in apps/web/app/globals.css; this file is
 * the documented source for future mobile/admin adoption.)
 *
 * Provides both CSS box-shadow and React Native shadow properties
 * for cross-platform consistency
 */

interface NativeShadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

interface ShadowToken {
  css: string;
  native: NativeShadow;
}

/**
 * Shadow scale with both CSS and React Native definitions
 */
export const shadows = {
  /** No shadow */
  none: {
    css: "none",
    native: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
  },

  /** Subtle shadow - Optional for dropdowns/modals */
  subtle: {
    css: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
    native: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 2,
      elevation: 1,
    },
  },

  /**
   * Resting cards (dark-mode reference values; the inset top-highlight is
   * web-only — native uses the ambient shadow component).
   */
  card: {
    css: "0 2px 8px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
    native: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.28,
      shadowRadius: 8,
      elevation: 3,
    },
  },

  /** Raised / hover surfaces */
  elevated: {
    css: "0 8px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.07)",
    native: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 24,
      elevation: 8,
    },
  },

  /** Overlays — dialogs, popovers, dropdowns, sheets, toasts */
  overlay: {
    css: "0 16px 40px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
    native: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.55,
      shadowRadius: 40,
      elevation: 16,
    },
  },
} as const;

export type Shadows = typeof shadows;
export type { NativeShadow, ShadowToken };
