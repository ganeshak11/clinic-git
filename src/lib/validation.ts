import type { FactType } from './types';

const MAX_STRING_LENGTH = 10_000;
const MAX_SHORT_STRING = 500;
const MAX_ARRAY_LENGTH = 100;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate a required string field with length limit.
 */
export function validateString(value: unknown, name: string, maxLen = MAX_STRING_LENGTH): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${name} is required and must be a non-empty string`);
  }
  if (value.length > maxLen) {
    throw new ValidationError(`${name} must be at most ${maxLen} characters`);
  }
  return value.trim();
}

/**
 * Validate a required short string (names, IDs, etc.).
 */
export function validateShortString(value: unknown, name: string): string {
  return validateString(value, name, MAX_SHORT_STRING);
}

/**
 * Validate a required array of string IDs.
 */
export function validateIdArray(value: unknown, name: string, maxLen = MAX_ARRAY_LENGTH): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError(`${name} must be a non-empty array`);
  }
  if (value.length > maxLen) {
    throw new ValidationError(`${name} must have at most ${maxLen} entries`);
  }
  for (const item of value) {
    if (typeof item !== 'string' || item.trim().length === 0) {
      throw new ValidationError(`Each item in ${name} must be a non-empty string`);
    }
  }
  return value as string[];
}

/**
 * Validate an ISO 8601 date string.
 */
export function validateISODate(value: unknown, name: string): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${name} must be an ISO 8601 date string`);
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new ValidationError(`${name} is not a valid ISO 8601 date`);
  }
  return value;
}

const VALID_FACT_TYPES: FactType[] = ['lab', 'imaging', 'vital', 'observation'];

/**
 * Validate a FactType enum value.
 */
export function validateFactType(value: unknown): FactType {
  if (typeof value !== 'string' || !VALID_FACT_TYPES.includes(value as FactType)) {
    throw new ValidationError(`type must be one of: ${VALID_FACT_TYPES.join(', ')}`);
  }
  return value as FactType;
}

/**
 * Validate an optional string field (returns null if absent).
 */
export function validateOptionalString(value: unknown, name: string, maxLen = MAX_STRING_LENGTH): string | null {
  if (value === undefined || value === null) return null;
  return validateString(value, name, maxLen);
}

/**
 * Safe JSON body parsing — returns null on failure instead of throwing.
 */
export async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    if (typeof body !== 'object' || body === null) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}
