import { NextRequest, NextResponse } from 'next/server';
import { withSession } from '@/lib/neo4j';
import { generateId } from '@/lib/ids';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  // Enforce authentication
  const sessionAuth = await getServerSession(authOptions);
  if (!sessionAuth && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, isSupervisor } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const id = generateId();

  const result = await withSession(async (session) => {
    return session.run(
      `CREATE (d:Doctor {id: $id, name: $name, isSupervisor: $isSupervisor})
       RETURN d`,
      { id, name, isSupervisor: isSupervisor === true },
    );
  });

  const record = result.records[0];
  if (!record) {
    return NextResponse.json({ error: 'Failed to create doctor' }, { status: 500 });
  }

  return NextResponse.json(record.get('d').properties, { status: 201 });
}
