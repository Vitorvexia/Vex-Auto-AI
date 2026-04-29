"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import {
  transitionConversationStatus,
  transitionLeadStatus,
} from "@/lib/status";
import { simulateFinancing } from "@/lib/financing";
import type { LeadStatus } from "@/types/domain";
import { ingestLeadManually, type IngestLeadResult } from "@/lib/lead-ingestion";

const VALID_LEAD_STATUSES = new Set<string>([
  "NOVO",
  "ENGAJADO",
  "INTERESSADO",
  "QUENTE",
  "NEGOCIACAO",
  "FECHADO",
  "PERDIDO",
]);

export async function assignConversationToHuman(
  conversationId: string
): Promise<void> {
  await transitionConversationStatus(conversationId, "AGUARDANDO_HUMANO", {
    handoff_to: "HUMANO",
    assigned_to: null,
  });
  await supabaseAdmin.from("messages").insert({
    conversation_id: conversationId,
    direcao: "saida",
    autor: "sistema",
    mensagem: "Conversa assumida por humano",
  });
  revalidatePath(`/conversations/${conversationId}`);
}

export async function returnConversationToAI(
  conversationId: string
): Promise<void> {
  await transitionConversationStatus(conversationId, "ATIVA", {
    handoff_to: "IA",
    assigned_to: null,
  });
  await supabaseAdmin.from("messages").insert({
    conversation_id: conversationId,
    direcao: "saida",
    autor: "sistema",
    mensagem: "Conversa retornada para IA",
  });
  revalidatePath(`/conversations/${conversationId}`);
}

export async function updateLeadStatus(
  leadId: string,
  conversationId: string,
  formData: FormData
): Promise<void> {
  const newStatus = formData.get("lead_status") as string;
  if (!VALID_LEAD_STATUSES.has(newStatus)) {
    throw new Error(`Status inválido: ${newStatus}`);
  }
  await transitionLeadStatus(leadId, newStatus as LeadStatus);
  revalidatePath(`/conversations/${conversationId}`);
  revalidatePath("/conversations");
}

export async function importLead(
  _prev: IngestLeadResult | null,
  formData: FormData
): Promise<IngestLeadResult> {
  const nome = (formData.get("nome") as string | null)?.trim() ?? "";
  const telefone = (formData.get("telefone") as string | null)?.trim() ?? "";
  const interesse = (formData.get("interesse") as string | null)?.trim() || null;
  const observacao = (formData.get("observacao") as string | null)?.trim() || null;
  const storeId = process.env.DEFAULT_STORE_ID ?? "";

  const result = await ingestLeadManually({ nome, telefone, interesse, observacao, storeId });

  if (result.status === "created") {
    revalidatePath("/leads");
  }

  return result;
}

export async function moveLeadStatus(
  leadId: string,
  formData: FormData
): Promise<void> {
  const newStatus = formData.get("lead_status") as string;
  if (!VALID_LEAD_STATUSES.has(newStatus)) {
    throw new Error(`Status inválido: ${newStatus}`);
  }
  await transitionLeadStatus(leadId, newStatus as LeadStatus);
  revalidatePath("/leads");
}

export async function saveFinancingSimulation(
  leadId: string,
  conversationId: string,
  storeId: string,
  formData: FormData
): Promise<void> {
  const vehicle_price    = Number(formData.get("vehicle_price"));
  const entry_value      = Number(formData.get("entry_value") ?? 0);
  const term_months      = Number(formData.get("term_months"));
  const ratePctRaw       = formData.get("monthly_rate_pct");
  const monthly_rate     = ratePctRaw !== null && ratePctRaw !== ""
    ? Number(ratePctRaw) / 100
    : undefined;

  if (vehicle_price <= 0) return;
  if (term_months < 12 || term_months > 72) return;
  if (entry_value < 0 || entry_value >= vehicle_price) return;
  if (monthly_rate !== undefined && (isNaN(monthly_rate) || monthly_rate < 0)) return;

  const result = simulateFinancing({ vehicle_price, entry_value, term_months, monthly_rate });

  await supabaseAdmin.from("financing_simulations").insert({
    store_id:        storeId,
    lead_id:         leadId,
    conversation_id: conversationId,
    vehicle_price,
    entry_value,
    financed_amount: result.financed_amount,
    term_months,
    monthly_rate:    result.monthly_rate,
    monthly_payment: result.monthly_payment,
    total_amount:    result.total_amount,
    provider:        "internal",
  });

  const fmtBRL = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  await supabaseAdmin.from("messages").insert({
    conversation_id: conversationId,
    direcao:         "saida",
    autor:           "sistema",
    mensagem: `Simulação registrada: veículo R$ ${fmtBRL(vehicle_price)}, entrada R$ ${fmtBRL(entry_value)}, ${term_months}x, parcela estimada R$ ${fmtBRL(result.monthly_payment)}.`,
  });

  revalidatePath(`/conversations/${conversationId}`);
}
