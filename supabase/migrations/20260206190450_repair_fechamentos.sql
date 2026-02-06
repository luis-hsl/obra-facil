-- Repair: ensure fechamentos table exists

-- Drop and recreate to ensure correct structure
DROP TABLE IF EXISTS fechamentos;

CREATE TABLE fechamentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  atendimento_id uuid REFERENCES atendimentos(id) ON DELETE CASCADE NOT NULL UNIQUE,
  valor_recebido numeric NOT NULL,
  custo_distribuidor numeric DEFAULT 0,
  custo_instalador numeric DEFAULT 0,
  custo_extras numeric DEFAULT 0,
  observacoes_extras text,
  lucro_final numeric GENERATED ALWAYS AS (
    valor_recebido - custo_distribuidor - custo_instalador - custo_extras
  ) STORED,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fechamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_fechamentos" ON fechamentos;
CREATE POLICY "user_fechamentos" ON fechamentos
  FOR ALL USING (
    atendimento_id IN (SELECT id FROM atendimentos WHERE user_id = auth.uid())
  );
