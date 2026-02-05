import type { AtendimentoStatus } from '../types';

interface StatusInfo {
  label: string;
  color: string;
}

export const STATUS_CONFIG: Record<string, StatusInfo> = {
  // Atendimento
  iniciado: { label: 'Iniciado', color: 'bg-gray-200 text-gray-800' },
  visita_tecnica: { label: 'Visita Técnica', color: 'bg-purple-100 text-purple-800' },
  medicao: { label: 'Medição', color: 'bg-yellow-100 text-yellow-800' },
  orcamento: { label: 'Orçamento', color: 'bg-blue-100 text-blue-800' },
  aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-800' },
  reprovado: { label: 'Reprovado', color: 'bg-red-100 text-red-800' },
  execucao: { label: 'Execução', color: 'bg-orange-100 text-orange-800' },
  // Orçamento
  rascunho: { label: 'Rascunho', color: 'bg-gray-200 text-gray-800' },
  enviado: { label: 'Enviado', color: 'bg-blue-100 text-blue-800' },
  // Execução
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
  em_andamento: { label: 'Em andamento', color: 'bg-orange-100 text-orange-800' },
  concluido: { label: 'Concluído', color: 'bg-green-100 text-green-800' },
};

export const STATUS_ORDER: AtendimentoStatus[] = [
  'iniciado',
  'visita_tecnica',
  'medicao',
  'orcamento',
  'aprovado',
  'execucao',
];

export function getNextStatuses(current: AtendimentoStatus): AtendimentoStatus[] {
  if (current === 'reprovado') return ['iniciado'];
  if (current === 'execucao') return [];

  const idx = STATUS_ORDER.indexOf(current);
  if (idx === -1) return [];

  const forward = STATUS_ORDER.slice(idx + 1);
  return [...forward, 'reprovado'];
}
