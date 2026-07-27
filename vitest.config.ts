import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  // Só usado por testes de Client Component (ex: ConversationMessages) que
  // renderizam JSX via @testing-library/react — tsconfig.json usa
  // "jsx": "preserve" (Next.js transforma via SWC no build real), então o
  // esbuild do Vite precisa desse plugin pra não deixar JSX cru no bundle
  // de teste. Não afeta testes que não importam JSX.
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
