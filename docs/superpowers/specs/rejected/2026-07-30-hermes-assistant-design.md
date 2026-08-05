> **STATUS: REJEITADO (2026-07-30).** Hermes como agente de relatório/observação (monitoramento tipo Sentry, pesquisa de mercado, cobrança — nunca toca leads/vehicles diretamente, "Hermes relata, humano decide") foi avaliado e descartado. Reconsiderar somente se surgir volume alto de clientes com gargalo real que justifique. Uso legítimo seria como assistente pessoal fora do desenvolvimento do VEX, não como ferramenta de engenharia do projeto.

# Hermes — Assistente Pessoal de Relatórios — Design

Data: 2026-07-30
Status: Rascunho (conceito — implementação condicionada a marcos do roadmap VEX)
Relacionado: `docs/vex/53_ROADMAP.md`, `docs/vex/16_OBSERVABILITY.md`, `docs/vex/29_DECISIONS_LOG.md`

## Contexto

Hermes é agente externo ao VEX Auto, rodando numa VPS própria, com um papel: virar "braço direito" do fundador — consolidar em relatórios diários o que hoje exige checar várias fontes manualmente (Sentry, métricas operacionais, mercado/concorrência).

Não é módulo do produto Vex Auto. Não atende lead, não toca `leads`/`vehicles`/fluxo de venda. É camada de observação e pesquisa, orientada a humano.

Princípio herdado do VEX (mesma filosofia, aplicada ao próprio Hermes): **Hermes relata, humano decide**. Nenhuma ação corretiva automática — nem em erro de sistema, nem em achado de mercado, nem em cobrança. Isso evita duplicar o guardrail de "IA nunca age sozinho em decisão sensível" já valendo pro produto e não valer pra ferramenta interna.

## Escopo — 3 Tracks

### Track 1 — Pesquisa de Mercado (disponível já, sem dependência)

- Nicho: SaaS automotivo, gestão de leads/CRM pro setor
- Conteúdo do relatório: concorrente novo detectado, funcionalidade nova de concorrente conhecido (ex: AEG Media — já mapeado, `29_DECISIONS_LOG.md` DL-0007), tendência de IA aplicável ao setor
- Fonte: busca web (sem acesso a sistemas internos VEX)
- Risco: baixo — zero credencial de produção necessária

### Track 2 — Saúde do Sistema (depende de Sentry ativo — 0.4 do roadmap)

- Não recria detecção de erro — **lê e resume** o que Sentry já captura
- Conteúdo: erros novos desde o último relatório, contagem/urgência, regressão de performance (tempo de resposta IA, latência de webhook)
- Fonte: Sentry API (read-only), métricas operacionais existentes (`calculateOperationalMetrics`)
- Pré-requisito: confirmar Sentry (0.4) realmente instrumentado em prod antes de ligar este track — hoje sem evidência de setup no `CLAUDE.md`

### Track 3 — Cobrança (depende de Stripe — Fase 5, não implementado)

- Conteúdo: falha de cobrança, churn, MRR
- Fonte: Stripe API (read-only)
- Bloqueado até Stripe existir no sistema — sem dado, sem track

## Formato do Relatório

Um relatório diário, horário fixo (a definir pelo usuário), 3 seções fixas independente de quantos tracks estão ativos:

```
📊 Performance/Erros
- [bullet curto por item, com severidade]

📈 Mercado/Novidades
- [bullet curto por achado]

💡 Sugestão
- [1-3 sugestões acionáveis, não implementadas automaticamente]
```

Curto por design — bullets, não relatório extenso. Se não há nada relevante num track, seção diz "sem novidades" em vez de forçar conteúdo.

**Canal de entrega: Telegram (Bot API).** Slack descartado — plano free expira contexto/histórico a cada 90 dias e o caso de uso é relatório 1:1 (Hermes → usuário), não colaboração em thread de equipe; recursos pagos do Slack não agregam aqui. Telegram: grátis, sem expiração, setup via token + chat_id.

**Horário de disparo: 07h, horário de São Paulo (`America/Sao_Paulo`)**, fixo diário.

## Arquitetura

- Hermes roda em VPS separada da infra Vex Auto (Vercel/Supabase) — isolamento físico do runtime
- Cron próprio na VPS dispara o job no horário configurado
- Credenciais: escopo mínimo, nunca a `SUPABASE_SERVICE_ROLE_KEY` do VEX
  - Track 2 usa chave read-only dedicada (Sentry API token com permissão de leitura apenas)
  - Track 3, quando existir, usa chave Stripe restrita (read-only, sem acesso a operações de cobrança)
- Nenhuma credencial de produção do VEX compartilhada com Hermes além do necessário pra leitura do respectivo track

## Riscos

- **Superfície de ataque nova**: VPS 24/7 com credenciais de leitura é alvo. Mitigação: chaves read-only, rotação, nunca reusar `service_role`
- **Falso senso de cobertura**: se Hermes falha silenciosamente (ex: cron não dispara), usuário pode achar que está sendo monitorado quando não está. Mitigação: heartbeat — se relatório não chegar no horário esperado, alertar por canal separado
- **Duplicar fonte de verdade de erro**: Hermes não deve reimplementar alerta de erro — só sumarizar o que Sentry já decidiu ser relevante

## Fases de Ativação

| Track | Pré-requisito | Status |
|-------|---------------|--------|
| 1 — Mercado | Nenhum | Pode começar já |
| 2 — Saúde do sistema | Sentry (0.4) confirmado em prod | Aguardando confirmação |
| 3 — Cobrança | Stripe integrado (Fase 5) | Bloqueado |

## Decisões Abertas (não fechadas ainda)

- Se Track 1 roda já em paralelo ao roadmap atual, ou espera bundle junto dos outros tracks
