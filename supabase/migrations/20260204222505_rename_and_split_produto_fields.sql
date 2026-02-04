-- Criar tabela de produtos com campos corretos
CREATE TABLE IF NOT EXISTS produtos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  fabricante text NOT NULL,
  linha text NOT NULL,
  metragem_por_caixa numeric NOT NULL,
  preco_por_m2 numeric NOT NULL,
  perda_padrao numeric NOT NULL DEFAULT 10,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário acessa próprios produtos" ON produtos
  FOR ALL USING (auth.uid() = user_id);

-- Adicionar colunas do calculador de orçamento (se não existirem)
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS produto_id uuid REFERENCES produtos(id);
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS area_total numeric;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS area_com_perda numeric;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS perda_percentual numeric;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS quantidade_caixas integer;

-- Atualizar check de status do orcamentos para incluir 'gerado'
ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS orcamentos_status_check;
ALTER TABLE orcamentos ADD CONSTRAINT orcamentos_status_check
  CHECK (status IN ('gerado', 'enviado', 'aprovado', 'perdido'));
