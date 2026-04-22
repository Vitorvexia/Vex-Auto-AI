// Logger estruturado mínimo com correlationId propagado por todo o pipeline.

export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export function createLogger(
  correlationId: string,
  base?: Record<string, unknown>
): Logger {
  const ctx = { correlationId, ...base };

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
      ...meta,
    });

  return {
    info: (msg, meta) => console.log(fmt("info", msg, meta)),
    warn: (msg, meta) => console.warn(fmt("warn", msg, meta)),
    error: (msg, meta) => console.error(fmt("error", msg, meta)),
  };
}
