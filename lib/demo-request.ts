// Validação pura da captura de lead comercial do próprio Vex Auto (landing
// de vendas, roadmap 1.7) — não confundir com validação de lead de loja
// (lib/lead-ingestion.ts). Sem I/O, sem normalização de telefone: aqui é só
// presença obrigatória (schema não tem phone_normalized nem integra o
// pipeline de leads/WhatsApp — é tabela interna consultada manualmente).
export type DemoRequestInput = {
  nome: string;
  empresa: string;
  telefone: string;
  email?: string | null;
  mensagem?: string | null;
};

export type DemoRequestValidationResult =
  | { valid: true }
  | {
      valid: false;
      field: "nome" | "empresa" | "telefone" | "email" | "mensagem";
      message: string;
    };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const DEMO_REQUEST_MENSAGEM_MAX_LENGTH = 2000;

export function validateDemoRequest(
  input: DemoRequestInput
): DemoRequestValidationResult {
  if (!input.nome?.trim()) {
    return { valid: false, field: "nome", message: "Informe seu nome." };
  }
  if (!input.empresa?.trim()) {
    return {
      valid: false,
      field: "empresa",
      message: "Informe o nome da empresa.",
    };
  }
  if (!input.telefone?.trim()) {
    return {
      valid: false,
      field: "telefone",
      message: "Informe seu telefone.",
    };
  }
  if (input.email?.trim() && !EMAIL_RE.test(input.email.trim())) {
    return { valid: false, field: "email", message: "E-mail inválido." };
  }
  if (
    input.mensagem &&
    input.mensagem.length > DEMO_REQUEST_MENSAGEM_MAX_LENGTH
  ) {
    return {
      valid: false,
      field: "mensagem",
      message: `Mensagem muito longa (máx. ${DEMO_REQUEST_MENSAGEM_MAX_LENGTH} caracteres).`,
    };
  }
  return { valid: true };
}
