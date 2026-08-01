// Controle MANUAL de status de RENAVE por veículo (roadmap 1.1).
// Não é integração com o RENAVE — nenhuma chamada externa aqui, só a máquina
// de estados que governa a sequência de 4 etapas e a regra de nfe_key.

export const RENAVE_STAGES = [
  "entrada_registrada",
  "chave_nfe_vinculada",
  "documentos_protocolados",
  "saida_registrada",
] as const;

export type RenaveStage = (typeof RENAVE_STAGES)[number];

export const RENAVE_STAGE_LABELS: Record<RenaveStage, string> = {
  entrada_registrada: "Entrada registrada",
  chave_nfe_vinculada: "Chave da NF-e vinculada",
  documentos_protocolados: "Documentos protocolados no DETRAN",
  saida_registrada: "Saída registrada",
};

/** Próxima etapa da sequência — nunca pula, nunca volta. null se já na última. */
export function nextRenaveStage(current: RenaveStage): RenaveStage | null {
  const idx = RENAVE_STAGES.indexOf(current);
  if (idx === -1 || idx === RENAVE_STAGES.length - 1) return null;
  return RENAVE_STAGES[idx + 1];
}

/** A partir de chave_nfe_vinculada, nfe_key é obrigatória no registro. */
export function renaveStageRequiresNfeKey(stage: RenaveStage): boolean {
  return RENAVE_STAGES.indexOf(stage) >= RENAVE_STAGES.indexOf("chave_nfe_vinculada");
}

export interface CheckRenaveStageAdvanceInput {
  currentStage: RenaveStage;
  existingNfeKey: string | null;
  newNfeKey?: string | null;
}

export interface CheckRenaveStageAdvanceResult {
  ok: boolean;
  nextStage: RenaveStage | null;
  error?: string;
}

export function checkRenaveStageAdvance(
  input: CheckRenaveStageAdvanceInput
): CheckRenaveStageAdvanceResult {
  const next = nextRenaveStage(input.currentStage);
  if (!next) {
    return {
      ok: false,
      nextStage: null,
      error: "Veículo já está na última etapa do RENAVE (saída registrada).",
    };
  }

  if (renaveStageRequiresNfeKey(next)) {
    const key = (input.newNfeKey ?? input.existingNfeKey ?? "").trim();
    if (!key) {
      return {
        ok: false,
        nextStage: next,
        error: "Chave da NF-e é obrigatória a partir desta etapa.",
      };
    }
  }

  return { ok: true, nextStage: next };
}

/** Dias inteiros parado no estágio atual. Nunca negativo (clock skew). */
export function daysStalled(stageUpdatedAt: string, now: Date = new Date()): number {
  const then = new Date(stageUpdatedAt).getTime();
  const diffMs = now.getTime() - then;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function isRenaveStalled(
  stageUpdatedAt: string,
  now: Date = new Date(),
  thresholdDays = 7
): boolean {
  return daysStalled(stageUpdatedAt, now) > thresholdDays;
}
