/**
 * Content Security Policy
 * Scripts must come from our origin or carry the per-response nonce that
 * server/plugins/csp-nonce.ts puts on the scripts Nuxt inlines in its pages
 * (import map, payload). No 'unsafe-inline' for scripts in production, so an
 * injected <script> or inline event handler does not run.
 */
import { randomBytes } from 'crypto';

export function createCspNonce(): string {
  return randomBytes(16).toString('base64');
}

export function buildCsp(nonce?: string, dev = import.meta.dev): string {
  const scriptSrc = dev
    ? "script-src 'self' 'unsafe-inline'" // Vite HMR and devtools in development
    : `script-src 'self'${nonce ? ` 'nonce-${nonce}'` : ''}`;

  return [
    "default-src 'self'",
    scriptSrc,
    // Style attributes from Vue :style bindings rendered on the server,
    // and styles injected at runtime (icons, editor), need it
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/**
 * Put the nonce on every <script> tag of a chunk Nuxt's head renderer
 * produced. Only for those chunks: the page body can hold user content.
 */
export function addScriptNonce(chunk: string, nonce: string): string {
  return chunk.replace(/<script\b/gi, `<script nonce="${nonce}"`);
}
