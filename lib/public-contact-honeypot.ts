// Nome do campo honeypot do formulário de contato do site público (roadmap
// 1.4) — arquivo separado de lib/public-contact.ts de propósito: um módulo
// "use server" só pode exportar async functions (Next.js App Router), uma
// constante string ali quebraria o build. Compartilhado entre o Server
// Action (lib/public-contact.ts) e o client component que renderiza o campo
// invisível (ContactForm.tsx) — mesmo motivo de PUBLIC_SITE_ROUTE_HEADER em
// lib/public-route-header.ts.
export const HONEYPOT_FIELD_NAME = "website";
