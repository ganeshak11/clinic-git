# Phase 5, Sub-phase 3 — Branch View

**Phase:** 5 — UI
**Sub-phase:** 3 of 4
**Depends on:** P5.S2 (Patient view working)
**Exit criterion:** A branch renders as a React Flow graph with interpretation nodes. "Resolve" action calls `/api/branch/:id/resolve`, visually updates confirmed (highlighted) vs. ruled-out (greyed) nodes. Ruled-out nodes remain visible.

---

## Context

This is the **visual centerpiece** of the demo per architecture.md — "React Flow is used specifically to render the commit/branch graph visually. Budget the most polish time here." The branch view shows competing diagnostic hypotheses as nodes on a graph, with the resolve action visually updating their states.

---

## Proposed Changes

### React Flow Installation

```bash
npm install @xyflow/react
```

### [NEW] src/app/branches/page.tsx — Branch List

- Lists all open and closed branches for the selected patient
- "Create Branch" button → dialog form for `question`
- Click to navigate to branch detail

### [NEW] src/app/branches/[id]/page.tsx — Branch Graph View

The main React Flow visualization:

- **Graph layout:**
  - Branch node at the top/center as the "question" being answered
  - Interpretation nodes below, connected to the branch node via edges
  - Each interpretation node shows: summary, author name, status badge
  
- **Node styling by status:**
  - `Hypothesis` — standard styling, indicates open question
  - `Confirmed` — highlighted with green border/glow, prominent
  - `RuledOut` — greyed out but visible, reduced opacity, NOT removed
  - `Retracted` — red indicator
  - `Superseded` — amber indicator

- **Actions:**
  - "Add Interpretation" button → creates a new interpretation on this branch
  - "Resolve Branch" button (visible only when branch is Open):
    - Opens a dialog showing all Hypothesis interpretations on the branch
    - User selects which one to confirm
    - Calls `POST /api/branch/:id/resolve`
    - On success: graph animates — confirmed node highlights, others grey out
    - Branch header updates to show "Closed"
  
- **Edge styling:**
  - `BELONGS_TO` relationships shown as edges from interpretations to the branch
  - After resolve: confirmed edge gets a different color/style than ruled-out edges

### [NEW] src/components/branch-graph.tsx — React Flow Component

```typescript
// Props: { branch: BranchDetail }
// Converts branch data into React Flow nodes and edges
// Handles layout calculation (dagre or manual positioning)
// Manages node click interactions
```

### [NEW] src/components/resolve-branch-dialog.tsx

Dialog for selecting which interpretation to confirm during branch resolution.

---

## Files Created

| Action | File | Purpose |
|--------|------|---------|
| NEW | `src/app/branches/page.tsx` | Branch list page |
| NEW | `src/app/branches/[id]/page.tsx` | Branch graph view |
| NEW | `src/components/branch-graph.tsx` | React Flow graph component |
| NEW | `src/components/resolve-branch-dialog.tsx` | Resolve action dialog |

---

## Verification

```bash
npm run dev
# 1. Navigate to /branches
# 2. Create a branch "Cause of lung lesion"
# 3. Add 3 interpretations: TB, Lung cancer, Fungal infection
# 4. Verify all 3 appear as nodes on the graph
# 5. Click "Resolve Branch" → select TB
# 6. Verify: TB node highlights green, other two grey out
# 7. Verify: greyed-out nodes are still visible (never removed)
# 8. Verify: branch header shows "Closed"
```

> [!IMPORTANT]
> This view gets the most polish time. The graph should feel dynamic and interactive — smooth animations on resolve, clear visual hierarchy, and an immediately understandable layout for a reviewer with no prior context.
