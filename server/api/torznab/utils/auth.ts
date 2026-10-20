/**
 * Torznab Authentication Utilities
 * Handles passkey-based authentication for Torznab API
 */

import { H3Event, createError } from 'h3';
import { db, schema } from '../../../db';
import { eq } from 'drizzle-orm';
import { buildErrorXml, TORZNAB_ERRORS } from './xml';
import { parseTorznabCredential } from '../../../utils/apiKey';

export interface TorznabUser {
  id: string;
  username: string;
  passkey: string;
  isBanned: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  /** Credential the request used, echoed in download links */
  apikey: string;
}

/**
 * Authenticate user via Torznab API key (or legacy passkey)
 * Returns user if valid, throws error otherwise
 */
export async function authenticateTorznab(
  event: H3Event
): Promise<TorznabUser> {
  const apikey = getQuery(event).apikey;

  if (!apikey) {
    throw createTorznabError(
      event,
      TORZNAB_ERRORS.MISSING_PARAMETER,
      'Missing apikey parameter'
    );
  }

  const credential = parseTorznabCredential(apikey);
  if (!credential) {
    throw createTorznabError(
      event,
      TORZNAB_ERRORS.INCORRECT_CREDENTIALS,
      'Invalid API key format. Use the API key from your Integrations page'
    );
  }

  // API key, or the passkey for indexers set up before API keys existed
  const column =
    credential.kind === 'apiKey' ? schema.users.apiKey : schema.users.passkey;

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
    .where(eq(column, credential.value))
    .limit(1);

  const user = users[0];

  if (!user) {
    throw createTorznabError(event, TORZNAB_ERRORS.INCORRECT_CREDENTIALS);
  }

  if (user.isBanned) {
    throw createTorznabError(event, TORZNAB_ERRORS.ACCOUNT_SUSPENDED);
  }

  return { ...user, apikey: credential.value };
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
