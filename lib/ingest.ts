import { supabaseAdmin } from "@/lib/supabase";

export type IngestResult = {
  lead_id: string;
  conversation_id: string;
  message_id: string | null;
  duplicate: boolean;
  is_new_lead: boolean;
  is_new_conversation: boolean;
};

/**
 * Ingere uma mensagem de entrada de forma atomica via RPC Postgres.
 * Race-safe: a funcao webhook_ingest_message usa INSERT ... ON CONFLICT DO NOTHING.
 * Idempotente: repetir a mesma mensagem retorna duplicate=true sem gravar.
 */
export async function ingestMessage(params: {
  storeId: string;
  phoneNormalized: string;
  contactName: string | null;
  messageExternalId: string;
  mensagem: string;
  receivedAt: string;
}): Promise<IngestResult> {
  const { data, error } = await supabaseAdmin.rpc("webhook_ingest_message", {
    p_store_id: params.storeId,
    p_phone_normalized: params.phoneNormalized,
    p_contact_name: params.contactName,
    p_message_external_id: params.messageExternalId,
    p_mensagem: params.mensagem,
    p_received_at: params.receivedAt,
  });

  if (error) throw error;
  return data as IngestResult;
}
