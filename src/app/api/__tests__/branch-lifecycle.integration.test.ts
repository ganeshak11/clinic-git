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

describe('Branch lifecycle integration', () => {
  let patientId: string;
  let doctorId: string;
  let factId: string;
  let branchId: string;
  
  let tbId: string;
  let cancerId: string;
  let fungalId: string;

  beforeAll(async () => {
    // 1. Create Patient
    const pRes = await apiFetch('/api/patient', {
      method: 'POST',
      body: JSON.stringify({ name: 'Branch Lifecycle Patient' }),
    });
    patientId = pRes.data.id;

    // 2. Create Doctor
    const dRes = await apiFetch('/api/doctor', {
      method: 'POST',
      body: JSON.stringify({ name: 'Dr. House', isSupervisor: true }),
    });
    doctorId = dRes.data.id;

    // 3. Create Fact
    const fRes = await apiFetch('/api/fact', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        type: 'imaging',
        value: 'Lung lesion found on X-Ray',
        recordedAt: '2026-02-01T00:00:00Z',
      }),
    });
    factId = fRes.data.id;
  });

  it('creates a branch', async () => {
    const res = await apiFetch('/api/branch', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        question: 'Cause of lung lesion?',
      }),
    });
    expect(res.status).toBe(201);
    expect(res.data.status).toBe('Open');
    branchId = res.data.id;
  });

  it('attaches multiple competing interpretations to the branch', async () => {
    // 1. TB
    const tbRes = await apiFetch('/api/interpretation', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        summary: 'Tuberculosis',
        supportingFactIds: [factId],
        authorId: doctorId,
        branchId,
      }),
    });
    expect(tbRes.status).toBe(201);
    tbId = tbRes.data.id;

    // 2. Lung cancer
    const cancerRes = await apiFetch('/api/interpretation', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        summary: 'Lung Cancer',
        supportingFactIds: [factId],
        authorId: doctorId,
        branchId,
      }),
    });
    expect(cancerRes.status).toBe(201);
    cancerId = cancerRes.data.id;

    // 3. Fungal infection
    const fungalRes = await apiFetch('/api/interpretation', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        summary: 'Fungal Infection',
        supportingFactIds: [factId],
        authorId: doctorId,
        branchId,
      }),
    });
    expect(fungalRes.status).toBe(201);
    fungalId = fungalRes.data.id;
  });

  it('rejects confirming an interpretation not on the branch', async () => {
    const fakeId = 'not-a-real-interpretation-id';
    const res = await apiFetch(`/api/branch/${branchId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ confirmedInterpretationId: fakeId }),
    });
    expect(res.status).toBe(400); // 400 Bad Request
  });

  it('resolves branch: one Confirmed, rest RuledOut, branch Closed', async () => {
    const res = await apiFetch(`/api/branch/${branchId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ confirmedInterpretationId: cancerId }), // Tragic
    });
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('Closed');
  });

  it('GET /api/branch/:id returns branch with all interpretations', async () => {
    const res = await apiFetch(`/api/branch/${branchId}`);
    expect(res.status).toBe(200);
    expect(res.data.id).toBe(branchId);
    expect(res.data.status).toBe('Closed');
    expect(res.data.interpretations.length).toBe(3);

    const cancerInterp = res.data.interpretations.find((i: any) => i.id === cancerId);
    const tbInterp = res.data.interpretations.find((i: any) => i.id === tbId);
    const fungalInterp = res.data.interpretations.find((i: any) => i.id === fungalId);

    expect(cancerInterp.status).toBe('Confirmed');
    expect(tbInterp.status).toBe('RuledOut'); // Still queryable, but RuledOut
    expect(fungalInterp.status).toBe('RuledOut'); // Still queryable, but RuledOut
  });

  it('rejects resolving an already-closed branch', async () => {
    const res = await apiFetch(`/api/branch/${branchId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ confirmedInterpretationId: cancerId }),
    });
    expect(res.status).toBe(409); // 409 Conflict
  });
});
