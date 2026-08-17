# Glossary: ClinicalGit

Terms specific to this project. Guessing at these instead of checking here is exactly how the Fact-immutability invariant got violated in an earlier draft (`docs/practice/codeexamples.md` #9) — when in doubt, check this file, don't assume from the name alone.

**Fact** — An immutable piece of evidence: a lab value, imaging finding, vital sign, or observation. Never edited or deleted once recorded. Facts don't have a status field.

**Interpretation** — A mutable clinical claim built on one or more Facts: a diagnosis or hypothesis. Never edited directly — corrections happen by changing its `status`, or by creating a new Interpretation that supersedes it.

**Decision** — A treatment, prescription, or procedure based on a `Confirmed` Interpretation. Has the same status lifecycle as Interpretation (`Active` instead of `Hypothesis` as the starting state).

**Branch** — An open clinical question with one or more competing Interpretations attached (e.g. "cause of the lung lesion" with TB, cancer, and fungal infection all open simultaneously). Resolved via merge/close.

**Merge / Close** — The act of resolving a Branch: one Interpretation becomes `Confirmed`, the rest become `RuledOut`, the Branch becomes `Closed`. Ruled-out Interpretations are never deleted.

**Status (Interpretation/Decision)** —
- `Hypothesis` / `Active` — the starting state.
- `Confirmed` — accepted as correct (Interpretation only; Decision starts at `Active` instead).
- `RuledOut` — lost a branch resolution to a competing Interpretation.
- `Retracted` — was wrong; an error correction.
- `Superseded` — was refined by a newer Interpretation/Decision, not wrong, just improved (e.g. "Diabetes" → "MODY"). Distinct from `Retracted` — see ADR 0002.

**Blame** — Given a Decision, the traced chain back through its Interpretation, any prior Interpretations it superseded, the supporting Facts, and the authoring Doctor. The feature that demonstrates "why was this decision made."

**Clinical Reasoning Graph** — The overall Neo4j graph of Patients, Facts, Interpretations, Branches, Decisions, and Doctors, and how they connect. Not a formal external term — this project's name for its own data model.

**FHIR Provenance** — An existing HL7 FHIR standard resource that answers "what record produced this record" (retrospective, single-hop metadata). Referenced throughout the docs as the nearest existing standard, and as the thing ClinicalGit is *not* — it has no first-class concept of competing diagnostic branches, which is this project's actual differentiator (see `docs/product/prd.md` §9).

**Learning Healthcare System** — An existing term in health informatics (Institute of Medicine, 2007) for a system where patient outcomes continuously refine future clinical reasoning. Referenced in this project only as a future-direction concept (PRD §11) — not something built or demoed in MVP scope.
