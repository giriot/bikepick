import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthError } from './auth';
import { zodErrors } from './validation';

export function ok<T>(data: T, message?: string, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data, message }, init);
}

export function fail(error: string, status = 400, fields?: Record<string, string>) {
  return NextResponse.json({ ok: false, error, fields }, { status });
}

/** Uniform error translation for every route handler. */
export function handleError(e: unknown) {
  if (e instanceof ZodError) return fail('Please correct the highlighted fields', 422, zodErrors(e));
  if (e instanceof AuthError) return fail(e.message, e.status);
  let message = e instanceof Error ? e.message : 'Unexpected error';
  // Translate database constraint noise into something an owner can act on.
  if (/FOREIGN KEY constraint/i.test(message)) message = 'A linked record you selected does not exist. Pick a valid option and try again.';
  else if (/UNIQUE constraint|duplicate key/i.test(message)) message = 'A record with that unique value (slug, code or email) already exists.';
  else if (/NOT NULL constraint/i.test(message)) message = 'A required field was left empty.';
  if (process.env.NODE_ENV !== 'production') console.error('[api]', e);
  return fail(message, 500);
}

export async function readJson<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error('Invalid JSON body');
  }
}
