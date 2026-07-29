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

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function calculateAge(dataNascimento: string, now: Date): number | null {
  const m = ISO_DATE.exec(dataNascimento);
  if (!m) return null;
  const birth = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(birth.getTime())) return null;

  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age--;
  }
  return age;
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
  collectedData: CollectedData | undefined,
  now: Date = new Date()
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
    const idade = data?.data_nascimento ? calculateAge(data.data_nascimento, now) : null;
    const isMinor = idade !== null && idade < 18;

    if (isMinor) {
      // dado financeiro de menor nunca é persistido — bloqueio garantido em código, não confia só no prompt
      delete next.financiamento;
      next.financiamento_bloqueio = "financiamento_menor_idade";
    } else {
      if (next.financiamento_bloqueio) {
        // turno anterior bloqueou por menoridade — esta coleta é de um novo titular (responsável/terceiro)
        next.titular_diferente_do_lead = true;
      }
      delete next.financiamento_bloqueio;
      next.financiamento = {
        nome_completo: data?.nome_completo ?? null,
        cpf: data?.cpf ?? null,
        renda_aproximada: data?.renda_aproximada ?? null,
        entrada_disposta: data?.entrada_disposta ?? null,
        data_nascimento: data?.data_nascimento ?? null,
      };
    }
    pendingTopics.delete("financiamento");
    forceHandoff = true;
  }

  if (collection.collect.includes("troca")) {
    const merged = mergeTrocaDraft(next.troca_draft, collectedData?.troca);
    if (trocaComplete(merged)) {
      next.troca = {
        modelo: merged.modelo ?? null,
        ano: merged.ano ?? null,
        km: merged.km ?? null,
        servico_recente: merged.servico_recente ?? null,
        agendamento_data: merged.agendamento_data ?? null,
        agendamento_horario: merged.agendamento_horario ?? null,
      };
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
