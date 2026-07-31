27_PROJECT_STATUS.md
# THE VEX OPERATING SYSTEM

# PROJECT STATUS

Version: 1.0

Status: Living Document

Owner: Engineering

Last Updated: 2026-07-31

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

# RECENT COMPLETED WORK

Most recent accomplishments (source: git log, most recent first).

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