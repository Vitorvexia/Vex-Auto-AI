import type { LeadStatus } from "@/types/domain";

// Camada visual do funil de temperatura (Frio/Morno/Quente) — conceito
// diferente de PriorityTier (lib/lead-priority.ts, hot/warm/cold por
// score+handoff). Aqui é agrupamento puro por lead_status, sem olhar
// score ou conversation_status. FECHADO/PERDIDO ficam fora do funil.
export type FunnelStage = "frio" | "morno" | "quente";

export function getFunnelStage(status: LeadStatus): FunnelStage | null {
  switch (status) {
    case "NOVO":
    case "ENGAJADO":
      return "frio";
    case "INTERESSADO":
      return "morno";
    case "QUENTE":
    case "NEGOCIACAO":
      return "quente";
    default:
      return null;
  }
}

export type FunnelCounts = {
  frio: number;
  morno: number;
  quente: number;
  fechado: number;
  perdido: number;
};

export function calculateFunnelCounts(statuses: LeadStatus[]): FunnelCounts {
  const counts: FunnelCounts = { frio: 0, morno: 0, quente: 0, fechado: 0, perdido: 0 };
  for (const status of statuses) {
    const stage = getFunnelStage(status);
    if (stage) {
      counts[stage]++;
    } else if (status === "FECHADO") {
      counts.fechado++;
    } else if (status === "PERDIDO") {
      counts.perdido++;
    }
  }
  return counts;
}

// Taxa de conversão entre camadas — fração da camada anterior que avançou
// pra atual (morno/frio, quente/morno). null quando a camada anterior tem
// zero leads (divisão indefinida, não é 0%: não há base pra medir taxa).
export type FunnelConversion = {
  frioToMorno: number | null;
  mornoToQuente: number | null;
};

export function calculateFunnelConversion(counts: FunnelCounts): FunnelConversion {
  return {
    frioToMorno: counts.frio > 0 ? counts.morno / counts.frio : null,
    mornoToQuente: counts.morno > 0 ? counts.quente / counts.morno : null,
  };
}

// Taxa de conversão geral do funil (camada Conversão/Fechado) — fechados
// sobre TODO o volume do período (frio+morno+quente+fechado+perdido),
// incluindo perdidos no denominador de propósito: é a taxa real de
// conversão de quem entrou no funil, não só de quem "sobreviveu" até
// virar quente. null quando não há nenhum lead no período (sem base).
export function calculateConversionRate(counts: FunnelCounts): number | null {
  const totalPeriodo = counts.frio + counts.morno + counts.quente + counts.fechado + counts.perdido;
  return totalPeriodo > 0 ? counts.fechado / totalPeriodo : null;
}

// Statuses que compõem cada camada, na ordem de exibição do breakdown.
const STAGE_STATUSES: Record<FunnelStage, LeadStatus[]> = {
  frio: ["NOVO", "ENGAJADO"],
  morno: ["INTERESSADO"],
  quente: ["QUENTE", "NEGOCIACAO"],
};

export type StageBreakdownEntry = { status: LeadStatus; count: number; percent: number };

// Quantidade + % de cada status DENTRO da própria camada (não do funil
// inteiro) — os percentuais de uma mesma camada sempre somam exatamente
// 100 quando há pelo menos 1 lead (método do maior resto/Hamilton:
// arredonda pra baixo e distribui as sobras pros maiores restos, evita
// 99%/101% por arredondamento ingênuo). Camada sem leads retorna 0% pra
// cada status — não há base pra calcular proporção.
export function calculateStageBreakdown(
  stage: FunnelStage,
  statusCounts: Partial<Record<LeadStatus, number>>
): StageBreakdownEntry[] {
  const statuses = STAGE_STATUSES[stage];
  const counts = statuses.map((s) => statusCounts[s] ?? 0);
  const total = counts.reduce((a, b) => a + b, 0);

  if (total === 0) {
    return statuses.map((status) => ({ status, count: 0, percent: 0 }));
  }

  const exact = counts.map((c) => (c / total) * 100);
  const base = exact.map(Math.floor);
  const remaining = 100 - base.reduce((a, b) => a + b, 0);

  const byRemainder = exact
    .map((v, i) => ({ i, frac: v - base[i] }))
    .sort((a, b) => b.frac - a.frac);

  const percents = [...base];
  for (let k = 0; k < remaining; k++) {
    percents[byRemainder[k % byRemainder.length].i] += 1;
  }

  return statuses.map((status, i) => ({ status, count: counts[i], percent: percents[i] }));
}
