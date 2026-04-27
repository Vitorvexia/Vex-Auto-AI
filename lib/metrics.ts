export type MetricsInput = {
  leads: Array<{ lead_status: string; created_at: string }>;
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
  avg_first_response_minutes: number;
  followup_response_rate: number;
  reactivation_response_rate: number;
};

export function calculateOperationalMetrics(input: MetricsInput): OperationalMetrics {
  const { leads, conversations, messages, followUpLogs, reactivationLogs } = input;

  const total_leads = leads.length;

  const negotiation_leads = leads.filter((l) => l.lead_status === "NEGOCIACAO").length;
  const closed_leads      = leads.filter((l) => l.lead_status === "FECHADO").length;
  const lost_leads        = leads.filter((l) => l.lead_status === "PERDIDO").length;

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
  const avg_first_response_minutes =
    responseTimes.length > 0
      ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10
      : 0;

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
  };
}
