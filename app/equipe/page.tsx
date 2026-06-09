import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthError } from "@/lib/auth";
import { OPEN_CONVERSATION_STATUSES, type LeadStatus } from "@/types/domain";
import type { Lead } from "@/types/domain";
import {
  calculateTeamPageData,
  calculateTeamKpis,
  buildTeamAlerts,
  formatInactiveDuration,
  type SellerStatus,
  type SellerUser,
} from "@/lib/team-metrics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─── Badge helpers ────────────────────────────────────────────────────────────

function statusBadgeCss(status: SellerStatus): string {
  switch (status) {
    case "attending": return "atendendo";
    case "active":    return "disponivel";
    case "inactive":  return "parado";
    case "no_leads":  return "disponivel";
  }
}

function statusBadgeText(
  status: SellerStatus,
  inactiveDurationMs: number | null
): string {
  switch (status) {
    case "attending": return "Em atendimento";
    case "active":    return "Ativo";
    case "inactive":
      return `Sem atividade há ${formatInactiveDuration(inactiveDurationMs ?? 0)}`;
    case "no_leads":  return "Sem leads";
  }
}

function alertMessage(
  sellerNome: string,
  hotLeadsStale: number,
  awaitingHuman: number
): string {
  const parts: string[] = [];
  if (hotLeadsStale > 0) {
    parts.push(
      `${hotLeadsStale} lead${hotLeadsStale > 1 ? "s" : ""} quente${hotLeadsStale > 1 ? "s" : ""} sem interação há mais de 4h`
    );
  }
  if (awaitingHuman > 0) {
    parts.push(
      `${awaitingHuman} lead${awaitingHuman > 1 ? "s" : ""} aguardando atendimento humano`
    );
  }
  return `${sellerNome} possui ${parts.join(" e ")}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function EquipePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthError();

  // Parallel fetch — 2 queries total, no N+1
  const [usersRes, leadsRes] = await Promise.all([
    supabase.from("users").select("id, nome, role").order("nome"),
    // All leads (including FECHADO/PERDIDO) to accurately count closed_leads.
    // Only fields needed for team metrics; no PII (phone_normalized omitted).
    supabase
      .from("leads")
      .select(
        "id, score, lead_status, assigned_to, updated_at, conversations(conversation_status)"
      ),
  ]);

  const sellers = (usersRes.data ?? []) as SellerUser[];

  // Normalise leads: flatten embedded conversations to active conversation_status
  const leads: Lead[] = (leadsRes.data ?? []).map(
    (l: {
      id: string;
      score: number;
      lead_status: string;
      assigned_to: string | null;
      updated_at: string;
      conversations?: { conversation_status: string | null }[];
    }) => {
      const convs = l.conversations ?? [];
      const activeConv = convs.find((c) =>
        (OPEN_CONVERSATION_STATUSES as string[]).includes(
          c.conversation_status ?? ""
        )
      );
      return {
        id: l.id,
        nome: null,
        phone_normalized: "",
        score: l.score,
        lead_status: l.lead_status as LeadStatus,
        assigned_to: l.assigned_to ?? null,
        conversation_status: activeConv?.conversation_status ?? null,
        updated_at: l.updated_at,
      };
    }
  );

  const pageData = calculateTeamPageData(leads, sellers);
  const kpis     = calculateTeamKpis(pageData);
  const alerts   = buildTeamAlerts(pageData);

  const hasError = usersRes.error || leadsRes.error;

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1>Equipe</h1>
          <div className="subtitle">
            Operação em tempo real · {sellers.length}{" "}
            {sellers.length === 1 ? "vendedor" : "vendedores"}
          </div>
        </div>
      </div>

      {hasError && (
        <div className="alert-item warn" style={{ marginBottom: "16px" }}>
          <span className="alert-icon">⚠</span>
          <span>Erro ao carregar dados da equipe.</span>
        </div>
      )}

      {/* ─── KPI bar ─────────────────────────────────────────────────── */}
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="kpi-card">
          <div className="kpi-label">Com Lead Quente Agora</div>
          <div
            className="kpi-value"
            style={{ color: kpis.sellers_with_hot_lead > 0 ? "#B91C1C" : "inherit" }}
          >
            {kpis.sellers_with_hot_lead}
          </div>
          <div className="kpi-delta">
            {kpis.sellers_with_hot_lead > 0 ? "requer atenção" : "nenhum agora"}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Sem Atividade &gt;2h</div>
          <div
            className="kpi-value"
            style={{
              color:
                kpis.sellers_inactive_2h > 0 ? "#C2410C" : "#15803D",
            }}
          >
            {kpis.sellers_inactive_2h}
          </div>
          <div className="kpi-delta">
            {kpis.sellers_inactive_2h > 0
              ? "sem atividade recente"
              : "todos ativos"}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Total Fechamentos</div>
          <div className="kpi-value" style={{ color: "#10B981" }}>
            {kpis.total_closed_leads}
          </div>
          <div className="kpi-delta">leads fechados (todos os períodos)</div>
        </div>
      </div>

      {/* ─── Alerts ──────────────────────────────────────────────────── */}
      {alerts.map((alert) => (
        <div
          key={alert.seller_nome}
          className="alert-item warn"
          style={{ marginBottom: "8px" }}
        >
          <span className="alert-icon">⏱</span>
          <span>
            <strong>
              {alertMessage(
                alert.seller_nome,
                alert.hot_leads_stale,
                alert.awaiting_human
              )}
            </strong>
            .{" "}
            <Link
              href="/conversations"
              style={{
                color: "inherit",
                fontWeight: 700,
                textDecoration: "underline",
              }}
            >
              Ver conversas →
            </Link>
          </span>
        </div>
      ))}

      {/* ─── Team grid ───────────────────────────────────────────────── */}
      {sellers.length === 0 ? (
        <div
          className="alert-item info"
          style={{ marginTop: "16px" }}
        >
          <span className="alert-icon">ℹ</span>
          <span>Nenhum vendedor cadastrado nesta loja ainda.</span>
        </div>
      ) : (
        <div className="team-grid">
          {pageData.map((s) => (
            <div key={s.userId} className="team-card">
              <div className="team-avatar">{s.initials}</div>
              <div className="team-name">{s.nome}</div>
              <div className="team-role" style={{ marginBottom: "6px" }}>
                {s.role === "admin" ? "Admin" : "Vendedor"}
              </div>

              <div className={`op-badge ${statusBadgeCss(s.status)}`}>
                {statusBadgeText(s.status, s.inactive_duration_ms)}
              </div>

              <div
                style={{
                  fontSize: "11.5px",
                  color: "var(--muted)",
                  marginBottom: "10px",
                  marginTop: "6px",
                }}
              >
                {s.last_activity_at
                  ? `Última atividade: ${new Date(
                      s.last_activity_at
                    ).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "Sem atividade registrada"}
              </div>

              <div className="team-stats">
                <div>
                  <div className="team-stat-value">{s.total_leads}</div>
                  <div className="team-stat-label">Leads</div>
                </div>
                <div>
                  <div className="team-stat-value">{s.hot_leads}</div>
                  <div className="team-stat-label">Quentes</div>
                </div>
                <div>
                  <div className="team-stat-value">{s.closed_leads}</div>
                  <div className="team-stat-label">Fechados</div>
                </div>
                <div>
                  <div className="team-stat-value">{s.conversion_pct}%</div>
                  <div className="team-stat-label">Conversão</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
