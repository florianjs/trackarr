import { describe, it, expect } from 'vitest';
import {
  buildTrustedProxyList,
  resolveClientIP,
  normalizeIP,
  rateLimitSubject,
} from '../../server/utils/clientIp';

const defaults = {
  trustedProxies: buildTrustedProxyList(undefined),
  trustCloudflare: false,
};

describe('resolveClientIP', () => {
  it('ignores proxy headers from an untrusted peer', () => {
    const ip = resolveClientIP(
      {
        remoteAddress: '203.0.113.7',
        headers: {
          'x-forwarded-for': '1.2.3.4',
          'x-real-ip': '1.2.3.4',
          'cf-connecting-ip': '1.2.3.4',
        },
      },
      defaults
    );
    expect(ip).toBe('203.0.113.7');
  });

  it('uses X-Real-IP set by a trusted proxy', () => {
    const ip = resolveClientIP(
      {
        remoteAddress: '172.18.0.5',
        headers: { 'x-real-ip': '198.51.100.20' },
      },
      defaults
    );
    expect(ip).toBe('198.51.100.20');
  });

  it('takes the right-most untrusted X-Forwarded-For hop', () => {
    const ip = resolveClientIP(
      {
        remoteAddress: '10.0.0.2',
        headers: { 'x-forwarded-for': '6.6.6.6, 198.51.100.20, 10.0.0.9' },
      },
      defaults
    );
    expect(ip).toBe('198.51.100.20');
  });

  it('ignores CF-Connecting-IP unless Cloudflare is trusted', () => {
    const input = {
      remoteAddress: '10.0.0.2',
      headers: { 'cf-connecting-ip': '1.2.3.4', 'x-real-ip': '198.51.100.20' },
    };
    expect(resolveClientIP(input, defaults)).toBe('198.51.100.20');
    expect(
      resolveClientIP(input, { ...defaults, trustCloudflare: true })
    ).toBe('1.2.3.4');
  });

  it('rejects non-IP header values', () => {
    const ip = resolveClientIP(
      {
        remoteAddress: '10.0.0.2',
        headers: { 'x-real-ip': "1.2.3.4' OR 1=1" },
      },
      defaults
    );
    expect(ip).toBe('10.0.0.2');
  });

  it('honours TRUSTED_PROXIES=none', () => {
    const ip = resolveClientIP(
      {
        remoteAddress: '10.0.0.2',
        headers: { 'x-real-ip': '198.51.100.20' },
      },
      { trustedProxies: buildTrustedProxyList('none'), trustCloudflare: false }
    );
    expect(ip).toBe('10.0.0.2');
  });

  it('supports custom proxy lists', () => {
    const list = buildTrustedProxyList('203.0.113.0/24, 2001:db8::1');
    expect(
      resolveClientIP(
        { remoteAddress: '203.0.113.9', headers: { 'x-real-ip': '8.8.8.8' } },
        { trustedProxies: list, trustCloudflare: false }
      )
    ).toBe('8.8.8.8');
    expect(
      resolveClientIP(
        { remoteAddress: '10.0.0.2', headers: { 'x-real-ip': '8.8.8.8' } },
        { trustedProxies: list, trustCloudflare: false }
      )
    ).toBe('10.0.0.2');
  });

  it('unwraps IPv4-mapped IPv6 addresses', () => {
    expect(normalizeIP('::ffff:192.168.1.1')).toBe('192.168.1.1');
    expect(
      resolveClientIP(
        { remoteAddress: '::ffff:203.0.113.7', headers: {} },
        defaults
      )
    ).toBe('203.0.113.7');
  });
});

describe('rateLimitSubject', () => {
  it('keeps IPv4 addresses as they are', () => {
    expect(rateLimitSubject('203.0.113.7')).toBe('203.0.113.7');
    expect(rateLimitSubject('::ffff:203.0.113.7')).toBe('203.0.113.7');
  });

  it('groups IPv6 addresses by /64', () => {
    const subject = '2001:db8:1:2::/64';
    expect(rateLimitSubject('2001:db8:1:2::1')).toBe(subject);
    expect(rateLimitSubject('2001:0db8:0001:0002:ffff:ffff:ffff:ffff')).toBe(subject);
    expect(rateLimitSubject('2001:db8:1:2:abcd::9')).toBe(subject);
    expect(rateLimitSubject('2001:db8:1:3::1')).not.toBe(subject);
    expect(rateLimitSubject('::1')).toBe('0:0:0:0::/64');
    expect(rateLimitSubject('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
  });

  it('leaves unparsable input untouched', () => {
    expect(rateLimitSubject('unknown')).toBe('unknown');
  });
});
