import type { LeadStatus } from "@/types/domain";

// ============================================================================
// Types
// ============================================================================

export type ScoreSource = "message" | "follow_up" | "reactivation" | "system";

export interface ScoreInput {
  currentScore: number;
  leadStatus: LeadStatus;
  messageText: string;
  source: ScoreSource;
  isFirstScore: boolean;
  daysSinceLastReply?: number;
  followUpAttemptsWithoutReply?: number;
}

export interface ScoreResult {
  newScore: number;
  delta: number;
  reasons: string[];
}

// ============================================================================
// Text normalization
// ============================================================================

function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "");
}

// ============================================================================
// Negation guard
// ============================================================================

const NEGATION_TOKENS = new Set(["nao", "sem", "nunca", "jamais"]);
const NEGATION_WINDOW = 5;

function toClauses(normalized: string): string[][] {
  return normalized
    .split(/[.,!?;]/)
    .map((c) => c.trim().split(/\s+/).filter(Boolean))
    .filter((tokens) => tokens.length > 0);
}

function findPhrase(tokens: string[], phrase: string[]): number {
  outer: for (let i = 0; i <= tokens.length - phrase.length; i++) {
    for (let j = 0; j < phrase.length; j++) {
      if (tokens[i + j] !== phrase[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function isNegated(tokens: string[], phraseStart: number): boolean {
  const start = Math.max(0, phraseStart - NEGATION_WINDOW);
  for (let i = start; i < phraseStart; i++) {
    if (NEGATION_TOKENS.has(tokens[i])) return true;
  }
  return false;
}

// ============================================================================
// Signal definitions
// ============================================================================

interface SignalDef {
  id: string;
  phrases: string[][];
}

const SIGNAL_DEFS: SignalDef[] = [
  {
    id: "preco",
    phrases: [["preco"], ["valor"], ["quanto", "custa"], ["quanto", "ta"]],
  },
  {
    id: "financiamento",
    phrases: [["financiamento"], ["financiar"], ["parcela"], ["entrada"]],
  },
  {
    id: "intencao_forte",
    phrases: [
      ["quero", "comprar"],
      ["quero", "fechar"],
      ["vou", "fechar"],
      ["fechar", "negocio"],
      ["posso", "ir", "ai"],
      ["quando", "posso", "ir"],
      ["quero", "levar"],
    ],
  },
  {
    id: "veiculo_especifico",
    phrases: [
      ["honda"], ["toyota"], ["gm"], ["chevrolet"], ["vw"], ["volkswagen"],
      ["ford"], ["fiat"], ["hyundai"], ["renault"], ["nissan"], ["jeep"],
      ["ram"], ["mitsubishi"],
    ],
  },
  {
    id: "visita",
    phrases: [
      ["endereco"],
      ["como", "chego"],
      ["onde", "fica"],
      ["horario"],
      ["que", "horas"],
      ["posso", "visitar"],
      ["quero", "ver", "o", "carro"],
    ],
  },
];

// ============================================================================
// Public API
// ============================================================================

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

export function detectSignals(text: string): string[] {
  const normalized = normalizeText(text);
  const clauses = toClauses(normalized);
  const detected = new Set<string>();

  for (const tokens of clauses) {
    for (const signal of SIGNAL_DEFS) {
      if (detected.has(signal.id)) continue;
      for (const phrase of signal.phrases) {
        const idx = findPhrase(tokens, phrase);
        if (idx !== -1 && !isNegated(tokens, idx)) {
          detected.add(signal.id);
          break;
        }
      }
    }
  }

  return Array.from(detected);
}

export function calculateLeadScore(input: ScoreInput): ScoreResult {
  const {
    currentScore,
    leadStatus,
    messageText,
    source,
    isFirstScore,
    daysSinceLastReply,
    followUpAttemptsWithoutReply,
  } = input;

  let rawDelta = 0;
  const reasons: string[] = [];

  if (isFirstScore) {
    rawDelta += 10;
    reasons.push("base_inicial");
  }

  rawDelta += 5;
  reasons.push("mensagem");

  const signals = detectSignals(messageText);

  if (signals.includes("preco")) {
    rawDelta += 15;
    reasons.push("preco");
  }
  if (signals.includes("financiamento")) {
    rawDelta += 20;
    reasons.push("financiamento");
  }
  if (signals.includes("intencao_forte")) {
    rawDelta += 30;
    reasons.push("intencao_forte");
  }
  if (signals.includes("veiculo_especifico")) {
    rawDelta += 10;
    reasons.push("veiculo_especifico");
  }
  if (signals.includes("visita")) {
    rawDelta += 25;
    reasons.push("visita");
  }

  if (source === "follow_up") {
    rawDelta += 15;
    reasons.push("follow_up_response");
  }
  if (source === "reactivation") {
    rawDelta += 20;
    reasons.push("reactivation_response");
  }

  if (daysSinceLastReply !== undefined) {
    if (daysSinceLastReply >= 14) {
      rawDelta -= 30;
      reasons.push("inatividade_14d");
    } else if (daysSinceLastReply >= 7) {
      rawDelta -= 10;
      reasons.push("inatividade_7d");
    }
  }

  if (followUpAttemptsWithoutReply !== undefined && followUpAttemptsWithoutReply >= 3) {
    rawDelta -= 15;
    reasons.push("followup_sem_resposta");
  }

  let newScore = clampScore(currentScore + rawDelta);

  if (leadStatus === "PERDIDO" && newScore > 20) {
    newScore = 20;
    reasons.push("perdido_cap");
  }

  return {
    newScore,
    delta: newScore - currentScore,
    reasons,
  };
}
