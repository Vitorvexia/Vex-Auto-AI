-- =============================================================================
-- Vex Auto  Migration 017 — stores.whatsapp_phone_number_id
-- =============================================================================
-- Adiciona coluna para armazenar o Phone Number ID da Meta por loja.
--
-- NULL = fallback para env var WHATSAPP_PHONE_NUMBER_ID (single-tenant / MVP).
-- Valor presente = credential per-store (multi-tenant B2).
--
-- Sem NOT NULL constraint: backward compat garantida.
-- Sem criptografia em repouso: aceitável para MVP (IDs públicos da Meta, não tokens).
-- =============================================================================

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT;
