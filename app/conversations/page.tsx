import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthError } from "@/lib/auth";
import { relativeTime } from "@/lib/format";

const LEAD_STATUS_LABELS: Record<string, string> = {
  NOVO: "Novo", ENGAJADO: "Engajado", INTERESSADO: "Interessado",
  QUENTE: "Quente", NEGOCIACAO: "Negociação", FECHADO: "Fechado", PERDIDO: "Perdido",
};
const HANDOFF_LABELS: Record<string, string> = { IA: "IA Ativa", HUMANO: "Vendedor" };
const CONV_STATUS_LABELS: Record<string, string> = {
  ATIVA: "Ativa", AGUARDANDO_HUMANO: "Aguardando vendedor", PAUSADA: "Pausada",
};

function isUrgent(ts: string | null): boolean {
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() > 30 * 60 * 1000;
}

function initialOf(nome: string | null | undefined): string {
  return (nome ?? "?").trim().charAt(0).toUpperCase() || "?";
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ConversationsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthError();

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select(
      `id, conversation_status, handoff_to, summary, ultima_mensagem_em,
       leads ( id, nome, phone_normalized, lead_status )`
    )
    .neq("conversation_status", "ENCERRADA")
    .order("ultima_mensagem_em", { ascending: false })
    .limit(50);

  if (error) {
    return (
      <main className="container">
        <div className="error">Erro ao carregar conversas: {error.message}</div>
      </main>
    );
  }

  const raw = conversations ?? [];

  const items = [...raw].sort((a: any, b: any) => {
    const aWaiting = a.conversation_status === "AGUARDANDO_HUMANO" ? 0 : 1;
    const bWaiting = b.conversation_status === "AGUARDANDO_HUMANO" ? 0 : 1;
    return aWaiting - bWaiting;
  });

  const waiting = items.filter((c: any) => c.conversation_status === "AGUARDANDO_HUMANO").length;

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">WhatsApp</h1>
          <div className="subtitle">
            {items.length} {items.length === 1 ? "conversa ativa" : "conversas ativas"}
            {waiting > 0 && (
              <span className="inbox-waiting-count">
                · {waiting} aguardando vendedor
              </span>
            )}
          </div>
        </div>
      </div>

      {waiting > 0 && (
        <div className="alert-item warn" style={{ marginBottom: "16px" }}>
          <span className="alert-icon">⏱</span>
          <span>
            <strong>{waiting} conversa{waiting > 1 ? "s" : ""} aguardando vendedor</strong> — handoff da IA pendente de resposta humana.
          </span>
        </div>
      )}

      <div className="conv-list">
        {items.length === 0 && (
          <div className="empty" style={{ padding: "48px 0" }}>
            Nenhuma conversa ativa
          </div>
        )}
        {items.map((c: any) => {
          const lead = Array.isArray(c.leads) ? c.leads[0] : c.leads;
          const urgent = isUrgent(c.ultima_mensagem_em) || c.conversation_status === "AGUARDANDO_HUMANO";
          const handoffClass = c.handoff_to === "HUMANO" ? "humano" : "ia";
          return (
            <Link key={c.id} href={`/conversations/${c.id}`} className={`conv-row${urgent ? " urgent" : ""}`}>
              <div className="conv-row-identity">
                <span className={`conv-row-avatar ${handoffClass}`}>{initialOf(lead?.nome)}</span>
                <div className="conv-row-main">
                  <div className="conv-row-name-line">
                    <span className="conv-lead-name">{lead?.nome ?? "Sem nome"}</span>
                    <span className={`conv-handoff-tag ${handoffClass}`}>
                      <span className="dot" />
                      {HANDOFF_LABELS[c.handoff_to] ?? c.handoff_to}
                    </span>
                  </div>
                  <span className="conv-lead-phone">{lead?.phone_normalized}</span>
                  {(c as any).summary && (
                    <span className="conv-preview">{(c as any).summary}</span>
                  )}
                </div>
              </div>
              <div className="conv-row-meta">
                <span className="pill" data-conv-status={c.conversation_status}>
                  {CONV_STATUS_LABELS[c.conversation_status] ?? c.conversation_status}
                </span>
                <span className="pill" data-status={lead?.lead_status}>
                  {LEAD_STATUS_LABELS[lead?.lead_status] ?? lead?.lead_status}
                </span>
                <span className={`conv-time${urgent ? " urgent" : ""}`}>
                  {c.ultima_mensagem_em ? relativeTime(c.ultima_mensagem_em) : "—"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
