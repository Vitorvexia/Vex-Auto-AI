"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import {
  transitionConversationStatus,
  transitionLeadStatus,
} from "@/lib/status";
import type { LeadStatus } from "@/types/domain";
import { ingestLeadManually, type IngestLeadResult } from "@/lib/lead-ingestion";
import { getServerStoreId, getServerUserId, getServerUserRole } from "@/lib/auth";
import { markReactivationConverted } from "@/lib/reactivation";
import { sendWhatsAppMessage } from "@/lib/whatsapp-send";
import { getStoreWhatsAppPhoneId } from "@/lib/whatsapp-credentials";
import { logAudit } from "@/lib/audit";

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
  const [storeId, actorId] = await Promise.all([
    getServerStoreId(),
    getServerUserId(),
  ]);
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

  await logAudit({
    storeId,
    userId: actorId,
    action: "conversation.handoff_to_human",
    resourceType: "conversation",
    resourceId: conversationId,
    metadata: { lead_id: check.lead_id },
  });

  revalidatePath(`/conversations/${conversationId}`);
}

export async function returnConversationToAI(
  conversationId: string
): Promise<void> {
  const [storeId, actorId] = await Promise.all([
    getServerStoreId(),
    getServerUserId(),
  ]);
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

  await logAudit({
    storeId,
    userId: actorId,
    action: "conversation.handoff_to_ai",
    resourceType: "conversation",
    resourceId: conversationId,
    metadata: { lead_id: check.lead_id },
  });

  revalidatePath(`/conversations/${conversationId}`);
}

export async function sendManualReply(
  conversationId: string,
  formData: FormData
): Promise<void> {
  const [storeId, userId] = await Promise.all([
    getServerStoreId(),
    getServerUserId(),
  ]);

  const { data: conv } = await supabaseAdmin
    .from("conversations")
    .select("id, lead_id, handoff_to, conversation_status")
    .eq("id", conversationId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!conv) throw new Error("Conversa não encontrada");

  // Guard de estado: só permite resposta manual com a conversa em handoff —
  // evita colisão com a IA respondendo ao mesmo tempo (runGuardrails só
  // bloqueia a IA nesse mesmo estado, ver lib/guardrails.ts).
  const inHandoff =
    conv.handoff_to === "HUMANO" || conv.conversation_status === "AGUARDANDO_HUMANO";
  if (!inHandoff) {
    throw new Error("Assuma a conversa antes de responder.");
  }

  const mensagem = ((formData.get("mensagem") as string | null) ?? "").trim();
  if (!mensagem) {
    throw new Error("Digite uma mensagem antes de enviar.");
  }

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("phone_normalized")
    .eq("id", conv.lead_id)
    .maybeSingle();
  if (!lead?.phone_normalized) throw new Error("Telefone do lead não encontrado.");

  // Insert com sent:false primeiro — mesmo padrão do aviso de IA (item 0.7
  // parte 2): rastro reflete a realidade do envio, não assume sucesso.
  const { data: saved } = await supabaseAdmin
    .from("messages")
    .insert({
      store_id: storeId,
      conversation_id: conversationId,
      lead_id: conv.lead_id,
      direcao: "saida",
      autor: "humano",
      mensagem,
      sent_by: userId,
      meta: { sent: false },
    })
    .select("id")
    .single();

  const messageId = saved?.id ?? null;

  try {
    const phoneId = await getStoreWhatsAppPhoneId(storeId);
    await sendWhatsAppMessage(lead.phone_normalized, mensagem, phoneId);
    if (messageId) {
      await supabaseAdmin
        .from("messages")
        .update({ meta: { sent: true } })
        .eq("id", messageId);
    }
  } catch (e) {
    // Não-fatal: mensagem já persistida com sent:false, refletindo que o
    // envio não foi confirmado — vendedor vê no inbox, não é perdida
    console.error("[manual-reply] falha ao enviar mensagem manual:", e);
  }

  await logAudit({
    storeId,
    userId,
    action: "message.manual_reply",
    resourceType: "conversation",
    resourceId: conversationId,
    metadata: messageId ? { lead_id: conv.lead_id, message_id: messageId } : { lead_id: conv.lead_id },
  });

  revalidatePath(`/conversations/${conversationId}`);
}

export async function updateLeadStatus(
  leadId: string,
  conversationId: string,
  formData: FormData
): Promise<void> {
  const [storeId, actorId] = await Promise.all([
    getServerStoreId(),
    getServerUserId(),
  ]);
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

  let vehicleId: string | null = null;
  let valorFinal = 0;

  if (newStatus === "FECHADO") {
    vehicleId = (formData.get("vehicle_id")   as string | null)?.trim() || null;
    const valorFinalRaw = formData.get("valor_final")  as string | null;

    if (!vehicleId) {
      throw new Error("Selecione o veículo vendido para fechar esta venda.");
    }
    valorFinal = parseFloat(valorFinalRaw ?? "");
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
  if (newStatus === "FECHADO") {
    markReactivationConverted(leadId, storeId).catch(() => {});
    await logAudit({
      storeId,
      userId: actorId,
      action: "lead.closed",
      resourceType: "lead",
      resourceId: leadId,
      metadata: { vehicle_id: vehicleId, valor_final: valorFinal },
    });
  }
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
  const role = await getServerUserRole();
  if (role === "vendedor") {
    throw new Error("Apenas o dono da loja pode reatribuir leads");
  }

  // Guard 1: verify lead belongs to this store
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, assigned_to")
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

  const actorId = await getServerUserId();
  await logAudit({
    storeId,
    userId: actorId,
    action: "lead.reassigned",
    resourceType: "lead",
    resourceId: leadId,
    metadata: { previous_assigned_to: lead.assigned_to ?? null, new_assigned_to: userId },
  });

  revalidatePath("/leads");
}

export async function removeLeadAssignment(leadId: string): Promise<void> {
  const storeId = await getServerStoreId();
  const role = await getServerUserRole();
  if (role === "vendedor") {
    throw new Error("Apenas o dono da loja pode reatribuir leads");
  }

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, assigned_to")
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

  const actorId = await getServerUserId();
  await logAudit({
    storeId,
    userId: actorId,
    action: "lead.unassigned",
    resourceType: "lead",
    resourceId: leadId,
    metadata: { previous_assigned_to: lead.assigned_to ?? null },
  });

  revalidatePath("/leads");
}
