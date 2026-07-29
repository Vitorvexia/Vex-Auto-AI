import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 14.2 ainda não estabilizou instrumentation.ts sem essa flag.
  experimental: { instrumentationHook: true },
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
