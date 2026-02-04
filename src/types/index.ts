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
  valor_total: number;
  status: 'enviado' | 'aprovado' | 'perdido';
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
