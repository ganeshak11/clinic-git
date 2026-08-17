# Phase 0, Sub-phase 2 — Neo4j Connection & Test Infrastructure

**Phase:** 0 — Setup
**Sub-phase:** 2 of 2
**Depends on:** P0.S1 (scaffolding complete, `npm run dev` works)
**Exit criterion:** `curl localhost:3000/api/health` returns `{ "status": "ok", "neo4j": "connected", "testQuery": 1 }`. `npm run test` passes the `withSession` unit test.

---

## Context

The Next.js skeleton is running (P0.S1). This sub-phase adds the Neo4j connection layer, a health-check endpoint (Phase 0's exit criterion), and the test framework that all subsequent phases use.

---

## Proposed Changes

### [NEW] docker-compose.yml

```yaml
version: '3.8'
services:
  neo4j:
    image: neo4j:5
    container_name: clinicalgit-neo4j
    ports:
      - '7474:7474'
      - '7687:7687'
    environment:
      NEO4J_AUTH: neo4j/changeme
    volumes:
      - neo4j_data:/data

volumes:
  neo4j_data:
```

Formalizes the Docker command from README.md into a reproducible `docker compose up -d`.

### [NEW] neo4j-driver dependency

```bash
npm install neo4j-driver
npm install -D @types/node
```

### [NEW] src/lib/neo4j.ts — Driver Singleton + withSession

```typescript
import neo4j, { type Driver, type Session } from 'neo4j-driver';

let driver: Driver | null = null;

export function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI;
    const user = process.env.NEO4J_USER;
    const password = process.env.NEO4J_PASSWORD;

    if (!uri || !user || !password) {
      throw new Error(
        'Missing Neo4j environment variables (NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD). ' +
        'Copy .env.example to .env.local and fill in values.'
      );
    }

    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }
  return driver;
}

/**
 * Runs a database operation with a session that is guaranteed to be closed
 * in a finally block — invariant #8 from AGENTS.md.
 *
 * All database access in the app MUST go through this helper.
 * Never open a session directly and pass it between functions.
 */
export async function withSession<T>(
  work: (session: Session) => Promise<T>,
): Promise<T> {
  const session = getDriver().session();
  try {
    return await work(session);
  } finally {
    await session.close();
  }
}
```

**Design decisions:**
- `withSession` enforces invariant #8 — callers never touch `session.close()` directly, preventing the session-leak bug from codeexamples.md #2
- Environment validation is eager with a clear error, not a silent `undefined` at query time
- Session is opened and closed in the same function call — per coding-standards.md

### [NEW] src/app/api/health/route.ts — Health Check

```typescript
import { NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';

export async function GET() {
  try {
    const result = await withSession(async (session) => {
      return session.run('RETURN $value AS result', { value: 1 });
    });

    const record = result.records[0];
    if (!record) {
      return NextResponse.json(
        { status: 'error', message: 'No records returned' },
        { status: 500 },
      );
    }

    const value = record.get('result').toNumber();
    return NextResponse.json({
      status: 'ok',
      neo4j: 'connected',
      testQuery: value,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
```

**Note:** `result.records[0]` is checked for `undefined` because `tsconfig.json` has `noUncheckedIndexedAccess: true` from P0.S1.

---

### [NEW] Vitest Setup

```bash
npm install -D vitest
```

#### [NEW] vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
```

#### [NEW] src/lib/__tests__/neo4j.test.ts

Tests the `withSession` contract — session is always closed, even on error:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the neo4j-driver module
vi.mock('neo4j-driver', () => {
  const mockClose = vi.fn().mockResolvedValue(undefined);
  const mockRun = vi.fn().mockResolvedValue({ records: [] });
  const mockSession = vi.fn(() => ({ run: mockRun, close: mockClose }));
  const mockDriver = { session: mockSession };

  return {
    default: {
      driver: vi.fn(() => mockDriver),
      auth: { basic: vi.fn() },
    },
  };
});

describe('withSession', () => {
  it('closes the session after successful work', async () => {
    // Test that session.close() is called after work completes
  });

  it('closes the session even when work throws', async () => {
    // Test that session.close() is called even on error
    // This is the codeexamples.md #2 bug prevention
  });

  it('propagates the return value from the work function', async () => {
    // Test that the result passes through correctly
  });

  it('propagates errors from the work function', async () => {
    // Test that errors are not swallowed
  });
});
```

#### [MODIFY] package.json — Add test scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vitest run --config vitest.integration.config.ts"
  }
}
```

---

## Files Created/Modified

| Action | File | Purpose |
|--------|------|---------|
| NEW | `docker-compose.yml` | Local Neo4j dev environment |
| NEW | `src/lib/neo4j.ts` | Driver singleton + `withSession` |
| NEW | `src/app/api/health/route.ts` | Connection verification (exit criterion) |
| NEW | `vitest.config.ts` | Test runner configuration |
| NEW | `src/lib/__tests__/neo4j.test.ts` | Unit test for session helper |
| MODIFY | `package.json` | Add neo4j-driver, vitest, test scripts |

---

## Verification

```bash
# Start Neo4j
docker compose up -d

# Configure env
cp .env.example .env.local

# Run unit tests
npm run test

# Start app
npm run dev

# Verify exit criterion
curl http://localhost:3000/api/health
# Expected: { "status": "ok", "neo4j": "connected", "testQuery": 1 }
```

**Phase 0 is complete when this verification passes.**

---

## What This Does NOT Include

- No clinical data model (Phase 1)
- No domain types or status transitions (Phase 1.1)
- No Cypher constraints (Phase 1.2)
