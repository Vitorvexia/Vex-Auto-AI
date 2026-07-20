# PROJECT_BRAIN.md

> **Cérebro Executivo do VEX Auto**
>
> Este é o documento mais importante do projeto.
>
> Seu objetivo é preservar o conhecimento estratégico do VEX Auto, permitindo que qualquer IA ou novo integrante compreenda rapidamente o projeto sem precisar ler dezenas de documentos.
>
> **Este documento NÃO substitui a documentação técnica.**
>
> A documentação técnica explica **como** o sistema funciona.
>
> O PROJECT_BRAIN explica **por que** ele existe, **onde está**, **para onde vai** e **como decisões devem ser tomadas**.

---

# Missão

Construir o Sistema Operacional Comercial mais inteligente do mercado automotivo.

O objetivo do VEX Auto não é ser apenas um CRM.

O objetivo é assumir progressivamente parte da operação comercial de concessionárias e lojas de veículos através de Inteligência Artificial, automação e conhecimento acumulado.

---

# Visão

Toda decisão do projeto deve aproximar o VEX Auto deste cenário:

```
Hoje

Loja
 ↓
Vendedor
 ↓
WhatsApp
 ↓
Cliente

↓

Futuro

Cliente
      ↓
VEX AI
      ↓
Contexto
      ↓
Decisão
      ↓
Automação
      ↓
Vendedor (quando necessário)
```

A IA não existe apenas para responder mensagens.

Ela existe para compreender, decidir, recomendar e executar.

---

# Estado Atual

## Fase

MVP Operacional

A arquitetura principal está consolidada.

O foco atual não é criar novas funcionalidades.

O foco é validar toda a operação em ambiente real.

---

## Situação Atual

Grande parte do desenvolvimento estrutural já foi concluída.

O projeto entrou na fase de:

- Hardening
- Confiabilidade
- Segurança
- Observabilidade
- Validação operacional

O maior risco deixou de ser desenvolvimento.

O maior risco passou a ser infraestrutura e operação.

---

## Bloqueadores atuais

Prioridade máxima:

- Configuração correta da Meta Cloud API
- Phone Number ID definitivo
- Token permanente
- CRON_SECRET
- Teste ponta a ponta

Após resolver esses itens, o MVP poderá ser validado em produção.

---

# O que já está consolidado

## Produto

- Multi-tenant
- Gestão de Leads
- Conversas
- IA integrada
- Follow-up
- Reativação
- Equipe
- Administração
- Analytics operacional
- Estoque
- Guardrail econômico
- Integração WhatsApp

---

## Engenharia

O projeto possui arquitetura consolidada baseada em:

- Server Actions
- RSC-first
- Validação server-side
- Soft Delete
- Multi-tenant
- Sanitização centralizada de PII
- Queries limitadas
- Hardening progressivo

---

# Grandes Decisões Permanentes

## O produto NÃO será um CRM

O VEX deve evoluir para um Sistema Operacional Comercial.

---

## Inteligência é o diferencial

Nunca competir por:

- telas
- dashboards
- quantidade de funcionalidades

Competir por:

- contexto
- memória
- inteligência
- automação
- receita gerada

---

## Dados estruturados sempre vencem histórico

Sempre que possível:

persistir conhecimento.

Nunca depender exclusivamente da leitura de mensagens.

---

## IA não responde apenas

A IA deve evoluir continuamente:

Responder

↓

Compreender

↓

Memorizar

↓

Priorizar

↓

Recomendar

↓

Executar

↓

Otimizar Receita

---

## Guardrails sempre em múltiplas camadas

Prompt

↓

Servidor

↓

Banco

Nunca confiar apenas na IA.

---

## Toda feature precisa gerar impacto econômico

Pergunta obrigatória:

"Esta funcionalidade aumenta receita, reduz custo ou melhora conversão?"

Se não, sua prioridade é baixa.

---

# Filosofia do Produto

## Inteligência antes de Interface

O diferencial nunca será design.

Será conhecimento acumulado.

---

## Contexto é patrimônio

O maior ativo do VEX não será o modelo de IA.

Modelos mudam.

Contexto permanece.

---

## Receita é a principal métrica

O sucesso do produto deve ser medido pelo impacto financeiro gerado aos clientes.

---

## Segurança acima da conveniência

Nenhuma regra crítica deve depender apenas da interface.

Toda validação importante acontece no servidor.

---

# Roadmap Oficial

## Fase 1

Finalizar MVP.

---

## Fase 2

Validar operação real.

---

## Fase 3

Revenue Foundation

- ROI
- Margem
- Ticket Médio
- Receita

---

## Fase 4

Lead Intelligence

- Lead Memory
- Lead Summary
- Contexto Persistente

---

## Fase 5

Inbox Comercial

---

## Fase 6

IA Comercial

---

## Fase 7

Revenue Optimization

---

## Fase 8

Data Moat

- Context Graph
- Opportunity Engine
- Aprendizado Operacional

---

# Estado do MVP

| Área | Status |
|-------|--------|
| Multi-tenant | ✅ |
| Leads | ✅ |
| Conversas | ✅ |
| IA | ✅ |
| Follow-up | ✅ |
| Reativação | ✅ |
| Estoque | ✅ |
| Analytics | ✅ |
| Equipe | ✅ |
| Administração | ✅ |
| Guardrail Econômico | ✅ |
| WhatsApp Cloud API | ⚠ Configuração |
| Revenue Engine | ⏳ |
| Lead Memory | ⏳ |
| Opportunity Engine | ⏳ |

---

# Próxima Grande Meta

Executar o primeiro teste ponta a ponta em uma loja real.

Fluxo esperado:

WhatsApp

↓

IA

↓

Resposta

↓

Follow-up

↓

Negociação

↓

Venda

↓

Analytics

Sem esse teste o MVP não pode ser considerado validado.

---

# O que nunca fazer

- Adicionar funcionalidades antes de validar o MVP.
- Criar telas sem necessidade.
- Duplicar conhecimento.
- Quebrar a arquitetura por conveniência.
- Depender apenas do Prompt.
- Aumentar contexto do LLM sem necessidade.
- Criar lógica de negócio apenas no frontend.
- Ignorar impacto econômico das funcionalidades.
- Tratar o VEX como um CRM tradicional.

---

# Critérios para considerar o MVP concluído

- WhatsApp Cloud API funcionando.
- IA respondendo corretamente.
- Follow-up automático funcionando.
- Fluxo completo de venda validado.
- Analytics registrando corretamente.
- Guardrails econômicos funcionando.
- Operação realizada em ambiente real.
- Primeiro cliente utilizando o sistema.

---

# Visão de Longo Prazo

O VEX deve evoluir para uma plataforma capaz de operar parte significativa da empresa.

No futuro, a IA deverá:

- conhecer todos os leads;
- entender todos os vendedores;
- aprender padrões de conversão;
- prever oportunidades;
- recomendar ações;
- proteger margem;
- otimizar receita;
- operar campanhas;
- aprender continuamente com a operação.

O maior diferencial competitivo do VEX não será o modelo de IA utilizado.

Será o conhecimento operacional acumulado ao longo dos anos, formando um verdadeiro **Data Moat**, extremamente difícil de ser replicado.

---

# Como utilizar este documento

Sempre que iniciar uma nova tarefa:

1. Leia primeiro o `PROJECT_BRAIN.md`.
2. Entenda o estado atual do projeto.
3. Consulte o `CLAUDE.md` para seguir os padrões de engenharia.
4. Utilize os documentos técnicos apenas para aprofundar detalhes específicos.
5. Nunca proponha soluções que contrariem as decisões permanentes registradas neste documento.

Este arquivo deve permanecer pequeno, estratégico e constantemente atualizado. Ele representa a fonte oficial de contexto do VEX Auto.