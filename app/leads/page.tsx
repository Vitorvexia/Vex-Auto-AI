import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthError } from "@/lib/auth";
import { OPEN_CONVERSATION_STATUSES, type LeadStatus, type Lead } from "@/types/domain";
import { calculateLeadPriority, sortLeads, type PriorityTier } from "@/lib/lead-priority";
import { KanbanColumn } from "@/app/components/KanbanColumn";
import { LeadCard } from "@/app/components/LeadCard";
import { LeadImportCard } from "@/app/components/LeadImportCard";
import { calculateSellerMetrics, getStoreAssignmentSummary } from "@/lib/seller-metrics";

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
  assigned_to: string | null;
  conversation_id?: string;
  conversation_status?: string | null;
  ultima_atividade: string;
  priority: PriorityTier;
  priority_label: string;
  recommended_action: string;
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: { assignedTo?: string };
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthError();

  // Fix 6: validate assignedToParam — reject malformed UUIDs silently (treat as no filter)
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const rawParam = searchParams?.assignedTo;
  const assignedToParam =
    rawParam === "none" ? "none" :
    rawParam && UUID_REGEX.test(rawParam) ? rawParam :
    undefined;

  // Build leads query
  let leadsQuery = supabase
    .from("leads")
    .select(
      `id, nome, phone_normalized, score, lead_status, assigned_to, updated_at,
       conversations ( id, ultima_mensagem_em, conversation_status )`
    )
    .in("lead_status", COLUMNS);

  if (assignedToParam === "none") {
    leadsQuery = leadsQuery.is("assigned_to", null);
  } else if (assignedToParam) {
    leadsQuery = leadsQuery.eq("assigned_to", assignedToParam);
  }

  // Parallel fetch
  const [leadsResult, usersResult, allLeadsResult] = await Promise.all([
    leadsQuery, // filtered (for kanban display)
    supabase.from("users").select("id, nome").order("nome"),
    supabase
      .from("leads")
      .select("id, score, lead_status, assigned_to, updated_at, nome, phone_normalized, conversations(conversation_status)")
      .in("lead_status", COLUMNS), // all leads for metrics (includes conversation_status for hot-via-handoff)
  ]);

  if (leadsResult.error) {
    return (
      <main className="container">
        <div className="error">Erro ao carregar leads: {leadsResult.error.message}</div>
      </main>
    );
  }

  // silently degrade vendors if users fetch fails (non-critical)
  if (usersResult.error) {
    console.error("Falha ao carregar vendedores:", usersResult.error.message);
  }

  // Fix 3: explicitly handle allLeadsResult error — metrics degrade but don't crash
  if (allLeadsResult.error) {
    console.error("Falha ao carregar dados para métricas:", allLeadsResult.error.message);
  }

  const leads = leadsResult.data ?? [];
  const vendedores = (usersResult.data ?? []) as { id: string; nome: string }[];

  const enriched: Enriched[] = leads.map((l: { id: string; nome: string | null; phone_normalized: string; score: number; lead_status: string; assigned_to: string | null; updated_at: string; conversations?: { id: string; ultima_mensagem_em: string | null; conversation_status: string | null }[] }) => {
    const openConv = (l.conversations ?? []).find((c) =>
      (OPEN_CONVERSATION_STATUSES as string[]).includes(c.conversation_status ?? "")
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
      assigned_to: l.assigned_to ?? null,
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

  // Seller metrics (computed from ALL leads in the store, not filtered)
  // Extract active conversation_status per lead for hot-via-handoff detection (same rule as KPI bar)
  const leadsForMetrics: Lead[] = (allLeadsResult.data ?? []).map((l) => {
    const convs = (l as { conversations?: { conversation_status: string | null }[] }).conversations ?? [];
    const activeConv = convs.find((c) => c.conversation_status !== "ENCERRADA" && c.conversation_status !== null);
    return {
      id: l.id,
      nome: l.nome,
      phone_normalized: l.phone_normalized,
      score: l.score,
      lead_status: l.lead_status as LeadStatus,
      assigned_to: l.assigned_to ?? null,
      conversation_status: activeConv?.conversation_status ?? null,
      updated_at: l.updated_at,
    };
  });

  const sellerMetrics = calculateSellerMetrics(leadsForMetrics, vendedores);
  const assignmentSummary = getStoreAssignmentSummary(leadsForMetrics);

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

      <div className="vendor-filter">
        <a href="/leads" className={!assignedToParam ? "active" : ""}>Todos</a>
        {vendedores.map(v => (
          <a
            key={v.id}
            href={`/leads?assignedTo=${v.id}`}
            className={assignedToParam === v.id ? "active" : ""}
          >
            {v.nome}
          </a>
        ))}
        <a href="/leads?assignedTo=none" className={assignedToParam === "none" ? "active" : ""}>
          Sem responsável
        </a>
      </div>

      {sellerMetrics.length > 0 && (
        <div className="seller-metrics-table">
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Leads</th>
                <th>Quentes</th>
                <th>Fechados</th>
              </tr>
            </thead>
            <tbody>
              {sellerMetrics.map((m) => (
                <tr key={m.userId}>
                  <td>{m.nome}</td>
                  <td>{m.total_leads}</td>
                  <td>{m.hot_leads}</td>
                  <td>{m.closed_leads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Fix 4: always visible — shows "0 com responsável · N sem responsável" even before any assignment */}
      <p className="assignment-summary">
        {assignmentSummary.leads_with_owner} com responsável ·{" "}
        {assignmentSummary.leads_without_owner} sem responsável
      </p>

      <div className="kanban">
        {COLUMNS.map((status) => {
          const items = byStatus[status];
          return (
            <KanbanColumn key={status} status={status} count={items.length}>
              {items.length === 0 ? (
                <div className="empty">Nenhum lead</div>
              ) : (
                items.map((l) => (
                  <LeadCard
                    key={l.id}
                    {...l}
                    assignedTo={l.assigned_to}
                    vendedores={vendedores}
                  />
                ))
              )}
            </KanbanColumn>
          );
        })}
      </div>
    </main>
  );
}
