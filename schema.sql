-- =============================================
-- OBRA FÁCIL v3 - Modelo Snapshot
-- Dados do cliente direto no Atendimento
-- =============================================

-- ===================
-- CADASTROS
-- ===================

CREATE TABLE produtos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  fabricante text NOT NULL,
  linha text NOT NULL,
  preco_por_m2 numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ===================
-- PROCESSO (Atendimento)
-- ===================

CREATE TABLE atendimentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  -- Snapshot do cliente
  cliente_nome text NOT NULL,
  cliente_telefone text NOT NULL,
  -- Snapshot do endereço
  endereco text NOT NULL,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  -- Serviço
  tipo_servico text NOT NULL,
  status text NOT NULL DEFAULT 'iniciado' CHECK (
    status IN ('iniciado','visita_tecnica','medicao','orcamento',
               'aprovado','reprovado','execucao')
  ),
  observacoes text,
  created_at timestamptz DEFAULT now()
);

-- Medições
CREATE TABLE medicoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  atendimento_id uuid REFERENCES atendimentos(id) ON DELETE CASCADE NOT NULL,
  area_total numeric NOT NULL,
  observacoes text,
  created_at timestamptz DEFAULT now()
);

-- Orçamentos
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

-- Execuções
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
-- RLS (Row Level Security)
-- =============================================

ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_produtos" ON produtos
  FOR ALL USING (auth.uid() = user_id);

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

-- =============================================
-- Storage bucket para fotos
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos', 'fotos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "upload_fotos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'fotos' AND auth.role() = 'authenticated');

CREATE POLICY "fotos_publicas" ON storage.objects
  FOR SELECT USING (bucket_id = 'fotos');
