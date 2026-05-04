import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthError } from "@/lib/auth";
import { OPEN_CONVERSATION_STATUSES, type LeadStatus } from "@/types/domain";
import { calculateLeadPriority, sortLeads, type PriorityTier } from "@/lib/lead-priority";
import { KanbanColumn } from "@/app/components/KanbanColumn";
import { LeadCard } from "@/app/components/LeadCard";
import { LeadImportCard } from "@/app/components/LeadImportCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const COLUMNS: LeadStatus[] = [
  "NOVO",
  "ENGAJADO",
  "INTERESSADO",
  "QUENTE",
  "NEGOCIACAO",
  "FECHADO",
  "PERDIDO",
];

type Enriched = {
  id: string;
  nome: string | null;
  phone_normalized: string;
  score: number;
  lead_status: LeadStatus;
  conversation_id?: string;
  conversation_status?: string | null;
  ultima_atividade: string;
  priority: PriorityTier;
  priority_label: string;
  recommended_action: string;
};

export default async function LeadsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthError();

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      `id, nome, phone_normalized, score, lead_status, updated_at,
       conversations ( id, ultima_mensagem_em, conversation_status )`
    )
    .in("lead_status", COLUMNS);

  if (error) {
    return (
      <main className="container">
        <div className="error">Erro ao carregar leads: {error.message}</div>
      </main>
    );
  }

  const enriched: Enriched[] = (leads ?? []).map((l: any) => {
    const openConv = (l.conversations ?? []).find((c: any) =>
      OPEN_CONVERSATION_STATUSES.includes(c.conversation_status)
    );
    const ultima_atividade =
      openConv?.ultima_mensagem_em ?? l.updated_at ?? new Date(0).toISOString();
    const { priority, priority_label, recommended_action } = calculateLeadPriority({
      score: l.score,
      conversationStatus: openConv?.conversation_status,
      leadStatus: l.lead_status as LeadStatus,
      ultimaAtividade: ultima_atividade,
    });
    return {
      id: l.id,
      nome: l.nome,
      phone_normalized: l.phone_normalized,
      score: l.score ?? 0,
      lead_status: l.lead_status as LeadStatus,
      conversation_id: openConv?.id,
      conversation_status: openConv?.conversation_status,
      ultima_atividade,
      priority,
      priority_label,
      recommended_action,
    };
  });

  const sorted = sortLeads(enriched);

  const byStatus: Record<LeadStatus, Enriched[]> = {
    NOVO: [],
    ENGAJADO: [],
    INTERESSADO: [],
    QUENTE: [],
    NEGOCIACAO: [],
    FECHADO: [],
    PERDIDO: [],
  };
  sorted.forEach((l) => byStatus[l.lead_status].push(l));

  const now = Date.now();
  const staleLeads  = sorted.filter((l) => now - new Date(l.ultima_atividade).getTime() > 2 * 60 * 60 * 1000).length;
  const todayStart  = new Date(); todayStart.setHours(0, 0, 0, 0);
  const activeToday = sorted.filter((l) => new Date(l.ultima_atividade) >= todayStart).length;
  const hotCount    = sorted.filter((l) => l.priority === "hot").length;

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1>Pipeline de Leads</h1>
          <div className="subtitle">
            {sorted.length} {sorted.length === 1 ? "lead" : "leads"} em atendimento
          </div>
        </div>
      </div>

      <LeadImportCard />

      <div className="leads-kpi-bar">
        <div className="leads-kpi-chip">
          <div className="leads-kpi-chip-value">{sorted.length}</div>
          <div className="leads-kpi-chip-label">No pipeline</div>
        </div>
        <div className="leads-kpi-chip hot">
          <div className="leads-kpi-chip-value">{hotCount}</div>
          <div className="leads-kpi-chip-label">Quentes</div>
        </div>
        <div className="leads-kpi-chip nego">
          <div className="leads-kpi-chip-value">{byStatus.NEGOCIACAO.length}</div>
          <div className="leads-kpi-chip-label">Em negociação</div>
        </div>
        <div className="leads-kpi-chip">
          <div className="leads-kpi-chip-value">{activeToday}</div>
          <div className="leads-kpi-chip-label">Ativos hoje</div>
        </div>
        {staleLeads > 0 && (
          <div className="leads-kpi-chip alert">
            <span style={{ fontSize: "15px", lineHeight: 1, flexShrink: 0 }}>⚠</span>
            <div>
              <div className="leads-kpi-chip-value">{staleLeads}</div>
              <div className="leads-kpi-chip-label">Sem resposta &gt;2h</div>
            </div>
          </div>
        )}
      </div>

      <div className="kanban">
        {COLUMNS.map((status) => {
          const items = byStatus[status];
          return (
            <KanbanColumn key={status} status={status} count={items.length}>
              {items.length === 0 ? (
                <div className="empty">Nenhum lead</div>
              ) : (
                items.map((l) => <LeadCard key={l.id} {...l} />)
              )}
            </KanbanColumn>
          );
        })}
      </div>
    </main>
  );
}
