// =============================================
// Entidades fixas (Cadastros)
// =============================================

export interface Cliente {
  id: string;
  user_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cpf_cnpj: string | null;
  observacoes: string | null;
  created_at: string;
}

export interface Imovel {
  id: string;
  cliente_id: string;
  apelido: string | null;
  endereco: string;
  tipo: 'residencial' | 'comercial' | 'outro';
  observacoes: string | null;
  created_at: string;
}

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
  | 'pos_atendimento';

export interface Atendimento {
  id: string;
  user_id: string;
  cliente_id: string;
  imovel_id: string | null;
  tipo_servico: string | null;
  status: AtendimentoStatus;
  observacoes: string | null;
  created_at: string;
}

export interface AtendimentoComCliente extends Atendimento {
  cliente: Pick<Cliente, 'id' | 'nome' | 'telefone'>;
  imovel: Pick<Imovel, 'id' | 'apelido' | 'endereco'> | null;
}

export interface Medicao {
  id: string;
  atendimento_id: string;
  area_total: number;
  observacoes: string | null;
  created_at: string;
}

export interface Orcamento {
  id: string;
  atendimento_id: string;
  produto_id: string | null;
  area_total: number | null;
  area_com_perda: number | null;
  perda_percentual: number | null;
  valor_total: number;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'reprovado';
  observacoes: string | null;
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
