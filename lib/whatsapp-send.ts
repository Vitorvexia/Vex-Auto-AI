// ============================================================================
// WhatsApp Cloud API — envio de mensagens de saída
// ============================================================================
//
// Fluxo:
//   runAgent() → messages.insert() → sendWhatsAppMessage() → should_handoff
//
// Falha aqui é não-fatal: reply já está salvo no banco.
// ============================================================================

export class WhatsAppSendError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "WhatsAppSendError";
  }
}

const WA_API_VERSION = "v21.0";
const WA_API_BASE = "https://graph.facebook.com";

/**
 * Envia mensagem de texto via WhatsApp Cloud API.
 *
 * Requer env vars:
 *   WHATSAPP_ACCESS_TOKEN    — token de acesso do app Meta
 *   WHATSAPP_PHONE_NUMBER_ID — ID do número de telefone do negócio
 *
 * @param to   Número do destinatário em E.164 (com ou sem +)
 * @param text Texto da mensagem
 * @throws WhatsAppSendError em falha HTTP ou env vars ausentes
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string
): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new WhatsAppSendError(
      "WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID são obrigatórios"
    );
  }

  // WA Cloud API espera E.164 sem o prefixo '+'
  const recipient = to.replace(/^\+/, "");

  const url = `${WA_API_BASE}/${WA_API_VERSION}/${phoneNumberId}/messages`;

  const body = JSON.stringify({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "text",
    text: { body: text },
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const json = (await res.json()) as { error?: { message?: string } };
      detail = json?.error?.message ?? "";
    } catch {
      // ignora erro de parse na resposta de erro
    }
    throw new WhatsAppSendError(
      `WhatsApp API retornou ${res.status}${detail ? `: ${detail}` : ""}`,
      res.status
    );
  }
}
