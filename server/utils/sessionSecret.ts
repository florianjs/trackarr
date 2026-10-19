/**
 * The session password seals every login cookie: a public or short value lets
 * anyone forge sessions, admin included. Placeholders shipped in example
 * files are rejected even when long enough.
 */

// Values from example files an operator might copy as is (test stacks use
// their own fixed secrets on purpose and are not listed)
const KNOWN_PLACEHOLDERS = new Set(['change-me', 'change-me-at-least-32-characters-long']);

/** Why the value cannot be used, or null when it is fine */
export function sessionSecretProblem(value: string | undefined): string | null {
  if (!value) return 'NUXT_SESSION_PASSWORD is not set';
  if (value.length < 32) return 'NUXT_SESSION_PASSWORD must be at least 32 characters';
  if (KNOWN_PLACEHOLDERS.has(value)) {
    return 'NUXT_SESSION_PASSWORD is a public placeholder: generate one with openssl rand -hex 32';
  }
  return null;
}
