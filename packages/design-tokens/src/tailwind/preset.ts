/**
 * Tailwind CSS preset for Gearboxe Design System
 *
 * Compatible with both web (Tailwind CSS) and mobile (NativeWind)
 * Extends Tailwind with design tokens and custom utilities
 */

import { animation } from "@workspace/design-tokens/animation";
import { radius } from "@workspace/design-tokens/radius";

const preset = {
  darkMode: "class" as const,
  content: [],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: radius.xs,
        xl: radius.xl,
        "2xl": radius["2xl"],
        none: radius.none,
        full: radius.full,
      },
      boxShadow: {
        none: "0 0 #0000",
        subtle: "0 1px 2px 0 rgba(0, 0, 0, 0.03)", // Flat 2.0 option for dropdowns/modals
      },
      keyframes: {
        fadeIn: animation.keyframes.fadeIn,
        fadeOut: animation.keyframes.fadeOut,
        scaleIn: animation.keyframes.scaleIn,
        slideInFromBottom: animation.keyframes.slideInFromBottom,
        press: animation.keyframes.press,
      },
      animation: {
        "fade-in": `fadeIn ${animation.duration.normal} ${animation.easing.easeOut}`,
        "fade-out": `fadeOut ${animation.duration.normal} ${animation.easing.easeIn}`,
        "scale-in": `scaleIn ${animation.duration.normal} ${animation.easing.easeOut}`,
        "slide-in-from-bottom": `slideInFromBottom ${animation.duration.normal} ${animation.easing.easeOut}`,
        press: `press ${animation.duration.fast} ${animation.easing.easeInOut}`,
      },
      transitionDuration: {
        instant: animation.duration.instant,
        fast: animation.duration.fast,
        normal: animation.duration.normal,
        slow: animation.duration.slow,
        slower: animation.duration.slower,
      },
      transitionTimingFunction: {
        spring: animation.easing.spring,
      },
    },
  },
  plugins: [
    // Note: Add tailwindcss-animate to your project's dependencies if needed
    // require('tailwindcss-animate'),
  ],
};

export default preset;
export { preset as gearboxePreset };
