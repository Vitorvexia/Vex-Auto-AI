import type { Lead } from "@/types/domain";
import { calculateLeadPriority } from "@/lib/lead-priority";

type SellerUser = { id: string; nome: string };

export type SellerMetrics = {
  userId: string;
  nome: string;
  total_leads: number;
  hot_leads: number;    // same rule as KPI bar: score >= 80 OR handoff (AGUARDANDO_HUMANO)
  closed_leads: number;
};

export type StoreAssignmentSummary = {
  leads_with_owner: number;
  leads_without_owner: number;
};

export function calculateSellerMetrics(
  leads: Lead[],
  users: SellerUser[]
): SellerMetrics[] {
  return users
    .map((user) => {
      const userLeads = leads.filter((l) => l.assigned_to === user.id);
      if (userLeads.length === 0) return null;
      return {
        userId: user.id,
        nome: user.nome,
        total_leads: userLeads.length,
        hot_leads: userLeads.filter((l) =>
          calculateLeadPriority({
            score: l.score,
            conversationStatus: l.conversation_status ?? null,
            leadStatus: l.lead_status,
          }).priority === "hot"
        ).length,
        closed_leads: userLeads.filter((l) => l.lead_status === "FECHADO").length,
      };
    })
    .filter((m): m is SellerMetrics => m !== null);
}

export function getStoreAssignmentSummary(leads: Lead[]): StoreAssignmentSummary {
  const leads_with_owner = leads.filter((l) => l.assigned_to !== null).length;
  const leads_without_owner = leads.filter((l) => l.assigned_to === null).length;
  return { leads_with_owner, leads_without_owner };
}
