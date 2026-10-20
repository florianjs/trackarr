import { describe, it, expect, vi } from 'vitest';

vi.mock('../../server/redis/client', () => ({ redis: {} }));
vi.mock('../../server/utils/alerts', () => ({
  SecurityAlertType: {},
  sendSecurityAlert: async () => {},
}));

const { isNetworkRequest } = await import('../../server/utils/rateLimit');

describe('isNetworkRequest', () => {
  it('is true for a request over a real socket', () => {
    const event = { node: { req: { socket: { remoteAddress: '172.18.0.5' } } } };
    expect(isNetworkRequest(event)).toBe(true);
  });

  it('is false for an in-process SSR fetch (mock socket, no address)', () => {
    expect(isNetworkRequest({ node: { req: { socket: { remoteAddress: '' } } } })).toBe(false);
    expect(isNetworkRequest({ node: { req: {} } })).toBe(false);
  });
});
