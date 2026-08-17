import { describe, it, expect, vi } from 'vitest';
import { withSession } from '../neo4j';

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

// Have to import neo4j *after* mocking it to inspect the mock functions
import neo4j from 'neo4j-driver';

describe('withSession', () => {
  // Setup dummy env vars for getDriver()
  process.env.NEO4J_URI = 'bolt://localhost:7687';
  process.env.NEO4J_USER = 'neo4j';
  process.env.NEO4J_PASSWORD = 'password';

  it('closes the session after successful work', async () => {
    const work = vi.fn().mockResolvedValue('success');
    const result = await withSession(work);

    expect(result).toBe('success');
    expect(work).toHaveBeenCalled();
    
    // Check that session.close was called. We have to reach into our mock structure.
    const driver = neo4j.driver('test', neo4j.auth.basic('user', 'pass'));
    const session = driver.session();
    expect(session.close).toHaveBeenCalled();
  });

  it('closes the session even when work throws', async () => {
    const error = new Error('Database error');
    const work = vi.fn().mockRejectedValue(error);
    
    await expect(withSession(work)).rejects.toThrow('Database error');
    
    const driver = neo4j.driver('test', neo4j.auth.basic('user', 'pass'));
    const session = driver.session();
    expect(session.close).toHaveBeenCalled();
  });
});
