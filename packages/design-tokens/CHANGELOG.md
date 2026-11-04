# Changelog

All notable changes to the @workspace/design-tokens package will be documented in this file.

## [0.0.1] - 2026-01-24

### Added

#### Design Tokens
- **Colors**: Monochromatic blue primary scale with warm neutral scale
  - Primary blue: 10 shades (50-900) with #007FFF as primary brand color
  - Warm neutrals: 11 shades (50-950) for backgrounds and text
  - Semantic colors: destructive (red), success (green), warning (orange)
  - Common colors: white, black, transparent

- **Typography**: Poppins font family with comprehensive scale
  - Font sizes: xs (12px) to 4xl (36px) with optimized line heights
  - Font weights: normal (400), medium (500), semibold (600), bold (700)
  - Cross-platform support for web and React Native

- **Spacing**: 4px-based spacing scale
  - Range: 0px to 384px
  - Follows design industry standards for consistent layouts

- **Border Radius**: Modern, friendly radius scale
  - Default: 12px (0.75rem)
  - Range: 0px (none) to 9999px (full)

- **Shadows**: Cross-platform shadow definitions
  - Four levels: sm, DEFAULT, md, lg
  - Each includes both CSS box-shadow and React Native shadow properties
  - Optimized for depth and visual hierarchy

- **Animation**: Comprehensive animation system
  - Durations: instant (0ms) to slower (500ms)
  - Easing functions: linear, easeIn, easeOut, easeInOut, spring
  - Keyframes: fadeIn, fadeOut, scaleIn, slideInFromBottom, press

#### Themes
- **Light Theme**: Warm, inviting light mode
  - Background: warm white (neutral[50])
  - Foreground: dark warm gray (neutral[800])
  - Primary: vibrant blue (primary[500])

- **Dark Theme**: Rich, comfortable dark mode
  - Background: deep warm dark (neutral[900])
  - Foreground: warm white (neutral[50])
  - Primary: same vibrant blue for consistency

#### Web Integration
- **CSS Variables**: HSL-based CSS custom properties
  - Semantic color variables (--background, --foreground, etc.)
  - Border radius variable (--radius)
  - Dark mode support via .dark class
  - Reduced motion preferences built-in

- **Tailwind Preset**: Full Tailwind CSS preset
  - Dark mode configuration
  - Extended colors with semantic tokens
  - Shadow utilities
  - Animation keyframes and utilities
  - Custom transition timings

#### Package Configuration
- TypeScript support with full type definitions
- Multiple export paths for tree-shaking
- Workspace-based monorepo structure
- Type checking script

#### Documentation
- Comprehensive README with installation and usage
- USAGE_EXAMPLES.md with practical code examples
- COLOR_REFERENCE.md with visual color guide
- Inline JSDoc comments for better DX

### Technical Details
- TypeScript 5.7.3
- ESM module format
- NodeNext module resolution
- Extends @workspace/typescript-config/base.json
- Optional peer dependency on tailwindcss ^3.0.0

### Cross-Platform Features
- Works with both Next.js (web) and Expo (mobile)
- Compatible with Tailwind CSS and NativeWind
- Consistent API across platforms
- Platform-specific shadow definitions
