# ADR 0001: Single Database — Neo4j Only

**Status:** Accepted

## Context

Early drafts of ClinicalGit proposed PostgreSQL for transactional data (patients, commits) alongside Neo4j for the reasoning graph, plus OpenSearch for search and MinIO/S3 for attachments — four systems total.

The core problem with Postgres + Neo4j specifically: every write (e.g. creating an interpretation) would need to succeed in both databases. A failure between the two writes — Postgres commits, Neo4j fails, or vice versa — leaves the system in an inconsistent state. Solving this properly requires a saga or outbox pattern, which is real distributed-systems engineering with no payoff here, since the entire value proposition of this project is the graph itself.

## Decision

Use Neo4j as the only database. Patients, Facts, Interpretations, Branches, Decisions, and Doctors are all modeled as nodes and relationships in one graph. File attachments are stored in a single bucket/directory and referenced by URL from Fact nodes — this is storage, not a subsystem with its own consistency concerns.

## Consequences

**Positive:**
- No cross-database consistency problem — every write is a single Cypher transaction.
- Simpler deployment and local dev setup (one database to run).
- The data model matches the mental model of the product: relationships (evidence supports interpretation, interpretation belongs to branch) are first-class, not joined-at-query-time.

**Negative:**
- Relational reporting (e.g. "how many patients have a given diagnosis") is less natural in Cypher than SQL — accepted as out of scope; PRD §3 already excludes population-level analytics from v1.
- No mature admin-panel tooling comparable to Postgres's ecosystem — accepted; not needed at MVP scale.
- Full-text search across notes/reports isn't available without adding a search layer later — deferred per PRD §3, not solved now.

## Alternatives considered

- **Postgres + Neo4j dual-write** — rejected for the consistency risk above.
- **Postgres only, with adjacency tables for the graph relationships** — viable, and simpler to reason about for engineers unfamiliar with Cypher, but loses the ergonomics (`git log`/`blame`-style traversal queries) that are the point of the project. Rejected because the differential-diagnosis branching feature (the actual differentiator — see ADR 0002 and PRD §9) is naturally a graph traversal problem, not a relational one.
