/**
 * Parse REDIS_SENTINELS ("host1:26379,host2:26379,host3:26379") for a
 * replicated deployment. Returns an empty list when Sentinel is not used.
 */
export function parseSentinels(value: string | undefined): Array<{ host: string; port: number }> {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const sep = entry.lastIndexOf(':');
      const host = sep > 0 ? entry.slice(0, sep) : entry;
      const port = sep > 0 ? Number(entry.slice(sep + 1)) : 26379;
      if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) {
        throw new Error(`Invalid REDIS_SENTINELS entry: "${entry}"`);
      }
      return { host, port };
    });
}
