import { randomUUID } from 'crypto';

/** Generate a string UUID for node IDs. All IDs are string, consistently. */
export function generateId(): string {
  return randomUUID();
}
