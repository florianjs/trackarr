import { randomBytes } from 'crypto';

/**
 * Torznab API keys: given to Prowlarr, Sonarr and the like instead of the
 * passkey, so a leaked key can be rotated without touching announces.
 * The prefix tells them apart from passkeys (32 or 40 hex chars).
 */
export const API_KEY_PREFIX = 'tk_';

const API_KEY_RE = /^tk_[a-f0-9]{40}$/;
const PASSKEY_RE = /^[a-f0-9]{32}([a-f0-9]{8})?$/;

export function generateApiKey(): string {
  return API_KEY_PREFIX + randomBytes(20).toString('hex');
}

export type TorznabCredential =
  | { kind: 'apiKey'; value: string }
  | { kind: 'passkey'; value: string };

/**
 * Classify the ?apikey= value of a Torznab request. Passkeys are still
 * accepted for indexers configured before API keys existed.
 */
export function parseTorznabCredential(raw: unknown): TorznabCredential | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase();
  if (API_KEY_RE.test(value)) return { kind: 'apiKey', value };
  if (PASSKEY_RE.test(value)) return { kind: 'passkey', value };
  return null;
}
