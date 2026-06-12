import { supabaseAdmin } from "@/lib/supabase";
import type {
  LeadStatus,
  ConversationStatus,
  HandoffTo,
  Direcao,
  Autor,
  Origem,
} from "@/types/domain";

export interface AgentContext {
  store_id: string;
  store_name: string;
  lead: {
    id: string;
    nome: string | null;
    phone_normalized: string;
    lead_status: LeadStatus;
    score: number;
    origem: Origem;
  };
  conversation: {
    id: string;
    conversation_status: ConversationStatus;
    handoff_to: HandoffTo;
    summary: string | null;
    ultima_mensagem_em: string;
  };
  last_messages: {
    direcao: Direcao;
    autor: Autor;
    mensagem: string;
    received_at: string;
  }[];
  vehicles: {
    id: string;
    marca: string;
    modelo: string;
    ano: number;
    preco: number;
    custo: number;
    margem_minima: number;
  }[];
  incoming_text: string;
}

/**
 * Monta AgentContext com 5 queries paralelas ao Supabase.
 * last_messages: últimas 10 mensagens em ordem cronológica (busca DESC, revertida em JS).
 * vehicles: até 6 disponíveis na store.
 */
export async function buildAgentContext(params: {
  storeId: string;
  leadId: string;
  conversationId: string;
  incomingText: string;
}): Promise<AgentContext> {
  const { storeId, leadId, conversationId, incomingText } = params;

  const [storeRes, leadRes, convRes, msgsRes, vehiclesRes] = await Promise.all([
    supabaseAdmin.from("stores").select("nome").eq("id", storeId).single(),
    supabaseAdmin
      .from("leads")
      .select("id, nome, phone_normalized, lead_status, score, origem")
      .eq("id", leadId)
      .single(),
    supabaseAdmin
      .from("conversations")
      .select("id, conversation_status, handoff_to, summary, ultima_mensagem_em")
      .eq("id", conversationId)
      .single(),
    supabaseAdmin
      .from("messages")
      .select("direcao, autor, mensagem, received_at")
      .eq("conversation_id", conversationId)
      .order("received_at", { ascending: false })
      .limit(10),
    supabaseAdmin
      .from("vehicles")
      .select("id, marca, modelo, ano, preco, custo, margem_minima")
      .eq("store_id", storeId)
      .eq("disponivel", true)
      .limit(6),
  ]);

  if (storeRes.error) throw storeRes.error;
  if (leadRes.error) throw leadRes.error;
  if (convRes.error) throw convRes.error;
  if (msgsRes.error) throw msgsRes.error;
  if (vehiclesRes.error) throw vehiclesRes.error;

  return {
    store_id: storeId,
    store_name: storeRes.data.nome,
    lead: leadRes.data as AgentContext["lead"],
    conversation: convRes.data as AgentContext["conversation"],
    last_messages: ((msgsRes.data ?? []).reverse()) as AgentContext["last_messages"],
    vehicles: (vehiclesRes.data ?? []) as AgentContext["vehicles"],
    incoming_text: incomingText,
  };
}
