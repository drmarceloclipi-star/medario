# @medario/ui

Shared visual foundation for the Medário mobile web application.

## Import

```tsx
import { Button, Card, Chip } from "@medario/ui";
import "@medario/ui/styles.css";
```

## Principles

- mobile-first and dark by default;
- semantic design tokens instead of component-local values;
- keyboard-visible focus states;
- touch targets of at least 44 px for primary controls;
- reduced-motion support;
- primitives remain independent from Firebase and domain rules.

## Initial primitives

- `Button`
- `IconButton`
- `Input`
- `Avatar`
- `Badge`
- `Card`
- `Chip`

The package intentionally contains no product-specific composition such as doctor cards, search composers, drawers or bottom sheets. Those are introduced in later issues using these primitives.
