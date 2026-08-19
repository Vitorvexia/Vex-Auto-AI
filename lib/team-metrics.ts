import type { Lead, LeadStatus } from "@/types/domain";
import { calculateLeadPriority } from "@/lib/lead-priority";
import { calculateSellerMetrics } from "@/lib/seller-metrics";
import type { SellerMetrics } from "@/lib/seller-metrics";

// ─── Constants ───────────────────────────────────────────────────────────────

const INACTIVE_BADGE_MS = 2 * 60 * 60 * 1000;  // 2h — badge threshold
const STALE_ALERT_MS    = 4 * 60 * 60 * 1000;  // 4h — alert threshold

// ─── Types ───────────────────────────────────────────────────────────────────

export type SellerUser = { id: string; nome: string; role: string };

export type SellerStatus = "attending" | "active" | "inactive" | "no_leads";

export type SellerPageData = SellerMetrics & {
  role: string;
  initials: string;
  conversion_pct: number;
  status: SellerStatus;
  last_activity_at: string | null;
  inactive_duration_ms: number | null;
  hot_leads_stale_4h: number;
  awaiting_human_count: number;
};

export type TeamKpis = {
  sellers_with_hot_lead: number;
  sellers_inactive_2h: number;
  leads_awaiting_human: number;
};

export type TeamAlert = {
  seller_nome: string;
  hot_leads_stale: number;
  awaiting_human: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(nome: string): string {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── calculateTeamPageData ───────────────────────────────────────────────────
// Pure function. Accepts all leads for the store (including FECHADO/PERDIDO so
// closed_leads count is accurate). nowMs is injectable for deterministic tests.

export function calculateTeamPageData(
  leads: Lead[],
  users: SellerUser[],
  nowMs: number = Date.now()
): SellerPageData[] {
  const baseMetrics = calculateSellerMetrics(leads, users);
  const metricsById = new Map<string, SellerMetrics>(
    baseMetrics.map((m) => [m.userId, m])
  );

  return users.map((user) => {
    const base: SellerMetrics = metricsById.get(user.id) ?? {
      userId: user.id,
      nome: user.nome,
      total_leads: 0,
      hot_leads: 0,
      closed_leads: 0,
      revenue: 0,
    };

    const userLeads = leads.filter((l) => l.assigned_to === user.id);

    // last_activity_at: max updated_at among all assigned leads (proxy for seller activity)
    const lastActivityAt = userLeads.reduce<string | null>((max, l) => {
      if (!l.updated_at) return max;
      if (!max || l.updated_at > max) return l.updated_at;
      return max;
    }, null);

    const inactiveDurationMs =
      lastActivityAt !== null
        ? nowMs - new Date(lastActivityAt).getTime()
        : null;

    // awaiting_human_count: leads with AGUARDANDO_HUMANO assigned to this seller
    const awaitingHumanCount = userLeads.filter(
      (l) => l.conversation_status === "AGUARDANDO_HUMANO"
    ).length;

    // hot_leads_stale_4h: hot leads with no update in 4h
    const hotLeadsStale4h = userLeads.filter((l) => {
      const isHot =
        calculateLeadPriority({
          score: l.score,
          conversationStatus: l.conversation_status ?? null,
          leadStatus: l.lead_status as LeadStatus,
        }).priority === "hot";
      if (!isHot) return false;
      if (!l.updated_at) return true;
      return nowMs - new Date(l.updated_at).getTime() > STALE_ALERT_MS;
    }).length;

    // status — mutually exclusive, evaluated in priority order
    let status: SellerStatus;
    if (userLeads.length === 0) {
      status = "no_leads";
    } else if (awaitingHumanCount > 0) {
      status = "attending";
    } else if (
      inactiveDurationMs !== null &&
      inactiveDurationMs > INACTIVE_BADGE_MS
    ) {
      status = "inactive";
    } else {
      status = "active";
    }

    const conversionPct =
      base.total_leads > 0
        ? Math.round((base.closed_leads / base.total_leads) * 100)
        : 0;

    return {
      ...base,
      role: user.role,
      initials: getInitials(user.nome),
      conversion_pct: conversionPct,
      status,
      last_activity_at: lastActivityAt,
      inactive_duration_ms: inactiveDurationMs,
      hot_leads_stale_4h: hotLeadsStale4h,
      awaiting_human_count: awaitingHumanCount,
    };
  });
}

// ─── calculateTeamKpis ───────────────────────────────────────────────────────
// KPI bar: 3 metrics derived from seller page data.
// sellers_with_hot_lead = sellers that have at least 1 hot lead assigned
// sellers_inactive_2h   = sellers with no lead activity in >2h (status = inactive)
// leads_awaiting_human  = total leads with AGUARDANDO_HUMANO across all sellers

export function calculateTeamKpis(pageData: SellerPageData[]): TeamKpis {
  return {
    sellers_with_hot_lead: pageData.filter((s) => s.hot_leads > 0).length,
    sellers_inactive_2h: pageData.filter((s) => s.status === "inactive").length,
    leads_awaiting_human: pageData.reduce((sum, s) => sum + s.awaiting_human_count, 0),
  };
}

// ─── buildTeamAlerts ─────────────────────────────────────────────────────────
// Alerts shown above the team grid. Only sellers with actionable issues are included.

export function buildTeamAlerts(pageData: SellerPageData[]): TeamAlert[] {
  return pageData
    .filter((s) => s.hot_leads_stale_4h > 0 || s.awaiting_human_count > 0)
    .map((s) => ({
      seller_nome: s.nome,
      hot_leads_stale: s.hot_leads_stale_4h,
      awaiting_human: s.awaiting_human_count,
    }));
}

// ─── formatInactiveDuration ──────────────────────────────────────────────────

export function formatInactiveDuration(ms: number): string {
  const totalHours = ms / (60 * 60 * 1000);
  if (totalHours >= 24) return `${Math.floor(totalHours / 24)}d`;
  return `${Math.floor(totalHours)}h`;
}
