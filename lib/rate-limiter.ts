// Rate limiter em memória — duas dimensões: por telefone e por loja.
// Para escala horizontal (múltiplos workers), substituir por Redis.
// Janela deslizante simples: contagem reset a cada WINDOW_MS.

const WINDOW_MS = 60_000;
const MAX_PER_PHONE = 10;       // 10 msgs/min por número
const MAX_PER_STORE = 100;      // 100 msgs/min por loja

interface Entry {
  count: number;
  resetAt: number;
}

const phoneMap = new Map<string, Entry>();
const storeMap = new Map<string, Entry>();

function check(map: Map<string, Entry>, key: string, limit: number): boolean {
  const now = Date.now();
  const entry = map.get(key);

  if (!entry || now > entry.resetAt) {
    map.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}

export function checkRateLimit(phone: string): boolean {
  return check(phoneMap, phone, MAX_PER_PHONE);
}

export function checkStoreRateLimit(storeId: string): boolean {
  return check(storeMap, storeId, MAX_PER_STORE);
}

// Limpeza periódica para evitar vazamento de memória em instâncias longas
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, e] of phoneMap) if (now > e.resetAt) phoneMap.delete(k);
    for (const [k, e] of storeMap) if (now > e.resetAt) storeMap.delete(k);
  }, WINDOW_MS * 5);
}
