# ADR 0002: Split Facts (Immutable) from Interpretations (Mutable)

**Status:** Accepted

## Context

The original pitch modeled every clinical event — a lab result, a diagnosis, a prescription — as a single immutable "commit," directly mirroring Git. This breaks under scrutiny: Git's immutability model assumes a past state was correct at the time it was recorded. A wrong diagnosis was never correct at any time — it needs to be correctable, and in most jurisdictions the diagnosing clinician is obligated to correct the record, not just append a new entry that supersedes it while the wrong claim sits in history as if it were once valid.

Evidence (a lab value, an imaging finding) doesn't have this problem — a measured HbA1c of 8.4 either was or wasn't the value returned by the lab, and that never changes.

## Decision

Split the model into two node types with different mutability guarantees:

- **Fact** — immutable. Evidence: lab values, vitals, imaging findings, observations. Never edited or deleted, no update endpoint exists.
- **Interpretation** — mutable via an explicit status field, never via editing the claim itself: `Hypothesis → Confirmed/RuledOut`, `Confirmed → Retracted/Superseded`. Corrections happen by changing status and, for supersession, creating a new Interpretation node linked via `SUPERSEDES` — never by rewriting the original.

`Retracted` and `Superseded` are kept as separate states rather than merged into one "corrected" state, because they represent clinically and legally different events: a retraction means the original claim was wrong; a supersession (e.g. "Diabetes" refined to "MODY") means it was refined, not wrong.

## Consequences

**Positive:**
- Legally and clinically defensible: facts are never in dispute, only their interpretation is, which matches how medical error and diagnostic refinement actually work.
- The original (wrong or superseded) interpretation stays visible and queryable, preserving the "what was considered" history that's the project's core value — deleting or overwriting it would lose exactly the information ClinicalGit exists to keep.
- `Decision` follows the same pattern (see the API spec) rather than needing a separate design.

**Negative:**
- More complex than a single "commit" type — two node types, two (structurally identical) status lifecycles, and a `SUPERSEDES` chain that the blame query must walk correctly (see `architecture.md` §4; getting the walk direction wrong is a documented failure mode, not hypothetical — see `docs/practice/codeexamples.md` #4).
- Requires a status-transition guard enforced in code (not just trusted at the client) to prevent invalid jumps like `Hypothesis → Superseded` directly.

## Alternatives considered

- **Single immutable "commit" model, literal Git analogy** — the original pitch. Rejected: doesn't accommodate legally-required corrections without either lying about immutability or losing the append-only property being claimed.
- **Fully mutable records with an audit log on the side** — closer to how most EHRs already work. Rejected: this is exactly the status quo the project exists to improve on; an audit log bolted onto mutable records is what FHIR Provenance already does (see PRD §9).
