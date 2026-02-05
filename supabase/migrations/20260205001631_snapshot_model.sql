-- =============================================
-- MIGRATION: Snapshot Model - Dados do cliente direto no Atendimento
-- Remove tabelas clientes/imoveis, adiciona campos snapshot
-- =============================================

-- 1. Adicionar colunas snapshot ao atendimentos
ALTER TABLE atendimentos
  ADD COLUMN IF NOT EXISTS cliente_nome text,
  ADD COLUMN IF NOT EXISTS cliente_telefone text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text;

-- 2. Backfill dados existentes (se houver)
UPDATE atendimentos a SET
  cliente_nome = c.nome,
  cliente_telefone = COALESCE(c.telefone, '')
FROM clientes c WHERE a.cliente_id = c.id
  AND a.cliente_nome IS NULL;

UPDATE atendimentos a SET
  endereco = COALESCE(i.endereco, '')
FROM imoveis i WHERE a.imovel_id = i.id
  AND a.endereco IS NULL;

-- Preencher registros órfãos (sem cliente/imovel válido)
UPDATE atendimentos SET cliente_nome = 'Sem nome' WHERE cliente_nome IS NULL;
UPDATE atendimentos SET cliente_telefone = '' WHERE cliente_telefone IS NULL;
UPDATE atendimentos SET endereco = '' WHERE endereco IS NULL;

-- 3. NOT NULL nas colunas obrigatórias
ALTER TABLE atendimentos
  ALTER COLUMN cliente_nome SET NOT NULL,
  ALTER COLUMN cliente_telefone SET NOT NULL,
  ALTER COLUMN endereco SET NOT NULL;

-- 4. tipo_servico passa a ser NOT NULL
UPDATE atendimentos SET tipo_servico = 'Outro' WHERE tipo_servico IS NULL;
ALTER TABLE atendimentos ALTER COLUMN tipo_servico SET NOT NULL;

-- 5. Atualizar status: remover pos_atendimento
UPDATE atendimentos SET status = 'execucao' WHERE status = 'pos_atendimento';
ALTER TABLE atendimentos DROP CONSTRAINT IF EXISTS atendimentos_status_check;
ALTER TABLE atendimentos ADD CONSTRAINT atendimentos_status_check CHECK (
  status IN ('iniciado','visita_tecnica','medicao','orcamento','aprovado','reprovado','execucao')
);

-- 6. Remover FKs do atendimentos
ALTER TABLE atendimentos DROP COLUMN IF EXISTS cliente_id;
ALTER TABLE atendimentos DROP COLUMN IF EXISTS imovel_id;

-- 7. Dropar policies e tabelas
DROP POLICY IF EXISTS "user_clientes" ON clientes;
DROP POLICY IF EXISTS "user_imoveis" ON imoveis;
DROP TABLE IF EXISTS imoveis CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
