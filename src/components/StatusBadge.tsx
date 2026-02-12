import { STATUS_CONFIG } from '../lib/statusConfig';

const BADGE_STYLES: Record<string, string> = {
  iniciado: 'bg-slate-100 text-slate-600 ring-slate-200',
  visita_tecnica: 'bg-purple-50 text-purple-700 ring-purple-200',
  medicao: 'bg-amber-50 text-amber-700 ring-amber-200',
  orcamento: 'bg-blue-50 text-blue-700 ring-blue-200',
  aprovado: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  reprovado: 'bg-red-50 text-red-700 ring-red-200',
  execucao: 'bg-orange-50 text-orange-700 ring-orange-200',
  concluido: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rascunho: 'bg-slate-100 text-slate-600 ring-slate-200',
  enviado: 'bg-blue-50 text-blue-700 ring-blue-200',
  pendente: 'bg-amber-50 text-amber-700 ring-amber-200',
  em_andamento: 'bg-orange-50 text-orange-700 ring-orange-200',
};

export default function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status };
  const style = BADGE_STYLES[status] || 'bg-slate-100 text-slate-600 ring-slate-200';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ring-1 ring-inset ${style}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'concluido' || status === 'aprovado' ? 'bg-emerald-500' :
        status === 'reprovado' ? 'bg-red-500' :
        status === 'execucao' ? 'bg-orange-500' :
        status === 'orcamento' || status === 'enviado' ? 'bg-blue-500' :
        status === 'medicao' || status === 'pendente' ? 'bg-amber-500' :
        status === 'visita_tecnica' ? 'bg-purple-500' :
        'bg-slate-400'
      }`} />
      {config.label}
    </span>
  );
}
