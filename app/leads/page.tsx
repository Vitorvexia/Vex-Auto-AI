import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthError, getServerUserRole } from "@/lib/auth";
import { OPEN_CONVERSATION_STATUSES, type LeadStatus, type Lead } from "@/types/domain";
import { calculateLeadPriority, sortLeads, type PriorityTier } from "@/lib/lead-priority";
import { KanbanColumn } from "@/app/components/KanbanColumn";
import { LeadCard } from "@/app/components/LeadCard";
import { LeadImportCard } from "@/app/components/LeadImportCard";
import { getStoreAssignmentSummary } from "@/lib/seller-metrics";
import { resolveAssignedToFilter, isStaleLead } from "@/lib/lead-filter";
import { DelayedLeadsBadge } from "@/app/components/DelayedLeadsBadge";
import { KanbanDragProvider } from "@/lib/kanban-drag";
import { LeadsFunnel } from "@/app/components/LeadsFunnel";
import { calculateFunnelCounts, getFunnelStage, type FunnelStage } from "@/lib/lead-funnel";
import { countLeadsByStatus } from "@/lib/metrics";

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
  interesse: string | null;
};

const FUNNEL_STAGES: FunnelStage[] = ["frio", "morno", "quente"];

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: { assignedTo?: string; atrasado?: string; stage?: string };
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthError();

  const rawParam = searchParams?.assignedTo;
  const assignedToParam = resolveAssignedToFilter(rawParam, user.id);
  const atrasadoActive = searchParams?.atrasado === "1";
  const stageParam = FUNNEL_STAGES.includes(searchParams?.stage as FunnelStage)
    ? (searchParams?.stage as FunnelStage)
    : null;

  // Build leads query
  let leadsQuery = supabase
    .from("leads")
    .select(
      `id, nome, phone_normalized, score, lead_status, assigned_to, updated_at, contexto,
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

  const role = await getServerUserRole();
  const canReassign = role !== "vendedor";

  const enriched: Enriched[] = leads.map((l: { id: string; nome: string | null; phone_normalized: string; score: number; lead_status: string; assigned_to: string | null; updated_at: string; contexto?: Record<string, unknown> | null; conversations?: { id: string; ultima_mensagem_em: string | null; conversation_status: string | null }[] }) => {
    const interesseRaw = l.contexto?.interesse;
    const interesse = typeof interesseRaw === "string" && interesseRaw.trim() ? interesseRaw.trim() : null;
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
      interesse,
    };
  });

  const sorted = sortLeads(enriched);

  // staleLeads é sempre calculado sobre o escopo de vendedor (sorted), não
  // sobre o resultado já filtrado por "atrasado"/"stage" — é o contador do
  // badge, precisa refletir o total disponível pra clicar, não o que já
  // tá visível.
  const staleLeads = sorted.filter((l) => isStaleLead(l.ultima_atividade)).length;
  let visible = atrasadoActive ? sorted.filter((l) => isStaleLead(l.ultima_atividade)) : sorted;
  if (stageParam) {
    visible = visible.filter((l) => getFunnelStage(l.lead_status) === stageParam);
  }

  const byStatus: Record<LeadStatus, Enriched[]> = {
    NOVO: [],
    ENGAJADO: [],
    INTERESSADO: [],
    QUENTE: [],
    NEGOCIACAO: [],
    FECHADO: [],
    PERDIDO: [],
  };
  visible.forEach((l) => byStatus[l.lead_status].push(l));

  // Extract active conversation_status per lead (assignment summary abaixo)
  const leadsForMetrics: Lead[] = (allLeadsResult.data ?? []).map((l) => {
    const convs = (l as { conversations?: { conversation_status: string | null }[] }).conversations ?? [];
    const activeConv = convs.find((c) => (OPEN_CONVERSATION_STATUSES as string[]).includes(c.conversation_status ?? ""));
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

  const assignmentSummary = getStoreAssignmentSummary(leadsForMetrics);

  // "Filtrado" = mesmo escopo de vendedor já aplicado em `sorted` (pill
  // Todos/Sem responsável/Vendedor) — não inclui "atrasado"/"stage", que
  // são recortes de exibição do kanban, ortogonais ao funil em si (senão
  // clicar numa camada esvaziaria as outras barras do próprio funil).
  // "Total" = leadsForMetrics, já buscado sem filtro de vendedor.
  const funnelFiltered = calculateFunnelCounts(sorted.map((l) => l.lead_status));
  const funnelTotal = calculateFunnelCounts(leadsForMetrics.map((l) => l.lead_status));
  const funnelFilteredStatusCounts = countLeadsByStatus(sorted);
  const funnelTotalStatusCounts = countLeadsByStatus(leadsForMetrics);

  const activeVendedor = vendedores.find((v) => v.id === assignedToParam);
  // Preserva o filtro de vendedor ao ligar/desligar "atrasado" na URL.
  const vendedorQuery = rawParam ? `assignedTo=${rawParam}` : "";
  const atrasadoHref = [vendedorQuery, "atrasado=1"].filter(Boolean).join("&");
  const clearAtrasadoHref = rawParam ? `/leads?assignedTo=${rawParam}` : "/leads";

  // Params atuais (sem "stage") pro funil preservar assignedTo/atrasado ao
  // clicar numa camada — o próprio componente adiciona/remove "stage".
  const funnelCurrentParams: Record<string, string> = {};
  if (rawParam) funnelCurrentParams.assignedTo = rawParam;
  if (atrasadoActive) funnelCurrentParams.atrasado = "1";

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pipeline de Leads</h1>
          <div className="subtitle">
            {visible.length} {visible.length === 1 ? "lead" : "leads"} em atendimento
          </div>
        </div>
        <LeadImportCard />
      </div>

      <div className="vendor-filter">
        <a href="/leads?assignedTo=all" className={!assignedToParam ? "active" : ""}>Todos</a>
        <a href="/leads?assignedTo=none" className={assignedToParam === "none" ? "active" : ""}>
          Sem responsável
        </a>
        <a
          href={atrasadoActive ? clearAtrasadoHref : `/leads?${atrasadoHref}`}
          className={atrasadoActive ? "active vendor-filter-clear" : ""}
        >
          Atrasados{atrasadoActive ? " ✕" : ""}
        </a>
        <details className="vendor-filter-dropdown">
          <summary className={activeVendedor ? "active" : ""}>
            {activeVendedor ? `Vendedores: ${activeVendedor.nome}` : "Vendedores"}
          </summary>
          <div className="vendor-filter-dropdown-list">
            {vendedores.map(v => (
              <a
                key={v.id}
                href={`/leads?assignedTo=${v.id}`}
                className={assignedToParam === v.id ? "active" : ""}
              >
                {v.nome}
              </a>
            ))}
          </div>
        </details>
      </div>

      {/* Fix 4: always visible — shows "0 com responsável · N sem responsável" even before any assignment */}
      <p className="assignment-summary">
        {assignmentSummary.leads_with_owner} com responsável ·{" "}
        {assignmentSummary.leads_without_owner} sem responsável
      </p>

      <KanbanDragProvider>
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
                      canReassign={canReassign}
                    />
                  ))
                )}
              </KanbanColumn>
            );
          })}
        </div>
      </KanbanDragProvider>

      <div className="section-card leads-status-chart">
        <LeadsFunnel
          filtered={funnelFiltered}
          total={funnelTotal}
          filteredStatusCounts={funnelFilteredStatusCounts}
          totalStatusCounts={funnelTotalStatusCounts}
          enableStageFilter
          activeStage={stageParam}
          currentParams={funnelCurrentParams}
        />
      </div>

      <DelayedLeadsBadge count={staleLeads} href={`/leads?${atrasadoHref}`} />
    </main>
  );
}
