# ROADMAP — VEX Auto

> **Data:** 27 de julho de 2026
> **Status do produto:** MVP operacional. **Primeiro fluxo real em produção validado em 27/07** — mensagem entrou, IA respondeu, guardrails dispararam, handoff funcionou. 1 loja piloto (Speed Motos / CMOV). Zero clientes pagantes.
> **Fonte da verdade operacional:** `docs/vex/27_PROJECT_STATUS.md`
> **Visão de produto de longo prazo:** `CLAUDE.md`
> **Portfólio de itens futuros:** `docs/vex/28_BACKLOG.md`
> **Log de decisões:** `docs/vex/29_DECISIONS_LOG.md`

Legenda de esforço: **P** = dias · **M** = 1 a 3 semanas · **G** = mais que isso.

---

## Contexto que define a priorização

Três fatos moldam este roadmap:

1. **RENAVE virou obrigatório por lei.** Resolução CONTRAN nº 1.026, publicada em 26/06/2026, com prazo de 90 dias para adaptação — vence em setembro de 2026. Sem registro no RENAVE, a loja não emplaca, não transfere e não recebe financiamento do banco. Toda revenda do Brasil está com esse problema na cabeça agora.

2. **A arquitetura atual não suporta um segundo cliente.** O `WHATSAPP_ACCESS_TOKEN` é global e escopado ao Business Manager que autorizou o System User. Cliente 2 com WABA em BM separado não autentica. Isso torna o CNPJ próprio (SLU) dependência **técnica**, não apenas administrativa.

3. **O produto é profundo e estreito.** O pipeline de IA, guardrails, follow-up, reativação e lead scoring são bem construídos (635 testes verdes) e provavelmente acima da média do mercado. Mas o VEX Auto não cobre metade da "mesa mínima" que qualquer concorrente entrega.

---

## FASE 0 — Destravar venda

> Nada de feature nova antes disso. São os itens que impedem o produto de funcionar para um cliente pagante real.

| # | Item | Por quê | Depende de | Esforço |
|---|------|---------|------------|---------|
| 0.1 | ✔ **CONCLUÍDO** (2026-07-27) — **WhatsApp em produção** | B001 resolvido (`27_PROJECT_STATUS.md`): `stores.whatsapp_phone_number_id` da Speed Motos = número real dedicado (`1238597592667311`, WABA `28099462022990346`), não mais sandbox. Mensagens reais processadas com `agent_status: ok` em 27/07 (18:31–22:44). Validação de produção segue acumulando (janela ainda curta) — ver `27_PROJECT_STATUS.md` MVP STATUS. | Chip + WABA (feito) | M |
| 0.2 | ✔ **CONCLUÍDO** (2026-07-29) — **Templates Meta aprovados** | 9 templates aprovados na Meta, `WHATSAPP_TEMPLATE_SEND_ENABLED=true` em produção, envio real de `follow_up_1` confirmado em aparelho (`{{1}}=Carlos`, copy bate exato com `TEMPLATES[1]` local, `lib/follow-up.ts`) — fecha B006 (`27_PROJECT_STATUS.md`). | 0.1 | P |
| 0.3 | **RBAC** | Zero hoje: qualquer usuário da loja reatribui ou altera qualquer lead. É critério de escolha declarado no mercado (LGPD, controle de acesso por perfil) e fonte previsível de conflito interno entre vendedores. | — | M |
| 0.4 | **Monitoramento de erro** (Sentry ou similar) | Não existe nada hoje. Um SaaS cujo core é IA processando conversa em tempo real, sem alerta de falha, é reclamação esperando acontecer. | — | P |
| 0.5 | **Log de auditoria** (quem fez o quê) | LGPD + rastreabilidade. Vira obrigatório quando RENAVE entrar. | 0.3 | P |
| 0.6 | **Abertura da SLU** | Dependência técnica do cliente 2 (ver contexto). Destrava também pagamento, contrato, gateway, RENAVE e Embedded Signup. Roda em paralelo, não bloqueia o piloto. | — | Externo |
| 0.7 | ✔ **CONCLUÍDO** (2026-07-28) — **Política de Privacidade + aviso de IA no atendimento** | O piloto processa dado pessoal real de terceiros (clientes finais da loja). Obrigação nasce do tratamento do dado, não do contrato. Não depende de CNPJ. `/privacidade` no ar (loja=controladora, VEX=operador — DL-0006, canal de titular = WhatsApp do atendimento, sem e-mail/telefone hardcoded) e aviso de IA determinístico ATIVO em produção na 1ª mensagem (`lib/ai-pipeline.ts`, gatilho `is_new_conversation`, idempotência por `meta.kind`, B001 resolvido) — ver detalhe em `27_PROJECT_STATUS.md`. Pendência remanescente não-bloqueante: revisão jurídica profissional antes de cliente pagante (DL-0006). | — | P |
| 0.8 | ✔ **CONCLUÍDO** (2026-07-27) — **Inbox em tempo real** | Área de mensagens isolada em `app/components/ConversationMessages.tsx` (Client Component), assina `postgres_changes` via `supabase.channel()`, filtrado por `conversation_id`. Isolamento multi-tenant garantido por RLS (`messages_own_store_select`), validado contra Supabase real (`tests/integration/realtime-isolation.test.ts`). Migration 023 adiciona `messages` à publication `supabase_realtime`. Pipeline e Server Actions intocados. Achado no caminho: client Realtime não herda o JWT da sessão sozinho — exige `realtime.setAuth()` explícito (DL-0004, `29_DECISIONS_LOG.md`). | — | P |
| 0.9 | ✔ **CONCLUÍDO** (2026-07-28) — **UI de resposta manual do vendedor** (BL-0009) | Vendedor responde o lead pelo WhatsApp sem sair do Vex Auto. `sendManualReply` (`lib/actions.ts`) — guard cross-store, guard de handoff (`handoff_to==="HUMANO"`), insert em `messages` (`autor:"humano"`, `sent_by` identifica qual vendedor — migration 025), rastro `meta.sent` reflete se o envio WA confirmou (mesmo padrão do aviso de IA, 0.7 parte 2). Form na página da conversa só habilita em handoff. Realtime (0.8) não precisou de mudança — INSERT já propaga pra qualquer autor. 678 testes unitários. Desbloqueia `BL-0010` (ver Fase 2). | 0.8 | M |

---

## FASE 1 — Janela de mercado (prazo RENAVE: setembro/2026)

| # | Item | Por quê | Depende de | Esforço |
|---|------|---------|------------|---------|
| 1.1 | **Controle de RENAVE (sem API)** | Status por veículo: entrada registrada, chave da NF-e vinculada, documentos protocolados no DETRAN, saída registrada. Painel de pendências + alerta de veículo parado sem registro. | — | P |
| 1.2 | **Verificar upload de foto de veículo** | Incógnita hoje — o CRUD de estoque existe, mas o relatório não confirma upload de imagem. Site de carro sem foto não vende nada. **Verificar antes de começar 1.4.** | — | P |
| 1.3 | **Rota de leitura pública por subdomínio** | O site não tem sessão — visitante não está logado. Hoje o acesso é por `getServerStoreId` + RLS via `my_store_id()`. Precisa resolver a loja pelo subdomínio sem furar o isolamento entre tenants. **Decisão de arquitetura, não detalhe.** | — | M |
| 1.4 | **Site da loja (template único, multi-tenant)** | `nomedaloja.vexauto.com.br` lendo direto do estoque. Listagem, detalhe do veículo, formulário de contato que cria lead no CRM. Todo concorrente tem. | Domínio + 1.2 + 1.3 | M |
| 1.5 | **Config visual por loja** | Logo, cor primária, telefone, endereço, texto "sobre". O portal precisa ter a cara da loja, não do fornecedor de tecnologia. | Storage de imagem | P |
| 1.6 | **Decidir branch `feat/onboarding-wizard`** | Abandonada em 21/07, nunca mergeada, desatualizada (não tem a coleta de financiamento/troca). Sobrepõe com 1.5. Rebase e aproveita, ou descarta e refaz — deixar as duas convivendo cria trabalho duplicado. **É o popup de introdução/configuração** (cadastro de vendedor, estoque, número) — não precisa ser feito do zero. | — | P |
| 1.7 | **Landing page de vendas do VEX Auto** | Caminho crítico: sem ela não existe onde captar cliente. Escopo mínimo: hero com proposta de valor, diferenciais, prova social ("early adopters, vagas limitadas"), CTA único de agendar demo. **Sem tabela de preços pública** — venda B2B consultiva fecha melhor em conversa. | — | M |
| 1.8 | **Mascote Vex — qualificação na landing** (BL-0002) | Substitui a tabela de planos. Formulário guiado de múltipla escolha com personagem visual (quantos vendedores, quanto estoque, dor principal), terminando em agendamento de call. **Não é LLM em tempo real** — é árvore condicional, esforço baixo. | 1.7 | P |
| — | **Demo por auto-simulação da IA** (BL-0013, sub-item de 1.7) | Prospect experimenta o atendimento de IA de verdade ("manda um oi") antes de comprar — técnica validada em concorrente (Thera). Reusa o motor de IA existente em modo demo (cenário fictício, não estoque real). Vive dentro da landing (1.7), conecta com o mascote (1.8). Ver `BL-0013` (`28_BACKLOG.md`). | 1.7 | — |
| 1.9 | **Corrigir o handoff que apaga o dono do lead** | `assignConversationToHuman` (`lib/actions.ts:36-39`) seta `handoff_to: "HUMANO"` **e `assigned_to: null`**. O lead mais valioso do funil — qualificado, pronto para humano — fica sem dono. Consequência: `team-metrics.ts` assume dono, então **lead em handoff não aparece na métrica de vendedor nenhum**, e o dono da loja não vê quem está deixando lead quente parado. Handoff deve **atribuir**, não zerar. | — | P |
| 1.10 | **Distribuição automática de leads** | Não existe hoje — `assigned_to` é 100% manual (`lib/actions.ts:186-215`). O modelo atual é "primeiro que ver, atende": `app/conversations/page.tsx` lista tudo sem filtro por vendedor, qualquer usuário da loja vê. Funciona no piloto com 1 loja; quebra em loja média com 2+ vendedores (fricção e briga interna). Regra simples basta no início: menor carga ou rodízio. | 1.9 + 0.3 | M |
| 1.11 | **Handoff parcial por assunto** (BL-0011) | Hoje o handoff é binário e total. Evidência do teste real: `"tem desconto nela?"` disparou o guardrail de margem e **matou a conversa inteira** — as mensagens seguintes, incluindo `"tem quantas 160 no momento?"` (pergunta de estoque, sem relação com preço), ficaram sem resposta. Como "tem desconto?" é das perguntas mais comuns do funil, **o caminho mais frequente leva o lead ao vácuo**, justamente no momento mais quente. Solução: a IA suspende apenas o tópico que disparou o guardrail (preço/negociação) e continua respondendo o resto. **Esforço alto** — exige estado novo além do `handoff_to` binário, guardrail condicional a tópico, classificador determinístico rodando antes da LLM (não pode ser a LLM decidindo, seria circular) e ação de retorno escopada por tópico. **Atenuante:** o classificador já existe em embrião — `detectSignals` (`lib/lead-scoring.ts:80-105`) já casa palavra-chave determinística e é o que dispara a coleta de financiamento/troca. Adicionar termos de preço ("desconto", "abaixa", "melhor preço") é extensão, não invenção. | 1.9 | G |

### Notas técnicas da Fase 1

- **Campo `publicado`** por veículo é pré-requisito de 1.4 — o dealer precisa poder ter carro no estoque interno sem expor no site.
- **Slug único por loja** (`bellocar`) — campo novo em `stores`.
- **Um domínio só** para o Vex, com wildcard DNS `*.dominio` apontando para a Vercel. Domínio próprio do cliente fica para a Fase 3.
- **Não existe "sincronizar" estoque com o site** — é a mesma tabela. Sem cópia, sem job de sincronia.
- **O mascote qualifica, não precifica.** Ele coleta e agenda call; quem fecha o número é humano. Isso não é cautela arbitrária — é o mesmo princípio de design que o projeto já aplica no financiamento (`CLAUDE.md`: a IA "nunca calcula taxas nem avalia veículo — só coleta"). Orçamento automático só depois do modelo de preço validado com clientes reais.
- **A detecção por palavra-chave já é melhor que o menu do concorrente.** `detectSignals` (`lib/lead-scoring.ts:80-105`) casa frases fixas contra o texto ("financiamento", "parcela", "troca"+"moto") e `detectCollection` (`lib/guardrails.ts:58-81`) roteia a coleta a partir disso. O cliente fala naturalmente e o sistema entende — o menu serve mais para orientar quem não sabe o que pedir do que para suprir limitação técnica.
- **Honestidade no pitch de RENAVE:** o VEX Auto organiza, valida e cobra. Não registra no RENAVE (isso exige integradora homologada). E o SERPRO deixa claro que a entrada só se conclui com protocolo físico no DETRAN, o que ainda não é automatizável. **Não vender como "RENAVE integrado".**

---

## FASE 2 — Fechar o gap da demo

| # | Item | Por quê | Depende de | Esforço |
|---|------|---------|------------|---------|
| 2.1 | **Tabela FIPE** | É o vocabulário do setor. Comparar preço de compra, FIPE e preço de venda. Sem isso o dealer estranha na demo. | Fonte de dado FIPE | M |
| 2.2 | **Descrição de veículo por IA** | Critério de mercado 2026. Barato de construir, alto valor percebido, usa infra que já existe. | Estoque | P |
| 2.3 | **ROI / dashboard real** | `valor_final` é dado morto hoje — `lib/metrics.ts` não usa em lugar nenhum. Sem isso não há faturamento, margem por venda nem CAC. **É o que destrava o pitch de tráfego pago.** | — | M |
| 2.4 | **Origem do lead (atribuição)** | Sem isso, não dá para provar que o anúncio virou venda. | 2.3 | P |
| 2.5 | **Alerta de veículo parado (aging)** | Dinheiro parado é a dor nº 1 do lojista. Estoque, custo e margem já existem no banco. | — | P |
| 2.6 | **IA sugere qual carro oferecer ao lead** | Exige ter perfil do lead (pipeline WhatsApp) **e** estoque na mesma base. Nenhum concorrente entrega bem. Mais defensável que RENAVE ou site, que qualquer um copia. | Estoque + CRM | M |
| 2.7 | **Resumo diário no WhatsApp do dono** | Retenção: o dono vê valor todo dia sem precisar abrir o sistema. | Métricas | P |
| 2.8 | **Import de estoque via CSV** | Dealer chega com 40 carros. Hoje digita tudo na mão. Fricção de onboarding. | — | P |
| 2.9 | **Recebimento e transcrição de áudio no WhatsApp** (BL-0004) | Cliente final manda muito áudio. Hoje o webhook descarta silenciosamente tudo que não é `msg.type === "text"` (`route.ts:150`) — o lead simplesmente some. Infra nova: exige escolher provedor de STT, custo por minuto e latência. | 0.1 | M |
| 2.10 | **Recebimento de imagem no WhatsApp** (BL-0003) | Mesmo descarte silencioso da 2.9. Cliente manda foto do carro de troca e nada acontece. | 0.1 | M |
| 2.11 | **Menu de intenção na entrada** | Opções explícitas no primeiro contato (Comprar / Vender / Trocar / Financiar / Catálogo), como fazem os concorrentes. **Ressalva:** menu com botões nativos são *interactive messages* — o webhook só processa `type === "text"`, então depende de resolver o parsing de mensagem não-texto (mesma raiz de 2.9/2.10). Menu por número digitado funciona sem isso, mas é mais tosco. Encaixa sem reescrita: `runGuardrails` já roteia por `mode` e injeta seções condicionais. | 2.9 ou 2.10 | M |
| 2.12 | **Reprocessar mensagens não respondidas ao devolver para IA** (BL-0010) | `returnConversationToAI` (`lib/actions.ts:51-76`) só muda estado no banco — nunca dispara `runAiPipeline`. O único gatilho do pipeline é o webhook. Resultado: mensagens recebidas durante o handoff ficam salvas mas nunca respondidas, e devolver para a IA não as reprocessa. Desenho aprovado: concatenar as pendentes num disparo só (evita o problema de ordem do BL-0008), **threshold de 30 minutos** — acima disso não dispara automático, só marca pendência —, e prompt reconhecendo o tempo decorrido dentro da janela. **DESBLOQUEADO (2026-07-28):** 0.9 (UI de resposta manual, `0f65d99`) concluído — pré-requisito satisfeito, pronto pra ser pego. | 0.9 (concluído) | M |

---

## FASE 3 — Escala (só com receita recorrente)

| # | Item | Nota | Esforço |
|---|------|------|---------|
| 3.1 | **Cofre de credenciais por tenant** | Tabela `integration_credentials` (store_id, provider, credential jsonb encriptado). Serve WhatsApp e RENAVE com o mesmo shape. **Atenção:** `whatsapp_phone_number_id` é ID público e pode ser TEXT plano; token e app secret são segredo e exigem encriptação em repouso. | M |
| 3.2 | **Migração do BM para CNPJ próprio** | Via "Atribuir parceiro" na tela do WABA. Código: troca de 3 env vars + redeploy. Ver DL-0003. | P |
| 3.3 | **WhatsApp Embedded Signup** (BL-0001) | Onboarding self-serve de WhatsApp. Exige ser Tech Provider verificado na Meta → exige SLU. | M |
| 3.4 | **Integração com portais** (OLX, Webmotors, iCarros, Mercado Livre) | Item mais pedido **e** mais caro de manter — cada portal quebra sozinho. Não entrar antes de ter receita recorrente. | G |
| 3.5 | **RENAVE com API (via integradora)** | RenaveFácil, RenaveAuto ou Ponto Software. Quando o volume justificar o contrato. Os dados do módulo 1.1 viram poder de negociação. | M |
| 3.6 | **Domínio próprio do cliente** | Cliente compra o dele, aponta CNAME para a Vercel. API da Vercel automatiza o registro. | P |
| 3.7 | **Pagamento recorrente + contrato** | Gateway (Asaas / Stripe / Pagar.me) exige CNPJ. Termos de Uso como contrato de adesão. Primeiros clientes: cobrança manual. | M |
| 3.8 | **Kanban drag-and-drop** | Existe como select dropdown hoje. Cosmético. | P |
| 3.9 | **Exportação de dados do cliente** | Fator de confiança em B2B — dealer quer saber que não fica refém. | P |
| 3.10 | **Comissão de vendedor** | Auto Adm tem. | M |
| 3.11 | **Contrato + assinatura eletrônica** | Simples Veículo e Boom têm. | M |

---

## Adiado sem culpa

| Item | Motivo |
|------|--------|
| **Emissor de NF-e** | Compliance fiscal, não feature de software. Se um dia precisar, usar provedor via API — nunca construir do zero. Confirmado que dá para fazer RENAVE sem NF-e (o dealer cola a chave da nota). |
| **App mobile** | Web responsivo cobre. |
| **Publicação automática no Instagram** | Nice-to-have. |
| **Gestão financeira completa** | Escopo de ERP. |
| **Vistoria com checklist** | Nice-to-have. |
| **Simulação de financiamento (PMT)** | Já foi construída e removida deliberadamente (commit `e61a7cf`). Decisão vigente: a IA coleta dados, nunca calcula taxa nem promete aprovação. Tabela `financing_simulations` segue órfã no schema. |
| **Consulta Cautelar** | Custo confirmado baixo (R$ 0,30–0,60 por consulta via Infosimples e similares), viável tecnicamente — mas não urgente. Margem excelente quando entrar. |
| **Consulta de CPF / restrição** | Se entrar: disparo **manual** pelo vendedor, com consentimento registrado, usando a versão binária (mais barata). A IA não simula parcela nem promete aprovação. Risco de LGPD é maior que o risco de score. |
| **Fatiar em subprodutos (Vex IA, Vex Follow-up, Vex Cautelar) com bundle promocional** | Três problemas: (a) os módulos **não são separáveis** — follow-up e reativação rodam sobre o mesmo pipeline de IA, vender um sem o outro é ficção; (b) obriga a definir estrutura de planos e preço agora, o que já foi adiado até existir cliente pagante; (c) contradiz o posicionamento de "núcleo operacional único". Bundle é técnica de quem tem produtos maduros e quer subir ticket. Com um produto e zero clientes, preço único é mais fácil de explicar e mais rápido de fechar. **Revisitar quando houver dado real de uso.** |
| **Curso de tráfego pago / cross-sell de tráfego** | Só faz sentido depois do item 2.3 (ROI real). Sem dado de venda fechada, o diferencial não existe e vira commodity. |
| **Virar integradora RENAVE homologada** | Credenciamento é gratuito mas é **por estado** (em SP, portaria no Diário Oficial), exige CNAE de TI e certidões. Projeto de meses. Só quando o volume justificar cortar o intermediário. |

---

## Dívida técnica conhecida

| Item | Status | Referência |
|------|--------|------------|
| RBAC zero | Fase 0.3 | — |
| Handoff binário — guardrail de preço mata a conversa inteira | Fase 1.11 | BL-0011 |
| `returnConversationToAI` não dispara o pipeline | Fase 2.12 | `lib/actions.ts:51-76` |
| Handoff zera `assigned_to` — lead sem dono, invisível nas métricas | Fase 1.9 | `lib/actions.ts:36-39` |
| Distribuição de leads 100% manual | Fase 1.10 | `lib/actions.ts:186-215` |
| Webhook descarta tudo que não é texto, em silêncio | Fase 2.9 / 2.10 | `route.ts:150` |
| Número de sistema da Meta (`+16465894168`) cria lead | Backlog, prioridade baixa | `route.ts:160` |
| Sem usuário vinculado à Speed Motos até 27/07 — todos apontavam para a loja demo | Resolvido | `public.users` |
| `WHATSAPP_ACCESS_TOKEN` global | Fase 3.1 / 3.2 | DL-0003, `CLAUDE.md` |
| App e BM hospedados no CNPJ da CMOV | Fase 3.2 | DL-0003 |
| Follow-up/reativação com texto livre | Fase 0.2 | KI B006 |
| WhatsApp em sandbox | Fase 0.1 | — |
| ROI / `valor_final` como dado morto | Fase 2.3 | — |
| Tabela `financing_simulations` órfã | Limpar quando conveniente | commit `e61a7cf` |
| Branch `feat/onboarding-wizard` abandonada | Fase 1.6 | — |
| Branches remotas nunca limpas | Auditoria antes da v-final | — |
| `package.json` versão `0.0.2.0` (não-semver) | Cosmético | — |

---

## Regra de processo em vigor

Qualquer exceção consciente à ordem de prioridade do `27_PROJECT_STATUS.md` — por exemplo, construir feature nova antes da validação de produção terminar — **exige entrada em `29_DECISIONS_LOG.md` no mesmo PR/commit que implementa a exceção**, não depois. Sem entrada, a mudança não deveria ser mergeada.

Origem: o commit `147f1ef` (coleta de financiamento/troca) furou a prioridade sem deixar trilha de aprovação. Registrado retroativamente em DL-0001.

---

## Decisões registradas

| ID | Decisão |
|----|---------|
| **DL-0001** | Exceção retroativa à pausa de features para a coleta de financiamento/troca (`147f1ef`), motivada por demanda real de cliente. |
| **DL-0002** | Hierarquia documental: `27_PROJECT_STATUS.md` decide o que pode ser tocado hoje; `CLAUDE.md` é visão de produto de longo prazo; `28_BACKLOG.md` é portfólio de itens futuros. CNPJ próprio pendente, linkado a BL-0001. |
| **DL-0003** | Infraestrutura Meta (app, System User, token) mantida no BM da Speed Motos durante o piloto. Dívida consciente, blast radius = 1, plano de saída via "Atribuir parceiro". |

---

## Posicionamento — decisão fechada (B+)

**Fechado em 28/07/2026** — ver `DL-0007` em `29_DECISIONS_LOG.md`, motivado por inteligência competitiva da reunião AEG Media/Venda.IA + análise da página pública de serviços deles. Este roadmap opera como **(B+)**: camada de inteligência operacional que o lojista opera plugada no sistema de gestão que ele já tem, mais RENAVE (janela de mercado) e site da loja — sem terceirizar o funil de marketing nem competir por distribuição de mídia paga, sem virar ERP.

Contexto histórico da decisão — o VEX Auto não cobre a mesa mínima do mercado (portais, NF-e, FIPE, RENAVE com API, financeiro, contratos, vistoria, app). Duas estratégias estavam em aberto, e elas mudavam o valor de metade deste roadmap:

**(A) Cobrir a mesa mínima** e competir de frente com Revenda Mais (+5.000 lojas) e Autoconf, sendo "igual a eles com IA melhor". Caro, demorado, e entra num jogo onde eles têm anos de vantagem. **Rejeitado.**

**(B) Camada de inteligência comercial** que pluga em cima do sistema de gestão que o dealer já tem. Ele mantém o Revenda Mais para RENAVE/NF-e/portais e usa o VEX para o que ele faz melhor: IA no WhatsApp, qualificação, follow-up, reativação de base morta. Ticket menor, venda muito mais rápida — não exige troca de sistema, que é a maior barreira de adoção em B2B. **Escolhido, como (B+).**

Razão da escolha: a AEG Media é agência de growth/aquisição full-service (tráfego pago, landing pages, implementação de CRM de terceiros, social media, chatbot, consultoria comercial) — opera COMO SERVIÇO, não entrega software que o lojista opera. O CRM que oferecem é implementação de ferramenta de terceiro, não produto proprietário. **RENAVE e site próprio da loja são DIFERENCIAÇÃO contra a AEG, não só requisito de mercado** — a AEG comprovadamente não entrega nenhum dos dois. A diferenciação do VEX não se apoia na IA de atendimento isolada (a AEG também vende, avulsa) — se apoia no conjunto operacional integrado. Risco de GTM/distribuição da AEG não é mitigado por essa decisão — ver `27_PROJECT_STATUS.md`, CURRENT KNOWN RISKS.

A mesma feature era obrigatória em (A) e desperdício em (B) — decisão fechada elimina essa ambiguidade daqui pra frente.

**Gatilho de revisão** (mesmo do `DL-0007`): revisar se surgir inteligência competitiva independente (não vinda da própria AEG) sobre a profundidade operacional/CRM deles, ou se a AEG anunciar/expandir a venda da IA avulsa como produto de software autônomo. Não é decisão imutável — é a melhor leitura com os dados de 28/07.

---

## Concorrentes mapeados

| Empresa | Destaques |
|---------|-----------|
| **Revenda Mais** | +5.000 lojas. Estoque, NF-e, integrador (20+ portais), CRM, financeiro, site. Lançou "IA SDR". |
| **Autoconf** | Nasceu dentro de uma loja (BellosCar). Site, portais, CRM, financeiro, contratos, giro e margem por veículo. |
| **Auto Adm** | Integração RENAVE nativa (entrada, saída, transferência entre estabelecimentos), NF-e, comissões. |
| **Simples Veículo** | Integradora oficial RENAVE. Contratos automáticos, assinatura eletrônica, app iOS/Android, publicação no Instagram. |
| **Boom Sistemas** | Foco em financiamento, assinatura digital, CRM com WhatsApp. |
| **ecosys AUTO** | Produz conteúdo educando o mercado sobre critérios de escolha. |
| **DealerSpace / DealerAI, CarChat, G30 IA** | Mapeados anteriormente, sem análise de feature nesta rodada. |
| **AEG Media / Venda.IA** | Agência de growth/aquisição full-service (+700 lojas alegadas, 9+ anos), NÃO plataforma de software. Serviços: tráfego pago, landing pages, implementação de CRM de terceiros, social media, chatbot, consultoria comercial. IA de atendimento vendida também avulsa (~R$800/mês, estimado não confirmado). Parceria de financiamento C6 Bank. Sem RENAVE, sem site próprio da loja, sem estoque integrado. Foco parcial em associações/adesão. Onboarding manual (~15 dias). |
| **Thera Company / THERA.IA** | IA de atendimento WhatsApp+Instagram pura (não CRM, "só pré-atendimento" — palavras da própria call, 29/07/2026). Integra com estoque em tempo real, negociação com piso configurável por loja, atende motos. Volume alegado: clientes com 3mil leads/mês sem gargalo. Pricing real: R$450 implementação + R$850/mês até 600 leads/mês (reajuste contratual acima disso). Contrato flexível (sem fidelidade mínima obrigatória, cancelamento sem multa). Fraquezas confirmadas na call: sem resposta clara sobre tratamento de CPF/dado pessoal ("vai pros atendimentos" — vago), sem resposta sobre comportamento de fallback quando foge do escopo da IA ("não sei dizer"), áudio de IA genérico sem voz própria do cliente. |
| **Azul360 CRM** | CRM omnichannel genérico (WhatsApp+Instagram+Messenger+IA), SEM vertical automotiva — zero estoque, zero FIPE, zero RENAVE, zero site. Não é concorrente direto, é referência de pricing de mercado: R$745–R$2.980/mês (5 a 20 usuários), IA cobrada por quota de resposta (100 a 1000/mês conforme plano). |

**Padrão mínimo declarado pelo mercado em 2026:** IA deixou de ser diferencial e virou critério de seleção — descrição automática de veículo, respostas inteligentes no WhatsApp, sugestão de precificação. Somado a: estoque, CRM, portais, NF-e, site próprio, FIPE, RENAVE e controle de acesso por perfil.

**Pricing benchmark (29/07/2026):** R$850/mês (até 600 leads/mês) é a primeira referência real de mercado pra módulo de IA de atendimento isolado (Thera). Azul360 (CRM genérico, não automotivo) referencia a faixa de CRM omnichannel com IA por quota: R$745–R$2.980/mês. Útil pra quando a Fase 5 (Monetização) definir pricing do VEX — nenhuma decisão de preço tomada aqui, só registro de dado de mercado.

---

## Advertência final

Este roadmap tem mais de 40 itens. O time é uma pessoa.

Fase 0 + Fase 1 já representam vários meses de trabalho solo — e é ali que mora tudo que destrava a primeira venda. **Não olhar para a Fase 2 antes de existir cliente pagando.**
