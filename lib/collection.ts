import type { LeadContexto, TrocaData } from "@/lib/agent-context";
import type { CollectionState } from "@/lib/guardrails";
import type { CollectedData } from "@/lib/ai";

export interface CollectionUpdate {
  contexto: LeadContexto;
  agendamento: { data: string | null; horario: string | null } | null;
  forceHandoff: boolean;
}

const TROCA_REQUIRED_KEYS: (keyof TrocaData)[] = [
  "modelo",
  "ano",
  "km",
  "servico_recente",
  "agendamento_horario",
];

function isFilled(v: unknown): boolean {
  return v !== undefined && v !== null && v !== "";
}

function trocaComplete(draft: Partial<TrocaData>): boolean {
  return TROCA_REQUIRED_KEYS.every((k) => isFilled(draft[k]));
}

function mergeTrocaDraft(
  existing: Partial<TrocaData> | null | undefined,
  incoming: Partial<TrocaData> | null | undefined
): Partial<TrocaData> {
  const base: Partial<TrocaData> = { ...(existing ?? {}) };
  if (!incoming) return base;
  (Object.keys(incoming) as (keyof TrocaData)[]).forEach((key) => {
    const value = incoming[key];
    if (isFilled(value)) {
      (base as Record<string, unknown>)[key] = value;
    }
  });
  return base;
}

export function applyCollectionUpdate(
  contexto: LeadContexto,
  collection: CollectionState,
  collectedData: CollectedData | undefined
): CollectionUpdate {
  const next: LeadContexto = { ...contexto };
  const pendingTopics = new Set(next.pending_topics ?? []);
  let forceHandoff = false;
  let agendamento: { data: string | null; horario: string | null } | null = null;

  for (const topic of collection.ask) {
    pendingTopics.add(topic);
  }

  if (collection.collect.includes("financiamento")) {
    const data = collectedData?.financiamento;
    next.financiamento = {
      nome_completo: data?.nome_completo ?? null,
      cpf: data?.cpf ?? null,
      renda_aproximada: data?.renda_aproximada ?? null,
      entrada_disposta: data?.entrada_disposta ?? null,
    };
    pendingTopics.delete("financiamento");
    forceHandoff = true;
  }

  if (collection.collect.includes("troca")) {
    const merged = mergeTrocaDraft(next.troca_draft, collectedData?.troca);
    if (trocaComplete(merged)) {
      next.troca = merged as TrocaData;
      next.troca_draft = null;
      pendingTopics.delete("troca");
      forceHandoff = true;
      agendamento = {
        data: merged.agendamento_data ?? null,
        horario: merged.agendamento_horario ?? null,
      };
    } else {
      next.troca_draft = merged;
    }
  }

  next.pending_topics = Array.from(pendingTopics);
  return { contexto: next, agendamento, forceHandoff };
}
