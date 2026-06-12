// Logger estruturado mínimo com correlationId propagado por todo o pipeline.

import { maskPhone, maskEmail, maskName } from "@/lib/pii";

export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

const PHONE_FIELDS = new Set(["phone", "phone_normalized", "to", "from", "numero"]);
const EMAIL_FIELDS = new Set(["email"]);
const NAME_FIELDS = new Set(["nome", "name"]);

function sanitizeMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return meta;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (typeof value === "string") {
      if (PHONE_FIELDS.has(key)) { out[key] = maskPhone(value); continue; }
      if (EMAIL_FIELDS.has(key)) { out[key] = maskEmail(value); continue; }
      if (NAME_FIELDS.has(key)) { out[key] = maskName(value); continue; }
    }
    out[key] = value;
  }
  return out;
}

export function createLogger(
  correlationId: string,
  base?: Record<string, unknown>
): Logger {
  const ctx = { correlationId, ...sanitizeMeta(base) };

  const fmt = (
    level: "info" | "warn" | "error",
    msg: string,
    meta?: Record<string, unknown>
  ): string =>
    JSON.stringify({
      level,
      msg,
      ts: new Date().toISOString(),
      ...ctx,
      ...sanitizeMeta(meta),
    });

  return {
    info: (msg, meta) => console.log(fmt("info", msg, meta)),
    warn: (msg, meta) => console.warn(fmt("warn", msg, meta)),
    error: (msg, meta) => console.error(fmt("error", msg, meta)),
  };
}
