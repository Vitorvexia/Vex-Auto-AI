-- Migration 033: stores.slug (roadmap 1.3 — rota de leitura pública por subdomínio)
--
-- Identificador amigável de URL por loja (ex: "speedmotos" em
-- speedmotos.vexauto.com.br). Primeiro identificador amigável do projeto —
-- toda rota hoje resolve a loja por UUID (store_id) via sessão autenticada,
-- nunca por nome legível. Confirmado antes de escrever esta migration: grep
-- por "slug" no projeto inteiro só retornava a menção já existente no
-- roadmap (docs/vex/53_ROADMAP.md) — nenhuma convenção equivalente em uso.

CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS slug text;

-- Backfill determinístico a partir de nome: lowercase, sem acento,
-- não-alfanumérico vira hífen, colapsa/trima hífens. Fallback "loja" se não
-- sobrar nenhum caractere alfanumérico (ex: nome só com símbolos/emoji).
-- Colisão resolvida por sufixo numérico sequencial (-2, -3, ...) ordenado por
-- created_at — a loja mais antiga com aquele nome fica com o slug "limpo",
-- nunca reescrita por uma loja criada depois.
WITH base AS (
  SELECT
    id,
    NULLIF(
      regexp_replace(
        regexp_replace(lower(unaccent(nome)), '[^a-z0-9]+', '-', 'g'),
        '(^-+|-+$)', '', 'g'
      ),
      ''
    ) AS base_slug,
    created_at
  FROM public.stores
),
numbered AS (
  SELECT
    id,
    COALESCE(base_slug, 'loja') AS base_slug,
    row_number() OVER (PARTITION BY COALESCE(base_slug, 'loja') ORDER BY created_at) AS rn
  FROM base
)
UPDATE public.stores s
SET slug = numbered.base_slug || CASE WHEN numbered.rn = 1 THEN '' ELSE '-' || numbered.rn::text END
FROM numbered
WHERE s.id = numbered.id;

ALTER TABLE public.stores ALTER COLUMN slug SET NOT NULL;
ALTER TABLE public.stores ADD CONSTRAINT stores_slug_uidx UNIQUE (slug);

-- Formato travado em código, não só por convenção — mesmo padrão de
-- phone_normalized (migration 001): futuras escritas de slug (onboarding,
-- item 1.6) não podem burlar o formato usado pela resolução de subdomínio.
ALTER TABLE public.stores
  ADD CONSTRAINT stores_slug_format_check
  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
