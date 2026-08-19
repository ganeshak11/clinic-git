import { describe, it, expect, beforeAll } from 'vitest';

async function apiFetch(path: string, options: RequestInit = {}) {
  const url = `http://localhost:3000${path}`;
  
  let bodyObj: any = {};
  try { if (options.body) bodyObj = JSON.parse(options.body as string); } catch (e) {}
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-test-auth-secret': 'test-secret',
    ...(options.headers as Record<string, string>),
  };
  
  if (bodyObj.authorId && !headers['x-test-user-id']) {
    headers['x-test-user-id'] = bodyObj.authorId;
  }
  
  // For patient/doctor creation, they don't have authorId. Just give them a dummy user ID if none provided.
  if (!headers['x-test-user-id']) {
    headers['x-test-user-id'] = 'test-runner-id';
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

describe('Decision permissions & transitions', () => {
  let patientId: string;
  let doctorAuthorId: string;
  let doctorSupervisorId: string;
  let doctorOtherId: string;
  let factId: string;
  let interpId: string;

  beforeAll(async () => {
    const pRes = await apiFetch('/api/patient', {
      method: 'POST',
      body: JSON.stringify({ name: 'Perm Patient' }),
    });
    patientId = pRes.data.id;

    const d1Res = await apiFetch('/api/doctor', {
      method: 'POST',
      body: JSON.stringify({ name: 'Dr. Author', isSupervisor: false }),
    });
    doctorAuthorId = d1Res.data.id;

    const d2Res = await apiFetch('/api/doctor', {
      method: 'POST',
      body: JSON.stringify({ name: 'Dr. Supervisor', isSupervisor: true }),
    });
    doctorSupervisorId = d2Res.data.id;

    const d3Res = await apiFetch('/api/doctor', {
      method: 'POST',
      body: JSON.stringify({ name: 'Dr. Random', isSupervisor: false }),
    });
    doctorOtherId = d3Res.data.id;

    const fRes = await apiFetch('/api/fact', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        type: 'observation',
        value: 'Headache',
        recordedAt: '2026-05-01T00:00:00Z',
      }),
    });
    factId = fRes.data.id;

    const iRes = await apiFetch('/api/interpretation', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        summary: 'Tension Headache',
        supportingFactIds: [factId],
        authorId: doctorAuthorId,
      }),
    });
    interpId = iRes.data.id;

    await apiFetch(`/api/interpretation/${interpId}/confirm`, {
      method: 'POST',
      headers: { 'x-test-user-id': doctorAuthorId },
    });
  });

  describe('Decision retract permissions', () => {
    let decisionId: string;

    beforeAll(async () => {
      const dRes = await apiFetch('/api/decision', {
        method: 'POST',
        headers: { 'x-test-user-id': doctorAuthorId },
        body: JSON.stringify({
          patientId,
          interpretationId: interpId,
          action: 'Rest',
          authorId: doctorAuthorId,
        }),
      });
      decisionId = dRes.data.id;
    });

    it('rejects non-author, non-supervisor → 403', async () => {
      const res = await apiFetch(`/api/decision/${decisionId}/retract`, {
        method: 'POST',
        headers: { 'x-test-user-id': doctorOtherId, 'x-test-is-supervisor': 'false' },
        body: JSON.stringify({ reason: 'Not allowed' }),
      });
      expect(res.status).toBe(403);
    });

    it('allows a supervisor to retract', async () => {
      const res = await apiFetch(`/api/decision/${decisionId}/retract`, {
        method: 'POST',
        headers: { 'x-test-user-id': doctorSupervisorId, 'x-test-is-supervisor': 'true' },
        body: JSON.stringify({ reason: 'Supervisor retract' }),
      });
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('Retracted');
    });

    it('rejects double-retraction → 409', async () => {
      // Trying to retract an already retracted decision
      const res = await apiFetch(`/api/decision/${decisionId}/retract`, {
        method: 'POST',
        headers: { 'x-test-user-id': doctorSupervisorId, 'x-test-is-supervisor': 'true' },
        body: JSON.stringify({ reason: 'Double retract' }),
      });
      expect(res.status).toBe(409);
    });
  });

  describe('Interpretation retract permissions (backfill verification)', () => {
    let testInterpId: string;

    beforeAll(async () => {
      const iRes = await apiFetch('/api/interpretation', {
        method: 'POST',
        body: JSON.stringify({
          patientId,
          summary: 'Temp Interp',
          supportingFactIds: [factId],
          authorId: doctorAuthorId,
        }),
      });
      testInterpId = iRes.data.id;
      
      await apiFetch(`/api/interpretation/${testInterpId}/confirm`, {
        method: 'POST',
        headers: { 'x-test-user-id': doctorAuthorId },
      });
    });

    it('rejects non-author, non-supervisor → 403', async () => {
      const res = await apiFetch(`/api/interpretation/${testInterpId}/retract`, {
        method: 'POST',
        headers: { 'x-test-user-id': doctorOtherId, 'x-test-is-supervisor': 'false' },
        body: JSON.stringify({ reason: 'Not allowed' }),
      });
      expect(res.status).toBe(403);
    });

    it('allows the original author to retract', async () => {
      const res = await apiFetch(`/api/interpretation/${testInterpId}/retract`, {
        method: 'POST',
        headers: { 'x-test-user-id': doctorAuthorId, 'x-test-is-supervisor': 'false' },
        body: JSON.stringify({ reason: 'Author retract' }),
      });
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('Retracted');
    });
  });

  describe('Decision supersede', () => {
    let decisionId: string;

    beforeAll(async () => {
      const dRes = await apiFetch('/api/decision', {
        method: 'POST',
        headers: { 'x-test-user-id': doctorAuthorId },
        body: JSON.stringify({
          patientId,
          interpretationId: interpId,
          action: 'Old Action',
          authorId: doctorAuthorId,
        }),
      });
      decisionId = dRes.data.id;
    });

    it('creates new decision with SUPERSEDES link', async () => {
      const res = await apiFetch(`/api/decision/${decisionId}/supersede`, {
        method: 'POST',
        headers: { 'x-test-user-id': doctorAuthorId },
        body: JSON.stringify({
          interpretationId: interpId,
          newAction: 'New Action',
          reason: 'Better treatment',
        }),
      });
      expect(res.status).toBe(201);
      expect(res.data.status).toBe('Active');
      expect(res.data.action).toBe('New Action');
      expect(res.data.supersedesId).toBe(decisionId);

      // Verify old decision is Superseded
      // Wait, there's no GET /api/decision endpoint right now in the spec,
      // but if we were to try superseding it again, it should fail with 409
      const doubleRes = await apiFetch(`/api/decision/${decisionId}/supersede`, {
        method: 'POST',
        headers: { 'x-test-user-id': doctorAuthorId },
        body: JSON.stringify({
          interpretationId: interpId,
          newAction: 'Another Action',
          reason: 'Duplicate',
        }),
      });
      expect(doubleRes.status).toBe(409);
    });
  });
});
