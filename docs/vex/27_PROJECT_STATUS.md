27_PROJECT_STATUS.md
# THE VEX OPERATING SYSTEM

# PROJECT STATUS

Version: 1.0

Status: Living Document

Owner: Engineering

Last Updated: 2026-08-03

---

> "Before changing the system, understand the current system."

---

> ⚠️ **Antes de criar qualquer migration, `DL-XXXX` ou `BL-XXXX` novo:** rode `git pull` e confira o valor mais alto já existente no disco (`ls supabase/migrations/`, `grep "Decision ID" docs/vex/29_DECISIONS_LOG.md`, `grep "^BL-" docs/vex/28_BACKLOG.md`) — **nunca confie em memória de sessão**. Pode haver outra sessão/terminal trabalhando em paralelo (já aconteceu 2x: colisão de migration `029` e colisão de `DL-0008`, ver `# ENGINEERING NOTES`).

---

# PURPOSE

This document represents the current operational state of VEX.

Unlike architecture documents,

this file changes frequently.

Every engineer.

Every AI.

Every contributor.

Must read this document before starting any task.

It answers one question:

"What is the current state of the project?"

---

# PROJECT SNAPSHOT

Project Name

VEX AUTO

Current Phase

MVP Validation

Current Version

0.0.2.0 (package.json)

Overall Status

🟡 In Validation

Production Status

Internal Validation

Development Status

Active

---

# CURRENT OBJECTIVES

Primary Goal

Validate the MVP in production.

Current Focus

Reliability.

Bug fixing.

Operational validation.

Infrastructure stabilization.

NOT feature expansion.

Until MVP validation is complete,

new features should only be implemented when explicitly approved.

---

# CURRENT PRIORITIES

Priority 1

Fix blocking bugs.

Priority 2

Validate production environment.

Priority 3

Complete operational testing.

Priority 4

Improve observability.

Priority 5

Only then begin new feature development.

Exception rule

Any conscious exception to this priority order (e.g. shipping a new feature before validation is complete) requires an entry in `29_DECISIONS_LOG.md` in the same PR/commit that implements the exception — not after. No entry means the change should not have been merged.

Phase sequencing source

`docs/vex/53_ROADMAP.md` is the source of truth for phase priority (Fase 0–3, dependencies, effort) once MVP validation above is complete. This document (`27_PROJECT_STATUS.md`) still decides what can be touched *today* — in case of conflict between the two, this document wins (same hierarchy as `CLAUDE.md`, see DL-0002 in `29_DECISIONS_LOG.md`).

---

# MVP STATUS

Core Authentication

Status

✅ Stable

---

Multi-tenant

Status

✅ Stable

---

Lead Management

Status

✅ Stable

---

Kanban Pipeline

Status

✅ Stable

---

WhatsApp Integration

Status

🟡 Waiting Production Validation

Não é mais "sandbox / aguardando número real" — isso foi resolvido (B001, ver `ACTIVE BLOCKERS`). É "número real ativo em produção desde 27/07, acumulando validação": a janela inicial de ~4h com mensagens reais e `agent_status: ok` (27/07, 18:31–22:44) é começo da validação, não conclusão. Não inflar pra ✅ até rodar mais tempo.

---

AI Pipeline

Status

🟡 Waiting Production Validation

---

Follow-up Automation

Status

🟡 Waiting Production Validation

---

Lead Reactivation

Status

🟡 Waiting Production Validation

---

Analytics

Status

🟡 Functional

ROI metrics pending.

---

Deployment

Status

🟡 Production validation pending.

---

# ACTIVE BLOCKERS

Critical blockers should always remain here. Source: CLAUDE.md (2026-07-20 audit), all operational/config — no code work pending.

B001 — RESOLVIDO (evidência de 27/07/2026, documentado 28/07)

O envio de WhatsApp resolve o número por LOJA: `lib/whatsapp-credentials.ts` usa `stores.whatsapp_phone_number_id ?? env WHATSAPP_PHONE_NUMBER_ID (fallback) ?? null`. Todos os call sites de envio passam por `getStoreWhatsAppPhoneId(storeId)` — nenhum lê a env var direto. A Speed Motos tem `stores.whatsapp_phone_number_id = 1238597592667311` (número dedicado real, WABA `28099462022990346`, +55 32 98366-528). Ou seja: pra essa loja o banco resolve o número real independente do valor da env var — a env global virou irrelevante pra Speed Motos (só importaria se o campo da loja fosse nulo). Isso é a arquitetura per-tenant do DL-0002 funcionando como projetada.

Evidência:
- Causa (direta): `stores.whatsapp_phone_number_id` da Speed Motos = número real, confirmado por query. É o campo que o código lê em runtime.
- Efeito (direto): mensagens de entrada reais com WAMID em 27/07 entre 18:31 e 22:44, pipeline processando, envios de volta com `agent_status: ok`. 2 `parse_error` (LLM) e alguns `skipped_handoff` (handoff ativo, esperado).

Ressalva de evidência: não há prova ao nível do payload de qual `phone_number_id` recebeu os eventos, porque o webhook nunca captura `metadata.phone_number_id` (só `display_phone_number`, usado pra achar a loja por `stores.whatsapp_numero`). Esse dado nunca foi persistido — ausência real na base (ver `BL-0012`, `28_BACKLOG.md`). Mas como a resolução do número é por `stores.*` e não pelo payload, o payload é irrelevante pra conclusão: a cadeia código→banco→envios-ok está comprovada onde importa.

Consequência: aviso de IA (0.7 parte 2) ATIVO em produção. 0.2 (templates) a um passo — falta aprovação Meta dos 9 templates + ligar `WHATSAPP_TEMPLATE_SEND_ENABLED`.

Owner

Business Owner

Status

Resolved (evidência 2026-07-27, documentado 2026-07-28)

---

B002

~~Permanent WhatsApp Token pending.~~ RESOLVED (2026-07-23) — System User `vex-auto-api` created with full access to app + WABA, permanent (never-expires) token generated and in use.

Owner

Business Owner

Status

Resolved (2026-07-23)

---

B003

~~`CRON_SECRET` not configured on Vercel.~~ RESOLVED — verified 2026-07-21: `vercel env ls production` shows `CRON_SECRET` set (Preview + Production, since ~40 days prior). Code (`route.ts:47-52`) only falls back to the insecure any-Bearer path when the var is absent — not the case in production.

Owner

Engineering

Status

Resolved (2026-07-21)

---

B004

~~Migration 020 not yet applied in production.~~ RESOLVED — verified 2026-07-21 via direct read-only query against production Supabase (`leads` table returns `vehicle_id`/`valor_final` columns, no PGRST error).

Owner

Engineering

Status

Resolved (2026-07-21)

---

B005

MVP end-to-end acceptance test (real WhatsApp number → AI pipeline → close with margin guardrail) blocked until B001-B002 clear.

Owner

Engineering

Status

Blocked by B001 (B002 resolved)

---

B006

`lib/follow-up.ts` and `lib/reactivation.ts` send free-form text via `sendWhatsAppMessage`, not approved WhatsApp templates. Business-initiated messages (follow-up, reactivation) outside the 24h customer-service window require pre-approved templates with `{{1}}`-style placeholders — free text will be rejected by Meta in production once real business-initiated sends are attempted. Discovered 2026-07-23 while creating the first template (`follow_up`, Marketing category) for B001. Only 1 of ~9 needed templates (3 follow-up + 6 reactivation with/without vehicle) exists so far, and it's still in review.

Owner

Engineering

Status

Resolved (2026-07-29). Send path implemented (2026-07-27): `sendWhatsAppTemplateMessage` in `lib/whatsapp-send.ts`, wired into `follow-up.ts`/`reactivation.ts` behind `WHATSAPP_TEMPLATE_SEND_ENABLED` (now `true` in production). All 9 templates (`follow_up_1/2/3`, `reactivation_vehicle_1/2/3`, `reactivation_no_vehicle_1/2/3`) approved in Meta. Real send confirmed 2026-07-29: `follow_up_1` (`{{1}}="Carlos"`) sent via `scripts/test-template-send.ts` (direct call to `sendWhatsAppTemplateMessage`, bypassing the eligibility RPC/job to avoid any risk of touching a real customer's conversation), arrived on a real device, copy matched the local `TEMPLATES[1]` string in `lib/follow-up.ts` exactly (no drift between approved Meta copy and what the CRM logs to `messages`). All three closing criteria met: templates approved + flag on in prod + real business-initiated send confirmed outside the 24h session window.

Residual note: only `follow_up_1` was live-tested. `follow_up_2/3` and all 6 reactivation templates share the same code path (`sendWhatsAppTemplateMessage`) and the same param shape (1 variable, nome), so risk is low, but they haven't individually been confirmed arriving on a device — acceptable, not tracked as a blocker.

---

B007

~~Migration 024 (`024_reactivation_logs_error_message.sql`) not confirmed applied in production.~~ RESOLVED — confirmed 2026-08-01 by Vitor via direct check in Supabase Studio: `reactivation_logs.error_message` column present in the production schema.

Note: the column existing in production does not close the observability gap — `lib/reactivation.ts` does not populate it yet, and `error_category` is still entirely absent from `reactivation_logs`. That gap remains open, tracked under `# CURRENT TECHNICAL DEBT` — not reopened here, just not to be confused with this migration-applied confirmation.

Owner

Engineering

Status

Resolved (2026-08-01)

---

# RECENT COMPLETED WORK

Most recent accomplishments (source: git log, most recent first).

✅ Roadmap 1.7 — Landing page de vendas do VEX Auto fechada e validada em produção real (2026-08-04). Validado em `www.vexauto.com.br` (confirmado por browser do Vitor): hero, diferenciais, prova social (placeholder), formulário "Agende uma demonstração" (nome/empresa/telefone/e-mail opcional/mensagem opcional) — sem vazamento do Header do app autenticado nem do layout de site de loja, `PUBLIC_SITE_ROUTE_HEADER` + `isMarketingApexHost` confirmados funcionando em prod real. Investigação prévia confirmou que apex/www não serviam landing nenhuma — caíam em `app/page.tsx` → `redirect("/inicio")` → rota protegida → `/login` (`RESERVED_SUBDOMAINS` em `lib/subdomain.ts` só protegia esses hosts de virar slug de loja, não implicava rota própria). Mecanismo: `isMarketingApexHost(host, rootDomain)` (`lib/subdomain.ts`) distingue apex/www reais de qualquer outro host que hoje retorna `null` em `extractStoreSlugFromHost` (preview Vercel, domínio desconhecido) — sem essa função separada não dava pra diferenciar os casos a partir só do retorno `null`. `middleware.ts` reescreve só `"/"` nesses hosts pra `/marketing`, reaproveitando `PUBLIC_SITE_ROUTE_HEADER` (mesmo marcador do site público de loja, commit `6626f25`) em vez de criar marcador novo — efeito desejado é idêntico (sem Header do app autenticado); outros paths no mesmo host (`/login`, `/privacidade`) seguem intocados. Captura de lead comercial do próprio Vex Auto (distinto do CRM de lojas): migration 041 (`demo_requests`, RLS habilitada sem policies — mesmo padrão de `audit_logs`, migration 029 — acesso só via `service_role`), `lib/demo-request.ts` (validação pura: nome/empresa/telefone obrigatórios, email opcional validado, mensagem com limite de 2000 chars) e `lib/demo-request-actions.ts` (Server Action `createDemoRequest`, honeypot reaproveitado de `lib/public-contact-honeypot.ts`, mesmo padrão de `submitPublicContactLead`) — gravação validada via dev local contra Supabase de produção (honeypot testado, submit real gravou em `demo_requests`, confirmado por query REST com `service_role`, linha de teste apagada em seguida). `app/marketing/page.tsx` + `DemoRequestForm.tsx` — estrutura semântica mínima com copy placeholder (`[placeholder]` em cada seção); visual final e copy real ficam pra ferramenta de design própria do Vitor, fora de escopo deste scaffold. TDD RED→GREEN, 1045 testes unitários verdes (33 novos: 12 em `isMarketingApexHost` + 11 em `demo-request` + 5 em `demo-request-actions` + 5 em `middleware`), lint/typecheck limpos. Migration 041 aplicada em produção pelo Vitor via Supabase Studio. **Achados de infra no fechamento (fora do código, Hostinger/Vercel, resolvidos pelo Vitor):** registro A duplicado apontando pro apex (`2.57.91.91` antigo vs `216.198.79.1` da Vercel) — corrigido; CNAME `www` precisou de edição manual por conflito de registro pré-existente; apex configurado e válido na Vercel (redirect 308 → `www`), propagação DNS completa ainda em andamento em alguns resolvers no momento do fechamento — não bloqueante. **Achado que contradiz `DL-0012`** ("adiar DNS wildcard `*.vexauto.com.br` até haver volume", `29_DECISIONS_LOG.md`): CNAME wildcard (`*`) já está apontado pra Vercel na Hostinger, o que a decisão registrada não previa. Não resolvido agora — sinalizado como item de investigação futura (confirmar se o wildcard está de fato ativo e se `DL-0012` precisa ser atualizada ou revertida), não bloqueante pro fechamento deste item.

✅ Roadmap 1.6 — Decisão + rebase de `feat/onboarding-wizard` (2026-08-04). Branch abandonada em 21/07, nunca mergeada. Levantamento primeiro (sem tocar código): 5 commits, 580 linhas em 8 arquivos, sem overlap real de schema com RBAC 0.3 (migration 026), config visual 1.5 (migration 039) ou site público 1.3/1.4 — nada do que main fez nos 99 commits desde 21/07 tocou os mesmos arquivos. Único bug encontrado: `assertStoreAdmin()` (`lib/auth.ts`) checava `role !== "admin"`, stale desde que migration 026 renomeou o role pra `dono_loja` — quebrava pra todo dono de loja legítimo, sem gerar conflito de merge (código novo, não edita linha existente de main, bug ficaria silencioso até rodar em produção). Decisão registrada em `DL-0013` (`29_DECISIONS_LOG.md`): rebase, não descarte. Rebase (`git rebase main`, não cherry-pick — histórico preservado) resultou em 2 arquivos com conflito textual (`lib/auth.ts`, `tests/unit/auth.test.ts`), ambos resolvidos por adição pura. Fix do bug: `assertStoreAdmin` reescrito pra delegar em `getServerUserRole()` (padrão já estabelecido em RBAC 0.3) em vez de manter a query raw antiga — teste `B1` confirmado RED (`ForbiddenError` lançado pra `role: "dono_loja"` contra a implementação antiga) antes do fix, GREEN depois. Migration renumerada de 021 pra 040 (021 já estava livre em main, mas não era mais o próximo slot real — main tinha avançado até 039 desde 21/07). Merge (fast-forward) em main: guard de auth, `nextOnboardingStep` (lógica pura de derivação de passo — nome/vendedor/estoque/whatsapp), e 4 Server Actions self-service (`lib/onboarding-actions.ts`). 38 testes novos, suíte completa 1012/1012 unitários + 43/44 integração (1 falha pré-existente em `public-vehicle-listings.test.ts`, confirmada já quebrada em main antes deste merge, fora de escopo — teste desalinhado com a allowlist real da migration 039), lint/typecheck limpos. **Sem UI nenhuma** — o plano original tinha 8 tasks, só as 4 de backend foram absorvidas nesta decisão; middleware de redirect, página `/onboarding`, componente de formulário e integração no painel admin (Tasks 5-8) viram item novo de backlog, dependente deste merge. **Sem pendência de validação manual em produção** — não existe superfície nenhuma pra validar visualmente ainda, só os testes automatizados se aplicam aqui.

✅ Roadmap 1.5 — Config visual por loja (logo, cor primária, telefone, endereço, "sobre") fechado e validado em produção (2026-08-04). Migration 039: `stores` ganha `logo_url`/`cor_primaria` (`CHECK` formato `#RRGGBB`)/`telefone_publico`/`endereco`/`sobre`; bucket `store-logos` público pra leitura; RLS de `storage.objects` espelha exatamente o padrão de `vehicle-photos` (migration 032) — INSERT restrito ao `store_id` do primeiro segmento do path, com policy de UPDATE adicional porque `uploadStoreLogo` usa `upsert:true` (substitui o logo anterior no mesmo path `{store_id}/logo.{ext}`, nunca acumula lixo — diferente da galeria incremental de fotos de veículo). `public_store_lookup` (migration 035) ganha allowlist estendida — `nome`/`logo_url`/`cor_primaria`/`telefone_publico`/`endereco`/`sobre` — continua nunca expondo `whatsapp_numero`/`whatsapp_phone_number_id`. `lib/store-settings.ts` (validação pura: `isValidHexColor`, `sanitizeStoreText`, `validateLogoFile` — mesmo padrão de `lib/vehicle-photos.ts`, mas logo é arquivo único com limite de 2MB, não galeria de 5MB). `lib/store-actions.ts` — `updateStoreSettings`/`uploadStoreLogo`, guard de role (`getServerUserRole() !== "vendedor"`, mesmo padrão de `assignLeadToUser`). Página nova `/configuracoes` (link já existia no dropdown do Header, rota nunca tinha sido criada) — formulário completo pra `dono_loja`/`super_admin`, somente leitura pra `vendedor`. Site público: `getPublicStoreBySlug` (`lib/public-store.ts`) substitui `resolveStoreIdBySlug` nas duas páginas (listagem e detalhe) — título usa nome da loja, logo exibido via `StoreBrandHeader`, `cor_primaria` sobrescreve `--accent` via CSS custom property inline escopada a `.site-public` (nunca vaza pro app autenticado), bloco de contato/sobre via `StoreFooter`. **Três decisões conscientes de corte de escopo:** logo é upload único que sempre substitui o anterior (`upsert:true` em path fixo, sem galeria nem histórico — loja tem 1 identidade visual, não várias); `cor_primaria` é acento pontual (preço/CTA/links via `--accent`), não redesign completo do template público; `endereco` é texto livre sem geocoding/mapa (sem integração com Maps neste item). **Bug encontrado na primeira validação manual em produção, corrigido antes de fechar o item (commit `995fd4d`):** nome da loja duplicado na tela — `StoreBrandHeader` renderizava o nome E o `<h1>` da listagem também, mais o subtítulo "Veículos disponíveis" embaixo, 2 ocorrências visuais de "Speed Motos" na mesma página. Causa: componente novo foi ADICIONADO ao lado do heading existente em vez de SUBSTITUÍ-LO. Fix: `StoreBrandHeader` passa a renderizar só o logo (sem texto) — o nome vive exclusivamente no `<h1>`, fonte única da verdade; sem `logo_url`, o componente retorna `null` (sem div vazia). Validado localmente antes do fix subir: dev server + Supabase real, screenshot da listagem e do detalhe confirmando heading único. **Validado em produção real** (`speed-motos.vexauto.com.br`, confirmado por screenshot do Vitor): logo renderizando no topo sem duplicação de título, cor primária aplicada como acento (preço do card mudou do azul padrão pro vermelho da marca), telefone/endereço/sobre renderizando corretamente. TDD RED→GREEN, 62 arquivos de teste / 987 testes unitários verdes (42 novos: 21 em `store-settings` + 17 em `store-actions` + 4 em `public-store` estendido), lint/typecheck limpos. Migration 039 aplicada em produção pelo Vitor via Supabase Studio (colisão parcial encontrada e resolvida — algumas colunas já existiam de uma tentativa anterior, resto da migration rodou isolado sem re-executar o `ALTER TABLE` já aplicado).

✅ Roadmap 1.4 — Site da loja (template único, multi-tenant) fechado e validado em produção (2026-08-03, commit `bcf9732`). `vehicles.publicado` (migration 036, boolean default true) controla exposição no site separado de `disponivel` (controle interno) — estoque atual aparece automaticamente, dono desmarca item a item. `public_vehicle_listings` (migration 037, `CREATE OR REPLACE VIEW`) passa a filtrar `disponivel=true AND publicado=true`, allowlist de colunas herdada intacta da migration 034 (nunca custo/margem_minima — `publicado` em si não entra no SELECT, é filtro de linha, não dado público). `app/estoque/page.tsx` ganha toggle "Publicado no site" (`publishVehicle`/`unpublishVehicle` em `lib/vehicle-actions.ts`, espelha exatamente o padrão já existente de `archiveVehicle`/`unarchiveVehicle`). Listagem (`app/site/[slug]/page.tsx`) evoluiu do smoke test do 1.3 pra grid de cards com foto de capa (`photo_url[0]`), e ganhou página de detalhe nova (`app/site/[slug]/veiculo/[vehicleId]/page.tsx`) com galeria completa e formulário de contato. **Decisão mais importante da sessão, encontrada antes de virar bug em produção:** links dentro do site público são relativos (`/veiculo/[id]`, `/`), nunca `/site/[slug]/...` — em produção o visitante está no subdomínio real (`speed-motos.vexauto.com.br`), `middleware.ts` só reescreve a URL internamente; um link absoluto com o prefixo interno quebraria a navegação (o middleware tentaria reescrever de novo por cima). Formulário de contato (`lib/public-contact.ts`, Server Action) reaproveita `ingestLeadManually` (já existente, usado por `lib/actions.ts:importLead`) em vez de duplicar lógica de criação de lead — roda com `supabaseAdmin`/service_role com segurança (Server Action, não a rota de leitura pública, que continua anon-only por decisão da 1.3). Honeypot descarta bot silenciosamente sem criar lead nem expor erro; nome do campo vive em arquivo próprio, `lib/public-contact-honeypot.ts` — achado no caminho: um módulo `"use server"` só pode exportar async function, uma constante string ali quebra o build. `leads.origem` ganha o valor `'site'` (migration 038, `DROP`/`ADD CONSTRAINT leads_origem_check`, mesmo padrão já usado nas migrations 019 e 026). Testado de ponta a ponta contra produção real, não só em CI: formulário submetido em `speed-motos.vexauto.com.br/veiculo/...` criou lead de verdade, confirmado visualmente em `/leads` pelo Vitor. TDD RED→GREEN, 944 testes unitários + 9/9 de integração (`tests/integration/public-vehicle-listings.test.ts`) verdes contra Supabase real (migrations 036/037/038 aplicadas em produção pelo Vitor via Studio antes da suíte rodar verde), lint/typecheck limpos. **Nota de escopo consciente, não limitação técnica:** site público ainda sem identidade visual da loja — `public_store_lookup` (migration 035) só expõe `id`/`slug` de propósito (nunca `nome`), então o título da listagem é genérico ("Veículos disponíveis"). Resolvido no próximo item do roadmap (1.5). **Fix pós-fechamento (2026-08-03):** lead "Teste QA 1.4" criado via formulário público apareceu na conversa com "Lead importado manualmente." — texto genérico. Investigação por query direta em produção (service_role, read-only) confirmou `origem="site"` correto no banco; o bug era só a mensagem de sistema hardcoded em `createConversationAndMessage` (`lib/lead-ingestion.ts`), que não olhava `origem`. Corrigido com `SYSTEM_MESSAGE_BY_ORIGEM: Record<Origem, string>` — mapa completo (força o TypeScript a exigir mensagem pra toda origem do union, não só os 2 casos atuais), `site` → "Lead recebido pelo site.", demais origens mantêm o texto original. Teste T8c novo, 945 testes verdes, lint/typecheck limpos.

✅ Roadmap 1.3 — Rota de leitura pública por subdomínio fechado e validado em produção (2026-08-03, commits `3bf5e1e` + `6626f25`). `stores.slug` (migration 033) — primeiro identificador amigável do projeto, backfill via `unaccent`+regex a partir de `nome`, colisão resolvida por sufixo numérico ordenado por `created_at`. Duas views allowlist (migrations 034/035) em vez de `CREATE POLICY` — Postgres não permite RLS em views; mecanismo real é view rodando com privilégio do owner + filtro embutido (`disponivel = true`) + `GRANT SELECT` a `anon`: `public_vehicle_listings` (id/store_id/marca/modelo/ano/preco/photo_url/disponivel — nunca custo/margem_minima) e `public_store_lookup` (id/slug — achado durante a implementação: `stores` não tinha nenhuma policy de RLS pra `anon`). `lib/subdomain.ts` resolve slug a partir do header Host (18 testes) — `RESERVED_SUBDOMAINS` (`www`, `app`) impede que `app.vexauto.com.br` (onde o app autenticado roda de verdade em produção) seja tratado como slug de loja, achado ao escrever o primeiro teste de middleware do projeto antes de ir pra produção (`BL-0025` registra a dívida de manter essa lista atualizada a cada subdomínio de infra novo). `middleware.ts` reescreve pra `/site/[slug]` sem tocar no fluxo de auth das rotas já protegidas. `lib/public-store.ts`/`lib/supabase-public.ts` — sempre anon key, nunca service_role. Achado em teste manual real pós-deploy: a página pública herdava o Header inteiro do app autenticado (nav completa + "Sair") por estar sob o mesmo layout raiz — clicar em "Sair" dentro do subdomínio da loja dava 404 (path reescrito pra rota inexistente). Fix (`6626f25`): Next.js App Router não deixa um layout aninhado remover JSX de um ancestral, então a decisão de renderizar o Header vive no layout raiz (`app/layout.tsx`), controlada por um header interno (`x-vex-public-site`) que `middleware.ts` marca e `app/components/AppChrome.tsx` lê. Validado em produção real: `speed-motos.vexauto.com.br` mostra só o estoque da própria Speed Motos (isolamento cross-tenant confirmado por query direta no banco, zero vazamento) sem nenhum chrome de sistema autenticado; `app.vexauto.com.br` confirmado sem regressão (Header/nav normais). `app/site/[slug]/page.tsx` é smoke test do fluxo ponta a ponta, não o site final (1.4). 916 testes unitários (37 novos, TDD RED→GREEN) + suíte de integração nova (`tests/integration/public-vehicle-listings.test.ts`, 8/8 verde contra Supabase real), lint/typecheck limpos. **Dependência operacional (DL-0012):** sem wildcard DNS ainda (domínio na Hostinger, sem migração de nameservers pra Vercel) — cada loja nova exige CNAME manual na Hostinger + domínio cadastrado manualmente na Vercel até essa migração acontecer.

✅ Roadmap 1.2 — Upload de foto de veículo fechado (2026-08-01, não commitado ainda — working tree). Investigação prévia confirmou ausência total (sem coluna no schema, sem bucket, sem UI — `app/estoque/page.tsx:214` tinha "Sem foto" hardcoded) antes de implementar qualquer coisa. Schema: `vehicles.photo_url text[] default '{}'` (migration 032, aplicada em produção pelo Vitor via Supabase Studio SQL Editor — bucket confirmado público visualmente na aba Storage) — array de URLs, não coluna única, porque veículo tem galeria; 1ª posição é a capa por convenção de aplicação, não imposta pelo schema. Coluna direto em `vehicles`, mesmo padrão de 1.1/1.9 (estado atual, sem tabela satélite). Storage: bucket `vehicle-photos` público pra leitura — decisão deliberada porque o site da loja (1.4, próximo item) é rota sem sessão e precisa servir foto sem autenticação, e foto de carro à venda não é dado sensível. RLS de `storage.objects` restringe INSERT ao `store_id` do primeiro segmento do path (`{store_id}/{vehicle_id}/{filename}`, via `my_store_id()`) — mesmo princípio de isolamento duplo das tabelas (o Server Action usa `supabaseAdmin`/service_role, então a policy é o backstop, não o guard principal — guard real é `getServerStoreId()` no código). Validação pura em `lib/vehicle-photos.ts`: tipo (`image/jpeg`/`image/png`/`image/webp`), tamanho máx 5MB/foto, máx 10 fotos/veículo, sanitização de filename contra path traversal — todos defaults escolhidos nesta sessão, sem pedido explícito de valor exato. Server Action `uploadVehiclePhotos` (`lib/vehicle-photo-actions.ts`) sobe cada arquivo válido pro Storage e concatena as URLs públicas ao array existente (append-only — nunca substitui, preserva a capa histórica). `VehiclePhotoUpload` (`app/components/VehiclePhotoUpload.tsx`, Client Component) — preview local via `URL.createObjectURL` antes de enviar, sem chamada de rede na etapa de preview. `app/estoque/page.tsx` — capa exibida no card do grid quando `photo_url` não está vazio, fallback "Sem foto" preservado; galeria completa + formulário de upload na tela de edição. **Duas decisões conscientes de corte de escopo, registradas como backlog formal (não pendência aberta dentro do item):** upload só disponível na edição, não na criação (`vehicle_id` é gerado pelo banco no insert — `BL-0024`); sem exclusão ou reordenação de foto, append-only (`BL-0023`). 30 testes novos (TDD RED→GREEN, `tests/unit/vehicle-photos.test.ts` + `tests/unit/vehicle-photo-actions.test.ts`), 871/871 no total, lint/typecheck limpos.

✅ Roadmap 1.1 — Controle de RENAVE (sem API) fechado (2026-08-01, não commitado ainda — working tree). Rastreio MANUAL de status por veículo — sem chamada a API externa, sem automação de protocolo no DETRAN, pitch honesto do roadmap mantido ("o VEX organiza, valida e cobra prazo — não registra no RENAVE"). Schema: 4 colunas direto em `vehicles` (migration 031: `renave_stage` com CHECK das 4 etapas — `entrada_registrada`/`chave_nfe_vinculada`/`documentos_protocolados`/`saida_registrada` —, `renave_nfe_key`, `renave_stage_updated_by` FK `users`, `renave_stage_updated_at`) em vez de tabela nova — decisão: é estado atual 1:1 por veículo sem necessidade de histórico de transição (o histórico de quem-fez-o-quê já vive em `audit_logs`, 0.5), mesmo padrão de `leads.vehicle_id`/`valor_final` (migration 020) e `leads.agendamento_data` (migration 022). Índice parcial `vehicles_store_renave_pending_idx` (`store_id, renave_stage_updated_at) WHERE renave_stage <> 'saida_registrada'` serve o painel de pendências sem indexar o que não é consultado. Lógica pura em `lib/renave.ts`: `nextRenaveStage` sempre avança 1 degrau (estruturalmente incapaz de pular etapa — não aceita target arbitrário), `checkRenaveStageAdvance` bloqueia avanço pra `chave_nfe_vinculada`+ sem `nfe_key` preenchida (nova ou já persistida — não precisa reenviar da 2ª transição em diante), `isRenaveStalled`/`daysStalled` pro alerta de 7 dias. Server Action `advanceRenaveStage` (`lib/renave-actions.ts`) reaproveita RBAC existente (`getServerUserRole()` — dono_loja e vendedor podem, nenhum nível novo criado; `super_admin` bloqueado por não ser role de loja) e audit log (`logAudit`, ação nova `vehicle.renave_stage_advanced`, extensão de `lib/audit.ts` — `AuditResourceType` ganhou `vehicle`). Painel `/renave` (`app/renave/page.tsx`) lista veículos com `renave_stage != saida_registrada` ordenados por tempo parado (mais antigo primeiro), badge `.op-badge.parado` (convenção já usada em `/equipe`) acima de 7 dias parado no mesmo estágio, ação de avançar inline na linha (form com `.bind(null, vehicleId)`, mesmo padrão de `LeadCard`/`app/conversations/[id]/page.tsx`). Link "RENAVE" no Header entre Equipe e Analytics. TDD: RED confirmado em `tests/unit/renave.test.ts` (19 testes de lógica pura) e `tests/unit/renave-actions.test.ts` (12 testes de RBAC/sequência/nfe_key/audit) antes da implementação, depois GREEN — 31 testes novos, 841/841 no total, lint/typecheck limpos.

✅ Roadmap 1.9 — Fix do handoff que apagava o dono do lead (2026-07-31, não commitado ainda — working tree). `assignConversationToHuman` (`lib/actions.ts`) setava `handoff_to: "HUMANO"` e `assigned_to: null` no mesmo update, deixando o lead mais qualificado do funil sem dono no exato momento em que fica pronto pra humano. Investigação revelou 2 colunas `assigned_to` distintas (`conversations.assigned_to`, nunca lida em nenhuma tela/métrica, vs `leads.assigned_to`, a que `team-metrics.ts`/`app/equipe`/`app/leads` de fato leem) — a leitura literal do bug reportado (só `conversations.assigned_to`) não teria corrigido o sintoma real (lead sumindo da métrica de vendedor). Fix cobre as duas: `ownerId = leadRow.assigned_to ?? actorId` — preserva o dono existente em `leads.assigned_to` ou autoatribui a quem assume a conversa, propagado igual pra `conversations.assigned_to` via `transitionConversationStatus`, mantendo as duas colunas consistentes entre si nesse fluxo. `logAudit` da ação ganhou `assigned_to` no metadata (antes só tinha `lead_id`). TDD: RED confirmado antes do fix (4 testes falhando pelo motivo esperado em `tests/unit/actions.test.ts`), depois GREEN. 810/810 testes, lint/typecheck limpos. Sem guard de RBAC no self-claim — decisão consciente, estruturalmente incapaz de reassignment indevido (`ownerId` só assume `actorId` quando o campo já é `null`, nunca sobrescreve dono existente) — registrado em DL-0010 pra não ser "corrigido" no futuro por engano. `returnConversationToAI` deixado fora de escopo (continua zerando só `conversations.assigned_to`, `leads.assigned_to` preservado) — inconsistência entre as duas colunas fora do fluxo de handoff registrada em BL-0017, decisão de modelo de dado adiada de propósito.

⚠️ Fix: retry pra parse_error/output_error no dreno + reforço de JSON no prompt fora do horário (2026-07-31) — IMPLEMENTADO, achado de produção via evidência real, mesma disciplina de investigação de DL-0004/DL-0005 (escopo menor, não é decisão arquitetural — bug + fix documentado, sem entrada no Decisions Log). Investigação: mensagem real ("quais motos você tem", 02:27 UTC 31/07) recebeu `parse_error` (LLM devolveu texto solto em vez de JSON) e ficou **8h19 sem nenhuma resposta** — nenhum mecanismo de retry existia em lugar nenhum do sistema pra esse status (nem no dispatch, nem no cron `retry-failed.ts`, que só cobre `ok_send_failed`); só voltou a responder quando o lead mandou mensagem nova, que reabriu o claim e o dreno concatenou tudo que ficou pendente. Taxa histórica de `parse_error`: 7,6% (5/66 logs, ~2 meses) antes do deploy do fix de horário (`205da19`); 67% (4/6) na janela do incidente logo depois — amostra pequena, correlação plausível (não 100% provada) com a seção nova `[FORA DO HORÁRIO...]` reforçando justamente o contexto onde a LLM já quebrava JSON antes (histórico mostra pelo menos 2 casos pré-existentes de `parse_error` em conteúdo sobre estar fora do horário, antes de qualquer mudança de ontem). Fix 1 (`lib/pipeline-dispatch.ts`): `parse_error`/`output_error` retentam 1x com o mesmo `incomingText` (confirmado por leitura de código que `parse_error` só ocorre antes de qualquer bolha ser inserida/enviada — `runAgent` é atômico, lança exceção antes do loop de envio — sem risco de duplicar bolha parcial); `timeout`/`error`/`skipped_handoff` não retentam. Fix 2 (`lib/prompts.ts`): linha de reforço "sua resposta continua sendo APENAS o JSON" adicionada à seção fora-do-horário. 809/809 testes, lint/typecheck limpos. **Taxa real de `parse_error` fora do horário só será confirmada com mais volume de produção — monitorar `ai_logs` nas próximas semanas antes de considerar o Fix 2 validado, ou até aparecer novo silêncio prolongado.** Risco de bolha parcial duplicada no retry — checado e descartado (2026-07-31): `parse_error` só ocorre com o output inteiro falhando o parse, antes de qualquer `messages.insert`/envio WhatsApp (`runAgent`, `lib/ai.ts`, é atômico — lança exceção antes de retornar `reply_texts`; o loop de bolhas só roda depois de um retorno bem-sucedido). Nenhuma guarda adicional foi necessária.

✅ Fix: IA nunca soa como fechada fora do horário comercial (2026-07-30, commit `205da19`) — CONFIRMADO por teste manual real na Speed Motos: mensagem genérica fora do horário comercial recebeu resposta normal, sem menção a estar fechada. Causa raiz: `lib/guardrails.ts` (passo 3 de `runGuardrails`) era gate incondicional — fora do horário, `mode` virava `"off_hours"` pra QUALQUER mensagem recebida, alimentando `MODE_INSTRUCTIONS.off_hours` (`lib/prompts.ts`) e instruindo a IA a se comportar como fechada, contradizendo a proposta de valor central (IA atende 24/7). Fix: `"off_hours"` removido do union `GuardrailMode`; `GuardrailResult` ganha `outsideBusinessHours`/`businessHoursStart`/`businessHoursEnd` como campos ortogonais ao `mode` — nunca mais suprimem atendimento normal. `lib/prompts.ts` ganha seção condicional `[FORA DO HORÁRIO DE ATENDIMENTO PRESENCIAL]` — só orienta a frasear corretamente um handoff real (quando `should_handoff` dispara por outro motivo), deixando claro que é o vendedor humano que retoma no próximo horário, não a IA. Agendamento presencial (coleta de troca) passa a respeitar a janela configurada, guiado por prompt — campo é texto livre, sem parser determinístico; exceção consciente ao padrão do projeto (guardrail de margem/idade em código), registrada em `28_BACKLOG.md` BL-0016 junto com a dívida de horário como env var global em vez de config por loja. 806/806 testes, lint/typecheck limpos.

✅ Fix: lock atômico por conversa evita pipelines de IA concorrentes (2026-07-30, commit `7771784`) — CONFIRMADO por evidência real de produção (2026-07-31, não teste sintético): duas mensagens do Vitor ("oi" + "bom dia") chegaram com 131ms de diferença, mesmo número — `ai_logs` registra 1 único turno (`status: ok`, 3 bolhas), sem duplicação nem resposta contraditória. É exatamente o cenário que gerou o bug original reproduzido naturalmente em uso real. Bug de produção (Speed Motos): duas mensagens do mesmo lead chegando em requests separados do webhook disparavam `runAiPipeline` concorrente pra mesma `conversation_id` — nenhum lock cross-process existia (o único lock do código, `pendingLeadTransitions` em `lib/status.ts`, é in-process, não cobre instâncias serverless diferentes) — gerando respostas sobrepostas/contraditórias, amplificado pelo BL-0008 (multi-bolha: 2-4 mensagens por turno em vez de 1). Fix: migration `030_conversation_pipeline_lock.sql` (renumerada de 029 por colisão com `029_audit_logs.sql` — ver nota em `# ENGINEERING NOTES`), `conversations.pipeline_locked_at` + RPC `claim_conversation_pipeline_lock` (claim atômico, mesmo padrão de `webhook_ingest_message`/retry job). `lib/pipeline-lock.ts` + `lib/pipeline-dispatch.ts`: claim falhou → mensagem já persistida via `ingestMessage`, não se perde; claim ganhou → dreno concatena entrada não respondida (`created_at`, não `received_at` — evita comparar clock do lead com clock do servidor sob concorrência), roda o pipeline 1x por lote, guarda contra loop apertado se o pipeline falhar sem gerar resposta (timeout/parse/output/erro/handoff). 806/806 testes unitários/integração verdes, lint/typecheck limpos.

✅ BL-0008 — Pipeline de envio multi-bolha (2026-07-30, commit `2922e7d`) — CONCLUÍDO e VALIDADO por teste manual real na Speed Motos (bolhas chegando em ordem, com delay perceptível de 400-800ms). Priorizado via DL-0009 (exceção consciente à ordem de fase, revisão da cautela original sobre `quality_rating` da Meta — determinado por denúncia/bloqueio do usuário, não por ritmo de envio). `lib/ai.ts`: `AgentResult.reply_text: string` → `reply_texts: string[]`, cap de 4 itens, fallback pro formato antigo. `lib/prompts.ts`: schema de saída e tom viram array de bolhas. `lib/ai-pipeline.ts`: loop sequencial obrigatório (nunca `Promise.all` — risco de entrega fora de ordem), insert+envio+delay por bolha. `lib/retry-failed.ts`: reenvia só as bolhas que falharam (`failed_message_ids`), sem duplicar as que já chegaram. Migration `028_ai_logs_multi_message.sql`. A validação deste item expôs 2 bugs pré-existentes não relacionados ao BL-0008 em si — ver as duas entradas de fix logo abaixo (concorrência e horário 24/7).

✅ Roadmap 0.5 — Log de auditoria fechado (2026-07-30). Tabela `audit_logs` (migration 029, RLS zero-policy desde o desenho — só `service_role`, mesmo princípio corrigido reativamente em `leads` na migration 027 do RBAC) registra quem fez o quê em 7 ações sensíveis: `lead.reassigned`/`lead.unassigned` (`assignLeadToUser`/`removeLeadAssignment`), `conversation.handoff_to_human`/`handoff_to_ai` (`assignConversationToHuman`/`returnConversationToAI`), `message.manual_reply` (`sendManualReply`), `lead.closed` (`updateLeadStatus`, guardrail de margem), `user.created` (`createStoreUser`/`createStoreUserDirect`). `lib/audit.ts` — `logAudit()` centraliza a captura, non-fatal pro fluxo que chama (nunca quebra a Server Action) mas erro de escrita vai pro Sentry (`captureException`, 0.4) — auditoria sumindo silenciosamente seria pior que a ação falhar. `actor_role` congelado no momento da ação via `getServerUserRole()` (0.3) — histórico não é reescrito se o role da pessoa mudar depois. Sem UI de consulta nesta etapa (P — dias); fica pra quando houver necessidade real (RENAVE ou cliente pedindo). `user.role_changed` do escopo original virou `user.created` (não existe edição de role pós-criação no código hoje). Tentativa negada pelo guard de RBAC não gera log nesta etapa — decisão explícita. Spec: `docs/superpowers/specs/2026-07-30-audit-log-design.md`. Suíte completa verde, lint/typecheck limpos.

✅ Roadmap 0.3 — RBAC (3 níveis de perfil) fechado (2026-07-29). `users.role` (existia desde migration 001, nunca usado como guard) renomeado de 'admin' para 'dono_loja' (migration 026, já aplicada em produção — schema real: `dono_loja`/`vendedor`). `super_admin` continua via `ADMIN_EMAILS`/`isSuperAdmin()` (sem linha própria em `users`, sem impersonation). `getServerUserRole()` (`lib/auth.ts`) — fonte única de verdade, trata `super_admin` e `dono_loja` de forma idêntica no guard (`role !== "vendedor"` libera). Guard aplicado em `assignLeadToUser`/`removeLeadAssignment` (`lib/actions.ts`) — vendedor não pode mais reatribuir lead de/para outro vendedor. UI (`LeadAssignmentSelect`) desabilita o campo pra vendedor — cosmético, guard real é em código. Escopo de visibilidade de lead entre vendedores (qualquer vendedor ainda vê/responde qualquer lead da própria loja) permanece irrestrito por decisão explícita — DL-0008, revisar quando houver loja com 2+ vendedores ativos simultâneos. Spec: `docs/superpowers/specs/2026-07-29-rbac-lead-reassignment-design.md`. Suíte completa verde, lint/typecheck limpos.

Achado de review final de branch (mesma data): guard em `lib/actions.ts` protegia só o caminho via Server Action — a policy RLS `leads_own_store_update` (migration 005) liberava UPDATE em `leads` pra qualquer usuário autenticado da mesma loja, sem checar role, permitindo bypass via PostgREST direto (anon key + JWT da sessão, ambos já expostos no browser) tanto do guard de RBAC quanto do guardrail de margem (`updateLeadStatus`, regra inegociável do `CLAUDE.md`). Migration 027 (`drop_leads_update_rls_policy`) remove a policy — confirmado via grep que nenhum código client-side escreve em `leads` (toda escrita passa por `supabaseAdmin`/service_role em `lib/actions.ts`, que já ignora RLS; leitura em Server Components continua via `leads_own_store_select`, inalterada). Aplicada manualmente em produção (SQL Editor, 2026-07-29). RBAC agora reforçado em nível de RLS, não só de Server Action — ver DL-0008 (atualizado).

✅ Fallback de nome inválido no vocativo de follow-up/reativação (BL-0015, 2026-07-29, não commitado ainda — working tree). Investigação anterior confirmou que `nome?.trim() || "você"` (duplicado 4x entre `lib/follow-up.ts` e `lib/reactivation.ts`) só cobria `null`/vazio/espaço — nome tipo `"😊"` ou `"-"` passava direto (`trim()` não-vazio), virando vocativo sem sentido ("Olá, 😊! Vimos que..."). `lib/lead-name.ts` (novo): `isValidLeadName` (exige ao menos 1 letra Unicode via `/\p{L}/u` após trim — emoji/símbolo sozinho reprovam) + `getSafeName` (nome trimado se válido, `"você"` como fallback, reaproveitando o texto já usado hoje). As 4 ocorrências duplicadas substituídas pela chamada única. TDD: `tests/unit/lead-name.test.ts` (19 casos) escrito e vermelho antes da implementação; testes de integração adicionados em `follow-up.test.ts`/`reactivation.test.ts` cobrindo o caso emoji/símbolo nos 4 pontos de uso (`buildFollowUpText`, `followUpTemplateParams`, `buildReactivationText`, `reactivationTemplateParams`). Deliberadamente fora de escopo: origem do dado (`leads.nome`, capturado de `profile.name` da Meta no webhook) não foi validada/normalizada — fix é só no ponto de uso do template, não na captura. 724/724 testes, lint/typecheck limpos.

✅ Roadmap 0.4 — Monitoramento de erro (Sentry) fechado (2026-07-29, não commitado ainda — working tree). `@sentry/nextjs` 10.69.0: `sentry.client/server/edge.config.ts` + `instrumentation.ts` (`register()` + `onRequestError`), `next.config.mjs` com `withSentryConfig` + `experimental.instrumentationHook` (Next 14.2 ainda exige a flag). Captura explícita nos pontos que engoliam erro de propósito: `lib/ai-pipeline.ts` (8 pontos — inclui o catch principal de timeout/parse/output do LLM, risco já conhecido), `app/api/whatsapp/webhook/route.ts` (2 pontos), 4 rotas `app/api/internal/*`. `lib/actions.ts` não precisou de mudança — Server Actions lançam `Error` sem engolir, já cobertas pelo `onRequestError` automático. Scrub de PII (`lib/sentry-scrub.ts`) via `beforeSend`/`beforeSendTransaction`: regex de CPF/telefone aplicado a qualquer string (não só campo estruturado, confirmado por teste dedicado) + redação total de chaves PII conhecidas (nome, incoming_text, reply_text, cpf, etc.). Endurecimento pós-validação: `ContextLines`/`LocalVariablesAsync` desligados nos configs server/edge — essas integrações leem arquivo-fonte/variável local do disco e podem anexar conteúdo ao evento fora do alcance normal do `beforeSend`; provável causa de um PII de teste (fake) ter aparecido no dashboard antes do ajuste. `app/api/internal/sentry-test/route.ts` — endpoint interno protegido (`INTERNAL_API_KEY`, mesmo padrão de `retry-failed`) pra forçar erro de teste; substitui a `/sentry-example-page` pública do wizard padrão (este projeto não expõe ferramenta de teste sem auth). Investigação de achado adjacente: nenhum ponto do pipeline interpola nome de lead em mensagem de erro — confirmado via grep sistemático de `throw new Error`/`captureException` em todo o projeto. Vetor teórico residual anotado em `28_BACKLOG.md` (`AgentParseError` ecoa até 80 chars de output bruto da LLM). `tracesSampleRate=0`, error tracking 100%. Envio real testado e confirmado no dashboard do Sentry, PII mascarado. 700/700 testes (12 novos em `sentry-scrub.test.ts`), lint/typecheck/build limpos.

✅ B006/0.2 fechado — envio real de template WhatsApp confirmado (2026-07-29, não commitado ainda — working tree). `follow_up_1` (`{{1}}="Carlos"`) enviado via `scripts/test-template-send.ts` (chamada direta a `sendWhatsAppTemplateMessage`, sem passar pela RPC de elegibilidade/job — zero risco de acertar lead real), recebido em aparelho real, copy idêntico ao `TEMPLATES[1]` local (`lib/follow-up.ts`). 9 templates aprovados na Meta, `WHATSAPP_TEMPLATE_SEND_ENABLED=true` já ativo em produção. Fecha os 3 critérios de B006 (`27_PROJECT_STATUS.md`) e item 0.2 (`53_ROADMAP.md`).

✅ Guarda de idade no fluxo de coleta de financiamento (BL-0014, `07670a5`, 2026-07-29). Achado de compliance (análise competitiva Thera, 28/07/2026 — concorrente coleta CPF/dado financeiro de menor sem checagem). `FinanciamentoData` (`lib/agent-context.ts`) ganha `data_nascimento`; `lib/collection.ts` calcula idade (`calculateAge`, ISO `YYYY-MM-DD`, limite inclusivo no aniversário) antes de persistir CPF/renda em `applyCollectionUpdate` — menor de idade: nada de financeiro é persistido, `contexto.financiamento_bloqueio="financiamento_menor_idade"`, `pending_topics` limpo (reabre ciclo do zero pro próximo titular), handoff forçado por código. `lib/prompts.ts` instrui a IA a propor troca pra um responsável maior de idade quando detectar menor, sem forçar handoff nesse turno específico; responsável maior confirmado → `titular_diferente_do_lead=true`, bloqueio limpo, fluxo normal. Sem migration (jsonb, mesmo padrão de `troca_draft`). 10 testes novos via TDD (`ai-validation.test.ts`, `collection.test.ts`, `prompts.test.ts`) — suíte 688/688, lint e typecheck limpos. Fora de escopo: verificação de identidade real do CPF informado.

✅ Roadmap 0.9 — UI de resposta manual do vendedor — CONCLUÍDO (`0f65d99`, 2026-07-28, BL-0009). Vendedor responde o lead pelo WhatsApp sem sair do Vex Auto — fecha o vácuo operacional em que handoff só era atendível pelo WhatsApp Manager nativo da Meta, fora de `messages`, invisível a qualquer métrica. `sendManualReply` (`lib/actions.ts`): guard cross-store, guard de handoff (`handoff_to==="HUMANO"`, rejeita antes de inserir/enviar se não estiver em handoff), insert com `autor:"humano"` + `sent_by` (migration 025, `messages.sent_by → users.id`, identifica qual vendedor), rastro `meta.sent` (mesmo padrão do aviso de IA, 0.7 parte 2 — `false` no insert, `true` só após `sendWhatsAppMessage` confirmar). Form na página da conversa só habilita com a conversa em handoff. Realtime (0.8) não precisou de nenhuma mudança — INSERT em `messages` já propaga ao vivo pra qualquer `autor`. 678 testes unitários. **Desbloqueia `BL-0010`** (reprocessar mensagens não respondidas ao devolver pra IA) — pré-requisito satisfeito, pronto pra ser pego.

✅ Roadmap 0.7 — Política de Privacidade + aviso de IA — CONCLUÍDO (`795e7fc`, `be2aae3`, `5bf4196`, 2026-07-28). Parte 1: página `/privacidade` reescrita com conteúdo real (loja = controladora LGPD, VEX Auto = operador — DL-0006), no ar, sem exigir login, canal de titular = WhatsApp do atendimento (genérico, sem e-mail fictício nem número hardcoded — `5bf4196`). Parte 2: aviso de IA determinístico por código na 1ª mensagem de toda conversa nova (`lib/ai-pipeline.ts`, gatilho `is_new_conversation` do RPC `webhook_ingest_message`), `autor="sistema"`, idempotência via `messages.meta->>kind`, rastro `meta.sent` reflete se o envio WA teve sucesso — ATIVO em produção (B001 resolvido, ver `ACTIVE BLOCKERS`). 672 testes unitários cobrindo ambos os fluxos. **Pendência remanescente (não-bloqueante):** revisão jurídica profissional do texto (página + aviso) antes de onboardar cliente pagante — dívida consciente, registrada em DL-0006 (mesmo padrão do DL-0003).

✅ Inbox em tempo real (roadmap 0.8, `815e5b1`, 2026-07-27) — `app/components/ConversationMessages.tsx` isola a área de mensagens em Client Component, assina `postgres_changes` filtrado por `conversation_id`, banner de reconexão. Isolamento multi-tenant validado contra Supabase real (`tests/integration/realtime-isolation.test.ts`). Migration 023 (publication `supabase_realtime`). Achado: `realtime.setAuth()` explícito é obrigatório — DL-0004 (`29_DECISIONS_LOG.md`). Investigação de flakiness residual em teste de isolamento fechada sem bug de produto — DL-0005 + `30_KNOWN_ISSUES.md` KI-0004.

✅ Coleta de financiamento/troca + agenda interna — IA coleta dados (nome/CPF/renda/entrada em pergunta única; modelo/ano/km/serviço/agendamento em fluxo incremental) via guardrail determinístico (`lib/guardrails.ts` + `lib/collection.ts`), nunca calcula financiamento nem avalia valor de troca, força handoff por código (não confia na LLM), CPF nunca aparece em `ai_logs` (removido, não só mascarado). Página `/agenda` nova pro vendedor ver agendamentos por dia. Migration 022 (`147f1ef`, 2026-07-24). Spec: `docs/superpowers/specs/2026-07-24-financiamento-troca-collection-design.md`. Fora de escopo (backlog): recebimento de imagem/áudio via WhatsApp, integração Google Agenda.

✅ Public `/privacidade` page for Meta app publish requirement (PR #28, 2026-07-23)

✅ isNaN guards for preco/custo in updateVehicle (4505933)

✅ MVP hardening — sales guardrails, PII masking, inventory fixes, audit repairs (e61a7cf)

✅ Unarchive vehicle action and button (4682fd5)

✅ Real inventory CRUD and AI vehicle context (d4c9a99)

✅ Vercel Cron GET accepted when CRON_SECRET absent (a06035c, PR #24)

✅ Mina de Ouro Core — reactivation template enrichment + result metrics (8b1927e, PR #23)

✅ Equipe (team) page — real data, team-metrics, operational dashboard (4285a93, PR #20)

✅ Assigned To + initial salesperson management (7204bf4, PR #19)

Update this section continuously — do not let it silently rot like it did before this pass.

---

# CURRENT KNOWN RISKS

Risco de mercado: concorrente com distribuição em escala (AEG Media/Venda.IA — 700+ lojas alegadas, presença no maior evento automotivo da América Latina, parceria de financiamento com C6 Bank) pode comprimir a janela de diferenciação técnica, sobretudo porque já vende a IA de atendimento avulsa. Mitigação estratégica: diferenciação do VEX ancorada em RENAVE + site + operacional integrado (ver `DL-0007`). Monitorar; não altera prioridade de Fase 0. Ver `29_DECISIONS_LOG.md` e `53_ROADMAP.md` (Concorrentes mapeados).

Risco de mercado adicional (31/07/2026): AutoPilot CRM (site.autopilotcrm.com.br) é o concorrente vertical automotivo mais próximo do VEX identificado até agora — mesma tese, mesmo fluxo de IA, GTM mais rápido (pricing público self-serve, portais já integrados — Webmotors/OLX/Shopcar —, demo self-booking via Calendly). Diferencial deles (Modo Shadow — vendedor nunca sai do próprio WhatsApp) ataca a mesma objeção de adoção que o VEX resolve via WhatsApp oficial da loja, sem ter equivalente hoje. Análise completa em `53_ROADMAP.md` (Concorrentes mapeados). Não altera prioridade de Fase 0; monitorar se eles avançarem pra RENAVE/site próprio (fechando o gap do posicionamento B+).

**Confirmado em reunião de vendas (31/07/2026)** — AutoPilot CRM NÃO tem RENAVE. Reforça item 1.1 do roadmap (`53_ROADMAP.md`, "Controle de RENAVE sem API") como diferencial real e ainda aberto no mercado vertical automotivo, não hipotético — o concorrente estruturalmente mais próximo do VEX não fechou esse gap. Aumenta urgência de priorizar 1.1 dentro da janela de mercado (prazo RENAVE: setembro/2026). Perfil competitivo completo em `53_ROADMAP.md`.

LLM timeout under heavy load.

Cron execution time.

Meta API availability.

WhatsApp rate limits.

Infrastructure dependency on Supabase.

Every active risk belongs here.

---

# CURRENT TECHNICAL DEBT

Only active debt. Source: CLAUDE.md 2026-07-20 audit.

RBAC absent — any store user can reassign any lead (`assignLeadToUser`/`removeLeadAssignment` only check `store_id`). Blocks reliable commission attribution.

Message query has no limit.

`error_category`/`error_message` missing in `reactivation_logs`/`follow_up_logs` — WhatsApp send failures in cron jobs are silent (observability gap).

Lead assignment has no history — only current `assigned_to` is stored. Needed before commission/ROI auditing.

`calculateOperationalMetrics()` does not use `leads.valor_final` (exists since migration 020) — no revenue, margin-per-sale, or CAC in analytics yet.

Document every intentional debt.

---

# CURRENT ENVIRONMENT

Frontend

Production

Backend

Production

Database

Supabase

Hosting

Vercel

AI Provider

Anthropic

Messaging

WhatsApp Cloud API

Update whenever infrastructure changes.

---

# CURRENT RELEASE

Current Branch

fix/cron-no-secret-fallback (working branch; main is the stable branch)

Current Stable Release

0.0.2.0

Latest Deployment

Unknown — not tracked here. Check Vercel deployment history directly.

Deployment Status

Healthy

Rollback Available

Yes

---

# CURRENT QUALITY METRICS

Automated Tests

CLOSED (2026-07-27): the "603 vs 635" discrepancy seen in earlier sessions was never a bug — it was two different npm scripts covering different scope, both correct for what they measured. Do not reopen this investigation.

- `npm run test` — unit only (`tests/unit/`), what the Husky pre-push hook runs. 38 files / 612 tests passing.
- `npm run test:integration` — hits real Supabase, run deliberately (never in the push hook). 6 files / 35 tests passing.
- `npm run test:all` — both combined. 44 files / 647 tests passing.

Script separation (2026-07-27, item 0.8 review): `test` used to alias `vitest run` (unit+integration combined), which meant every `git push` silently depended on live Supabase reachability. Split so the push-blocking path (`test`) is unit-only, fast, offline, deterministic — integration is opt-in via `test:integration`/`test:all`.

Failing Tests

0 — see counts above

TypeScript

Passing

Lint

Passing

Critical Bugs

0

High Priority Bugs

Update continuously.

---

# CURRENT TEAM FOCUS

Current Sprint Goal

Validate MVP.

Engineering Rule

Do not increase complexity unnecessarily.

Current Philosophy

Stability over speed.

---

# WHAT IS NOT BEING DONE

To avoid scope creep:

No CRM expansion.

No marketplace.

No mobile app.

No unnecessary integrations.

No AI experiments outside roadmap.

No architecture rewrites.

Focus remains validation.

---

# NEXT MILESTONES

1

Production validation complete.

↓

2

Internal pilot.

↓

3

First real dealership.

↓

4

Collect feedback.

↓

5

Iterate.

↓

6

Public launch.

---

# DECISION LOG

Latest important decisions.

YYYY-MM-DD

Decision

Description

Reference

ADR-XXXX

This section is chronological.

Newest first.

---

# RECENT INCIDENTS

None

or

List latest production incidents.

Reference Postmortems.

---

# ENGINEERING NOTES

Temporary information useful during current development.

Should be cleaned periodically.

This section is intentionally mutable.

**Duas colisões de numeração por sessões paralelas (2026-07-30/31)** — motivaram o aviso no topo deste documento:

1. **Migration `029`:** duas migrations diferentes nasceram como `029_*.sql` — `029_audit_logs.sql` (item 0.5, outra sessão/terminal) e `029_conversation_pipeline_lock.sql` (fix de concorrência, esta sessão). Ambas já tinham sido aplicadas direto em produção antes da colisão ser percebida — sem dano, porque não há dependência cruzada entre as duas (tabelas/colunas distintas, nenhuma referencia a outra). A segunda foi renomeada retroativamente pra `030_conversation_pipeline_lock.sql` (só o arquivo — nada foi reaplicado no banco).
2. **Decision ID `DL-0008`:** já existia um `DL-0008` real (RBAC, item 0.3, `25193c8`) quando esta sessão criou outro `DL-0008` (multi-bolha) sem checar o arquivo inteiro antes — só tinha conferido o `DL-0007` no topo, sem ver a seção `# REAL DECISIONS` mais abaixo com o `DL-0008` já usado. Renomeado pra `DL-0009` antes do commit, sem dano (não tinha sido pushado ainda).

Lembrete de processo (ver aviso no topo deste arquivo): com mais de uma sessão/terminal ativo em paralelo, sempre `git pull` + conferir o valor mais alto no disco antes de criar migration/`DL-XXXX`/`BL-XXXX` novo — nunca assumir sequência a partir de memória da própria sessão.

---

# AI CONTEXT

Any AI starting work should understand:

The MVP is feature-complete.

Current work is validation.

Stability has priority over velocity.

Avoid architectural changes unless explicitly requested.

Respect the Constitution.

Read Known Issues before debugging.

Read Backlog before implementing.

Read AI Memory before making assumptions.

Never start coding without understanding current project status.

---

# EXIT CRITERIA FOR MVP VALIDATION

The MVP is considered validated only when:

□ Production environment configured.

□ WhatsApp production number operational.

□ Token permanent.

□ Migration applied.

□ CRON validated.

□ End-to-end tests completed.

□ No critical bugs.

□ Operational logs healthy.

□ Internal pilot completed.

Only after every checkbox is complete may the project move to the next phase.

---

# RELATED DOCUMENTS

26_INDEX.md

28_BACKLOG.md

29_DECISIONS_LOG.md

30_KNOWN_ISSUES.md

31_RELEASE_NOTES.md

33_ENGINEERING_METRICS.md

34_AI_MEMORY.md

---

End of PROJECT STATUS.