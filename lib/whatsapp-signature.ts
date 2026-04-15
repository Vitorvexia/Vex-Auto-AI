import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Valida o header X-Hub-Signature-256 da Meta (formato: "sha256=<hex>").
 *
 * A assinatura eh HMAC-SHA256 do corpo bruto usando o App Secret da Meta.
 * A comparacao eh feita em tempo constante.
 *
 * Em dev, pode-se bypassar com WHATSAPP_ALLOW_UNSIGNED=true.
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!appSecret) {
    return process.env.WHATSAPP_ALLOW_UNSIGNED === "true";
  }

  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const expected =
    "sha256=" +
    createHmac("sha256", appSecret).update(rawBody).digest("hex");

  const received = Buffer.from(signatureHeader);
  const computed = Buffer.from(expected);

  if (received.length !== computed.length) return false;
  return timingSafeEqual(received, computed);
}
