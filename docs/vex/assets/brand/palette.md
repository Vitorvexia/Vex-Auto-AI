# VEX Auto — Palette (extraído dos assets reais)

<!-- impeccable:palette-source 1 -->

Valores extraídos por amostragem de pixel direta em `LOGO.png`, `FAVICON.png`, `MASCOTE.png` (1254×1254 cada, grid stride 2-3px, canal alpha ≥200 pra ignorar transparência). Não são estimativa visual — são o hex real presente nos arquivos hoje.

## Cores base

| Token | Hex | Onde aparece | Nota |
|---|---|---|---|
| `--vex-black` | `#000000` | fundo circular de LOGO/FAVICON/MASCOTE | fundo tem vinheta radial sutilíssima (até `#00020A` nos cantos) — visualmente indistinguível de preto puro, tratar como `#000000` flat |
| `--vex-white` | `#FFFFFF` | wordmark, favicon "V", pelagem da raposa | amostra bruta cai em `#FEFEFE`/`#FDFDFD` por antialiasing de borda — valor pretendido é branco puro |

## Azul — decidido

Dois valores medidos, um só é oficial:

| Token | Hex | Status | Onde aparece |
|---|---|---|---|
| `--vex-blue` | `#005BFE` | **canônico** — usar em qualquer UI de sistema daqui pra frente (botão, link, acento, estado ativo) | bandeira quadriculada do LOGO.png/FAVICON.png. Amostra estável: `#005AFD`–`#005CFE` |
| `--vex-blue-legacy-mascote` | `#0029A7` | legado, model sheet v1 — aprovado visualmente, **não** é token oficial | olhos/orelha/facetas das 4 poses já aprovadas em MASCOTE.png. Amostra estável: `#012697`–`#0029A7` |

Regra: não regenerar as 4 poses já aprovadas por causa disso — ficam como estão, com o azul legado. Qualquer pose/gesto **novo** da raposa (daqui em diante) usa `#005BFE`, pra não deixar a deriva de azul se acumular entre gerações do asset.

## Uso

```css
:root {
  --vex-black: #000000;
  --vex-white: #FFFFFF;
  --vex-blue: #005BFE;
  --vex-blue-legacy-mascote: #0029A7; /* só referência às 4 poses aprovadas v1, não usar em novo trabalho */
}
```

## Regra de uso da raposa (não é cor, mas é contexto de aplicação)

Mascote aparece **só** em Instagram e landing page (marketing/aquisição). Nunca dentro do sistema logado — lá o identificador visual é o favicon "V" (`FAVICON.png`), não a raposa.

## Fontes

`LOGO.png`, `FAVICON.png`, `MASCOTE.png` em `docs/vex/assets/brand/`. Sampling script: PowerShell `System.Drawing.Bitmap.GetPixel`, grid stride 2-3px, histograma de frequência por hex exato, top-N por contagem.
