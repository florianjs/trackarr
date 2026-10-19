import { describe, it, expect } from 'vitest';
import { isHoneypotFilled, isHoneypotPath } from '../../server/utils/honeypot';

describe('isHoneypotPath', () => {
  it('traps scanner targets', () => {
    for (const path of [
      '/.env',
      '/.env.production',
      '/.git/config',
      '/.aws/credentials',
      '/wp-admin/',
      '/wp-login.php',
      '/xmlrpc.php',
      '/phpmyadmin/index.php',
      '/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php',
      '/cgi-bin/luci',
      '/etc/passwd',
      '/server-status',
      '/index.php?id=1',
    ]) {
      expect(isHoneypotPath(path), path).toBe(true);
    }
  });

  it('leaves real routes alone', () => {
    for (const path of [
      '/',
      '/torrents',
      '/api/torrents',
      '/api/auth/login',
      '/announce',
      '/uploads/logo-0123456789abcdef.png',
      '/admin',
      '/admin/settings',
      '/_nuxt/entry.js',
      '/.well-known/security.txt',
      '/environment-info',
      '/pmapping',
    ]) {
      expect(isHoneypotPath(path), path).toBe(false);
    }
  });
});

describe('isHoneypotFilled', () => {
  it('only flags a non-empty string', () => {
    expect(isHoneypotFilled(undefined)).toBe(false);
    expect(isHoneypotFilled('')).toBe(false);
    expect(isHoneypotFilled('   ')).toBe(false);
    expect(isHoneypotFilled('http://spam.example')).toBe(true);
  });
});
