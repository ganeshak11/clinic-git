# Architecture: ClinicalGit

## 1. System Overview

```text
Frontend (Next.js + Tailwind + shadcn + React Flow)
              │
              ▼
     Next.js API routes
   (no separate Express service — unnecessary for this scope)
              │
              ▼
           Neo4j
   (patients, facts, interpretations,
    branches, decisions, doctors — everything)
              │
              ▼
   File attachments → single disk directory or one S3/MinIO bucket,
   referenced by URL from Fact nodes. Not a subsystem — just storage.
```

**Explicitly rejected:** Postgres + Neo4j dual-write. Every commit would need to write to two databases; a partial failure between the two writes (Postgres succeeds, Neo4j fails, or vice versa) is a real risk during a live demo and would require a saga/outbox pattern to solve properly — real engineering effort with no payoff for an MVP whose entire value proposition is graph-native reasoning. One database only.

**Also rejected for v1:** OpenSearch (search), MinIO as a "subsystem" (it's just a bucket), GraphRAG, any RBAC framework.

React Flow is used specifically to render the commit/branch graph visually — this is the demo's visual centerpiece, so budget real UI time here.

---

## 2. Data Model

### 2.1 Node types

```text
Patient
Doctor
Fact            — immutable: lab value, vital, imaging finding, observation
Interpretation  — mutable status: diagnosis / hypothesis
Branch          — an open clinical question with competing interpretations
Decision        — treatment, prescription, or procedure
```

### 2.2 Relationships

```cypher
(Patient)-[:HAS_FACT]->(Fact)
(Fact)-[:SUPPORTS]->(Interpretation)
(Interpretation)-[:BELONGS_TO]->(Branch)
(Interpretation)-[:AUTHORED_BY]->(Doctor)
(Interpretation)-[:SUPERSEDES]->(Interpretation)
(Decision)-[:BASED_ON]->(Interpretation)
(Decision)-[:AUTHORED_BY]->(Doctor)
```

### 2.3 State machines

**Interpretation:**
```text
Hypothesis → Confirmed
           → RuledOut
Confirmed  → Retracted   (was wrong)
           → Superseded  (was refined, e.g. Diabetes → MODY)
```

**Decision** (same pattern — added to close a gap not addressed by earlier drafts, which had no way to correct a treatment decision itself, only a diagnosis):
```text
Active → Retracted   (e.g. wrong dosage prescribed)
       → Superseded
```

Facts have no status field. They are never edited or deleted — that immutability is the one part of the original "Git" framing that survived intact.

---

## 3. API Surface (7 endpoints — resist adding more)

```text
POST /fact
POST /interpretation                 — attach to a branch + supporting facts
POST /branch/:id/resolve             — confirm one interpretation, rule out the rest, close the branch
POST /interpretation/:id/retract     — permission check: author or supervising physician only
POST /interpretation/:id/supersede
POST /decision                       — link to a confirmed interpretation
GET  /patient/:id/log                — chronological history (git-log analogue)
GET  /patient/:id/blame/:decisionId  — full reasoning-chain trace
```

Permission check for `/retract` is a single in-code conditional (author ID or supervising-physician flag) — not an RBAC system. See PRD §8 for why this is deliberately minimal.

---

## 4. Key Query: Clinical Blame

This is the demo centerpiece. Given a decision, walk back through any chain of superseded interpretations to the full original reasoning:

```cypher
MATCH (d:Decision {id:$id})-[:BASED_ON]->(i:Interpretation)
OPTIONAL MATCH (i)-[:SUPERSEDES*0..]->(prior:Interpretation)
MATCH (f:Fact)-[:SUPPORTS]->(i)
MATCH (i)-[:AUTHORED_BY]->(doc:Doctor)
RETURN d, i, prior, collect(f), doc
```

The `SUPERSEDES*0..` variable-length walk matters: if the decision was based on an interpretation that was later refined, blame should still surface the *original* evidence chain, not just the current label. Wiring this into the query from the start avoids a late scramble to add it before demo day.

---

## 5. Branch Resolve Query (Merge / Close)

```cypher
MATCH (b:Branch {id:$branchId})<-[:BELONGS_TO]-(i:Interpretation)
SET i.status = CASE WHEN i.id = $confirmedId THEN 'Confirmed' ELSE 'RuledOut' END
WITH b
SET b.status = 'Closed'
```

Ruled-out interpretations are never deleted — they stay attached to the branch and remain queryable via `/patient/:id/log`.

---

## 6. Build Order

1. **Fact + Interpretation nodes + evidence-linking** — foundation everything else depends on.
2. **Branch + merge/close** — the core differentiator (PRD §6.2–6.3). Build this early enough to leave real time for polishing its demo, since it's what carries the pitch.
3. **Blame query**, including the supersede-chain walk from day one.
4. **Decision node + status field** — don't skip this; it's the identified gap (§2.3).
5. **UI last** — React Flow graph view, log view, blame view.

---

## 7. Explicitly Deferred (Future Work slide only — no code)

- Outcome / population-level analytics
- GraphRAG / AI reasoning layer over the graph
- Full-text search (OpenSearch)
- Object storage as a real subsystem (MinIO/S3 abstraction layer)
- RBAC / role hierarchy beyond the single hard-coded retraction rule

If asked "what's next" in the demo, the prepared answer is: *at scale, this reasoning graph could evolve into a learning healthcare system where outcomes continuously refine future clinical reasoning* — stated as a direction, not a promise, and not demoed.

---

## 8. Known Open Risk

The permission model is one hard-coded rule (author or supervising physician). This is intentional for MVP scope, not a placeholder for something more sophisticated that ran out of time — frame it that way if questioned, rather than defending it as production-ready.
