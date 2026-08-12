---
name: VEX Auto
description: Infraestrutura operacional AI-First pro mercado automotivo — trilho onde a economia da loja passa
colors:
  vex-blue: "#005BFE"
  vex-black: "#000000"
  vex-white: "#FFFFFF"
  navy-dark: "#1C2B3A"
  bg: "#F5FAFC"
  panel: "#FFFFFF"
  panel-2: "#F0F7FC"
  border: "#DDE8F0"
  border-strong: "#B8CEDE"
  text: "#334155"
  text-strong: "#1C2B3A"
  muted: "#64748B"
typography:
  display:
    fontFamily: "Bebas Neue, sans-serif"
    fontSize: "clamp(1.25rem, 2.5vw, 2rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "0.06em"
    fontFeature: "uppercase only"
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  kpi-legacy:
    fontFamily: "Exo 2, system-ui, sans-serif"
    fontWeight: 800
    fontStyle: "italic"
rounded:
  sm: "4px"
  md: "8px"
  lg: "10px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "14px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.vex-blue}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "9px 18px"
  button-primary-hover:
    backgroundColor: "{colors.vex-blue}"
    textColor: "#FFFFFF"
---

# Design System: VEX Auto

## Overview

**Creative North Star: "Motorsport Telemetry, Working Shift"**

VEX Auto tem duas camadas visuais que não se confundem. A camada de **marca** (logo, favicon, mascote, marketing, Instagram, landing) é motorsport puro: fundo preto quase absoluto, wordmark itálico condensado, bandeira quadriculada como motivo estrutural, raposa geométrica low-poly como mascote de aquisição. A camada de **produto** (app logado — leads, kanban, conversas, dashboards) é uma superfície de trabalho clara e testada em produção real (Speed Motos), que herda da marca só o essencial: o azul de acento e, pontualmente, a tipografia de destaque em títulos de página. As duas camadas não tentam virar uma coisa só — misturar fundo preto motorsport com uma tela onde vendedor lê 40 leads por dia seria estética vencendo tarefa, e isso é exatamente o que o Operate mode proíbe.

Essa distinção **não é provisória** — é a decisão de escopo confirmada nesta sessão: a marca fica inteira (preto/branco/azul/Bebas Neue/raposa) só em superfícies de aquisição; o produto evolui de forma cirúrgica (troca de accent, tipografia de título), preservando tudo que já funciona.

**Key Characteristics:**
- Marca: preto quase-absoluto, wordmark itálico motorsport, bandeira quadriculada, raposa low-poly restrita a marketing
- Produto: fundo claro, painéis brancos, cards com sombra ambiente suave — inalterado nesta rodada
- Um único azul de sistema (`#005BFE`) atravessa as duas camadas como fio condutor de marca
- Bebas Neue entra no produto só em título de página/seção — nunca em KPI, preço, parágrafo ou botão pequeno
- Cores de status (kanban/pill) são sinalização funcional, independentes da identidade de marca

## Colors

Dois grupos que não se misturam: cores de marca (para logo/favicon/mascote/marketing) e cores de produto (para o app logado). Extraídas por amostragem de pixel real dos assets em `docs/vex/assets/brand/` — ver `palette.md` na mesma pasta pra proveniência completa.

### Primary
- **VEX Blue** (`#005BFE`): acento único de sistema. Canônico — extraído do chevron/bandeira do LOGO.png e FAVICON.png. Substitui o antigo `--accent`/`--sky` (`#0EA5E9`) no app: botão primário, link, estado ativo, barra de gráfico, borda de foco. Uma troca de variável CSS, não retrabalho componente a componente.

### Neutral — Marca (preto/branco, só em superfícies de aquisição)
- **VEX Black** (`#000000`): fundo do logo, favicon, mascote, landing page, Instagram. Nunca aparece no app logado.
- **VEX White** (`#FFFFFF`): wordmark, favicon "V", pelagem da raposa, texto sobre fundo preto.

### Neutral — Produto (app logado, inalterado nesta rodada)
- **Navy Dark** (`#1C2B3A`): fundo do header fixo do app.
- **Background** (`#F5FAFC`): fundo geral das páginas.
- **Panel** (`#FFFFFF`): cards, colunas de kanban, chat, formulários.
- **Panel 2** (`#F0F7FC`): superfície secundária (corpo de coluna kanban, badges neutros).
- **Border** / **Border Strong** (`#DDE8F0` / `#B8CEDE`): divisórias e contornos de card.
- **Text** / **Text Strong** (`#334155` / `#1C2B3A`): corpo de texto e texto de ênfase.
- **Muted** (`#64748B`): metadados, timestamps, labels secundários.

### Cores de status (fora do escopo de marca — não tocar)
7 cores funcionais no funil (`--status-novo` `#94A3B8`, `--status-engajado` `#0EA5E9`, `--status-interessado` `#8B5CF6`, `--status-quente` `#F97316`, `--status-negociacao` `#22C55E`, `--status-fechado` `#10B981`, `--status-perdido` `#EF4444`) e as 3 cores de bolha de chat (lead/IA/humano). São sinalização de estado do funil, não identidade — `--status-engajado` coincide hoje com o azul antigo do accent por acaso de paleta, não por vínculo de marca; a troca de accent não deve arrastar esse valor junto sem decisão própria.

### Legado — não usar em trabalho novo
- **Blue Mascote Legado** (`#0029A7`): azul mais escuro/saturado presente nos olhos/orelha/facetas das 4 poses já aprovadas do model sheet da raposa (`MASCOTE.png`). Aprovado visualmente, mas não é token — não regenerar as poses existentes por causa disso; qualquer pose/gesto novo da raposa usa `#005BFE`.

### Named Rules
**The One Blue Rule.** Existe um azul de sistema (`#005BFE`). Qualquer novo componente, marca ou produto, que precisar de azul usa esse — nunca inventa um tom próximo.

## Typography

**Display Font:** Bebas Neue (uppercase only, sem fallback de peso — só existe um)
**Body Font:** Inter (400/500/600)
**Legacy Font:** Exo 2 italic 700/800 — segue viva em KPI/preço do app, ver regra abaixo

**Character:** Bebas Neue é grito de pista — condensada, maiúscula, peso único e pesado, feita pra ser lida uma vez e marcar território (nome de página, headline de marketing). Inter é a voz de trabalho — neutra, legível em qualquer tamanho, carrega tudo que se lê repetidamente. As duas nunca disputam o mesmo elemento.

### Hierarchy
- **Display** (Bebas Neue, `clamp(1.25rem, 2.5vw, 2rem)`, uppercase, line-height 1.05): headline de marketing/landing/Instagram; dentro do app, **só** título de página/seção (ex: "Leads", "Configurações", cabeçalho de card) — lido uma vez, baixo risco.
- **Body** (Inter 400/500/600, 14px, line-height 1.5): parágrafo, formulário, menu, tabela — tudo o resto, marca e produto.
- **KPI/Preço legado** (Exo 2 italic 800, ver `.kpi-value`/`.vehicle-price`/`.onboarding-title` em `globals.css`): número lido repetidamente e rápido — **não migra para Bebas Neue nesta rodada**. Pendente de validação de legibilidade antes de trocar algo já testado em produção com peso único pesado.

### Named Rules
**The One Read Rule.** Bebas Neue é pra texto lido uma vez (título). Se o texto é lido várias vezes ao dia em velocidade (KPI, preço, tabela), não é Bebas Neue — é Inter ou o Exo2 legado, nunca a fonte de impacto.

## Layout

Container padrão 1400px max-width, padding 24px lateral. Kanban em colunas flex de 216px com scroll horizontal. Grids responsivos com `auto-fill`/`minmax` pra cards (veículo, equipe, métricas) — colapsam pra 1-2 colunas abaixo de ~900-960px. Densidade alta: fonte de corpo 13-14px, espaçamento de componente em torno de 8-16px. Este layout é do produto e não muda nesta rodada — nenhuma decisão de marca o afeta.

## Elevation & Depth

Duas filosofias distintas, cada uma correta no seu contexto — não convergem numa regra só:

- **Marca**: **flat absoluto**. Sem cromado, gradiente ou bisel 3D no logo/favicon/mascote — decisão explícita do usuário, não omissão.
- **Produto**: sombra ambiente suave e consistente (`box-shadow: 0 1px 3px rgba(28,43,58,.06)` em cards/painéis, escalando pra `0 2px 8px` em hover). Não é decorativa — é o sinal visual de "isto é clicável/hoverável" numa superfície densa de trabalho. Inalterada.

### Named Rules
**The Flat Brand, Soft Product Rule.** Marca nunca tem sombra ou gradiente. Produto sempre tem sombra ambiente sutil em superfícies interativas. Nunca aplicar a regra de um lado no outro.

## Shapes

- **Marca**: geometria angular — losangos/paralelogramos da bandeira quadriculada, itálico como inclinação estrutural (logo, favicon, corte de orelha do mascote). Crop circular no avatar do logo/favicon.
- **Produto**: cantos suaves consistentes — 4px (controles pequenos: badge, input), 8px (botão, lead card), 10px (painel, KPI card, modal). Pills totalmente arredondadas (`999px`) pra status/badge. Sem geometria angular no produto — isso é assinatura exclusiva de marca.

## Components

### Buttons (produto)
- **Shape:** radius 6-7px
- **Primary:** fundo `{colors.vex-blue}` (`#005BFE`, era `#0EA5E9`), texto branco, padding `9px 18px`
- **Hover:** opacidade 0.82-0.88
- **Ghost/ícone:** fundo transparente, hover com leve tint de `rgba(255,255,255,.08)` (header) ou `var(--panel-2)`

### Cards / Containers (produto)
- **Corner:** 8-10px
- **Background:** `var(--panel)` (branco), corpo secundário `var(--panel-2)`
- **Shadow:** ambiente suave, ver Elevation
- **Border:** 1px `var(--border)`, hover troca pra `var(--vex-blue)` em cards clicáveis (lead card, vehicle card, conv row)

### Status Pill (produto — funcional, não-marca)
7 variantes de cor por `data-status`/`data-conv-status`/`data-handoff`, fundo tint 10% + borda tint 25-35% + texto na cor sólida. Ver seção Colors — nunca herda troca de accent de marca.

### Header (produto)
Fundo `var(--navy-dark)` fixo, 56px altura, nav central, avatar/dropdown de usuário à direita. Cor de marca (`#005BFE`) aparece no estado ativo do nav (`rgba(accent,.22)` de fundo) — este é o ponto de maior visibilidade do azul de marca dentro do produto.

### Wordmark / Favicon / Mascote (marca — DL-0017 abriu exceção pro favicon, ver abaixo)
- **Logo:** wordmark "VEX AUTO" itálico condensado, branco flat, bandeira quadriculada pequena acima (branco + `#005BFE`), fundo preto, crop circular. `docs/vex/assets/brand/LOGO.png`.
- **Favicon/in-app:** ~~letra "V" isolada~~ — **atualizado por DL-0017 (2026-08-12, pedido direto do founder):** agora é o rosto da raposa (mascote), geométrico low-poly, cores sólidas sobre fundo transparente. Único elemento de marca dentro do app logado (aba do navegador + logo da sidebar). Fonte: `docs/vex/assets/brand/FAVICONOFICIAL.png` (renomeado de `FAVICON.png` — é a versão definitiva, depois de 2 iterações no mesmo dia). Precisa ser copiado manualmente pra `Public/favicon.png`, que é o arquivo que o app de fato serve.
- **Mascote (raposa):** geométrica low-poly flat, branco/off-white + azul pontual (olhos, orelha, facetas), bandeira quadriculada só na orelha direita, textura de grade automotiva no focinho. 4 poses aprovadas (frontal, perfil, andando, sentada 3/4) em `docs/vex/assets/brand/MASCOTE.png`. Continua fora do app logado **exceto** no favicon/logo da sidebar (DL-0017) — não usar em nenhuma outra superfície de produto (cards, empty states, loading etc.).

## Do's and Don'ts

### Do:
- **Do** usar `#005BFE` como único azul de sistema, marca e produto — qualquer novo componente cita este hex, nunca aproxima.
- **Do** trocar `--accent`/`--sky` no `globals.css` pra `#005BFE` como mudança cirúrgica de 1 variável — todo componente que já usa `var(--accent)` herda automaticamente.
- **Do** usar Bebas Neue em título de página/seção dentro do app (lido uma vez) e full em qualquer peça de marketing/landing/Instagram.
- **Do** manter Exo 2 italic em KPI/preço do app até validação de legibilidade própria — não é decisão adiada por esquecimento, é decisão deliberada desta rodada.
- **Do** manter as 7 cores de status do funil e as 3 cores de bolha de chat exatamente como estão — são sinalização funcional, não superfície de marca.
- **Do** manter a raposa fora do app logado, com a única exceção do favicon/logo da sidebar (DL-0017) — resto do produto (cards, empty states, loading) continua sem mascote, só Instagram/landing pra tudo o mais.

### Don't:
- **Don't** aplicar fundo preto, itálico motorsport ou bandeira quadriculada em qualquer tela do app operacional (leads, kanban, conversas, dashboards) — essa é a camada de marca, não de produto.
- **Don't** usar Bebas Neue em parágrafo, botão pequeno, KPI ou preço — regra herdada de `typography.txt`, sem exceção.
- **Don't** usar `#0029A7` (azul legado da raposa v1) em qualquer trabalho novo — só existe porque já está aprovado nas 4 poses existentes.
- **Don't** mostrar a raposa em qualquer superfície do produto além do favicon/logo da sidebar (DL-0017 é a única exceção aberta, não um precedente geral) — nada de mascote em card, empty state, loading, e-mail transacional etc.
- **Don't** inventar número ou depoimento de resultado pra Speed Motos em nenhuma copy — é piloto técnico validado, não case de sucesso (ver `PRODUCT.md`).
