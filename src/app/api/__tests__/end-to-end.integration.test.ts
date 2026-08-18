import { describe, it, expect, beforeAll } from 'vitest';

async function apiFetch(path: string, options: RequestInit = {}) {
  const url = `http://localhost:3000${path}`;
  
  let bodyObj = {};
  try { if (options.body) bodyObj = JSON.parse(options.body as string); } catch (e) {}
  
  const headers = {
    'Content-Type': 'application/json',
    'x-test-auth-secret': 'test-secret',
    ...options.headers,
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

describe('Full lifecycle end-to-end', () => {
  let patientId: string;
  let doctorId: string;
  let fact1Id: string;
  let fact2Id: string;
  let interpId: string;
  let decisionId: string;

  beforeAll(async () => {
    // 1. Create Patient
    const pRes = await apiFetch('/api/patient', {
      method: 'POST',
      body: JSON.stringify({ name: 'E2E Patient' }),
    });
    patientId = pRes.data.id;

    // 2. Create Doctor
    const dRes = await apiFetch('/api/doctor', {
      method: 'POST',
      body: JSON.stringify({ name: 'Dr. E2E', isSupervisor: true }),
    });
    doctorId = dRes.data.id;
  });

  it('fact → interpretation → confirm → decision → retract → blame resolves', async () => {
    // 2. Create 2 facts
    const f1Res = await apiFetch('/api/fact', {
      method: 'POST',
      body: JSON.stringify({ patientId, type: 'observation', value: 'Cough', recordedAt: '2026-06-01T00:00:00Z' }),
    });
    fact1Id = f1Res.data.id;

    const f2Res = await apiFetch('/api/fact', {
      method: 'POST',
      body: JSON.stringify({ patientId, type: 'vital', value: 'Temp 101F', recordedAt: '2026-06-02T00:00:00Z' }),
    });
    fact2Id = f2Res.data.id;

    // 3. Create interpretation citing both facts
    const iRes = await apiFetch('/api/interpretation', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        summary: 'Flu',
        supportingFactIds: [fact1Id, fact2Id],
        authorId: doctorId,
      }),
    });
    interpId = iRes.data.id;

    // 4. Confirm interpretation
    await apiFetch(`/api/interpretation/${interpId}/confirm`, {
      method: 'POST',
      headers: { 'x-test-user-id': doctorId },
    });

    // 5. Create decision based on confirmed interpretation
    const dRes = await apiFetch('/api/decision', {
      method: 'POST',
      headers: { 'x-test-user-id': doctorId },
      body: JSON.stringify({
        patientId,
        interpretationId: interpId,
        action: 'Rest and Fluids',
        authorId: doctorId,
      }),
    });
    decisionId = dRes.data.id;
    expect(dRes.status).toBe(201);

    // 6. Retract decision (by author)
    const rRes = await apiFetch(`/api/decision/${decisionId}/retract`, {
      method: 'POST',
      headers: { 'x-test-user-id': doctorId, 'x-test-is-supervisor': 'true' },
      body: JSON.stringify({ reason: 'Patient improving' }),
    });
    expect(rRes.status).toBe(200);
    expect(rRes.data.status).toBe('Retracted');

    // 7. Run blame on decision
    const blameRes = await apiFetch(`/api/blame/${decisionId}`);
    
    // 8. Assert: blame returns decision, interpretation, facts, doctor
    expect(blameRes.status).toBe(200);
    expect(blameRes.data.decision.id).toBe(decisionId);
    expect(blameRes.data.decision.status).toBe('Retracted');
    expect(blameRes.data.interpretation.id).toBe(interpId);
    expect(blameRes.data.supportingFacts.length).toBe(2);
    expect(blameRes.data.authoredBy.id).toBe(doctorId);
  }, 20000);

  it('patient log includes facts, interpretations, and decisions chronologically', async () => {
    const logRes = await apiFetch(`/api/patient/${patientId}/log`);
    expect(logRes.status).toBe(200);
    
    // Should have 2 facts, 1 interp, 1 decision
    expect(logRes.data.length).toBe(4);
    
    // Order: Fact 1 (Jun 1), Fact 2 (Jun 2), Interp, Decision
    expect(logRes.data[0].type).toBe('fact');
    expect(logRes.data[0].nodeId).toBe(fact1Id);
    
    expect(logRes.data[1].type).toBe('fact');
    expect(logRes.data[1].nodeId).toBe(fact2Id);
    
    expect(logRes.data[2].type).toBe('interpretation');
    expect(logRes.data[2].nodeId).toBe(interpId);
    
    expect(logRes.data[3].type).toBe('decision');
    expect(logRes.data[3].nodeId).toBe(decisionId);
  });
});
