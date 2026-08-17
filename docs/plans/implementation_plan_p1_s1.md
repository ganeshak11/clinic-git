# Phase 1, Sub-phase 1 — Type System & Transition Guards

**Phase:** 1 — Facts & Interpretations
**Sub-phase:** 1 of 4
**Depends on:** P0.S2 (project running, Vitest working)
**Exit criterion:** Unit tests pass for every valid Interpretation transition, every invalid transition (including same-state `Confirmed → Confirmed`), and every permission check case (author, supervisor, neither). No `any` types, no bare `string` status fields.

---

## Context

This sub-phase builds the pure-logic foundation that all API routes depend on. No database, no endpoints — just types, guards, and tests. Getting these right now prevents the bugs documented in codeexamples.md #1, #5, and #7.

---

## Proposed Changes

### [NEW] src/lib/types.ts — Domain Types

All domain types with union-typed status fields (invariant #7: never bare `string`):

```typescript
// === Status Types (union types, never bare string — invariant #7) ===

export type InterpretationStatus =
  | 'Hypothesis'
  | 'Confirmed'
  | 'RuledOut'
  | 'Retracted'
  | 'Superseded';

export type DecisionStatus =
  | 'Active'
  | 'Retracted'
  | 'Superseded';

export type BranchStatus = 'Open' | 'Closed';

export type FactType = 'lab' | 'imaging' | 'vital' | 'observation';

// === Node Types ===

export interface Patient {
  id: string;
  name: string;
  createdAt: string; // ISO 8601
}

export interface Doctor {
  id: string;
  name: string;
  isSupervisor: boolean;
}

export interface Fact {
  id: string;
  patientId: string;
  type: FactType;
  value: string;
  recordedAt: string; // ISO 8601
  attachmentUrl?: string;
}

export interface Interpretation {
  id: string;
  patientId: string;
  summary: string;
  status: InterpretationStatus;
  authorId: string;
  branchId?: string;
  supersedesId?: string;
  retractedReason?: string;
  createdAt: string; // ISO 8601
}

export interface Decision {
  id: string;
  patientId: string;
  interpretationId: string;
  action: string;
  status: DecisionStatus;
  authorId: string;
  createdAt: string; // ISO 8601
}

export interface Branch {
  id: string;
  patientId: string;
  question: string;
  status: BranchStatus;
  createdAt: string; // ISO 8601
}

// === API Input Types ===

export interface CreateFactInput {
  patientId: string;
  type: FactType;
  value: string;
  recordedAt: string;
  attachmentUrl?: string;
}

export interface CreateInterpretationInput {
  patientId: string;
  summary: string;
  supportingFactIds: string[]; // must be non-empty
  authorId: string;
  branchId?: string;
}

export interface CreateDecisionInput {
  patientId: string;
  interpretationId: string; // must be Confirmed
  action: string;
  authorId: string;
}

export interface RetractInput {
  reason: string;
}

export interface SupersedeInterpretationInput {
  newSummary: string;
  supportingFactIds: string[];
  reason: string;
}

export interface CreateBranchInput {
  patientId: string;
  question: string;
}

export interface ResolveBranchInput {
  confirmedInterpretationId: string;
}

// === Read Types ===

export interface LogEntry {
  type: 'fact' | 'interpretation' | 'decision';
  timestamp: string;
  nodeId: string;
  summary: string;
}

export interface BlameResult {
  decision: Decision;
  interpretation: Interpretation;
  priorChain: Interpretation[]; // walked via SUPERSEDES, oldest last
  supportingFacts: Fact[];
  authoredBy: { id: string; name: string };
}
```

**Design decisions:**
- All IDs are `string` — consistent across every node type (prevents codeexamples.md #3)
- Status fields are union types, not `string` — prevents typo bugs like `'Actve'` (codeexamples.md #7)
- `DecisionStatus` uses `Active` as starting state, not `Hypothesis` — per PRD §7
- `createdAt` added to all nodes for chronological ordering in the log view (Phase 3.2)

---

### [NEW] src/lib/transitions.ts — Status Transition Guards

```typescript
import type { InterpretationStatus, DecisionStatus } from './types';

const VALID_INTERPRETATION_TRANSITIONS: Record<InterpretationStatus, InterpretationStatus[]> = {
  Hypothesis: ['Confirmed', 'RuledOut'],
  Confirmed: ['Retracted', 'Superseded'],
  RuledOut: [],
  Retracted: [],
  Superseded: [],
};

/**
 * Guard function for Interpretation status transitions.
 * Same-state transitions (e.g. Confirmed → Confirmed) are INVALID, not no-ops.
 * See codeexamples.md #1 for the bug this prevents.
 */
export function canTransitionInterpretation(
  from: InterpretationStatus,
  to: InterpretationStatus,
): boolean {
  // No || from === to — same-state transitions are invalid (codeexamples.md #1)
  return VALID_INTERPRETATION_TRANSITIONS[from].includes(to);
}

const VALID_DECISION_TRANSITIONS: Record<DecisionStatus, DecisionStatus[]> = {
  Active: ['Retracted', 'Superseded'],
  Retracted: [],
  Superseded: [],
};

/**
 * Guard function for Decision status transitions.
 * Same pattern as Interpretation — Active replaces Hypothesis as the starting state.
 */
export function canTransitionDecision(
  from: DecisionStatus,
  to: DecisionStatus,
): boolean {
  return VALID_DECISION_TRANSITIONS[from].includes(to);
}
```

**Critical:** No `|| from === to` — this was the exact bug in codeexamples.md #1 that silently allowed double-retraction.

---

### [NEW] src/lib/permissions.ts — Retract Permission Check

```typescript
/**
 * Permission check for retraction — ADR 0003.
 * Only the original author or a supervisor may retract.
 *
 * CRITICAL: The final return is `false`, not `true`.
 * A trailing `return true` was the exact bug in codeexamples.md #5
 * that silently bypassed the entire permission model.
 */
export function canRetract(
  nodeAuthorId: string,
  requestingUserId: string,
  requestorIsSupervisor: boolean,
): boolean {
  return nodeAuthorId === requestingUserId || requestorIsSupervisor;
}
```

**Why a single expression, not if/else:** Per ADR 0003 and codeexamples.md #5, the if/else pattern with a trailing `return true` was the documented bug. A single boolean expression eliminates the fallthrough path entirely.

---

### [NEW] src/lib/__tests__/transitions.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { canTransitionInterpretation, canTransitionDecision } from '../transitions';

describe('canTransitionInterpretation', () => {
  // Valid transitions
  it('allows Hypothesis → Confirmed', () => { /* ... */ });
  it('allows Hypothesis → RuledOut', () => { /* ... */ });
  it('allows Confirmed → Retracted', () => { /* ... */ });
  it('allows Confirmed → Superseded', () => { /* ... */ });

  // Invalid transitions
  it('rejects Hypothesis → Superseded (skip)', () => { /* ... */ });
  it('rejects Hypothesis → Retracted (skip)', () => { /* ... */ });
  it('rejects RuledOut → anything', () => { /* ... */ });
  it('rejects Retracted → anything', () => { /* ... */ });
  it('rejects Superseded → anything', () => { /* ... */ });

  // Same-state transitions — the codeexamples.md #1 bug
  it('rejects Hypothesis → Hypothesis (same-state)', () => { /* ... */ });
  it('rejects Confirmed → Confirmed (same-state)', () => { /* ... */ });
  it('rejects RuledOut → RuledOut (same-state)', () => { /* ... */ });
  it('rejects Retracted → Retracted (same-state)', () => { /* ... */ });
  it('rejects Superseded → Superseded (same-state)', () => { /* ... */ });
});

describe('canTransitionDecision', () => {
  it('allows Active → Retracted', () => { /* ... */ });
  it('allows Active → Superseded', () => { /* ... */ });
  it('rejects Active → Active (same-state)', () => { /* ... */ });
  it('rejects Retracted → anything', () => { /* ... */ });
  it('rejects Superseded → anything', () => { /* ... */ });
});
```

### [NEW] src/lib/__tests__/permissions.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { canRetract } from '../permissions';

describe('canRetract', () => {
  it('allows the original author to retract', () => { /* ... */ });
  it('allows a supervisor to retract', () => { /* ... */ });
  it('rejects a non-author, non-supervisor', () => { /* ... */ });
  it('rejects when authorId is empty string', () => { /* ... */ });
});
```

---

## Files Created

| Action | File | Purpose |
|--------|------|---------|
| NEW | `src/lib/types.ts` | All domain types with union status fields |
| NEW | `src/lib/transitions.ts` | Status transition guards |
| NEW | `src/lib/permissions.ts` | Retract permission check |
| NEW | `src/lib/__tests__/transitions.test.ts` | Exhaustive transition tests |
| NEW | `src/lib/__tests__/permissions.test.ts` | Permission check tests |

---

## Verification

```bash
npm run test
# All transition and permission tests pass
npx tsc --noEmit
# No type errors — confirms union types are used correctly throughout
```

---

## What This Does NOT Include

- No database interaction (P1.S2)
- No API endpoints (P1.S2+)
- No Cypher queries (P1.S2+)
