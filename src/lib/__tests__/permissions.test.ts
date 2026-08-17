import { describe, it, expect } from 'vitest';
import { canRetract } from '../permissions';

describe('canRetract', () => {
  it('allows the original author to retract', () => {
    expect(canRetract('author-123', 'author-123', false)).toBe(true);
  });

  it('allows a supervisor to retract', () => {
    expect(canRetract('author-123', 'supervisor-456', true)).toBe(true);
  });

  it('rejects a non-author, non-supervisor', () => {
    expect(canRetract('author-123', 'random-doc-789', false)).toBe(false);
  });

  it('rejects when authorId is empty string', () => {
    expect(canRetract('', 'random-doc-789', false)).toBe(false);
  });
});
