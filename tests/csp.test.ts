import { describe, it, expect } from 'vitest';
import { addScriptNonce, buildCsp, createCspNonce } from '../server/utils/csp';

const scriptSrc = (csp: string) => csp.split('; ').find((d) => d.startsWith('script-src'));

describe('buildCsp', () => {
  it('allows inline scripts only through the nonce in production', () => {
    expect(scriptSrc(buildCsp(undefined, false))).toBe("script-src 'self'");
    expect(scriptSrc(buildCsp('abc', false))).toBe("script-src 'self' 'nonce-abc'");
  });

  it('keeps unsafe-inline in development for Vite', () => {
    expect(scriptSrc(buildCsp(undefined, true))).toContain("'unsafe-inline'");
  });
});

describe('createCspNonce', () => {
  it('is random and header safe', () => {
    const a = createCspNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(createCspNonce()).not.toBe(a);
  });
});

describe('addScriptNonce', () => {
  it('adds the nonce to every script tag', () => {
    const html =
      '<script type="importmap">{}</script><link rel="modulepreload" href="/a.js">' +
      '<SCRIPT src="/b.js"></SCRIPT><noscript>x</noscript>';
    expect(addScriptNonce(html, 'n1')).toBe(
      '<script nonce="n1" type="importmap">{}</script><link rel="modulepreload" href="/a.js">' +
        '<script nonce="n1" src="/b.js"></SCRIPT><noscript>x</noscript>'
    );
  });
});
