/**
 * Copyright (c) 2026 TOYOTA MOTOR CORPORATION. ALL RIGHTS RESERVED.
 * SPDX-License-Identifier: Apache-2.0
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  return NextResponse.json({
    authenticated: !!session,
    userId: session?.user?.id ?? null,
    role: session?.user?.role ?? null,
    username: session?.user?.displayUsername ?? session?.user?.username ?? session?.user?.name ?? session?.user?.email ?? null,
  });
}
