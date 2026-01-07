/**
 * Zero Knowledge Encryption - Client-side crypto utilities
 * Uses @noble/hashes for Argon2id and SHA256
 */

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
 * SHA256 hash to hex string (for PoW)
 */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await sha256(data);
  return Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
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
 * Generate login proof
 * Client proves knowledge of password without sending it
 */
export async function generateLoginProof(
  password: string, 
  salt: string, 
  challenge: string
): Promise<string> {
  // Reconstruct master key using provided salt
  const saltBytes = fromBase64(salt);
  const masterKey = await deriveKey(password, saltBytes);
  
  // Compute verifier
  const verifier = await sha256(masterKey);
  
  // Proof = SHA256(verifier + challenge)
  const proofInput = toBase64(verifier) + challenge;
  const proof = await sha256Hex(proofInput);
  
  return proof;
}

/**
 * Solve Proof of Work challenge
 * Finds nonce such that SHA256(challenge:nonce) starts with N zeros
 */
export async function solvePoW(
  challenge: string, 
  difficulty: number,
  onProgress?: (hashesComputed: number) => void
): Promise<PoWSolution> {
  const target = '0'.repeat(difficulty);
  let nonce = 0;
  
  while (true) {
    const input = `${challenge}:${nonce}`;
    const hash = await sha256Hex(input);
    
    if (hash.startsWith(target)) {
      return { challenge, nonce: nonce.toString(), hash };
    }
    
    nonce++;
    
    // Report progress and yield to main thread every 5000 iterations
    if (nonce % 5000 === 0) {
      onProgress?.(nonce);
      await new Promise(r => setTimeout(r, 0));
    }
  }
}
