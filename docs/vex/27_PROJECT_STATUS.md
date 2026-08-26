27_PROJECT_STATUS.md
# THE VEX OPERATING SYSTEM

# PROJECT STATUS

Version: 1.0

Status: Living Document

Owner: Engineering

Last Updated: 2026-08-26

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

✅ BL-0040 — Motor único de mensagens business-initiated (follow-up + reativação), migration 044 + `lib/messaging-eligibility.ts` + `lib/opt-out.ts` (2026-08-26, implementado + validado ao vivo em produção + mergeado e deployado no mesmo dia — ver fechamento completo no final desta entrada).

- **Cadência unificada**: follow-up (20h/3d/7d, era 2h/24h/72h) e reativação (7d/15d/30d contados a partir de `leads.follow_up_completed_at`, era 14d/30d/30d contados independentemente) — pedido do founder de apertar cadência tornava real a colisão dos dois motores no mesmo lead no mesmo dia, que as cadências antigas (mais espaçadas) nunca batiam por acidente. Ver `DL-0021` pro desenho completo, incluindo os 2 achados durante a implementação (cron 1x/dia caía sempre fora do horário comercial default; âncora nova tornaria leads que nunca completam follow-up permanentemente inelegíveis pra reativação — corrigido com fallback na RPC).
- **`lib/messaging-eligibility.ts`** (novo): `canSendMarketingMessage` — opt-out > trava de frequência de 48h (`leads.last_marketing_sent_at`, compartilhada entre os dois motores) > janela de horário comercial (`stores.business_hours_start/end`, migration 044, resolve parcialmente `BL-0016`). Única porta de saída de qualquer envio business-initiated — bloqueio aqui não consome tentativa (sem claim, RPC devolve o mesmo lead no próximo cron elegível).
- **`lib/opt-out.ts`** (novo): detecção determinística (match exato de frase normalizada, nunca substring — evita falso-positivo tipo "para de vender essa moto") de pedido de opt-out, conectada no webhook logo após `ingestMessage`. `marketing_opt_out`/`marketing_opt_out_at` em `leads`, log em `audit_logs` (`lead.marketing_opt_out`, novo valor em `AuditAction`).
- **M1 (janela de sessão)**: follow-up/reativação usam texto livre (`sendWhatsAppMessage`) quando a última mensagem do lead foi há menos de 24h, template fora disso — antes o código sempre usava texto livre quando `WHATSAPP_TEMPLATE_SEND_ENABLED=false`, o que na prática já violava a janela de sessão da Meta na maioria dos disparos reais (lead que não respondeu não abre sessão nova). Nota: em produção `WHATSAPP_TEMPLATE_SEND_ENABLED=true` já está ativo desde 0.2 (`53_ROADMAP.md`), então o caminho relevante em produção hoje é texto-livre-dentro-da-janela vs. template-fora-da-janela, não o skip por flag desligada (esse só importa fora de produção).
- **M6**: `markFollowUpCompletedIfInterrupted` (`lib/follow-up.ts`), chamado do pipeline de IA (`lib/ai-pipeline.ts`) quando o lead responde no meio da sequência — marca `follow_up_completed_at` mesmo quando a sequência para antes da 3ª tentativa (sem isso a reativação nunca saberia que o follow-up "acabou").
- **vercel.json**: cron `daily-run` movido de `"0 9 * * *"` (9h UTC = 6h BRT, sempre antes da abertura da janela comercial default) pra `"0 12 * * *"` (9h BRT, dentro de 08:00–20:00) — **confirmado no diff do commit `5abd387`**. Achado durante a implementação, não fix cosmético: sem isso o gate de horário bloquearia follow-up/reativação permanentemente (Vercel Hobby só roda cron 1x/dia, não haveria segunda tentativa no mesmo dia).
- Migration 044 (`stores.business_hours_start/end`, `leads.marketing_opt_out(_at)`/`last_marketing_sent_at`/`follow_up_completed_at`) e as 2 RPCs de elegibilidade reescritas — **não aplicada em produção ainda**.

99 testes unitários novos ao todo (messaging-eligibility, opt-out, follow-up-m1-m6, reactivation-m1-eligibility, + 7 do opt-out fixo no pipeline, + fixtures atualizadas), 1225 testes unitários totais verdes, lint/typecheck limpos. **Pendências fechadas**: (1) ~~aplicar migration 044 em produção~~ ✔, (2) ~~validar em ambiente real que follow-up e reativação não colidem mais~~ ✔ Camada 1 completa (4/4 itens, ver abaixo) — Camada 2 (validação por tempo decorrido) em andamento, datas no final desta entrada, (3) ~~abrir PR contra `main`~~ ✔ PR #34 mergeada e deployada.

**Nota de processo (achado pelo founder na revisão, 2026-08-26):** os documentos desta entrada (DL-0021/BL-0040) foram commitados por engano na branch `claude/vex-redesign-visual-fase1-sqkmmf` (branch do PR #33, redesign visual, sem relação com mensageria) numa primeira passada — revertido lá (`git revert`, confirmado idêntico ao estado anterior) e reaplicado na branch correta (`feature/bl-0040-messaging-engine`), junto com um commit de sincronização dos 3 docs vivos (27/28/29) a partir do baseline correto, pra não perder DL-0018/19/20 e BL-0035-039 que só existiam na branch de redesign.

**Validação em produção — Camada 1 (2026-08-26, contra Speed Motos real):**
- Migration 044 aplicada (`supabase db push --linked`). Bloqueou no resíduo órfão `20260615193022` (já documentado em `DL-0020`/`KI-0009`) — removido via `supabase migration repair --status reverted`, verificado antes/depois (entrada oficial `020` e colunas reais `valor_final`/`vehicle_id` intactas). Relato completo em `KI-0009`, atualização de 2026-08-26.
- Item 1 (`canSendMarketingMessage` isolada): ✔ confirmado contra `stores` real da Speed Motos (opt-out, frequency cap, sem bloqueio — todos com `reason` correto).
- Item 3 (M1, texto livre vs template): ✔ confirmado contra 2 conversas reais genuinamente elegíveis agora (172h e 119.9h desde última msg do lead, ambas corretamente resolvidas pra `template`). Braço `texto_livre` sem caso real disponível hoje — coberto pelos 11 testes unitários dedicados.
- Item 4 (cron no painel Vercel): ✔ confirmado ativo depois do deploy — `npx vercel crons ls` mostra `/api/internal/daily-run` com `0 12 * * *`.
- Item 2 (opt-out, chamada direta + WhatsApp real): ✔ os dois confirmados. Chamada direta (`applyOptOutIfDetected` contra lead real da Speed Motos) gravou certo na hora. Teste real via WhatsApp (mandar "para" de verdade) **na primeira tentativa não disparou** — achado de causa raiz, não bug de lógica: `feature/bl-0040-messaging-engine` só tinha sido commitada/pushada, nunca mergeada/deployada (confirmado por 2 evidências independentes: deployment de produção mais recente na Vercel tinha 7 dias; branch sem PR aberta). O webhook real bateu no pipeline antigo, sem noção de opt-out — daí a IA ter respondido normal ("Beleza, Vitor!... Boa sorte!") em vez de confirmar.
- **2º achado real, no mesmo teste**: mesmo depois de corrigido o deploy, ficou claro um gap de design nunca especificado — o que a IA deveria responder quando opt-out dispara **dentro da conversa** (não só o gate de envio futuro de marketing). Corrigido na mesma sessão: `lib/ai-pipeline.ts` agora roda `applyOptOutIfDetected` como primeira coisa em `runAiPipeline` (prioridade sobre qualquer guardrail, inclusive handoff humano) — se detectado, suprime a LLM neste turno e envia `OPT_OUT_CONFIRMATION_TEXT` fixo ("Combinado, não vamos mais te enviar mensagens promocionais por aqui."), novo `agent_status="skipped_opt_out"`. 7 testes novos, ver `DL-0021`.
- **PR #34 aberta e mergeada em `main`** (squash, `66f81a4`), deploy automático confirmado — não só "parece pronto": GitHub API (`commits/.../status`) cruzada com Vercel confirma que esse commit exato foi buildado e está `Ready`, aliasado nos domínios reais (`vexauto.com.br`, `speed-motos.vexauto.com.br`).
- **Reteste real do "para" pós-deploy**: ✔ confirmado no banco, texto exato batendo char a char com `OPT_OUT_CONFIRMATION_TEXT` (68 chars), `marketing_opt_out_at` com timestamp novo, 2ª linha em `audit_logs`. Camada 1 fechada — os 4 itens com prova ao vivo contra produção real, não só teste isolado.
- Achado lateral (não é bug, é dado sujo): RPC real devolveu lead genuinamente elegível pra follow-up sob a nova cadência (`nome="wadaw"`, `phone_normalized="+1231333333"`, loja diferente da Speed Motos) — não tocado, registrado como `BL-0043` (limpeza de dado de teste antes do cliente 2).
- **Achado lateral #2 (arquitetural)**: `follow_up_logs`/`reactivation_logs` contam tentativas de forma **vitalícia**, sem reset por ciclo — um lead que completa 3 follow-ups fica permanentemente inelegível pra follow-up futuro, mesmo esfriando de novo meses depois. Descoberto ao tentar resetar o lead de teste do founder (3 `follow_up_logs`/1 `reactivation_logs` de ciclo já completo em ago/2026 bloqueavam elegibilidade mesmo depois de zerar os campos de `leads`). Registrado como `BL-0044` (reset de cadência não tem rota própria no produto, só via script manual — `scripts/check-messaging-cadence.ts`, novo, commitado em `main`).

**Camada 2 — validação por tempo decorrido (em andamento, iniciada 2026-08-26):** lead de teste do founder (Speed Motos, `leads.id = 68067c0a-da0a-452a-83c7-1e6bb38fbb53`) resetado pra observação limpa — `marketing_opt_out`/`last_marketing_sent_at`/`follow_up_completed_at` zerados, `follow_up_logs`/`reactivation_logs` antigos apagados (ver achado lateral #2 acima). `ultima_saida_em` da conversa = 2026-08-26T20:09:29Z, ponto zero da cadência.

Datas de checkpoint (rodar `scripts/check-messaging-cadence.ts --lead-id 68067c0a-da0a-452a-83c7-1e6bb38fbb53`):
- **2026-09-02 — checkpoint crítico #1**: confirma que `follow_up_completed_at` gravou (3ª tentativa de follow-up ou parada antecipada por resposta). Sem isso, a reativação nunca dispara — melhor descobrir aqui do que esperando até 09/09 uma mensagem que nunca chega.
- **2026-09-09 — checkpoint crítico #2, teste decisivo**: confirma que a reativação #1 dispara sem colidir com nada e que `last_marketing_sent_at` respeita os 48h entre motores — é o teste que prova que a colisão do dia 7 (motivo original de BL-0040) foi mesmo eliminada, não só em teste unitário.
- 2026-08-27 e 2026-08-29 (opcionais, follow-up #1 e #2): bons de conferir, mas erro aqui ainda dá tempo de corrigir antes dos dois checkpoints críticos acima.

🟢 BL-0037 (Fase 1, continuação) — `/inicio` renomeado pra `/dashboard` + Painel por Período novo + incidente de produção real encontrado e corrigido na mesma sessão (2026-08-25, mesma branch `claude/vex-redesign-visual-fase1-sqkmmf`, ~14 commits, pushados pra `origin` — PR #33 atualizada, branch ainda não mergeada).

- **Rota `/dashboard`** (`DL-0019`): `app/inicio/` → `app/dashboard/`, redirect permanente `/inicio` → `/dashboard` em `next.config.mjs` (mesmo padrão do redirect `/analytics` já existente, destino atualizado junto pra não encadear hop). Todo link hardcoded (sidebar, pós-login, callback OAuth, onboarding, alerta de estoque, `middleware.ts`) atualizado.
- **Painel por Período (novo)**: seletor global (pills Hoje/7 dias/30 dias/Todo período + ícone de calendário com range custom via 2 `<input type="date">`, sem lib nova) controla 4 cards novos — "Leads [período]", "Visitas agendadas [período]" (fonte `leads.agendamento_data`, migration 022), donut "Leads por Origem", donut "Leads por Vendedor". `lib/dashboard-period.ts` novo — funções puras testadas (`resolveRange`/`presetRange`/`presetRangeForward`/`breakdownByOrigem`/`breakdownByVendedor`, método do maior resto pra percentual, mesmo padrão de `lib/lead-funnel.ts`). `DonutChart.tsx` novo (componente genérico SVG, sem lib). Recomputação 100% client-side sobre 1 fetch já feito — mesmo padrão do Funil de Temperatura, zero query nova por troca de período.
- **Limpeza pós-founder-review**: primeira versão empilhava o Painel por Período novo EM CIMA do conteúdo antigo de `/inicio` (Central de Operações/ops-strip, Métricas Operacionais, Tendência Diária) — nada no pedido original mandava remover essas 3 seções, só "manter sem mudança" Funil/Alerta/Ranking, então ficaram e duplicaram "Leads Hoje" visualmente. Founder confirmou manter só o painel novo — as 3 seções antigas removidas por completo; `fetchOperationalMetrics` (5 queries) virou `fetchFunnelPeriods` (1 query, só o que o Funil precisa); `TrendChart.tsx` deletado (zero outros callers); `lib/metrics.ts` intocado (funções seguem existindo/testadas, só pararam de ser chamadas por esta página). Painel por Período agora é o primeiro conteúdo visível da página.
- **Migration 022 aplicada em produção** (`leads.agendamento_data`/`agendamento_horario`) — pendência registrada desde 2026-08-13 (linha acima, `/agenda`) finalmente fechada. Card "Visitas agendadas" defensivo: se a coluna não existisse, mostraria 0 sem quebrar a página (não foi mais preciso, mas o fallback continua no código).
- **🔴 Incidente de produção real encontrado durante auditoria de rotina, corrigido na mesma sessão (`DL-0020`)**: ao aplicar a migration 022 manualmente, `supabase migration list` revelou que `schema_migrations` só reconhecia até a 019 — migrations 020-043 (24 arquivos) nunca registradas, aplicadas historicamente via SQL Editor do Supabase Studio em vez do CLI. Auditoria read-only completa (comparando cada arquivo contra o schema real via `information_schema`/`pg_constraint`/`pg_indexes`/`pg_policy`/`pg_views`/`pg_proc`) achou **21 de 23 batendo 100%**, mas **2 migrations documentadas como "fechadas" nunca tinham sido de fato aplicadas**: `029` (`audit_logs` — tabela não existia; trilha de auditoria 100% silenciosa, `lib/audit.ts` engole o erro e manda só pro Sentry) e `031` (RENAVE — colunas ausentes; `/renave` **estava quebrada em produção**, mostrando banner de erro cru do Postgres pro usuário final). Ambas aplicadas via SQL direto (mesmo processo da 022), validadas estrutural + funcionalmente (`BEGIN`/`ROLLBACK` mimetizando exatamente `logAudit`/`advanceRenaveStage`/o SELECT de `/renave`, zero dado de teste persistido). Constraint duplicada `stores_cor_primaria_format` (não rastreada em nenhuma migration) removida. `supabase migration repair` rodado — `schema_migrations` 001-043 sem gap. **Correção de registro histórico**: a nota em `# ENGINEERING NOTES` (mais abaixo) e as entradas "✅ fechado" de 029/031 (2026-07-30 e 2026-08-01) afirmavam que a migration 029 já tinha sido aplicada em produção — não era verdade; código/testes estavam prontos há semanas, mas o deploy real do schema só aconteceu hoje.
- Processo: `superpowers:subagent-driven-development` (8 tasks do plano de redesign, implementer+reviewer dedicados por task, review final de branch com 3 findings Important corrigidos em 1 fix wave) + investigação/correção da migration guiada por instrução direta do Vitor, passo a passo, com confirmação antes de cada escrita em produção.
- 1232 testes unitários verdes, lint/typecheck limpos em cada commit. **Validação visual em produção ainda pendente** (founder vai validar o preview da PR #33 atualizada).

🟡 BL-0037 (Fase 1, continuação) — Code review da PR #33 (drag-and-drop + Funil de Temperatura, sessão 2026-08-19) corrigido: 4 findings de correção + 3 ajustes visuais pedidos direto pelo founder no preview da PR (2026-08-21, mesma branch `claude/vex-redesign-visual-fase1-sqkmmf`, **5 commits, commitados e pushados pra `origin`** — branch ainda não mergeada em main).

- **Kanban — try/catch no drag + pending escopado por coluna** (`0e9fbbe`, finding #1/#7): `endDrag()` chamava `moveLeadStatus` dentro de `startTransition` sem tratamento de erro — rejeição do servidor (status mudou entre render e drop, transição concorrente) virava unhandled promise rejection, card sumia sem feedback. Agora captura o erro e mostra toast fixo/dispensável. `pendingMove` (`lib/kanban-drag.tsx`) passa a guardar `from`/`to` da transição específica — antes um único `useTransition` compartilhado travava clique em **todas** as colunas do board enquanto qualquer card estava em voo; agora só a coluna de origem/destino daquele move fica pending.
- **`/inicio` — resposta média da IA: null ≠ 0** (`87bdb23`, finding #6): card "Resposta Média da IA" mostrava "—" mesmo quando a IA respondia rápido de verdade (ex: ~2s arredondava pra 0.0min, indistinguível de "sem dado"). `calculateOperationalMetrics` retorna `null` só quando não há par entrada+resposta no período; `0` real é preservado.
- **`/inicio` — janela real de 30 dias + ROI de reativação por `converted_at`** (`5c64e51`, findings #2/#4): `fetchOperationalMetrics` buscava leads sem filtro de `created_at` — cards "Total de Leads"/"Faturamento Gerado" rotulados "últimos 30 dias" mostravam número all-time. `windowedLeads` filtra só pro cálculo de métricas (Funil de Temperatura continua usando a base inteira, precisa de 90d/Todo período). `calculateReactivationRevenue` também estava descasado: janelava `reactivation_logs` por `logged_at` (envio) contra leads sem janela via `converted_at` (conversão) — reativação enviada há 45 dias e convertida há 3 sumia do card "Reativações Convertidas", subestimando o ROI da Mina de Ouro. Query nova filtra por `converted_at >= since`.
- **`LeadCard` — botão + menu ARIA, fallback acessível ao drag** (`91a9672`, finding #2/a11y): drag por pointer events virou o único jeito de mudar `lead_status` — sem teclado/toque, tela principal do funil ficava inoperável pra quem não usa mouse. `LeadStatusMenu.tsx` ganha botão sempre visível no canto do card + menu `role="menu"`/`"menuitem"` (seta cima/baixo navega, Enter confirma, Esc fecha e devolve foco). `validLeadTargets` (`lib/lead-transitions.ts`, nova função pura testada) aplica a mesma exclusão de `FECHADO` que o guardrail de margem já impõe no drag/servidor. Renderizado como irmão do `Link` do card (não filho — evita aninhar interativo dentro de `<a>`).
- **3 ajustes visuais pedidos pelo founder no preview** (`02e5c86`): BarChart "Leads por Status" removido de `/leads` (import + `statusBars` + card — já virara redundante desde que o Funil de Temperatura ficou só em `/inicio`; `BarChart.tsx` intocado, segue em uso lá). Ícone do botão "mover status" trocado de chevron duplo (lia como cadeado) pra duas setas opostas — leitura mais clara de "trocar/mover etapa". `.lead-card-chat` ("Abrir conversa →") ganha fundo+borda outline accent (mesma família do `.lead-create-trigger`, versão menor/secundária) — continua `<span>` de propósito, não `<button>`: o `Link` do card inteiro já é o alvo do clique, `<button>` aninhado em `<a>` seria HTML inválido.

Intocado em toda a rodada: `moveLeadStatus`, `canTransitionLeadStatus`/`validLeadTargets` (guardrail de margem), layout das colunas do kanban. 1204 testes unitários verdes, lint/typecheck confirmados limpos nesta sessão de documentação (2026-08-24). **Validação visual no preview da PR feita pelo founder em 2026-08-21** (motivou os 3 ajustes acima); dev server local não ficou de pé nesta sessão de 2026-08-24 (processo derrubado externamente 2x) — revisão desta sessão foi só leitura de diff/testes, sem nova rodada de validação ao vivo no browser.

🟡 BL-0037 (Fase 1, continuação) — `/leads` kanban ganha drag-and-drop custom (troca do nativo HTML5) + `/inicio` ganha Funil de Temperatura (SVG, 4 camadas incluindo Conversão) + `/login` ganha toggle mostrar/ocultar senha (2026-08-19, mesma branch `claude/vex-redesign-visual-fase1-sqkmmf`, **22 commits desta sessão, commitados e pushados pra `origin`** — branch como um todo ainda não mergeada em main / não em produção, PR aberta pra review). PR #32 (rodada anterior, 2026-08-17) foi mergeada no início desta sessão — o trabalho abaixo é tudo posterior a esse merge, na mesma branch.

- **`/login` — toggle mostrar/ocultar senha** (`5a6a3e1`, `c1f1514`): ícone de olho no campo senha alterna `type="password"`/`"text"`. Teste `login-page.test.ts` precisou trocar `getByRole("button")` (agora ambíguo com 2 botões na tela) por `querySelector('button[type="submit"]')`.

- **Kanban de `/leads` — drag-and-drop nativo HTML5 substituído por pointer-based custom** (`78cf409` → `d4d9475`, 6 commits): drag nativo tinha 3 problemas sem solução dentro do próprio modelo do browser — (1) ghost translúcido do navegador competia visualmente com o card original ainda visível no lugar ("efeito vaso fantasma"), (2) card arrastado ficava cortado pelas bordas/scrollbar da coluna (`overflow-y:auto` de `.kanban-col-body` clipa qualquer elemento elevado dentro dela), (3) sem controle de animação real. Reescrito do zero com Pointer Events: `lib/kanban-drag.tsx` novo (Context — payload/delta/hover/pending, `moveLeadStatus` chamado no `endDrag`), `LeadCard.tsx` reporta posição via `onPointerMove` throttlado em `requestAnimationFrame` (evitava travar a main thread — INP flagou >11s de bloqueio numa versão sem throttle), card visível durante o drag renderizado num **portal em `document.body`** (`position:fixed`, escapa do overflow de qualquer coluna), `preventDefault` no `pointerdown` pra não disparar seleção de texto nativa em paralelo. `moveLeadStatus`/validação de transição/guardrail de margem: intocados.

- **`/inicio` — Funil de Temperatura novo, substitui o card "Leads por Status"** (`0cb4647` → `2f88356`, ~14 commits, muita iteração visual em cima de feedback ao vivo do founder): SVG puro (sem lib), 3 camadas de temperatura (Frio=Novo+Engajado, Morno=Interessado, Quente=Quente+Negociação) + 4ª camada **Conversão** (Fechado, verde `--status-fechado`, sempre mais estreita que Quente) em forma de cone contínuo — cada lateral usa bezier cúbica com pontos de controle ancorados na própria coordenada x do topo/base (garante afunilamento monotônico por convexidade, sem overshoot). Cor Frio reaproveita `--accent` (#005BFE, azul de marca) — não é token novo; Morno/Quente ganharam 2 tokens novos (`--funnel-morno`/`--funnel-quente`) documentados em **DL-0018** por não terem equivalente semântico nos 7 status já existentes. Cada camada mostra breakdown por etapa real (nome + quantidade + %) com linha conectora reta na cor da camada — `calculateStageBreakdown`/`calculateFunnelConversion`/`calculateConversionRate` em `lib/lead-funnel.ts` (puro, TDD, método do maior resto/Hamilton pra arredondamento de % sem perder/sobrar ponto). Taxa de conversão geral (Fechados/todo o volume do período, **incluindo Perdidos no denominador** — taxa real, não só de quem "sobreviveu"). Toggle de período: 7 dias / 30 dias / 90 dias / Todo período — recalcula tudo, filtro client-side sobre o mesmo array de leads já buscado (zero query nova). Clique numa camada de temperatura filtra o kanban (`?stage=frio|morno|quente`) — feature implementada mas **atualmente sem uso** (funil só existe em `/inicio`, que não tem kanban; o founder pediu remoção do funil de `/leads` depois de ver os dois juntos). `LEAD_STATUS_LABELS` centralizado em `types/domain.ts` (era duplicado em `KanbanColumn.tsx`).

1186 testes unitários verdes, lint/typecheck limpos em cada commit. Validado ao vivo em produção (preview deployment) a cada mudança — sessão teve um incidente à parte: webhook GitHub→Vercel parou de disparar deploys automáticos no meio da sessão (~1h40 sem nenhum deployment novo pra 2 commits seguidos, sem erro visível), resolvido com um commit vazio (`2742b21`) que reativou o disparo — causa raiz não identificada, ver nota em Known Issues se precisar investigar de novo.

🟡 BL-0037 (Fase 1, continuação anterior) — `/leads` ganha filtro por vendedor default-próprio, kanban drag-and-drop nativo e gráfico de status, substituindo dropdown/chips/tabela redundantes (2026-08-17, mesma branch `claude/vex-redesign-visual-fase1-sqkmmf`, **6 commits, commitados e pushados pra `origin`** — branch como um todo ainda não mergeada em main / não em produção). Sessão conduzida via `superpowers:brainstorming` (bounded) em cada mudança — desenho curto no chat, aprovação explícita do founder antes de cada implementação.

- **Filtro default no próprio usuário** (`67783c5`): `/leads` sem `?assignedTo` na URL passa a filtrar `assigned_to` pelo usuário logado em vez de mostrar todos — `resolveAssignedToFilter` extraído pra `lib/lead-filter.ts` (TDD, puro). Link "Todos" passa a exigir `?assignedTo=all` explícito, pra distinguir do estado default. Nav lateral continua indo pra `/leads` puro → sempre entra filtrado na própria pessoa. Vale pra qualquer role (vendedor/dono_loja/super_admin).
- **Kanban mais largo** (`ec2d7e9`): colunas 216px/206px → 264px/250px.
- **Drag-and-drop nativo no kanban** (`d4d1efc`): dropdown "Mover para..." removido do `LeadCard` — card vira `draggable`, solta em cima da coluna alvo. `KanbanColumn` valida a transição em tempo real (`canTransitionLead`) e destaca coluna válida/inválida durante o arraste; `FECHADO` nunca aceita drop (mesmo guardrail de margem que `moveLeadStatus` já impõe no server — dupla camada preservada). **Achado técnico no meio do caminho**: `lib/status.ts` importa `supabaseAdmin` (service_role) no topo do módulo — `LeadCard`/`KanbanColumn` virando `"use client"` não podiam importar de lá sem vazar a service key pro bundle do browser (throw no module load do client). `LEAD_TRANSITIONS`/`canTransitionLead` extraídos pra `lib/lead-transitions.ts` (módulo puro, zero I/O); `lib/status.ts` reexporta as duas — todo import existente (`@/lib/status`) continua funcionando sem mudança de comportamento (`status-transitions.test.ts` seguiu verde). `dataTransfer.getData()` só é legível em `dragstart`/`drop` (bloqueado em `dragover`/`dragenter` pelo browser) — o status de origem viaja num tipo MIME próprio (`dragFromMime`), legível via `.types` durante o arraste, pra dar highlight em tempo real sem esperar o drop.
- **Filtro "Todos/Sem responsável/Vendedores" + KPIs viram gráfico** (`10dae71`): fileira de pill por vendedor vira 3 itens fixos, "Vendedores" abre `<details>` nativo (sem lib) com a lista — summary mostra o nome do vendedor ativo. Chips "No pipeline"/"Quentes"/"Em negociação"/"Ativos hoje" viram `BarChart` "Leads por Status" (mesmo componente já usado em `/inicio`, reaproveitado) — "Quentes" (prioridade por score+handoff) e "Ativos hoje" (corte de tempo) não entram na barra por serem dimensão diferente do status puro do funil.
- **Badge "Lead Atrasado" + filtro `?atrasado=1`** (`b030620`): badge flutuante (mesmo padrão visual de `AlertsWidget` de `/inicio`, mas link direto em vez de painel popover) substitui o chip "Sem resposta >2h". `isStaleLead` extraído pra `lib/lead-filter.ts` (TDD) — mesmo limiar de 2h usado no contador do badge e no filtro, fonte única de verdade. Tabela "Vendedor/Leads/Quentes/Fechados" removida de `/leads` — decisão do founder de que isso é escopo de `/equipe` (feature futura), não do pipeline.
- **Reordena filtro + move gráfico + polish premium no drag** (`cca90a6`): "Atrasados" vira pill permanente ao lado de "Sem responsável" (era condicional). Gráfico desce pra depois do kanban. Drag ganha lift de verdade (`scale(1.045) rotate(-1.5deg)` + sombra funda) no lugar de só opacidade cair; coluna-alvo ganha anel de glow inset (accent azul/vermelho) no lugar da borda tracejada; cards ganham entrada suave no mount (respeita `prefers-reduced-motion`) — pedido explícito do founder ("está muito cru... quero algo saas que fatura bilhões").

1168 testes unitários verdes (11 novos desta sessão: `resolveAssignedToFilter`/`isStaleLead` em `lead-filter.test.ts`), lint/typecheck limpos em cada commit. Validado ao vivo no browser (Chrome DevTools MCP) a cada mudança — dev server local, drag válido/inválido testado manualmente, filtro+gráfico+badge conferidos com dado real de teste. **Pushado pra `origin/claude/vex-redesign-visual-fase1-sqkmmf`, sem validação em produção real** — mesma branch não mergeada de BL-0037.

🟡 BL-0037 (Fase 1) — Redesign visual continuado + consolidação Início/Analytics + Agenda com calendário real (2026-08-13, branch `claude/vex-redesign-visual-fase1-sqkmmf`, **não mergeada em main, não em produção** — aguardando validação visual do founder). Sessão longa cobrindo várias frentes:

- **Sidebar**: largura 196px→142px (ajustada pro fim de "Analytics", label mais longo do menu — depois iterada pra 142px com o item "Analytics" removido). Esquema de cor do fundo iterado 3x com o founder (preto puro → azul quase-preto `#050914` → voltou ao azul original `#0A0E14`/`#1C2B3A`, aprovado como estava). Item ativo do menu ganhou fill sólido do accent (era só tint 22%+borda).
- **`/inicio` consolidado com `/analytics`** (reversão consciente de escopo original de Meta Ads/tráfego pago — ver nota abaixo): rota `/analytics` removida, redirect 308 pra `/inicio` em `next.config.mjs`. Central de Operações passa a ser 100% dado real (antes 100% mock hardcoded): `lib/metrics.ts` ganha `countLeadsToday` (pura, testada), `lib/lead-priority.ts` ganha `countStaleLeads` (generaliza o cálculo já usado em `/leads`), `lib/vehicle-margin.ts` novo (extraído de `app/estoque/page.tsx`, `marginPercent` agora reusável/testado). Layout final: ops-strip (KPIs reais com borda-topo por status, mesmo idioma do kanban, pulso "IA operando"), seção "Métricas Operacionais" nova (8 métricas que só existiam em Analytics), Alertas full-width no topo com dado real (sem resposta >24h, margem baixa no estoque), Leads Quentes real via `calculateLeadPriority`/`sortLeads`. Seção "Atividade Recente da IA" removida (mock sem função real por trás, decisão do founder: Início é central de métricas/alertas, não feed de atividade). `BL-0038` registrado — 3º alerta do mock original (handoff >40min) não virou real, falta decisão de arquitetura (audit_logs vs coluna nova `handoff_at`).
- **Fix de bug pré-existente**: `app/globals.css` usava `var(--text-muted)`, que nunca foi definida (só `--muted` existe) — `.metric-label`/`.metric-sub` renderizavam sem a cor certa.
- **Merge de duas branches**: o trabalho de consolidação foi feito numa branch/worktree separada (`worktree-feat+meta-ads-dashboard`, baseada em `main` antigo) e depois mergeada de volta na branch de redesign visual (que tinha o trabalho de sidebar/ops-strip mais recente, ainda não commitado). Conflito real em `app/inicio/page.tsx` resolvido combinando o markup visual (ops-strip) com a lógica/dado real da consolidação — achado durante o merge: git tinha deixado uma referência solta a `ALERTS` (array mock que não existia em nenhum dos dois lados) numa seção que o merge automático considerou "sem conflito", corrigido manualmente antes de quebrar o build. `app/components/Header.tsx` removido (já obsoleto, substituído por `Sidebar.tsx`).
- **`/login` redesenhado**: `Sidebar.tsx` ganha early-return pra `/login` (vazava a nav autenticada na tela de login antes). Logo (`docs/vex/assets/brand/LOGO.png`) substitui o texto "Vex Auto". Fundo com recorte de `docs/vex/assets/brand/MOCKUP.png` (imagem de referência do founder), desfocado+escurecido — calibrado em 2 rodadas (começou ofuscado demais). Overlay de "Entrando…" com spinner cobre a transição pós-login até a próxima página carregar (o botão em si continua resetando assim que a autenticação resolve — comportamento já testado, evita bug antigo de botão preso — mas antes não havia nada preenchendo o vácuo visual até a navegação completar).
- **`/agenda` ganha calendário mensal real**: `lib/agenda-calendar.ts` novo (TDD, 12 testes) — `buildMonthGrid`/`addMonths`/`monthRange`, grid de semanas domingo-sábado com padding do mês vizinho, hoje marcado. Página mostra o mês inteiro (cada dia com até 2 chips de lead+horário), navegação de mês, tabela de detalhe do dia selecionado abaixo (mantida). `.table` nunca tinha CSS de verdade (classe usada sem regra nenhuma) — adicionada. **Achado, não regressão desta mudança**: `leads.agendamento_data`/`agendamento_horario` (migration 022) não existe nesta instância Supabase — migration documentada como aplicada no `CLAUDE.md` mas nunca rodada aqui de fato. Calendário funciona, só não mostra agendamento real até a migration ser aplicada via Supabase Studio.

**Correção de escopo durante a sessão**: pedido inicial incluía Fases 2/3 de integração com Meta Marketing API (dashboard de tráfego pago) — canceladas pelo founder antes de qualquer código ser escrito (na prática a maioria das lojas terceiriza tráfego pago pra agência, o lojista não teria nem acesso pra autorizar o OAuth). **`DL-0011` (VEX não constrói dashboard de tráfego/anúncios) permanece válida, não foi revertida.**

1144 testes unitários verdes (28 novos desta sessão: `countLeadsToday`, `countStaleLeads`, `marginPercent`, `buildMonthGrid`/`addMonths`/`monthRange`), lint/typecheck limpos, hook de pre-push (lint+typecheck+test) passando em todos os pushes. Sem validação manual em produção real ainda — branch aguardando review visual antes de merge/deploy.

**Sessão adicional (2026-08-14, mesma branch)** — fecha a nota de escopo deixada em aberto na sessão BL-0026 (linha acima, "Setup Inicial 3/5 é 100% mock"): parte do dashboard "Central de Operações" ganha dado real e visualização de verdade.
- **Login**: redirect pós-login trocado de `/leads` pra `/inicio` (`app/login/page.tsx` + `app/auth/callback/route.ts`, fallback de `redirectTo`/`next`).
- **`/inicio` — gráficos reais**: `TrendChart` (SVG server-rendered, sem lib nova — suavização por curva quadrática nos pontos médios, não Catmull-Rom, porque overshoot em dado esparso com dias zerados intercalados por picos isolados criava vale abaixo de zero) mostrando 30 dias de leads novos/follow-ups/reativações; 2 `BarChart` horizontais (distribuição de leads por status usando as 7 cores `--status-*` já existentes no Kanban; IA vs Humano). Cores da trend validadas contra CVD via `dataviz` skill (`#005BFE`/`#14B8A6`/`#F59E0B` — as duas não-accent trocadas de `#10B981`/`#FB923C` originais porque colidiam por acaso com hex de status já reservado, `#10B981` = `--status-fechado` exato).
- **Métricas novas** (`lib/metrics.ts`, TDD): `revenue_generated` (soma `valor_final` dos leads `FECHADO` no período — primeira vez que `leads.valor_final`, existente desde a migration 020/Guardrail de Margem, é lido por `calculateOperationalMetrics`) e `calculateReactivationRevenue` (conta + soma faturamento de leads que foram reativados pela Mina de Ouro e depois fecharam — usa `reactivation_logs.converted_at`, já gravado por `markReactivationConverted` desde a migration 018/019, nunca consumido em métrica antes). Exibidas como stat "hero" (`.ops-metric-hero`, `--status-fechado`, 34px) e card "Reativações Convertidas".
- **Ranking de Vendedores**: `SellerMetrics` (`lib/seller-metrics.ts`) ganha campo `revenue`; novo card em `/inicio` lista top 5 por faturamento fechado, medalha ouro/prata/bronze nos 3 primeiros.
- **Widgets flutuantes**: "Setup Inicial" (mock do checklist, ainda não é dado real — só a apresentação mudou) e "Alertas" viram popups colapsados ícone-only (SVG inline, não emoji) fixos no canto superior direito, abrem em painel ao clicar. Achado durante a implementação: `position:fixed` cobria o valor de uma barra do gráfico "Leads por Status" ao rolar a página — corrigido com `padding-right` reservado no container da página.
- **`/leads` — Criar Lead + Kanban redesign**: `LeadImportCard` (form já existente, `importLead` Server Action inalterada) reembalado em `<dialog>` nativo atrás de um botão "+ Criar Lead" no header, em vez de card sempre visível ocupando o topo da página. Kanban: `.lead-assignment-select` (dropdown de atribuir vendedor) não tinha CSS nenhuma desde que o componente existe — renderizava como `<select>` puro do navegador; unificado com o dropdown de "mover status" numa única bandeja (`.lead-card-tray`) com chevron customizado e estados de hover/focus.
- Zero migration nova, zero Server Action nova (só leitura adicional de colunas já existentes). TDD RED→GREEN em toda a lógica pura nova, 1160 testes unitários verdes, lint/typecheck limpos, verificado ao vivo no browser (Chrome DevTools MCP) contra dev server local a cada mudança visual — **sem validação em produção real ainda**, mesma branch não mergeada do item acima.

✅ Roadmap 1.11 — Handoff parcial por assunto (preço/negociação) fechado e validado em produção real (2026-08-05). Corrige o caso real documentado em `BL-0011` (2026-07-27): `"tem desconto nela?"` disparava o guardrail de margem (`lib/prompts.ts`, REGRAS FIXAS) e matava a conversa inteira via `should_handoff=true` — a pergunta seguinte, `"tem quantas 160 no momento?"` (estoque, sem relação com preço), ficava sem resposta porque `runGuardrails` (`lib/guardrails.ts`) era um gate binário incondicional. Escopo contido a 1 único tópico ("preco_negociacao") por decisão explícita — não é engine genérica de múltiplos tópicos. `conversations.handoff_topics` (migration 043, jsonb, default `[]`) — vazio + `handoff_to=HUMANO` é o estado "handoff legado/total": bloqueia tudo, comportamento idêntico ao pré-1.11 (preserva conversas já em handoff no momento do deploy). Presente com `"preco_negociacao"` — o guardrail (`lib/guardrails.ts`, passo 2 reestruturado) só bloqueia mensagem nova que efetivamente bate com `detectSignals` do tópico suspenso; qualquer outro assunto segue fluxo normal (mode/collection computados normalmente), mesmo com a conversa ainda `AGUARDANDO_HUMANO`/`handoff_to=HUMANO` — só a pergunta de preço continua esperando o vendedor. `lib/lead-scoring.ts` ganha sinal determinístico novo `preco_negociacao` (frases: desconto/abaixa/consegue diminuir/menor preço/consegue baixar/tem como abaixar) — propósito distinto do sinal `preco` já existente (aquele mede interesse pra scoring, este decide pertencimento ao tópico suspenso do handoff); classificador roda antes da LLM, evitando o problema circular de pedir pra LLM classificar se ela mesma pode ou não ser chamada.

**Decisão de design tomada durante a implementação, além do escopo literal do pedido:** `lib/ai-pipeline.ts` só marca `handoff_topics=["preco_negociacao"]` quando `should_handoff` vem da decisão da LLM via regra de margem — quando `should_handoff` é forçado pelo código por coleta de financiamento/troca completa (`update.forceHandoff`, fluxo já existente desde a coleta financiamento/troca), `handoff_topics` **não** é marcado, ficando no estado "legado/total". Razão: esse handoff é estruturalmente total — o vendedor precisa assumir a conversa inteira pra continuar financiamento/troca (ligar pro lead, confirmar dados, agendar), não só responder uma pergunta pontual de preço. Marcar como `preco_negociacao` nesse caso liberaria a IA pra responder mensagens que deveriam ficar 100% com o humano, criando uma regressão pior que o comportamento anterior à 1.11. Testado explicitamente (`tests/unit/ai-pipeline.test.ts`, teste dedicado) que esse caminho preserva o comportamento antigo (`{ handoff_to: "HUMANO" }`, sem `handoff_topics`).

`returnConversationToAI` (`lib/actions.ts`) limpa `handoff_topics` pra `[]` junto com `handoff_to=IA` — só 1 tópico possível hoje, resolver sempre limpa tudo. Badge visual em `app/conversations/[id]/page.tsx` (`.op-badge quente`, classe já existente reaproveitada, zero CSS novo) — "Aguardando humano — preço/negociação" quando `handoff_topics` não vazio.

TDD RED→GREEN em cada ponto estrutural (migration, sinal em `lead-scoring.ts`, `agent-context.ts`/`status.ts` plumbing, união em `ai-pipeline.ts`, gate em `guardrails.ts`, limpeza em `actions.ts`). `tests/integration/handoff-partial.test.ts` (5 testes) cobre o cenário real ponta a ponta contra Supabase real — escrito e confirmado RED antes da migration ser aplicada (`column conversations.handoff_topics does not exist`), GREEN (13/13 somado a `status.test.ts`) depois. 1116 testes unitários verdes, lint/typecheck limpos. **Validação manual em produção real** (não só suíte automatizada): lead de teste controlado na Speed Motos (mesmo padrão de 1.7/1.10 — grava, confirma, apaga), simulando a sequência exata do incidente original — `transitionConversationStatus` disparado como a LLM teria disparado após "tem desconto nela?", depois `buildAgentContext`+`runGuardrails` reais confirmando `mode=normal` pra "tem quantas 160 no momento?" e a linha da conversa no banco preservando `AGUARDANDO_HUMANO`/`HUMANO`/`["preco_negociacao"]`. Lead de teste apagado em seguida.

✅ Roadmap 1.10 — Distribuição automática de leads fechado e validado em produção real (2026-08-05). Construído antecipadamente por decisão explícita: levantamento prévio (query direta em produção) confirmou que nenhuma loja hoje tem 2+ vendedores (Speed Motos, Loja Teste Onboarding, Diag2 Store, Vex Motors Demo — 1 vendedor cada) — efeito prático é zero até uma loja crescer, mas o mecanismo fica pronto sem exigir migration nova naquele momento. `pickLeastLoadedVendedor` (`lib/lead-distribution.ts`, função pura) — menor carga aberta vence, empate → vendedor mais antigo. Fonte de verdade em runtime: `assign_lead_to_least_loaded_vendedor(p_lead_id, p_store_id)` (migration 042) — candidatos `users WHERE store_id/role='vendedor'`, carga = leads com `lead_status NOT IN ('FECHADO','PERDIDO')`, serializada por loja via `pg_advisory_xact_lock(hashtext(store_id))` (nunca bloqueia lojas diferentes). `webhook_ingest_message` (migration 003, `CREATE OR REPLACE` em 042) dispara a RPC só quando `v_is_new_lead=true` — lead existente nunca é redistribuído. `ingestLeadManually` (form do site, 1.4) chama a mesma RPC após insert, sem duplicar lógica. Gap consciente: sem coluna de vendedor ativo/inativo em `users`, todo `role='vendedor'` é candidato mesmo afastado — registrado em `BL-0028` (`28_BACKLOG.md`), mesmo gatilho de revisão do `DL-0008`. TDD RED→GREEN em todas as camadas: 4 testes unitários em `lib/lead-distribution.ts`, 3 novos em `lib/lead-ingestion.ts` (T18-T20), e 9 testes de integração em `tests/integration/lead-distribution.test.ts` — escritos e confirmados RED contra Supabase real antes da migration (`PGRST202`, função inexistente), GREEN (9/9) após o Vitor aplicar `042_lead_auto_distribution.sql` via Supabase Studio. Cobrem menor-carga, empate, FECHADO/PERDIDO fora da contagem, race de 2 chamadas concorrentes na mesma loja (advisory lock serializa, não duplica no mesmo vendedor), loja sem vendedor (no-op, `assigned_to` continua NULL), e que o webhook só distribui lead novo. 1095 testes unitários verdes, lint/typecheck limpos. **Validação manual em produção real** (não só suíte automatizada): lead de teste controlado inserido na Speed Motos via RPC `webhook_ingest_message` direto (mesmo padrão de fechamento usado em 1.7/`demo_requests` — grava, confirma, apaga), `assigned_to` confirmado por query preenchido com o único vendedor da loja (`59c7b161-...`), lead de teste apagado em seguida (cascade removeu conversation/message junto). Balanceamento entre 2+ vendedores permanece não testável com dado real até uma loja ter 2+ vendedores simultâneos — mecanismo em si (cálculo + atribuição + serialização) validado ponta a ponta.

✅ BL-0026 — UI do wizard de onboarding self-service (Tasks 5-8 do item 1.6 original) fechada e validada em produção real (2026-08-04, commit `8fdebac`). Item 1.6 (`DL-0013`) tinha absorvido só o backend (guard, `nextOnboardingStep`, 4 Server Actions, migration 040) — Tasks 5-8 (middleware, página, componente, integração admin) ficaram como `BL-0026` em aberto. Implementado: `OnboardingWizard.tsx` (client, 4 passos — nome/vendedor/estoque/whatsapp, `useFormState` sobre as Server Actions self-service já existentes), `app/onboarding/page.tsx` (Server Component, resolve o passo atual via `nextOnboardingStep` e redireciona pra `/inicio` quando completo ou quando o visitante não é o alvo do gate), gate de redirect em `middleware.ts` (`lib/onboarding-guard.ts::shouldRedirectToOnboarding` — só `dono_loja` com `onboarding_completed_at IS NULL`, nunca vendedor/super_admin, `/onboarding` e `/estoque` isentos), e integração em `app/admin/page.tsx` (badge de status + `resetStoreOnboarding`, suporte pra destravar loja presa — Edge Case 5 do spec original). Validado ponta a ponta em produção real em 2 lojas: Speed Motos (retroativa — já tinha nome/estoque/whatsapp configurados antes, só faltava vendedor; cadastrar um vendedor real disparou `maybeStampOnboardingComplete` e completou o onboarding na hora) e "Loja Teste Onboarding" (criada do zero via `/admin` especificamente pra validar os 3 passos ainda não vistos — nome, estoque, whatsapp). Confirmado: redirect automático do middleware funcionando, reavaliação dinâmica de passo a cada ação (não precisa recarregar), retorno ao `/inicio` com Header normal ao completar (Header escondido em `/onboarding` de propósito, sem vazar nav antes do setup terminar). TDD RED→GREEN em todos os itens abaixo, suíte completa verde a cada commit, lint/typecheck limpos.

**Três bugs colaterais encontrados e corrigidos durante a validação manual, nenhum relacionado ao escopo da UI em si:**

1. `/admin` mostrando "Nenhuma loja cadastrada" com lojas reais existindo (commit `744c90a`) — `app/admin/page.tsx` adicionou `onboarding_completed_at` ao `select()` sem confirmar que a migration 040 estava aplicada em produção; coluna não existia, Postgres retornou erro 42703, e o código descartava silenciosamente o `error` da query (`const { data: stores } = await ...`), tratando a falha como lista vazia. Fix: captura `error` e renderiza mensagem explícita em vez de mascarar como "sem lojas". Causa raiz real (schema drift) resolvida à parte pelo Vitor aplicando a migration 040 manualmente via Supabase Studio.
2. Login travado em "Entrando..." + latência evitável no `/onboarding` (commit `befb6c0`) — `app/login/page.tsx` só resetava `loading` no caminho de erro, nunca no de sucesso, deixando o botão preso pelo tempo inteiro da navegação. Medido contra produção: `app/onboarding/page.tsx` fazia `getServerUserRole()` + `getServerStoreId()` separadamente (2x `auth.getUser()` + 2 queries pra ler a mesma linha) mais 3 queries sequenciais (stores/vendedorCount/vehicleCount). Fix: `try/finally` no login (sempre reseta `loading`) e consolidação no onboarding (1 client + 1 `getUser()` + 1 select combinado + `Promise.all` nas 3 queries independentes) — reduz de ~7 pra ~2-3 round-trips efetivos, confirmado com medição antes/depois contra produção real.
3. `stores.slug` NOT NULL violation ao criar loja pela UI (commit `c3b769a`, `DL-0014`) — gap pré-existente desde a migration 033 (roadmap 1.3), não relacionado ao BL-0026: a migration fez backfill de `slug` só pras lojas que já existiam, mas `createStore()` nunca foi atualizado pra gerar slug em criações novas. Ninguém tinha criado loja pela UI desde então — apareceu agora ao criar a "Loja Teste Onboarding". Fix: `lib/store-slug.ts` (`slugifyStoreName`/`nextAvailableSlug`, mesmo algoritmo do backfill da 033) integrado em `createStore()`.

**Nota de escopo, não relacionada:** durante a validação, foi observado que `app/inicio/page.tsx` (dashboard "Central de Operações", card "Setup Inicial 3/5") é 100% mock hardcoded (arrays literais, sem I/O), pré-existente desde 2026-04-15 (commit `0216307`, ~4 meses antes deste trabalho) — não tocado nem relacionado ao BL-0026 apesar de 3 dos 5 itens do checklist (`WhatsApp`/`Equipe`/`Estoque`) coincidirem em nome com passos do wizard. Fica como escopo de item futuro (dashboard real da Central de Operações).

✅ Roadmap 1.7 — Landing page de vendas do VEX Auto fechada e validada em produção real (2026-08-04). Validado em `www.vexauto.com.br` (confirmado por browser do Vitor): hero, diferenciais, prova social (placeholder), formulário "Agende uma demonstração" (nome/empresa/telefone/e-mail opcional/mensagem opcional) — sem vazamento do Header do app autenticado nem do layout de site de loja, `PUBLIC_SITE_ROUTE_HEADER` + `isMarketingApexHost` confirmados funcionando em prod real. Investigação prévia confirmou que apex/www não serviam landing nenhuma — caíam em `app/page.tsx` → `redirect("/inicio")` → rota protegida → `/login` (`RESERVED_SUBDOMAINS` em `lib/subdomain.ts` só protegia esses hosts de virar slug de loja, não implicava rota própria). Mecanismo: `isMarketingApexHost(host, rootDomain)` (`lib/subdomain.ts`) distingue apex/www reais de qualquer outro host que hoje retorna `null` em `extractStoreSlugFromHost` (preview Vercel, domínio desconhecido) — sem essa função separada não dava pra diferenciar os casos a partir só do retorno `null`. `middleware.ts` reescreve só `"/"` nesses hosts pra `/marketing`, reaproveitando `PUBLIC_SITE_ROUTE_HEADER` (mesmo marcador do site público de loja, commit `6626f25`) em vez de criar marcador novo — efeito desejado é idêntico (sem Header do app autenticado); outros paths no mesmo host (`/login`, `/privacidade`) seguem intocados. Captura de lead comercial do próprio Vex Auto (distinto do CRM de lojas): migration 041 (`demo_requests`, RLS habilitada sem policies — mesmo padrão de `audit_logs`, migration 029 — acesso só via `service_role`), `lib/demo-request.ts` (validação pura: nome/empresa/telefone obrigatórios, email opcional validado, mensagem com limite de 2000 chars) e `lib/demo-request-actions.ts` (Server Action `createDemoRequest`, honeypot reaproveitado de `lib/public-contact-honeypot.ts`, mesmo padrão de `submitPublicContactLead`) — gravação validada via dev local contra Supabase de produção (honeypot testado, submit real gravou em `demo_requests`, confirmado por query REST com `service_role`, linha de teste apagada em seguida). `app/marketing/page.tsx` + `DemoRequestForm.tsx` — estrutura semântica mínima com copy placeholder (`[placeholder]` em cada seção); visual final e copy real ficam pra ferramenta de design própria do Vitor, fora de escopo deste scaffold. TDD RED→GREEN, 1045 testes unitários verdes (33 novos: 12 em `isMarketingApexHost` + 11 em `demo-request` + 5 em `demo-request-actions` + 5 em `middleware`), lint/typecheck limpos. Migration 041 aplicada em produção pelo Vitor via Supabase Studio. **Achados de infra no fechamento (fora do código, Hostinger/Vercel, resolvidos pelo Vitor):** registro A duplicado apontando pro apex (`2.57.91.91` antigo vs `216.198.79.1` da Vercel) — corrigido; CNAME `www` precisou de edição manual por conflito de registro pré-existente; apex configurado e válido na Vercel (redirect 308 → `www`), propagação DNS completa ainda em andamento em alguns resolvers no momento do fechamento — não bloqueante. **Achado que contradiz `DL-0012`** ("adiar DNS wildcard `*.vexauto.com.br` até haver volume", `29_DECISIONS_LOG.md`): CNAME wildcard (`*`) já está apontado pra Vercel na Hostinger, o que a decisão registrada não previa. Não resolvido agora — sinalizado como item de investigação futura (confirmar se o wildcard está de fato ativo e se `DL-0012` precisa ser atualizada ou revertida), não bloqueante pro fechamento deste item.

✅ Roadmap 1.6 — Decisão + rebase de `feat/onboarding-wizard` (2026-08-04). Branch abandonada em 21/07, nunca mergeada. Levantamento primeiro (sem tocar código): 5 commits, 580 linhas em 8 arquivos, sem overlap real de schema com RBAC 0.3 (migration 026), config visual 1.5 (migration 039) ou site público 1.3/1.4 — nada do que main fez nos 99 commits desde 21/07 tocou os mesmos arquivos. Único bug encontrado: `assertStoreAdmin()` (`lib/auth.ts`) checava `role !== "admin"`, stale desde que migration 026 renomeou o role pra `dono_loja` — quebrava pra todo dono de loja legítimo, sem gerar conflito de merge (código novo, não edita linha existente de main, bug ficaria silencioso até rodar em produção). Decisão registrada em `DL-0013` (`29_DECISIONS_LOG.md`): rebase, não descarte. Rebase (`git rebase main`, não cherry-pick — histórico preservado) resultou em 2 arquivos com conflito textual (`lib/auth.ts`, `tests/unit/auth.test.ts`), ambos resolvidos por adição pura. Fix do bug: `assertStoreAdmin` reescrito pra delegar em `getServerUserRole()` (padrão já estabelecido em RBAC 0.3) em vez de manter a query raw antiga — teste `B1` confirmado RED (`ForbiddenError` lançado pra `role: "dono_loja"` contra a implementação antiga) antes do fix, GREEN depois. Migration renumerada de 021 pra 040 (021 já estava livre em main, mas não era mais o próximo slot real — main tinha avançado até 039 desde 21/07). Merge (fast-forward) em main: guard de auth, `nextOnboardingStep` (lógica pura de derivação de passo — nome/vendedor/estoque/whatsapp), e 4 Server Actions self-service (`lib/onboarding-actions.ts`). 38 testes novos, suíte completa 1012/1012 unitários + 43/44 integração (1 falha pré-existente em `public-vehicle-listings.test.ts`, confirmada já quebrada em main antes deste merge, fora de escopo — teste desalinhado com a allowlist real da migration 039), lint/typecheck limpos. **Sem UI nenhuma** — o plano original tinha 8 tasks, só as 4 de backend foram absorvidas nesta decisão; middleware de redirect, página `/onboarding`, componente de formulário e integração no painel admin (Tasks 5-8) viram item novo de backlog, dependente deste merge. **Sem pendência de validação manual em produção** — não existe superfície nenhuma pra validar visualmente ainda, só os testes automatizados se aplicam aqui.

✅ Roadmap 1.5 — Config visual por loja (logo, cor primária, telefone, endereço, "sobre") fechado e validado em produção (2026-08-04). Migration 039: `stores` ganha `logo_url`/`cor_primaria` (`CHECK` formato `#RRGGBB`)/`telefone_publico`/`endereco`/`sobre`; bucket `store-logos` público pra leitura; RLS de `storage.objects` espelha exatamente o padrão de `vehicle-photos` (migration 032) — INSERT restrito ao `store_id` do primeiro segmento do path, com policy de UPDATE adicional porque `uploadStoreLogo` usa `upsert:true` (substitui o logo anterior no mesmo path `{store_id}/logo.{ext}`, nunca acumula lixo — diferente da galeria incremental de fotos de veículo). `public_store_lookup` (migration 035) ganha allowlist estendida — `nome`/`logo_url`/`cor_primaria`/`telefone_publico`/`endereco`/`sobre` — continua nunca expondo `whatsapp_numero`/`whatsapp_phone_number_id`. `lib/store-settings.ts` (validação pura: `isValidHexColor`, `sanitizeStoreText`, `validateLogoFile` — mesmo padrão de `lib/vehicle-photos.ts`, mas logo é arquivo único com limite de 2MB, não galeria de 5MB). `lib/store-actions.ts` — `updateStoreSettings`/`uploadStoreLogo`, guard de role (`getServerUserRole() !== "vendedor"`, mesmo padrão de `assignLeadToUser`). Página nova `/configuracoes` (link já existia no dropdown do Header, rota nunca tinha sido criada) — formulário completo pra `dono_loja`/`super_admin`, somente leitura pra `vendedor`. Site público: `getPublicStoreBySlug` (`lib/public-store.ts`) substitui `resolveStoreIdBySlug` nas duas páginas (listagem e detalhe) — título usa nome da loja, logo exibido via `StoreBrandHeader`, `cor_primaria` sobrescreve `--accent` via CSS custom property inline escopada a `.site-public` (nunca vaza pro app autenticado), bloco de contato/sobre via `StoreFooter`. **Três decisões conscientes de corte de escopo:** logo é upload único que sempre substitui o anterior (`upsert:true` em path fixo, sem galeria nem histórico — loja tem 1 identidade visual, não várias); `cor_primaria` é acento pontual (preço/CTA/links via `--accent`), não redesign completo do template público; `endereco` é texto livre sem geocoding/mapa (sem integração com Maps neste item). **Bug encontrado na primeira validação manual em produção, corrigido antes de fechar o item (commit `995fd4d`):** nome da loja duplicado na tela — `StoreBrandHeader` renderizava o nome E o `<h1>` da listagem também, mais o subtítulo "Veículos disponíveis" embaixo, 2 ocorrências visuais de "Speed Motos" na mesma página. Causa: componente novo foi ADICIONADO ao lado do heading existente em vez de SUBSTITUÍ-LO. Fix: `StoreBrandHeader` passa a renderizar só o logo (sem texto) — o nome vive exclusivamente no `<h1>`, fonte única da verdade; sem `logo_url`, o componente retorna `null` (sem div vazia). Validado localmente antes do fix subir: dev server + Supabase real, screenshot da listagem e do detalhe confirmando heading único. **Validado em produção real** (`speed-motos.vexauto.com.br`, confirmado por screenshot do Vitor): logo renderizando no topo sem duplicação de título, cor primária aplicada como acento (preço do card mudou do azul padrão pro vermelho da marca), telefone/endereço/sobre renderizando corretamente. TDD RED→GREEN, 62 arquivos de teste / 987 testes unitários verdes (42 novos: 21 em `store-settings` + 17 em `store-actions` + 4 em `public-store` estendido), lint/typecheck limpos. Migration 039 aplicada em produção pelo Vitor via Supabase Studio (colisão parcial encontrada e resolvida — algumas colunas já existiam de uma tentativa anterior, resto da migration rodou isolado sem re-executar o `ALTER TABLE` já aplicado).

✅ Roadmap 1.4 — Site da loja (template único, multi-tenant) fechado e validado em produção (2026-08-03, commit `bcf9732`). `vehicles.publicado` (migration 036, boolean default true) controla exposição no site separado de `disponivel` (controle interno) — estoque atual aparece automaticamente, dono desmarca item a item. `public_vehicle_listings` (migration 037, `CREATE OR REPLACE VIEW`) passa a filtrar `disponivel=true AND publicado=true`, allowlist de colunas herdada intacta da migration 034 (nunca custo/margem_minima — `publicado` em si não entra no SELECT, é filtro de linha, não dado público). `app/estoque/page.tsx` ganha toggle "Publicado no site" (`publishVehicle`/`unpublishVehicle` em `lib/vehicle-actions.ts`, espelha exatamente o padrão já existente de `archiveVehicle`/`unarchiveVehicle`). Listagem (`app/site/[slug]/page.tsx`) evoluiu do smoke test do 1.3 pra grid de cards com foto de capa (`photo_url[0]`), e ganhou página de detalhe nova (`app/site/[slug]/veiculo/[vehicleId]/page.tsx`) com galeria completa e formulário de contato. **Decisão mais importante da sessão, encontrada antes de virar bug em produção:** links dentro do site público são relativos (`/veiculo/[id]`, `/`), nunca `/site/[slug]/...` — em produção o visitante está no subdomínio real (`speed-motos.vexauto.com.br`), `middleware.ts` só reescreve a URL internamente; um link absoluto com o prefixo interno quebraria a navegação (o middleware tentaria reescrever de novo por cima). Formulário de contato (`lib/public-contact.ts`, Server Action) reaproveita `ingestLeadManually` (já existente, usado por `lib/actions.ts:importLead`) em vez de duplicar lógica de criação de lead — roda com `supabaseAdmin`/service_role com segurança (Server Action, não a rota de leitura pública, que continua anon-only por decisão da 1.3). Honeypot descarta bot silenciosamente sem criar lead nem expor erro; nome do campo vive em arquivo próprio, `lib/public-contact-honeypot.ts` — achado no caminho: um módulo `"use server"` só pode exportar async function, uma constante string ali quebra o build. `leads.origem` ganha o valor `'site'` (migration 038, `DROP`/`ADD CONSTRAINT leads_origem_check`, mesmo padrão já usado nas migrations 019 e 026). Testado de ponta a ponta contra produção real, não só em CI: formulário submetido em `speed-motos.vexauto.com.br/veiculo/...` criou lead de verdade, confirmado visualmente em `/leads` pelo Vitor. TDD RED→GREEN, 944 testes unitários + 9/9 de integração (`tests/integration/public-vehicle-listings.test.ts`) verdes contra Supabase real (migrations 036/037/038 aplicadas em produção pelo Vitor via Studio antes da suíte rodar verde), lint/typecheck limpos. **Nota de escopo consciente, não limitação técnica:** site público ainda sem identidade visual da loja — `public_store_lookup` (migration 035) só expõe `id`/`slug` de propósito (nunca `nome`), então o título da listagem é genérico ("Veículos disponíveis"). Resolvido no próximo item do roadmap (1.5). **Fix pós-fechamento (2026-08-03):** lead "Teste QA 1.4" criado via formulário público apareceu na conversa com "Lead importado manualmente." — texto genérico. Investigação por query direta em produção (service_role, read-only) confirmou `origem="site"` correto no banco; o bug era só a mensagem de sistema hardcoded em `createConversationAndMessage` (`lib/lead-ingestion.ts`), que não olhava `origem`. Corrigido com `SYSTEM_MESSAGE_BY_ORIGEM: Record<Origem, string>` — mapa completo (força o TypeScript a exigir mensagem pra toda origem do union, não só os 2 casos atuais), `site` → "Lead recebido pelo site.", demais origens mantêm o texto original. Teste T8c novo, 945 testes verdes, lint/typecheck limpos.

✅ Roadmap 1.3 — Rota de leitura pública por subdomínio fechado e validado em produção (2026-08-03, commits `3bf5e1e` + `6626f25`). `stores.slug` (migration 033) — primeiro identificador amigável do projeto, backfill via `unaccent`+regex a partir de `nome`, colisão resolvida por sufixo numérico ordenado por `created_at`. Duas views allowlist (migrations 034/035) em vez de `CREATE POLICY` — Postgres não permite RLS em views; mecanismo real é view rodando com privilégio do owner + filtro embutido (`disponivel = true`) + `GRANT SELECT` a `anon`: `public_vehicle_listings` (id/store_id/marca/modelo/ano/preco/photo_url/disponivel — nunca custo/margem_minima) e `public_store_lookup` (id/slug — achado durante a implementação: `stores` não tinha nenhuma policy de RLS pra `anon`). `lib/subdomain.ts` resolve slug a partir do header Host (18 testes) — `RESERVED_SUBDOMAINS` (`www`, `app`) impede que `app.vexauto.com.br` (onde o app autenticado roda de verdade em produção) seja tratado como slug de loja, achado ao escrever o primeiro teste de middleware do projeto antes de ir pra produção (`BL-0025` registra a dívida de manter essa lista atualizada a cada subdomínio de infra novo). `middleware.ts` reescreve pra `/site/[slug]` sem tocar no fluxo de auth das rotas já protegidas. `lib/public-store.ts`/`lib/supabase-public.ts` — sempre anon key, nunca service_role. Achado em teste manual real pós-deploy: a página pública herdava o Header inteiro do app autenticado (nav completa + "Sair") por estar sob o mesmo layout raiz — clicar em "Sair" dentro do subdomínio da loja dava 404 (path reescrito pra rota inexistente). Fix (`6626f25`): Next.js App Router não deixa um layout aninhado remover JSX de um ancestral, então a decisão de renderizar o Header vive no layout raiz (`app/layout.tsx`), controlada por um header interno (`x-vex-public-site`) que `middleware.ts` marca e `app/components/AppChrome.tsx` lê. Validado em produção real: `speed-motos.vexauto.com.br` mostra só o estoque da própria Speed Motos (isolamento cross-tenant confirmado por query direta no banco, zero vazamento) sem nenhum chrome de sistema autenticado; `app.vexauto.com.br` confirmado sem regressão (Header/nav normais). `app/site/[slug]/page.tsx` é smoke test do fluxo ponta a ponta, não o site final (1.4). 916 testes unitários (37 novos, TDD RED→GREEN) + suíte de integração nova (`tests/integration/public-vehicle-listings.test.ts`, 8/8 verde contra Supabase real), lint/typecheck limpos. **Dependência operacional (DL-0012):** sem wildcard DNS ainda (domínio na Hostinger, sem migração de nameservers pra Vercel) — cada loja nova exige CNAME manual na Hostinger + domínio cadastrado manualmente na Vercel até essa migração acontecer.

✅ Roadmap 1.2 — Upload de foto de veículo fechado (2026-08-01, não commitado ainda — working tree). Investigação prévia confirmou ausência total (sem coluna no schema, sem bucket, sem UI — `app/estoque/page.tsx:214` tinha "Sem foto" hardcoded) antes de implementar qualquer coisa. Schema: `vehicles.photo_url text[] default '{}'` (migration 032, aplicada em produção pelo Vitor via Supabase Studio SQL Editor — bucket confirmado público visualmente na aba Storage) — array de URLs, não coluna única, porque veículo tem galeria; 1ª posição é a capa por convenção de aplicação, não imposta pelo schema. Coluna direto em `vehicles`, mesmo padrão de 1.1/1.9 (estado atual, sem tabela satélite). Storage: bucket `vehicle-photos` público pra leitura — decisão deliberada porque o site da loja (1.4, próximo item) é rota sem sessão e precisa servir foto sem autenticação, e foto de carro à venda não é dado sensível. RLS de `storage.objects` restringe INSERT ao `store_id` do primeiro segmento do path (`{store_id}/{vehicle_id}/{filename}`, via `my_store_id()`) — mesmo princípio de isolamento duplo das tabelas (o Server Action usa `supabaseAdmin`/service_role, então a policy é o backstop, não o guard principal — guard real é `getServerStoreId()` no código). Validação pura em `lib/vehicle-photos.ts`: tipo (`image/jpeg`/`image/png`/`image/webp`), tamanho máx 5MB/foto, máx 10 fotos/veículo, sanitização de filename contra path traversal — todos defaults escolhidos nesta sessão, sem pedido explícito de valor exato. Server Action `uploadVehiclePhotos` (`lib/vehicle-photo-actions.ts`) sobe cada arquivo válido pro Storage e concatena as URLs públicas ao array existente (append-only — nunca substitui, preserva a capa histórica). `VehiclePhotoUpload` (`app/components/VehiclePhotoUpload.tsx`, Client Component) — preview local via `URL.createObjectURL` antes de enviar, sem chamada de rede na etapa de preview. `app/estoque/page.tsx` — capa exibida no card do grid quando `photo_url` não está vazio, fallback "Sem foto" preservado; galeria completa + formulário de upload na tela de edição. **Duas decisões conscientes de corte de escopo, registradas como backlog formal (não pendência aberta dentro do item):** upload só disponível na edição, não na criação (`vehicle_id` é gerado pelo banco no insert — `BL-0024`); sem exclusão ou reordenação de foto, append-only (`BL-0023`). 30 testes novos (TDD RED→GREEN, `tests/unit/vehicle-photos.test.ts` + `tests/unit/vehicle-photo-actions.test.ts`), 871/871 no total, lint/typecheck limpos.

✅ Roadmap 1.1 — Controle de RENAVE (sem API) fechado no código (2026-08-01, não commitado ainda — working tree). **Correção (2026-08-25, `DL-0020`):** "fechado" aqui era só código+testes — a migration 031 nunca tinha sido de fato aplicada em produção; `/renave` ficou quebrada (erro do Postgres exposto pro usuário) por ~3 semanas até a auditoria de hoje encontrar e corrigir. Rastreio MANUAL de status por veículo — sem chamada a API externa, sem automação de protocolo no DETRAN, pitch honesto do roadmap mantido ("o VEX organiza, valida e cobra prazo — não registra no RENAVE"). Schema: 4 colunas direto em `vehicles` (migration 031: `renave_stage` com CHECK das 4 etapas — `entrada_registrada`/`chave_nfe_vinculada`/`documentos_protocolados`/`saida_registrada` —, `renave_nfe_key`, `renave_stage_updated_by` FK `users`, `renave_stage_updated_at`) em vez de tabela nova — decisão: é estado atual 1:1 por veículo sem necessidade de histórico de transição (o histórico de quem-fez-o-quê já vive em `audit_logs`, 0.5), mesmo padrão de `leads.vehicle_id`/`valor_final` (migration 020) e `leads.agendamento_data` (migration 022). Índice parcial `vehicles_store_renave_pending_idx` (`store_id, renave_stage_updated_at) WHERE renave_stage <> 'saida_registrada'` serve o painel de pendências sem indexar o que não é consultado. Lógica pura em `lib/renave.ts`: `nextRenaveStage` sempre avança 1 degrau (estruturalmente incapaz de pular etapa — não aceita target arbitrário), `checkRenaveStageAdvance` bloqueia avanço pra `chave_nfe_vinculada`+ sem `nfe_key` preenchida (nova ou já persistida — não precisa reenviar da 2ª transição em diante), `isRenaveStalled`/`daysStalled` pro alerta de 7 dias. Server Action `advanceRenaveStage` (`lib/renave-actions.ts`) reaproveita RBAC existente (`getServerUserRole()` — dono_loja e vendedor podem, nenhum nível novo criado; `super_admin` bloqueado por não ser role de loja) e audit log (`logAudit`, ação nova `vehicle.renave_stage_advanced`, extensão de `lib/audit.ts` — `AuditResourceType` ganhou `vehicle`). Painel `/renave` (`app/renave/page.tsx`) lista veículos com `renave_stage != saida_registrada` ordenados por tempo parado (mais antigo primeiro), badge `.op-badge.parado` (convenção já usada em `/equipe`) acima de 7 dias parado no mesmo estágio, ação de avançar inline na linha (form com `.bind(null, vehicleId)`, mesmo padrão de `LeadCard`/`app/conversations/[id]/page.tsx`). Link "RENAVE" no Header entre Equipe e Analytics. TDD: RED confirmado em `tests/unit/renave.test.ts` (19 testes de lógica pura) e `tests/unit/renave-actions.test.ts` (12 testes de RBAC/sequência/nfe_key/audit) antes da implementação, depois GREEN — 31 testes novos, 841/841 no total, lint/typecheck limpos.

✅ Roadmap 1.9 — Fix do handoff que apagava o dono do lead (2026-07-31, não commitado ainda — working tree). `assignConversationToHuman` (`lib/actions.ts`) setava `handoff_to: "HUMANO"` e `assigned_to: null` no mesmo update, deixando o lead mais qualificado do funil sem dono no exato momento em que fica pronto pra humano. Investigação revelou 2 colunas `assigned_to` distintas (`conversations.assigned_to`, nunca lida em nenhuma tela/métrica, vs `leads.assigned_to`, a que `team-metrics.ts`/`app/equipe`/`app/leads` de fato leem) — a leitura literal do bug reportado (só `conversations.assigned_to`) não teria corrigido o sintoma real (lead sumindo da métrica de vendedor). Fix cobre as duas: `ownerId = leadRow.assigned_to ?? actorId` — preserva o dono existente em `leads.assigned_to` ou autoatribui a quem assume a conversa, propagado igual pra `conversations.assigned_to` via `transitionConversationStatus`, mantendo as duas colunas consistentes entre si nesse fluxo. `logAudit` da ação ganhou `assigned_to` no metadata (antes só tinha `lead_id`). TDD: RED confirmado antes do fix (4 testes falhando pelo motivo esperado em `tests/unit/actions.test.ts`), depois GREEN. 810/810 testes, lint/typecheck limpos. Sem guard de RBAC no self-claim — decisão consciente, estruturalmente incapaz de reassignment indevido (`ownerId` só assume `actorId` quando o campo já é `null`, nunca sobrescreve dono existente) — registrado em DL-0010 pra não ser "corrigido" no futuro por engano. `returnConversationToAI` deixado fora de escopo (continua zerando só `conversations.assigned_to`, `leads.assigned_to` preservado) — inconsistência entre as duas colunas fora do fluxo de handoff registrada em BL-0017, decisão de modelo de dado adiada de propósito.

⚠️ Fix: retry pra parse_error/output_error no dreno + reforço de JSON no prompt fora do horário (2026-07-31) — IMPLEMENTADO, achado de produção via evidência real, mesma disciplina de investigação de DL-0004/DL-0005 (escopo menor, não é decisão arquitetural — bug + fix documentado, sem entrada no Decisions Log). Investigação: mensagem real ("quais motos você tem", 02:27 UTC 31/07) recebeu `parse_error` (LLM devolveu texto solto em vez de JSON) e ficou **8h19 sem nenhuma resposta** — nenhum mecanismo de retry existia em lugar nenhum do sistema pra esse status (nem no dispatch, nem no cron `retry-failed.ts`, que só cobre `ok_send_failed`); só voltou a responder quando o lead mandou mensagem nova, que reabriu o claim e o dreno concatenou tudo que ficou pendente. Taxa histórica de `parse_error`: 7,6% (5/66 logs, ~2 meses) antes do deploy do fix de horário (`205da19`); 67% (4/6) na janela do incidente logo depois — amostra pequena, correlação plausível (não 100% provada) com a seção nova `[FORA DO HORÁRIO...]` reforçando justamente o contexto onde a LLM já quebrava JSON antes (histórico mostra pelo menos 2 casos pré-existentes de `parse_error` em conteúdo sobre estar fora do horário, antes de qualquer mudança de ontem). Fix 1 (`lib/pipeline-dispatch.ts`): `parse_error`/`output_error` retentam 1x com o mesmo `incomingText` (confirmado por leitura de código que `parse_error` só ocorre antes de qualquer bolha ser inserida/enviada — `runAgent` é atômico, lança exceção antes do loop de envio — sem risco de duplicar bolha parcial); `timeout`/`error`/`skipped_handoff` não retentam. Fix 2 (`lib/prompts.ts`): linha de reforço "sua resposta continua sendo APENAS o JSON" adicionada à seção fora-do-horário. 809/809 testes, lint/typecheck limpos. **Taxa real de `parse_error` fora do horário só será confirmada com mais volume de produção — monitorar `ai_logs` nas próximas semanas antes de considerar o Fix 2 validado, ou até aparecer novo silêncio prolongado.** Risco de bolha parcial duplicada no retry — checado e descartado (2026-07-31): `parse_error` só ocorre com o output inteiro falhando o parse, antes de qualquer `messages.insert`/envio WhatsApp (`runAgent`, `lib/ai.ts`, é atômico — lança exceção antes de retornar `reply_texts`; o loop de bolhas só roda depois de um retorno bem-sucedido). Nenhuma guarda adicional foi necessária.

✅ Fix: IA nunca soa como fechada fora do horário comercial (2026-07-30, commit `205da19`) — CONFIRMADO por teste manual real na Speed Motos: mensagem genérica fora do horário comercial recebeu resposta normal, sem menção a estar fechada. Causa raiz: `lib/guardrails.ts` (passo 3 de `runGuardrails`) era gate incondicional — fora do horário, `mode` virava `"off_hours"` pra QUALQUER mensagem recebida, alimentando `MODE_INSTRUCTIONS.off_hours` (`lib/prompts.ts`) e instruindo a IA a se comportar como fechada, contradizendo a proposta de valor central (IA atende 24/7). Fix: `"off_hours"` removido do union `GuardrailMode`; `GuardrailResult` ganha `outsideBusinessHours`/`businessHoursStart`/`businessHoursEnd` como campos ortogonais ao `mode` — nunca mais suprimem atendimento normal. `lib/prompts.ts` ganha seção condicional `[FORA DO HORÁRIO DE ATENDIMENTO PRESENCIAL]` — só orienta a frasear corretamente um handoff real (quando `should_handoff` dispara por outro motivo), deixando claro que é o vendedor humano que retoma no próximo horário, não a IA. Agendamento presencial (coleta de troca) passa a respeitar a janela configurada, guiado por prompt — campo é texto livre, sem parser determinístico; exceção consciente ao padrão do projeto (guardrail de margem/idade em código), registrada em `28_BACKLOG.md` BL-0016 junto com a dívida de horário como env var global em vez de config por loja. 806/806 testes, lint/typecheck limpos.

✅ Fix: lock atômico por conversa evita pipelines de IA concorrentes (2026-07-30, commit `7771784`) — CONFIRMADO por evidência real de produção (2026-07-31, não teste sintético): duas mensagens do Vitor ("oi" + "bom dia") chegaram com 131ms de diferença, mesmo número — `ai_logs` registra 1 único turno (`status: ok`, 3 bolhas), sem duplicação nem resposta contraditória. É exatamente o cenário que gerou o bug original reproduzido naturalmente em uso real. Bug de produção (Speed Motos): duas mensagens do mesmo lead chegando em requests separados do webhook disparavam `runAiPipeline` concorrente pra mesma `conversation_id` — nenhum lock cross-process existia (o único lock do código, `pendingLeadTransitions` em `lib/status.ts`, é in-process, não cobre instâncias serverless diferentes) — gerando respostas sobrepostas/contraditórias, amplificado pelo BL-0008 (multi-bolha: 2-4 mensagens por turno em vez de 1). Fix: migration `030_conversation_pipeline_lock.sql` (renumerada de 029 por colisão com `029_audit_logs.sql` — ver nota em `# ENGINEERING NOTES`), `conversations.pipeline_locked_at` + RPC `claim_conversation_pipeline_lock` (claim atômico, mesmo padrão de `webhook_ingest_message`/retry job). `lib/pipeline-lock.ts` + `lib/pipeline-dispatch.ts`: claim falhou → mensagem já persistida via `ingestMessage`, não se perde; claim ganhou → dreno concatena entrada não respondida (`created_at`, não `received_at` — evita comparar clock do lead com clock do servidor sob concorrência), roda o pipeline 1x por lote, guarda contra loop apertado se o pipeline falhar sem gerar resposta (timeout/parse/output/erro/handoff). 806/806 testes unitários/integração verdes, lint/typecheck limpos.

✅ BL-0008 — Pipeline de envio multi-bolha (2026-07-30, commit `2922e7d`) — CONCLUÍDO e VALIDADO por teste manual real na Speed Motos (bolhas chegando em ordem, com delay perceptível de 400-800ms). Priorizado via DL-0009 (exceção consciente à ordem de fase, revisão da cautela original sobre `quality_rating` da Meta — determinado por denúncia/bloqueio do usuário, não por ritmo de envio). `lib/ai.ts`: `AgentResult.reply_text: string` → `reply_texts: string[]`, cap de 4 itens, fallback pro formato antigo. `lib/prompts.ts`: schema de saída e tom viram array de bolhas. `lib/ai-pipeline.ts`: loop sequencial obrigatório (nunca `Promise.all` — risco de entrega fora de ordem), insert+envio+delay por bolha. `lib/retry-failed.ts`: reenvia só as bolhas que falharam (`failed_message_ids`), sem duplicar as que já chegaram. Migration `028_ai_logs_multi_message.sql`. A validação deste item expôs 2 bugs pré-existentes não relacionados ao BL-0008 em si — ver as duas entradas de fix logo abaixo (concorrência e horário 24/7).

✅ Roadmap 0.5 — Log de auditoria fechado no código (2026-07-30). **Correção (2026-08-25, `DL-0020`):** "fechado" aqui era só código+testes — a migration 029 nunca tinha sido de fato aplicada em produção; toda auditoria (`logAudit`) falhava 100% silenciosa (só Sentry) por ~4 semanas até a auditoria de hoje encontrar e corrigir. Tabela `audit_logs` (migration 029, RLS zero-policy desde o desenho — só `service_role`, mesmo princípio corrigido reativamente em `leads` na migration 027 do RBAC) registra quem fez o quê em 7 ações sensíveis: `lead.reassigned`/`lead.unassigned` (`assignLeadToUser`/`removeLeadAssignment`), `conversation.handoff_to_human`/`handoff_to_ai` (`assignConversationToHuman`/`returnConversationToAI`), `message.manual_reply` (`sendManualReply`), `lead.closed` (`updateLeadStatus`, guardrail de margem), `user.created` (`createStoreUser`/`createStoreUserDirect`). `lib/audit.ts` — `logAudit()` centraliza a captura, non-fatal pro fluxo que chama (nunca quebra a Server Action) mas erro de escrita vai pro Sentry (`captureException`, 0.4) — auditoria sumindo silenciosamente seria pior que a ação falhar. `actor_role` congelado no momento da ação via `getServerUserRole()` (0.3) — histórico não é reescrito se o role da pessoa mudar depois. Sem UI de consulta nesta etapa (P — dias); fica pra quando houver necessidade real (RENAVE ou cliente pedindo). `user.role_changed` do escopo original virou `user.created` (não existe edição de role pós-criação no código hoje). Tentativa negada pelo guard de RBAC não gera log nesta etapa — decisão explícita. Spec: `docs/superpowers/specs/2026-07-30-audit-log-design.md`. Suíte completa verde, lint/typecheck limpos.

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

claude/vex-redesign-visual-fase1-sqkmmf (working branch, BL-0037 Fase 1; main is the stable branch)

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

1. **Migration `029`:** duas migrations diferentes nasceram como `029_*.sql` — `029_audit_logs.sql` (item 0.5, outra sessão/terminal) e `029_conversation_pipeline_lock.sql` (fix de concorrência, esta sessão). A segunda foi renomeada retroativamente pra `030_conversation_pipeline_lock.sql` (só o arquivo — nada foi reaplicado no banco). **Correção (2026-08-25, `DL-0020`):** a frase original aqui dizia que "ambas já tinham sido aplicadas direto em produção antes da colisão ser percebida" — isso era falso pra `029_audit_logs.sql`. Auditoria de `schema_migrations` em 2026-08-25 confirmou que a tabela `audit_logs` nunca existiu em produção até essa data (só `030_conversation_pipeline_lock.sql`/`pipeline_locked_at` estava de fato aplicada). Sem dano nenhum caso real — não havia dependência cruzada entre as duas —, mas o registro anterior estava incorreto sobre o estado real do banco.
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