29_DECISIONS_LOG.md
# THE VEX OPERATING SYSTEM

# DECISIONS LOG

Version: 1.0

Status: Living Document

Owner: Engineering Leadership

Last Updated: 2026-07-20

---

> "A forgotten decision becomes tomorrow's repeated discussion."

---

# PURPOSE

This document records significant project decisions that do not require a full Architecture Decision Record (ADR).

Its objective is preserving engineering context.

Every important decision should be documented somewhere.

Major decisions belong in ADRs.

Smaller operational decisions belong here.

This document is chronological.

Newest entries always appear first.

---

# PHILOSOPHY

Every decision has a cost.

Every undocumented decision creates future uncertainty.

This document exists to answer one simple question:

"Why did we choose this?"

---

# WHEN TO CREATE AN ENTRY

Create an entry whenever a decision:

Changes development direction.

Changes priorities.

Rejects a feature.

Introduces a temporary workaround.

Accepts technical debt.

Changes operational procedures.

Changes deployment strategy.

Changes AI behavior.

Changes infrastructure.

Changes business rules.

If future engineers may ask "why",

record it here.

---

# WHEN NOT TO USE THIS DOCUMENT

Do NOT use this document for:

Architecture changes requiring ADRs.

Bug reports.

Meeting notes.

Daily progress.

Git commit history.

Personal opinions.

Use the correct document for each purpose.

---

# ENTRY TEMPLATE

Every decision follows the same structure.

Date

Decision ID

Title

Category

Context

Decision

Reasoning

Alternatives Considered

Expected Impact

Potential Risks

Owner

Related ADR

Related Issue

Related Runbook

Review Date

Status

Consistency is mandatory.

---

# CATEGORIES

Engineering

Architecture

Operations

Infrastructure

AI

Security

Business

Product

Deployment

Documentation

Testing

Monitoring

Performance

Customer Success

Other

---

# STATUS

Active

Superseded

Deprecated

Reverted

Archived

A decision never disappears.

Its status changes.

---

# EXAMPLE ENTRY

Date

2026-06-23

Decision ID

DL-001

Title

Pause Feature Development Until MVP Validation

Category

Engineering

Context

The MVP reached feature completeness.

Multiple production validations remain pending.

Decision

Suspend implementation of non-essential features until operational validation is complete.

Reasoning

Shipping additional functionality before validation increases operational risk and debugging complexity.

Alternatives Considered

Continue feature development in parallel.

Expected Impact

Higher software stability.

Lower development velocity.

Better production confidence.

Potential Risks

Delayed roadmap execution.

Owner

Engineering

Related ADR

ADR-004

Status

Active

---

# REAL DECISIONS

Date

2026-07-29

Decision ID

DL-0008

Title

Escopo reduzido de 0.3 (RBAC) — travar só reatribuição, visibilidade de lead entre vendedores fica para quando houver multi-vendedor real

Category

Technical

Context

Dívida documentada em `27_PROJECT_STATUS.md` é sobre reatribuição sem controle (`assignLeadToUser`/`removeLeadAssignment` só validavam `store_id`). Existe também gap maior (qualquer vendedor vê/responde lead de qualquer colega da mesma loja), mas hoje o piloto (Speed Motos) tem 1 vendedor só — não há caso real pra desenhar a regra de visibilidade restrita com informação de verdade (ex: dono da loja precisa ver tudo mesmo? vendedor cobre colega de férias?).

Decision

Implementar RBAC cobrindo só a reatribuição agora. Visibilidade de lead entre vendedores continua irrestrita dentro da loja.

Reasoning

Desenhar a regra de visibilidade sem uso real de multi-vendedor é apostar no desenho errado. Esperar por um cliente/loja com 2+ vendedores ativos dá dado real pra decidir a forma certa (visibilidade total pro dono, exceções de cobertura, etc.), em vez de suposição.

Alternatives Considered

Implementar visibilidade restrita (vendedor só vê/responde leads atribuídos a si + não-atribuídos) já nesta etapa — descartado por falta de caso de uso real pra validar o desenho.

Expected Impact

Fecha a dívida documentada (reatribuição sem controle) sem expandir escopo pra uma mudança maior (visibilidade) sem dado real.

Potential Risks

Se um segundo vendedor ativo entrar em produção antes da revisão, qualquer vendedor continua vendo/respondendo lead do colega — risco operacional baixo (não é falha de segurança entre lojas, é falta de segregação dentro da mesma loja), aceitável até o gatilho de revisão.

Atualização (2026-07-29, review final de branch): o guard de reatribuição implementado em `lib/actions.ts` só cobria o caminho via Server Action. A policy RLS `leads_own_store_update` (migration 005) liberava UPDATE em `leads` pra qualquer usuário autenticado da mesma loja sem checar role — um vendedor com acesso a devtools conseguia reatribuir lead (e também fechar venda pulando o guardrail de margem) via PostgREST direto, usando a anon key + JWT da sessão já expostos no browser. Migration 027 removeu essa policy (confirmado por grep: nenhum código client-side escreve em `leads`, toda escrita passa por `supabaseAdmin`/service_role, que não depende de RLS). RBAC agora é reforçado em dois níveis — Server Action (guard de role) e banco (RLS, sem policy de UPDATE pra roles client-side) — não só no nível de aplicação como o texto original desta decisão registrava implicitamente.

Owner

Founder

Related ADR

None

Related Issue

Roadmap item 0.3 (`53_ROADMAP.md`); dívida técnica em `27_PROJECT_STATUS.md`

Related Runbook

None

Review Date

Primeira loja (piloto ou cliente novo) operando com 2+ vendedores simultâneos e ativos — nesse ponto, reavaliar e desenhar a visibilidade restrita com base em uso real.

Status

Active

---

Date

2026-07-28

Decision ID

DL-0007

Title

Fechar Decisão de Posicionamento (B+) com Base em Inteligência Competitiva — AEG Media/Venda.IA

Category

Business

Context

Reunião de descoberta com AEG Media (28/07/2026) + análise da página pública de serviços da Venda.IA (crm.vendaia.app.br). A AEG é uma AGÊNCIA DE GROWTH/AQUISIÇÃO full-service, não uma plataforma de software: seus seis serviços são tráfego pago (Google/Meta), landing pages, IMPLEMENTAÇÃO de CRMs de terceiros (não CRM proprietário — o próprio site diz "implementamos e integramos diferentes CRMs"), social media, chatbot de atendimento e consultoria comercial. O vocabulário do site é de "associação/associados/adesão", sugerindo foco em segmento adjacente (proteção veicular/consórcio) além de revenda pura. Escala alegada: +700 lojas (500+ empresas na página), 9+ anos, presença no maior evento automotivo da América Latina, parceria de financiamento com C6 Bank. Vendem a IA de atendimento também avulsa (preço NÃO confirmado — estimativa não verificada de ~R$800/mês). FONTE: reunião com o próprio concorrente + página pública de serviços; a profundidade real do chatbot e do CRM deles NÃO foi testada de forma independente.

Decision

Fechar a decisão de posicionamento (seção "Posicionamento — decisão ainda em aberto" do `53_ROADMAP.md`) como B+: camada de inteligência operacional que o lojista OPERA, plugada no sistema de gestão existente, mais RENAVE e site da loja — sem terceirizar o funil de marketing nem competir por distribuição de mídia paga.

Reasoning

A AEG ocupa o espaço "terceirize sua máquina de aquisição" (mídia + landing + social + consultoria + chatbot), operado COMO SERVIÇO por eles; o CRM que oferecem é implementação de ferramenta de terceiro, não produto proprietário. Isso é estruturalmente distinto do VEX (B+): software operacional que o LOJISTA opera, com IA integrada ao estoque e ao dossiê do lead, CRM próprio, RENAVE e site da loja. A diferenciação do VEX NÃO se apoia na IA de atendimento isolada (que a AEG também tem e vende avulsa), mas no conjunto operacional integrado — sobretudo RENAVE (obrigatório por lei, janela de mercado) e site próprio da loja, que a AEG comprovadamente não entrega. Competir no espaço da AEG exigiria orçamento de mídia e operação de agência que não existem hoje e não são o negócio pretendido.

Alternatives Considered

Manter decisão em aberto; migrar para posicionamento (A), cobrindo a mesa mínima completa e competindo com Revenda Mais/Autoconf.

Expected Impact

Roadmap Fase 1-3 mantém-se válido sem alteração de escopo; decisão documentada evita retrabalho de análise. Reforça a prioridade estratégica de RENAVE e do site da loja como peças de DIFERENCIAÇÃO (não apenas requisito), por serem o que a AEG não cobre.

Potential Risks

Risco de GTM (não de produto): distribuição/mindshare da AEG (700+ lojas, evento LatAm, parceria C6) não é mitigado por esta decisão. Monitorar separadamente (ver `27_PROJECT_STATUS.md`).

A AEG já vende a IA de atendimento avulsa — a fronteira "eles no marketing, VEX no operacional" é menos limpa do que a reunião sugeriu na parte de IA. Mitigação: diferenciação ancorada em RENAVE + site + operacional integrado, não na IA isolada.

Fonte parcialmente enviesada: caracterização vem do próprio concorrente (reunião + página de vendas). A profundidade real do CRM/chatbot deles não foi verificada de forma independente.

Owner

Founder

Related ADR

None

Related Issue

Seção "Posicionamento" do `53_ROADMAP.md`

Related Runbook

None

Review Date

Revisar se surgir inteligência competitiva INDEPENDENTE (não vinda da própria AEG) sobre a profundidade operacional/CRM deles, OU se a AEG anunciar/expandir a venda da IA avulsa como produto de software autônomo. NÃO tratar como decisão imutável — é a melhor leitura com os dados de 28/07.

Status

Active

---

Date

2026-07-28

Decision ID

DL-0006

Title

Política de Privacidade do Piloto Redigida como da Loja (Controladora), VEX Auto como Operador

Category

Business

Context

O item 0.7 do roadmap exige política de privacidade pública (`/privacidade`) porque o piloto processa dado pessoal real de clientes finais da loja (nome, telefone, conteúdo de conversa via WhatsApp). A obrigação de informar o titular nasce do tratamento do dado, não do contrato. O VEX Auto ainda não tem CNPJ próprio (SLU, item 0.6 — pendente), então não tem personalidade jurídica pra figurar como controlador nem assinar contrato de tratamento.

Decision

Publicar a política como sendo DA LOJA (Speed Motos / CMOV), identificada como controladora (LGPD), com o VEX Auto mencionado como operador que trata dados em nome da loja. Página em `/privacidade`, contato do titular e retenção (24 meses) parametrizados.

Reasoning

Na LGPD, quem decide as finalidades do tratamento é controlador; quem trata em nome de outro é operador. No piloto, a loja decide (WABA, CNPJ e decisão comercial são dela) — ela é controladora de fato. Publicar como se o VEX Auto fosse controlador seria factualmente errado e assumiria responsabilidade sem estrutura jurídica pra suportá-la. Ter a política da loja resolve a obrigação imediata sem depender da abertura da SLU.

Alternatives Considered

(a) Abrir CNPJ do VEX Auto agora só pra viabilizar a política — rejeitado: decisão estrutural cara puxada por documento que se resolve de outro jeito; abertura da SLU tem gatilhos próprios (cliente pagante, 2º cliente, pagamento, RENAVE), não a política. (b) Publicar a política como do VEX Auto (controlador) — rejeitado: factualmente incorreto e assume responsabilidade indevida.

Expected Impact

Obrigação de transparência com o titular cumprida no piloto sem bloquear em dependência de CNPJ. Página serve de base reutilizável — quando a SLU existir, cria-se a política própria do VEX Auto (papel de operador + relação B2B) e a da loja passa a referenciá-la.

Potential Risks

O texto NÃO é parecer jurídico — é base defensável pra piloto com 1 loja, redigida por CTO+IA, não por advogado. Antes de onboardar cliente pagante, precisa de revisão jurídica profissional (mesmo padrão de dívida consciente do DL-0003). Aviso de IA na primeira mensagem do WhatsApp é obrigação SEPARADA desta página e ainda não foi implementado (parte 2 do item 0.7).

Owner

Founder (decisão) / CTO+Engineering (implementação)

Related ADR

None

Related Issue

Item 0.7 do `53_ROADMAP.md`; item 0.6 (SLU) como dependência da política própria futura do VEX Auto

Related Runbook

None

Review Date

Antes de onboardar o 1º cliente pagante — revisão jurídica profissional obrigatória nesse ponto

Status

Active

---

Date

2026-07-24 (commit date). Log entry written retroactively on 2026-07-24 during a later session — not recorded at merge time. This entry itself is the fix for that gap.

Decision ID

DL-0001

Title

Priorizar Coleta de Financiamento/Troca Antes da Validação de Produção do MVP Terminar

Category

Product

Context

`27_PROJECT_STATUS.md` define a fase atual como "MVP Validation", com regra explícita: prioridade 1-4 é resolver blockers de produção (WhatsApp sandbox, B001-B005) e só prioridade 5 é "begin new feature development". Commit `147f1ef` (2026-07-24, mesmo dia), mergeou a feature de coleta de financiamento/troca — capacidade nova e independente do guardrail de margem existente e dos blockers de validação em aberto — antes de qualquer um dos blockers B001-B005 ter sido resolvido.

Decision

Priorizar e mergear a feature de coleta de financiamento/troca (`lib/collection.ts`, `lib/guardrails.ts`, migration 022, página `/agenda`) fora de ordem em relação à regra de prioridade documentada em `27_PROJECT_STATUS.md`.

Reasoning

Demanda real de cliente (Speed Motos) — leads já perguntando sobre financiamento e condições de troca em produção, sem fluxo pra IA responder ou coletar esses dados. Aprovado pelo founder.

Alternatives Considered

Esperar B001-B005 (desbloqueio WhatsApp real) resolverem antes de tocar em feature nova, conforme regra original.

Expected Impact

Feature entregue e funcional (635/635 testes passando, lint/typecheck limpos). Regra de prioridade de `27_PROJECT_STATUS.md` furada sem registro no momento do merge — motivou a criação da regra de processo em `27_PROJECT_STATUS.md` (exceção exige entrada no Decisions Log no mesmo PR/commit).

Potential Risks

Precedente de exceção não documentada no momento em que acontece — mitigado retroativamente por esta entrada e pela nova regra de processo.

Owner

Founder (aprovação) / Engineering (implementação)

Related ADR

None

Related Issue

Ver `27_PROJECT_STATUS.md` — RECENT COMPLETED WORK (coleta financiamento/troca) e ACTIVE BLOCKERS (B001-B005)

Related Runbook

None

Review Date

N/A — decisão pontual, não recorrente

Status

Active

---

Date

2026-07-26

Decision ID

DL-0002

Title

Credencial de WhatsApp é por Tenant (Loja), Não Global

Category

Architecture

Context

Migração B001 (sandbox → Cloud API real) confirmou que WABA "#1 Isadora", App "Vex Auto" e System User `vex-auto-api` estão registrados sob o CNPJ da CMOV MOBILIDADE URBANA LTDA (dona da Speed Motos) — não sob CNPJ do Vex Auto. Business Verification, forma de pagamento e templates pertencem à loja. Vex Auto se conecta como integrador via token do System User, não como dono do número/WABA. Ver `project_whatsapp_migration_b001` (memória).

Decision

Modelo de credencial WhatsApp é por tenant: cada loja cliente registra seu próprio WABA/número sob seu próprio CNPJ. Vex Auto nunca é dono do número nem do WABA — apenas consome via token per-loja. `stores.whatsapp_phone_number_id` (migration 017) já reflete isso no schema. Nenhum token global de WhatsApp deve ser introduzido como atalho — `WHATSAPP_ACCESS_TOKEN` global hoje é dívida técnica temporária (roadmap B2+ per-loja), não o modelo alvo.

Reasoning

Onboarding self-serve de clientes futuros exige que cada loja tenha WABA verificado com CNPJ próprio — é como a Meta exige para negócios reais (BSP/self-managed). Um WABA único do Vex Auto compartilhado entre lojas criaria dependência de relacionamento comercial com uma única loja como "dona" do canal, risco de perda de ativo se a relação azedar, e não escala para múltiplos clientes com CNPJs distintos.

Alternatives Considered

Registrar WABA único sob CNPJ do Vex Auto e sub-alocar números por loja — rejeitado: exige Vex Auto ser provedor verificado na Meta (Business Solution Provider), o que depende de CNPJ próprio do Vex Auto (ainda não existe, ver BL-0001) e não é caminho crítico para o primeiro cliente.

Expected Impact

Arquitetura de credencial (WABA + número + token) permanece por tenant desde o primeiro cliente — sem retrabalho quando o segundo cliente for onboardado. Mesmo raciocínio se aplica a credenciais futuras por loja (ex: RENAVE, quando chegar).

Potential Risks

`WHATSAPP_ACCESS_TOKEN` ainda global no código hoje (dívida técnica documentada em `CLAUDE.md` — Dívidas Técnicas Conhecidas) — se não migrado para per-loja antes do segundo cliente, cria acoplamento indevido. Mitigação: token per-loja já é item de roadmap explícito (Fase 2/B2+).

Owner

Founder (decisão de arquitetura) / Engineering (implementação já parcialmente feita — `phone_number_id` per-loja via migration 017)

Related ADR

None

Related Issue

BL-0001 (CNPJ próprio Vex Auto — necessário para onboarding self-serve e provedor verificado Meta), B001-B002 (migração WhatsApp Speed Motos)

Related Runbook

None

Review Date

Quando segundo cliente entrar em onboarding — validar que `WHATSAPP_ACCESS_TOKEN` per-loja foi implementado antes de repetir o fluxo

Status

Active

---

Date

2026-07-26

Decision ID

DL-0003

Title

Manter Infraestrutura Meta (App/System User/Token) no Business Manager da Speed Motos Durante o Piloto

Category

Infrastructure

Context

Verificação direta no Meta Business Settings (founder, 2026-07-26) confirmou: existe um único Business Manager na conta — "Speed Motos" (3 ativos de negócio), nenhum BM próprio do Vex. WABA "#1 Atendimento" (ID `456613541838969`) é propriedade da Speed Motos, Verificação da empresa: Verificado, Status da conta: Aprovada. O app Meta (ID `731158340085674`), o System User e o token global `WHATSAPP_ACCESS_TOKEN` estão todos dentro desse mesmo BM da Speed Motos — hospedados no CNPJ da loja cliente, não em CNPJ do Vex. Método de pagamento vinculado é cartão da própria loja. Isso corrige/substitui a inferência anterior (não verificada) registrada em [[project_whatsapp_migration_b001]] (memória) e discutida em sessão anterior a esta.

Decision

Manter, durante o piloto, toda a infraestrutura Meta (app, System User, token) dentro do Business Manager da Speed Motos. Aceito conscientemente como dívida: o ativo de distribuição do produto (app Meta que hospeda a integração) está hoje no CNPJ de terceiro, não do Vex.

Reasoning

Viabiliza o piloto imediatamente sem esperar abertura do CNPJ próprio do Vex (SLU), que ainda não existe. Blast radius atual = 1 loja conectada (Speed Motos) — custo de migrar depois ainda é baixo. Esperar CNPJ próprio antes de rodar o piloto adiaria validação real sem ganho proporcional no estágio atual (1 cliente).

Alternatives Considered

Adiar piloto até abertura de CNPJ próprio do Vex e criação de BM separado — rejeitado: bloquearia validação de produto por tempo indeterminado sem benefício até existir 2º cliente.

Expected Impact

Piloto Speed Motos roda sem bloqueio administrativo adicional. Dívida de arquitetura explícita e rastreável (esta entrada + BL-0001) em vez de assumida tacitamente.

Potential Risks

Token global é escopado ao BM que autorizou o System User — cliente 2 com WABA em BM separado NÃO autentica com o token atual (`lib/whatsapp-send.ts:68`, `lib/whatsapp-signature.ts:15`, `app/api/whatsapp/webhook/route.ts:23`). Migração para BM próprio do Vex é pré-requisito técnico do segundo cliente, não apenas questão administrativa/comercial. Se a relação com a Speed Motos azedar antes da migração, o ativo de distribuição (app Meta) está sob controle de CNPJ de terceiro.

Plano de saída: quando o Vex tiver BM próprio, usar o mecanismo "Atribuir parceiro" na tela do WABA — o BM da loja compartilha o WABA com o BM do Vex; o WABA continua propriedade da loja (consistente com DL-0002 — credencial de WABA é por tenant). Do lado do código, a migração é troca de 3 env vars (`lib/whatsapp-send.ts:68`, `lib/whatsapp-signature.ts:15`, `app/api/whatsapp/webhook/route.ts:23`) + redeploy — sem mudança estrutural.

Owner

Founder (decisão de aceitar a dívida) / Engineering (plano de saída documentado)

Related ADR

None

Related Issue

BL-0001 (WhatsApp Embedded Signup, bloqueado por CNPJ próprio do Vex — mesma dependência raiz: Vex precisa ser Meta Tech Provider/Business Partner, o que exige CNPJ próprio)

Related Runbook

None

Review Date

Antes de onboardar o 2º cliente — migração de BM é pré-requisito técnico, não pode ficar pendente além desse ponto

Status

Active

---

Date

2026-07-27

Decision ID

DL-0004

Title

Client Realtime Não Herda JWT da Sessão — `setAuth()` Explícito É Obrigatório em Todo Client Component com Postgres Changes

Category

Engineering

Context

Implementação do item 0.8 (Inbox em tempo real, `app/components/ConversationMessages.tsx`). RLS de `messages` (migration 005) e a tabela na publication `supabase_realtime` (migration 023) estavam corretas, e os testes de `lib/realtime-messages.ts` (mocks) passavam — mas um teste de integração real (`tests/integration/realtime-isolation.test.ts`, RT-1) mostrou que o usuário autenticado não recebia NENHUM evento `postgres_changes`, nem da própria loja. Diagnóstico isolado (service role vs anon+login) confirmou: o client `@supabase/supabase-js` não repassa o JWT da sessão pro socket do Realtime automaticamente após `signInWithPassword`/restauração de sessão via cookie — sem `client.realtime.setAuth(access_token)` explícito, a policy de RLS nunca resolve `auth.uid()` no contexto do Realtime, e o canal fica mudo pra qualquer store, incluindo a do próprio usuário. Testes de lib pura (mocks) não capturam esse tipo de falha porque simulam o canal, não a autenticação real do transporte.

Decision

Todo Client Component que assina `postgres_changes` deve chamar `supabase.realtime.setAuth(session.access_token)` explicitamente antes de `channel().subscribe()`, e reaplicar em todo evento de `onAuthStateChange` (token refresh) — não confiar em wiring automático entre auth e realtime. Padrão implementado em `app/components/ConversationMessages.tsx` (busca sessão via `getSession()`, seta auth, assina `onAuthStateChange` pro resto da vida do componente).

Reasoning

Sem esse passo, o bug é silencioso da pior forma possível: a UI carrega normalmente, o histórico inicial aparece (veio via Server Component/SSR, não via Realtime), e só falta o comportamento "ao vivo" — que é justamente o que ninguém nota testando manualmente uma vez, mas quebra o propósito inteiro do item 0.8 (vendedor não vê mensagem nova chegar). Testes unitários com mock de canal não pegam isso porque o mock não modela a ausência do JWT no transporte real.

Alternatives Considered

Confiar no wiring automático do `@supabase/ssr`/`supabase-js` entre sessão e Realtime — rejeitado: testado empiricamente (script de diagnóstico isolado) e confirmado que não propaga o token sozinho nesta versão instalada (`@supabase/supabase-js` 2.103.0). Pode mudar em versão futura, mas não dá pra assumir sem validar de novo.

Expected Impact

`ConversationMessages.tsx` funciona corretamente em produção (validado por `tests/integration/realtime-isolation.test.ts`, RT-1/RT-2a/RT-2b contra Supabase real). Todo Client Component futuro que precisar de Realtime com RLS deve seguir o mesmo padrão.

Potential Risks

Risco de regressão real: qualquer novo Client Component que assine `postgres_changes` e esqueça o `setAuth()` vai "funcionar" nos testes de lib (mock não pega) e falhar silenciosamente em produção do mesmo jeito que aconteceu aqui — sem erro visível, só ausência de comportamento. Mitigação: este registro + comentário no código-fonte (`ConversationMessages.tsx` e `tests/integration/realtime-isolation.test.ts`) explicando o porquê; revisão de código deve checar esse padrão especificamente em qualquer PR que adicione `channel().subscribe()` num Client Component novo.

Owner

Engineering (achado durante implementação, revisão exigiu prova empírica antes de aceitar como resolvido)

Related ADR

None

Related Issue

Roadmap item 0.8 (`53_ROADMAP.md`) — Inbox em tempo real

Related Runbook

None

Review Date

Quando a versão de `@supabase/supabase-js` for atualizada — revalidar se o wiring automático mudou antes de remover o `setAuth()` explícito

Status

Active

---

Date

2026-07-27

Decision ID

DL-0005

Title

RT-2a Flakiness Investigation — Confirmed Test-Harness Artifact, Not a Production Race

Category

Engineering

Context

Review of item 0.8 (`docs/vex/29_DECISIONS_LOG.md` DL-0004) surfaced a residual ~18% flake rate on `RT-2a` in `tests/integration/realtime-isolation.test.ts` (22 runs observed). Reviewer raised a specific, testable hypothesis before accepting 0.8 as closed: the flake's symptom (channel opened right after a different channel's `unsubscribe()`, on the same connection, intermittently stays mute) could be the SAME failure mode a real vendor hits switching conversations in the browser — `ConversationMessages.tsx` unsubscribes channel A and subscribes channel B when `conversationId` changes. If the test's non-determinism reflected the component's, the inbox could go silently mute on conversation switch in production, intermittently.

Decision

Investigated and REJECTED the hypothesis for production. `ConversationMessages.tsx` constructs a brand-new `createSupabaseBrowserClient()` inside the `useEffect` body on every `conversationId` change — each conversation switch gets an isolated `SupabaseClient` and therefore an isolated Realtime WebSocket. `RT-2a`'s flake instead comes from the test reusing `userA.client` (the same underlying socket) immediately after `RT-1` had just unsubscribed a channel on it in the same file — a pattern the component never does. Confirmed via reading the installed `@supabase/supabase-js` (2.103.0) source: `RealtimeClient.removeChannel()` triggers `this.disconnect()` once its channel list is empty, so old and new conversations never share a socket in production. Backed by a new mock-based test (`tests/unit/conversation-messages.test.ts`, 5 tests, stable across 5 consecutive runs, zero network) that locks in: fresh client per `conversationId`, old channel torn down exactly once per switch, nothing leaks on unmount, and even a same-task zero-yield triple-switch is handled safely by the component's existing `cancelled` guard (an intermediate conversation superseded before its own async setup completes never opens a channel it would have to tear down).

Reasoning

The reviewer's instinct — "if the test is non-deterministic, ask whether the same code path exists in production" — was the right question to ask, and it turned out the two are structurally different (test reuses a socket the component never does), not just "probably fine." Verifying this against the actual `@supabase/supabase-js` source rather than reasoning from the symptom alone is what makes this a closed investigation rather than a guess.

Alternatives Considered

Ship 0.8 without investigating, treating the flake as "probably just the test" — rejected per explicit instruction: the reviewer wanted the hypothesis checked against the real component before accepting 0.8 as done, specifically because a silent-mute-on-switch bug would be serious and easy to miss in manual testing (looks fine on first load, only fails on some switches).

Expected Impact

Item 0.8 closes with a documented, evidence-backed answer instead of an open question. `RT-2a`'s flake registered as `KI-0004` (`30_KNOWN_ISSUES.md`) — Won't Fix, low priority, `test:integration` never gates push — so it doesn't get silently re-investigated from scratch by someone hitting it later.

Potential Risks

If a future `@supabase/supabase-js` upgrade changes `RealtimeClient`'s per-client socket behavior (e.g., connection pooling/sharing across client instances), this conclusion would need re-validation — noted in `KI-0004`'s workaround/permanent-fix sections. Low probability, but the investigation's conclusion is tied to today's library internals, not just today's test result.

Owner

Engineering (investigation) / User (accepted the finding, no fix required)

Related ADR

None

Related Issue

`docs/vex/30_KNOWN_ISSUES.md` KI-0004, roadmap item 0.8 (`53_ROADMAP.md`)

Related Runbook

None

Review Date

If `@supabase/supabase-js` is upgraded — revalidate the per-client-socket assumption before trusting this conclusion again

Status

Active

---

# DECISION QUALITY RULES

Every decision should answer:

What changed?

Why?

Why now?

What alternatives existed?

What are the consequences?

Who approved it?

If these questions are unanswered,

the decision is incomplete.

---

# SUPERSEDED DECISIONS

When replacing a decision:

Never delete the original.

Mark it as Superseded.

Reference the replacement.

Preserve historical context.

---

# REVIEW POLICY

Operational decisions

Review every 6 months.

Strategic decisions

Review annually.

Temporary workarounds

Review within 30 days.

Expired decisions should either be removed through replacement or archived.

---

# COMMON ANTI-PATTERNS

❌ Decisions only inside chat conversations.

❌ "Everyone knows why."

❌ Decisions only inside Git commits.

❌ Verbal agreements.

❌ Missing ownership.

❌ Missing rationale.

❌ Deleting old decisions.

---

# SEARCH GUIDELINES

Decision IDs follow:

DL-0001

DL-0002

DL-0003

...

Use sequential numbering.

Titles should be short and descriptive.

Search should always be easy.

---

# AI GUIDANCE

Before making assumptions:

Read this document.

Search for previous decisions.

Avoid reversing historical choices without justification.

If a previous decision is no longer valid,

create a new entry instead of silently changing direction.

Engineering consistency is more valuable than short-term convenience.

---

# MAINTENANCE

Update immediately after important decisions.

Never postpone documentation.

The longer you wait,

the less accurate the reasoning becomes.

---

# RELATED DOCUMENTS

22_ARCHITECTURE_DECISION_RECORDS.md

24_KNOWLEDGE_MANAGEMENT.md

25_PROJECT_EVOLUTION.md

27_PROJECT_STATUS.md

28_BACKLOG.md

30_KNOWN_ISSUES.md

---

# FINAL PRINCIPLE

Software changes every day.

The reasons behind those changes should never be lost.

Future engineers should understand not only what was decided,

but why it was decided.

---

End of DECISIONS LOG.