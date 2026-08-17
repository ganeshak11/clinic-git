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
