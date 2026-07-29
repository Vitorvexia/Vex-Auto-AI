// Config do Sentry pro runtime Edge (middleware, rotas com `export const runtime = "edge"`).
// Carregado por instrumentation.ts via register() quando NEXT_RUNTIME=edge.
// Vex Auto não usa Edge runtime hoje (webhook e rotas internas são "nodejs"
// explicitamente) — presente por completude/futuro, custo zero enquanto não usado.
import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  sampleRate: 1.0,
  tracesSampleRate: 0,

  // Mesma cautela do sentry.server.config.ts — ver comentário lá.
  integrations: (defaults) =>
    defaults.filter((i) => i.name !== "ContextLines" && i.name !== "LocalVariablesAsync"),

  beforeSend(event) {
    return scrubSentryEvent(event);
  },
  beforeSendTransaction(event) {
    return scrubSentryEvent(event);
  },
});
