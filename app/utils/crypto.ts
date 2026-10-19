/**
 * Zero Knowledge Encryption - Client-side crypto utilities
 * Uses @noble/hashes for Argon2id and SHA256
 */
import { createPoWHasher, leadingZeroBitsOfWords } from './powHasher';

/**
 * Credentials to send to server during registration
 */
export interface ZKECredentials {
  salt: string;     // base64 encoded
  verifier: string; // base64 encoded
}

/**
 * PoW solution to send to server
 */
export interface PoWSolution {
  challenge: string;
  nonce: string;
  hash: string;
}

/**
 * Convert Uint8Array to base64
 */
function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Convert base64 to Uint8Array
 */
function fromBase64(base64: string): Uint8Array {
  return new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));
}

/**
 * Generate random bytes using Web Crypto API
 */
function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * SHA256 hash using Web Crypto API
 */
async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
  return new Uint8Array(hashBuffer);
}

/**
 * Simple key derivation using PBKDF2 (browser-native)
 * For production, consider using Argon2id via WASM
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000, // OWASP recommendation
      hash: 'SHA-256',
    },
    keyMaterial,
    256 // 32 bytes
  );
  
  return new Uint8Array(derivedBits);
}

/**
 * Generate ZKE credentials for registration
 * Client computes salt and verifier, server only stores these (never password)
 */
export async function generateCredentials(password: string): Promise<ZKECredentials> {
  // Generate random salt
  const salt = randomBytes(32);
  
  // Derive master key from password
  const masterKey = await deriveKey(password, salt);
  
  // Compute verifier as hash of master key
  const verifier = await sha256(masterKey);
  
  return {
    salt: toBase64(salt),
    verifier: toBase64(verifier),
  };
}

/**
 * Derive the login verifier from the password and the account's salt.
 * Only the verifier is sent (over TLS), never the password; the server keeps
 * a hash of it.
 */
export async function deriveLoginVerifier(password: string, salt: string): Promise<string> {
  const masterKey = await deriveKey(password, fromBase64(salt));
  return toBase64(await sha256(masterKey));
}

/**
 * Solve Proof of Work challenge
 * Finds nonce such that SHA256(challenge:nonce) starts with N zero bits
 */
export async function solvePoW(
  challenge: string,
  difficulty: number,
  onProgress?: (hashesComputed: number) => void
): Promise<PoWSolution> {
  // Synchronous hashing (see powHasher.ts), in chunks between which the
  // main thread gets to repaint
  const CHUNK = 50000;
  const hashNonce = createPoWHasher(`${challenge}:`);
  let nonce = 0;

  while (true) {
    const end = nonce + CHUNK;
    for (; nonce < end; nonce++) {
      if (leadingZeroBitsOfWords(hashNonce(nonce)) >= difficulty) {
        // Send the hash as computed by WebCrypto
        const digest = await sha256(new TextEncoder().encode(`${challenge}:${nonce}`));
        const hash = Array.from(digest).map(b => b.toString(16).padStart(2, '0')).join('');
        return { challenge, nonce: nonce.toString(), hash };
      }
    }

    // Report progress and yield to main thread between chunks
    onProgress?.(nonce);
    await new Promise(r => setTimeout(r, 0));
  }
}
