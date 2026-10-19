import { describe, it, expect } from 'vitest';
import { parseSentinels } from '../server/redis/sentinel';

describe('parseSentinels', () => {
  it('returns nothing when unset', () => {
    expect(parseSentinels(undefined)).toEqual([]);
    expect(parseSentinels('')).toEqual([]);
  });

  it('parses a comma separated list', () => {
    expect(parseSentinels('dc1.example:26379, dc2.example:26380,10.0.0.3')).toEqual([
      { host: 'dc1.example', port: 26379 },
      { host: 'dc2.example', port: 26380 },
      { host: '10.0.0.3', port: 26379 },
    ]);
  });

  it('rejects invalid ports', () => {
    expect(() => parseSentinels('dc1:abc')).toThrow('Invalid REDIS_SENTINELS');
    expect(() => parseSentinels('dc1:70000')).toThrow('Invalid REDIS_SENTINELS');
  });
});
