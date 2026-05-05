import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthError } from "@/lib/auth";
import { calculateOperationalMetrics } from "@/lib/metrics";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const WINDOW_DAYS = 30;

function windowStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - WINDOW_DAYS);
  return d.toISOString();
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function mins(avg: number): string {
  if (avg === 0) return "—";
  return avg < 1 ? `${Math.round(avg * 60)}s` : `${avg.toFixed(1)} min`;
}

async function fetchMetrics(supabase: SupabaseServerClient) {
  const since = windowStart();

  const [leadsRes, allLeadsRes, convsRes, msgsRes, followRes, reactRes] = await Promise.all([
    supabase
      .from("leads")
      .select("lead_status, created_at")
      .gte("created_at", since),
    supabase
      .from("leads")
      .select("lead_status, created_at"),
    supabase
      .from("conversations")
      .select("id, handoff_to, lead_id"),
    supabase
      .from("messages")
      .select("conversation_id, direcao, autor, received_at, mensagem")
      .gte("received_at", since),
    supabase
      .from("follow_up_logs")
      .select("lead_id, status, logged_at, conversation_id")
      .gte("logged_at", since),
    supabase
      .from("reactivation_logs")
      .select("lead_id, status, logged_at, conversation_id")
      .gte("logged_at", since),
  ]);

  return calculateOperationalMetrics({
    leads:           allLeadsRes.data ?? [],
    conversations:   convsRes.data   ?? [],
    messages:        msgsRes.data    ?? [],
    followUpLogs:    followRes.data  ?? [],
    reactivationLogs: reactRes.data  ?? [],
  });
}

type MetricCard = {
  label: string;
  value: string;
  sub?: string;
  tier?: "ok" | "warn" | "info";
};

export default async function AnalyticsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthError();

  const m = await fetchMetrics(supabase);

  const convRate = m.total_leads > 0
    ? pct(m.closed_leads / m.total_leads)
    : "—";

  const cards: MetricCard[] = [
    { label: "Total de Leads",           value: String(m.total_leads),             sub: "últimos 30 dias" },
    { label: "Atendidos pela IA",         value: String(m.ai_handled_leads),        sub: "sem intervenção humana",   tier: "ok" },
    { label: "Intervenções Humanas",      value: String(m.human_handoff_count),     sub: "handoffs no período" },
    { label: "Follow-ups Enviados",       value: String(m.followups_sent),          sub: "cadência automática" },
    { label: "Reativações Enviadas",      value: String(m.reactivations_sent),      sub: "leads inativos" },
    { label: "Em Negociação",             value: String(m.negotiation_leads),       sub: "estado atual",             tier: m.negotiation_leads > 0 ? "warn" : undefined },
    { label: "Fechados",                  value: String(m.closed_leads),            sub: `conversão ${convRate}`,    tier: m.closed_leads > 0 ? "ok" : undefined },
    { label: "Perdidos",                  value: String(m.lost_leads),              sub: "estado atual" },
    { label: "Resposta Média da IA",      value: mins(m.avg_first_response_minutes), sub: "1ª resposta após contato", tier: "info" },
    { label: "Taxa Resposta Follow-up",   value: pct(m.followup_response_rate),    sub: "leads que responderam",    tier: m.followup_response_rate > 0.3 ? "ok" : undefined },
    { label: "Taxa Resposta Reativação",  value: pct(m.reactivation_response_rate), sub: "leads que responderam",   tier: m.reactivation_response_rate > 0.2 ? "ok" : undefined },
  ];

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1>Analytics</h1>
          <div className="subtitle">Métricas operacionais · últimos {WINDOW_DAYS} dias</div>
        </div>
        <Link href="/leads" className="btn-secondary" style={{ alignSelf: "center" }}>
          Ver Kanban →
        </Link>
      </div>

      <div className="metrics-grid">
        {cards.map((c) => (
          <div key={c.label} className={`metric-card${c.tier ? ` metric-${c.tier}` : ""}`}>
            <div className="metric-label">{c.label}</div>
            <div className="metric-value">{c.value}</div>
            {c.sub && <div className="metric-sub">{c.sub}</div>}
          </div>
        ))}
      </div>
    </main>
  );
}
