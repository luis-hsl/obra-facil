import type { AtendimentoStatus } from '../types';

const STEPS: { status: AtendimentoStatus; label: string; shortLabel: string }[] = [
  { status: 'iniciado', label: 'Iniciado', shortLabel: 'Início' },
  { status: 'visita_tecnica', label: 'Visita Técnica', shortLabel: 'Visita' },
  { status: 'medicao', label: 'Medição', shortLabel: 'Medição' },
  { status: 'orcamento', label: 'Orçamento', shortLabel: 'Orçam.' },
  { status: 'aprovado', label: 'Aprovado', shortLabel: 'Aprov.' },
  { status: 'execucao', label: 'Execução', shortLabel: 'Exec.' },
  { status: 'concluido', label: 'Concluído', shortLabel: 'Concl.' },
];

interface StatusProgressProps {
  status: AtendimentoStatus;
}

export default function StatusProgress({ status }: StatusProgressProps) {
  if (status === 'reprovado') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
          <span className="text-sm font-semibold text-red-700">Reprovado</span>
        </div>
      </div>
    );
  }

  const currentIdx = STEPS.findIndex(s => s.status === status);
  const progress = ((currentIdx + 1) / STEPS.length) * 100;

  return (
    <div className="bg-white rounded-xl border border-slate-100 px-4 py-3 mb-4 shadow-sm">
      {/* Desktop */}
      <div className="hidden sm:flex items-center gap-1">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <div key={step.status} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full border-2 ${
                  isDone ? 'bg-blue-600 border-blue-600 shadow-sm shadow-blue-600/50' :
                  isCurrent ? 'bg-white border-blue-600 ring-4 ring-blue-100' :
                  'bg-white border-slate-300'
                }`} />
                <span className={`text-[10px] mt-1.5 whitespace-nowrap ${
                  isDone ? 'text-blue-600 font-medium' :
                  isCurrent ? 'text-blue-700 font-bold' :
                  'text-slate-400'
                }`}>
                  {step.shortLabel}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 rounded-full ${
                  idx < currentIdx ? 'bg-blue-600' : 'bg-slate-200'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile — compact */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-900">
            {STEPS[currentIdx]?.label || status}
          </span>
          <span className="text-xs text-slate-400 font-medium">
            {currentIdx + 1} de {STEPS.length}
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-600 to-indigo-500 h-2 rounded-full"
            style={{ width: `${progress}%`, transition: 'width 0.5s ease-out' }}
          />
        </div>
      </div>
    </div>
  );
}
