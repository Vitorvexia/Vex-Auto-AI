import { supabaseAdmin } from "@/lib/supabase";
import { OPEN_CONVERSATION_STATUSES, type LeadStatus } from "@/types/domain";
import { KanbanColumn } from "@/app/components/KanbanColumn";
import { LeadCard } from "@/app/components/LeadCard";

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
  ultima_atividade: string;
};

export default async function LeadsPage() {
  const { data: leads, error } = await supabaseAdmin
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
    return {
      id: l.id,
      nome: l.nome,
      phone_normalized: l.phone_normalized,
      score: l.score,
      lead_status: l.lead_status as LeadStatus,
      conversation_id: openConv?.id,
      ultima_atividade: openConv?.ultima_mensagem_em ?? l.updated_at,
    };
  });

  enriched.sort(
    (a, b) =>
      new Date(b.ultima_atividade).getTime() -
      new Date(a.ultima_atividade).getTime()
  );

  const byStatus: Record<LeadStatus, Enriched[]> = {
    NOVO: [],
    ENGAJADO: [],
    INTERESSADO: [],
    QUENTE: [],
    NEGOCIACAO: [],
    FECHADO: [],
    PERDIDO: [],
  };
  enriched.forEach((l) => byStatus[l.lead_status].push(l));

  const now = Date.now();
  const staleLeads  = enriched.filter((l) => now - new Date(l.ultima_atividade).getTime() > 2 * 60 * 60 * 1000).length;
  const todayStart  = new Date(); todayStart.setHours(0, 0, 0, 0);
  const activeToday = enriched.filter((l) => new Date(l.ultima_atividade) >= todayStart).length;

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1>Pipeline de Leads</h1>
          <div className="subtitle">
            {enriched.length} {enriched.length === 1 ? "lead" : "leads"} em atendimento
          </div>
        </div>
      </div>

      <div className="leads-kpi-bar">
        <div className="leads-kpi-chip">
          <div className="leads-kpi-chip-value">{enriched.length}</div>
          <div className="leads-kpi-chip-label">No pipeline</div>
        </div>
        <div className="leads-kpi-chip hot">
          <div className="leads-kpi-chip-value">{byStatus.QUENTE.length}</div>
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
