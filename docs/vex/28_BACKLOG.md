28_BACKLOG.md
# THE VEX OPERATING SYSTEM

# PRODUCT BACKLOG

Version: 1.0

Status: Living Document

Owner: Product & Engineering

Last Updated: 2026-08-17

---

> "A backlog is not a wish list. It is an investment portfolio."

---

# PURPOSE

This document contains every planned initiative for VEX.

It is the single source of truth for future work.

Every backlog item must represent a validated problem, not simply an idea.

The objective is maximizing customer value while minimizing unnecessary complexity.

---

# BACKLOG PHILOSOPHY

The backlog is ordered by value.

Not by excitement.

Not by novelty.

Not by engineering preference.

Every item competes for limited engineering capacity.

Adding a new item means delaying another.

---

# PRIORITIZATION FRAMEWORK

Every item is evaluated using the following dimensions.

Customer Impact

Revenue Impact

Operational Improvement

Risk Reduction

Engineering Enablement

Strategic Alignment

Engineering Effort

Complexity Introduced

Maintenance Cost

Long-Term Value

Priority is determined by the balance between value and complexity.

---

# STATUS DEFINITIONS

Each backlog item must have one status.

IDEA

Validated problem not yet analyzed.

---

RESEARCH

Currently under investigation.

---

READY

Fully specified.

Ready for implementation.

---

IN PROGRESS

Actively being developed.

---

BLOCKED

Cannot proceed due to dependency.

---

VALIDATION

Implemented.

Waiting for production validation.

---

DONE

Completed and validated.

---

REJECTED

Will never be implemented.

Reason must be documented.

---

# BACKLOG ITEM TEMPLATE

Every item follows this structure.

ID

Title

Problem

Business Value

Customer Value

Priority

Status

Owner

Estimated Complexity

Dependencies

Related ADR

Related RFC

Related Issue

Target Version

Success Metrics

Notes

No field should be omitted.

---

# PRIORITY LEVELS

P0

Critical.

Blocks production.

---

P1

High.

Strong customer value.

---

P2

Important.

Improves product quality.

---

P3

Useful.

Can wait.

---

P4

Future consideration.

---

# CURRENT PRIORITIES

## P0

Validate MVP in production.

Resolve production blockers.

Complete WhatsApp production rollout.

Finish operational validation.

---

## P1

Improve observability.

Improve monitoring.

Improve deployment confidence.

Reduce operational risks.

---

## P2

UX improvements.

Analytics enhancements.

Performance optimizations.

---

## P3

Feature expansion.

Integrations.

Automation improvements.

---

# ACTIVE BACKLOG ITEMS

ID

BL-0001

Title

WhatsApp Embedded Signup (self-serve tenant onboarding)

Problem

Every new store customer currently requires a fully manual Meta setup per tenant: create/verify Business Manager account, create System User, generate permanent token, manually migrate or register phone number. Validated directly during the Speed Motos pilot (2026-07-21) — took multiple days end-to-end (business verification alone: ~2 days), required an engineer walking a non-technical business owner through Meta's dashboards step by step. Does not scale past a handful of manual pilot customers.

Business Value

Removes engineering/founder time from every new customer's onboarding. Unlocks self-serve sales — a customer can go from "bought a plan" to "WhatsApp connected" without a human on the Vex side doing the Meta setup for them.

Customer Value

Store owner clicks "Conectar WhatsApp" inside Vex Auto, completes a Meta popup (login + business + phone confirmation), and is done — no Business Manager, System User, or token concepts exposed to them.

Priority

P3 (Fase 4 — Escala). Not blocking current single-tenant pilot; becomes blocking before onboarding a 2nd paying customer without manual engineering support.

Status

IDEA — on hold, blocked on founder opening MEI/CNPJ for Vex (not doing now, 2026-07-21)

Owner

Engineering

Estimated Complexity

Medium-High — requires registering Vex as a Meta Tech Provider/Business Partner, implementing Embedded Signup (Facebook Login for Business) flow, and handling the resulting WABA/phone_number_id/token via API instead of manual Business Manager entry. `stores.whatsapp_phone_number_id` (migration 017) already supports per-store phone IDs — this is the acquisition flow, not the storage model.

Dependencies

Meta Tech Provider approval. Existing multi-tenant WhatsApp-per-store architecture (already in place, migration 017). Requires Vex's own CNPJ or MEI to complete Vex's own Meta Business Verification (separate from Speed Motos' account) before Tech Provider application can even start — founder decided 2026-07-21 not to open a MEI yet, so this whole item is on hold until that changes.

Related ADR

None yet

Related RFC

None yet

Related Issue

None yet

Target Version

Fase 4 (Escala)

Success Metrics

Time from "plan purchased" to "WhatsApp connected" — target: minutes, not days. Zero engineering hours per new tenant's WhatsApp setup.

Notes

Surfaced during Speed Motos manual onboarding (2026-07-21) when the founder asked whether every future customer would need to manually create a Meta Business account — they should not. Standard pattern used by other WhatsApp-integrated SaaS CRMs (e.g., Zenvia, Take Blip). See also the broader self-serve onboarding experience being scoped in the same session (purchase → auto-provisioned login → first-run setup wizard) — Embedded Signup for WhatsApp is one step inside that wizard, not a separate flow.

Interim decision (2026-07-21): while this is on hold, the onboarding wizard's WhatsApp step ships as manual guided entry instead (written instructions inside the wizard + a form field to paste the Phone Number ID + token the customer generates themselves in their own Meta account — same manual process used for Speed Motos, just turned into in-app copy instead of a human walking them through it). Swap this step's content for the real Embedded Signup button once Tech Provider approval lands — no other part of the wizard needs to change.

---

ID

BL-0002

Title

Mascote / personagem visual da Vex Auto

Problem

Vex Auto has no visual brand personality yet — no mascot or character representing the product to end users (store owners, sellers).

Business Value

Brand recognition and differentiation. A mascot can anchor the product's tone across onboarding, empty states, error messages, and marketing — makes the product feel less like a generic dashboard.

Customer Value

Warmer, more memorable first impression — especially relevant for the onboarding wizard (BL discussed 2026-07-21) where a mascot could narrate the guided tour/spotlight steps.

Priority

P4 (future consideration) — brand/design work, not blocking any current engineering item.

Status

IDEA

Owner

Product (founder)

Estimated Complexity

Unknown — depends on whether it's illustrated, animated, AI-generated, or commissioned. Not scoped yet.

Dependencies

None technical. Could plug into the onboarding wizard's tour (Phase 2, spotlight/tooltips) once both exist.

Related ADR

None

Related RFC

None

Related Issue

None

Target Version

Unscheduled

Success Metrics

Not yet defined — would need to be tied to a qualitative goal (brand recall, onboarding completion rate, etc.) once scoped.

Notes

Requested by founder 2026-07-21 during the onboarding wizard brainstorm session, as a "someday" item — explicitly not to be worked on now, just not to be forgotten.

---

ID

BL-0003

Title

Recebimento de imagem via WhatsApp (fotos de moto na troca)

Problem

Webhook (`app/api/whatsapp/webhook/route.ts`) só processa `msg.type === "text"` — mensagens de imagem são descartadas sem download nem persistência. Surgiu durante o brainstorm da coleta de financiamento/troca (2026-07-24): o dono do produto queria que a IA recebesse fotos da moto de troca, mas isso foi conscientemente decomposto pra fora do escopo daquele spec por ser infraestrutura nova (download de mídia via Graph API, storage, link ao lead) sem overlap com o fluxo de coleta em texto.

Business Value

Vendedor avalia moto de troca com mais informação antes do lead chegar na loja — reduz visita perdida por moto fora do padrão esperado.

Customer Value

Lead manda foto direto no WhatsApp em vez de esperar até ir pessoalmente até a loja.

Priority

P3 — depende do fluxo de coleta de troca (já implementado, `147f1ef`) estar em produção primeiro.

Status

IDEA — spec própria ainda não escrita

Owner

Engineering

Estimated Complexity

Medium-High — tratar `type=image` no webhook, baixar mídia via Meta Graph API (media id → URL → download autenticado), persistir em Supabase Storage, linkar ao `lead_id`/`conversation_id`.

Dependencies

Fluxo de coleta de troca em texto (`lib/collection.ts`, `lib/guardrails.ts`) já implementado e em produção — este item estende o mesmo fluxo, não substitui.

Related ADR

None yet

Related RFC

None yet

Related Issue

None yet

Target Version

Fase 2 (alinhado com `53_ROADMAP.md`, item 2.10 — roadmap é fonte de verdade de fase, DL-0002)

Success Metrics

Não definido ainda — depende de decisão sobre onde/como a foto é exibida pro vendedor (dossiê do lead? `/agenda`?).

Notes

Ver `docs/superpowers/specs/2026-07-24-financiamento-troca-collection-design.md`, seção "Explicitly Out of Scope". Validado externamente 28/07/2026 — concorrente (AEG/Venda.IA) já oferece chatbot de atendimento, confirma que recebimento/processamento multimídia é expectativa de mercado. Não altera prioridade de fase — Fase 0/1 seguem sem alteração.

---

ID

BL-0004

Title

Recebimento e transcrição de áudio via WhatsApp

Problem

Webhook não trata `type=audio` — mensagens de voz são descartadas. Alguns leads preferem mandar áudio em vez de texto; hoje a IA simplesmente ignora essas mensagens.

Business Value

Reduz atrito no atendimento — lead não precisa reescrever o que já falou em áudio.

Customer Value

Lead manda áudio normalmente e a IA entende, com fallback pedindo texto ou novo áudio se não conseguir transcrever.

Priority

P3 — mesma dependência de infraestrutura de mídia do BL-0003, mas exige também um serviço externo de speech-to-text (não decidido ainda: Whisper API, outro provedor).

Status

IDEA — spec própria ainda não escrita

Owner

Engineering

Estimated Complexity

Medium-High — tratar `type=audio` no webhook, baixar mídia, chamar serviço de transcrição externo, tratar falha de transcrição (pedir novo áudio ou texto ao lead).

Dependencies

Infraestrutura de recebimento de mídia (compartilhada com BL-0003 — mesmo ponto de entrada no webhook). Escolha de provedor de speech-to-text ainda em aberto.

Related ADR

None yet

Related RFC

None yet

Related Issue

None yet

Target Version

Fase 2 (alinhado com `53_ROADMAP.md`, item 2.9 — roadmap é fonte de verdade de fase, DL-0002)

Success Metrics

Taxa de transcrição bem-sucedida na primeira tentativa; não definido formalmente ainda.

Notes

Requisito explícito do dono do produto durante o brainstorm de 2026-07-24 ("quero que a IA identifique o áudio"), decomposto pra spec futura junto com BL-0003 por ser infraestrutura nova e não ter overlap com a coleta em texto. Validado externamente 28/07/2026 — concorrente (AEG/Venda.IA) já oferece chatbot de atendimento, confirma que recebimento/processamento multimídia é expectativa de mercado. Não altera prioridade de fase — Fase 0/1 seguem sem alteração.

---

ID

BL-0005

Title

Integração com Google Agenda pro `/agenda`

Problem

A página `/agenda` (implementada em `147f1ef`) hoje é uma lista interna simples filtrada por dia — sem sincronização com nenhum app de calendário externo. O dono do produto considerou integrar com Google Agenda durante o brainstorm, mas isso foi conscientemente adiado por exigir OAuth por loja, armazenamento de credencial e chamadas à Google Calendar API — projeto à parte do fluxo de coleta de dados.

Business Value

Vendedor vê agendamentos de troca dentro do app de calendário que já usa no dia a dia (celular, notificações nativas), sem precisar abrir o Vex Auto pra conferir.

Customer Value

Menos fricção operacional — não depende de lembrar de checar `/agenda` manualmente.

Priority

P4 — API do Google Calendar é gratuita pro volume esperado e não é tecnicamente difícil, mas não é urgente com a página interna já cobrindo a necessidade imediata.

Status

IDEA — spec própria ainda não escrita

Owner

Engineering

Estimated Complexity

Medium — cada loja precisa autorizar acesso (fluxo OAuth tipo "permitir"), armazenar token com segurança, criar/atualizar eventos via API, tratar revogação de acesso.

Dependencies

Página `/agenda` interna já implementada e em produção (`147f1ef`) — este item substitui/complementa a visualização, não é pré-requisito de nada.

Related ADR

None yet

Related RFC

None yet

Related Issue

None yet

Target Version

Fase 5 (Monetização) ou posterior

Success Metrics

Não definido ainda.

Notes

Ver `docs/superpowers/specs/2026-07-24-financiamento-troca-collection-design.md`, seção "Explicitly Out of Scope".

---

ID

BL-0006

Title

`stores.whatsapp_waba_id` column (WABA ID per store)

Problem

WABA ID (WhatsApp Business Account ID) is not persisted anywhere in the codebase — confirmed via full-repo grep (2026-07-27), zero references. Meta's Graph API requires the WABA ID (not the phone_number_id) for template-management operations (`message_templates` endpoint), which the project does not implement yet but will need for structured outbound (follow-up/reactivation templates, HSM). Speed Motos' real WABA ID (`28099462022990346`) was obtained 2026-07-27 during Cloud API rollout and currently has nowhere to live.

Business Value

Unblocks future template-based sending (required for WhatsApp-initiated conversations outside the 24h session window — follow-up and reactivation depend on this at scale).

Customer Value

None directly yet — infrastructure prerequisite, not user-facing.

Priority

P3 — not blocking current send/receive flow, which only needs `phone_number_id`. Becomes relevant when template sending is implemented.

Status

IDEA — recommended, not implemented. Raised during Speed Motos Cloud API cutover (2026-07-27).

Owner

Engineering

Estimated Complexity

Low — single nullable `TEXT` column, same pattern as `whatsapp_phone_number_id` (migration 017: `ALTER TABLE stores ADD COLUMN IF NOT EXISTS ... TEXT`, no FK, no encryption — public Meta ID, not a token). Would need a companion getter in `lib/whatsapp-credentials.ts` (e.g. `getStoreWabaId`) when actually consumed.

Dependencies

None to add the column. Actual consumption depends on template-sending work, not yet scoped.

Related ADR

None yet

Related RFC

None yet

Related Issue

None yet

Target Version

Fase 4 (Escala)

Success Metrics

Not yet defined — would tie to template message delivery/approval rate once template-sending work is scoped.

Notes

Raised during Speed Motos Cloud API cutover (2026-07-27) while wiring `whatsapp_phone_number_id`/`whatsapp_numero` for the real number. WABA ID (`28099462022990346`) has no home in the schema yet — this item is the fix. Not urgent: current send/receive path only needs `phone_number_id`.

---

ID

BL-0007

Title

Server Action pra realocar `public.users.store_id` (mover usuário entre lojas)

Problem

`app/admin/actions.ts` só tem `createStoreUser`/`createStoreUserDirect` — provisionam login **novo**, sempre. Não existe caminho oficial pra realocar um usuário já existente pra outro `store_id`. Descoberto na prática 2026-07-27: `vlinceira@gmail.com` (login pessoal do founder) e `vlinceira2@gmail.com` ("Speed Motos Admin", conta já nomeada pra isso) estavam ambos presos em `store_id` da loja Demo (`aaaaaaaa-...`), sem jeito de apontar pra Speed Motos real (`32359022-...`) sem UPDATE manual direto na tabela — o que foi feito como contorno pontual (`vlinceira2@` realocado via SQL direto), não via código.

Business Value

Reduz fricção operacional toda vez que uma conta precisa mudar de loja (erro de provisionamento, reorganização de equipe, downgrade de piloto pra produção). Hoje exige acesso direto ao banco — não escala pra alguém que não seja engenharia.

Customer Value

Nenhum diretamente — é ferramenta interna de operação/suporte (super-admin), não feature de cliente final.

Priority

P4 — baixa prioridade, mas vai reaparecer (mesma classe de problema toda vez que um usuário for criado com `store_id` errado ou precisar mudar de loja).

Status

IDEA — não implementado. Contorno manual já aplicado uma vez (2026-07-27, `vlinceira2@gmail.com`).

Owner

Engineering

Estimated Complexity

Baixa — nova Server Action em `app/admin/actions.ts` (`reassignUserStore(userId, newStoreId)`), protegida por `assertSuperAdmin()`, mesmo padrão de `updateStore`. `UPDATE users SET store_id = ? WHERE id = ?` com guard de `newStoreId` existir em `stores`. UI: dropdown de loja no card de cada usuário em `/admin`.

Dependencies

Nenhuma — `assertSuperAdmin()` e o modelo de `store_id` já existem.

Related ADR

None yet

Related RFC

None yet

Related Issue

None yet

Target Version

Sem agendamento

Success Metrics

Não definido — item de ferramenta interna, sem métrica de produto associada.

Notes

Constatado durante o cutover Cloud API da Speed Motos (2026-07-27): dois logins (`vlinceira@`, `vlinceira2@`) presos na loja Demo por falta desse caminho. `vlinceira2@gmail.com` foi realocado manualmente pra Speed Motos como resolução pontual; `vlinceira@` ficou de propósito na Demo como ambiente de teste.

---

ID

BL-0008

Title

Pipeline de envio multi-mensagem (bolhas separadas no WhatsApp)

Problem

O ajuste de tom de 2026-07-27 (`lib/prompts.ts`) pede respostas curtas quebradas em até 2-3 mensagens — hoje isso só é possível como quebra de linha dentro de uma única bolha do WhatsApp, porque o pipeline manda exatamente 1 mensagem por turno de IA (`lib/ai-pipeline.ts:213-243`, `lib/whatsapp-send.ts:63-126`, `AgentResult.reply_text` é string única em `lib/ai.ts:14-15`). Pra virar bolhas de verdade — como um vendedor mandando 2-3 mensagens seguidas — precisa de suporte real a múltiplos envios por turno.

Business Value

Atendimento mais humano/natural no WhatsApp — reduz a sensação de "bot" que uma resposta longa numa bolha só transmite, especialmente em saudação e qualificação inicial.

Customer Value

Lead recebe a conversa no ritmo que já espera de um vendedor real conversando no WhatsApp, não um bloco de texto único.

Priority

P1 — priorizado via DL-0009 (2026-07-30), decisão consciente de exceção à ordem de fase.

Status

✔ CONCLUÍDO E VALIDADO (2026-07-31) — implementado via TDD (commit `2922e7d`), validado por teste manual real na Speed Motos (bolhas chegando em ordem, com delay perceptível). Validação também expôs 2 bugs pré-existentes não relacionados ao BL-0008 em si (concorrência entre processos serverless, IA soando como fechada fora do horário) — ambos corrigidos e validados separadamente, ver `27_PROJECT_STATUS.md` RECENT COMPLETED WORK.

Owner

Engineering

Estimated Complexity

Médio. Arquivos afetados:
- `lib/ai.ts` — `AgentResult.reply_text: string` → `reply_texts: string[]`; `validateOutput` passa a validar array não-vazio (cap de itens e tamanho por item)
- `lib/prompts.ts` — schema de output no `[FORMATO DE RESPOSTA]` muda de `reply_text` string pra `reply_texts` array
- `lib/ai-pipeline.ts` — loop sequencial (nunca `Promise.all`, senão a Meta pode entregar fora de ordem): por chunk, `messages.insert` (linha própria) + `sendWhatsAppMessage`. `messageId` capturado hoje como valor único (linha 233, usado no retry) vira lista
- Sistema de retry (`app/api/internal/retry-failed`) — hoje assume 1 `message_id` por `ai_logs` pra reenvio em `ok_send_failed`; com N mensagens por turno precisa decidir se reenvia todas ou só a que falhou — é reescrita de lógica, não só de schema

Suites de teste que assumem hoje "1 mensagem por turno" como invariante e precisam revisão: `ai-pipeline.test.ts`, `ai-validation.test.ts`, `ai-output-guardrails.test.ts`, `prompts.test.ts`, `retry-failed.test.ts`.

Dependencies

Nenhuma técnica — depende só de decisão de prioridade.

Related ADR

None yet

Related RFC

None yet

Related Issue

None yet

Target Version

Fase 0 (fora de ordem — ver DL-0009), produção Speed Motos

Success Metrics

Não definido ainda.

Notes

Riscos levantados em 2026-07-27, ao decidir adiar:
- **Rate limit**: irrelevante no volume atual (1 loja) — Cloud API tem limite alto por tier. Vira relevante só em escala de centenas de lojas simultâneas.
- **Ordem de entrega**: só garantida se o envio for sequencial (`await` cada POST antes do próximo). Implementação errada (paralela) pode entregar fora de ordem — bug sutil, difícil de pegar em teste manual.
- **Qualidade do número na Meta**: número (`1238597592667311`) saiu do sandbox em 2026-07-27, `quality_rating: UNKNOWN`. Rajada de 2-3 mensagens automáticas sem delay logo no início da vida do número pode ler como comportamento de bot pro sistema de qualidade da Meta — motivo principal pra adiar até o número ter reputação estabelecida. Se implementado, considerar delay de 400-800ms entre envios.

**Reavaliação (DL-0009, 2026-07-30):** cautela acima revista — `quality_rating` é determinado principalmente por feedback do usuário (bloqueio/denúncia de spam), não por ritmo de envio; múltiplas mensagens curtas em sequência é prática comum de negócios reais na API. Risco real não é reputacional, é técnico (ordem de entrega — exige sequencial, nunca `Promise.all`). Motivou priorização P1 e implementação direta em produção da Speed Motos, com delay de 400-800ms entre envios.

---

ID

BL-0009

Title

UI de resposta manual do vendedor (campo de texto na conversa)

Problem

Não existe, em lugar nenhum do sistema, uma forma do vendedor mandar uma mensagem WhatsApp pro lead através do Vex Auto. `app/conversations/[id]/page.tsx` só tem forms de assumir/devolver/atualizar status — nenhum campo de texto. `sendWhatsAppMessage` (`lib/whatsapp-send.ts`) só é chamado pelo pipeline de IA, follow-up e reativação, nunca por ação manual. Confirmado durante investigação de bug 2026-07-27: hoje, se um vendedor responde um cliente durante o handoff, só pode estar fazendo isso pelo WhatsApp Manager nativo da Meta, fora do Vex Auto — essa resposta nunca aparece em `messages`, nunca é rastreada, nunca conta em métrica nenhuma.

Business Value

Sem isso, o produto não cumpre a promessa central: "IA atende 24/7, humano entra só no fechamento" pressupõe que o humano consegue atender *dentro do sistema*. Hoje ele não consegue — o handoff joga a conversa pra um vácuo operacional dentro do Vex Auto (mesmo que o vendedor responda por fora).

Customer Value

Vendedor atende o cliente sem sair do Vex Auto — sem alternar pra outro app, sem perder contexto do dossiê do lead.

Priority

**ALTA.** Bloqueia dois outros itens: reprocessamento de mensagens não respondidas (`BL-0010`, depende diretamente) e confiabilidade de métricas/histórico (qualquer métrica de resposta/tempo de atendimento hoje ignora respostas dadas fora do sistema, subestimando atendimento real).

Status

✔ CONCLUÍDO (2026-07-28, `0f65d99`) — item 0.9 do roadmap. `sendManualReply` (`lib/actions.ts`), form em `app/conversations/[id]/page.tsx`, migration 025 (`messages.sent_by`). Desbloqueia `BL-0010`.

Owner

Engineering

Estimated Complexity

Médio. Campo de texto + form na página da conversa (`app/conversations/[id]/page.tsx`), nova Server Action (ex: `sendManualReply(conversationId, text)`) que chama `sendWhatsAppMessage` (mesmo client já usado pelo pipeline) e insere em `messages` com `autor` identificando o vendedor (hoje `autor` é enum simples `ia`/`lead`/`sistema` — precisa decidir se vira `humano` genérico ou referencia `users.id` pra saber qual vendedor respondeu). Reaproveita `getStoreWhatsAppPhoneId` já existente.

Dependencies

Nenhuma técnica — `sendWhatsAppMessage` e `getStoreWhatsAppPhoneId` já existem e são reaproveitáveis.

Related ADR

None yet

Related RFC

None yet

Related Issue

BL-0010 (reprocessamento, bloqueado por este item)

Target Version

Deveria entrar antes do próximo teste de handoff em produção

Success Metrics

Toda resposta de vendedor durante handoff passa a existir em `messages` com autor identificável — zero resposta "invisível" ao sistema.

Notes

Achado que motivou este item foi considerado mais importante que o bug original que disparou a investigação (mensagens não respondidas ao devolver pra IA) — sem esta UI, qualquer automação em cima de "mensagem sem resposta no banco" corre risco de duplicar ou contradizer uma resposta que o vendedor já deu por fora do sistema (ver `BL-0010`, risco 4).

---

ID

BL-0010

Title

Reprocessar mensagens não respondidas ao devolver conversa pra IA

Problem

Cenário real de teste (2026-07-27): conversa foi pra `AGUARDANDO_HUMANO`, cliente mandou mensagens, ninguém respondeu. Ao devolver pra IA (`returnConversationToAI`, `lib/actions.ts:51-76`), nada acontece além da troca de estado — a IA só volta a responder se o cliente mandar mensagem nova. As mensagens que ficaram esperando durante o handoff nunca são respondidas.

Diagnóstico técnico completo: `returnConversationToAI` não chama `runAiPipeline` em nenhum momento, só `transitionConversationStatus` + insert de mensagem de sistema (`lib/status.ts:145-169` é update de banco puro, sem side-effect). `ingestMessage` salva mensagens `entrada` durante o handoff normalmente (não checa `handoff_to`); o guardrail (`lib/guardrails.ts:102-107`) é quem bloqueia a IA de responder, retornando `agent_status: "skipped_handoff"` sem gerar reply.

Business Value

Fecha o buraco do funil: hoje toda mensagem mandada durante o handoff é uma chance de conversão jogada fora se o vendedor não responder manualmente E não devolver de um jeito que reative a IA sozinha.

Customer Value

Cliente não fica no vácuo depois que a conversa "volta pra IA" — recebe resposta às mensagens que já tinha mandado, sem precisar mandar de novo.

Priority

Alta intenção. **DESBLOQUEADO (2026-07-28):** `BL-0009` concluído — risco 4 abaixo agora tem mitigação (UI de resposta manual existe). Pronto pra ser pego.

Status

IDEA — não implementado, desenho técnico já validado em 2026-07-27. Pré-requisito (`BL-0009`) satisfeito desde 2026-07-28 — desbloqueado, pronto pra ser pego.

Owner

Engineering

Estimated Complexity

Médio, assumindo `BL-0009` já resolvido:
- Identificar mensagens `entrada` não respondidas na janela do handoff: usar os marcadores de sistema (`"Conversa assumida por humano"` / `"Conversa retornada para IA"`, `autor: "sistema"`) como bordas da janela; `entrada` sem `saida` depois dela (de nenhum autor, incluindo agora `autor` humano via `BL-0009`) e antes da próxima `entrada` conta como não respondida
- Concatenar as não respondidas num `incoming_text` só e disparar `runAiPipeline` uma vez — evita reabrir o risco de ordem/múltiplos envios do `BL-0008`
- **Threshold de 30 minutos** (decisão de produto, 2026-07-27): handoff com duração acima de 30min desde a última mensagem não respondida → não dispara reprocessamento automático, só marca pendência pro vendedor tratar manualmente. Dentro da janela de 30min, dispara normal
- Dentro da janela, o prompt precisa reconhecer o tempo decorrido (mesmo padrão já usado pra data atual em `lib/prompts.ts` — `formatToday`) pra IA não soar como se estivesse respondendo em tempo real quando não está
- Precisa de guarda de idempotência no gatilho do botão "devolver pra IA" — não existe hoje equivalente ao `isReplayedMessage` do webhook pra esse tipo de disparo (clique de botão, não WAMID); risco de duplo-clique disparando o pipeline 2x pras mesmas mensagens

Dependencies

**`BL-0009`** (UI de resposta manual) — ✔ satisfeito (2026-07-28, `0f65d99`). Sem isso, "sem resposta no banco" não significa "sem resposta enviada" (vendedor pode ter respondido pelo WhatsApp Manager nativo da Meta, fora do sistema) — reprocessar nesse caso duplicaria ou contradiria uma resposta humana real. Com a UI existindo, essa ambiguidade não existe mais — qualquer resposta humana passa a estar em `messages` com `autor:"humano"`.

Related ADR

None yet

Related RFC

None yet

Related Issue

BL-0009 (bloqueante), BL-0008 (mesma classe de risco de ordem/múltiplos envios, mitigada aqui por concatenar num disparo só)

Target Version

Depois de BL-0009

Success Metrics

Zero mensagem de handoff sem resposta 30min depois do "devolver pra IA", dentro da janela de threshold.

Notes

Riscos técnicos mapeados em 2026-07-27, na ordem que o dono do produto pediu pra avaliar:
1. **Resposta duplicada** — mitigado por guarda de idempotência no gatilho (a construir, não existe hoje nada equivalente pra esse tipo de disparo)
2. **Ordem de entrega** — mitigado por concatenar num disparo só em vez de 1 disparo por mensagem (se decidir fazer 1-por-mensagem no futuro, reabre o mesmo risco do `BL-0008`, sequencial obrigatório)
3. **Handoff durou horas, resposta fica sem sentido** — mitigado pelo threshold de 30min (decisão de produto) + reconhecimento de tempo decorrido no prompt
4. **Vendedor já respondeu fora do sistema** (risco mais sério, motivou `BL-0009` virar bloqueante) — sem UI de resposta manual, não tem como saber se "sem linha em `messages`" significa "sem resposta enviada". Esse item só é seguro de implementar depois de `BL-0009` existir.

---

ID

BL-0011

Title

Handoff parcial por assunto (preço/negociação não deveria travar o resto da conversa)

Problem

Caso real de teste (2026-07-27): lead perguntou "tem desconto nela?" — disparou `should_handoff=true` (regra de `lib/prompts.ts`, REGRAS FIXAS: "Se o lead insistir em desconto... defina should_handoff=true"), que transiciona a conversa inteira pra `AGUARDANDO_HUMANO`/`handoff_to=HUMANO` (`lib/ai-pipeline.ts:266-276`). A pergunta seguinte do mesmo lead, "tem quantas 160 no momento?" — pergunta de estoque, sem nenhuma relação com preço — também ficou sem resposta, porque `runGuardrails` (`lib/guardrails.ts:102-107`) é um gate binário: qualquer mensagem nova enquanto `handoff_to=HUMANO`, de qualquer assunto, cai direto em `mode: "human_handoff"` sem olhar o conteúdo. Como "tem desconto?" é uma das perguntas mais comuns do funil de vendas, esse é provavelmente o caminho mais frequente que leva o lead ao vácuo — mais frequente que o cenário geral do `BL-0010`.

Business Value

Evita perder o resto da conversa (perguntas de estoque, catálogo, agendamento) só porque uma pergunta específica de preço precisou de aprovação humana. Reduz a fração de leads que esfriam esperando resposta de uma pergunta que a IA nem precisava travar.

Customer Value

Lead continua recebendo resposta pras perguntas que a IA pode responder sozinha (estoque, catálogo, agendamento), enquanto só a negociação de preço espera o vendedor.

Priority

Alta intenção — impacto direto em conversão, caminho frequente. Mas é mudança estrutural (ver avaliação técnica abaixo), não é ajuste pequeno — prioridade de implementação é decisão de produto, não travada tecnicamente.

Status

RESOLVIDO (2026-08-05) — implementado como roadmap 1.11, escopo contido a 1 tópico ("preco_negociacao"), conforme a avaliação técnica abaixo previu (`handoff_topics` jsonb, guardrail condicional, `detectSignals` estendido, ação de retorno limpando o tópico). Ver `53_ROADMAP.md` item 1.11 e `27_PROJECT_STATUS.md` para detalhe completo da implementação e validação em produção real.

Owner

Engineering

Estimated Complexity

**Avaliação técnica: o modelo atual não comporta isso sem mudança estrutural.**

`conversations.handoff_to` é um campo binário (`"IA" | "HUMANO"`) na própria linha da conversa — não existe conceito de "assunto suspenso". `runGuardrails` trata handoff como gate de prioridade máxima logo no passo 2 (linha 102-107): retorna `mode: "human_handoff"` **antes de olhar o conteúdo da mensagem nova**. Pra existir handoff parcial, seriam necessárias mudanças em pelo menos 4 pontos:

1. **Novo estado além do binário** — algo como `handoff_topics: string[]` (coluna nova ou, seguindo o precedente já existente de `leads.contexto.pending_topics` usado pela coleta de financiamento/troca, um campo jsonb equivalente pra "tópicos suspensos aguardando humano")
2. **`runGuardrails` reestruturado** — o gate do passo 2 não pode mais ser um `return` incondicional; precisa virar condicional ao tópico da mensagem nova: se bate com o tópico suspenso (preço/negociação), handoff continua pra essa mensagem; se não bate (estoque, catálogo), segue fluxo normal
3. **Classificador determinístico de tópico "preço/negociação"** — crítico: essa classificação tem que acontecer **antes** de decidir se chama a LLM ou não (é o guardrail, pré-LLM, que decide). Não dá pra usar a própria LLM pra classificar "isso é sobre preço?", porque se for, a LLM não pode ser chamada — seria circular. `detectSignals` (`lib/lead-scoring.ts:80-105`) já é um classificador determinístico funcionando nesse exato padrão (casa frases fixas contra `incoming_text` pra `financiamento`/`troca`) — quem for implementar deve **estender esse mesmo detector** com termos de preço/negociação ("desconto", "abaixa", "melhor preço"), não construir um novo do zero
4. **Ação de retorno com escopo** — `returnConversationToAI` hoje limpa o handoff inteiro; precisaria virar topic-aware (`clearHandoffTopic(conversationId, topic)`) pra reabrir só o tópico resolvido, não a conversa toda

Interação com `BL-0009`: a UI de resposta manual também precisaria expor **qual tópico** está suspenso, não só "em handoff" — mais uma camada de UI em cima do que já é trabalho novo.

**Não é 1 guardrail a mais — é adicionar uma dimensão inteira ao modelo de estado da conversa.** Esforço: Alto.

Dependencies

Nenhuma bloqueante direta, mas compõe com `BL-0009` (UI precisa refletir handoff parcial) e usa o mesmo padrão de detecção determinística que `BL-0008`/coleta já usam (`detectSignals`).

Related ADR

Provável candidato a ADR próprio, dado o tamanho da mudança de modelo — não decidido ainda.

Related RFC

None yet

Related Issue

Caso concreto: teste 2026-07-27, sequência "tem desconto nela?" → "tem quantas 160 no momento?" sem resposta

Target Version

Sem agendamento — decisão de produto sobre priorizar essa mudança estrutural

Success Metrics

Não definido ainda.

Notes

Achado durante a mesma investigação de bug que gerou `BL-0009`/`BL-0010` (2026-07-27). "Tem desconto?" sendo uma das perguntas mais comuns do funil torna esse o caminho de vácuo mais frequente entre os três itens registrados nessa sessão — vale considerar priorizar na frente de `BL-0010` apesar do esforço maior, já que resolve uma fração maior do problema de "lead esfria esperando handoff".

---

BL-0012

Title

Persistir `metadata.phone_number_id` do webhook Meta em `messages.meta`

Problem

`app/api/whatsapp/webhook/route.ts` só lê `metadata.display_phone_number` (usado pra achar a loja por `stores.whatsapp_numero`) — `metadata.phone_number_id`, o identificador canônico da Meta pro número que recebeu a mensagem, é descartado, nunca logado, nunca persistido. Com múltiplas lojas/números (ou mesmo uma loja trocando de número), não dá pra auditar retroativamente de qual `phone_number_id` cada evento chegou. Achado em 2026-07-28: essa lacuna impediu confirmar B001 por evidência direta de payload — a resolução teve que se apoiar em `stores.whatsapp_phone_number_id` (causa) + `agent_status: ok` (efeito) em vez do dado do próprio evento.

Business Value

Auditoria/debug mais rápido em incidente de roteamento de número — hoje, se um evento chegar "estranho", não tem como confirmar por qual `phone_number_id` ele entrou sem inferir de outra fonte.

Customer Value

Nenhum direto — é observabilidade interna, não visível pro lead ou pro vendedor.

Priority

Baixa — custo baixo, mas nenhum incidente real até hoje que dependesse disso pra ser resolvido (B001 foi resolvido sem esse dado, por outra cadeia de evidência).

Status

IDEA — não implementado.

Owner

Engineering

Estimated Complexity

Baixo. `messages.meta` já existe (jsonb, default `{}`, mesmo campo usado pelo aviso de IA — `AI_DISCLOSURE_KIND` em `lib/ai-pipeline.ts`). Bastaria incluir `phone_number_id: metadata?.phone_number_id ?? null` no objeto `meta` do insert em `ingestMessage`/`webhook_ingest_message`, e tipar o campo no payload do webhook (`route.ts:71` só declara `display_phone_number` hoje). Sem migration.

Dependencies

Nenhuma.

Related ADR

None

Related RFC

None

Related Issue

B001 (`27_PROJECT_STATUS.md`, ACTIVE BLOCKERS) — resolvido em 2026-07-28 sem esse dado; a ausência dele foi registrada como ressalva de evidência na resolução.

Target Version

Sem agendamento.

Success Metrics

Não definido.

Notes

Baixa prioridade proposital — não implementar sem pedido explícito.

---

BL-0013

Title

Demo por auto-simulação da IA (ferramenta de conversão de venda)

Problem

Hoje não existe forma de um prospect (dono de loja avaliando o VEX) EXPERIMENTAR a IA antes de comprar. A venda depende de explicar o produto, o que converte menos que deixar o prospect sentir na prática.

Business Value

Aumenta conversão da venda B2B. Técnica validada em concorrente real (Thera Company / THERA.IA — na demo deles, o vendedor IA diz "me manda um Oi que eu te atendo como o vendedor" e transforma a venda numa demonstração ao vivo; o prospect vira "cliente" por alguns minutos e sente o produto). Custo de construção baixo: reusa o MESMO motor de IA que já atende cliente em produção — não é produto novo, é o motor existente apontado pra um contexto de simulação.

Customer Value

O prospect (lojista) experimenta o atendimento de IA como se fosse um cliente da própria loja dele, antes de decidir comprar — reduz a incerteza de "será que funciona pro meu caso".

Priority

P2 (Fase 1 — ferramenta de aquisição; não bloqueia Fase 0).

Status

IDEA — não implementado, registrado a partir de análise competitiva (Thera, 28/07/2026).

Owner

Founder / Engineering

Estimated Complexity

Decompor em DUAS peças de complexidade distinta:
(a) MODO DEMO na IA — um estado que sinaliza "isto é simulação, use um cenário de exemplo fixo (veículo fictício, loja fictícia), NÃO o estoque real de um tenant". Reusa o pipeline de IA existente. Médio, testável isolado.
(b) CANAL DE ENTRADA da demo — onde o prospect dispara ("mande um oi"): botão na landing, número de WhatsApp dedicado do VEX pra demo, ou reuso de número existente. Depende de como a landing (1.7) e a infra de número são construídas. Não estimável até 1.7 existir.

Dependencies

Landing page de vendas (item 1.7 do `53_ROADMAP.md`) — a demo vive onde o prospect encontra o VEX. Conecta também com o mascote de qualificação (1.8). NÃO começar antes de 1.7 existir.

Related ADR

None

Related RFC

None

Related Issue

Item 1.7 e 1.8 do `53_ROADMAP.md`

Target Version

Fase 1

Success Metrics

Taxa de conversão prospect→demo→call agendada; a definir quando a landing existir.

Notes

Origem — análise competitiva da Thera Company (28/07/2026, via prints de conversa real). A Thera usa exatamente esse fluxo de demo por auto-simulação e converte bem. IMPORTANTE — o que replicar é só o FORMATO de demo (auto-simulação ao vivo), NÃO o tratamento de dado sensível da Thera: eles expõem CPF em texto claro no dossiê do grupo e não verificam idade antes de coletar dado de financiamento (num caso real o lead tinha 19 anos e o fluxo coletaria CPF/financiamento sem checagem). O VEX já é mais maduro nisso (CPF removido do `ai_logs`) e NÃO deve regredir. Ver também: item separado de verificação de idade no fluxo de coleta de financiamento (a validar/criar em sessão futura, não faz parte deste BL).

---

BL-0014

Title

Guarda de idade no fluxo de coleta de financiamento

Problem

`FinanciamentoData` (`lib/ai.ts`) não tem campo de nascimento/idade, e nenhum ponto do fluxo de coleta (`lib/guardrails.ts`, `lib/collection.ts`, `lib/prompts.ts`) checa maioridade antes de persistir CPF/renda em `contexto.financiamento`. Achado durante investigação de compliance (29/07/2026), motivada por análise competitiva da Thera (28/07/2026, ver notas de `BL-0013`) — a Thera coleta CPF/dado financeiro sem checar idade, inclusive de um lead de 19 anos num caso real observado. VEX hoje tem a mesma lacuna estrutural (não foi cópia do bug da Thera — o gap já existia desde o design original do spec de coleta, `2026-07-24-financiamento-troca-collection-design.md`, que nunca mencionou idade nos Edge Cases).

Business Value

Evita risco de compliance/reputacional — coletar CPF e dado financeiro de menor sem checagem é o tipo de falha que uma auditoria ou imprensa usaria contra o produto. Diferencial de maturidade frente ao concorrente mapeado (DL-0007).

Customer Value

Lojista não fica exposto a um financiamento iniciado no nome de um menor de idade — vendedor humano recebe o caso já sinalizado, com motivo explícito, em vez de descobrir tarde na negociação.

Priority

P1 — compliance, não é feature de conversão, mas bloqueia lacuna de risco identificada com evidência externa real.

Status

✔ CONCLUÍDO (29/07/2026) — implementado via TDD na mesma sessão. `lib/ai.ts`/`lib/agent-context.ts` (schema: `data_nascimento`, `financiamento_bloqueio`, `titular_diferente_do_lead`), `lib/prompts.ts` (pergunta única inclui nascimento; instrução de troca de titular), `lib/collection.ts` (`calculateAge` + guarda em `applyCollectionUpdate`). Sem migration (jsonb). 10 testes novos (`ai-validation.test.ts`, `collection.test.ts`, `prompts.test.ts`), suíte completa 688/688 verde, lint e typecheck limpos.

Owner

Engineering

Estimated Complexity

Médio. Toca 3 arquivos sem migration:
- `lib/ai.ts` — `FinanciamentoData` ganha `data_nascimento` (ISO `YYYY-MM-DD`, consistente com `agendamento_data`/migration 022); `LeadContexto`/estado de coleta ganha `titular_diferente_do_lead: boolean` pra rastreio de troca de titular
- `lib/prompts.ts` — pergunta única de financiamento passa a incluir nascimento; instrução condicional pra IA propor troca de titular quando detectar menor, reiniciando coleta completa (nome+CPF+renda+entrada) pra nova pessoa, nunca só um CPF solto
- `lib/collection.ts` (`applyCollectionUpdate`) — calcula idade a partir de `data_nascimento` antes de persistir `cpf`/`renda_aproximada`; bloqueia persistência se <18, sinaliza handoff com motivo específico (`financiamento_menor_idade`, não handoff genérico); mesmo bloqueio se repete se o responsável indicado também for menor

Dependencies

Nenhuma técnica — estende fluxo já implementado (`147f1ef`, spec `2026-07-24-financiamento-troca-collection-design.md`). Sem migration (jsonb, mesmo padrão de `troca_draft`).

Related ADR

None yet

Related RFC

None yet

Related Issue

BL-0013 (notes — origem do achado, análise competitiva Thera 28/07/2026)

Target Version

Fase 0/2 — compliance, não espera fase de escala

Success Metrics

Zero CPF/renda persistido em `contexto.financiamento` para lead sinalizado como menor de idade. Handoff com motivo `financiamento_menor_idade` rastreável no dossiê.

Notes

Fora de escopo: verificação de identidade real (confirmar que quem informou o CPF é de fato quem diz ser) — limitação inerente de qualquer canal de texto, não solucionável neste item. Mesma filosofia do guardrail de margem (`lib/actions.ts`) e da fase collect de financiamento existente (`lib/collection.ts`, `should_handoff` forçado no código): regra inegociável garantida por código, não confia só na instrução do prompt.

---

NOTA (não é item formal de backlog)

Achado adjacente durante fechamento do item 0.4 (Sentry, 2026-07-29): `AgentParseError` (`lib/ai.ts`) embute até 80 chars do output bruto da LLM na própria mensagem do erro (`raw.slice(0, 80)`). Se a LLM ecoar nome de lead num JSON malformado, esses chars passam pro Sentry sem filtro de nome — CPF/telefone continuam protegidos (`lib/sentry-scrub.ts` roda regex sobre qualquer string, confirmado por teste dedicado), mas nome livre não tem padrão fixo pra regex pegar. Vetor teórico e de baixa probabilidade (depende da LLM ecoar nome numa saída já malformada) — não bloqueou fechamento de 0.4. Revisitar só se houver evidência real de ocorrência (checar `raw` interpolado no Sentry por `pipeline_stage: "run_ai_pipeline"`).

---

BL-0015 — RESOLVIDO (2026-07-29)

Achado durante investigação do fallback de nome nos templates de follow-up/reativação: `nome?.trim() || "você"` (4 ocorrências, `lib/follow-up.ts` + `lib/reactivation.ts`) só cobria `null`/vazio/espaço. Nome tipo `"😊"` ou `"-"` (não-vazio após trim, mas sem letra) passava direto, virando vocativo sem sentido no WhatsApp do lead.

Fix: `lib/lead-name.ts` — `isValidLeadName`/`getSafeName` centralizados, exigindo ao menos 1 letra Unicode (`/\p{L}/u`). As 4 ocorrências substituídas pela chamada única. TDD (`tests/unit/lead-name.test.ts` + casos de integração em `follow-up.test.ts`/`reactivation.test.ts`). Ver detalhe em `27_PROJECT_STATUS.md`.

Fora de escopo (decisão consciente, não gap esquecido): origem do dado (`leads.nome` ← `profile.name` do WhatsApp, capturado sem validação no webhook) não foi tocada — fix é só no ponto de uso do template.

---

BL-0016

Title

Horário de atendimento presencial por loja (hoje env var global) + parser determinístico de agendamento_horario

Problem

Achado durante o fix do bug "IA soa como fechada fora do horário" (2026-07-30, ver `27_PROJECT_STATUS.md`). Dois pontos relacionados, registrados juntos porque tocam a mesma peça de dado (horário de expediente presencial):

1. `BUSINESS_HOURS_START`/`BUSINESS_HOURS_END` (`lib/ai-pipeline.ts`) são env vars globais, a mesma janela pra qualquer loja — não existe coluna de horário de funcionamento em `stores`. Contradiz o padrão per-tenant já fechado em DL-0002 (credencial de WhatsApp é por loja, não global) — funciona "por acaso" hoje porque só existe 1 loja (Speed Motos), mesma classe de dívida que `WHATSAPP_ACCESS_TOKEN` global já é (documentada em DL-0003).
2. A validação de horário pro agendamento presencial (implementada no mesmo fix, `lib/prompts.ts`) é guiada por instrução de prompt, não determinística em código — porque `leads.agendamento_horario`/`troca_draft.agendamento_horario` (`lib/collection.ts`) é texto livre (ex: "sábado de manhã"), sem parser pra hora estruturada. Isso é exceção consciente ao padrão do projeto (guardrail de margem, guarda de idade BL-0014: "regra inegociável garantida por código, nunca confia só na instrução do prompt") — aceito porque a consequência de errar aqui é baixa (pior caso: vendedor reagenda manualmente), diferente de compliance/margem. Se `agendamento_horario` virar campo estruturado no futuro, essa validação deveria migrar pra guardrail em código, junto com o item 1 acima.

Business Value

Evita repetir o padrão de "descoberta tardia quando o segundo cliente chegar" que já aconteceu com o WhatsApp token global (DL-0003) — registrar agora, com o achado fresco, em vez de redescobrir na hora de onboardar o cliente 2.

Customer Value

Cada loja configura seu próprio horário de atendimento presencial sem depender de variável de ambiente/deploy — igual já vale pro número de WhatsApp por loja.

Priority

P3/P4 — não bloqueia o piloto atual (1 loja, `BUSINESS_HOURS_START`/`END` funciona hoje). Vira bloqueante técnico junto com `WHATSAPP_ACCESS_TOKEN` per-loja quando o segundo cliente for onboardado (mesma dependência raiz de multi-tenant real).

Status

IDEA — não implementado, registrado no momento do achado (2026-07-30)

Owner

Engineering

Estimated Complexity

Médio. Dois sub-itens que podem ser feitos juntos ou separados:
- Horário por loja: coluna nova em `stores` (ex: `horario_atendimento_inicio`/`fim`), `lib/guardrails.ts` passa a receber config por `store_id` em vez de env var global — migration nova
- Parser determinístico de agendamento: exigiria `agendamento_horario` virar campo estruturado (hora, não texto livre) — mudança de schema (`leads`/`troca_draft`) e de prompt (LLM extrai hora estruturada em vez de texto livre), reabre a coleta de troca inteira

Dependencies

Nenhuma técnica imediata. Mesma dependência raiz de CNPJ próprio/BM do Vex (BL-0001) que já bloqueia o padrão per-tenant completo do WhatsApp — natural fazer junto quando o segundo cliente for onboardado.

Related ADR

None yet

Related RFC

None yet

Related Issue

DL-0002 (credencial por tenant, não global — mesmo princípio), DL-0003 (WHATSAPP_ACCESS_TOKEN global como dívida documentada, mesma classe), BL-0014 (padrão "regra inegociável em código" que a validação de horário conscientemente não segue)

Target Version

Fase 2/3 — junto de outras migrações multi-tenant, antes do 2º cliente pagante

Success Metrics

Horário de atendimento presencial configurável por loja sem variável de ambiente. Se revisitado: validação de agendamento vira guardrail determinístico em código, não mais dependente só da LLM interpretar texto livre corretamente.

Notes

Nenhum dos dois pontos bloqueou o fix de 2026-07-30 (bug era comportamento, não schema) — registrados aqui só pra não repetir o padrão de descoberta tardia.

---

BL-0017

Title

Decidir modelo de dado de conversations.assigned_to vs leads.assigned_to (returnConversationToAI zera um, preserva o outro)

Problem

Achado durante o fix do item 1.9 do roadmap (handoff que zerava o dono do lead, `lib/actions.ts:assignConversationToHuman`, 2026-07-31). O fix corrigiu `assignConversationToHuman` para nunca zerar `assigned_to` — preserva o dono existente em `leads.assigned_to` ou atribui ao usuário que assume a conversa, mantendo `conversations.assigned_to` e `leads.assigned_to` consistentes entre si nesse fluxo. `returnConversationToAI` (mesmo arquivo) não foi tocado — fora de escopo do 1.9 — e continua zerando `conversations.assigned_to` quando a conversa volta pra IA, enquanto `leads.assigned_to` permanece preservado. Resultado: as duas colunas ficam inconsistentes fora do fluxo de handoff (uma null, outra não) assim que a IA retoma uma conversa que já teve dono.

Business Value

Evita ambiguidade de dado que pode virar bug de métrica ou confusão de UI no futuro (ex: se algum dia `conversations.assigned_to` passar a ser lido em algum lugar, vai contradizer `leads.assigned_to`). Decisão registrada agora, achado fresco, em vez de redescoberta tardia — mesmo padrão de DL-0003/BL-0016.

Customer Value

Nenhum impacto direto hoje — `conversations.assigned_to` não é lido em nenhuma tela nem métrica (`team-metrics.ts`/`app/equipe`/`app/leads` usam só `leads.assigned_to`). Valor é evitar dívida de modelo de dado silenciosa.

Priority

P3 — não bloqueia nada hoje (coluna não lida em produção). Vira relevante se `conversations.assigned_to` ganhar algum consumidor novo, ou se o modelo de posse do lead for revisitado.

Status

IDEA — não implementado, registrado no momento do achado (2026-07-31)

Owner

Engineering

Estimated Complexity

Baixa-Média. Duas direções possíveis, a decidir:
- Remover `conversations.assigned_to` como coluna separada — fonte única de verdade vira `leads.assigned_to` (migration de drop de coluna + remoção do parâmetro `assigned_to` de `transitionConversationStatus`)
- Manter as duas, mas definir semântica distinta explícita (ex: `conversations.assigned_to` = quem está atendendo esta sessão agora, reseta ao voltar pra IA; `leads.assigned_to` = dono permanente do lead, nunca resetado por handoff) e fazer `returnConversationToAI` respeitar essa semântica de forma documentada, não por omissão

Dependencies

Nenhuma técnica imediata. Depende só de decisão de produto/arquitetura sobre o que "dono do lead" significa quando a IA retoma a conversa.

Related ADR

None yet

Related RFC

None yet

Related Issue

Item 1.9 do `53_ROADMAP.md` (origem do achado), `lib/actions.ts:returnConversationToAI`

Target Version

Não definida — aguardando decisão de modelo de dado

Success Metrics

`conversations.assigned_to` e `leads.assigned_to` nunca ficam em estados contraditórios (um preenchido, outro null) em nenhum ponto do fluxo de conversa, não só no handoff pra humano.

Notes

Não corrigido de propósito durante o 1.9 — expandir esse fix pra decisão de modelo de dado maior no meio de um bugfix pontual foi considerado risco de escopo, não economia de tempo.

---

BL-0018

Title

Desempenho de vendedores — nota por atendimento, semáforo, tempo médio de resposta, drill-down

Problem

`/equipe` hoje mostra métricas agregadas por vendedor (`calculateSellerMetrics`: total, ativos, fechados, score médio) mas não tem visão de qualidade/velocidade de atendimento por lead individual nem sinal visual rápido de quem está atendendo bem ou mal.

Business Value

OBSERVADO NO CONCORRENTE (AutoPilot CRM, reunião de vendas 31/07/2026) — avaliar, não é compromisso de build. Eles têm: tempo médio de resposta, nota pro atendimento, vendedores listados com nota separada, resposta de cada cliente em semáforo (verde/amarelo/vermelho), e ao clicar no vendedor vê quais leads ele atendeu e a nota de cada lead. Dá visibilidade gerencial de quem precisa de coaching/atenção sem precisar abrir conversa por conversa.

Customer Value

Dono da loja identifica rápido qual vendedor está deixando lead esfriar, sem precisar auditar conversa por conversa manualmente.

Priority

Não definida — sujeita ao filtro de posicionamento B+ (`DL-0007`) antes de entrar em fase.

Status

IDEA — observado no concorrente, avaliar. Não é decisão de construir.

Owner

Não definido

Estimated Complexity

Não estimado. Tempo médio de resposta e nota por lead exigem definir metodologia de cálculo (o que conta como "resposta", qual fórmula gera a nota) antes de estimar.

Dependencies

`leads.assigned_to` (já existe, `/equipe`), dados de timestamp de mensagens já existentes em `messages`.

Related ADR

None

Related RFC

None

Related Issue

Intel competitiva AutoPilot CRM, reunião de vendas 31/07/2026 — perfil completo em `53_ROADMAP.md` (Concorrentes mapeados)

Target Version

Não definida

Success Metrics

Não definida — depende de decisão de construir

Notes

Origem: reunião de vendas com AutoPilot CRM (31/07/2026). Decisão de construir depende de avaliação futura contra o posicionamento B+ (`DL-0007`) — cópia de feature de concorrente sem passar por esse filtro é risco consciente a evitar.

---

BL-0019

Title

Kanban de pipeline com estágios de negócio nomeados (coleta → interesse → troca → visita → proposta enviada → aprovada → negociação)

Problem

Kanban atual do VEX é baseado em `lead_status` (NOVO → ENGAJADO → INTERESSADO → QUENTE → NEGOCIAÇÃO → FECHADO/PERDIDO) — estágios de qualificação, não de processo de venda propriamente dito (não distingue "visita agendada" de "proposta enviada" de "proposta aprovada", por exemplo).

Business Value

OBSERVADO NO CONCORRENTE (AutoPilot CRM, reunião de vendas 31/07/2026) — avaliar, não é compromisso de build. Estágios deles: coleta nome e cidade → interesse veículo → identificar troca → visita → proposta enviada → proposta aprovada → em negociação. Granularidade de processo comercial mais fina que o `lead_status` atual do VEX.

Customer Value

Vendedor/gerente enxerga exatamente em que etapa do processo comercial (não só de qualificação) cada lead está.

Priority

Não definida — sujeita ao filtro de posicionamento B+ (`DL-0007`) antes de entrar em fase.

Status

IDEA — observado no concorrente, avaliar. Não é decisão de construir.

Owner

Não definido

Estimated Complexity

Não estimado. Requer decidir se substitui `lead_status` ou convive como campo separado (`lead_status` já é usado por guardrail de margem e Kanban existente — mudança não é cosmética).

Dependencies

Kanban existente (`app/leads` ou equivalente), `lead_status` (schema atual).

Related ADR

None

Related RFC

None

Related Issue

Intel competitiva AutoPilot CRM, reunião de vendas 31/07/2026 — perfil completo em `53_ROADMAP.md` (Concorrentes mapeados)

Target Version

Não definida

Success Metrics

Não definida — depende de decisão de construir

Notes

Origem: reunião de vendas com AutoPilot CRM (31/07/2026). Decisão de construir depende de avaliação futura contra o posicionamento B+ (`DL-0007`).

---

BL-0020

Title

Modo "shadow-like" — notificação com resumo da conversa no WhatsApp do vendedor + captura automática da resposta

Problem

Hoje handoff pra humano exige o vendedor entrar no Vex Auto (`sendManualReply`, BL-0009) pra responder o lead — sem opção de responder direto do WhatsApp pessoal com captura automática.

Business Value

OBSERVADO NO CONCORRENTE (AutoPilot CRM, reunião de vendas 31/07/2026) — avaliar, não é compromisso de build. Modo Shadow deles (plano MAX) foi desmistificado na call: NÃO é espelhamento mágico, é notificação estruturada — vendedor recebe no próprio WhatsApp um resumo completo da conversa, responde de lá, CRM captura tudo automaticamente. Ataca objeção de adoção (vendedor não quer sair do WhatsApp pessoal) sem exigir número dedicado por vendedor.

Customer Value

Vendedor resistente a mudar de ferramenta consegue atender pelo canal que já usa, sem o VEX perder visibilidade/histórico do atendimento.

Priority

Não definida — sujeita ao filtro de posicionamento B+ (`DL-0007`) antes de entrar em fase. Avaliar também se colide com "credencial de integração externa é por tenant" (`CLAUDE.md`) e com o modelo de handoff atual (`assignConversationToHuman`).

Status

IDEA — observado no concorrente, avaliar. Não é decisão de construir.

Owner

Não definido

Estimated Complexity

Não estimado. Viabilidade técnica não confirmada — depende de avaliar se dá pra replicar via API oficial da Meta (WhatsApp Cloud API não tem primitiva nativa de "notificar número pessoal + capturar resposta de volta pro sistema" — precisa investigar se é webhook duplo, número de notificação separado, ou outro mecanismo). Pode não ser viável sem workaround fora da API oficial.

Dependencies

Investigação técnica de viabilidade via API oficial (não feita ainda). Modelo de handoff atual (`lib/actions.ts:assignConversationToHuman`).

Related ADR

None

Related RFC

None

Related Issue

Intel competitiva AutoPilot CRM, reunião de vendas 31/07/2026 — perfil completo em `53_ROADMAP.md` (Concorrentes mapeados)

Target Version

Não definida

Success Metrics

Não definida — depende de decisão de construir

Notes

Origem: reunião de vendas com AutoPilot CRM (31/07/2026). Decisão de construir depende de avaliação futura contra o posicionamento B+ (`DL-0007`) e de investigação de viabilidade técnica via API oficial.

---

BL-0021

Title

Dashboard de origem de lead — funil por canal (tráfego, OLX, Instagram, etc)

Problem

VEX hoje não mostra de onde cada lead veio de forma agregada em dashboard — origem existe como dado (`leads`, campo de origem) mas sem visualização de funil por canal.

Business Value

OBSERVADO NO CONCORRENTE (AutoPilot CRM, reunião de vendas 31/07/2026) — avaliar, não é compromisso de build. IA deles identifica origem de cada lead e entrega funil no dashboard mostrando de onde a pessoa veio (tráfego, OLX, Instagram, etc). ATENÇÃO: avaliar se cabe no B+ sem virar gestão de mídia — este item é distinto do dashboard de tráfego/anúncios/investimento/CPL/CPA deles, que o VEX conscientemente decidiu NÃO construir (`DL-0011`). Funil de origem (de onde o lead veio) é dado operacional; dashboard de investimento/criativos é gestão de mídia paga — a linha entre os dois precisa ficar clara antes de avaliar este item.

Customer Value

Dono da loja entende qual canal traz mais lead/lead de qualidade sem precisar de ferramenta de mídia separada.

Priority

Não definida — sujeita ao filtro de posicionamento B+ (`DL-0007`) antes de entrar em fase. Avaliar explicitamente contra `DL-0011` (fronteira de não construir gestão de mídia).

Status

IDEA — observado no concorrente, avaliar. Não é decisão de construir.

Owner

Não definido

Estimated Complexity

Não estimado.

Dependencies

Campo de origem em `leads` (já existe). Nenhuma dependência de integração com Meta Ads/Google Ads se ficar restrito a "canal declarado", diferente do dashboard de investimento (`DL-0011`).

Related ADR

None

Related RFC

None

Related Issue

Intel competitiva AutoPilot CRM, reunião de vendas 31/07/2026 — perfil completo em `53_ROADMAP.md` (Concorrentes mapeados). Ver também `DL-0011` (fronteira de não construir dashboard de mídia).

Target Version

Não definida

Success Metrics

Não definida — depende de decisão de construir

Notes

Origem: reunião de vendas com AutoPilot CRM (31/07/2026). Decisão de construir depende de avaliação futura contra o posicionamento B+ (`DL-0007`) e de manter a fronteira do `DL-0011` (não virar gestão de mídia).

---

BL-0022

Title

Observabilidade de erro incompleta em reactivation_logs/follow_up_logs

Problem

Coluna `reactivation_logs.error_message` existe no schema (migration 024, confirmada aplicada em produção — ver `B007` em `27_PROJECT_STATUS.md`) mas nunca é populada pelo código (`lib/reactivation.ts`). `error_category` também está ausente do schema. Sem isso, falha de follow-up/reativação não tem causa raiz rastreável — só "falhou", sem saber por quê.

Business Value

Diagnóstico mais rápido quando follow-up/reativação falha silenciosamente — hoje um job com `status: failed` não diz se foi rate limit, número inválido, erro de auth ou falha transitória de rede, obrigando investigação manual em outra fonte (logs de aplicação, se ainda existirem) pra descobrir a causa.

Customer Value

Nenhum direto — é observabilidade interna, não visível pro lead ou pro vendedor.

Priority

Não bloqueante hoje (volume baixo, 1 loja piloto) — mas cresce em importância conforme volume de follow-up/reativação aumentar.

Status

IDEA — não implementado.

Owner

Engineering

Estimated Complexity

Baixo-médio. `error_message`: sem migration, só popular nos catch blocks relevantes de `lib/reactivation.ts` (e replicar em `lib/follow-up.ts`, que já tem a coluna desde a migration 009 e também nunca escreve nela). `error_category`: exige nova migration adicionando a coluna em `reactivation_logs`, mais classificação do erro nos mesmos catch blocks (mesma lógica de categoria já usada em `lib/whatsapp-send.ts` — `rate_limited`/`invalid_recipient`/`service_error`/`auth_error`/`unknown` — reaproveitável, não inventar categoria nova).

Dependencies

Nenhuma.

Related ADR

None

Related RFC

None

Related Issue

`B007` (`27_PROJECT_STATUS.md`, ACTIVE BLOCKERS) — confirmação de que a migration 024 está aplicada em produção deixou explícito que a coluna existe mas o código não a usa.

Target Version

Sem agendamento.

Success Metrics

Não definido.

Notes

Achado durante fechamento de `B007` (pendência de migration 024), 2026-08-01.

---

BL-0023

Title

Sem exclusão/reordenação de foto de veículo

Problem

Upload de foto (roadmap 1.2, `lib/vehicle-photo-actions.ts`) é append-only — sem capacidade de excluir foto ruim ou trocar qual é a capa (sempre a 1ª posição do array `vehicles.photo_url`). Lojista vai sentir isso rápido no uso real: foto tremida ou do ângulo errado sobe e fica lá, sem forma de tirar pela UI.

Business Value

Evita foto ruim/desatualizada pesando contra a venda no site da loja (1.4, consumidor direto de `photo_url`) — primeira impressão do veículo é a capa, e hoje não dá pra trocar sem intervenção manual no banco.

Customer Value

Lojista controla a apresentação do próprio estoque sem depender de suporte técnico pra corrigir uma foto errada.

Priority

Considerar logo após validação do 1.2 em uso real — não é P0 mas tende a virar reclamação de usuário rápido.

Status

IDEA — não implementado.

Owner

Engineering

Estimated Complexity

Baixo-médio. Exclusão: Server Action que remove a URL do array (`vehicles.photo_url`) e do objeto no Storage (`supabaseAdmin.storage.from("vehicle-photos").remove([path])` — path precisa ser extraído da URL pública ou guardado à parte). Reordenação/trocar capa: mover posição dentro do array, sem novo upload — mais simples que exclusão, não mexe no Storage.

Dependencies

1.2 (upload de foto) — concluído, este item é extensão direta.

Related ADR

None

Related RFC

None

Related Issue

Decisão consciente de escopo durante 1.2, 2026-08-01 — ver resumo de implementação do item na sessão.

Target Version

Sem agendamento.

Success Metrics

Não definido.

Notes

Escopo original do 1.2 (roadmap `53_ROADMAP.md`) não pedia exclusão/reordenação — cortado deliberadamente pra manter o item fechado no que foi especificado.

---

BL-0024

Title

Upload de foto não disponível na criação do veículo

Problem

`vehicles.id` é gerado pelo banco (`gen_random_uuid()`) no momento do insert (`lib/vehicle-actions.ts`, `createVehicle`), então o path de Storage (`{store_id}/{vehicle_id}/{filename}`) só existe depois que o veículo já foi criado. Fluxo hoje é em 2 passos: cadastrar veículo (sem foto) → editar → adicionar foto. Resolver pra 1 passo só exigiria gerar UUID client-side antes do insert e passá-lo explicitamente — mudança maior em `createVehicle` (`lib/vehicle-actions.ts`), fora do escopo do 1.2.

Business Value

Fluxo de cadastro mais rápido pro lojista — 1 tela em vez de 2 pra ter o veículo completo (dados + foto) no estoque.

Customer Value

Menos fricção no cadastro, especialmente pra quem cadastra vários veículos seguidos.

Priority

Baixa — fluxo em 2 passos é aceitável, não bloqueia 1.4.

Status

IDEA — não implementado.

Owner

Engineering

Estimated Complexity

Médio. `createVehicle` passaria a aceitar (ou gerar) um UUID antes do insert — trocar `id uuid primary key default gen_random_uuid()` por inserir o `id` explicitamente vindo do form (client gera via `crypto.randomUUID()`, campo hidden). Precisa validar que não colide com o default atual em nenhum outro fluxo que insere vehicle sem passar `id` (nenhum hoje, mas checar). Upload viraria parte do mesmo form de criação, reaproveitando `VehiclePhotoUpload`/`uploadVehiclePhotos`.

Dependencies

1.2 (upload de foto) — concluído, este item é extensão direta.

Related ADR

None

Related RFC

None

Related Issue

Decisão consciente de escopo durante 1.2, 2026-08-01 — ver resumo de implementação do item na sessão.

Target Version

Sem agendamento.

Success Metrics

Não definido.

Notes

Fluxo em 2 passos (criar → editar → foto) é o padrão mais simples e mais próximo do que já existia (CRUD sem foto) — trade-off consciente pra não inflar o escopo do 1.2 com geração de UUID client-side.

---

BL-0025

Title

RESERVED_SUBDOMAINS (lib/subdomain.ts) exige atualização manual a cada novo subdomínio de infraestrutura

Problem

`lib/subdomain.ts` (roadmap 1.3) reserva `www` e `app` — subdomínios que NUNCA podem ser tratados como slug de loja, porque `app.vexauto.com.br` é onde o app autenticado roda de verdade em produção. Achado durante a implementação de 1.3: a primeira versão só reservava `www`, e teria tratado `app` como slug de loja "app", reescrevendo toda request de produção real para `/site/app/...` e quebrando a autenticação inteira — pego só porque o primeiro teste de middleware do projeto (`tests/unit/middleware.test.ts`, MW-5) foi escrito contra o host real. Essa lista é estrutural, não descoberta automaticamente: se um subdomínio novo de infraestrutura for criado no futuro (`api.vexauto.com.br`, `admin.vexauto.com.br`, `staging.vexauto.com.br`, `mail.vexauto.com.br`, etc.) e ninguém lembrar de adicionar em `RESERVED_SUBDOMAINS`, o mesmo bug volta por outro nome — silenciosamente, só descoberto quando alguém tentar acessar esse subdomínio e cair no roteamento público em vez do serviço esperado.

Business Value

Evita reincidência de um bug de blast radius máximo (autenticação inteira quebrada em produção) por um motivo barato de esquecer (lista hardcoded sem gatilho de lembrete).

Customer Value

Nenhum impacto direto — é proteção de infraestrutura, não feature.

Priority

Baixa complexidade de resolver, mas vale revisar antes de qualquer subdomínio novo de infraestrutura entrar em produção (não é P0 hoje porque nenhum está planejado além de `app`/`www`).

Status

IDEA — não implementado.

Owner

Engineering

Estimated Complexity

Baixo. Opções: (a) checklist manual documentado (ex: nota neste arquivo ou em `18_DEPLOYMENT.md`) lembrando de atualizar `RESERVED_SUBDOMAINS` ao provisionar subdomínio novo; (b) inverter a lógica — em vez de reservar subdomínios de infra, só tratar como slug de loja um subdomínio que exista em `stores.slug` (uma query a mais no middleware, mas elimina a categoria inteira de esquecimento). (b) é mais robusto mas muda o design de "resolução sem I/O no middleware" (`lib/subdomain.ts` é função pura hoje, decisão consciente de 1.3 pra manter o middleware rápido/sem chamada de rede por request) — avaliar custo/benefício quando houver um subdomínio de infra real no radar.

Dependencies

1.3 (rota de leitura pública por subdomínio) — concluído, este item é dívida consciente registrada no mesmo PR.

Related ADR

None

Related RFC

None

Related Issue

Achado durante a implementação de 1.3, 2026-08-03 — ver `tests/unit/middleware.test.ts` (MW-5) e `lib/subdomain.ts` (RESERVED_SUBDOMAINS).

Target Version

Sem agendamento — revisar antes de criar qualquer subdomínio de infraestrutura novo.

Success Metrics

Não definido.

Notes

Vitor pediu registro explícito desta dívida ao aprovar o diff de 1.3 (2026-08-03), especificamente pra não repetir o susto do bug de `app.vexauto.com.br`.

---

BL-0026

Title

UI do wizard de onboarding self-service — middleware de redirect, página, componente, integração no painel admin

Problem

Item 1.6 do roadmap decidiu rebase (não descarte) de `feat/onboarding-wizard` — ver `DL-0013` (`29_DECISIONS_LOG.md`) e fechamento do item em `53_ROADMAP.md`/`27_PROJECT_STATUS.md`. Só o backend foi absorvido no merge (`assertStoreAdmin` em `lib/auth.ts`, `nextOnboardingStep` em `lib/onboarding.ts`, 4 Server Actions em `lib/onboarding-actions.ts`, migration 040). O plano original da branch (`docs/superpowers/plans/2026-07-21-onboarding-wizard.md`) tinha 8 tasks; só as 4 primeiras (schema + guard + lógica pura + Server Actions) viraram código merged. Faltam as Tasks 5-8: middleware que redireciona loja com `onboarding_completed_at IS NULL` pra `/onboarding`; a própria página `/onboarding/page.tsx` (Server Component); componente `VendedorStepForm.tsx` (client, formulário de criação de vendedor); e integração no painel `/admin` mostrando status de onboarding por loja + botão de reset (`resetStoreOnboarding`, também não implementado). Hoje o backend existe mas não tem nenhum consumidor — nada aciona esse código em produção.

Business Value

Reduz fricção de ativação de loja nova — hoje o cadastro inicial (nome, vendedor, estoque, WhatsApp) depende de passos manuais/dispersos; um wizard guiado no primeiro acesso reduz tempo até a loja ficar operacional e reduz suporte manual do founder em cada onboarding.

Customer Value

Dono de loja nova completa a configuração inicial sozinho, sem depender de intervenção manual da Vex pra cadastrar vendedor/estoque/WhatsApp.

Priority

Não é P0 — piloto atual (Speed Motos) já passou do onboarding manualmente, sem essa UI. Vira relevante quando houver 2º cliente pra onboardar.

Status

✔ CONCLUÍDO E VALIDADO (2026-08-04) — Tasks 5-8 implementadas e validadas ponta a ponta em produção real, não só em teste automatizado: `middleware.ts` (gate de redirect, `lib/onboarding-guard.ts`), `app/onboarding/page.tsx`, `OnboardingWizard.tsx` (4 passos: nome/vendedor/estoque/whatsapp), integração em `/admin` (badge de status + `resetStoreOnboarding`, Edge Case 5). Commit inicial `8fdebac`. Validação manual confirmou os 4 passos funcionando em 2 lojas (Speed Motos retroativa + "Loja Teste Onboarding" criada do zero), redirect automático do middleware, reavaliação dinâmica via `maybeStampOnboardingComplete`, e retorno ao `/inicio` com Header normal ao completar. Validação expôs e corrigiu 3 bugs colaterais não relacionados ao escopo original da UI em si: erro de query silenciosamente engolido em `/admin` mascarando lojas reais (`744c90a`), botão de login preso em "Entrando..." + round-trips redundantes no `/onboarding` (`befb6c0`), e `stores.slug` ausente em `createStore()` desde a migration 033 — gap de 1.3, não desta feature, ver `DL-0014` (`c3b769a`). Ver `27_PROJECT_STATUS.md` RECENT COMPLETED WORK e `53_ROADMAP.md` item 1.6 pro fechamento completo.

Owner

Engineering

Estimated Complexity

Médio. Middleware + página + componente + integração admin — sem lógica de domínio nova (toda a lógica de derivação de passo já existe e está testada em `lib/onboarding.ts`), é majoritariamente UI e fiação.

Dependencies

Backend merged em 1.6 (`lib/onboarding.ts`, `lib/onboarding-actions.ts`, `lib/auth.ts::assertStoreAdmin`, migration 040).

Related ADR

None

Related RFC

None

Related Issue

Item 1.6 (`53_ROADMAP.md`), `DL-0013` (`29_DECISIONS_LOG.md`).

Target Version

Sem agendamento — revisar quando onboarding de 2º cliente entrar em planejamento.

Success Metrics

Não definido.

Notes

Passo de WhatsApp self-service (`updateStoreWhatsAppSelfService`, já existe no backend) coleta `phone_number_id`/`whatsapp_numero` cru via form, sem validar contra a API da Meta. Revisar se ainda faz sentido como está — BL-0001 (WhatsApp Embedded Signup) é o caminho self-service real de longo prazo, ainda bloqueado por CNPJ próprio.

---

BL-0027

Title

Teste de integração PVL-8 (public-vehicle-listings.test.ts) falha — desalinhado com a allowlist real de public_store_lookup desde a migration 039

Problem

`tests/integration/public-vehicle-listings.test.ts`, teste `PVL-8: public_store_lookup nunca expõe nome/whatsapp_numero, mesmo com select('*')` falha contra Supabase real:

```
AssertionError: expected [ 'id', 'slug', 'nome', …(5) ] to not include 'nome'
❯ tests/integration/public-vehicle-listings.test.ts:164:39
    expect(Object.keys(data![0])).not.toContain("nome");
```

Causa raiz: o teste foi escrito na migration 035 (roadmap 1.3), quando `public_store_lookup` só expunha `id`/`slug` de propósito (nunca `nome`, ver nota em `27_PROJECT_STATUS.md`, entrada 1.3). A migration 039 (roadmap 1.5, config visual por loja) estendeu deliberadamente a allowlist da view pra `id, slug, nome, logo_url, cor_primaria, telefone_publico, endereco, sobre` — `nome` virou público de propósito (site da loja precisa exibir o nome), documentado no próprio comentário da migration 039 e na entrada 1.5 de `27_PROJECT_STATUS.md`. O teste PVL-8 não foi atualizado nesse momento e ficou testando o comportamento antigo (035), não o comportamento atual desejado (039). **Não é regressão de segurança** — `whatsapp_numero`/`whatsapp_phone_number_id` continuam fora da allowlist, só `nome` que passou a ser esperado e não está coberto pela assertion. Confirmado quebrado em main antes de qualquer trabalho do item 1.6 (`git stash`/checkout limpo reproduz a mesma falha) — não foi introduzido pelo rebase de `feat/onboarding-wizard`.

Business Value

Suíte de integração com teste vermelho conhecido é ruído — mascara falha real futura na mesma allowlist (ex: se `whatsapp_numero` vazar de verdade, ninguém vai notar um teste a mais falhando numa suíte que já falha).

Customer Value

Nenhum direto — é dívida de qualidade de teste, não bug de produto. Produção não expõe dado sensível (confirmado: `whatsapp_numero`/`whatsapp_phone_number_id` seguem fora da view).

Priority

Baixa complexidade, mas resolver logo — é 1 assertion errada, não redesenho. Vale corrigir antes que mais alguém rode a suíte de integração e gaste tempo reinvestigando o mesmo achado.

Status

IDEA — não corrigido. Fix é atualizar a assertion de PVL-8 pra refletir a allowlist pós-039 (remover `nome` da lista de campos que não devem aparecer, manter `whatsapp_numero`/`whatsapp_phone_number_id`).

Owner

Engineering

Estimated Complexity

Trivial — 1 linha de assertion em `tests/integration/public-vehicle-listings.test.ts:164`.

Dependencies

Nenhuma — migration 039 já está em produção.

Related ADR

None

Related RFC

None

Related Issue

Achado durante validação de suíte completa do item 1.6 (2026-08-04, `DL-0013`/`53_ROADMAP.md`), confirmado pré-existente em main antes desse trabalho.

Target Version

Sem agendamento — próxima vez que alguém tocar `tests/integration/public-vehicle-listings.test.ts` ou rodar a suíte de integração completa.

Success Metrics

Não definido.

Notes

Registrado a pedido do Vitor pra não deixar falha de teste conhecida sem rastro — ver confirmação em `27_PROJECT_STATUS.md`, entrada 1.6 ("1 falha pré-existente em `public-vehicle-listings.test.ts`").

---

BL-0028

Title

Distribuição automática de leads (1.10) não distingue vendedor ativo/inativo — todo `role='vendedor'` da loja é candidato

Problem

`assign_lead_to_least_loaded_vendedor` (migration 042, `lib/lead-distribution.ts`) seleciona candidatos por `users.role = 'vendedor' AND store_id = <loja>`, sem nenhum filtro de disponibilidade. `public.users` não tem coluna de status (ativo/inativo/afastado/férias) — levantamento prévio ao item 1.10 confirmou ausência total do campo em todas as migrations (001–041). Um vendedor afastado, de férias ou desligado sem remoção do cadastro continua contando pra cálculo de menor carga, podendo receber lead novo mesmo indisponível pra atendê-lo.

Business Value

Baixo agora — todas as lojas em produção têm no máximo 1 vendedor (verificado por query direta 2026-08-05: Speed Motos, Loja Teste Onboarding, Diag2 Store, Vex Motors Demo têm exatamente 1 `role='vendedor'` cada). Sem 2+ vendedores simultâneos em nenhuma loja, o cenário de "vendedor afastado recebendo lead" ainda não tem caso real pra ferir.

Customer Value

Nenhum direto hoje. Relevante quando a primeira loja crescer pra 2+ vendedores — mesmo gatilho de revisão do `DL-0008` (visibilidade de lead entre vendedores).

Priority

Não bloqueante. Revisar junto com `DL-0008` quando o gatilho (loja com 2+ vendedores ativos simultâneos) disparar — os dois gaps nascem da mesma causa raiz (RBAC/distribuição desenhados sem dado real de multi-vendedor).

Status

IDEA — gap documentado no momento da implementação de 1.10, não corrigido. Fix provável: coluna `users.ativo boolean default true` (ou equivalente) + filtro no `WHERE` da função SQL e na query que monta `candidates` pro `pickLeastLoadedVendedor`.

Owner

Engineering

Estimated Complexity

Pequena — 1 migration (coluna + índice opcional) + 1 linha de filtro na função SQL + UI pra marcar vendedor inativo (esta última é o esforço real, não a coluna em si).

Dependencies

Mesmo gatilho de `DL-0008` — loja real com 2+ vendedores ativos simultâneos.

Related ADR

None

Related RFC

None

Related Issue

Roadmap 1.10 (`53_ROADMAP.md`), `DL-0008` (`29_DECISIONS_LOG.md`)

Target Version

Sem agendamento — junto da revisão do `DL-0008`.

Success Metrics

Não definido.

Notes

Registrado por decisão explícita ao implementar 1.10 antecipadamente (sem efeito prático hoje, nenhuma loja com 2+ vendedores) — gap consciente, não descoberto por acidente.

---

BL-0029

Title

Limite de frequência Marketing da Meta pode reter mensagens de reativação/follow-up em rajada

Problem

Validação manual de envio real dos 8 templates WhatsApp pendentes (05/08/2026, `scripts/test-template-send.ts` contra a API real, mesmo destinatário — ver `27_PROJECT_STATUS.md`) mostrou: as 3 primeiras mensagens de categoria MARKETING enviadas em sequência curta pro mesmo número foram entregues normalmente; as 5 seguintes retornaram HTTP 2xx da Graph API (aceitas) mas não chegaram no aparelho. Confirmado via API real (`GET /{waba-id}/message_templates`) que os 9 templates (`follow_up_1/2/3`, `reactivation_vehicle_1/2/3`, `reactivation_no_vehicle_1/2/3`) são todos categoria MARKETING, todos `APPROVED` — não é problema de template rejeitado/mal formatado. `sendWhatsAppTemplateMessage` (`lib/whatsapp-send.ts`) só verifica `res.ok`, nunca lê o corpo da resposta mesmo no caminho de sucesso — hoje não há nenhuma forma de o sistema saber, no momento do envio, se uma mensagem Marketing foi de fato entregue ou retida pela Meta.

Business Value

Relevante pro desenho de `lib/follow-up.ts` (cadência 2h→24h→72h) e `lib/reactivation.ts` (3 tentativas, 14d→30d→30d) — se o volume de leads crescer a ponto de múltiplos disparos Marketing pro mesmo lead caírem numa janela curta (ex: reprocessamento, retry, ou lead recebendo follow-up e reativação quase juntos), uma fração desses envios simplesmente não chega, sem erro nenhum pro sistema perceber. Ineficácia silenciosa, não só risco.

Customer Value

Nenhum hoje — cadências atuais já espaçam por horas/dias (2h/24h/72h, 14d/30d/30d), longe da janela curta que disparou o teto no teste manual (poucos minutos entre envios). Fica relevante se alguém no futuro apertar essa cadência ou dois fluxos (follow-up + reativação) coincidirem pro mesmo lead num intervalo curto.

Priority

Não bloqueante — volume de produção hoje é 1 loja piloto, cadências reais já são espaçadas o suficiente pra nunca ter batido nesse teto em uso normal (só bateu no teste manual por ser rajada artificial de validação). Vale monitorar antes de qualquer mudança que aperte intervalo entre envios Marketing pro mesmo destinatário.

Status

IDEA — achado documentado, não investigado a fundo (número exato do teto não confirmado — "aproximadamente 3" é observação de uma única sessão de teste, não característica documentada pela Meta confirmada com múltiplas amostras) nem mitigado.

Owner

Engineering

Estimated Complexity

Não estimado — depende da mitigação escolhida. Duas direções possíveis, não excludentes: (1) espaçar por tempo real entre disparos Marketing consecutivos pro mesmo lead (lógica nova em `lib/follow-up.ts`/`lib/reactivation.ts`); (2) migrar parte dos templates de MARKETING pra UTILITY onde a régua de negócio permitir (UTILITY geralmente não tem esse teto de frequência — troca de categoria exige nova aprovação de template na Meta, não é reclassificação simples).

Dependencies

Nenhuma bloqueante. Relacionado ao mecanismo de envio (`lib/whatsapp-send.ts`) e às cadências de `lib/follow-up.ts`/`lib/reactivation.ts`.

Related ADR

None

Related RFC

None

Related Issue

Validação manual dos templates WhatsApp (05/08/2026) — ver `27_PROJECT_STATUS.md`

Target Version

Sem agendamento — reavaliar se volume de leads crescer ou cadência de follow-up/reativação for apertada.

Success Metrics

Não definido.

Notes

Achado de produção real durante validação deliberada (não acidental) — 8 templates testados via `scripts/test-template-send.ts` pro mesmo número, 3 entregues, 5 aceitos pela API mas retidos pela Meta. Não é bug de código, script, ou template mal configurado — confirmado que todos os 9 templates estão `APPROVED` e a categoria (MARKETING) é uniforme entre os que entregaram e os que não entregaram, o que aponta pro teto de frequência como causa, não pra diferença de template. `res.ok`-only na resposta de envio (`lib/whatsapp-send.ts`) é decisão consciente de não logar corpo da resposta da Meta (risco de PII) — significa que esse teto é invisível pro sistema em runtime, só detectável por teste manual como este ou por reclamação de lead que não recebeu.

---

BL-0030

Title

Cores de accent hardcoded (`rgba(14,165,233,...)`) fora do token `--accent`/`--sky` em `app/globals.css`

Problem

A troca de accent de marca (`--accent`/`--sky`: `#0EA5E9` → `#005BFE`, aplicada 2026-08-06 na mesma variável CSS) cobre só os usos que já referenciam `var(--accent)`/`var(--sky)`. Auditoria das 9 linhas de `color: var(--accent)` feita antes da troca (contraste WCAG AA por fundo real) expôs, como efeito colateral, pelo menos 22 ocorrências de `rgba(14,165,233,...)` literal no mesmo arquivo — a maioria delas é sinalização própria e não relacionada (ex: `.pill[data-status="ENGAJADO"]`, `.msg-bubble.ia`, `.alert-item.info`, sempre pareadas com `color: #0369A1` hardcoded, sistema fechado e autoconsistente, sem relação com a cor de marca). Mas pelo menos duas — `.dossie-score` (linha 774) e `.dossie-intent-signals li` (linha 790-791) — têm fundo `rgba(14,165,233,...)` literal só duplicando a cor de marca antiga, com o texto usando `var(--accent)` (que agora aponta pro azul novo). Resultado depois da troca: chip com fundo no azul antigo e texto no azul novo — duas cores de azul visivelmente diferentes no mesmo componente. Mesma classe de risco em efeitos colaterais não-texto: `.conv-sidebar-item.active` (linha 711, fundo hardcoded + borda em `var(--accent)`) e 3 `box-shadow` de glow (linhas 167, 345, 448) que ficam com brilho no azul antigo ao redor de bordas já no azul novo.

Business Value

Evita item visual quebrado (dois azuis diferentes no mesmo chip) chegando em produção sem ninguém perceber — barato de checar agora, caro de debugar depois quando a causa (literal vs variável) não estiver óbvia olhando só o resultado renderizado.

Customer Value

Nenhum direto — é consistência visual interna, não funcionalidade.

Priority

P3 — não bloqueia a troca de accent (BL registrado separado de propósito, ver Notes). Vira P2 se `.dossie-score`/`.dossie-intent-signals` forem uma superfície de alta visibilidade (dossiê do lead é olhado por vendedor com frequência).

Status

IDEA — não implementado, registrado no momento do achado (2026-08-06), decisão de escopo do dono do produto: não resolver dentro do commit cirúrgico de troca de variável.

Owner

Engineering

Estimated Complexity

Baixa pra corrigir, mas exige decisão de produto antes (duas direções, não excludentes):
1. Re-hexar manualmente cada `rgba(14,165,233,...)` que hoje acompanha `var(--accent)` pro rgb do azul novo (`rgba(0,91,254,...)`), preservando a mesma opacidade — troca pontual, resolve o sintoma.
2. Migrar esses casos específicos pra usar `var(--accent)` com opacity (ex: `color-mix(in srgb, var(--accent) 10%, white)` ou equivalente) em vez de literal — resolve a causa raiz, evita o mesmo problema se a cor de marca mudar de novo no futuro. Maior escopo (precisa confirmar suporte de `color-mix`/fallback no browser-alvo do projeto).

Não decidir sozinho qual direção tomar — é chamada do dono do produto, registrada aqui só como as duas opções levantadas.

Dependencies

Nenhuma técnica bloqueante. Relacionado à troca de `--accent`/`--sky` (mesma sessão, 2026-08-06) que expôs o achado.

Related ADR

None yet

Related RFC

None yet

Related Issue

Nenhuma — achado durante auditoria de contraste WCAG AA da troca de accent (2026-08-06)

Target Version

Sem agendamento

Success Metrics

Zero componente com fundo e texto em tons de azul diferentes no mesmo elemento.

Notes

Escopo e risco deliberadamente separados do commit de troca de `--accent`/`--sky`: aquele é troca cirúrgica de 1 variável CSS, testável e revertível isoladamente; isto exige decisão de produto (re-hexar vs migrar arquitetura de cor) e toca componentes específicos, não a variável central. Ver também `.impeccable/design.json`/`DESIGN.md` (raiz do projeto, escrito 2026-08-06) — Colors, seção "Cores de status (fora do escopo de marca)" já documenta que esses literais são independentes do token de marca; este item é a ação de limpeza que falta pra fechar o gap entre o que está documentado e o que está no código.

---

BL-0031

Title

`DESIGN.md` enxuto demais como referência do hook de design — gera ruído alto (324 achados) em CSS legado já existente

Problem

`DESIGN.md`/`.impeccable/design.json` (raiz do projeto) foram escritos em 2026-08-06 capturando só os tokens novos/intencionais da direção de marca (cores, tipografia, alguns radius/spacing) — deliberadamente enxuto, seguindo a orientação do próprio `document.md` do Impeccable de não catalogar cada valor único. `app/globals.css` (980 linhas, sistema real em produção, testado com Speed Motos) tem uma escala ad hoc bem mais fina — radius em 4/6/7/8/9/10/11/12px, font-size em passos de meio pixel de 10px a 30px, dezenas de cores literais — que nunca foi documentada, porque é anterior ao `DESIGN.md`. Confirmado na prática: a primeira edição de `globals.css` depois do `DESIGN.md` existir (troca de `--accent`/`--sky`, 2 linhas alteradas) disparou o hook de design com 324 achados — nenhum deles relacionado à edição em si, todos são drift entre o CSS legado e o `DESIGN.md` novo e enxuto.

Business Value

Sem ajuste, todo futuro editor de `globals.css` recebe o mesmo volume de ruído (324 achados) mesmo fazendo uma mudança trivial de 1 linha — risco real de a pessoa aprender a ignorar o hook por cansaço, o que apaga o valor dele justamente pros achados que importam.

Customer Value

Nenhum direto — ferramenta interna de qualidade de design, não visível ao cliente.

Priority

Baixa — não bloqueia nada hoje (decisão explícita do dono do produto, 2026-08-06: seguir com o commit da troca de accent apesar do ruído). Mas cresce de custo quanto mais tempo passar sem ser tratado — próxima pessoa a mexer no arquivo não vai ter o contexto desta sessão pra saber que já foi discutido e conscientemente adiado.

Status

IDEA — não implementado, registrado no momento do achado (2026-08-06)

Owner

Engineering / Product (decisão de quanto detalhar o design system é chamada de produto, não só técnica)

Estimated Complexity

Não estimado — depende da direção escolhida, duas não excludentes:
1. Engordar `DESIGN.md`/`design.json` com os padrões que já são intencionais no `globals.css` atual (escala real de radius, font-size, cores de status) — trabalho de documentação, sem mudança de código; resolve o ruído capturando o legado como parte do sistema documentado.
2. Ajustar o hook (`/impeccable hooks`) pra ser menos sensível a arquivos/padrões legados enquanto o sistema de design está em transição do tema antigo (Exo2/sky-blue) pro novo (Anton/vex-blue) — configuração, não documentação.

Dependencies

Nenhuma técnica bloqueante. Relacionado a `DESIGN.md`/`.impeccable/design.json` (raiz, 2026-08-06) e à direção de marca que os originou (`docs/vex/assets/brand/`).

Related ADR

None yet

Related RFC

None yet

Related Issue

Nenhuma — achado durante a troca de `--accent`/`--sky` (2026-08-06), hook disparou 324 findings no primeiro `git diff` de `app/globals.css` pós-`DESIGN.md`

Target Version

Sem agendamento

Success Metrics

Edição pontual em `globals.css` não dispara achado de hook não relacionado à mudança feita.

Notes

Decisão explícita do dono do produto (2026-08-06): não resolver agora, não rodar `ignore-file` no `globals.css` (suprimiria achados reais junto com o ruído) — só registrar pra não se repetir sem lembrança na próxima pessoa que mexer no arquivo.

---

BL-0032

Title

Lead card não mostrava contexto de interesse do lead — kanban de leads ficava genérico [RESOLVIDO, escopo reduzido]

Problem

`/impeccable critique` em `app/leads/page.tsx` (2026-08-07, snapshot `.impeccable/critique/2026-08-07T17-39-55Z__app-leads-page-tsx.md`) apontou como maior gap de especificidade de design: `LeadCard` mostrava nome, telefone, score, prioridade, urgência e timestamp — nunca contexto de interesse do lead. O item original assumia `leads.contexto.veiculo_interesse` (jsonb, lido por `lib/reactivation.ts`) como fonte, com valor do negócio ao lado. Investigação antes da implementação (2026-08-07) encontrou que **`veiculo_interesse` nunca é escrito por nenhum código em produção** — é lido só por `reactivation.ts`/RPC, sem writer real (só aparece mockado em teste unitário). O campo realmente escrito é `leads.contexto.interesse` (texto livre do form "Importar Lead", `lib/lead-ingestion.ts:64`), que por sua vez nunca era lido em lugar nenhum antes desta mudança. Não existe hoje nenhum valor de negócio (BRL) estruturado antes do fechamento — `leads.vehicle_id`/`valor_final` só existem depois de `FECHADO` (guardrail de margem, migration 020).

Business Value

Fecha parcialmente o gap de especificidade — conecta um dado que já era coletado (form de import) mas nunca aparecia em lugar nenhum do produto. Não fecha o gap de valor de negócio (não há dado pra isso hoje).

Customer Value

Vendedor vê o texto de interesse cadastrado no import (quando existe) direto no card, sem abrir a conversa.

Priority

Resolvido nesta rodada com escopo reduzido — decisão do usuário (2026-08-07) após ver os achados da investigação.

Status

RESOLVIDO (escopo reduzido) — implementado 2026-08-07. `LeadCard` exibe `contexto.interesse` (texto livre, truncado 1 linha com ellipsis) como segunda linha abaixo do nome, quando presente; omite a linha inteira quando ausente (sem placeholder). Sem valor BRL — não existe fonte de dado pra isso antes do fechamento. Validado visualmente (2 cenários: com e sem interesse) antes de fechar.

Owner

Engineering

Estimated Complexity

Baixa — sem migration nova, só passar `contexto` na query de `app/leads/page.tsx`, extrair `interesse` e renderizar condicionalmente em `LeadCard.tsx` + `.lead-card-interesse` em `globals.css`.

Dependencies

Nenhuma técnica bloqueante. Ver `BL-0036` pro trabalho de fundo (pipeline estruturado de veículo+valor) que este item não cobre.

Related ADR

None yet

Related RFC

None yet

Related Issue

Snapshot da critique: `.impeccable/critique/2026-08-07T17-39-55Z__app-leads-page-tsx.md` (Priority Issue P1)

Target Version

Entregue 2026-08-07

Success Metrics

Card de lead no kanban mostra `contexto.interesse` (quando existente) sem precisar abrir a conversa. Atingido.

---

BL-0036

Title

IA não extrai/persiste veículo de interesse estruturado nem valor estimado durante a conversa — card do kanban não pode mostrar valor de negócio

Problem

Achado durante a investigação de `BL-0032` (2026-08-07): não existe hoje nenhum pipeline que faça a IA identificar, durante a conversa via WhatsApp, qual veículo o lead quer e gravar isso de forma estruturada + valor estimado. `leads.contexto.veiculo_interesse` é só um tipo já previsto (`lib/reactivation.ts`) sem nenhum writer real. `leads.vehicle_id`/`valor_final` só nascem no fechamento (guardrail de margem), tarde demais pra ajudar triagem no kanban. Sem esse pipeline, o card de lead nunca vai poder mostrar valor de negócio antes do fechamento — só texto livre (`contexto.interesse`, resolvido em `BL-0032` com escopo reduzido).

Business Value

Sem isso, o gap de especificidade mais citado na critique de `app/leads/page.tsx` (triagem por valor de negócio antes de abrir cada conversa) continua parcialmente aberto — vendedor ainda não consegue eyeball qual negócio em NEGOCIAÇÃO vale mais.

Customer Value

Se implementado: vendedor vê valor estimado do negócio direto no kanban, prioriza por tamanho de negócio sem abrir conversa por conversa.

Priority

Não dimensionada — trabalho de pipeline de IA (extração + persistência durante a conversa, provavelmente via `lib/collection.ts`/`lib/prompts.ts`, mesmo padrão de financiamento/troca), maior que um fix de UI. Não bloqueia nada hoje.

Status

IDEA — não implementado, registrado durante o fechamento de `BL-0032` (2026-08-07)

Owner

Engineering / Product (decisão de quando/como a IA deve perguntar preço-alvo sem soar como negociação — linha fina com o guardrail de margem)

Estimated Complexity

Não estimado — precisa de spec própria (novo sinal de coleta, prompt, campo em `contexto`, e decisão de produto sobre estimar valor sem violar "IA nunca calcula/negocia preço").

Dependencies

Relacionado a `lib/collection.ts`/`lib/guardrails.ts` (mesma filosofia dos fluxos de financiamento/troca) e ao guardrail de margem (`lib/actions.ts`) — qualquer valor estimado pré-fechamento precisa deixar claro que não é o `valor_final` validado.

Related ADR

None yet

Related RFC

None yet

Related Issue

Achado durante implementação de `BL-0032` (2026-08-07)

Target Version

Sem agendamento

Success Metrics

Não definido — depende do spec.

---

Nota de manutenção — 2026-08-07: limpeza de leads de QA sem histórico real

Durante a validação visual do `BL-0032`, foi criado um lead de teste manual ("QA Interesse Card", store Vex Motors Demo). Ao pedir a limpeza dele, auditoria de rotina (read-only, REST API + `service_role`, sem exibir a key) em toda a tabela `leads` encontrou um segundo lead de teste mais antigo nunca limpo: **"Teste QA 1.4"** (Speed Motos — produção real, criado 2026-08-03 durante a validação do roadmap 1.4). Diferente dos itens 1.10/1.11, que documentam explicitamente "lead de teste apagado em seguida", o fechamento do item 1.4 em `27_PROJECT_STATUS.md` não tinha essa nota — ficou pra trás.

Verificado antes de decidir (critério: só entra no cleanup se não houver conversa/mensagem real de cliente por trás):
- **"QA Interesse Card"** — 1 conversa, 1 mensagem (só sistema, "Lead importado manualmente."). Sem `follow_up_logs`/`lead_score_events`. Sem interação real.
- **"Teste QA 1.4"** — 1 conversa, 3 mensagens (import + 2 follow-ups automáticos, nenhuma resposta do lead). 2 `follow_up_logs`, 0 `lead_score_events`. Sem interação real.
- **"#1 Atendimento"** (Speed Motos, 2026-07-29) — investigado por suspeita de ser o mesmo artefato de ping da Meta já limpo em `scripts/cleanup-realtime-tests.sql` (mesmo nome/padrão de telefone antigo da loja), mas **excluído do cleanup**: a conversa tem 10 mensagens reais, incluindo respostas do lead ("me manda o catalogo", "quero fotos dela") sobre uma Titan 2026, 3 `lead_score_events`, 3 `follow_up_logs`. Não atende ao critério — mantido.
- Store **"Vex Motors - Loja Demo"** (`aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`) — revisada e confirmada como sandbox interno por design (usuário "Vitor"/`dono_loja` + vendedor seed "Carlos Vendedor" + `whatsapp_numero` = número sandbox conhecido da Meta, `+1 555-629-2868`), não loja piloto real nem candidata a virar uma. Os 7 leads de QA que acumulam ali ("QA Lead Novo", "QA Novo Lead", "Duplicado", "QA Integration Test", "lead teste", "vitor" ×2) foram deixados como estão, por decisão explícita — mantidos por design, não esquecidos. Próxima pessoa que notar leads de teste ali não precisa reabrir essa pergunta.

Script preparado e commitado versionado: `scripts/cleanup-qa-leads-2026-08-07.sql` (mesmo padrão de `cleanup-realtime-tests.sql`) — **EXECUTADO por Vitor via Supabase Studio SQL Editor, 2026-08-07**. Verificação read-only independente pós-delete (Claude Code) confirmou os 2 IDs (`441c61e3...`, `ae86ed4d...`) e suas conversas com 0 linhas remanescentes; `#1 Atendimento` (`575ea7c1...`) confirmado intacto, como esperado.

---

BL-0033

Title

Header da coluna "NEGOCIAÇÃO" no kanban de leads — achado visual investigado, não reproduziu

Problem

Assessment B da critique de `app/leads/page.tsx` (2026-08-07) reportou, via screenshot, uma linha horizontal cruzando o texto do header "NEGOCIAÇÃO" no kanban, lendo como tachado — reproduzida em duas capturas de zoom na mesma sessão, nenhuma outra coluna (NOVO, ENGAJADO, INTERESSADO, QUENTE, FECHADO, PERDIDO) apresentava o mesmo. Verificação manual pós-fix do BL P0 (mesmo dia, mesma sessão): header renderizou limpo, sem tachado, em nova captura de zoom na mesma região. Não reproduziu.

Business Value

Nenhuma ação necessária agora — registrado só pra não reabrir investigação do zero se o sintoma reaparecer.

Customer Value

N/A — não confirmado como defeito real.

Priority

Baixa — investigado, sem repro. Reabrir só se o sintoma for observado de novo (screenshot ou relato).

Status

INVESTIGATED — não reproduziu na segunda verificação (2026-08-07), sem ação necessária por ora

Owner

Engineering

Estimated Complexity

N/A — sem causa raiz identificada porque não reproduziu

Dependencies

Nenhuma

Related ADR

None yet

Related RFC

None yet

Related Issue

Snapshot da critique: `.impeccable/critique/2026-08-07T17-39-55Z__app-leads-page-tsx.md` (Priority Issue P2, "NEGOCIAÇÃO column header rendering glitch")

Target Version

Sem agendamento — reabrir sob demanda

Success Metrics

N/A

---

BL-0034

Title

Chip de alerta "Sem resposta >2h" no KPI bar de leads não é clicável/acionável

Problem

O chip vermelho pulsante "Sem resposta >2h" em `app/leads/page.tsx` é uma `<div>` estática, não um link/filtro — cria urgência visual sem oferecer caminho de ação. Achado pela critique de 2026-08-07 (Assessment A) como "emotional valley" sem reassurance, justo no KPI cuja função é provocar ação.

Business Value

Reduz fricção entre perceber urgência e agir sobre ela — vendedor vê o alerta e consegue ir direto pros leads parados, sem escanear as 7 colunas manualmente.

Customer Value

Menos leads esquecidos por falta de caminho direto até eles a partir do alerta.

Priority

Normal — cosmético/interação, sem urgência de acessibilidade.

Status

IDEA — não implementado, registrado no fechamento da critique de 2026-08-07

Owner

Engineering

Estimated Complexity

Baixa — tornar o chip um link/filtro (`?filter=stale` ou equivalente) que rola ou filtra o kanban pros leads parados, seguindo o padrão de interação já estabelecido pelos links de `.vendor-filter`.

Dependencies

Nenhuma técnica bloqueante.

Related ADR

None yet

Related RFC

None yet

Related Issue

Snapshot da critique: `.impeccable/critique/2026-08-07T17-39-55Z__app-leads-page-tsx.md` (Priority Issue P2, "Alert KPI chip is not actionable")

Target Version

Sem agendamento

Success Metrics

Clicar/tocar o chip "Sem resposta >2h" leva o vendedor direto aos leads parados.

---

BL-0035

Title

Animação `kpi-alert-pulse` (KPI de leads) roda infinita sem guard de `prefers-reduced-motion`

Problem

`@keyframes kpi-alert-pulse` em `app/globals.css` roda `infinite` no chip de alerta "Sem resposta >2h", sem `@media (prefers-reduced-motion: reduce)`. Achado pela critique de 2026-08-07 (Assessment A, persona Sam) — problema de acessibilidade real pra usuário sensível a estímulo vestibular numa tela que fica aberta o turno inteiro, não só cosmético.

Business Value

Evita excluir vendedores sensíveis a movimento de uma tela operacional de uso diário obrigatório.

Customer Value

Acessibilidade — usuário com `prefers-reduced-motion` ativado no sistema não fica exposto a pulso visual permanente.

Priority

Acima dos outros P2/P3 desta rodada (BL-0033, BL-0034) quando o backlog for retomado — marcado como item de acessibilidade, não só polish visual, por decisão do dono do produto (2026-08-07).

Status

IDEA — não implementado, registrado no fechamento da critique de 2026-08-07

Owner

Engineering

Estimated Complexity

Baixa — envolver a animação em `@media (prefers-reduced-motion: reduce)` (desliga ou reduz o pulso), ou limitar iterações e assentar num estado vermelho estático.

Dependencies

Nenhuma técnica bloqueante.

Related ADR

None yet

Related RFC

None yet

Related Issue

Snapshot da critique: `.impeccable/critique/2026-08-07T17-39-55Z__app-leads-page-tsx.md` (Priority Issue P2, "Infinite pulse animation, no reduced-motion opt-out")

Target Version

Sem agendamento

Success Metrics

Chip de alerta respeita `prefers-reduced-motion: reduce` do sistema operacional do usuário.

---

BL-0037

Title

Redesign visual do app operacional — fase 1: fluxo "oi do cliente até fechamento"

Problem

App operacional usa tema visual legado (Exo2/sky-blue, fundo claro, sem identidade de marca forte) que (a) não gera screenshots de qualidade para seção "como funciona" da landing pública (item 1.7) e (b) não reflete a direção de marca já fechada em `DESIGN.md` (Bebas Neue/Inter, preto/branco/azul canônico `#005BFE`). Redesign aprovado com fundo escuro (DL-0015, reversão consciente de tema claro anterior).

Business Value

Material de marketing (screenshots reais do produto) para landing pública — necessário para converter prospects que avaliam se o produto tem cara de profissional. Modernização da experiência como um todo.

Customer Value

Vendedor usa interface mais moderna e alinhada com a identidade visual da marca, em vez de dashboard genérico.

Priority

P1 — motivado por necessidade de material de marketing. Fase 1 cobre só as telas do fluxo "oi do cliente até fechamento" (inbox/conversa, kanban de leads, dossiê do lead, handoff). Fases seguintes (outras telas do sistema) ficam registradas como continuação, sem escopo fechado ainda.

Status

IN PROGRESS — **atualização 2026-08-25**: `/inicio` renomeado pra `/dashboard` (`DL-0019`); Central de Operações/ops-strip/Métricas Operacionais/Tendência Diária (herdadas da consolidação de 2026-08-13) removidas por completo a pedido do founder e substituídas por "Painel por Período" — seletor global (Hoje/7 dias/30 dias/Todo período + range custom) controlando 4 cards novos (Leads, Visitas agendadas, donut Origem, donut Vendedor); Funil de Temperatura e Ranking de Vendedores mantidos intocados. Ver `27_PROJECT_STATUS.md` (2026-08-25) pra detalhe completo, incluindo o incidente de produção real (migrations 029/031 nunca aplicadas) encontrado e corrigido na mesma sessão.

sidebar (nav vertical, largura, esquema de cor), `/inicio` (ops-strip + consolidação com Analytics, dado real — histórico, seção substituída em 2026-08-25 acima), `/login` (redesign + toggle mostrar senha) e `/agenda` (calendário mensal) redesenhados. Conversa/dossiê/handoff (`/conversations`) validado visualmente pelo founder em sessão anterior. `/leads` teve 2 rodadas de trabalho (2026-08-17 e 2026-08-19): filtro por vendedor default-próprio, kanban com drag-and-drop **custom pointer-based** (2026-08-19, substitui a primeira versão nativa HTML5 de 2026-08-17 — nativo tinha ghost translúcido + card cortado pelo overflow da coluna, sem solução dentro do modelo do browser), filtro "Todos/Sem responsável/Atrasados/Vendedores", badge flutuante "Lead Atrasado". `/inicio` ganhou Funil de Temperatura (SVG, 4 camadas, breakdown por etapa, toggle de período 7/30/90/Todo, substitui o card "Leads por Status" — feature nasceu em `/leads`, passou por várias iterações visuais em cima de feedback ao vivo do founder e acabou só em `/inicio` por decisão dele). Ver `27_PROJECT_STATUS.md` (2026-08-19) pra detalhe completo. Tudo na branch `claude/vex-redesign-visual-fase1-sqkmmf`, **22 commits desta rodada commitados e pushados pra `origin`** (PR aberta pra review), branch como um todo não mergeada em main / não em produção — aguardando validação final antes do merge.

Owner

Engineering / Founder (direção visual)

Estimated Complexity

Alto por fase — cada tela é redesign visual completo, não ajuste pontual. Fase 1 = 4-6 telas (a mapear). Fases seguintes sem escopo fechado.

Dependencies

`DESIGN.md` (paleta/tipografia) — concluído. DL-0015 (decisão de tema escuro) — concluído.

Related ADR

None

Related RFC

None

Related Issue

DL-0015 (reversão de tema claro), item 1.7 do `53_ROADMAP.md` (landing pública, consumidor dos screenshots)

Target Version

Fase 1 (prioridade alta, motivado por material de marketing)

Success Metrics

Screenshots das telas redesenhadas usáveis na seção "como funciona" da landing pública, com dado fictício/demo (nunca dado real da Speed Motos).

Notes

Regras de design: paleta preto/branco/azul canônico (`DESIGN.md`) + Bebas Neue só em título (nunca em KPI/preço/parágrafo) + Inter pro resto. Fundo escuro aceito (DL-0015). Dado fictício/demo obrigatório em qualquer print futuro dessas telas (nomes, telefones e veículos inventados). Fase 1 = telas do fluxo "cliente manda oi no WhatsApp → IA responde/qualifica → lead aparece no kanban → vendedor abre dossiê → handoff se necessário → fechamento". Fases seguintes (dashboard, admin, equipe, estoque, agenda, etc.) ficam como continuação sem escopo fechado.

---

BL-0038

Title

Alerta "conversa aguardando vendedor há mais de 40min" em /dashboard (era /inicio) — falta decisão de arquitetura pra fonte do timestamp

Problem

Consolidação de Início+Analytics (2026-08-13) tornou reais os outros 2 alertas que antes eram mock (`sem resposta >24h`, `margem <5% no estoque`), mas este terceiro alerta do mock original ficou de fora por decisão consciente: não existe hoje um timestamp exato de "quando a conversa entrou em handoff" persistido de forma barata de consultar. `conversations.handoff_to='HUMANO'` marca o estado atual, mas não quando a transição aconteceu. O único registro do momento exato é `audit_logs` (ação `conversation.handoff_to_human`, roadmap 0.5) — tabela pensada pra auditoria/rastreamento, não pra alimentar leitura de dashboard em todo carregamento de página. **Nota (2026-08-25):** `/inicio` foi renomeado pra `/dashboard` (`DL-0019`); o alerta continuaria integrando no mesmo array `alerts`/`AlertsWidget` já existente lá, mecanismo intocado pelo rename. **Correção importante (`DL-0020`):** até 2026-08-25, a opção (a) abaixo não era só arquiteturalmente imperfeita — era literalmente inexecutável, porque a tabela `audit_logs` nunca tinha sido de fato aplicada em produção (migration 029 documentada como "fechada" desde 2026-07-30 mas nunca rodada de verdade). Auditoria de rotina encontrou e corrigiu isso hoje — `audit_logs` agora existe e está gravando eventos reais, então a opção (a) passa a ser tecnicamente viável, não só uma alternativa teórica.

Business Value

Fecha o conjunto original de 3 alertas operacionais do painel — hoje só 2 de 3 são reais. Alerta de handoff parado é sinal direto de lead esfriando por falta de atendimento humano, mesma classe de problema que motivou `BL-0009`/`BL-0010`/`BL-0011`.

Customer Value

Vendedor/dono da loja vê no painel principal quando uma conversa está esperando atendimento humano há muito tempo, sem precisar abrir `/conversations` pra descobrir.

Priority

P3 — não bloqueia a consolidação (os outros 2 alertas já cobrem a maior parte do valor). Vira P2 se o painel `/inicio` passar a ser o principal ponto de operação diária.

Status

IDEA — não implementado, decisão de arquitetura pendente.

Owner

Engineering

Estimated Complexity

Baixa a Média, dependendo do caminho escolhido — duas opções, nenhuma implementada:

(a) Consultar `audit_logs` filtrando `action='conversation.handoff_to_human'`, pegar o evento mais recente por `conversation_id` ainda em `handoff_to='HUMANO'`. Zero schema novo, mas usa uma tabela de auditoria (write-once, sem índice pensado pra essa leitura) como fonte de dado operacional recorrente — pode não escalar bem e mistura responsabilidade (auditoria vira dependência funcional).

(b) Coluna nova `conversations.handoff_at` (timestamp, nullable), setada em `assignConversationToHuman`/toda transição pra `HUMANO`. Leitura trivial e rápida, mas mexe em schema — exige migration + backfill (linhas já em `HUMANO` sem esse campo) + decisão de qual timestamp usar no backfill (aproximação, não exata).

Dependencies

Nenhuma técnica bloqueante. Reaproveita `countStaleLeads` (`lib/lead-priority.ts`, já genérica por threshold) se o dado de "há quanto tempo" virar um array simples de timestamps — mesmo padrão dos outros 2 alertas.

Related ADR

None yet

Related RFC

None yet

Related Issue

Consolidação Início+Analytics (2026-08-13) — os outros 2 alertas do mesmo conjunto original já viraram reais nessa sessão.

Target Version

Sem agendamento

Success Metrics

Não definido — depende de qual caminho (a/b) for escolhido.

Notes

Registrado no mesmo escopo de decisão que descartou a Fase 2/3 original desta sessão (integração Meta Marketing API, cancelada — DL-0011 permanece válida, não revertida).

---

BL-0039

Title

Sugestão inteligente de modelo/veículo em `/inicio` — dado interno + pesquisa de mercado externa

Problem

Founder quer que a Central de Operações (`/inicio`) sugira ao lojista qual modelo de veículo reforçar no estoque — combinando o que já performou bem dentro do sistema (leads/conversões por modelo) com o que está "girando" no mercado fora do VEX (tendência externa, não só dado interno).

Business Value

Ajuda o lojista a decidir compra de estoque com dado real em vez de intuição — liga diretamente a faturamento/margem (mesmo teste de "Princípio de Execução" do `CLAUDE.md`: aumenta conversão ao garantir que o estoque tenha o que o mercado quer).

Customer Value

Lojista abre `/inicio` e vê uma recomendação acionável ("Honda CG 160 está performando bem aqui E em alta no mercado — considere repor estoque"), sem precisar cruzar dado manualmente.

Priority

Não definida — pedido explícito do founder nesta sessão (2026-08-17), mas classificado como **arquitetural** (não bounded) na sessão de brainstorming: não existe hoje nenhuma integração de dado de mercado automotivo externo no projeto (`FIPE`/`Portais de veículos` seguem "Planejado" no `CLAUDE.md`, nunca implementados). Decomposição proposta na sessão: (A) parte interna (ranking de modelo por performance de lead/venda, 100% dado já existente em `leads`/`vehicles`) é bounded e pode sair primeiro; (B) parte externa (pesquisa de mercado/tendência) precisa de uma fonte de dado ainda não escolhida — brainstorming arquitetural próprio, não iniciado.

Status

IDEA — não implementado. Brainstorming arquitetural (fonte de dado externo, custo, frequência de atualização, guardrails de "IA nunca decide compra sozinha") ainda não rodado. Aguardando o founder pra essa sessão.

Owner

Engineering / Founder (direção de produto + escolha de fonte externa)

Estimated Complexity

Alta — parte interna é baixa (agregação pura sobre dado já existente), parte externa é incerta até a fonte ser escolhida (API paga de mercado automotivo? scraping de portal? LLM com web search via Anthropic?). Cada opção tem custo/manutenção/confiabilidade muito diferentes.

Dependencies

Nenhuma técnica bloqueante pra parte interna. Parte externa depende de decisão de fonte de dado (não escolhida).

Related ADR

None

Related RFC

None

Related Issue

Pedido direto do founder em sessão de 2026-08-17, mesma conversa que produziu as mudanças de `/leads` registradas em `27_PROJECT_STATUS.md`.

Target Version

Sem agendamento — depende de sessão de brainstorming arquitetural própria.

Success Metrics

Não definido — depende da fonte de dado externa escolhida e do formato final da recomendação.

Notes

Guardrail a preservar desde já (mesmo antes do desenho): IA sugere, nunca decide compra sozinha — mesma filosofia de "Human in the Loop" do `CLAUDE.md` (aprovação humana em decisões financeiras). Nunca modelar como ação automática de compra/pedido.

---

# FEATURE ACCEPTANCE RULES

Before implementation every feature must answer:

Which customer problem does it solve?

How often does that problem occur?

Why now?

Can it be solved more simply?

What is the operational cost?

What is the maintenance cost?

Can it be tested?

Can it be rolled back?

If these questions cannot be answered,

the feature should remain in the backlog.

---

# DEFINITION OF READY

A feature is READY only if:

Problem validated.

Requirements documented.

Architecture approved.

Dependencies known.

Tests planned.

Rollback possible.

Documentation planned.

Monitoring considered.

Ready means engineering can start immediately.

---

# DEFINITION OF DONE

A feature is DONE only if:

Implementation completed.

Tests passing.

Code reviewed.

Documentation updated.

Deployment completed.

Production validated.

Monitoring active.

Knowledge preserved.

Done means valuable to customers.

Not merely merged.

---

# BACKLOG RULES

Never implement directly from ideas.

Research before implementation.

Document before coding.

Measure after deployment.

Archive rejected ideas.

Avoid duplicate backlog items.

Small backlog.

High quality.

---

# REJECTED IDEAS

Rejected ideas remain documented.

Each rejection records:

Reason.

Date.

Decision owner.

Related ADR.

Rejected ideas prevent repeated discussions.

---

# ROADMAP ALIGNMENT

Every backlog item must support at least one roadmap objective.

If not,

it should not exist.

---

# MONTHLY REVIEW

Once every month:

Remove obsolete items.

Merge duplicates.

Review priorities.

Archive completed work.

Review rejected ideas.

The backlog is continuously curated.

---

# ENGINEERING PRINCIPLE

Engineering time is the most valuable resource in the company.

Protect it by prioritizing relentlessly.

---

# AI GUIDANCE

Before implementing any feature:

Read this backlog.

Confirm priority.

Check dependencies.

Search for existing ADRs.

Search for Known Issues.

Never implement work that is not represented here unless explicitly instructed.

---

# RELATED DOCUMENTS

26_INDEX.md

27_PROJECT_STATUS.md

29_DECISIONS_LOG.md

30_KNOWN_ISSUES.md

22_ARCHITECTURE_DECISION_RECORDS.md

25_PROJECT_EVOLUTION.md

---

End of PRODUCT BACKLOG.