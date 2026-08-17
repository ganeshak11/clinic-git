# Phase 5, Sub-phase 2 — Patient View

**Phase:** 5 — UI
**Sub-phase:** 2 of 4
**Depends on:** P5.S1 (Design system and layout shell)
**Exit criterion:** A user can select a patient, see their facts and interpretations, add a new fact via a dialog form, and add a new interpretation (selecting supporting facts) via a dialog form. All forms call the correct API endpoints and refresh the display.

---

## Context

The app shell exists (P5.S1). This sub-phase builds the first data-driven view — the patient detail page with CRUD operations for facts and interpretations.

---

## Proposed Changes

### [NEW] src/app/patients/page.tsx — Patient List

- Fetches all patients (may need a `GET /api/patient` list endpoint if not yet created)
- Displays as a card list
- "Add Patient" button with dialog form
- Click a patient to navigate to detail view

### [NEW] src/app/patients/[id]/page.tsx — Patient Detail

- Fetches `GET /api/patient/:id` for patient data, facts, and interpretations
- **Facts section:**
  - List of facts with type badge, value, and timestamp
  - "Add Fact" button → shadcn Dialog with form for type, value, recordedAt
  - Calls `POST /api/fact` on submit
- **Interpretations section:**
  - List of interpretations with status badge, summary, author
  - "Add Interpretation" button → Dialog with:
    - Summary text input
    - Supporting facts multi-select (from the patient's existing facts)
    - Author select (from seeded doctors)
    - Optional branch select
  - Calls `POST /api/interpretation` on submit
- **Actions on interpretations:**
  - Confirm button (visible for Hypothesis status)
  - Status displayed via the StatusBadge component from P5.S1

### [NEW] src/lib/api.ts — Client-Side API Helpers

Typed fetch wrappers for all API endpoints:

```typescript
export async function createFact(input: CreateFactInput): Promise<Fact> { /* ... */ }
export async function createInterpretation(input: CreateInterpretationInput): Promise<Interpretation> { /* ... */ }
export async function getPatient(id: string): Promise<PatientDetail> { /* ... */ }
// etc.
```

### [NEW/MODIFY] GET /api/patient (list endpoint)

If no list endpoint exists, add:
```typescript
// GET /api/patient — returns all patients
// Simple query: MATCH (p:Patient) RETURN p ORDER BY p.createdAt DESC
```

---

## Files Created

| Action | File | Purpose |
|--------|------|---------|
| NEW | `src/app/patients/page.tsx` | Patient list page |
| NEW | `src/app/patients/[id]/page.tsx` | Patient detail page |
| NEW | `src/lib/api.ts` | Client-side API helpers |
| NEW | `src/components/add-fact-dialog.tsx` | Add fact form dialog |
| NEW | `src/components/add-interpretation-dialog.tsx` | Add interpretation form dialog |
| NEW | `src/components/fact-card.tsx` | Fact display component |
| NEW | `src/components/interpretation-card.tsx` | Interpretation display component |
| NEW/MODIFY | `src/app/api/patient/route.ts` | Add GET handler for patient list |

---

## Verification

```bash
npm run dev
# 1. Navigate to /patients
# 2. Create a patient via the UI
# 3. Click into patient detail
# 4. Add a fact (type=lab, value="HbA1c 8.4%")
# 5. Add an interpretation citing the fact
# 6. Verify the interpretation shows status badge "Hypothesis"
# 7. Confirm the interpretation via the UI
# 8. Verify status badge updates to "Confirmed"
```
