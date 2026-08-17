# Phase 5, Sub-phase 4 — Log & Blame Views

**Phase:** 5 — UI
**Sub-phase:** 4 of 4 (Phase 5 completion)
**Depends on:** P5.S3 (Branch view working)
**Exit criterion:** Log view shows a chronological timeline. Blame view renders the full traced chain (decision → interpretation → prior superseded → facts → doctor) visually. A reviewer with no context can follow the chain.

---

## Context

This is the last build sub-phase. The log view provides the "git log" analogue, and the blame view renders the "git blame" chain — the two endpoints that sell the "ClinicalGit" metaphor. The blame view is what gets clicked through live in the demo, so it must be visually obvious, not a JSON dump.

---

## Proposed Changes

### [NEW] src/app/patients/[id]/log/page.tsx — Log View

Chronological timeline consuming `GET /api/patient/:id/log`:

- **Timeline component:**
  - Vertical timeline with entries in chronological order
  - Each entry shows: timestamp, type icon (fact/interpretation/decision), summary
  - Status badges inline for interpretations and decisions
  - Visual connection lines between entries
  
- **Entry styling by type:**
  - `fact` — evidence icon, neutral styling
  - `interpretation` — diagnosis icon, status badge
  - `decision` — treatment icon, status badge

- **Click interaction:** Clicking an interpretation or decision entry navigates to the blame view for that item.

### [NEW] src/app/blame/[decisionId]/page.tsx — Blame View

The clinical blame visualization consuming `GET /api/blame/:decisionId`:

- **Chain rendering (top to bottom or left to right):**
  1. **Decision** — the treatment/prescription at the top, with action text and status
  2. **↓ BASED_ON**
  3. **Current Interpretation** — the confirmed diagnosis, with summary and status
  4. **↓ SUPERSEDES** (if any)
  5. **Prior Interpretation(s)** — the chain of superseded interpretations, each shown with their original summary and "Superseded" badge
  6. **↓ SUPPORTS**
  7. **Supporting Facts** — the evidence that backs the interpretation
  8. **↓ AUTHORED_BY**
  9. **Doctor** — the clinician who authored the interpretation

- **Visual design:**
  - Each node in the chain is a card with clear labeling
  - Connecting arrows between cards show the relationship type
  - The superseded chain is visually distinct (e.g., dashed borders, slight indent) to show "this was the original reasoning that was later refined"
  - Color coding matches the status badges from P5.S1

- **This is the demo's key "aha" moment:** The viewer should immediately understand that they're seeing not just the current decision, but the full history of reasoning that led to it — including diagnoses that were wrong or refined.

### [NEW] src/components/timeline.tsx — Timeline Component

Reusable vertical timeline for the log view.

### [NEW] src/components/blame-chain.tsx — Blame Chain Component

Reusable chain visualization for the blame view.

---

## Files Created

| Action | File | Purpose |
|--------|------|---------|
| NEW | `src/app/patients/[id]/log/page.tsx` | Patient log timeline page |
| NEW | `src/app/blame/[decisionId]/page.tsx` | Blame chain visualization page |
| NEW | `src/components/timeline.tsx` | Timeline component |
| NEW | `src/components/blame-chain.tsx` | Blame chain visualization |

---

## Verification

```bash
npm run dev
# Log view:
# 1. Navigate to /patients/<id>/log
# 2. Verify chronological ordering of facts, interpretations, decisions
# 3. Verify status badges display correctly
# 4. Click an interpretation → navigates to blame view

# Blame view:
# 1. Navigate to /blame/<decision-id>
# 2. Verify full chain renders: decision → interpretation → prior chain → facts → doctor
# 3. Verify superseded interpretations appear in the chain
# 4. Verify a reviewer with no context can follow the chain visually
```

**Phase 5 is complete when the full demo flow works through the UI:**
1. Create a patient → add facts → add interpretations
2. Create a branch → add competing interpretations → resolve
3. Create a decision based on the confirmed interpretation
4. View the patient log → see all events chronologically
5. Click blame on the decision → see the full reasoning chain
