CREATE TABLE financing_simulations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL REFERENCES stores(id),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  vehicle_price   numeric(12,2) NOT NULL CHECK (vehicle_price > 0),
  entry_value     numeric(12,2) NOT NULL DEFAULT 0 CHECK (entry_value >= 0),
  financed_amount numeric(12,2) NOT NULL,
  term_months     int NOT NULL CHECK (term_months BETWEEN 12 AND 72),
  monthly_rate    numeric(6,4) NOT NULL,
  monthly_payment numeric(12,2) NOT NULL,
  total_amount    numeric(12,2) NOT NULL,
  provider        text NOT NULL DEFAULT 'internal',
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE financing_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financing_simulations_store_isolation"
  ON financing_simulations
  USING (store_id = my_store_id());

CREATE INDEX idx_financing_sims_store    ON financing_simulations(store_id);
CREATE INDEX idx_financing_sims_lead     ON financing_simulations(lead_id, created_at DESC);
CREATE INDEX idx_financing_sims_conv     ON financing_simulations(conversation_id, created_at DESC);
