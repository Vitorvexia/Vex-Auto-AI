// ============================================================================
// WhatsApp Cloud API — envio de mensagens de saída
// ============================================================================
//
// Fluxo:
//   runAgent() → messages.insert() → sendWhatsAppMessage() → should_handoff
//
// Falha aqui é não-fatal: reply já está salvo no banco.
// ============================================================================

export type SendErrorCategory =
  | "rate_limited"      // 429
  | "invalid_recipient" // 400
  | "service_error"     // 5xx
  | "auth_error"        // 401, 403
  | "unknown";

// Categorias que nunca devem ser retentadas — erros permanentes.
// Fonte de verdade para retry-failed/route.ts.
export const PERMANENT_CATEGORIES: readonly SendErrorCategory[] = [
  "invalid_recipient",
  "auth_error",
] as const;

export class WhatsAppSendError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly category: SendErrorCategory = "unknown",
    public readonly isRetryable: boolean = true
  ) {
    super(message);
    this.name = "WhatsAppSendError";
  }
}

function classifyStatus(status: number): { category: SendErrorCategory; isRetryable: boolean } {
  if (status === 429) return { category: "rate_limited", isRetryable: true };
  if (status >= 500) return { category: "service_error", isRetryable: true };
  if (status === 400) return { category: "invalid_recipient", isRetryable: false };
  if (status === 401 || status === 403) return { category: "auth_error", isRetryable: false };
  return { category: "unknown", isRetryable: true };
}

const WA_API_BASE = "https://graph.facebook.com";

/** Versão da Graph API. Override via WHATSAPP_API_VERSION env var quando Meta deprecar. */
function getApiVersion(): string {
  return process.env.WHATSAPP_API_VERSION ?? "v21.0";
}

/**
 * POST compartilhado pro endpoint /messages da WA Cloud API — usado tanto por
 * texto livre (sessão de 24h) quanto por template (business-initiated).
 * Timeout de 5s: Meta API p99 é ~1s sob condições normais; sem isso uma Meta
 * API travada bloqueia até o Vercel matar a function, impedindo logAi de
 * rodar e tornando o envio falho irrecuperável pelo job de retry.
 */
async function postToWhatsApp(phoneNumberId: string, body: string): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!token || !phoneNumberId) {
    throw new WhatsAppSendError(
      "WHATSAPP_ACCESS_TOKEN e phone number ID são obrigatórios"
    );
  }

  const url = `${WA_API_BASE}/${getApiVersion()}/${phoneNumberId}/messages`;

  const controller = new AbortController();
  const sendTimeout = setTimeout(() => controller.abort(), 5000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(sendTimeout);
  }

  if (!res.ok) {
    // Descartar json?.error?.message — pode conter PII ou dados sensíveis da Meta.
    // Apenas o status code é seguro para logar/propagar.
    try { await res.json(); } catch { /* descarta */ }
    const { category, isRetryable } = classifyStatus(res.status);
    throw new WhatsAppSendError(
      `WhatsApp API retornou ${res.status}`,
      res.status,
      category,
      isRetryable
    );
  }
}

/**
 * Envia mensagem de texto via WhatsApp Cloud API.
 *
 * Requer env var:
 *   WHATSAPP_ACCESS_TOKEN — token de acesso do app Meta
 *
 * Válido só dentro da janela de sessão de 24h (resposta da IA, retry de
 * ai_logs). Fora dessa janela, a Meta rejeita texto livre — usar
 * sendWhatsAppTemplateMessage.
 *
 * @param to            Número do destinatário em E.164 (com ou sem +)
 * @param text          Texto da mensagem (truncado em 4096 chars — limite da WA Cloud API)
 * @param phoneNumberId Phone Number ID da Meta (resolvido por getStoreWhatsAppPhoneId)
 * @throws WhatsAppSendError em falha HTTP ou credenciais ausentes
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string,
  phoneNumberId: string
): Promise<void> {
  // WA Cloud API espera E.164 sem o prefixo '+'
  const recipient = to.replace(/^\+/, "");

  // WA Cloud API rejeita mensagens com mais de 4096 caracteres
  const WA_TEXT_LIMIT = 4096;
  const safeText =
    text.length > WA_TEXT_LIMIT ? text.slice(0, WA_TEXT_LIMIT - 3) + "..." : text;

  const body = JSON.stringify({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "text",
    text: { body: safeText },
  });

  await postToWhatsApp(phoneNumberId, body);
}

/**
 * Envia mensagem via template pré-aprovado da WA Cloud API (business-initiated,
 * fora da janela de 24h — follow-up e reativação). Cada template precisa estar
 * aprovado no Meta Business Manager antes do envio funcionar; template não
 * aprovado/inexistente retorna erro HTTP da Meta (ver WhatsAppSendError).
 *
 * @param to            Número do destinatário em E.164 (com ou sem +)
 * @param templateName  Nome exato do template aprovado na Meta (ex: "follow_up_1")
 * @param languageCode  Código de idioma do template (ex: "pt_BR")
 * @param params        Valores das variáveis {{1}}, {{2}}... na ordem — vira o
 *                      body component da Cloud API. Array vazio = sem parameters.
 * @param phoneNumberId Phone Number ID da Meta (resolvido por getStoreWhatsAppPhoneId)
 * @throws WhatsAppSendError em falha HTTP (inclui template não aprovado/inexistente)
 *         ou credenciais ausentes — mensagem inclui templateName pra identificar
 *         no log qual template falhou.
 */
export async function sendWhatsAppTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string,
  params: string[],
  phoneNumberId: string
): Promise<void> {
  const recipient = to.replace(/^\+/, "");

  const body = JSON.stringify({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components:
        params.length > 0
          ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }]
          : [],
    },
  });

  try {
    await postToWhatsApp(phoneNumberId, body);
  } catch (err) {
    if (err instanceof WhatsAppSendError) {
      // Identifica qual template falhou no log — sem isso, "WhatsApp API retornou 400"
      // não diferencia template não aprovado de número de destino inválido.
      throw new WhatsAppSendError(
        `${err.message} (template=${templateName})`,
        err.statusCode,
        err.category,
        err.isRetryable
      );
    }
    throw err;
  }
}
