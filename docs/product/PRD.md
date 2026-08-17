# PRD: ClinicalGit

**Tagline:** A graph-native system for tracking clinical hypotheses, evidence, decisions, retractions, and diagnostic reasoning over a patient's medical journey.

**Status:** MVP scope, locked after three rounds of architectural critique.

---

## 1. Problem Statement

Current medical records (EHR/EMR) store *what was decided* — a diagnosis, a prescription — but not *why*, and not *what else was considered and ruled out*. When a patient has competing possible diagnoses (e.g. tuberculosis vs. lung cancer vs. fungal infection), the record only ever shows the winner. The reasoning path — what evidence supported each hypothesis, who considered what, and why alternatives were rejected — disappears the moment a diagnosis is confirmed.

This creates two costs:
- **For clinicians:** no way to audit or reconstruct *why* a past decision was made without relying on memory or scattered notes.
- **For future care:** no record that an alternative diagnosis was ever considered and ruled out, so it can resurface unnecessarily, or a genuinely relevant rejected hypothesis is lost.

FHIR's `Provenance` resource solves an adjacent but narrower problem — "what record produced this record" — as metadata bolted onto existing resources. It has no first-class concept of **competing diagnostic branches**. That gap is what this project targets.

## 2. Goals (v1 / MVP)

- Every diagnosis and treatment decision is linked to the evidence (lab results, imaging, observations) that supports it.
- Competing hypotheses can coexist explicitly, tracked as branches, until one is confirmed and the rest are explicitly ruled out (not silently overwritten).
- Any past decision can be traced back to its full reasoning chain: evidence → interpretation → decision, including interpretations that were later corrected.
- Corrections to diagnoses are handled as an explicit state change (retracted / superseded), never as silent edits or deletions.

## 3. Non-Goals (explicitly out of scope for v1)

- **Outcome / population analytics** ("show all patients where this reasoning path led to bad outcomes"). Requires a real patient corpus with years of follow-up to be statistically meaningful — not buildable or honestly demoable at MVP stage. Mentioned only as a future direction.
- **GraphRAG / AI reasoning layer.** Deferred until the underlying graph is proven; the AI would only be reading the system, not the point of it.
- **Full-text search (OpenSearch) across notes/reports.**
- **Enterprise RBAC / role hierarchy.** A single hard-coded permission rule replaces this (see §6).
- **Object storage infrastructure.** Attachments are stored in one bucket/disk location and referenced by URL — not a subsystem in its own right.
- Replacing or interoperating with real EHR systems. This is a standalone demonstration of the data model, not a hospital-deployable product.

## 4. Target User (for the demo)

A clinician entering and reviewing patient diagnostic history — modeled loosely, not validated with real clinical workflows. The primary "user" for MVP purposes is the reviewer/judge evaluating the reasoning-chain and branching features live.

## 5. Core Concepts

| Concept | Definition |
|---|---|
| **Fact** | An immutable piece of evidence: a lab value, imaging finding, vital sign, observation. Never changes once recorded. |
| **Interpretation** | A mutable clinical claim built on facts: a diagnosis or hypothesis. Carries a status that changes over time — this is where correction happens, never by editing the original claim. |
| **Branch** | A set of competing interpretations for the same open clinical question (e.g. "cause of the lesion"). Multiple interpretations can be open on one branch simultaneously. |
| **Decision** | A treatment, prescription, or procedure based on a confirmed interpretation. |

This Fact/Interpretation split exists specifically because immutability applies to *evidence*, not to *clinical claims about the evidence* — collapsing the two was the central flaw in the original "everything is an immutable Git commit" framing.

## 6. Features (P0 — build all four, nothing else)

### 6.1 Evidence-backed interpretations
Every interpretation must link to at least one supporting fact. No diagnosis without a traceable evidentiary basis.

### 6.2 Differential-diagnosis branching
Multiple interpretations can be attached to the same branch simultaneously (e.g. TB, lung cancer, fungal infection, all open at once). This is the project's core differentiator — the thing FHIR Provenance and standard EHRs do not model.

### 6.3 Merge / Close
When new evidence resolves a branch, one interpretation is marked `Confirmed`, the rest are marked `RuledOut`, and the branch is closed. The ruled-out interpretations remain visible and queryable — they are not deleted.

### 6.4 Clinical blame
Given any decision, trace back through its interpretation to the original supporting facts and authoring doctor — including walking through any chain of superseded interpretations, so "why was this decision made" surfaces the true original reasoning, not just the current label.

## 7. State Model

**Interpretation status:**
```
Hypothesis → Confirmed
           → RuledOut
Confirmed  → Retracted   (interpretation was wrong)
           → Superseded  (interpretation was refined, not wrong — e.g. Diabetes → MODY)
```

**Decision status** (same pattern, applied to treatments/prescriptions — a gap in earlier drafts that must be closed before build):
```
Active → Retracted   (treatment was wrong, e.g. wrong dosage)
       → Superseded   (treatment was refined)
```

Retracted and Superseded are kept as separate states deliberately: an error correction and a diagnostic refinement are clinically and legally different events, and conflating them undermines the project's core "facts never change, interpretations gain new states" argument.

## 8. Permissions (deliberately minimal for MVP)

No RBAC system. One hard-coded rule: **only the original author or a designated supervising physician may retract an interpretation or decision.** This is a policy check in application code, not an identity/access-management subsystem — building real RBAC is explicitly out of scope.

## 9. Positioning Against FHIR Provenance

Do not lead with "we're a graph, they're metadata" — that's an implementation detail, not a structural distinction, and a knowledgeable reviewer can dismiss it (nothing stops modeling FHIR Provenance as a graph). Lead instead with: **FHIR Provenance answers "what record produced this record" (retrospective, single-hop). ClinicalGit answers "what competing hypotheses were considered, and why were they ruled out" — a concept FHIR has no first-class representation for.** Differential-diagnosis branching is the actual moat.

## 10. Success Criteria for the Demo

- Live demo of a branch with 2-3 competing interpretations, resolved via merge/close, with ruled-out interpretations still visible.
- Live `blame` query on a decision, showing the full evidence → interpretation → decision chain, including a superseded interpretation in the chain.
- A prepared, specific answer (not improvised) to "why not just use FHIR Provenance" and "who is allowed to retract a diagnosis."
- No demo dependency on outcome analytics, GraphRAG, or search — these appear only as a "Future Work" slide.

## 11. Build Order

1. Fact + Interpretation nodes + evidence-linking (foundation — everything else depends on this)
2. Branch + merge/close (the core differentiator — build early, leave time to polish the demo)
3. Blame query (including the supersede-chain walk)
4. Decision node + status field
5. UI last

## 12. Open Risks

- **Permission model is a single hard-coded rule** — fine for MVP, but a reviewer may probe whether it generalizes; have the "we scoped this deliberately" answer ready rather than defending it as sufficient long-term.
- **No real clinical validation.** The data model is architecturally sound but has not been reviewed by an actual clinician; framing should stay "a primitive for clinical reasoning," not "ready for hospital use."
- **Scope discipline.** Every prior round of feedback added a tempting feature (outcome tracking, population analytics). The plan only survives if these stay on a slide and out of the codebase.
