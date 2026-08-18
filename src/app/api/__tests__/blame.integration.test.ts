import { describe, it, expect, beforeAll } from 'vitest';

// Helper for API testing
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

describe('Blame query integration', () => {
  let patientId: string;
  let doctorId: string;
  let factId: string;
  let interpAId: string;
  let interpBId: string;
  let decisionBId: string;
  let interpCId: string;
  let decisionCId: string;

  beforeAll(async () => {
    // 1. Create Patient
    const pRes = await apiFetch('/api/patient', {
      method: 'POST',
      body: JSON.stringify({ name: 'Blame Patient' }),
    });
    patientId = pRes.data.id;

    // 2. Create Doctor
    const dRes = await apiFetch('/api/doctor', {
      method: 'POST',
      body: JSON.stringify({ name: 'Dr. Blame', isSupervisor: true }),
    });
    doctorId = dRes.data.id;

    // 3. Create Fact
    const fRes = await apiFetch('/api/fact', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        type: 'lab',
        value: 'Test Value',
        recordedAt: '2026-02-01T00:00:00Z',
      }),
    });
    factId = fRes.data.id;

    // 4. Create Interp A
    const aRes = await apiFetch('/api/interpretation', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        summary: 'Interp A',
        supportingFactIds: [factId],
        authorId: doctorId,
      }),
    });
    interpAId = aRes.data.id;

    // 5. Confirm Interp A
    await apiFetch(`/api/interpretation/${interpAId}/confirm`, {
      method: 'POST',
    });

    // 6. Supersede A with B
    const bRes = await apiFetch(`/api/interpretation/${interpAId}/supersede`, {
      method: 'POST',
      headers: {
        'x-test-user-id': doctorId,
      },
      body: JSON.stringify({
        newSummary: 'Interp B',
        supportingFactIds: [factId],
        reason: 'New evidence',
      }),
    });
    interpBId = bRes.data.id;

    // Confirm B
    await apiFetch(`/api/interpretation/${interpBId}/confirm`, { method: 'POST' });

    // 7. Create Decision on Interp B
    const dBRes = await apiFetch('/api/decision', {
      method: 'POST',
      headers: { 'x-test-user-id': doctorId },
      body: JSON.stringify({
        patientId,
        interpretationId: interpBId,
        action: 'Treat B',
        authorId: doctorId,
      }),
    });
    decisionBId = dBRes.data.id;

    // 8. Create Decision on Interp A (Wait, A is Superseded. Can we create a decision on it? No, must be Confirmed. Let's just create a decision on A before superseding, or create a separate interpretation C for the second test). Let's use a new confirmed interpretation for the second test, or just skip it because we test everything on B.
    
    // Create Interp C
    const cRes = await apiFetch('/api/interpretation', {
      method: 'POST',
      body: JSON.stringify({ patientId, summary: 'Interp C', supportingFactIds: [factId], authorId: doctorId }),
    });
    interpCId = cRes.data.id;
    await apiFetch(`/api/interpretation/${interpCId}/confirm`, { method: 'POST' });
    
    const dCRes = await apiFetch('/api/decision', {
      method: 'POST',
      headers: { 'x-test-user-id': doctorId },
      body: JSON.stringify({ patientId, interpretationId: interpCId, action: 'Treat C', authorId: doctorId }),
    });
    decisionCId = dCRes.data.id;
  });

  it('blame query on decision B should return B and priorChain A', async () => {
    const res = await apiFetch(`/api/blame/${decisionBId}`);
    expect(res.status).toBe(200);
    
    // Check main interpretation
    expect(res.data.interpretation.id).toBe(interpBId);
    expect(res.data.interpretation.summary).toBe('Interp B');
    
    // Check decision
    expect(res.data.decision.id).toBe(decisionBId);
    expect(res.data.decision.action).toBe('Treat B');

    // Check prior chain (should contain A)
    expect(res.data.priorChain.length).toBe(1);
    expect(res.data.priorChain[0].id).toBe(interpAId);
    expect(res.data.priorChain[0].summary).toBe('Interp A');
    
    // Check supporting facts
    expect(res.data.supportingFacts.length).toBe(1);
    expect(res.data.supportingFacts[0].id).toBe(factId);
    
    // Check authored by
    expect(res.data.authoredBy.id).toBe(doctorId);
  });

  it('blame query on decision C should return C and empty priorChain', async () => {
    const res = await apiFetch(`/api/blame/${decisionCId}`);
    expect(res.status).toBe(200);
    expect(res.data.interpretation.id).toBe(interpCId);
    expect(res.data.decision.id).toBe(decisionCId);
    expect(res.data.priorChain.length).toBe(0);
  });
});

