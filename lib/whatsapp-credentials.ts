import { supabaseAdmin } from "@/lib/supabase";
import { WhatsAppSendError } from "@/lib/whatsapp-send";

/**
 * Resolve o Phone Number ID da Meta (WABA) para uma loja.
 *
 * Precedência:
 *   1. stores.whatsapp_phone_number_id (per-store)
 *   2. WHATSAPP_PHONE_NUMBER_ID env var (fallback single-tenant)
 *
 * Erros:
 *   - DB falha → service_error (retryable) — problema transitório, não de credencial
 *   - Nenhum valor encontrado → auth_error (permanent) — loja não configurada
 */
export async function getStoreWhatsAppPhoneId(storeId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("stores")
    .select("whatsapp_phone_number_id")
    .eq("id", storeId)
    .maybeSingle();

  if (error) {
    throw new WhatsAppSendError(
      "store_credential_lookup_failed",
      undefined,
      "service_error",
      true
    );
  }

  const phoneId =
    (data as { whatsapp_phone_number_id: string | null } | null)?.whatsapp_phone_number_id ??
    process.env.WHATSAPP_PHONE_NUMBER_ID ??
    null;

  if (!phoneId) {
    throw new WhatsAppSendError(
      "store_whatsapp_not_configured",
      undefined,
      "auth_error",
      false
    );
  }

  return phoneId;
}
