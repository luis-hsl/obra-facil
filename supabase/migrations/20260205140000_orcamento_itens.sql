-- Migration: Múltiplos produtos por orçamento
-- Cria tabela de itens do orçamento

CREATE TABLE orcamento_itens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id uuid REFERENCES orcamentos(id) ON DELETE CASCADE NOT NULL,
  produto_id uuid REFERENCES produtos(id) ON DELETE SET NULL,
  area_total numeric NOT NULL,
  area_com_perda numeric NOT NULL,
  perda_percentual numeric DEFAULT 10,
  preco_por_m2 numeric NOT NULL,
  valor_total numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orcamento_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_orcamento_itens" ON orcamento_itens
  FOR ALL USING (
    orcamento_id IN (
      SELECT o.id FROM orcamentos o
      JOIN atendimentos a ON o.atendimento_id = a.id
      WHERE a.user_id = auth.uid()
    )
  );

-- Tornar produto_id opcional na tabela orcamentos (agora os produtos ficam nos itens)
ALTER TABLE orcamentos ALTER COLUMN produto_id DROP NOT NULL;
