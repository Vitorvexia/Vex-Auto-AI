import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthError } from "@/lib/auth";
import { calculateOperationalMetrics, countLeadsToday, buildDailyTrend, calculateReactivationRevenue, countLeadsByStatus } from "@/lib/metrics";
import { calculateSellerMetrics } from "@/lib/seller-metrics";
import { TrendChart } from "@/app/components/TrendChart";
import { BarChart } from "@/app/components/BarChart";
import { LeadsFunnel, type FunnelPeriod } from "@/app/components/LeadsFunnel";
import { calculateFunnelCounts } from "@/lib/lead-funnel";
import { SetupWidget } from "@/app/components/SetupWidget";
import { AlertsWidget } from "@/app/components/AlertsWidget";
import { countStaleLeads, pickConversationActivity } from "@/lib/lead-priority";
import { marginPercent } from "@/lib/vehicle-margin";
import { formatCurrency } from "@/lib/format";
import type { LeadStatus, Lead } from "@/types/domain";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const WINDOW_DAYS = 30;
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24h — alerta de /dashboard (distinto do chip de 2h em /leads)
const LOW_MARGIN_THRESHOLD = 5; // % — mesmo limiar do texto original do mock

function windowStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - WINDOW_DAYS);
  return d.toISOString();
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// Períodos do Funil de Temperatura — independente da janela fixa de
// WINDOW_DAYS usada no resto do dashboard (Métricas Operacionais,
// Tendência Diária etc, que seguem 30 dias sempre). "leads" já é a base
// inteira (query sem filtro de data), então cada período é só um filtro
// client-side sobre esse mesmo array — sem query nova no banco.
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

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function mins(avg: number | null): string {
  if (avg === null) return "—";
  return avg < 1 ? `${Math.round(avg * 60)}s` : `${avg.toFixed(1)} min`;
}

async function fetchOperationalMetrics(supabase: SupabaseServerClient) {
  const since = windowStart();

  const [allLeadsRes, convsRes, msgsRes, followRes, reactRes, reactConvertedRes] = await Promise.all([
    supabase.from("leads").select("id, lead_status, created_at, valor_final"),
    supabase.from("conversations").select("id, handoff_to, lead_id").limit(500),
    supabase
      .from("messages")
      .select("conversation_id, direcao, autor, received_at, mensagem")
      .gte("received_at", since)
      .limit(2000),
    supabase
      .from("follow_up_logs")
      .select("lead_id, status, logged_at, conversation_id")
      .gte("logged_at", since),
    supabase
      .from("reactivation_logs")
      .select("lead_id, status, logged_at, conversation_id, converted_at")
      .gte("logged_at", since),
    // Janela por converted_at (não logged_at) — reativação enviada há mais de
    // 30 dias mas convertida agora deve contar no ROI do período. Query
    // separada da acima porque "enviadas no período" e "convertidas no
    // período" são janelas diferentes sobre o mesmo período de referência.
    supabase
      .from("reactivation_logs")
      .select("lead_id, converted_at")
      .not("converted_at", "is", null)
      .gte("converted_at", since),
  ]);

  // leads não tem filtro de created_at de propósito: buildFunnelPeriods
  // precisa da base inteira pros períodos 90d/Todo período do Funil de
  // Temperatura (ver comentário na função). windowedLeads é só pras métricas
  // rotuladas "últimos 30 dias" (Total de Leads, Faturamento Gerado etc).
  const leads = allLeadsRes.data ?? [];
  const windowedLeads = leads.filter((l) => (l.created_at ?? "") >= since);
  const followUpLogs = followRes.data ?? [];
  const reactivationLogs = reactRes.data ?? [];

  const funnelPeriods = buildFunnelPeriods(leads);

  return {
    metrics: calculateOperationalMetrics({
      leads: windowedLeads,
      conversations: convsRes.data ?? [],
      messages: msgsRes.data ?? [],
      followUpLogs,
      reactivationLogs,
    }),
    leadsToday: countLeadsToday(leads),
    trend: buildDailyTrend(leads, followUpLogs, reactivationLogs, WINDOW_DAYS),
    funnelPeriods,
    reactivationRevenue: calculateReactivationRevenue(leads, reactConvertedRes.data ?? []),
  };
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

type MetricCard = { label: string; value: string; sub?: string; tier?: "ok" | "warn" | "info" };

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AuthError();

  const [
    { metrics: m, leadsToday, trend, funnelPeriods, reactivationRevenue },
    staleCount,
    lowMarginCount,
    sellerRanking,
  ] = await Promise.all([
    fetchOperationalMetrics(supabase),
    fetchStaleCount(supabase),
    fetchLowMarginVehicleCount(supabase),
    fetchSellerRanking(supabase),
  ]);

  const convRate = m.total_leads > 0 ? pct(m.closed_leads / m.total_leads) : "—";

  const aiVsHumanBars = [
    { label: "Atendidos pela IA", value: m.ai_handled_leads, color: "var(--accent)" },
    { label: "Intervenção Humana", value: m.human_handoff_count, color: "var(--muted)" },
  ];

  const operationalCards: MetricCard[] = [
    { label: "Atendidos pela IA", value: String(m.ai_handled_leads), sub: "sem intervenção humana", tier: "ok" },
    { label: "Intervenções Humanas", value: String(m.human_handoff_count), sub: "handoffs no período" },
    { label: "Follow-ups Enviados", value: String(m.followups_sent), sub: "cadência automática" },
    { label: "Reativações Enviadas", value: String(m.reactivations_sent), sub: "leads inativos" },
    {
      label: "Reativações Convertidas",
      value: String(reactivationRevenue.converted_leads),
      sub: reactivationRevenue.revenue > 0 ? `${formatCurrency(reactivationRevenue.revenue)} recuperados` : "base morta que voltou a comprar",
      tier: reactivationRevenue.converted_leads > 0 ? "ok" : undefined,
    },
    { label: "Perdidos", value: String(m.lost_leads), sub: "estado atual" },
    { label: "Resposta Média da IA", value: mins(m.avg_first_response_minutes), sub: "1ª resposta após contato", tier: "info" },
    { label: "Taxa Resposta Follow-up", value: pct(m.followup_response_rate), sub: "leads que responderam", tier: m.followup_response_rate > 0.3 ? "ok" : undefined },
    { label: "Taxa Resposta Reativação", value: pct(m.reactivation_response_rate), sub: "leads que responderam", tier: m.reactivation_response_rate > 0.2 ? "ok" : undefined },
  ];

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
      <div className="page-header">
        <div>
          <h1 className="page-title">Central de Operações</h1>
          <div className="subtitle">Métricas operacionais · dado real</div>
        </div>
      </div>

      <div className="ops-strip">
        <div className="ops-strip-live">
          <span className="ops-strip-live-dot" aria-hidden="true" />
          <span className="ops-strip-live-label">IA operando</span>
        </div>
        <div className="ops-metric" data-tick="engajado">
          <div className="kpi-label">Leads Hoje</div>
          <div className="kpi-value">{leadsToday}</div>
        </div>
        <div className="ops-metric" data-tick="engajado">
          <div className="kpi-label">Total de Leads</div>
          <div className="kpi-value">{m.total_leads}</div>
          <div className="kpi-delta">últimos {WINDOW_DAYS} dias</div>
        </div>
        <div className="ops-metric" data-tick="negociacao">
          <div className="kpi-label">Em Negociação</div>
          <div className="kpi-value">{m.negotiation_leads}</div>
        </div>
        <div className="ops-metric" data-tick="fechado">
          <div className="kpi-label">Fechados</div>
          <div className="kpi-value" style={{ color: "#10B981" }}>{m.closed_leads}</div>
          <div className="kpi-delta">conversão {convRate}</div>
        </div>
        <div className="ops-metric ops-metric-hero" data-tick="fechado">
          <div className="kpi-label">Faturamento Gerado</div>
          <div className="kpi-value" style={{ color: "#10B981" }}>{formatCurrency(m.revenue_generated)}</div>
          <div className="kpi-delta">últimos {WINDOW_DAYS} dias</div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-card-head">
          <span className="section-card-title">Métricas Operacionais</span>
          <span className="kpi-delta">últimos {WINDOW_DAYS} dias</span>
        </div>
        <div className="metrics-grid" style={{ margin: "0 16px 16px" }}>
          {operationalCards.map((c) => (
            <div key={c.label} className={`metric-card${c.tier ? ` metric-${c.tier}` : ""}`}>
              <div className="metric-label">{c.label}</div>
              <div className="metric-value">{c.value}</div>
              {c.sub && <div className="metric-sub">{c.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="section-card">
        <div className="section-card-head">
          <span className="section-card-title">Tendência Diária</span>
          <span className="kpi-delta">últimos {WINDOW_DAYS} dias</span>
        </div>
        <div className="section-card-body">
          <TrendChart data={trend} />
        </div>
      </div>

      <div className="section-card">
        <LeadsFunnel periods={funnelPeriods} defaultLabel={`${WINDOW_DAYS} dias`} />
      </div>

      <div className="section-card">
        <div className="section-card-head">
          <span className="section-card-title">IA vs Humano</span>
          <span className="kpi-delta">últimos {WINDOW_DAYS} dias</span>
        </div>
        <div className="section-card-body">
          <BarChart bars={aiVsHumanBars} />
        </div>
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
