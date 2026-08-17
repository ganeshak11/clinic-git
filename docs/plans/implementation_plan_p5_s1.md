# Phase 5, Sub-phase 1 — Design System & Layout Shell

**Phase:** 5 — UI
**Sub-phase:** 1 of 4
**Depends on:** P4.S3 (Entire backend API feature-complete and tested)
**Exit criterion:** A styled app shell renders with navigation between Patient, Branch, Log, and Blame views. Status badges for all states are visually distinct — Retracted ≠ Superseded color (codeexamples.md #8).

---

## Context

All backend APIs are tested and working (Phases 1–4). This sub-phase builds the design system and app shell — no data fetching yet, just the visual foundation that all views build on.

---

## Proposed Changes

### shadcn/ui Setup

```bash
npx shadcn@latest init
```

Components to install:
- `badge` — status badges
- `button` — actions
- `dialog` — forms in modals
- `form` — form validation
- `input` — text inputs
- `select` — dropdowns
- `card` — content containers
- `separator` — visual dividers
- `sidebar` / `navigation-menu` — app navigation

### [NEW] src/lib/constants.ts — Status Colors

```typescript
import type { InterpretationStatus, DecisionStatus } from './types';

/**
 * Status badge color mapping.
 * CRITICAL: Retracted ≠ Superseded — they are clinically different events
 * (codeexamples.md #8). Using the same color undercuts the project's
 * core distinction between error correction and diagnostic refinement.
 */
export const STATUS_COLORS: Record<InterpretationStatus | DecisionStatus, string> = {
  Hypothesis: 'bg-blue-100 text-blue-800',      // open question
  Active: 'bg-blue-100 text-blue-800',           // same semantic as Hypothesis
  Confirmed: 'bg-green-100 text-green-800',      // accepted
  RuledOut: 'bg-gray-100 text-gray-500',          // eliminated
  Retracted: 'bg-red-100 text-red-800',           // error correction
  Superseded: 'bg-amber-100 text-amber-800',      // refinement (NOT red)
};
```

### [NEW] src/components/status-badge.tsx

```typescript
// Renders a shadcn Badge with the correct color per status
// Uses exhaustive switch with never-typed default (coding-standards.md)
// Props: { status: InterpretationStatus | DecisionStatus }
```

### [NEW] src/components/app-layout.tsx

App shell with sidebar navigation:
- Patient view
- Branch view
- Log view
- Blame view
- Dark mode support
- Responsive layout

### [NEW] src/app/layout.tsx — Updated Root Layout

Integrate the app layout component, set up fonts (Inter from Google Fonts), and global theme.

---

## Files Created/Modified

| Action | File | Purpose |
|--------|------|---------|
| NEW | Various shadcn component files | UI component library |
| NEW | `src/lib/constants.ts` | Status colors and UI constants |
| NEW | `src/components/status-badge.tsx` | Status badge component |
| NEW | `src/components/app-layout.tsx` | App shell with navigation |
| MODIFY | `src/app/layout.tsx` | Root layout with theme |
| MODIFY | `src/app/globals.css` | Design tokens, dark mode |

---

## Verification

```bash
npm run dev
# Visit http://localhost:3000
# Verify: app shell renders with navigation
# Verify: all 6 status badge variants are visually distinct
# Verify: Retracted (red) ≠ Superseded (amber) — codeexamples.md #8
# Verify: responsive layout works at mobile/tablet/desktop widths
```
