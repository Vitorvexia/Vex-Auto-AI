import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthError } from "@/lib/auth";
import { scoreClass, relativeTime } from "@/lib/format";
import type { Autor, ConversationStatus, LeadStatus } from "@/types/domain";
import { MessageBubble } from "@/app/components/MessageBubble";
import { buildLeadDossier } from "@/lib/lead-dossier";
import { DossieCard } from "@/app/components/DossieCard";
import { FinancingSimulator } from "@/app/components/FinancingSimulator";
import {
  assignConversationToHuman,
  returnConversationToAI,
  updateLeadStatus,
} from "@/lib/actions";
import { LEAD_TRANSITIONS } from "@/lib/status";

const LEAD_STATUS_LABELS: Record<string, string> = {
  NOVO: "Novo", ENGAJADO: "Engajado", INTERESSADO: "Interessado",
  QUENTE: "Quente", NEGOCIACAO: "Negociação", FECHADO: "Fechado", PERDIDO: "Perdido",
};
const CONV_STATUS_LABELS: Record<string, string> = {
  ATIVA: "Ativa", AGUARDANDO_HUMANO: "Aguardando", PAUSADA: "Pausada", ENCERRADA: "Encerrada",
};
const HANDOFF_LABELS: Record<string, string> = { IA: "IA", HUMANO: "Vendedor" };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ConversationPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthError();

  const { data: conv, error } = await supabase
    .from("conversations")
    .select(
      `id, store_id, conversation_status, handoff_to, summary, iniciada_em, ultima_mensagem_em,
       leads ( id, nome, phone_normalized, lead_status, score ),
       messages ( id, direcao, autor, mensagem, created_at )`
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return (
      <main className="container">
        <div className="error">Erro ao carregar conversa: {error.message}</div>
      </main>
    );
  }

  if (!conv) notFound();

  const lead = Array.isArray(conv.leads) ? conv.leads[0] : (conv.leads as any);

  const [
    { data: sidebarConvs },
    { data: scoreEventsRaw },
    { data: followUpLogsRaw },
    { data: reactivationLogsRaw },
    { data: lastSimulationData },
  ] = await Promise.all([
    supabase
      .from("conversations")
      .select(`id, conversation_status, handoff_to, ultima_mensagem_em, leads ( nome )`)
      .neq("conversation_status", "ENCERRADA")
      .order("ultima_mensagem_em", { ascending: false })
      .limit(30),
    supabase
      .from("lead_score_events")
      .select("delta, reasons, created_at")
      .eq("lead_id", lead?.id ?? "")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("follow_up_logs")
      .select("attempt_number, status")
      .eq("lead_id", lead?.id ?? "")
      .order("attempt_number", { ascending: false })
      .limit(10),
    supabase
      .from("reactivation_logs")
      .select("attempt_number, status")
      .eq("lead_id", lead?.id ?? "")
      .order("attempt_number", { ascending: false })
      .limit(10),
    supabase
      .from("financing_simulations")
      .select("id, vehicle_price, entry_value, financed_amount, term_months, monthly_rate, monthly_payment, total_amount, provider, created_at")
      .eq("conversation_id", params.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const dossier = buildLeadDossier({
    lead: {
      id: lead?.id ?? "",
      nome: lead?.nome ?? null,
      lead_status: (lead?.lead_status ?? "NOVO") as LeadStatus,
      score: lead?.score ?? 0,
    },
    conversation: {
      summary: conv.summary ?? null,
      ultima_mensagem_em: conv.ultima_mensagem_em ?? new Date().toISOString(),
      conversation_status: conv.conversation_status as ConversationStatus,
    },
    scoreEvents: (scoreEventsRaw ?? []) as Array<{ delta: number; reasons: string[]; created_at: string }>,
    followUpLogs: (followUpLogsRaw ?? []) as Array<{ attempt_number: number; status: "sent" | "failed" }>,
    reactivationLogs: (reactivationLogsRaw ?? []) as Array<{ attempt_number: number; status: "sent" | "failed" }>,
  });

  const sidebar = [...(sidebarConvs ?? [])].sort((a: any, b: any) =>
    a.conversation_status === "AGUARDANDO_HUMANO" ? -1
    : b.conversation_status === "AGUARDANDO_HUMANO" ? 1 : 0
  );

  const messages = (conv.messages ?? []).slice().sort(
    (a: any, b: any) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const sc = scoreClass(lead?.score ?? 0);

  return (
    <main className="container">
      <Link href="/conversations" className="back-link">
        ← WhatsApp
      </Link>

      <div className="conv-layout">
        <aside className="conv-sidebar">
          <div className="conv-sidebar-head">Conversas Ativas · {sidebar.length}</div>
          {sidebar.map((s: any) => {
            const sLead   = Array.isArray(s.leads) ? s.leads[0] : s.leads;
            const isActive  = s.id === params.id;
            const isWaiting = !isActive && s.conversation_status === "AGUARDANDO_HUMANO";
            return (
              <Link
                key={s.id}
                href={`/conversations/${s.id}`}
                className={`conv-sidebar-item${isActive ? " active" : ""}${isWaiting ? " waiting" : ""}`}
              >
                <span className="conv-sidebar-name">{sLead?.nome ?? "Sem nome"}</span>
                <div className="conv-sidebar-meta">
                  <span className={`conv-handoff-tag ${s.handoff_to === "HUMANO" ? "humano" : "ia"}`}>
                    <span className="dot" />
                    {s.handoff_to === "HUMANO" ? "Vendedor" : "IA"}
                  </span>
                  <span className="conv-sidebar-time">
                    {s.ultima_mensagem_em ? relativeTime(s.ultima_mensagem_em) : "—"}
                  </span>
                </div>
              </Link>
            );
          })}
        </aside>

        <div className="conv-main">

      <div className="inbox-header">
        <div className="inbox-lead-info">
          <div className="inbox-lead-name">{lead?.nome ?? "Sem nome"}</div>
          <div className="inbox-lead-meta">
            <span className="inbox-lead-phone">{lead?.phone_normalized}</span>
            <span className="pill" data-status={lead?.lead_status}>
              {LEAD_STATUS_LABELS[lead?.lead_status] ?? lead?.lead_status}
            </span>
            <span className={`score-badge ${sc}`}>
              score {lead?.score}
            </span>
          </div>
        </div>

        <div className="inbox-status-row">
          <span className="pill" data-conv-status={conv.conversation_status}>
            {CONV_STATUS_LABELS[conv.conversation_status] ?? conv.conversation_status}
          </span>
          <span className="pill" data-handoff={conv.handoff_to}>
            {HANDOFF_LABELS[conv.handoff_to] ?? conv.handoff_to}
          </span>
        </div>
      </div>

      <div className="conv-actions">
        {conv.handoff_to === "IA" ? (
          <form action={assignConversationToHuman.bind(null, conv.id)}>
            <button type="submit" className="btn-assume">Assumir conversa</button>
          </form>
        ) : (
          <form action={returnConversationToAI.bind(null, conv.id)}>
            <button type="submit" className="btn-return">Voltar para IA</button>
          </form>
        )}

        <form action={updateLeadStatus.bind(null, lead?.id ?? "", conv.id)}>
          <select name="lead_status" defaultValue={lead?.lead_status}>
            {(LEAD_TRANSITIONS[lead?.lead_status as LeadStatus] ?? []).map((s) => (
              <option key={s} value={s}>{LEAD_STATUS_LABELS[s] ?? s}</option>
            ))}
          </select>
          <button type="submit">›</button>
        </form>
      </div>

      <DossieCard dossier={dossier} score={lead?.score} />

      <FinancingSimulator
        leadId={lead?.id ?? ""}
        conversationId={conv.id}
        lastSimulation={lastSimulationData ?? null}
      />

      <div className="chat">
        {messages.length === 0 && (
          <div className="empty">Nenhuma mensagem ainda</div>
        )}
        {messages.map((m: any) => (
          <MessageBubble
            key={m.id}
            id={m.id}
            autor={m.autor as Autor}
            mensagem={m.mensagem}
            created_at={m.created_at}
          />
        ))}
      </div>
        </div>{/* conv-main */}
      </div>{/* conv-layout */}
    </main>
  );
}
