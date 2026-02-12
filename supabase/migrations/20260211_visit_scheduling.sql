ALTER TABLE atendimentos
  ADD COLUMN IF NOT EXISTS data_visita timestamptz,
  ADD COLUMN IF NOT EXISTS observacoes_visita text;

CREATE INDEX IF NOT EXISTS idx_atendimentos_data_visita
  ON atendimentos(data_visita) WHERE data_visita IS NOT NULL;
