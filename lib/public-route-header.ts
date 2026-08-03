// Nome do header interno que middleware.ts marca em toda request reescrita
// pro site público da loja (roadmap 1.3) — app/layout.tsx lê essa marca
// (via next/headers) pra decidir se renderiza o Header do app autenticado.
// Constante compartilhada pra middleware.ts e app/layout.tsx nunca divergirem
// no nome do header por um typo de string literal duplicada.
export const PUBLIC_SITE_ROUTE_HEADER = "x-vex-public-site";
