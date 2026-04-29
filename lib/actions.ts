"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import {
  transitionConversationStatus,
  transitionLeadStatus,
} from "@/lib/status";
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
