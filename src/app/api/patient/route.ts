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
  const { name } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const id = generateId();
  const createdAt = new Date().toISOString();

  const result = await withSession(async (session) => {
    return session.run(
      `CREATE (p:Patient {id: $id, name: $name, createdAt: $createdAt})
       RETURN p`,
      { id, name, createdAt },
    );
  });

  const record = result.records[0];
  if (!record) {
    return NextResponse.json({ error: 'Failed to create patient' }, { status: 500 });
  }

  return NextResponse.json(record.get('p').properties, { status: 201 });
}
