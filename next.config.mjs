import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 14.2 ainda não estabilizou instrumentation.ts sem essa flag.
  experimental: { instrumentationHook: true },
  // /analytics foi consolidada em /dashboard (era /inicio) — preserva link
  // salvo/bookmark antigo. /inicio também redireciona direto pra /dashboard
  // (rota renomeada, BL-0037/DL-0019) — os dois apontam pro mesmo destino
  // final, sem encadear um redirect no outro.
  async redirects() {
    return [
      { source: "/analytics", destination: "/dashboard", permanent: true },
      { source: "/inicio", destination: "/dashboard", permanent: true },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  // org/project/authToken ausentes = upload de source map pulado (warning,
  // não erro de build) — suficiente pro item 0.4, source maps são melhoria futura.
  widenClientFileUpload: false,
  webpack: {
    automaticVercelMonitors: false,
    treeshake: { removeDebugLogging: true },
  },
});
