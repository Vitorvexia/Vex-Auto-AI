export type MetricsInput = {
  leads: Array<{ lead_status: string; created_at: string; valor_final?: number | null }>;
  conversations: Array<{ id: string; handoff_to: string; lead_id: string }>;
  messages: Array<{
    conversation_id: string;
    direcao: string;
    autor: string;
    received_at: string;
    mensagem?: string | null;
  }>;
  followUpLogs: Array<{
    lead_id: string;
    status: string;
    logged_at: string;
    conversation_id: string;
  }>;
  reactivationLogs: Array<{
    lead_id: string;
    status: string;
    logged_at: string;
    conversation_id: string;
  }>;
};

export type OperationalMetrics = {
  total_leads: number;
  ai_handled_leads: number;
  human_handoff_count: number;
  followups_sent: number;
  reactivations_sent: number;
  negotiation_leads: number;
  closed_leads: number;
  lost_leads: number;
  avg_first_response_minutes: number | null;
  followup_response_rate: number;
  reactivation_response_rate: number;
  revenue_generated: number;
};

// UTC calendar day — servidor roda em UTC (Vercel), timestamps são ISO UTC;
// comparar por dia local do processo seria ambíguo entre ambientes.
export function countLeadsToday(
  leads: Array<{ created_at: string }>,
  now: Date = new Date()
): number {
  const todayKey = now.toISOString().slice(0, 10);
  return leads.filter((l) => l.created_at.slice(0, 10) === todayKey).length;
}

export type DailyTrendPoint = {
  date: string;
  novos: number;
  followups: number;
  reativacoes: number;
};

// UTC calendar day — mesmo racional de countLeadsToday (servidor em UTC,
// timestamps ISO UTC; dia local do processo seria ambíguo entre ambientes).
export function buildDailyTrend(
  leads: Array<{ created_at: string }>,
  followUpLogs: Array<{ logged_at: string; status: string }>,
  reactivationLogs: Array<{ logged_at: string; status: string }>,
  days: number,
  now: Date = new Date()
): DailyTrendPoint[] {
  const points: DailyTrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    points.push({ date: d.toISOString().slice(0, 10), novos: 0, followups: 0, reativacoes: 0 });
  }

  const byDate = new Map(points.map((p) => [p.date, p]));

  for (const l of leads) {
    const p = byDate.get(l.created_at.slice(0, 10));
    if (p) p.novos++;
  }
  for (const f of followUpLogs) {
    if (f.status !== "sent") continue;
    const p = byDate.get(f.logged_at.slice(0, 10));
    if (p) p.followups++;
  }
  for (const r of reactivationLogs) {
    if (r.status !== "sent") continue;
    const p = byDate.get(r.logged_at.slice(0, 10));
    if (p) p.reativacoes++;
  }

  return points;
}

export type LeadStatusCounts = {
  NOVO: number;
  ENGAJADO: number;
  INTERESSADO: number;
  QUENTE: number;
  NEGOCIACAO: number;
  FECHADO: number;
  PERDIDO: number;
};

export function countLeadsByStatus(
  leads: Array<{ lead_status: string }>
): LeadStatusCounts {
  const counts: LeadStatusCounts = {
    NOVO: 0,
    ENGAJADO: 0,
    INTERESSADO: 0,
    QUENTE: 0,
    NEGOCIACAO: 0,
    FECHADO: 0,
    PERDIDO: 0,
  };
  for (const l of leads) {
    if (l.lead_status in counts) counts[l.lead_status as keyof LeadStatusCounts]++;
  }
  return counts;
}

export function calculateOperationalMetrics(input: MetricsInput): OperationalMetrics {
  const { leads, conversations, messages, followUpLogs, reactivationLogs } = input;

  const total_leads = leads.length;

  const negotiation_leads = leads.filter((l) => l.lead_status === "NEGOCIACAO").length;
  const closed_leads      = leads.filter((l) => l.lead_status === "FECHADO").length;
  const lost_leads        = leads.filter((l) => l.lead_status === "PERDIDO").length;

  const revenue_generated = leads
    .filter((l) => l.lead_status === "FECHADO")
    .reduce((sum, l) => sum + (l.valor_final ?? 0), 0);

  // Count historical handoffs via system message — handoff_to is current state only
  const human_handoff_count = messages.filter(
    (m) => m.autor === "sistema" && m.mensagem === "Conversa assumida por humano"
  ).length;

  // AI-handled: conversation under IA with no human takeover ever
  const handoffConvIds = new Set(
    messages
      .filter((m) => m.autor === "sistema" && m.mensagem === "Conversa assumida por humano")
      .map((m) => m.conversation_id)
  );
  const aiLeadIds = new Set(
    conversations
      .filter((c) => c.handoff_to === "IA" && !handoffConvIds.has(c.id))
      .map((c) => c.lead_id)
  );
  const ai_handled_leads = aiLeadIds.size;

  const followups_sent    = followUpLogs.filter((f) => f.status === "sent").length;
  const reactivations_sent = reactivationLogs.filter((r) => r.status === "sent").length;

  // avg first response: time from first lead message to first IA reply per conversation
  const msgsByConv = new Map<string, typeof messages>();
  for (const m of messages) {
    if (!msgsByConv.has(m.conversation_id)) msgsByConv.set(m.conversation_id, []);
    msgsByConv.get(m.conversation_id)!.push(m);
  }

  const responseTimes: number[] = [];
  for (const msgs of msgsByConv.values()) {
    const firstIn = msgs
      .filter((m) => m.direcao === "entrada")
      .sort((a, b) => +new Date(a.received_at) - +new Date(b.received_at))[0];
    const firstOut = msgs
      .filter((m) => m.direcao === "saida" && m.autor === "ia")
      .sort((a, b) => +new Date(a.received_at) - +new Date(b.received_at))[0];
    if (firstIn && firstOut) {
      const diff = +new Date(firstOut.received_at) - +new Date(firstIn.received_at);
      if (diff > 0) responseTimes.push(diff / 60000);
    }
  }
  // null = sem dado (nenhuma conversa com par entrada+resposta IA no período);
  // distinto de 0, que é resposta real arredondada pra ~0min — conflar os dois
  // fazia o card de /dashboard mostrar "—" (sem dado) pra uma IA respondendo rápido
  const avg_first_response_minutes =
    responseTimes.length > 0
      ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10
      : null;

  // followup response rate: % of sent followups where lead replied afterwards
  const sentFollowups = followUpLogs.filter((f) => f.status === "sent");
  let followupResponded = 0;
  for (const f of sentFollowups) {
    const replied = messages.some(
      (m) =>
        m.conversation_id === f.conversation_id &&
        m.direcao === "entrada" &&
        +new Date(m.received_at) > +new Date(f.logged_at)
    );
    if (replied) followupResponded++;
  }
  const followup_response_rate =
    sentFollowups.length > 0 ? followupResponded / sentFollowups.length : 0;

  // reactivation response rate: same pattern
  const sentReactivations = reactivationLogs.filter((r) => r.status === "sent");
  let reactivationResponded = 0;
  for (const r of sentReactivations) {
    const replied = messages.some(
      (m) =>
        m.conversation_id === r.conversation_id &&
        m.direcao === "entrada" &&
        +new Date(m.received_at) > +new Date(r.logged_at)
    );
    if (replied) reactivationResponded++;
  }
  const reactivation_response_rate =
    sentReactivations.length > 0 ? reactivationResponded / sentReactivations.length : 0;

  return {
    total_leads,
    ai_handled_leads,
    human_handoff_count,
    followups_sent,
    reactivations_sent,
    negotiation_leads,
    closed_leads,
    lost_leads,
    avg_first_response_minutes,
    followup_response_rate,
    reactivation_response_rate,
    revenue_generated,
  };
}

export type ReactivationRevenue = { converted_leads: number; revenue: number };

// Faturamento recuperado de leads que estavam inativos, foram reativados
// pela IA e fecharam — a prova mais direta de ROI da Mina de Ouro.
export function calculateReactivationRevenue(
  leads: Array<{ id: string; valor_final?: number | null }>,
  reactivationLogs: Array<{ lead_id: string; converted_at: string | null }>
): ReactivationRevenue {
  const convertedLeadIds = new Set(
    reactivationLogs.filter((r) => r.converted_at !== null).map((r) => r.lead_id)
  );
  const leadsById = new Map(leads.map((l) => [l.id, l]));
  let revenue = 0;
  for (const leadId of convertedLeadIds) {
    revenue += leadsById.get(leadId)?.valor_final ?? 0;
  }
  return { converted_leads: convertedLeadIds.size, revenue };
}
