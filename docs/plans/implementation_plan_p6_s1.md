# Phase 6, Sub-phase 1 — Seed Script

**Phase:** 6 — Demo Prep
**Sub-phase:** 1 of 2
**Depends on:** P5.S4 (UI complete)
**Exit criterion:** Running the seed script against a clean Neo4j instance creates a realistic patient case with: a resolved branch (2-3 ruled-out + 1 confirmed interpretation), a decision, and at least one superseded interpretation. Data looks clinical, not test-like.

---

## Context

The application is feature-complete (Phases 0–5). This sub-phase creates a seed script that populates the database with realistic-looking demo data so the full demo can run without manual data entry.

---

## Proposed Changes

### [NEW] scripts/seed.ts — Demo Data Seeder

Produces one realistic patient case that exercises every feature:

**Patient:** "Maria Santos", age 58

**Clinical scenario:** Persistent cough with lung lesion on imaging

**Facts:**
1. Lab: "CBC - WBC 12.3 × 10⁹/L (elevated)" — recorded Jan 15
2. Imaging: "CT Chest — 2.1cm left upper lobe lesion, spiculated margins" — recorded Jan 16
3. Lab: "Sputum AFB smear — negative" — recorded Jan 18
4. Lab: "Serum CEA — 8.4 ng/mL (elevated)" — recorded Jan 19
5. Vital: "Oxygen saturation 94% on room air" — recorded Jan 15

**Doctors:**
- Dr. Priya Sharma (pulmonologist, not supervisor)
- Dr. James Chen (oncologist, supervisor)

**Branch:** "Cause of left upper lobe lesion"

**Interpretations on the branch:**
1. "Pulmonary tuberculosis" by Dr. Sharma — Hypothesis, citing facts 1, 2, 5
2. "Primary lung carcinoma (adenocarcinoma)" by Dr. Chen — Hypothesis, citing facts 2, 4
3. "Pulmonary fungal infection (aspergillosis)" by Dr. Sharma — Hypothesis, citing facts 1, 2

**Branch resolve:** Confirm "Primary lung carcinoma" → TB and fungal become RuledOut

**Supersede:** The original cancer interpretation is superseded by a refined one: "Non-small cell lung cancer, Stage IIA (T2aN0M0)" — demonstrating diagnostic refinement (Superseded, not Retracted)

**Decision:** "Refer for surgical lobectomy and adjuvant chemotherapy — cisplatin/pemetrexed" based on the refined interpretation

**What this gives the demo:**
- A resolved branch with ruled-out interpretations visible (the differentiator)
- A superseded interpretation in the blame chain (blame walks through the refinement)
- Realistic clinical data a reviewer can follow

### [MODIFY] package.json — Add seed script

```json
{
  "scripts": {
    "seed": "npx tsx scripts/seed.ts"
  }
}
```

### [NEW] scripts/clear.ts — Database Clear Script

Utility to wipe and re-seed:
```typescript
// Runs MATCH (n) DETACH DELETE n
// Then re-runs schema constraints
// Then runs seed
```

---

## Files Created

| Action | File | Purpose |
|--------|------|---------|
| NEW | `scripts/seed.ts` | Demo data seeder |
| NEW | `scripts/clear.ts` | Database clear utility |
| MODIFY | `package.json` | Add `seed` and `db:clear` scripts |

---

## Verification

```bash
# Clear and seed
npm run db:clear
npm run seed

# Verify via API
curl http://localhost:3000/api/patient/<maria-id>/log
# Expected: chronological timeline of all events

curl http://localhost:3000/api/blame/<decision-id>
# Expected: full chain including superseded interpretation

curl http://localhost:3000/api/branch/<branch-id>
# Expected: resolved branch with ruled-out interpretations visible

# Verify via UI
npm run dev
# Navigate through all views with the seeded data
```
