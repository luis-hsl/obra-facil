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
  data_visita: string | null;
  observacoes_visita: string | null;
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

import type { PdfBrandConfig } from './pdfTokens';

export type { PdfBrandConfig } from './pdfTokens';

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
  layout_style: 'classic' | 'modern' | 'bold';
  font_family: 'helvetica' | 'times' | 'courier';
  pdf_template: PdfBrandConfig | DocumentTemplate | null;
  created_at: string;
  updated_at: string;
}

// =============================================
// Document Template v2 — @deprecated (mantido para migração runtime)
// =============================================

/** @deprecated Use PdfBrandConfig (version 3) instead */
export interface DocumentTemplate {
  version: 2;
  branding: {
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    font_family: 'helvetica' | 'times' | 'courier';
    header_bg_color: string | null;
    header_text_color: string;
    table_header_bg: string | null;
    table_header_text: string;
    table_row_alt_bg: string | null;
    border_color: string;
    price_highlight_color: string;
  };
  company_fields: Array<{
    label: string;
    value: string;
    type: 'text' | 'phone' | 'email' | 'cnpj' | 'address';
    style: 'normal' | 'bold' | 'light';
    fontSize: number;
  }>;
  client_fields: Array<{
    label: string;
    type: 'cliente_nome' | 'cliente_telefone' | 'endereco_completo' | 'tipo_servico' | 'data';
    required: boolean;
  }>;
  budget_table: {
    columns: Array<{
      key: 'option_number' | 'product_name' | 'area' | 'unit_price' | 'total' | 'discount_price' | 'installment_price';
      label: string;
      width_percent: number;
      align: 'left' | 'center' | 'right';
    }>;
    style: 'table' | 'cards' | 'list';
    show_header: boolean;
    show_borders: boolean;
    row_padding: number;
    header_font_size: number;
    body_font_size: number;
  };
  totals: {
    show_discount: boolean;
    discount_label: string;
    discount_percent: number;
    show_installments: boolean;
    installment_label: string;
    position: 'per_item' | 'summary_bottom';
  };
  observations: {
    default_text: string;
    position: 'bottom' | 'after_totals';
    style: 'italic' | 'normal' | 'light';
    font_size: number;
  };
  layout_metadata: {
    page_size: 'a4';
    orientation: 'portrait' | 'landscape';
    margins: { top: number; right: number; bottom: number; left: number };
    header: {
      height: number;
      logo_position: 'left' | 'center' | 'right';
      logo_max_height: number;
      company_info_position: 'right' | 'left' | 'below-logo' | 'below-title';
      title: { text: string; alignment: 'left' | 'center' | 'right'; font_size: number };
      background_color: string | null;
      show_separator: boolean;
      separator_color: string | null;
    };
    sections_order: Array<'header' | 'client' | 'budget_table' | 'totals' | 'observations' | 'footer'>;
    section_spacing: number;
    client_section: {
      style: 'inline' | 'card' | 'table';
      background_color: string | null;
      border: boolean;
      border_color: string | null;
      label_bold: boolean;
      label_font_size: number;
      value_font_size: number;
    };
    footer: {
      style: 'line' | 'bar' | 'minimal';
      separator_color: string | null;
      text_alignment: 'left' | 'center' | 'right';
      font_size: number;
      text_color: string;
    };
  };
}
