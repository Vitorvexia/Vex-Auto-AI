"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import {
  transitionConversationStatus,
  transitionLeadStatus,
} from "@/lib/status";
import type { LeadStatus } from "@/types/domain";
import { ingestLeadManually, type IngestLeadResult } from "@/lib/lead-ingestion";
import { getServerStoreId } from "@/lib/auth";
import { markReactivationConverted } from "@/lib/reactivation";

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
  const storeId = await getServerStoreId();
  const { data: check } = await supabaseAdmin
    .from("conversations")
    .select("id, lead_id")
    .eq("id", conversationId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!check) throw new Error("Conversa não encontrada");

  await transitionConversationStatus(conversationId, "AGUARDANDO_HUMANO", {
    handoff_to: "HUMANO",
    assigned_to: null,
  });
  await supabaseAdmin.from("messages").insert({
    conversation_id: conversationId,
    store_id: storeId,
    lead_id: check.lead_id,
    direcao: "saida",
    autor: "sistema",
    mensagem: "Conversa assumida por humano",
  });
  revalidatePath(`/conversations/${conversationId}`);
}

export async function returnConversationToAI(
  conversationId: string
): Promise<void> {
  const storeId = await getServerStoreId();
  const { data: check } = await supabaseAdmin
    .from("conversations")
    .select("id, lead_id")
    .eq("id", conversationId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!check) throw new Error("Conversa não encontrada");

  await transitionConversationStatus(conversationId, "ATIVA", {
    handoff_to: "IA",
    assigned_to: null,
  });
  await supabaseAdmin.from("messages").insert({
    conversation_id: conversationId,
    store_id: storeId,
    lead_id: check.lead_id,
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
  const storeId = await getServerStoreId();
  const { data: check } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!check) throw new Error("Lead não encontrado");

  const newStatus = formData.get("lead_status") as string;
  if (!VALID_LEAD_STATUSES.has(newStatus)) {
    throw new Error(`Status inválido: ${newStatus}`);
  }

  if (newStatus === "FECHADO") {
    const vehicleId     = (formData.get("vehicle_id")   as string | null)?.trim() || null;
    const valorFinalRaw =  formData.get("valor_final")  as string | null;

    if (!vehicleId) {
      throw new Error("Selecione o veículo vendido para fechar esta venda.");
    }
    const valorFinal = parseFloat(valorFinalRaw ?? "");
    if (isNaN(valorFinal) || valorFinal <= 0) {
      throw new Error("Informe o valor de venda para fechar esta negociação.");
    }

    const { data: vehicle } = await supabaseAdmin
      .from("vehicles")
      .select("id, custo, margem_minima")
      .eq("id", vehicleId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (!vehicle) throw new Error("Veículo não encontrado.");

    const custo        = vehicle.custo        ?? 0;
    const margemMinima = vehicle.margem_minima ?? 0;
    const piso         = custo + margemMinima;

    if (valorFinal < piso) {
      throw new Error("Venda abaixo da margem mínima permitida para este veículo.");
    }

    const { error: updateError } = await supabaseAdmin
      .from("leads")
      .update({ vehicle_id: vehicleId, valor_final: valorFinal })
      .eq("id", leadId)
      .eq("store_id", storeId);
    if (updateError) throw new Error("Erro ao registrar dados da venda.");
  }

  await transitionLeadStatus(leadId, newStatus as LeadStatus);
  if (newStatus === "FECHADO") markReactivationConverted(leadId, storeId).catch(() => {});
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
  const storeId = await getServerStoreId();

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
  const storeId = await getServerStoreId();
  const { data: check } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!check) throw new Error("Lead não encontrado");

  const newStatus = formData.get("lead_status") as string;
  if (!VALID_LEAD_STATUSES.has(newStatus)) {
    throw new Error(`Status inválido: ${newStatus}`);
  }

  if (newStatus === "FECHADO") {
    throw new Error(
      "Para fechar uma venda, use a página da conversa — é necessário informar o veículo e o valor de venda."
    );
  }

  await transitionLeadStatus(leadId, newStatus as LeadStatus);
  revalidatePath("/leads");
}

export async function assignLeadToUser(leadId: string, userId: string): Promise<void> {
  const storeId = await getServerStoreId();

  // Guard 1: verify lead belongs to this store
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!lead) throw new Error("Lead não encontrado");

  // Guard 2: verify user belongs to this store (cross-tenant guard)
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", userId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!user) throw new Error("Usuário inválido");

  const { error } = await supabaseAdmin
    .from("leads")
    .update({ assigned_to: userId })
    .eq("id", leadId)
    .eq("store_id", storeId);
  if (error) throw error;

  revalidatePath("/leads");
}

export async function removeLeadAssignment(leadId: string): Promise<void> {
  const storeId = await getServerStoreId();

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!lead) throw new Error("Lead não encontrado");

  const { error } = await supabaseAdmin
    .from("leads")
    .update({ assigned_to: null })
    .eq("id", leadId)
    .eq("store_id", storeId);
  if (error) throw error;

  revalidatePath("/leads");
}
