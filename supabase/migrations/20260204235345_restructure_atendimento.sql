-- =============================================
-- REESTRUTURAÇÃO: Modelo centrado no Atendimento
-- Drop tabelas antigas, criar novas do zero
-- =============================================

-- Dropar tabelas filhas primeiro (dependências)
DROP TABLE IF EXISTS execucoes CASCADE;
DROP TABLE IF EXISTS orcamentos CASCADE;
DROP TABLE IF EXISTS medicoes CASCADE;
DROP TABLE IF EXISTS obras CASCADE;

-- Dropar policies de storage se existirem com nomes antigos
DROP POLICY IF EXISTS "Usuário autenticado faz upload" ON storage.objects;
DROP POLICY IF EXISTS "Fotos são públicas" ON storage.objects;

-- =============================================
-- ENTIDADES FIXAS
-- =============================================

CREATE TABLE IF NOT EXISTS clientes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  nome text NOT NULL,
  telefone text,
  email text,
  cpf_cnpj text,
  observacoes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS imoveis (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
  apelido text,
  endereco text NOT NULL,
  tipo text DEFAULT 'residencial' CHECK (tipo IN ('residencial','comercial','outro')),
  observacoes text,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- PROCESSO (Atendimento substitui Obra)
-- =============================================

CREATE TABLE atendimentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  cliente_id uuid REFERENCES clientes(id) NOT NULL,
  imovel_id uuid REFERENCES imoveis(id),
  tipo_servico text,
  status text NOT NULL DEFAULT 'iniciado' CHECK (
    status IN ('iniciado','visita_tecnica','medicao','orcamento',
               'aprovado','reprovado','execucao','pos_atendimento')
  ),
  observacoes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE medicoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  atendimento_id uuid REFERENCES atendimentos(id) ON DELETE CASCADE NOT NULL,
  area_total numeric NOT NULL,
  observacoes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE orcamentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  atendimento_id uuid REFERENCES atendimentos(id) ON DELETE CASCADE NOT NULL,
  produto_id uuid REFERENCES produtos(id),
  area_total numeric,
  area_com_perda numeric,
  perda_percentual numeric,
  valor_total numeric NOT NULL,
  status text NOT NULL DEFAULT 'rascunho' CHECK (
    status IN ('rascunho','enviado','aprovado','reprovado')
  ),
  observacoes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE execucoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  atendimento_id uuid REFERENCES atendimentos(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (
    status IN ('pendente','em_andamento','concluido')
  ),
  foto_final_url text,
  observacoes text,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- RLS
-- =============================================

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE imoveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_clientes" ON clientes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "user_imoveis" ON imoveis
  FOR ALL USING (
    cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid())
  );

CREATE POLICY "user_atendimentos" ON atendimentos
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "user_medicoes" ON medicoes
  FOR ALL USING (
    atendimento_id IN (SELECT id FROM atendimentos WHERE user_id = auth.uid())
  );

CREATE POLICY "user_orcamentos" ON orcamentos
  FOR ALL USING (
    atendimento_id IN (SELECT id FROM atendimentos WHERE user_id = auth.uid())
  );

CREATE POLICY "user_execucoes" ON execucoes
  FOR ALL USING (
    atendimento_id IN (SELECT id FROM atendimentos WHERE user_id = auth.uid())
  );

-- Storage policies (recreate with consistent names)
CREATE POLICY "upload_fotos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'fotos' AND auth.role() = 'authenticated');

CREATE POLICY "fotos_publicas" ON storage.objects
  FOR SELECT USING (bucket_id = 'fotos');
