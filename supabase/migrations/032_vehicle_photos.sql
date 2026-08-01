-- Migration 032: upload de foto de veículo (roadmap 1.2)
--
-- vehicles.photo_url: array de URLs públicas, não coluna única — carro tem
-- galeria, não 1 foto. Primeira posição = capa (convenção de aplicação, não
-- imposta pelo schema). Coluna direto em vehicles, mesmo padrão de 1.1
-- (RENAVE) e das colunas de venda (migration 020): estado atual do veículo,
-- sem necessidade de tabela satélite.
ALTER TABLE public.vehicles
  ADD COLUMN photo_url text[] NOT NULL DEFAULT '{}';

-- Bucket PÚBLICO pra leitura — o site da loja (1.4, próximo item) é rota sem
-- sessão e precisa servir a foto sem autenticação. Foto de carro à venda não
-- é dado sensível (mesmo raciocínio de honestidade de escopo do RENAVE: não
-- expor o que exige segredo, mas isso aqui é marketing público por natureza).
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-photos', 'vehicle-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Leitura pública do bucket via RLS de storage.objects (redundante com o
-- endpoint público do Storage quando public=true, mas mantido explícito —
-- mesmo padrão de defesa em profundidade das outras tabelas: RLS nunca fica
-- implícito só na configuração do bucket).
CREATE POLICY "vehicle_photos_public_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'vehicle-photos');

-- Escrita restrita ao store_id do usuário autenticado — path é sempre
-- {store_id}/{vehicle_id}/{filename} (lib/vehicle-photos.ts,
-- buildVehiclePhotoPath), então o primeiro segmento do path precisa bater
-- com a store do usuário. Na prática o upload roda via Server Action com
-- supabaseAdmin (service_role, bypassa RLS — mesmo padrão de todas as
-- outras escritas do projeto, isolamento real garantido por
-- getServerStoreId() no código); esta policy é o backstop de RLS pro caso de
-- qualquer escrita futura fora do Server Action (mesmo princípio de
-- isolamento duplo aplicado às tabelas, CLAUDE.md).
CREATE POLICY "vehicle_photos_own_store_insert"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'vehicle-photos'
    AND (storage.foldername(name))[1] = public.my_store_id()::text
  );
