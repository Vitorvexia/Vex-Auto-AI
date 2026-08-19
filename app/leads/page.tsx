import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthError, getServerUserRole } from "@/lib/auth";
import { OPEN_CONVERSATION_STATUSES, type LeadStatus, type Lead } from "@/types/domain";
import { calculateLeadPriority, sortLeads, type PriorityTier } from "@/lib/lead-priority";
import { KanbanColumn } from "@/app/components/KanbanColumn";
import { LeadCard } from "@/app/components/LeadCard";
import { LeadImportCard } from "@/app/components/LeadImportCard";
import { getStoreAssignmentSummary } from "@/lib/seller-metrics";
import { resolveAssignedToFilter, isStaleLead } from "@/lib/lead-filter";
import { BarChart } from "@/app/components/BarChart";
import { DelayedLeadsBadge } from "@/app/components/DelayedLeadsBadge";
import { KanbanDragProvider } from "@/lib/kanban-drag";

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

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: { assignedTo?: string; atrasado?: string };
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthError();

  const rawParam = searchParams?.assignedTo;
  const assignedToParam = resolveAssignedToFilter(rawParam, user.id);
  const atrasadoActive = searchParams?.atrasado === "1";

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
  // sobre o resultado já filtrado por "atrasado" — é o contador do badge,
  // precisa refletir o total disponível pra clicar, não o que já tá visível.
  const staleLeads = sorted.filter((l) => isStaleLead(l.ultima_atividade)).length;
  const visible = atrasadoActive ? sorted.filter((l) => isStaleLead(l.ultima_atividade)) : sorted;

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

  const statusBars = [
    { label: "Novo", value: byStatus.NOVO.length, color: "var(--status-novo)" },
    { label: "Engajado", value: byStatus.ENGAJADO.length, color: "var(--status-engajado)" },
    { label: "Interessado", value: byStatus.INTERESSADO.length, color: "var(--status-interessado)" },
    { label: "Quente", value: byStatus.QUENTE.length, color: "var(--status-quente)" },
    { label: "Negociação", value: byStatus.NEGOCIACAO.length, color: "var(--status-negociacao)" },
    { label: "Fechado", value: byStatus.FECHADO.length, color: "var(--status-fechado)" },
    { label: "Perdido", value: byStatus.PERDIDO.length, color: "var(--status-perdido)" },
  ];

  const activeVendedor = vendedores.find((v) => v.id === assignedToParam);
  // Preserva o filtro de vendedor ao ligar/desligar "atrasado" na URL.
  const vendedorQuery = rawParam ? `assignedTo=${rawParam}` : "";
  const atrasadoHref = [vendedorQuery, "atrasado=1"].filter(Boolean).join("&");
  const clearAtrasadoHref = rawParam ? `/leads?assignedTo=${rawParam}` : "/leads";

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
        <div className="section-card-head">
          <span className="section-card-title">Leads por Status</span>
        </div>
        <div className="section-card-body">
          <BarChart bars={statusBars} />
        </div>
      </div>

      <DelayedLeadsBadge count={staleLeads} href={`/leads?${atrasadoHref}`} />
    </main>
  );
}
