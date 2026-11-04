# Usage Examples

This document provides practical examples of how to use the design tokens in different scenarios.

## Web (Next.js with Tailwind)

### 1. Setup Tailwind Config

```typescript
// apps/web/tailwind.config.ts
import type { Config } from 'tailwindcss';
import designTokens from '@workspace/design-tokens/tailwind';

const config: Config = {
  presets: [designTokens],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
  ],
};

export default config;
```

### 2. Import CSS Variables

```typescript
// apps/web/app/layout.tsx
import '@workspace/design-tokens/css';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

### 3. Use Tailwind Classes

```tsx
// Button component with design tokens
export function Button({ children, variant = 'primary' }: ButtonProps) {
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  };

  return (
    <button
      className={`
        px-4 py-2 rounded-lg font-medium
        transition-colors duration-normal
        shadow-sm hover:shadow-md
        ${variants[variant]}
      `}
    >
      {children}
    </button>
  );
}
```

### 4. Use CSS Variables Directly

```css
/* Custom component styles */
.custom-card {
  background-color: hsl(var(--card));
  color: hsl(var(--card-foreground));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.08);
}

.custom-card:hover {
  box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.1);
}
```

### 5. Use Tokens in TypeScript

```typescript
import { colors, spacing } from '@workspace/design-tokens';

const styles = {
  container: {
    backgroundColor: colors.primary[500],
    padding: spacing[4],
  },
};
```

## Mobile (React Native / Expo)

### 1. Use Colors

```tsx
import { colors } from '@workspace/design-tokens';

export function Card({ children }: CardProps) {
  return (
    <View
      style={{
        backgroundColor: colors.common.white,
        borderRadius: 12,
        padding: 16,
      }}
    >
      {children}
    </View>
  );
}
```

### 2. Use Shadows

```tsx
import { shadows } from '@workspace/design-tokens';

export function FloatingButton({ onPress }: FloatingButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: colors.primary[500],
        borderRadius: 28,
        width: 56,
        height: 56,
        ...shadows.lg.native, // Apply React Native shadow
      }}
    >
      <Icon name="plus" size={24} color="white" />
    </Pressable>
  );
}
```

### 3. Use Typography

```tsx
import { typography, colors } from '@workspace/design-tokens';

export function Heading({ children }: HeadingProps) {
  return (
    <Text
      style={{
        fontFamily: typography.fontFamily.sans.native.bold,
        fontSize: 24, // From typography.fontSize['2xl']
        lineHeight: 32,
        color: colors.neutral[800],
      }}
    >
      {children}
    </Text>
  );
}
```

### 4. Use Spacing

```tsx
import { spacing } from '@workspace/design-tokens';

export function Layout({ children }: LayoutProps) {
  return (
    <View
      style={{
        padding: 16, // spacing[4]
        gap: 12, // spacing[3]
      }}
    >
      {children}
    </View>
  );
}
```

### 5. With NativeWind

```tsx
// If using NativeWind (Tailwind for React Native)
import { View, Text } from 'react-native';

export function Card({ children }: CardProps) {
  return (
    <View className="bg-card rounded-lg p-4 shadow-md">
      <Text className="text-card-foreground text-base">
        {children}
      </Text>
    </View>
  );
}
```

## Theme Switching

### Web (Next.js)

```tsx
'use client';

import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-lg bg-secondary hover:bg-secondary/80"
    >
      {theme === 'dark' ? '🌞' : '🌙'}
    </button>
  );
}
```

```tsx
// app/providers.tsx
'use client';

import { ThemeProvider } from 'next-themes';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}
```

### Mobile (React Native)

```tsx
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme } from '@workspace/design-tokens/themes';

export function useTheme() {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? darkTheme : lightTheme;
}

// Usage in component
export function Card({ children }: CardProps) {
  const theme = useTheme();

  return (
    <View style={{ backgroundColor: theme.card }}>
      <Text style={{ color: theme.cardForeground }}>
        {children}
      </Text>
    </View>
  );
}
```

## Animation Examples

### Web

```tsx
import { animation } from '@workspace/design-tokens';

// Using Tailwind classes
export function Modal({ isOpen, children }: ModalProps) {
  return (
    <div className={`
      fixed inset-0 z-50
      ${isOpen ? 'animate-fade-in' : 'animate-fade-out'}
    `}>
      <div className="animate-scale-in">
        {children}
      </div>
    </div>
  );
}

// Using inline styles
export function Toast({ message }: ToastProps) {
  return (
    <div
      style={{
        animation: `slideInFromBottom ${animation.duration.normal} ${animation.easing.easeOut}`,
      }}
    >
      {message}
    </div>
  );
}
```

### Mobile

```tsx
import { Animated } from 'react-native';
import { animation } from '@workspace/design-tokens';

export function FadeInView({ children }: FadeInViewProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200, // animation.duration.normal
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      {children}
    </Animated.View>
  );
}
```

## Responsive Design

### Web

```tsx
export function Hero() {
  return (
    <section className="
      px-4 py-8
      md:px-8 md:py-16
      lg:px-12 lg:py-24
    ">
      <h1 className="
        text-3xl md:text-4xl lg:text-5xl
        font-bold
        text-foreground
      ">
        Welcome to Gearboxe
      </h1>
    </section>
  );
}
```

### Mobile

```tsx
import { useWindowDimensions } from 'react-native';
import { spacing } from '@workspace/design-tokens';

export function ResponsiveLayout({ children }: LayoutProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  return (
    <View
      style={{
        padding: isTablet ? 32 : 16, // spacing[8] : spacing[4]
        maxWidth: isTablet ? 1200 : '100%',
      }}
    >
      {children}
    </View>
  );
}
```

## Gradient Example

```tsx
import { primary } from '@workspace/design-tokens/colors';

// Web
export function GradientButton({ children }: ButtonProps) {
  return (
    <button className="
      bg-gradient-to-r from-primary to-accent
      text-primary-foreground
      px-6 py-3 rounded-lg
      font-semibold
    ">
      {children}
    </button>
  );
}

// Mobile
import { LinearGradient } from 'expo-linear-gradient';

export function GradientCard({ children }: CardProps) {
  return (
    <LinearGradient
      colors={[primary[500], primary[700]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 12, padding: 16 }}
    >
      {children}
    </LinearGradient>
  );
}
```

## Accessibility Examples

### Focus States

```tsx
// Web
export function AccessibleButton({ children }: ButtonProps) {
  return (
    <button className="
      bg-primary text-primary-foreground
      px-4 py-2 rounded-lg
      focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
      transition-all duration-fast
    ">
      {children}
    </button>
  );
}

// Mobile
export function AccessiblePressable({ children, onPress }: PressableProps) {
  return (
    <Pressable
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: pressed ? primary[600] : primary[500],
        opacity: pressed ? 0.8 : 1,
        padding: 16,
        borderRadius: 12,
      })}
    >
      {children}
    </Pressable>
  );
}
```

### High Contrast Mode Support

```css
/* Automatically handled by CSS variables */
@media (prefers-contrast: high) {
  :root {
    --border: 40 8% 75%; /* Increase border contrast */
  }
}
```

## Best Practices Summary

1. **Always use semantic tokens** (`bg-primary` instead of `bg-blue-500`)
2. **Use CSS variables for dynamic theming** (`hsl(var(--background))`)
3. **Leverage Tailwind utilities** for consistency and smaller bundle sizes
4. **Use TypeScript types** for autocomplete and type safety
5. **Apply shadows consistently** using predefined shadow tokens
6. **Respect animation preferences** (handled automatically via CSS)
7. **Use spacing scale** for consistent layouts
8. **Test in both light and dark modes** to ensure proper contrast
