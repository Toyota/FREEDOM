/**
 * Copyright (c) 2026 TOYOTA MOTOR CORPORATION. ALL RIGHTS RESERVED.
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { Pool } from 'pg';

export const runtime = 'nodejs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

function toLocalEmail() {
  const suffix = Math.random().toString(16).slice(2, 10);
  return `user.${suffix}@local.invalid`;
}

function normalizeRole(role: any) {
  if (role === 'admin') return 'admin';
  return 'user';
}

export async function GET() {
  const h = await headers();

  const session = await auth.api.getSession({ headers: h });
  const role = session?.user?.role ?? null;

  if (role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const result: any = await auth.api.listUsers({
    headers: h,
    query: {},
  });

  const users = Array.isArray(result?.users)
    ? result.users
    : (Array.isArray(result) ? result : []);

  const items = users.map((u: any) => ({
    id: u?.id ?? null,
    username: u?.username ?? null,
    displayUsername: u?.displayUsername ?? null,
    name: u?.name ?? null,
    email: u?.email ?? null,
    role: u?.role ?? null,
    createdAt: u?.createdAt ?? u?.created_at ?? null,
  })).filter((u: any) => !!u.id);

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const h = await headers();

  const session = await auth.api.getSession({ headers: h });
  const role = session?.user?.role ?? null;

  if (role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const username: string | undefined = body?.username;
  const password: string | undefined = body?.password;
  const newRole = normalizeRole(body?.role);

  if (!username) {
    return NextResponse.json({ error: 'missing_username' }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: 'missing_password' }, { status: 400 });
  }

  const email = toLocalEmail();
  const name = username;

  const client = await pool.connect();
  try {
    const created: any = await (auth.api as any).createUser({
      headers: h,
      body: {
        email,
        password,
        name,
        role: newRole,
      },
    });

    const createdId = created?.id ?? created?.user?.id ?? null;
    if (!createdId) {
      return NextResponse.json({ error: 'create_user_failed', detail: 'missing_created_user_id' }, { status: 500 });
    }

    await client.query(
      `
      UPDATE auth."user"
      SET username = $1, "displayUsername" = $2
      WHERE id = $3
      `,
      [username.toLowerCase(), username, createdId],
    );

    return NextResponse.json({ ok: true, user: { id: createdId } });
  } catch (e: any) {
    console.error('admin/users createUser failed:', e);
    return NextResponse.json({ error: 'create_user_failed', detail: String(e) }, { status: 500 });
  } finally {
    client.release();
  }
}
