// Config do Sentry pro runtime de browser (client components).
// Carregado automaticamente pelo webpack plugin injetado por withSentryConfig
// em next.config.mjs — não precisa de import manual em lugar nenhum.
import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Error tracking em 100% — performance monitoring desligado (fora de escopo
  // do item 0.4, evita custo/ruído desnecessário no free tier).
  sampleRate: 1.0,
  tracesSampleRate: 0,

  beforeSend(event) {
    return scrubSentryEvent(event);
  },
  beforeSendTransaction(event) {
    return scrubSentryEvent(event);
  },
});
