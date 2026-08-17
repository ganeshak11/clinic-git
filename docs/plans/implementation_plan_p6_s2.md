# Phase 6, Sub-phase 2 — Rehearsal & Q&A Prep

**Phase:** 6 — Demo Prep
**Sub-phase:** 2 of 2 (Project completion)
**Depends on:** P6.S1 (Seed script working)
**Exit criterion:** Full demo path runs end-to-end from a cold seed in under the allotted time, with no database fixes mid-demo. Written answers to "why not FHIR Provenance" and "who can retract a diagnosis" are prepared.

---

## Context

This is not a build phase — it's a rehearsal phase. The code is complete. The only deliverables are: a timed rehearsal, prepared answers, and confidence that the demo runs without intervention.

---

## Tasks

### Demo Walkthrough Script

Rehearse this exact sequence:

1. **Cold start:** `npm run db:clear && npm run seed && npm run dev`
2. **Patient view:** Navigate to Maria Santos. Show facts list — clinical evidence.
3. **Branch view:** Show the "Cause of left upper lobe lesion" branch with 3 competing interpretations. Point out: "All three diagnoses are tracked simultaneously — this is what FHIR Provenance can't model."
4. **Resolve (live or pre-seeded):** Show the resolved branch — one confirmed, two ruled-out but still visible. Point out: "Ruled-out diagnoses aren't deleted. They stay in the record."
5. **Decision:** Show the treatment decision linked to the confirmed interpretation.
6. **Blame:** Click through to the blame view. Show the chain: decision → refined interpretation → original (superseded) interpretation → supporting facts → authoring doctor. Point out: "This traces not just the current diagnosis, but the full history of reasoning that led to this treatment — including the refinement from 'lung cancer' to 'NSCLC Stage IIA'."
7. **Log:** Show the patient log — chronological timeline of everything.

### Prepared Answers

#### "Why not just use FHIR Provenance?"

Per PRD §9:

> FHIR Provenance answers "what record produced this record" — retrospective, single-hop metadata. ClinicalGit answers "what competing hypotheses were considered, and why were they ruled out." FHIR has no first-class concept of differential-diagnosis branching. That's the actual moat — not "we use a graph database" (which is an implementation detail, not a structural distinction).

#### "Who is allowed to retract a diagnosis?"

Per architecture.md §3, PRD §8:

> Only the original author or a designated supervising physician. This is a single in-code conditional, not an RBAC system — a deliberate MVP scope cut. It enforces the real requirement (not just anyone can rewrite a diagnosis) without pretending to be more sophisticated than it is. At scale, this would need a real role hierarchy scoped to departments and teams — but for this demonstration, the important thing is that the constraint exists and is enforced, not that it models every hospital's organizational chart.

### Timing

- Target: complete walkthrough in under the allotted presentation time
- Run through at least twice
- Note any steps that feel slow or confusing — simplify before demo day

---

## Deliverables

| Deliverable | Purpose |
|-------------|---------|
| Timed rehearsal (2+ runs) | Confirm demo runs within time |
| Written FHIR answer | Prepared response, not improvised |
| Written retract-permissions answer | Prepared response, not improvised |
| Cold-seed verification | Confirm no manual DB fixes needed |

---

## Verification

```bash
# Cold start test
docker compose down -v
docker compose up -d
# Wait for Neo4j to start
npm run db:clear
npm run seed
npm run dev
# Run full demo walkthrough — no manual fixes needed
```

**The project is complete when this cold-start demo runs cleanly twice.**
