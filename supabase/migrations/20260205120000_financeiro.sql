-- Migration: Financeiro feature
-- Adds payment fields to orcamentos, creates fechamentos table, adds concluido status

-- 1. Add payment fields to orcamentos
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS forma_pagamento text DEFAULT 'a_vista' CHECK (
    forma_pagamento IN ('a_vista', 'parcelado')
  ),
  ADD COLUMN IF NOT EXISTS numero_parcelas integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS taxa_juros_mensal numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_parcela numeric,
  ADD COLUMN IF NOT EXISTS valor_total_parcelado numeric;

-- 2. Create fechamentos table
CREATE TABLE IF NOT EXISTS fechamentos (
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

-- 3. Enable RLS on fechamentos
ALTER TABLE fechamentos ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policy for fechamentos
CREATE POLICY "user_fechamentos" ON fechamentos
  FOR ALL USING (
    atendimento_id IN (SELECT id FROM atendimentos WHERE user_id = auth.uid())
  );

-- 5. Update status check constraint to include concluido
ALTER TABLE atendimentos DROP CONSTRAINT IF EXISTS atendimentos_status_check;
ALTER TABLE atendimentos ADD CONSTRAINT atendimentos_status_check CHECK (
  status IN ('iniciado','visita_tecnica','medicao','orcamento','aprovado','reprovado','execucao','concluido')
);
