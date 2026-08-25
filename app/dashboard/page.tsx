import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthError } from "@/lib/auth";
import { countLeadsByStatus } from "@/lib/metrics";
import { calculateSellerMetrics } from "@/lib/seller-metrics";
import { LeadsFunnel, type FunnelPeriod } from "@/app/components/LeadsFunnel";
import { calculateFunnelCounts } from "@/lib/lead-funnel";
import { SetupWidget } from "@/app/components/SetupWidget";
import { AlertsWidget } from "@/app/components/AlertsWidget";
import { DashboardPeriodCards, type DashboardLead } from "@/app/components/DashboardPeriodCards";
import { countStaleLeads, pickConversationActivity } from "@/lib/lead-priority";
import { marginPercent } from "@/lib/vehicle-margin";
import { formatCurrency } from "@/lib/format";
import type { LeadStatus, Lead } from "@/types/domain";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const WINDOW_DAYS = 30;
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24h — alerta de /dashboard (distinto do chip de 2h em /leads)
const LOW_MARGIN_THRESHOLD = 5; // % — mesmo limiar do texto original do mock

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// Períodos do Funil de Temperatura — seletor próprio (7/30/90 dias/Todo
// período), independente do seletor global do Painel por Período.
// buildFunnelPeriods recebe a base inteira de leads (sem filtro de data) e
// filtra cada janela client-side — sem query nova no banco por período.
function buildFunnelPeriods(leads: { lead_status: string; created_at: string | null }[]): FunnelPeriod[] {
  const windows: { label: string; days: number | null }[] = [
    { label: "7 dias", days: 7 },
    { label: "30 dias", days: 30 },
    { label: "90 dias", days: 90 },
    { label: "Todo período", days: null },
  ];
  return windows.map(({ label, days }) => {
    const subset = days === null ? leads : leads.filter((l) => (l.created_at ?? "") >= daysAgoISO(days));
    return {
      label,
      counts: calculateFunnelCounts(subset.map((l) => l.lead_status as LeadStatus)),
      statusCounts: countLeadsByStatus(subset),
    };
  });
}

async function fetchFunnelPeriods(supabase: SupabaseServerClient): Promise<FunnelPeriod[]> {
  const { data } = await supabase.from("leads").select("lead_status, created_at");
  return buildFunnelPeriods(data ?? []);
}

async function fetchSellerRanking(supabase: SupabaseServerClient) {
  const [usersRes, leadsRes] = await Promise.all([
    supabase.from("users").select("id, nome, role"),
    supabase.from("leads").select("id, lead_status, assigned_to, valor_final"),
  ]);

  const sellers = (usersRes.data ?? []).filter((u) => u.role === "vendedor");
  const leads: Lead[] = (leadsRes.data ?? []).map((l) => ({
    id: l.id,
    nome: null,
    phone_normalized: "",
    score: 0,
    lead_status: l.lead_status as LeadStatus,
    assigned_to: l.assigned_to,
    updated_at: new Date(0).toISOString(),
    valor_final: l.valor_final,
  }));

  return calculateSellerMetrics(leads, sellers)
    .sort((a, b) => b.revenue - a.revenue || b.closed_leads - a.closed_leads)
    .slice(0, 5);
}

// migration 022 (agendamento_data/agendamento_horario em leads) documentada
// como aplicada mas nunca rodou nesta instância Supabase — se a coluna não
// existir, o select abaixo volta com "data" vazio/nulo; o fallback (Map
// vazio) faz o card "Visitas agendadas" mostrar 0 em vez de quebrar a
// página. Rodar a migration em produção é decisão do Vitor, não automática.
async function fetchAgendamentoMap(supabase: SupabaseServerClient): Promise<Map<string, string | null>> {
  const { data, error } = await supabase.from("leads").select("id, agendamento_data").order("id");
  if (error) console.warn("[dashboard] fetchAgendamentoMap falhou (coluna agendamento_data pode não existir ainda — migration 022):", error.message);
  return new Map((data ?? []).map((l) => [l.id, l.agendamento_data as string | null]));
}

async function fetchDashboardPeriodData(supabase: SupabaseServerClient): Promise<{ leads: DashboardLead[]; sellers: { id: string; nome: string }[] }> {
  const [leadsRes, sellersRes, agendamentoMap] = await Promise.all([
    supabase.from("leads").select("id, created_at, origem, assigned_to").order("id"),
    supabase.from("users").select("id, nome").eq("role", "vendedor"),
    fetchAgendamentoMap(supabase),
  ]);
  const leads: DashboardLead[] = (leadsRes.data ?? []).map((l) => ({
    ...l,
    agendamento_data: agendamentoMap.get(l.id) ?? null,
  }));
  return { leads, sellers: sellersRes.data ?? [] };
}

async function fetchStaleCount(supabase: SupabaseServerClient) {
  const { data, error } = await supabase
    .from("leads")
    .select(
      `updated_at, conversations ( conversation_status, ultima_mensagem_em )`
    )
    .not("lead_status", "in", "(FECHADO,PERDIDO)");

  if (error || !data) return 0;

  const ultimaAtividades = data.map((l) => {
    const convs = Array.isArray(l.conversations) ? l.conversations : l.conversations ? [l.conversations] : [];
    return { ultima_atividade: pickConversationActivity(convs) ?? l.updated_at ?? new Date(0).toISOString() };
  });

  return countStaleLeads(ultimaAtividades, STALE_THRESHOLD_MS);
}

async function fetchLowMarginVehicleCount(supabase: SupabaseServerClient) {
  const { data } = await supabase.from("vehicles").select("preco, custo").eq("disponivel", true);
  return (data ?? []).filter((v) => v.custo > 0 && marginPercent(v.preco, v.custo) < LOW_MARGIN_THRESHOLD).length;
}

const MEDAL_COLORS = ["#EAB308", "#94A3B8", "#B45309"]; // ouro / prata / bronze — top 3 do ranking

const CHECKLIST = [
  { done: true, text: "WhatsApp Business conectado" },
  { done: true, text: "Equipe cadastrada (3 vendedores)" },
  { done: true, text: "Estoque configurado (6 veículos)" },
  { done: false, text: "Integração com portais (OLX / Webmotors)" },
  { done: false, text: "Mensagens da IA personalizadas" },
];

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AuthError();

  const [funnelPeriods, staleCount, lowMarginCount, sellerRanking, dashboardPeriodData] = await Promise.all([
    fetchFunnelPeriods(supabase),
    fetchStaleCount(supabase),
    fetchLowMarginVehicleCount(supabase),
    fetchSellerRanking(supabase),
    fetchDashboardPeriodData(supabase),
  ]);

  const alerts: Array<{ type: "hot" | "warn" | "info"; icon: string; text: string }> = [];
  if (staleCount > 0) {
    alerts.push({
      type: "hot",
      icon: "⚠",
      text: `${staleCount} lead${staleCount === 1 ? "" : "s"} sem resposta há mais de 24h — intervenção recomendada`,
    });
  }
  if (lowMarginCount > 0) {
    alerts.push({
      type: "info",
      icon: "↓",
      text: `${lowMarginCount} veículo${lowMarginCount === 1 ? "" : "s"} com margem abaixo de ${LOW_MARGIN_THRESHOLD}% no estoque`,
    });
  }

  return (
    <main className="container">
      <DashboardPeriodCards leads={dashboardPeriodData.leads} sellers={dashboardPeriodData.sellers} />

      <div className="section-card">
        <LeadsFunnel periods={funnelPeriods} defaultLabel={`${WINDOW_DAYS} dias`} />
      </div>

      <div className="section-card">
        <div className="section-card-head">
          <span className="section-card-title">Ranking de Vendedores</span>
          <span className="kpi-delta">por faturamento fechado</span>
        </div>
        <div>
          {sellerRanking.length === 0 ? (
            <div className="section-card-body">Nenhum vendedor com leads atribuídos ainda.</div>
          ) : (
            sellerRanking.map((s, i) => {
              const medal = MEDAL_COLORS[i];
              return (
                <div key={s.userId} className="activity-item" style={{ padding: "10px 16px", alignItems: "center" }}>
                  <span
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      background: medal ?? "var(--panel-2)",
                      color: medal ? "#fff" : "var(--muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      fontWeight: 700,
                      flexShrink: 0,
                      boxShadow: medal ? `0 0 0 3px ${medal}22` : undefined,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-strong)" }}>{s.nome}</div>
                    <div style={{ fontSize: "11.5px", color: "var(--muted)" }}>{s.closed_leads} venda{s.closed_leads === 1 ? "" : "s"} fechada{s.closed_leads === 1 ? "" : "s"}</div>
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#10B981" }}>{formatCurrency(s.revenue)}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div style={{ position: "fixed", top: "16px", right: "16px", zIndex: 60, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px" }}>
        <AlertsWidget alerts={alerts} />
        <SetupWidget checklist={CHECKLIST} />
      </div>
    </main>
  );
}
