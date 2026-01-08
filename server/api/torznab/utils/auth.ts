/**
 * Torznab Authentication Utilities
 * Handles passkey-based authentication for Torznab API
 */

import { H3Event, createError } from 'h3';
import { db, schema } from '../../../db';
import { eq } from 'drizzle-orm';
import { buildErrorXml, TORZNAB_ERRORS } from './xml';

export interface TorznabUser {
  id: string;
  username: string;
  passkey: string;
  isBanned: boolean;
  isAdmin: boolean;
  isModerator: boolean;
}

/**
 * Authenticate user via Torznab API key (passkey)
 * Returns user if valid, throws error otherwise
 */
export async function authenticateTorznab(
  event: H3Event
): Promise<TorznabUser> {
  const query = getQuery(event);
  const apikey = query.apikey as string | undefined;

  if (!apikey) {
    throw createTorznabError(
      event,
      TORZNAB_ERRORS.MISSING_PARAMETER,
      'Missing apikey parameter'
    );
  }

  // Validate passkey format (32 or 40 hex chars - supports legacy and new passkeys)
  if (!/^[a-f0-9]{32}$/i.test(apikey) && !/^[a-f0-9]{40}$/i.test(apikey)) {
    throw createTorznabError(
      event,
      TORZNAB_ERRORS.INCORRECT_CREDENTIALS,
      `Invalid API key format. Expected 32 or 40 hex characters (your passkey), got ${apikey.length} characters`
    );
  }

  // Look up user by passkey
  const users = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      passkey: schema.users.passkey,
      isBanned: schema.users.isBanned,
      isAdmin: schema.users.isAdmin,
      isModerator: schema.users.isModerator,
    })
    .from(schema.users)
    .where(eq(schema.users.passkey, apikey.toLowerCase()))
    .limit(1);

  const user = users[0];

  if (!user) {
    throw createTorznabError(event, TORZNAB_ERRORS.INCORRECT_CREDENTIALS);
  }

  if (user.isBanned) {
    throw createTorznabError(event, TORZNAB_ERRORS.ACCOUNT_SUSPENDED);
  }

  return user;
}

/**
 * Create a Torznab-compliant error response
 * The error contains XML in the 'data' field which should be extracted by the caller
 */
export function createTorznabError(
  event: H3Event,
  error: { code: number; description: string },
  customMessage?: string
): never {
  const httpStatus = error.code === 100 || error.code === 101 ? 401 : 400;
  const xml = buildErrorXml({
    code: error.code,
    description: customMessage ?? error.description,
  });

  const err = createError({
    statusCode: httpStatus,
    statusMessage: 'Torznab Error',
    message: customMessage ?? error.description,
    data: xml,
  });
  // Mark this as a Torznab error so we can handle it specially
  (err as any).isTorznab = true;

  throw err;
}

/**
 * Send XML error response
 */
export function sendTorznabError(
  event: H3Event,
  error: { code: number; description: string },
  customMessage?: string
): string {
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
  return buildErrorXml({
    code: error.code,
    description: customMessage ?? error.description,
  });
}
