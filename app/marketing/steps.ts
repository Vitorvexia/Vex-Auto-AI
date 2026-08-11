export type Step = {
  eyebrow: string;
  icon: "chat" | "score" | "loop" | "handoff" | "chart";
  title: string;
  body: string;
  callout: string;
};

// Mapeia o funil real (CLAUDE.md — Entrada → Atendimento → Qualificação →
// Nutrição → Dossiê → Intervenção Humana → Conversão → Pós-venda →
// Reativação) em 5 etapas de leitura rápida pra landing. Cada etapa só
// descreve o que já está implementado e validado — nada de roadmap futuro.
export const STEPS: Step[] = [
  {
    eyebrow: "Etapa 1 · Atendimento",
    icon: "chat",
    title: "Nenhum lead espera até segunda",
    body: "O primeiro contato chega às 23h de domingo? A IA responde na hora, pelo WhatsApp, com a mesma atenção de um vendedor treinado — todos os dias, o dia inteiro.",
    callout: "Atendimento 24/7 via WhatsApp. Resposta em segundos, sem depender de escala de plantão.",
  },
  {
    eyebrow: "Etapa 2 · Qualificação",
    icon: "score",
    title: "Seu vendedor só entra quando o terreno já está pronto",
    body: "A IA coleta interesse, forma de pagamento, dados de financiamento e troca — e calcula um score de 0 a 100 auditável, sem depender de achismo.",
    callout: "Lead scoring determinístico. Cada ponto do score tem uma razão registrada.",
  },
  {
    eyebrow: "Etapa 3 · Nutrição",
    icon: "loop",
    title: "Base parada também é oportunidade parada",
    body: "Lead que não respondeu recebe follow-up automático em 2h, 24h e 72h. Base inativa é reativada em até 3 tentativas, com mensagens que citam o veículo e o histórico — não um disparo genérico.",
    callout: "Follow-up e reativação contínuos, sem precisar de ninguém lembrando.",
  },
  {
    eyebrow: "Etapa 4 · Intervenção Humana",
    icon: "handoff",
    title: "O vendedor entra com o dossiê pronto",
    body: "Quando o lead está maduro pra negociar, a IA passa a conversa pra um humano com resumo, sinais de intenção e histórico completo — o vendedor não começa do zero.",
    callout: "Handoff com contexto. Preço final e fechamento sempre passam por aprovação humana.",
  },
  {
    eyebrow: "Etapa 5 · Funil & Métricas",
    icon: "chart",
    title: "Você enxerga a operação inteira, em tempo real",
    body: "Kanban por estágio, guardrail de margem no fechamento e métricas operacionais — quantos leads entraram, quantos a IA atendeu, quantos viraram venda.",
    callout: "Nenhuma venda fecha abaixo da margem mínima. Isso é bloqueado no sistema, não sugerido.",
  },
];
