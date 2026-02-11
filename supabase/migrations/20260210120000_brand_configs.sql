-- Tabela de configuração de marca (uma por usuário)
CREATE TABLE IF NOT EXISTS brand_configs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL UNIQUE,
  -- Logo
  logo_url text,
  logo_position text DEFAULT 'left' CHECK (logo_position IN ('left','center','right')),
  -- Cores
  primary_color text DEFAULT '#1e40af',
  secondary_color text DEFAULT '#374151',
  accent_color text DEFAULT '#059669',
  -- Dados da empresa
  company_name text,
  company_cnpj text,
  company_phone text,
  company_email text,
  company_address text,
  -- PDF
  footer_text text,
  validity_days integer DEFAULT 15,
  layout_style text DEFAULT 'classic' CHECK (layout_style IN ('classic','modern','minimal')),
  font_family text DEFAULT 'helvetica' CHECK (font_family IN ('helvetica','times','courier')),
  template_pdf_url text,
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE brand_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_brand_configs" ON brand_configs
  FOR ALL USING (auth.uid() = user_id);

-- Bucket para logos e templates de marca
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand', 'brand', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "upload_brand" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'brand' AND auth.role() = 'authenticated');

CREATE POLICY "brand_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'brand');

CREATE POLICY "update_brand" ON storage.objects
  FOR UPDATE USING (bucket_id = 'brand' AND auth.role() = 'authenticated');

CREATE POLICY "delete_brand" ON storage.objects
  FOR DELETE USING (bucket_id = 'brand' AND auth.role() = 'authenticated');
