# Phase 1, Sub-phase 2 — Database Schema & Fact Endpoint

**Phase:** 1 — Facts & Interpretations
**Sub-phase:** 2 of 4
**Depends on:** P1.S1 (types, transitions, permissions defined and tested)
**Exit criterion:** Via `curl`, create a Patient, then create two Facts attached to it. Neo4j enforces unique IDs. No update or delete endpoint exists for Facts.

---

## Context

Types and guards are tested (P1.S1). This sub-phase creates the database schema (uniqueness constraints) and the first data-writing endpoint. The Fact endpoint is the simplest because Facts are immutable — no status transitions, no linked interpretations.

---

## Proposed Changes

### [NEW] src/lib/schema.ts — Cypher Constraints

```typescript
/**
 * Cypher constraint definitions for the ClinicalGit schema.
 * Run once against a fresh database to set up uniqueness constraints.
 * All IDs are string (invariant — coding-standards.md).
 */
export const SCHEMA_CONSTRAINTS = [
  'CREATE CONSTRAINT patient_id_unique IF NOT EXISTS FOR (p:Patient) REQUIRE p.id IS UNIQUE',
  'CREATE CONSTRAINT fact_id_unique IF NOT EXISTS FOR (f:Fact) REQUIRE f.id IS UNIQUE',
  'CREATE CONSTRAINT interpretation_id_unique IF NOT EXISTS FOR (i:Interpretation) REQUIRE i.id IS UNIQUE',
  'CREATE CONSTRAINT doctor_id_unique IF NOT EXISTS FOR (d:Doctor) REQUIRE d.id IS UNIQUE',
  'CREATE CONSTRAINT branch_id_unique IF NOT EXISTS FOR (b:Branch) REQUIRE b.id IS UNIQUE',
  'CREATE CONSTRAINT decision_id_unique IF NOT EXISTS FOR (dec:Decision) REQUIRE dec.id IS UNIQUE',
];
```

### [NEW] src/app/api/schema/route.ts — Schema Setup Endpoint

A one-time POST endpoint to apply constraints. Idempotent (`IF NOT EXISTS`).

```typescript
import { NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import { SCHEMA_CONSTRAINTS } from '@/lib/schema';

export async function POST() {
  try {
    await withSession(async (session) => {
      for (const constraint of SCHEMA_CONSTRAINTS) {
        // Each constraint is a fixed string, no user input — but still run via session.run
        // with no interpolation (invariant #5)
        await session.run(constraint);
      }
    });
    return NextResponse.json({ status: 'ok', constraints: SCHEMA_CONSTRAINTS.length });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
```

### [NEW] src/lib/ids.ts — ID Generation

```typescript
import { randomUUID } from 'crypto';

/** Generate a string UUID for node IDs. All IDs are string, consistently. */
export function generateId(): string {
  return randomUUID();
}
```

### [NEW] src/app/api/patient/route.ts — Create Patient

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import { generateId } from '@/lib/ids';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const id = generateId();
  const createdAt = new Date().toISOString();

  const result = await withSession(async (session) => {
    return session.run(
      `CREATE (p:Patient {id: $id, name: $name, createdAt: $createdAt})
       RETURN p`,
      { id, name, createdAt },
    );
  });

  const record = result.records[0];
  if (!record) {
    return NextResponse.json({ error: 'Failed to create patient' }, { status: 500 });
  }

  return NextResponse.json(record.get('p').properties, { status: 201 });
}
```

### [NEW] src/app/api/fact/route.ts — Create Fact

Per api-spec.md. Validates required fields before touching the database. Returns 400 for missing fields, 404 for nonexistent patient.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import { generateId } from '@/lib/ids';
import type { FactType } from '@/lib/types';

const VALID_FACT_TYPES: FactType[] = ['lab', 'imaging', 'vital', 'observation'];

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { patientId, type, value, recordedAt, attachmentUrl } = body;

  // Validate before touching DB — coding-standards.md
  if (!patientId || !type || !value || !recordedAt) {
    return NextResponse.json(
      { error: 'patientId, type, value, and recordedAt are required' },
      { status: 400 },
    );
  }

  if (!VALID_FACT_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${VALID_FACT_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  const id = generateId();

  const result = await withSession(async (session) => {
    // Verify patient exists, create Fact, link via HAS_FACT — all parameterized (invariant #5)
    return session.run(
      `MATCH (p:Patient {id: $patientId})
       CREATE (f:Fact {id: $id, type: $type, value: $value, recordedAt: $recordedAt, attachmentUrl: $attachmentUrl})
       CREATE (p)-[:HAS_FACT]->(f)
       RETURN f`,
      { patientId, id, type, value, recordedAt, attachmentUrl: attachmentUrl ?? null },
    );
  });

  const record = result.records[0];
  if (!record) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  return NextResponse.json(record.get('f').properties, { status: 201 });
}
```

**Critical:** No PATCH, PUT, or DELETE handler is exported — Fact immutability (invariant #1) is enforced by absence of these routes.

---

## Files Created

| Action | File | Purpose |
|--------|------|---------|
| NEW | `src/lib/schema.ts` | Cypher constraint definitions |
| NEW | `src/lib/ids.ts` | UUID generation helper |
| NEW | `src/app/api/schema/route.ts` | One-time schema setup |
| NEW | `src/app/api/patient/route.ts` | `POST /api/patient` |
| NEW | `src/app/api/fact/route.ts` | `POST /api/fact` (no update/delete) |

---

## Verification

```bash
# Setup schema
curl -X POST http://localhost:3000/api/schema

# Create a patient
curl -X POST http://localhost:3000/api/patient \
  -H 'Content-Type: application/json' \
  -d '{"name": "Jane Doe"}'

# Create facts
curl -X POST http://localhost:3000/api/fact \
  -H 'Content-Type: application/json' \
  -d '{"patientId": "<id>", "type": "lab", "value": "HbA1c 8.4%", "recordedAt": "2026-01-15T10:00:00Z"}'

# Verify no update route
curl -X PATCH http://localhost:3000/api/fact/<id>
# Expected: 404/405

# Verify duplicate ID constraint
# (attempt to create two patients with same ID via Neo4j Browser — should fail)
```
