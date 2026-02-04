export interface Obra {
  id: string;
  user_id: string;
  cliente_nome: string;
  endereco: string | null;
  tipo_servico: string | null;
  status: 'lead' | 'medicao' | 'orcado' | 'execucao' | 'finalizado';
  observacoes: string | null;
  created_at: string;
}

export interface Medicao {
  id: string;
  obra_id: string;
  tipo_medida: string;
  valor: number;
  observacoes: string | null;
  created_at: string;
}

export interface Orcamento {
  id: string;
  obra_id: string;
  produto_id: string | null;
  area_total: number | null;
  area_com_perda: number | null;
  perda_percentual: number | null;
  quantidade_caixas: number | null;
  valor_total: number;
  status: 'gerado' | 'enviado' | 'aprovado' | 'perdido';
  created_at: string;
}

export interface Produto {
  id: string;
  user_id: string;
  nome: string;
  metragem_por_caixa: number;
  preco_por_caixa: number;
  perda_padrao: number;
  created_at: string;
}

export interface Execucao {
  id: string;
  obra_id: string;
  status: 'pendente' | 'concluido';
  foto_final_url: string | null;
  observacoes: string | null;
  created_at: string;
}
