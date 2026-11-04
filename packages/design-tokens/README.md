# @workspace/design-tokens

Design tokens for the Gearboxe design system. Single source of truth for colors, typography, spacing, and other design primitives across web (Next.js) and mobile (Expo/React Native) applications.

## Features

- **Cross-platform**: Works with both web (Tailwind CSS) and mobile (NativeWind/React Native)
- **Type-safe**: Full TypeScript support with exported types
- **Accessible**: Built-in support for reduced motion preferences
- **Themeable**: Light and dark theme configurations included
- **Modern**: Uses HSL color space for better color manipulation

## Installation

This package is part of the workspace and is automatically available to other packages in the monorepo.

```bash
# The package is already installed in the workspace
pnpm install
```

## Usage

### Using Tokens in TypeScript/JavaScript

```typescript
import { colors, spacing, typography } from '@workspace/design-tokens';

// Use in your components
const MyComponent = () => (
  <div style={{
    color: colors.primary[500],
    padding: spacing[4],
    fontSize: typography.fontSize.base[0],
  }}>
    Hello Gearboxe!
  </div>
);
```

### Import Specific Tokens

```typescript
// Colors
import { primary, neutral, semantic } from '@workspace/design-tokens/colors';

// Typography
import { fontFamily, fontSize, fontWeight } from '@workspace/design-tokens/typography';

// Spacing
import { spacing } from '@workspace/design-tokens/spacing';

// Shadows (includes both CSS and React Native)
import { shadows } from '@workspace/design-tokens/shadows';

// Animation
import { duration, easing, keyframes } from '@workspace/design-tokens/animation';

// Themes
import { lightTheme, darkTheme } from '@workspace/design-tokens/themes';
```

### Using CSS Variables (Web)

```typescript
// In your Next.js app or component
import '@workspace/design-tokens/css';
```

```css
/* Use CSS variables in your styles */
.my-element {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  border-radius: var(--radius);
}
```

### Using Tailwind Preset (Web)

```javascript
// tailwind.config.js
import designTokens from '@workspace/design-tokens/tailwind';

export default {
  presets: [designTokens],
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
};
```

Now you can use semantic colors in your Tailwind classes:

```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Click me
</button>
```

### Using with React Native

```typescript
import { colors, shadows } from '@workspace/design-tokens';

const MyComponent = () => (
  <View style={{
    backgroundColor: colors.primary[500],
    ...shadows.DEFAULT.native,
  }}>
    <Text>Hello Gearboxe!</Text>
  </View>
);
```

## Design System Overview

### Color Palette

**Primary (Blue)**: Monochromatic blue scale for brand identity and interactive elements
- Primary: `hsl(210, 100%, 50%)` - #007FFF
- Accent: `hsl(210, 100%, 35%)` - #0059B3

**Neutrals (Warm)**: Warm gray scale for backgrounds and text
- Light backgrounds start at `hsl(40, 20%, 98%)`
- Dark backgrounds at `hsl(40, 6%, 8%)`

**Semantic Colors**:
- Destructive: `hsl(0, 84%, 60%)` - #EF4444
- Success: `hsl(142, 71%, 45%)` - #22C55E
- Warning: `hsl(38, 92%, 50%)` - #F59E0B

### Typography

**Font families**: Plus Jakarta Sans for product UI and Azeret Mono for data
- Web: Uses `var(--font-jakarta)` and `var(--font-azeret-mono)`
- Mobile: Uses the corresponding Plus Jakarta Sans and Azeret Mono font names

**Scale**: 12px (xs) to 36px (4xl) with optimized line heights

### Spacing

Based on 4px grid system (0.25rem base unit)
- Range: 0px to 384px
- Common values: 4px (1), 8px (2), 12px (3), 16px (4), 24px (6), 32px (8)

### Border Radius

Default: 12px (0.75rem) for modern, friendly appearance
- Range: 0px (none) to 9999px (full)

### Shadows

Cross-platform shadow definitions:
- `sm`: Subtle depth for cards
- `DEFAULT`: Standard elevation
- `md`: Elevated components like dropdowns
- `lg`: Modals and floating elements

Each shadow includes both CSS `box-shadow` and React Native shadow properties.

### Animation

**Durations**: instant (0ms), fast (100ms), normal (200ms), slow (300ms), slower (500ms)

**Easing**: linear, easeIn, easeOut, easeInOut, spring

**Keyframes**: fadeIn, fadeOut, scaleIn, slideInFromBottom, press

## Themes

### Light Theme

```typescript
import { lightTheme } from '@workspace/design-tokens/themes/light';
```

Warm, inviting light mode with:
- Background: `neutral[50]` - warm white
- Foreground: `neutral[800]` - dark warm gray
- Primary: `primary[500]` - vibrant blue

### Dark Theme

```typescript
import { darkTheme } from '@workspace/design-tokens/themes/dark';
```

Rich dark mode with:
- Background: `neutral[900]` - deep warm dark
- Foreground: `neutral[50]` - warm white
- Primary: `primary[500]` - same vibrant blue

## Best Practices

1. **Always use tokens**: Never hardcode colors, spacing, or typography values
2. **Use semantic colors**: Prefer `background`, `foreground`, `primary` over direct color values
3. **Respect accessibility**: The package includes reduced motion support automatically
4. **Type safety**: Import types for better IDE support and type checking
5. **Platform-specific**: Use `.native` shadow properties for React Native, `.css` for web

## File Structure

```
src/
├── tokens/
│   ├── colors.ts      # Color scales and semantic colors
│   ├── radius.ts      # Border radius tokens
│   ├── shadows.ts     # Shadow tokens (CSS + RN)
│   ├── typography.ts  # Font family, sizes, weights
│   ├── spacing.ts     # Spacing scale
│   └── animation.ts   # Animation tokens
├── themes/
│   ├── light.ts       # Light theme configuration
│   └── dark.ts        # Dark theme configuration
├── css/
│   └── variables.css  # CSS custom properties
├── tailwind/
│   └── preset.ts      # Tailwind preset configuration
└── index.ts           # Main exports
```

## Contributing

When adding new tokens:

1. Add the token to the appropriate file in `src/tokens/`
2. Update themes in `src/themes/` if needed
3. Update CSS variables in `src/css/variables.css`
4. Update Tailwind preset in `src/tailwind/preset.ts` if applicable
5. Export from `src/index.ts`
6. Run `pnpm type-check` to verify TypeScript types

## License

PROPRIETARY
