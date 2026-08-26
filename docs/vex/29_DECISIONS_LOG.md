29_DECISIONS_LOG.md
# THE VEX OPERATING SYSTEM

# DECISIONS LOG

Version: 1.0

Status: Living Document

Owner: Engineering Leadership

Last Updated: 2026-08-03

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

2026-08-25

Decision ID

DL-0020

Title

Auditoria de `schema_migrations` (020-043) + resolução de 2 gaps de produção (029 audit_logs, 031 RENAVE) — incidente encontrado e corrigido na mesma sessão

Category

Engineering / Infra

Context

Ao aplicar a migration 022 (agendamento_data/agendamento_horario) manualmente em produção via `supabase db query --linked` (mesmo SQL do arquivo, direto — ver contexto de BL-0037), `supabase migration list` revelou que a tabela de controle do CLI (`supabase_migrations.schema_migrations`) só reconhece migrations até a 019. As migrations 020-043 (24 arquivos) nunca foram registradas nela, mesmo que boa parte já estivesse de fato aplicada no schema real — indício de que foram rodadas manualmente via SQL Editor do Supabase Studio (migration 026 já documentava isso explicitamente no próprio arquivo, para essa migration específica). Rodar `supabase migration up`/`db push` às cegas nesse estado tentaria reaplicar as 24 do zero e quebraria em "column/constraint already exists".

Vitor pediu auditoria completa (Passo 1) antes de qualquer repair (Passo 2): comparar cada arquivo 020-043 contra o schema real de produção via consultas read-only (information_schema, pg_constraint, pg_indexes, pg_policy, pg_views, pg_proc, storage.buckets, pg_publication_tables, pg_extension), sem executar nenhum DDL.

Decision

Auditoria completa executada, só leitura. Resultado: **21 de 23 migrations batem 100%** com o schema real (colunas, tipos, nullability, defaults, constraints, índices, funções — comparadas byte-a-byte onde aplicável, ex: `assign_lead_to_least_loaded_vendedor`/`webhook_ingest_message`/`claim_conversation_pipeline_lock` idênticas ao arquivo). **2 migrations NUNCA foram aplicadas**, nem manualmente nem via CLI:

- **029 (audit_logs)** — tabela `public.audit_logs` não existe em produção. Nenhuma trilha de auditoria está sendo gravada hoje, apesar do código/documentação tratarem isso como implementado.
- **031 (RENAVE status)** — colunas `vehicles.renave_stage`/`renave_nfe_key`/`renave_stage_updated_by`/`renave_stage_updated_at` não existem em produção. Qualquer feature de controle de RENAVE que dependa dessas colunas falha silenciosamente ou quebra em produção.

Achado adicional (fora do escopo de 020-043, mas descoberto durante a auditoria): `stores` tem DUAS constraints de validação de cor primária — `stores_cor_primaria_hex_check` (a da migration 039, regex `^#[0-9A-Fa-f]{6}$`) e `stores_cor_primaria_format` (nome e regex diferentes, `^#[0-9a-fA-F]{6}$`, funcionalmente equivalente mas não rastreada em NENHUM arquivo de migration do repo). Provável artefato de teste manual no SQL Editor que nunca foi limpo — redundante, não conflitante (mesma regra, duas vezes).

Por instrução explícita do Vitor: **NÃO fazer repair da tabela de controle enquanto houver migration divergente** (029/031 contam como divergência — schema não bate com o arquivo, mesmo que a causa seja "nunca rodou" em vez de "rodou diferente"). `supabase migration repair` marcando 020-043 como applied ficou pausado até decisão sobre como tratar 029 e 031 especificamente.

**Outcome (mesmo dia, após aprovação do Vitor) — incidente de produção real, não só limpeza de schema:**

- **029 aplicada.** Antes da aplicação, confirmado em código (`lib/audit.ts:31-49`, `logAudit`) que a trilha de auditoria falhava 100% silenciosa: `try/catch` engole qualquer erro de insert e manda pro Sentry (`tags: { pipeline_stage: "audit_log" }`), nunca lança — toda ação sensível (reatribuição de lead, handoff, fechamento, criação de usuário, avanço de RENAVE) estava sem registro de auditoria, sem qualquer sinal visível pro usuário ou operador, só possivelmente visível no Sentry. `CREATE TABLE audit_logs` rodado via `supabase db query --linked --file`, validado estruturalmente (colunas/tipos/índices/RLS idênticos ao arquivo) e funcionalmente (insert de teste com o mesmo shape exato de `logAudit`, dentro de `BEGIN`/`ROLLBACK` — sucesso confirmado, zero linha deixada em produção).
- **031 aplicada.** Antes da aplicação, confirmado em código (`app/renave/page.tsx:32-38`) que a tela `/renave` estava **realmente quebrada em produção**: o SELECT falhava por coluna inexistente, a página capturava o erro sem crashar mas renderizava um banner vermelho com a mensagem crua do Postgres pro usuário final ("Erro ao carregar pendências de RENAVE: column vehicles.renave_stage does not exist"), e a tabela de pendências nunca aparecia — `advanceRenaveStage` (`lib/renave-actions.ts`) nunca ficava alcançável pela UI (zero linha renderizada com botão de ação). 4 colunas + CHECK constraint + FK + índice parcial rodados via `db query --file`, validados estruturalmente e funcionalmente (SELECT idêntico ao da página + UPDATE idêntico ao de `advanceRenaveStage`, mesmo padrão `BEGIN`/`ROLLBACK`, sucesso confirmado sem persistir nada).
- **Constraint duplicada removida.** `stores_cor_primaria_format` (não rastreada em nenhum arquivo de migration, regex funcionalmente idêntica à `stores_cor_primaria_hex_check` da migration 039 — confirmado antes de remover) dropada via `ALTER TABLE ... DROP CONSTRAINT`. Só a constraint oficial (039) permanece.
- **Root cause do gap de tracking, descoberto durante a auditoria**: `supabase_migrations.schema_migrations` já tinha um registro da migration 020 — mas sob `version = '20260615193022'` (timestamp, `created_by = vexautoai@gmail.com`, `name = '020_lead_sale_fields'`, `statements` idêntico ao arquivo), não sob `version = '020'` como o CLI local espera. Ou seja: aplicar via SQL Editor do Supabase Studio grava no histórico, só que com um identificador de versão diferente do que o CLI usa pra arquivos numerados simples — os dois nunca batem, por isso o CLI via `migration list` sempre viu 020+ como "nunca aplicada" mesmo quando estava. Esse registro antigo (`20260615193022`) continua no histórico, agora duplicado com o `020` que o repair de hoje registrou — inofensivo (nenhum dos dois nunca vai re-rodar DDL, `migration list`/`up` só checam presença), não removido, só documentado aqui pra não confundir uma auditoria futura.
- **`supabase migration repair --status applied --linked 020 022 023 024 025 026 027 028 029 030 031 032 033 034 035 036 037 038 039 040 041 042 043` executado.** `supabase migration list` confirmado: `001` a `043` todos com `local == remote`, sem gap algum (único item residual é o `20260615193022` explicado acima, que não tem arquivo local correspondente — histórico, não um problema ativo).

Reasoning

Reconciliar a tabela de controle antes de garantir que o schema real bate 100% com os arquivos locais marcaria como "applied" duas migrations que na verdade nunca rodaram — a tabela de controle mentiria sobre o estado real do banco, o oposto do que ela existe pra garantir. Auditoria evidence-based (query direta) em vez de confiar em `CLAUDE.md`/docs (que diziam migration 020 confirmada mas nada sobre 029/031 especificamente).

Alternatives Considered

Rodar `supabase migration repair` pra todas as 24 de uma vez, assumindo que "documentado como aplicado" bastava como evidência — descartado porque essa mesma suposição (aplicada a só migration 022) já tinha se provado falsa horas antes nesta mesma sessão.

Expected Impact

Resolvido: `/renave` volta a funcionar (colunas existem, tela deve parar de mostrar o banner de erro), trilha de auditoria (`audit_logs`) volta a gravar a partir de agora (ações anteriores à aplicação nunca tiveram registro — não é retroativo, não dá pra reconstruir). `schema_migrations` agora reflete o schema real sem gap.

Potential Risks

Baixo — todas as mudanças foram aditivas (`ADD COLUMN`/`CREATE TABLE`/`CREATE INDEX`), sem perda de dado possível. Validação funcional rodou dentro de `BEGIN`/`ROLLBACK`, sem persistir nenhuma linha de teste em produção. Único residual: o registro órfão `20260615193022` no histórico de migrations (ver Outcome acima) — puramente informativo, não bloqueia nada.

Owner

Engineering (auditoria + aplicação) / Founder (aprovação de cada passo)

Related ADR

None

Related Issue

Continuação de BL-0037 (migration 022 aplicada na mesma sessão)

Related Runbook

**Reforço de processo para sessões futuras**: aplicar migrations sempre via `supabase migration up`/`db push` (ou, quando isso não for viável no ambiente, via `supabase db query --linked --file <arquivo>` rodando o SQL exato do arquivo) — nunca colar SQL solto no SQL Editor do Supabase Studio sem depois rodar `supabase migration repair` pra manter a tabela de controle sincronizada. O gap desta auditoria (24 migrations invisíveis pro CLI) existe exatamente porque isso não foi seguido no passado.

Review Date

N/A — resolvido

Status

Resolved — 029/031 aplicadas e validadas, constraint duplicada removida, repair concluído, `schema_migrations` sem gap

---

Date

2026-08-25

Decision ID

DL-0019

Title

Rota `/inicio` renomeada pra `/dashboard`

Category

Engineering

Context

`/inicio` era o nome da rota do dashboard operacional desde a Fase 1 — nome herdado da primeira versão do produto, não reflete mais o que a página é (painel operacional central, não uma "página inicial" genérica). BL-0037 (redesign visual, continuação) pediu o rename direto do founder, junto com a remoção de 2 cards redundantes e a adição de um seletor de período global com 4 cards novos.

Decision

`app/inicio/` virou `app/dashboard/`. Redirect permanente `/inicio` → `/dashboard` adicionado em `next.config.mjs` (mesmo padrão já usado pelo redirect `/analytics` → dashboard, que teve o destino atualizado junto pra não encadear um redirect no outro). Todo link/redirect hardcoded pra `/inicio` no código (sidebar, pós-login, callback de OAuth, onboarding, alerta de estoque, middleware) atualizado pra `/dashboard`.

Reasoning

Bookmark e link salvo de quem já usa o sistema não pode virar 404 — o redirect permanente cobre isso sem exigir nenhuma ação do usuário. Atualizar os links internos (em vez de deixar todos dependerem do redirect) evita um hop de rede extra em todo o navegação principal do app.

Alternatives Considered

Manter `/inicio` como rota real e só mudar o label da sidebar pra "Dashboard" — descartado porque o pedido explícito era renomear a rota de verdade (BL-0037), não só o texto exibido; deixaria a URL e o label dessincronizados.

Expected Impact

Nenhuma mudança de comportamento pro usuário final (mesmo conteúdo, nova URL) além de quem tinha `/inicio` salvo como favorito — esse caso é coberto pelo redirect permanente, sem 404.

Potential Risks

Baixo — mudança de rota + redirect é um padrão já usado no projeto (`/analytics` → dashboard já funcionava assim). Risco residual: algum serviço externo (ex: link em campanha de WhatsApp) apontando pra `/inicio` continua funcionando via redirect, só com um hop a mais.

Owner

Engineering (implementação) / Founder (pedido)

Related ADR

None

Related Issue

BL-0037 (Fase 1, continuação)

Related Runbook

None

Review Date

N/A

Status

Active

---

Date

2026-08-19

Decision ID

DL-0018

Title

Cores do Funil de Temperatura: Frio reaproveita `--accent`, Morno/Quente ganham tokens novos (`--funnel-morno`/`--funnel-quente`)

Category

Engineering / Design System

Context

Funil de Temperatura (`app/components/LeadsFunnel.tsx`, `/leads` e `/inicio`) agrupa `lead_status` em 3 camadas (Frio = Novo+Engajado, Morno = Interessado, Quente = Quente+Negociação) e pede degradê termal explícito azul→âmbar→vermelho entre elas. Primeira versão usou um azul sky (`#38BDF8`) novo pra Frio — Vitor corrigiu: a camada fria devia usar o azul canônico do projeto (`#005BFE`, já é `--accent`/`--sky`), não inventar um tom "frio" à parte. Pra Morno/Quente, as 7 cores de status já documentadas em DESIGN.md (`--status-novo` `#94A3B8`, `--status-engajado` `#0EA5E9`, `--status-interessado` `#8B5CF6`, `--status-quente` `#F97316`, `--status-negociacao` `#22C55E`, `--status-fechado` `#10B981`, `--status-perdido` `#EF4444`) continuam sem equivalente semântico pro degradê pedido — `--status-interessado` é roxo (não âmbar), `--status-quente` é laranja (não vermelho).

Decision

Frio usa `var(--accent)` direto (sem token novo — é literalmente a cor de marca). 2 tokens novos em `:root` (`app/globals.css`): `--funnel-morno: #FBBF24`, `--funnel-quente: #F43F5E`. `--funnel-quente` deliberadamente diferente de `--status-perdido` (`#EF4444`, também vermelho) pra não colidir visualmente o mesmo hex em dois conceitos diferentes (lead perdido vs. lead quente) mesmo que nunca apareçam lado a lado no mesmo componente.

Reasoning

DESIGN.md pede reaproveitar token existente quando houver equivalente semântico — pra Frio havia (o azul de marca é literalmente "frio" na percepção de cor), pra Morno/Quente não há (mapear Morno pra `--status-interessado`, roxo, contradiria o requisito explícito de "morno = âmbar/laranja").

Alternatives Considered

Reaproveitar as 7 cores de status existentes mesmo sem casar semanticamente com o degradê termal pedido — descartado por gerar uma paleta inconsistente (roxo no meio de azul→vermelho não lê como "temperatura subindo").

Expected Impact

Funil de Temperatura com degradê visualmente coerente, sem herdar acidentalmente do sistema de cor por status (que é uma taxonomia diferente: 7 estados de pipeline, não 3 faixas de temperatura).

Potential Risks

Mais 2 tokens de cor no design system pra manter (Frio não soma token novo — reaproveita `--accent`). Baixo risco — escopo restrito a um único componente (`LeadsFunnel.tsx`), documentado aqui pra não virar "de onde veio isso" numa auditoria futura.

Owner

Engineering

Related ADR

None

Related Issue

DESIGN.md (seção de cores de status), BL-0037

Related Runbook

None

Review Date

N/A

Status

Active

---

Date

2026-08-12

Decision ID

DL-0017

Title

Mascote (raposa) autorizada como favicon/logo da sidebar do app logado — exceção pontual, não revogação da regra geral

Category

Product / Brand

Context

DESIGN.md documentava como regra absoluta, em linguagem deliberadamente forte: "a raposa nunca aparece no app logado, em nenhum contexto" — mascote restrita a marketing/Instagram/landing, favicon in-app definido como a letra "V" isolada. Vitor pediu diretamente, na mesma sessão de DL-0016, pra trocar o favicon (aba do navegador + logo da sidebar) pela raposa. Diferente da reversão de tema (DL-0016), essa regra não tinha ressalva de "pode mudar depois" no texto original — foi sinalizado explicitamente antes de implementar, e o founder confirmou querer prosseguir mesmo assim.

Decision

O favicon in-app deixa de ser a letra "V" isolada e passa a ser um render da raposa. Asset final, depois de 3 iterações no mesmo dia (glow preto/azul → lobo sólido → confirmado o lobo como oficial), é `docs/vex/assets/brand/FAVICONOFICIAL.png` (170×172, ~36KB, fundo transparente, cores sólidas) — renomeado de `FAVICON.png` pra deixar explícito que é a versão definitiva, não mais uma iteração. Esse arquivo é copiado pra `Public/favicon.png`, que é o que `app/layout.tsx` (metadata.icons) e `app/components/Sidebar.tsx` de fato servem — a cópia em `docs/vex/assets/brand/` é só a fonte, precisa ser sincronizada manualmente a cada troca. Resto da regra original continua de pé — raposa não aparece em nenhuma outra superfície de produto (cards, empty states, loading, e-mail transacional).

Reasoning

Decisão de marca é prerrogativa do founder. O escopo da exceção é estreito o suficiente (só o ícone de identidade, não a raposa "solta" pelo produto) pra não comprometer a separação marca/produto que motivou a regra original — o app operacional continua sem fundo preto, sem itálico motorsport, sem bandeira quadriculada.

Alternatives Considered

Recriar a raposa como SVG vetorial a partir de referência visual, em vez de usar o arquivo exato do founder — descartado a pedido dele; preferiu subir o PNG original direto pro repo. Versão anterior (render com glow, 1536×1024, ~1.2MB) foi testada e descartada — trocada pela versão sólida/menor por decisão direta do founder no mesmo dia.

Expected Impact

Favicon/logo fica mais reconhecível como marca "Vex" (a raposa é o elemento de mascote mais forte visualmente). Asset final (170×172, ~36KB) já resolve o problema de peso que a primeira iteração tinha — não precisa de otimização adicional.

Potential Risks

Nenhum técnico relevante com o asset atual. Ponto de atenção operacional: `docs/vex/assets/brand/FAVICONOFICIAL.png` e `Public/favicon.png` são arquivos independentes (cópia, não referência) — trocar um sem o outro deixa a marca-fonte e o que o app realmente serve dessincronizados, como já aconteceu uma vez nesta mesma sessão.

Owner

Founder

Related ADR

None

Related Issue

DESIGN.md (regra original revisada), DL-0016 (mesma sessão), BL-0037

Related Runbook

None

Review Date

N/A — decisão de marca, não expira

Status

Superseded (2026-08-13) — exceção não está mais em uso. Favicon final não é a raposa: virou uma 3ª iteração no dia seguinte (`faviconv.png`, a letra "V" com glow + acento de bandeira quadriculada), pedido direto do founder. A regra original do DESIGN.md ("raposa nunca aparece no app logado") volta a valer sem ressalva — este DL fica registrado como histórico de por que ela foi aberta e fechada no mesmo ciclo, não como exceção ativa.

---

Date

2026-08-12

Decision ID

DL-0016

Title

Tema claro volta a ser o default do app operacional — escuro vira opt-in via toggle

Category

Product

Context

DL-0015 (dia anterior) aceitou fundo escuro como default do app operacional, com ressalva explícita: "Se vendedores reportarem desconforto, reverter pra claro ou oferecer toggle é trabalho de UI, não de arquitetura." Fase 1 do redesign (BL-0037) entregou Sidebar, Kanban e Inbox em escuro; ao revisar localmente, Vitor pediu claro como default de volta, com escuro disponível via toggle — sem esperar por sinal de fadiga de uso real, decisão direta do founder.

Decision

Tema claro passa a ser o default de todo usuário sem preferência salva. Escuro continua existindo e disponível a qualquer momento via toggle no dropdown de "Conta" da sidebar (implementado na mesma sessão), persistido em localStorage por navegador/usuário.

Reasoning

Implementação já tinha os dois temas prontos e validados (o claro é o tema histórico restaurado do commit pre-DL-0015, não uma paleta nova) — trocar qual dos dois é o default é mudança de uma linha no script de aplicação de tema (`app/layout.tsx`), não retrabalho de CSS. Não há custo técnico relevante em atender o pedido imediatamente em vez de esperar validação de campo.

Alternatives Considered

Manter escuro como default e só confiar no toggle pra quem quiser claro — rejeitado, pedido explícito e direto do founder não deixou ambiguidade.

Expected Impact

Novo usuário (sem localStorage ainda) vê claro. Screenshots futuros pra landing (motivação original de BL-0037) devem ser tirados com o toggle em escuro se a intenção for mostrar a versão dark, já que não é mais o que a maioria dos usuários vê por padrão.

Potential Risks

Nenhum técnico. Risco de produto é nenhum — ambos os temas são primeira classe, escolha é só de qual lado começa ligado.

Owner

Founder

Related ADR

None

Related Issue

DL-0015 (decisão anterior, parcialmente revertida), BL-0037 (redesign visual fase 1)

Related Runbook

None

Review Date

N/A — decisão de preferência de UI, não expira

Status

Active

---

Date

2026-08-11

Decision ID

DL-0015

Title

Reversão consciente da decisão de manter app operacional em tema claro — fundo escuro aceito com risco de ergonomia não testada

Category

Product

Context

DL anterior desta mesma sessão definiu app operacional em tema claro + accent pontual, por falta de validação de ergonomia de fundo escuro em uso prolongado.

Decision

Revertida. Vitor confirma que Speed Motos é loja própria (não cliente terceiro), tolerância a risco de ergonomia não testada é aceita conscientemente. Motivo adicional: sistema vai passar por redesign visual completo, mais rico, para (a) gerar screenshots de qualidade para seção "como funciona" da landing pública, e (b) modernizar a experiência do produto como um todo. Redesign será feito por fases, não de uma vez.

Reasoning

Sendo loja própria, o blast radius de uma decisão estética arriscada é controlado — não há cliente terceiro afetado. O redesign por fases amortiza o risco: se fundo escuro causar fadiga em uso prolongado, será visível nas primeiras telas antes de expandir pro sistema inteiro.

Alternatives Considered

Manter tema claro conforme DL anterior até ter validação de ergonomia com vendedores reais — rejeitado: atrasa material de marketing (screenshots) e redesign que já precisa acontecer.

Expected Impact

Nenhuma mudança de posicionamento (DL-0007/B+) — é decisão de camada visual, não de escopo de produto. App operacional passa a usar fundo escuro. Screenshots do fluxo redesenhado alimentam seção "como funciona" da landing.

Potential Risks

Fundo escuro em uso prolongado (vendedor olhando o turno inteiro) pode causar fadiga visual — aceito conscientemente sem validação prévia. Se vendedores reportarem desconforto, reverter pra claro ou oferecer toggle é trabalho de UI, não de arquitetura.

Owner

Founder

Related ADR

None

Related Issue

BL-0037 (redesign visual do app operacional)

Related Runbook

None

Review Date

Primeiras semanas de uso real pós-redesign — monitorar feedback de vendedores da Speed Motos sobre fadiga visual com fundo escuro.

Status

Active — parcialmente atualizada por DL-0016 (2026-08-12): tema claro voltou a ser o DEFAULT do app (era escuro aqui). O restante desta decisão continua válido — tema escuro existe, foi aceito como opção de primeira classe, e o redesign visual (BL-0037) seguiu em frente sobre essa base; só a pergunta "qual tema liga sozinho" mudou de resposta.

---

Date

2026-08-04

Decision ID

DL-0014

Title

stores.slug — gap entre migration 033 (backfill) e createStore() nunca coberto, exposto na primeira criação de loja pela UI desde o roadmap 1.3

Category

Engineering

Context

Migration 033 (`033_stores_slug.sql`, roadmap 1.3 — rota pública por subdomínio) adicionou `stores.slug` como `NOT NULL` + `UNIQUE` + `CHECK` de formato, com backfill determinístico só das lojas que já existiam na hora em que a migration rodou. `app/admin/actions.ts::createStore()` nunca foi atualizado pra gerar `slug` em criações novas — ninguém tentou criar uma loja pela UI entre a 033 e agora (04/08), então o gap ficou invisível por semanas. Descoberto ao testar manualmente o BL-0026 (wizard de onboarding): criar uma "Loja Teste Onboarding" pela UI quebrou com `null value in column "slug" of relation "stores" violates not-null constraint`.

Decision

Gerar `slug` em `createStore()` reaproveitando exatamente o mesmo algoritmo do backfill da migration 033 (unaccent + lowercase + não-alfanumérico→hífen + trim), extraído como função pura em `lib/store-slug.ts` (`slugifyStoreName`, `nextAvailableSlug`). Colisão de slug (mesmo nome de loja usado duas vezes) resolvida com sufixo `-2`, `-3`, ... — mesmo esquema de numeração da migration. Erro `23505` na inserção passa a diferenciar colisão de `slug` (rara, corrida) de colisão de `whatsapp_numero` (caso já tratado antes), evitando mensagem enganosa ao super-admin.

Reasoning

Migrations que fazem backfill de coluna `NOT NULL` só cobrem o estado passado — qualquer caminho de escrita (Server Action, endpoint) que insere linha nova precisa ser atualizado no mesmo PR/branch, senão o gap só aparece quando alguém tenta o caminho não coberto. Aqui isso levou ~2 semanas pra aparecer porque nenhuma loja nova foi criada nesse intervalo.

Alternatives Considered

Gerar slug via trigger no banco (`BEFORE INSERT`) em vez de código da aplicação — rejeitado por ora: mudaria onde a lógica de negócio mora (banco vs. `lib/`), inconsistente com o padrão do projeto de manter lógica de domínio em funções puras testáveis em `lib/`. Reavaliar se mais pontos de escrita em `stores` aparecerem (hoje só `createStore()`).

Expected Impact

Criação de loja pela UI do admin volta a funcionar. Nenhum impacto em lojas existentes (já têm slug via backfill da 033).

Potential Risks

Se outro ponto de código no futuro fizer `insert` direto em `stores` (fora de `createStore()`), o mesmo gap se repete — não há trigger de banco garantindo `slug` sempre presente, só a convenção de passar pela Server Action. Considerar trigger `BEFORE INSERT` se um segundo caminho de escrita em `stores` aparecer.

Owner

Engineering

Related ADR

None

Related Issue

BL-0026 (onboarding wizard) — bug encontrado durante teste manual, não faz parte do escopo original

Related Runbook

None

Review Date

Se um segundo ponto de insert em `stores` for criado — avaliar mover geração de slug pra trigger de banco em vez de duplicar a lógica em mais um Server Action.

Status

Active

---

Date

2026-08-04

Decision ID

DL-0013

Title

Item 1.6 — feat/onboarding-wizard: rebase (não descarte), escopo absorvido reduzido a backend

Category

Engineering

Context

Branch `feat/onboarding-wizard` abandonada em 2026-07-21, nunca mergeada, sem decisão registrada sobre destino. Levantamento (item 1.6 do roadmap) mostrou: 5 commits, 580 linhas em 8 arquivos, migration própria (021, renumerada pra 040 — 021 já livre em main mas 99 commits de main passaram por cima desde 21/07, próximo número real era 040). Diff não toca nenhum arquivo tocado por RBAC 0.3 (migration 026), config visual de loja (1.5, migration 039), site público (1.3/1.4) ou qualquer outra migration do período. Único bug real encontrado: `assertStoreAdmin()` em `lib/auth.ts` checava `role !== "admin"`, mas migration 026 (30/07, já em produção) renomeou o role pra `dono_loja` — função quebrava pra todo dono de loja legítimo, sem gerar erro de merge (é código novo, não edita linha existente). Plano original da branch tinha 8 tasks; só as 4 primeiras (migration + guard de auth + lógica pura de passos + Server Actions) foram implementadas. Tasks 5-8 (middleware de redirect, página `/onboarding`, componente de formulário, integração no painel admin) nunca foram escritas — zero UI existe.

Decision

Rebase da branch em main (não descarte). Fix do bug de role usando o padrão já estabelecido em `getServerUserRole()` (RBAC 0.3) em vez de manter a query raw antiga. Migration renumerada pra 040. Merge do backend em main. UI da wizard (Tasks 5-8 do plano original) fica de fora deliberadamente — vira item novo de backlog, dependente deste merge.

Reasoning

Diff pequeno (580 linhas), sem conflito de schema real com nenhum trabalho feito desde 21/07, e 366 linhas de teste já escritas cobrindo a lógica — descartar jogaria fora trabalho testado e correto por causa de um bug de 1 linha. Rebase decorreu limpo: só 2 arquivos em conflito textual (`lib/auth.ts`, `tests/unit/auth.test.ts`), ambos por adição pura (sem edição de linha existente de main). O bug de role foi confirmado via teste RED (mock com `role: "dono_loja"` lançando `ForbiddenError` contra a implementação antiga) antes do fix, e GREEN depois — não foi corrigido às cegas.

Alternatives Considered

Descartar e reimplementar do zero — rejeitado: o backend testado (assertStoreAdmin, nextOnboardingStep, as 4 Server Actions) é reaproveitável sem retrabalho; o único custo real do reaproveitamento foi o fix de 1 linha + renumeração de migration.

Absorver a UI (Tasks 5-8) neste mesmo merge — rejeitado: fora do escopo pedido pro item 1.6 (decisão de destino da branch), e é trabalho não-trivial (middleware, página, componente) que merece planejamento próprio, não anexado a uma decisão de rebase-vs-descarte.

Expected Impact

Backend de onboarding self-service (guard de auth, derivação de passo, 4 Server Actions) disponível em main, testado (38 testes unitários), mas sem nenhuma superfície de uso — não há middleware redirecionando lojas incompletas nem página pra rodar o wizard. Nenhum impacto em produção até a UI existir (nada aciona esse código hoje).

Potential Risks

Backend merged sem consumidor pode ficar esquecido/dessincronizar de novo se o item de backlog da UI não for priorizado. Campo de WhatsApp self-service (`updateStoreWhatsAppSelfService`) coleta `phone_number_id`/`whatsapp_numero` cru sem validação contra a API da Meta — quando a UI for construída, revisar se esse passo ainda faz sentido dado BL-0001 (WhatsApp Embedded Signup é o caminho self-service real, ainda bloqueado por CNPJ próprio).

Owner

Engineering

Related ADR

None

Related Issue

Item 1.6 (53_ROADMAP.md), backlog novo de UI da wizard (28_BACKLOG.md)

Related Runbook

None

Review Date

Quando UI da wizard (Tasks 5-8) entrar em planejamento — revisar se passo de WhatsApp self-service ainda é o desenho certo.

Status

Active

---

Date

2026-08-03

Decision ID

DL-0012

Title

Adiar DNS Wildcard (*.vexauto.com.br) — Usar CNAME Específico por Loja Até Haver Volume

Category

Infrastructure

Context

Item 1.3 do roadmap (rota de leitura pública por subdomínio) exige que cada loja seja acessível via subdomínio (ex: speed-motos.vexauto.com.br). A Vercel recomendou domínio wildcard (*.vexauto.com.br) para cobrir todas as lojas automaticamente, mas isso exige migrar os nameservers do domínio inteiro para a Vercel. O domínio vexauto.com.br já tem e-mail profissional ativo via Zoho (registros MX, SPF, DKIM, verificação de domínio) na Hostinger — migrar nameservers sem recriar manualmente todos esses registros do lado da Vercel primeiro derrubaria o e-mail da empresa.

Decision

Não migrar nameservers agora. Usar um CNAME específico por loja (ex: speed-motos.vexauto.com.br → cname.vercel-dns.com ou valor equivalente indicado pela Vercel), criado manualmente na Hostinger para cada nova loja, mantendo o DNS atual (Zoho/e-mail) intocado.

Reasoning

Com 1 loja piloto ativa, o custo de criar um CNAME manual por loja é desprezível — não há volume que justifique o risco de uma migração de nameservers sem rede de segurança. Adiar a decisão até haver volume real de lojas preserva o e-mail da empresa sem bloquear o roadmap: a arquitetura de código do 1.3 (resolução de loja por subdomínio) funciona igual com CNAME específico ou wildcard — a diferença é só operacional (criar 1 registro DNS por loja vs. automático).

Alternatives Considered

Migrar nameservers para Vercel imediatamente, recriando manualmente os registros MX/SPF/DKIM/TXT do Zoho no painel de DNS da Vercel antes da migração — rejeitado por ora: risco desnecessário para o volume atual (1 loja), e-mail é serviço crítico da operação, sem necessidade de assumir esse risco agora.

Expected Impact

Onboarding de loja nova no site público passa a ter um passo manual extra (criar CNAME na Hostinger + cadastrar domínio na Vercel) até a migração de nameservers acontecer. Sem impacto no e-mail da empresa. Sem impacto na arquitetura de código do 1.3.

Potential Risks

Se o número de lojas crescer rápido, esse passo manual vira gargalo de onboarding — critério de revisão abaixo cobre isso. Enquanto não migrado, todo subdomínio novo de loja exige ação manual do founder (não é self-serve).

Owner

Founder (decisão de infraestrutura)

Related ADR

None

Related Issue

Item 1.3 (53_ROADMAP.md)

Related Runbook

None

Review Date

Quando o número de lojas ativas tornar a criação manual de CNAME por loja um gargalo de onboarding perceptível (ex: 5+ lojas, ou onboarding self-serve virar prioridade) — nesse ponto, migrar nameservers para Vercel, recriando antes os registros MX/SPF/DKIM/TXT do Zoho no painel de DNS da Vercel.

Status

Active

Nota de Esclarecimento (2026-08-04)

Confirmado que existe um CNAME wildcard (*) já apontado pra Vercel na Hostinger. Isso NÃO elimina o passo manual — a Vercel exige cadastro explícito do domínio no painel "Domains" do projeto pra servir TLS/rotear, independente do DNS resolver. `extractStoreSlugFromHost` (`lib/subdomain.ts`) e o restante do app não dependem de cadastro na Vercel, só da tabela `stores` — o gargalo é 100% infra externa (Hostinger DNS + Vercel Domains), como já documentado. Processo de 2 passos por loja nova permanece válido até decisão de migrar nameservers. Origem do wildcard já existir não identificada (teste anterior ou pré-provisionamento) — inofensivo no estado atual, revisar se aparecer confusão futura.

---

Date

2026-07-31

Decision ID

DL-0011

Title

VEX não vai construir dashboard de tráfego/anúncios (investimento, CPL, CPA, criativos) — fronteira do posicionamento B+ reforçada, não gap a fechar

Category

Product

Context

Reunião de vendas com AutoPilot CRM (31/07/2026, ver `53_ROADMAP.md`, perfil competitivo completo). AutoPilot opera dashboard de tráfego em tempo real (investimento, alcance, conversas iniciadas, leads, qualificados, visitas agendadas, vendas, taxa de qualificação/desqualificação/fechamento, custo por lead, custo por aquisição, criativos rodando com métricas estilo Meta Ads) porque atua como meio-agência — cobre uma camada de gestão de mídia paga que o VEX conscientemente decidiu não ocupar (`DL-0007`, posicionamento B+: camada de inteligência operacional plugada no sistema de gestão que o lojista já tem, sem terceirizar o funil de marketing nem competir por distribuição de mídia paga).

Decision

Não construir dashboard de tráfego/anúncios/mídia paga no VEX. Manter fronteira do `DL-0007` como está.

Reasoning

Ver a AutoPilot operando essa camada na prática (não só declarada em página de vendas) confirma que é uma escolha estrutural de modelo de negócio (agência/meio-agência), não uma feature isolada e barata de replicar — exige integração com Meta Ads/Google Ads, gestão de investimento de terceiro e responsabilidade sobre performance de mídia, fora do escopo de "infraestrutura operacional" que é a tese central do VEX. Construir isso dilui o B+ e puxa o VEX pra concorrer com agência, não com CRM/operação.

Alternatives Considered

Construir versão simplificada do dashboard de tráfego pra fechar paridade percebida de feature contra a AutoPilot.

Expected Impact

Nenhuma mudança de roadmap — decisão de manter escopo, não de expandir. Argumento de posicionamento fica mais forte em conversa de venda: "VEX não é agência disfarçada de CRM" vira resposta direta e informada, não genérica.

Potential Risks

Se o mercado consolidar em torno de "CRM+mídia integrados" como padrão mínimo (do jeito que IA de atendimento virou padrão mínimo em 2026, ver `53_ROADMAP.md`), o VEX fica de fora dessa expectativa. Mitigação: monitorar, mesmo gatilho de revisão do `DL-0007`.

Owner

Founder

Related ADR

None

Related Issue

`53_ROADMAP.md` (Concorrentes mapeados, perfil AutoPilot CRM)

Related Runbook

None

Review Date

Mesmo gatilho do `DL-0007`: revisar se inteligência competitiva independente mostrar isso virando padrão mínimo de mercado, não só feature de um concorrente meio-agência.

Status

Active

---

Date

2026-07-31

Decision ID

DL-0010

Title

Handoff (assignConversationToHuman) escreve leads.assigned_to sem guard de RBAC — self-claim-only por construção, não precisa do guard de assignLeadToUser/removeLeadAssignment

Category

Security

Context

Fix do item 1.9 do roadmap (`53_ROADMAP.md`) — `assignConversationToHuman` (`lib/actions.ts`) zerava `assigned_to` no handoff pra humano, fazendo o lead sumir da métrica de vendedor (`team-metrics.ts` lê `leads.assigned_to`). Fix: `ownerId = leadRow.assigned_to ?? actorId` — preserva dono existente, ou autoatribui a quem está assumindo a conversa. Esse write em `leads.assigned_to` não tem o guard de RBAC (`role === "vendedor"` bloqueado) que existe em `assignLeadToUser`/`removeLeadAssignment` — decisão consciente, não gap esquecido.

Decision

Não adicionar guard de RBAC no write de `leads.assigned_to` dentro de `assignConversationToHuman`.

Reasoning

`ownerId = leadRow.assigned_to ?? actorId` só escreve um valor novo quando o campo atual é `null` (autoatribuição do próprio ator) — nunca sobrescreve um dono já existente com outro `actorId`. Não existe caminho, por esse código, pra um vendedor tomar lead de outro. Isso é estruturalmente diferente do que `assignLeadToUser` bloqueia: reatribuição explícita de um lead que já tem dono, escolhendo livremente qualquer `userId` da loja. O guard de `assignLeadToUser`/`removeLeadAssignment` protege contra essa reatribuição arbitrária; o handoff não tem essa superfície porque o único destino possível é o próprio ator autenticado.

Alternatives Considered

Aplicar o mesmo guard (`role === "vendedor"` bloqueado) no write de `leads.assigned_to` dentro do handoff, por consistência de padrão com `assignLeadToUser`/`removeLeadAssignment`.

Expected Impact

Vendedor consegue assumir handoff de lead sem dono e virar o dono automaticamente, sem depender do dono da loja pra reatribuir manualmente primeiro — reduz fricção operacional no piloto (1 loja, poucos vendedores).

Potential Risks

Nenhum risco de reassignment indevido — analisado e descartado (ver Reasoning). Risco residual é só de leitura futura: se alguém no futuro "corrigir" isso adicionando o guard achando que é gap de segurança, quebra o caso de uso de autoatribuição em handoff sem entender a diferença estrutural. Registrado aqui pra prevenir isso.

Owner

Engineering

Related ADR

None

Related Issue

Item 1.9 do `53_ROADMAP.md`, `lib/actions.ts:assignConversationToHuman`

Related Runbook

None

Review Date

Revisitar se RBAC por papel (vendedor só toca os próprios leads) virar decisão de produto real — hoje é dívida documentada e aceita (ver `CLAUDE.md`, "Atribuição sem RBAC").

Status

Active

---

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

2026-07-30

Decision ID

DL-0009

Title

Priorizar Multi-Bolha (BL-0008) em Produção Real (Speed Motos) Antes da Fase 1

Category

Product

Context

BL-0008 (28_BACKLOG.md) estava registrado como "sem agendamento — reavaliar quando o número tiver reputação estabelecida", motivado por cautela sobre quality_rating da Meta. Reavaliação técnica (2026-07-30): quality_rating é determinado principalmente por feedback do usuário (bloqueio/denúncia de spam), não por ritmo de envio — múltiplas mensagens curtas em sequência é prática comum de negócios reais na API. O risco real não é reputacional, é técnico: ordem de entrega (exige envio sequencial, nunca paralelo) e esforço de implementação (schema, retry, testes).

Decision

Implementar BL-0008 agora, em produção real da Speed Motos (não atrás de flag restrita à demo), com envio estritamente sequencial e delay de 400-800ms entre mensagens.

Reasoning

Motivado por replicar o padrão de conversa fragmentada usado por concorrente (Thera, print de conversa real 28/07/2026) — ritmo humano de bolhas curtas em sequência, em vez de uma mensagem única longa. Speed Motos é o piloto ativo, onde toda validação de comportamento de IA já acontece.

Alternatives Considered

Esperar a landing/demo (BL-0013, Fase 1) existir antes de implementar, testando primeiro em ambiente de menor risco antes de mudar o comportamento em produção real com o único cliente piloto.

Expected Impact

Atendimento da Speed Motos passa a responder em múltiplas mensagens por turno, mais próximo do padrão de vendedor humano. Reaproveitável depois pela demo (BL-0013) sem trabalho adicional.

Potential Risks

Muda comportamento de produção com o único cliente piloto ativo, sem passar antes por ambiente de menor risco. Mitigação: envio sequencial obrigatório (nunca Promise.all) para evitar mensagens fora de ordem — esse é o risco técnico real, não o ritmo em si.

Owner

Founder (aprovação) / Engineering (implementação)

Related ADR

None

Related Issue

BL-0008 (28_BACKLOG.md)

Related Runbook

None

Review Date

Quando o resultado em produção (Speed Motos) tiver volume suficiente para avaliar impacto real em quality_rating — se degradar, reverter para 1 mensagem por turno e reabrir a cautela original.

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