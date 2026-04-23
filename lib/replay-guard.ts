const TTL_MS = 10 * 60_000;

interface Entry {
  seenAt: number;
}

const cache = new Map<string, Entry>();

export function isReplayedMessage(messageExternalId: string): boolean {
  const now = Date.now();
  const entry = cache.get(messageExternalId);
  if (entry && now - entry.seenAt < TTL_MS) {
    return true;
  }
  cache.set(messageExternalId, { seenAt: now });
  return false;
}

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const cutoff = Date.now() - TTL_MS;
    for (const [id, entry] of cache) {
      if (entry.seenAt < cutoff) cache.delete(id);
    }
  }, TTL_MS);
}
