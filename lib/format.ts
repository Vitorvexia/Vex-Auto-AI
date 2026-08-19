/** Tempo relativo em pt-BR ("agora", "ha 5min", "ha 2h", "ha 3d"). */
export function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  const mo = Math.floor(d / 30);
  return `há ${mo}mês`;
}

/** Data/hora curta em pt-BR ("14/04 09:23"). */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Valor em BRL, sem centavos ("R$ 15.000"). */
export function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/** Retorna a classe de badge para o score (0-100). */
export function scoreClass(score: number): string {
  if (score >= 70) return "s-hot";
  if (score >= 40) return "s-warm";
  if (score >= 15) return "s-cool";
  return "s-cold";
}
