/**
 * Docker Secrets Reader
 * Utilities for reading Docker secrets from mounted files
 * Supports both file-based secrets (_FILE suffix) and direct environment variables
 */

import { readFileSync, existsSync } from 'fs';

/**
 * Read a secret from Docker secret file or environment variable
 * Prioritizes _FILE suffix environment variables over direct values
 *
 * @param envKey - Base environment variable name (without _FILE suffix)
 * @param defaultValue - Optional default value if secret not found
 * @returns The secret value or default
 * @throws Error if secret is required but not found
 */
export function readSecret(envKey: string, defaultValue?: string): string {
  // Try reading from Docker secret file first
  const fileEnvKey = `${envKey}_FILE`;
  const secretFilePath = process.env[fileEnvKey];

  if (secretFilePath) {
    try {
      if (existsSync(secretFilePath)) {
        const secret = readFileSync(secretFilePath, 'utf-8').trim();
        if (secret) {
          return secret;
        }
      } else {
        console.warn(`[Secrets] Secret file not found: ${secretFilePath}`);
      }
    } catch (error) {
      console.error(
        `[Secrets] Error reading secret file ${secretFilePath}:`,
        error
      );
    }
  }

  // Fallback to direct environment variable
  const directValue = process.env[envKey];
  if (directValue) {
    return directValue;
  }

  // Use default value if provided
  if (defaultValue !== undefined) {
    return defaultValue;
  }

  // Throw error if secret is required
  throw new Error(
    `Secret ${envKey} not found. Set ${fileEnvKey} (Docker secret) or ${envKey} (env var)`
  );
}

/**
 * Read an optional secret (returns undefined if not found)
 */
export function readOptionalSecret(envKey: string): string | undefined {
  try {
    return readSecret(envKey);
  } catch {
    return undefined;
  }
}

/**
 * Validate that all required secrets are present
 * Should be called during application startup
 */
export function validateRequiredSecrets(requiredKeys: string[]): void {
  const missing: string[] = [];

  for (const key of requiredKeys) {
    try {
      readSecret(key);
    } catch {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required secrets: ${missing.join(', ')}\n` +
        'Generate secrets with: ./scripts/generate-secrets.sh'
    );
  }

  console.log(
    `[Secrets] ✓ All ${requiredKeys.length} required secrets validated`
  );
}
