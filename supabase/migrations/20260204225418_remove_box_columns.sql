-- Remover coluna de metragem por caixa do produto
ALTER TABLE produtos DROP COLUMN IF EXISTS metragem_por_caixa;

-- Remover coluna de quantidade de caixas do orçamento
ALTER TABLE orcamentos DROP COLUMN IF EXISTS quantidade_caixas;
