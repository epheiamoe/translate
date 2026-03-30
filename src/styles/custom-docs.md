# Custom CSS Guide

This document explains how to customize the appearance of the Translate PWA using CSS variables.

## CSS Variables

The app uses CSS custom properties (variables) defined in `src/styles/global.css`. You can override these variables to change the app's appearance.

### Color Variables

```css
:root {
  /* Primary color */
  --color-primary: #0f30e0;
  --color-primary-hover: #0a25b8;
  
  /* Background colors */
  --color-bg: #ffffff;
  --color-bg-secondary: #f7f9fc;
  --color-bg-tertiary: #eef1f8;
  
  /* Border colors */
  --color-border: #dfe3ef;
  --color-border-focus: #0f30e0;
  
  /* Text colors */
  --color-text: #1a1a2e;
  --color-text-secondary: #6b7280;
  --color-text-placeholder: #9ca3af;
  
  /* Status colors */
  --color-success: #10b981;
  --color-error: #ef4444;
  --color-warning: #f59e0b;
}
```

### Typography Variables

```css
:root {
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
}
```

### Spacing Variables

```css
:root {
  --spacing-1: 0.25rem;   /* 4px */
  --spacing-2: 0.5rem;    /* 8px */
  --spacing-3: 0.75rem;   /* 12px */
  --spacing-4: 1rem;      /* 16px */
  --spacing-5: 1.25rem;   /* 20px */
  --spacing-6: 1.5rem;    /* 24px */
  --spacing-8: 2rem;      /* 32px */
}
```

### Border Radius Variables

```css
:root {
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 9999px;
}
```

### Shadow Variables

```css
:root {
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}
```

### Transition Variables

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
}
```

## Customization Examples

### Custom Primary Color (Purple Theme)

```css
:root {
  --color-primary: #7c3aed;
  --color-primary-hover: #6d28d9;
  --color-border-focus: #7c3aed;
}
```

### Dark Theme

```css
:root {
  --color-primary: #5b8af0;
  --color-primary-hover: #7aa3f5;
  --color-bg: #1a1a2e;
  --color-bg-secondary: #252540;
  --color-bg-tertiary: #2d2d4a;
  --color-border: #3d3d5c;
  --color-text: #f3f4f6;
  --color-text-secondary: #9ca3af;
}
```

### Rounded Corners

```css
:root {
  --radius-sm: 0.5rem;
  --radius-md: 1rem;
  --radius-lg: 1.5rem;
}
```

### Custom Fonts

```css
:root {
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

## Adding Custom CSS

To add custom CSS without modifying the source files:

1. Create a new CSS file (e.g., `src/styles/custom.css`)
2. Import it in your component or main entry file
3. Add your overrides after importing the default styles

Or, you can inject custom styles via the browser's developer console or a browser extension like Stylus.

## Component-Specific Styling

Individual components may have additional CSS classes. You can inspect the DOM to find specific class names and target them:

```css
/* Example: Custom styling for translation area */
.translation-area {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
}

/* Example: Custom styling for buttons */
.btn-primary {
  background: var(--color-primary);
  transition: background var(--transition-fast);
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}
```