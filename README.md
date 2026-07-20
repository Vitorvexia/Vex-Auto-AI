# VEX Auto

Infraestrutura operacional AI-First para o mercado automotivo — não é CRM, ERP ou ferramenta de gestão tradicional. Orquestra a jornada de venda de ponta a ponta, com IA atuando como agente operacional (não chatbot passivo).

Contexto completo de produto, filosofia AI-First e regras de negócio: [`CLAUDE.md`](./CLAUDE.md).

## Stack

- **Frontend/Backend:** Next.js 14 (App Router) + React 18 + TypeScript
- **Banco:** Supabase (Postgres + RLS, multi-tenant)
- **IA:** Anthropic Claude (`@anthropic-ai/sdk`)
- **Mensageria:** WhatsApp Cloud API
- **Deploy:** Vercel
- **Testes:** Vitest (unit + integration)

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencher SUPABASE_*, ANTHROPIC_API_KEY, WHATSAPP_*
npm run dev
```

Variáveis obrigatórias estão documentadas em `.env.example`.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run typecheck` | Checagem de tipos (`tsc --noEmit`) |
| `npm run lint` | Lint (`next lint --max-warnings 0`) |
| `npm test` | Suite completa (Vitest) |
| `npm run test:unit` | Só testes unitários |
| `npm run test:integration` | Só testes de integração |

## Documentação

- [`CLAUDE.md`](./CLAUDE.md) — fonte de verdade do produto: definição, filosofia AI-First, guardrails, pipeline de IA, fluxo do lead, estado do MVP
- [`CHANGELOG.md`](./CHANGELOG.md) — histórico de versões (canônico)
- [`docs/vex/`](./docs/vex/) — framework de engenharia (padrões, arquitetura, docs vivos de status/backlog/known-issues). Ver `docs/vex/26_INDEX.md` para navegação.
