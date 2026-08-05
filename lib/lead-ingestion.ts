import { supabaseAdmin } from "@/lib/supabase";
import { normalizePhone } from "@/lib/phone";
import { OPEN_CONVERSATION_STATUSES, type Origem } from "@/types/domain";

export type IngestLeadInput = {
  nome: string;
  telefone: string;
  origem?: Origem;
  interesse?: string | null;
  observacao?: string | null;
  storeId: string;
};

export type IngestLeadResult =
  | { status: "created"; leadId: string; conversationId: string }
  | { status: "existing"; leadId: string; conversationId: string | null }
  | { status: "invalid_phone" }
  | { status: "missing_store" }
  | { status: "invalid_input"; field: "nome" };

export async function ingestLeadManually(
  input: IngestLeadInput
): Promise<IngestLeadResult> {
  if (!input.nome.trim()) return { status: "invalid_input", field: "nome" };
  if (!input.storeId) return { status: "missing_store" };

  const phone = normalizePhone(input.telefone);
  if (!phone) return { status: "invalid_phone" };

  const origem: Origem = input.origem ?? "manual";

  const { data: existingLead } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("store_id", input.storeId)
    .eq("phone_normalized", phone)
    .maybeSingle();

  if (existingLead) {
    const { data: openConv } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("lead_id", existingLead.id)
      .in("conversation_status", OPEN_CONVERSATION_STATUSES)
      .maybeSingle();

    if (openConv) {
      return {
        status: "existing",
        leadId: existingLead.id,
        conversationId: openConv.id,
      };
    }

    const convId = await createConversationAndMessage(
      existingLead.id,
      input.storeId,
      origem
    );
    return { status: "existing", leadId: existingLead.id, conversationId: convId };
  }

  const contexto: Record<string, string> = {};
  if (input.interesse) contexto.interesse = input.interesse;
  if (input.observacao) contexto.observacao = input.observacao;

  const { data: newLead, error: leadError } = await supabaseAdmin
    .from("leads")
    .insert({
      nome: input.nome.trim(),
      phone_normalized: phone,
      origem,
      lead_status: "NOVO",
      store_id: input.storeId,
      contexto,
    })
    .select("id")
    .single();

  if (leadError || !newLead) {
    // ON CONFLICT DO NOTHING — processo concorrente criou antes
    const { data: racedLead } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("store_id", input.storeId)
      .eq("phone_normalized", phone)
      .maybeSingle();
    return { status: "existing", leadId: racedLead?.id ?? "", conversationId: null };
  }

  await supabaseAdmin.rpc("assign_lead_to_least_loaded_vendedor", {
    p_lead_id: newLead.id,
    p_store_id: input.storeId,
  });

  const { data: existingConv } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("lead_id", newLead.id)
    .in("conversation_status", OPEN_CONVERSATION_STATUSES)
    .maybeSingle();

  if (existingConv) {
    return { status: "created", leadId: newLead.id, conversationId: existingConv.id };
  }

  const convId = await createConversationAndMessage(newLead.id, input.storeId, origem);
  return { status: "created", leadId: newLead.id, conversationId: convId };
}

/**
 * Mensagem de sistema por origem — Record<Origem, string> força o TypeScript
 * a exigir uma entrada pra toda origem existente em types/domain.ts. Uma
 * origem nova no union quebra o build aqui até alguém decidir a mensagem
 * dela, em vez de cair silenciosamente num texto genérico errado.
 */
const SYSTEM_MESSAGE_BY_ORIGEM: Record<Origem, string> = {
  whatsapp: "Lead importado manualmente.",
  portal: "Lead importado manualmente.",
  base_inativa: "Lead importado manualmente.",
  manual: "Lead importado manualmente.",
  site: "Lead recebido pelo site.",
};

async function createConversationAndMessage(
  leadId: string,
  storeId: string,
  origem: Origem
): Promise<string> {
  const { data: conv, error: convError } = await supabaseAdmin
    .from("conversations")
    .insert({
      lead_id: leadId,
      store_id: storeId,
      conversation_status: "ATIVA",
      handoff_to: "IA",
    })
    .select("id")
    .single();

  let convId: string;

  if (convError || !conv) {
    // Processo concorrente criou antes — busca a conversa existente
    const { data: racedConv } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("lead_id", leadId)
      .in("conversation_status", OPEN_CONVERSATION_STATUSES)
      .maybeSingle();
    convId = racedConv?.id ?? "";
  } else {
    convId = conv.id;
  }

  await supabaseAdmin.from("messages").insert({
    conversation_id: convId,
    lead_id: leadId,
    store_id: storeId,
    direcao: "saida",
    autor: "sistema",
    mensagem: SYSTEM_MESSAGE_BY_ORIGEM[origem],
  });

  return convId;
}
