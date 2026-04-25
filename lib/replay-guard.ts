// Cache in-memory de WAMIDs (message_external_id) recentemente processados.
// Defence-in-depth além do unique constraint do banco.
//
// Cenário mitigado: dois workers simultâneos (ou Meta retry) entregam o mesmo
// WAMID antes que o primeiro insert seja commitado — o DB unique constraint
// resolve, mas este cache evita a chamada ao banco + pipeline desnecessários.
//
// TTL de 10 minutos é suficiente para cobrir retries legítimos da Meta.
// Para escala horizontal, substituir por Redis SET com NX + EXPIRE.

const TTL_MS = 10 * 60_000; // 10 minutos

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

// Limpeza periódica para evitar crescimento irrestrito em instâncias longas
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const cutoff = Date.now() - TTL_MS;
    for (const [id, entry] of cache) {
      if (entry.seenAt < cutoff) cache.delete(id);
    }
  }, TTL_MS);
}
