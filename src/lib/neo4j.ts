import neo4j, { type Driver, type Session, type ManagedTransaction } from 'neo4j-driver';

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
 * Use for simple single-query reads.
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

/**
 * Runs a write operation inside a managed transaction.
 * The transaction auto-retries on transient errors and ensures atomicity.
 *
 * Fixes C-1 (no transactional boundaries) and C-2 (TOCTOU race conditions).
 * All multi-statement writes MUST use this instead of withSession.
 */
export async function withWriteTransaction<T>(
  work: (tx: ManagedTransaction) => Promise<T>,
): Promise<T> {
  const session = getDriver().session();
  try {
    return await session.executeWrite(work);
  } finally {
    await session.close();
  }
}

/**
 * Runs a read operation inside a managed transaction.
 * Routes reads to follower replicas in a cluster.
 */
export async function withReadTransaction<T>(
  work: (tx: ManagedTransaction) => Promise<T>,
): Promise<T> {
  const session = getDriver().session();
  try {
    return await session.executeRead(work);
  } finally {
    await session.close();
  }
}

/**
 * Type-safe helper to extract properties from a Neo4j Node record.
 * Replaces raw 'as any' casts and ensures properties exist.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractNodeProperties<T>(record: any, key: string): T | null {
  if (!record) return null;
  const node = record.get(key);
  if (!node || !node.properties) return null;
  return node.properties as T;
}
