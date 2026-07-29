// ============================================================================
// Scrubbing de PII antes de qualquer evento sair pro Sentry (serviço terceiro)
//
// Mesma disciplina já aplicada em ai_logs (lib/ai-pipeline.ts redactCpfFromLog)
// e nos logs estruturados (lib/logger.ts) — remove, não só mascara, porque o
// destino aqui é um serviço externo, não o próprio banco.
//
// Framework-agnostic de propósito: recebe/devolve `unknown`, sem depender de
// tipos do @sentry/nextjs, pra ficar testável isoladamente (mesmo padrão de
// lib/pii.ts).
// ============================================================================

// CPF: 11 dígitos, com ou sem pontuação — mesmo padrão de lib/ai-pipeline.ts
const CPF_PATTERN = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;
// Telefone E.164 — '+' seguido de 8 a 15 dígitos (mesma faixa de scripts/test-template-send.ts)
const PHONE_PATTERN = /\+[1-9]\d{7,14}/g;

// Chaves cujo VALOR INTEIRO é sempre PII, mesmo que não bata os padrões acima
// (nome livre, conteúdo de mensagem — não têm formato reconhecível por regex).
const PII_KEYS = new Set([
  "cpf",
  "phone",
  "phone_normalized",
  "telefone",
  "to",
  "from",
  "numero",
  "nome",
  "nome_completo",
  "incoming_text",
  "reply_text",
  "mensagem",
  "renda_aproximada",
  "entrada_disposta",
  "data_nascimento",
]);

const REDACTED = "[removido]";

function scrubString(s: string): string {
  // Telefone primeiro (padrão mais específico, exige '+') — senão o padrão de
  // CPF casa 11 dígitos soltos dentro do número de telefone antes da vez dele.
  return s.replace(PHONE_PATTERN, "[telefone removido]").replace(CPF_PATTERN, "[cpf removido]");
}

function scrubValue(value: unknown, keyHint?: string): unknown {
  if (keyHint && PII_KEYS.has(keyHint.toLowerCase())) return REDACTED;
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map((v) => scrubValue(v));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubValue(v, k);
    }
    return out;
  }
  return value;
}

/** Percorre recursivamente um evento (ou qualquer objeto) do Sentry e remove PII conhecida. */
export function scrubSentryEvent<T>(event: T): T {
  return scrubValue(event) as T;
}
