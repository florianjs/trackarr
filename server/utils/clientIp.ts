/**
 * Client IP resolution with trusted-proxy enforcement
 *
 * Proxy headers (X-Real-IP, X-Forwarded-For, CF-Connecting-IP) are only
 * honoured when the direct peer is a trusted proxy. Otherwise any client
 * could forge them to dodge IP bans and rate limits, or get a victim banned.
 */

import { BlockList, isIP } from 'net';

// Docker networks, loopback and private ranges: where Caddy runs in the
// shipped compose files. Override with TRUSTED_PROXIES (comma separated
// IPs/CIDRs, or "none").
const DEFAULT_TRUSTED_PROXIES = [
  '127.0.0.0/8',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '::1/128',
  'fc00::/7',
];

export function normalizeIP(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed.startsWith('::ffff:') && isIP(trimmed.slice(7)) === 4) {
    return trimmed.slice(7);
  }
  return trimmed;
}

export function buildTrustedProxyList(spec: string | undefined): BlockList {
  const list = new BlockList();
  const entries =
    spec === undefined || spec.trim() === ''
      ? DEFAULT_TRUSTED_PROXIES
      : spec.trim().toLowerCase() === 'none'
        ? []
        : spec.split(',').map((s) => s.trim()).filter(Boolean);

  for (const entry of entries) {
    const [addr, prefix] = entry.split('/');
    const family = isIP(addr ?? '');
    if (!family) continue;
    const type = family === 4 ? 'ipv4' : 'ipv6';
    if (prefix === undefined) {
      list.addAddress(addr!, type);
    } else {
      list.addSubnet(addr!, Number(prefix), type);
    }
  }
  return list;
}

function isTrusted(list: BlockList, ip: string): boolean {
  const family = isIP(ip);
  if (!family) return false;
  return list.check(ip, family === 4 ? 'ipv4' : 'ipv6');
}

export interface ClientIPInput {
  remoteAddress: string | undefined;
  headers: Record<string, string | string[] | undefined>;
}

export interface ClientIPOptions {
  trustedProxies: BlockList;
  trustCloudflare: boolean;
}

function headerValue(
  headers: ClientIPInput['headers'],
  name: string
): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[value.length - 1] : value;
}

/**
 * Resolve the real client IP. Returns 'unknown' if nothing valid is found.
 */
export function resolveClientIP(
  input: ClientIPInput,
  options: ClientIPOptions
): string {
  const peer = input.remoteAddress ? normalizeIP(input.remoteAddress) : '';

  if (!peer || !isTrusted(options.trustedProxies, peer)) {
    return isIP(peer) ? peer : 'unknown';
  }

  if (options.trustCloudflare) {
    const cf = headerValue(input.headers, 'cf-connecting-ip');
    if (cf && isIP(normalizeIP(cf))) return normalizeIP(cf);
  }

  const realIP = headerValue(input.headers, 'x-real-ip');
  if (realIP && isIP(normalizeIP(realIP))) return normalizeIP(realIP);

  // Walk X-Forwarded-For right to left, skipping trusted hops: the left-most
  // entries are client controlled.
  const forwarded = headerValue(input.headers, 'x-forwarded-for');
  if (forwarded) {
    const hops = forwarded.split(',').map(normalizeIP).filter(Boolean);
    for (let i = hops.length - 1; i >= 0; i--) {
      const hop = hops[i]!;
      if (!isIP(hop)) break;
      if (!isTrusted(options.trustedProxies, hop) || i === 0) return hop;
    }
  }

  return peer;
}

let cachedOptions: ClientIPOptions | null = null;

export function getClientIPOptions(): ClientIPOptions {
  if (!cachedOptions) {
    cachedOptions = {
      trustedProxies: buildTrustedProxyList(process.env.TRUSTED_PROXIES),
      trustCloudflare: process.env.TRUST_CLOUDFLARE === 'true',
    };
  }
  return cachedOptions;
}
