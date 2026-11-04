# Color Reference Guide

Visual reference for all colors in the Gearboxe design system.

## Primary Blue Scale (Monochromatic)

```
┌─────────────────────────────────────────────────────────────┐
│ primary[50]  │ hsl(210, 100%, 95%)  │ #E6F2FF  │ Lightest │
│ primary[100] │ hsl(210, 100%, 90%)  │ #CCE5FF  │          │
│ primary[200] │ hsl(210, 100%, 80%)  │ #99CCFF  │          │
│ primary[300] │ hsl(210, 100%, 70%)  │ #66B2FF  │          │
│ primary[400] │ hsl(210, 100%, 60%)  │ #3399FF  │          │
│ primary[500] │ hsl(210, 100%, 50%)  │ #007FFF  │ PRIMARY  │
│ primary[600] │ hsl(210, 100%, 45%)  │ #0072E6  │          │
│ primary[700] │ hsl(210, 100%, 35%)  │ #0059B3  │ ACCENT   │
│ primary[800] │ hsl(210, 100%, 25%)  │ #004080  │          │
│ primary[900] │ hsl(210, 100%, 15%)  │ #002B55  │ Darkest  │
└─────────────────────────────────────────────────────────────┘
```

**Usage:**
- `primary[500]` - Main brand color, buttons, links
- `primary[700]` - Accent, darker emphasis
- `primary[50-300]` - Backgrounds, subtle highlights
- `primary[600-900]` - Dark mode variants, hover states

## Warm Neutral Scale

```
┌──────────────────────────────────────────────────────────────────┐
│ neutral[50]  │ hsl(40, 20%, 98%)  │ #FDFCFA  │ Light BG       │
│ neutral[100] │ hsl(40, 15%, 96%)  │ #F8F6F3  │ Surface        │
│ neutral[200] │ hsl(40, 10%, 92%)  │ #EDEAE6  │ Border Light   │
│ neutral[300] │ hsl(40, 8%, 85%)   │ #DAD6D0  │ Border         │
│ neutral[400] │ hsl(40, 5%, 65%)   │ #A8A49E  │ Muted          │
│ neutral[500] │ hsl(40, 4%, 50%)   │ #827E78  │ Muted FG       │
│ neutral[600] │ hsl(40, 4%, 40%)   │ #686460  │ Secondary Text │
│ neutral[700] │ hsl(40, 4%, 30%)   │ #4E4B48  │ Primary Text   │
│ neutral[800] │ hsl(40, 5%, 15%)   │ #282624  │ Dark Text      │
│ neutral[900] │ hsl(40, 6%, 8%)    │ #161514  │ Dark BG        │
│ neutral[950] │ hsl(40, 8%, 5%)    │ #0F0E0D  │ Deepest Dark   │
└──────────────────────────────────────────────────────────────────┘
```

**Usage:**
- `neutral[50]` - Light mode main background
- `neutral[100]` - Light mode surface/card
- `neutral[200-300]` - Borders, dividers
- `neutral[400-600]` - Muted text, placeholders
- `neutral[700-800]` - Primary text in light mode
- `neutral[900-950]` - Dark mode backgrounds

## Semantic Colors

```
┌────────────────────────────────────────────────────────┐
│ destructive │ hsl(0, 84%, 60%)   │ #EF4444  │ Error   │
│ success     │ hsl(142, 71%, 45%) │ #22C55E  │ Success │
│ warning     │ hsl(38, 92%, 50%)  │ #F59E0B  │ Warning │
└────────────────────────────────────────────────────────┘
```

**Usage:**
- `destructive` - Error states, delete actions, danger zones
- `success` - Success messages, confirmations, positive states
- `warning` - Warning messages, cautions, pending states

## Common Colors

```
┌──────────────────────────────────────────────────┐
│ white       │ hsl(0, 0%, 100%)  │ #FFFFFF    │
│ black       │ hsl(0, 0%, 0%)    │ #000000    │
│ transparent │ transparent       │ -          │
└──────────────────────────────────────────────────┘
```

## Theme Color Mappings

### Light Theme

```
background         → neutral[50]   (#FDFCFA)
foreground         → neutral[800]  (#282624)
card               → white         (#FFFFFF)
primary            → primary[500]  (#007FFF)
secondary          → neutral[100]  (#F8F6F3)
muted              → neutral[100]  (#F8F6F3)
mutedForeground    → neutral[500]  (#827E78)
accent             → primary[700]  (#0059B3)
border             → neutral[200]  (#EDEAE6)
ring               → primary[500]  (#007FFF)
```

### Dark Theme

```
background         → neutral[900]  (#161514)
foreground         → neutral[50]   (#FDFCFA)
card               → neutral[800]  (#282624)
primary            → primary[500]  (#007FFF)
secondary          → neutral[800]  (#282624)
muted              → neutral[700]  (#4E4B48)
mutedForeground    → neutral[400]  (#A8A49E)
accent             → primary[400]  (#3399FF)
border             → neutral[700]  (#4E4B48)
ring               → primary[500]  (#007FFF)
```

## Color Contrast Guidelines

### Light Mode Text Contrast

- `neutral[800]` on `neutral[50]` - Primary text (AAA)
- `neutral[600]` on `neutral[50]` - Secondary text (AA)
- `neutral[500]` on `neutral[50]` - Muted text (AA for large text)
- `white` on `primary[500]` - Button text (AAA)

### Dark Mode Text Contrast

- `neutral[50]` on `neutral[900]` - Primary text (AAA)
- `neutral[200]` on `neutral[900]` - Secondary text (AAA)
- `neutral[400]` on `neutral[900]` - Muted text (AA)
- `white` on `primary[500]` - Button text (AAA)

## Color Usage Best Practices

1. **Use semantic tokens first**
   - Prefer `bg-primary` over `bg-[#007FFF]`
   - Use `text-foreground` instead of hardcoded colors

2. **Maintain contrast ratios**
   - Minimum 4.5:1 for normal text
   - Minimum 3:1 for large text and UI components
   - All combinations above meet WCAG AA standards

3. **Use opacity modifiers for variants**
   - `bg-primary/90` for hover states
   - `bg-primary/10` for subtle backgrounds
   - `border-primary/20` for soft borders

4. **Consistent color hierarchy**
   - Primary actions: `primary[500]`
   - Secondary actions: `neutral[100]` or `neutral[200]`
   - Tertiary/ghost: transparent with border
   - Destructive: `destructive`

5. **Dark mode considerations**
   - Test all color combinations in both modes
   - Use lighter accent colors (`primary[400]`) for better visibility
   - Increase border opacity for definition

## HSL Benefits

The design system uses HSL (Hue, Saturation, Lightness) format because:

1. **Easier to reason about** - Lightness directly corresponds to brightness
2. **Better for theming** - Can adjust lightness while keeping hue
3. **Tailwind compatible** - Works with opacity modifiers (`bg-primary/50`)
4. **Accessible variations** - Easy to create WCAG-compliant variants

## Color Tools

Generate variations and test contrast:
- [Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [HSL Color Picker](https://hslpicker.com/)
- [Tailwind Color Shades](https://tailwindshades.com/)
