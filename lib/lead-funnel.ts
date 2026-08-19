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
