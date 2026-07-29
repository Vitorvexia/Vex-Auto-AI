// Hook de instrumentação do Next.js — register() roda 1x no boot de cada
// runtime (nodejs/edge). Carrega o config do Sentry certo pra cada um.
// Requer experimental.instrumentationHook=true em next.config.mjs (Next 14.2
// ainda não estabilizou isso — ver node_modules/next/dist/server/config-shared.js).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = async (
  ...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>
) => {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
