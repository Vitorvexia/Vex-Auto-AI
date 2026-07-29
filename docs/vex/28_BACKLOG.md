28_BACKLOG.md
# THE VEX OPERATING SYSTEM

# PRODUCT BACKLOG

Version: 1.0

Status: Living Document

Owner: Product & Engineering

Last Updated: 2026-07-24

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

P4 — baixa prioridade agora. Reavaliar depois que o número novo (`1238597592667311`, registrado 2026-07-27) tiver reputação/`quality_rating` estabelecida — ver risco abaixo.

Status

IDEA — não implementado. Decisão de 2026-07-27: aplicar só o ajuste de tom via prompt por enquanto (quebra de linha dentro de 1 mensagem), adiar o suporte real a múltiplas mensagens.

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

Sem agendamento — reavaliar quando o número tiver reputação estabelecida na Meta

Success Metrics

Não definido ainda.

Notes

Riscos levantados em 2026-07-27, ao decidir adiar:
- **Rate limit**: irrelevante no volume atual (1 loja) — Cloud API tem limite alto por tier. Vira relevante só em escala de centenas de lojas simultâneas.
- **Ordem de entrega**: só garantida se o envio for sequencial (`await` cada POST antes do próximo). Implementação errada (paralela) pode entregar fora de ordem — bug sutil, difícil de pegar em teste manual.
- **Qualidade do número na Meta**: número (`1238597592667311`) saiu do sandbox em 2026-07-27, `quality_rating: UNKNOWN`. Rajada de 2-3 mensagens automáticas sem delay logo no início da vida do número pode ler como comportamento de bot pro sistema de qualidade da Meta — motivo principal pra adiar até o número ter reputação estabelecida. Se implementado, considerar delay de 400-800ms entre envios.

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

IDEA — avaliação técnica feita em 2026-07-27, não implementado.

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