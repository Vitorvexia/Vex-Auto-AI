import type { AgentContext } from "@/lib/agent-context";
import type { GuardrailResult, GuardrailMode } from "@/lib/guardrails";

export interface PromptPayload {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

const MODE_INSTRUCTIONS: Record<GuardrailMode, string> = {
  normal:
    "Atendimento comercial completo. Qualifique o interesse do lead e apresente as opções mais relevantes do catálogo.",
  short_message:
    "O lead enviou uma mensagem muito curta. Responda de forma simples e aberta. Estimule-o a continuar a conversa.",
  off_hours:
    "Estamos fora do horário de atendimento. Confirme o recebimento da mensagem, informe quando retornamos e mantenha um tom acolhedor.",
  reopen:
    "Esta conversa estava encerrada. Trate como um novo contato, resgate o contexto com cuidado e inicie um novo ciclo de atendimento.",
  human_handoff: "",
};

function formatVehicles(vehicles: AgentContext["vehicles"]): string {
  if (vehicles.length === 0) return "Nenhum veículo disponível no momento.";
  return vehicles
    .slice(0, 6)
    .map(
      (v) =>
        `${v.marca} ${v.modelo} ${v.ano} — R$ ${v.preco.toLocaleString("pt-BR")}`
    )
    .join("\n");
}

function buildSystem(ctx: AgentContext, guardrail: GuardrailResult): string {
  const summary =
    ctx.conversation.summary ?? "Primeiro contato ou sem resumo disponível.";

  return `[IDENTIDADE]
Você é o atendente virtual da ${ctx.store_name}.
Atende leads via WhatsApp com foco em venda de veículos.

[TOM DE VOZ]
- Seja direto, natural e profissional
- Evite respostas longas demais — máximo 3 a 4 frases por mensagem
- Foque em avançar a conversa para a venda
- Não seja robótico nem use linguagem corporativa

[CONTEXTO DO LEAD]
Nome: ${ctx.lead.nome ?? "não informado"}
Origem: ${ctx.lead.origem}
Status: ${ctx.lead.lead_status}
Score atual: ${ctx.lead.score}/100

[RESUMO DA CONVERSA]
${summary}

[CATÁLOGO DISPONÍVEL — até 6 veículos]
${formatVehicles(ctx.vehicles)}

[MODO ATUAL: ${guardrail.mode}]
${MODE_INSTRUCTIONS[guardrail.mode]}

[FORMATO DE RESPOSTA]
Responda EXCLUSIVAMENTE em JSON válido, sem texto fora do JSON:
{
  "reply_text": "string com resposta ao lead",
  "should_handoff": false,
  "score": 0,
  "intent_tags": [],
  "summary": "resumo atualizado da conversa"
}

[REGRAS FIXAS]
- Nunca invente informações sobre veículos
- Nunca prometa condições fora do catálogo
- Se não souber, diga que vai verificar
- Responda sempre em português
- Respostas curtas e objetivas — máximo 3 a 4 frases`;
}

export function buildPrompt(
  ctx: AgentContext,
  guardrail: GuardrailResult
): PromptPayload {
  const system = buildSystem(ctx, guardrail);

  const history = ctx.last_messages.map((m) => ({
    role: (m.direcao === "entrada" ? "user" : "assistant") as
      | "user"
      | "assistant",
    content: m.mensagem,
  }));

  const messages = [
    ...history,
    { role: "user" as const, content: ctx.incoming_text },
  ];

  return { system, messages };
}
