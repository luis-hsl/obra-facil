// =============================================
// Cadastros
// =============================================

export interface Produto {
  id: string;
  user_id: string;
  fabricante: string;
  linha: string;
  preco_por_m2: number;
  created_at: string;
}

// =============================================
// Processo (Atendimento)
// =============================================

export type AtendimentoStatus =
  | 'iniciado'
  | 'visita_tecnica'
  | 'medicao'
  | 'orcamento'
  | 'aprovado'
  | 'reprovado'
  | 'execucao'
  | 'concluido';

export interface Atendimento {
  id: string;
  user_id: string;
  // Snapshot do cliente
  cliente_nome: string;
  cliente_telefone: string;
  // Snapshot do endereço
  endereco: string;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  // Serviço
  tipo_servico: string;
  status: AtendimentoStatus;
  observacoes: string | null;
  created_at: string;
}

export interface Medicao {
  id: string;
  atendimento_id: string;
  area_total: number;
  perda_percentual: number;
  observacoes: string | null;
  created_at: string;
}

export interface Orcamento {
  id: string;
  atendimento_id: string;
  produto_id: string | null; // Legado - agora usa orcamento_itens
  area_total: number | null;
  area_com_perda: number | null;
  perda_percentual: number | null;
  valor_total: number;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'reprovado';
  observacoes: string | null;
  forma_pagamento: 'a_vista' | 'parcelado';
  numero_parcelas: number;
  taxa_juros_mensal: number;
  valor_parcela: number | null;
  valor_total_parcelado: number | null;
  created_at: string;
}

export interface OrcamentoItem {
  id: string;
  orcamento_id: string;
  produto_id: string | null;
  area_total: number;
  area_com_perda: number;
  perda_percentual: number;
  preco_por_m2: number;
  valor_total: number;
  created_at: string;
}

export interface Execucao {
  id: string;
  atendimento_id: string;
  status: 'pendente' | 'em_andamento' | 'concluido';
  foto_final_url: string | null;
  observacoes: string | null;
  created_at: string;
}

export interface Fechamento {
  id: string;
  atendimento_id: string;
  valor_recebido: number;
  custo_distribuidor: number;
  custo_instalador: number;
  custo_extras: number;
  observacoes_extras: string | null;
  lucro_final: number;
  created_at: string;
}

// =============================================
// Marca / Identidade Visual
// =============================================

export interface BrandConfig {
  id: string;
  user_id: string;
  logo_url: string | null;
  logo_position: 'left' | 'center' | 'right';
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  company_name: string | null;
  company_cnpj: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_address: string | null;
  footer_text: string | null;
  validity_days: number;
  layout_style: 'classic' | 'modern' | 'minimal';
  font_family: 'helvetica' | 'times' | 'courier';
  template_pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandExtraction {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  company: {
    name: string | null;
    cnpj: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
  footer_text: string | null;
  layout_suggestion: 'classic' | 'modern' | 'minimal';
  font_suggestion: 'helvetica' | 'times' | 'courier';
}
