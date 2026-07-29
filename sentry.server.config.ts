// Config do Sentry pro runtime Node (Server Actions, API routes, cron jobs).
// Carregado por instrumentation.ts via register() quando NEXT_RUNTIME=nodejs.
import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Error tracking em 100% — performance monitoring desligado (fora de escopo
  // do item 0.4, evita custo/ruído desnecessário no free tier).
  sampleRate: 1.0,
  tracesSampleRate: 0,

  // ContextLines lê o arquivo-fonte do disco e anexa a linha literal do throw
  // ao evento (Source Context no dashboard) — LocalVariablesAsync captura
  // valores de variáveis locais no momento do erro via inspector protocol.
  // Ambos escapam do modelo "campo conhecido" do scrub e podem, em tese,
  // expor texto que não passou pelo restante do pipeline de redação — desligar
  // é mais barato que confiar em regex pra cobrir esses dois vetores extras.
  integrations: (defaults) =>
    defaults.filter((i) => i.name !== "ContextLines" && i.name !== "LocalVariablesAsync"),

  beforeSend(event) {
    return scrubSentryEvent(event);
  },
  beforeSendTransaction(event) {
    return scrubSentryEvent(event);
  },
});
