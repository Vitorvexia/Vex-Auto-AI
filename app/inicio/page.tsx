import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthError } from "@/lib/auth";
import { calculateOperationalMetrics, countLeadsToday } from "@/lib/metrics";
import {
  calculateLeadPriority,
  sortLeads,
  countStaleLeads,
  type PriorityTier,
} from "@/lib/lead-priority";
import { marginPercent } from "@/lib/vehicle-margin";
import { relativeTime, scoreClass } from "@/lib/format";
import type { LeadStatus } from "@/types/domain";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const WINDOW_DAYS = 30;
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24h — alerta de /inicio (distinto do chip de 2h em /leads)
const LOW_MARGIN_THRESHOLD = 5; // % — mesmo limiar do texto original do mock

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

async function fetchOperationalMetrics(supabase: SupabaseServerClient) {
  const since = windowStart();

  const [allLeadsRes, convsRes, msgsRes, followRes, reactRes] = await Promise.all([
    supabase.from("leads").select("lead_status, created_at"),
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
      .select("lead_id, status, logged_at, conversation_id")
      .gte("logged_at", since),
  ]);

  const leads = allLeadsRes.data ?? [];

  return {
    metrics: calculateOperationalMetrics({
      leads,
      conversations: convsRes.data ?? [],
      messages: msgsRes.data ?? [],
      followUpLogs: followRes.data ?? [],
      reactivationLogs: reactRes.data ?? [],
    }),
    leadsToday: countLeadsToday(leads),
  };
}

type EnrichedLead = {
  id: string;
  nome: string | null;
  score: number;
  interesse: string | null;
  ultima_atividade: string;
  priority: PriorityTier;
};

async function fetchHotLeadsAndStale(supabase: SupabaseServerClient) {
  const { data, error } = await supabase
    .from("leads")
    .select(
      `id, nome, score, lead_status, updated_at, contexto,
       conversations ( conversation_status, ultima_mensagem_em )`
    )
    .not("lead_status", "in", "(FECHADO,PERDIDO)");

  if (error || !data) return { hotLeads: [] as EnrichedLead[], staleCount: 0 };

  const enriched: EnrichedLead[] = data.map((l) => {
    const convs = Array.isArray(l.conversations) ? l.conversations : l.conversations ? [l.conversations] : [];
    const openConv = convs.find((c) => c.conversation_status && c.conversation_status !== "ENCERRADA") ?? convs[0];
    const interesseRaw = (l.contexto as Record<string, unknown> | null)?.interesse;
    const interesse = typeof interesseRaw === "string" && interesseRaw.trim() ? interesseRaw.trim() : null;
    const ultima_atividade = openConv?.ultima_mensagem_em ?? l.updated_at ?? new Date(0).toISOString();
    const { priority } = calculateLeadPriority({
      score: l.score,
      conversationStatus: openConv?.conversation_status ?? null,
      leadStatus: l.lead_status as LeadStatus,
      ultimaAtividade: ultima_atividade,
    });
    return { id: l.id, nome: l.nome, score: l.score ?? 0, interesse, ultima_atividade, priority };
  });

  const staleCount = countStaleLeads(enriched, STALE_THRESHOLD_MS);
  const hotLeads = sortLeads(enriched.filter((l) => l.priority === "hot"));

  return { hotLeads, staleCount };
}

async function fetchLowMarginVehicleCount(supabase: SupabaseServerClient) {
  const { data } = await supabase.from("vehicles").select("preco, custo").eq("disponivel", true);
  return (data ?? []).filter((v) => v.custo > 0 && marginPercent(v.preco, v.custo) < LOW_MARGIN_THRESHOLD).length;
}

const CHECKLIST = [
  { done: true, text: "WhatsApp Business conectado" },
  { done: true, text: "Equipe cadastrada (3 vendedores)" },
  { done: true, text: "Estoque configurado (6 veículos)" },
  { done: false, text: "Integração com portais (OLX / Webmotors)" },
  { done: false, text: "Mensagens da IA personalizadas" },
];

type MetricCard = { label: string; value: string; sub?: string; tier?: "ok" | "warn" | "info" };

export default async function InicioPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AuthError();

  const setupDone = CHECKLIST.filter((c) => c.done).length;

  const [{ metrics: m, leadsToday }, { hotLeads, staleCount }, lowMarginCount] = await Promise.all([
    fetchOperationalMetrics(supabase),
    fetchHotLeadsAndStale(supabase),
    fetchLowMarginVehicleCount(supabase),
  ]);

  const convRate = m.total_leads > 0 ? pct(m.closed_leads / m.total_leads) : "—";

  const operationalCards: MetricCard[] = [
    { label: "Atendidos pela IA", value: String(m.ai_handled_leads), sub: "sem intervenção humana", tier: "ok" },
    { label: "Intervenções Humanas", value: String(m.human_handoff_count), sub: "handoffs no período" },
    { label: "Follow-ups Enviados", value: String(m.followups_sent), sub: "cadência automática" },
    { label: "Reativações Enviadas", value: String(m.reactivations_sent), sub: "leads inativos" },
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
        <Link href="/leads" className="btn-secondary" style={{ alignSelf: "center" }}>
          Ver Kanban →
        </Link>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Leads Hoje</div>
          <div className="kpi-value">{leadsToday}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total de Leads</div>
          <div className="kpi-value">{m.total_leads}</div>
          <div className="kpi-delta">últimos {WINDOW_DAYS} dias</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Em Negociação</div>
          <div className="kpi-value">{m.negotiation_leads}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Fechados</div>
          <div className="kpi-value" style={{ color: "#10B981" }}>{m.closed_leads}</div>
          <div className="kpi-delta">conversão {convRate}</div>
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

      <div className="dash-grid">
        <div className="dash-col">
          <div className="section-card">
            <div className="section-card-head">
              <span className="section-card-title">Leads Quentes</span>
              <Link href="/leads" style={{ fontSize: "11.5px", color: "var(--accent)" }}>ver todos →</Link>
            </div>
            <div>
              {hotLeads.length === 0 ? (
                <div className="section-card-body">Nenhum lead quente no momento.</div>
              ) : (
                hotLeads.slice(0, 5).map((l) => (
                  <div key={l.id} className="activity-item" style={{ padding: "10px 16px", alignItems: "center" }}>
                    <span className={`score-badge ${scoreClass(l.score)}`}>{l.score}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-strong)" }}>{l.nome ?? "Sem nome"}</div>
                      {l.interesse && <div style={{ fontSize: "11.5px", color: "var(--muted)" }}>{l.interesse}</div>}
                    </div>
                    <span className="activity-time">{relativeTime(l.ultima_atividade)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="dash-col">
          <div className="section-card">
            <div className="section-card-head">
              <span className="section-card-title">Alertas</span>
              <span className="kpi-delta">{alerts.length} pendentes</span>
            </div>
            <div className="section-card-body">
              {alerts.length === 0 ? (
                <div>Nenhum alerta no momento.</div>
              ) : (
                alerts.map((a, i) => (
                  <div key={i} className={`alert-item ${a.type}`}>
                    <span className="alert-icon">{a.icon}</span>
                    <span>{a.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="section-card">
            <div className="section-card-head">
              <span className="section-card-title">Setup Inicial</span>
              <span className="kpi-delta up">{setupDone} / {CHECKLIST.length} concluídos</span>
            </div>
            <div style={{ padding: "4px 16px 10px" }}>
              {CHECKLIST.map((c, i) => (
                <div key={i} className="checklist-item">
                  <span className={`checklist-check${c.done ? " done" : ""}`}>
                    {c.done ? "✓" : ""}
                  </span>
                  <span style={{
                    textDecoration: c.done ? "line-through" : "none",
                    color: c.done ? "var(--muted)" : "var(--text)",
                  }}>
                    {c.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="section-card">
            <div className="section-card-head">
              <span className="section-card-title">Acesso Rápido</span>
            </div>
            <div className="section-card-body" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <Link href="/leads" className="quick-link">→ Pipeline de Leads</Link>
              <Link href="/conversations" className="quick-link">→ WhatsApp / Conversas</Link>
              <Link href="/estoque" className="quick-link">→ Gerenciar Estoque</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
