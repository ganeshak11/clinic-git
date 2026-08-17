# Deployment: ClinicalGit

## Targets

- **Local dev:** Neo4j via Docker (`neo4j:5` image), app via `npm run dev`. See `README.md` Quick Start.
- **Demo/prod-like:** App on Vercel (Next.js API routes deploy natively as serverless functions — no separate backend to host). Database on **Neo4j AuraDB** (managed, free tier is sufficient at MVP scale). File attachments in a single S3 or Vercel Blob bucket, referenced by URL — not a self-hosted MinIO instance for a demo deployment.

This split keeps deployment to two moving parts (Vercel + AuraDB) instead of standing up and managing a Neo4j instance yourself in production, which isn't worth the operational overhead at this scale.

## Environment variables required in production

Set these in the Vercel project settings (or equivalent), not in a committed file — see `docs/engineering/security.md`:

```
NEO4J_URI            # AuraDB connection URI (neo4j+s://...)
NEO4J_USER
NEO4J_PASSWORD
SESSION_SECRET
ATTACHMENTS_STORAGE_PATH   # or bucket URL, depending on chosen storage
```

Full template with placeholder values: `.env.example`.

## Deploy steps

1. Push to the deployment branch (or connect the repo to Vercel directly — it deploys on push to `main` by default).
2. Confirm environment variables are set in the Vercel dashboard before the first deploy — a missing `NEO4J_URI` fails at request time, not build time, so check this explicitly rather than assuming a clean build means it's configured correctly.
3. After deploy, run the Phase 6 seed script (`docs/planning/todo.md`) against the AuraDB instance if this is a fresh demo environment — it does not seed itself.

## Rollback

Vercel keeps every previous deployment; rolling back is selecting a prior deployment and promoting it — no rebuild required. This is sufficient for MVP scope: the app itself is stateless (all state lives in Neo4j), so a code rollback never needs a corresponding data migration in the common case.

**Data rollback is a separate concern from code rollback.** AuraDB free tier includes automated backups — if a bad migration or a demo-data seeding mistake corrupts the graph, restore from the most recent backup rather than trying to hand-write a Cypher fix under time pressure. Know where the restore option is in the AuraDB console *before* you need it, not during a demo.

## Monitoring (MVP scope)

Vercel's built-in function logs and AuraDB's dashboard metrics (query latency, connection count) are sufficient here. No dedicated monitoring/alerting stack — that's explicitly out of scope, consistent with the rest of this project's scope discipline (`docs/product/prd.md` §3).

## What's not set up

Multi-region deployment, auto-scaling beyond what Vercel/AuraDB provide by default, blue-green deployments, a staging environment separate from production. For a project at this scale, a single production-like environment plus local dev is the right amount of infrastructure — add staging only if the project outgrows demo scope.
