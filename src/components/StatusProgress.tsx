import type { AtendimentoStatus } from '../types';

interface StepConfig {
  status: AtendimentoStatus;
  label: string;
  shortLabel: string;
  color: string;        // tailwind color name for active state
  bgDone: string;       // bg when completed
  bgCurrent: string;    // ring/border when current
  icon: React.ReactNode;
}

const STEPS: StepConfig[] = [
  {
    status: 'iniciado',
    label: 'Iniciado',
    shortLabel: 'Início',
    color: 'slate',
    bgDone: 'bg-slate-500',
    bgCurrent: 'ring-slate-300',
    icon: (
      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    status: 'visita_tecnica',
    label: 'Visita Técnica',
    shortLabel: 'Visita',
    color: 'purple',
    bgDone: 'bg-purple-500',
    bgCurrent: 'ring-purple-200',
    icon: (
      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    status: 'medicao',
    label: 'Medição',
    shortLabel: 'Medição',
    color: 'amber',
    bgDone: 'bg-amber-500',
    bgCurrent: 'ring-amber-200',
    icon: (
      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.5 2a.5.5 0 00-.5.5v15a.5.5 0 001 0v-15a.5.5 0 00-.5-.5zM7 4h1v2H7V4zm0 4h2v2H7V8zm0 4h1v2H7v-2zm7.5-10a.5.5 0 00-.5.5v15a.5.5 0 001 0v-15a.5.5 0 00-.5-.5zM12 4h-1v2h1V4zm0 4h-2v2h2V8zm0 4h-1v2h1v-2z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    status: 'orcamento',
    label: 'Orçamento',
    shortLabel: 'Orçam.',
    color: 'blue',
    bgDone: 'bg-blue-500',
    bgCurrent: 'ring-blue-200',
    icon: (
      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v7a1 1 0 102 0V8z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    status: 'aprovado',
    label: 'Aprovado',
    shortLabel: 'Aprov.',
    color: 'emerald',
    bgDone: 'bg-emerald-500',
    bgCurrent: 'ring-emerald-200',
    icon: (
      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
      </svg>
    ),
  },
  {
    status: 'execucao',
    label: 'Execução',
    shortLabel: 'Exec.',
    color: 'orange',
    bgDone: 'bg-orange-500',
    bgCurrent: 'ring-orange-200',
    icon: (
      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    status: 'concluido',
    label: 'Concluído',
    shortLabel: 'Concl.',
    color: 'emerald',
    bgDone: 'bg-emerald-600',
    bgCurrent: 'ring-emerald-200',
    icon: (
      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
  },
];

// Color maps for dynamic Tailwind classes
const STEP_COLORS: Record<string, { text: string; bg: string; ring: string; line: string; mobileGradient: string }> = {
  slate:   { text: 'text-slate-600',   bg: 'bg-slate-500',   ring: 'ring-slate-200',   line: 'bg-slate-400',   mobileGradient: 'from-slate-500 to-slate-400' },
  purple:  { text: 'text-purple-600',  bg: 'bg-purple-500',  ring: 'ring-purple-200',  line: 'bg-purple-400',  mobileGradient: 'from-purple-500 to-purple-400' },
  amber:   { text: 'text-amber-600',   bg: 'bg-amber-500',   ring: 'ring-amber-200',   line: 'bg-amber-400',   mobileGradient: 'from-amber-500 to-amber-400' },
  blue:    { text: 'text-blue-600',    bg: 'bg-blue-500',    ring: 'ring-blue-200',    line: 'bg-blue-400',    mobileGradient: 'from-blue-600 to-indigo-500' },
  emerald: { text: 'text-emerald-600', bg: 'bg-emerald-500', ring: 'ring-emerald-200', line: 'bg-emerald-400', mobileGradient: 'from-emerald-500 to-emerald-400' },
  orange:  { text: 'text-orange-600',  bg: 'bg-orange-500',  ring: 'ring-orange-200',  line: 'bg-orange-400',  mobileGradient: 'from-orange-500 to-orange-400' },
};

interface StatusProgressProps {
  status: AtendimentoStatus;
}

export default function StatusProgress({ status }: StatusProgressProps) {
  if (status === 'reprovado') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-red-500 flex items-center justify-center shadow-sm shadow-red-500/40">
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </span>
          <span className="text-sm font-bold text-red-700">Reprovado</span>
        </div>
      </div>
    );
  }

  const currentIdx = STEPS.findIndex(s => s.status === status);
  const currentStep = STEPS[currentIdx];
  const currentColor = currentStep ? STEP_COLORS[currentStep.color] : STEP_COLORS.blue;
  const progress = ((currentIdx + 1) / STEPS.length) * 100;

  return (
    <div className="bg-white rounded-xl border border-slate-100 px-4 py-3.5 mb-4 shadow-sm">
      {/* Desktop — timeline with icons */}
      <div className="hidden sm:flex items-center gap-0.5">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const colors = STEP_COLORS[step.color];

          return (
            <div key={step.status} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                {/* Step dot/icon */}
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  isDone
                    ? `${colors.bg} text-white shadow-sm`
                    : isCurrent
                    ? `bg-white border-2 border-current ${colors.text} ring-4 ${colors.ring}`
                    : 'bg-slate-100 text-slate-300 border border-slate-200'
                }`}>
                  {isDone ? (
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    step.icon
                  )}
                </div>
                {/* Label */}
                <span className={`text-[10px] mt-1.5 whitespace-nowrap transition-colors duration-300 ${
                  isDone ? `${colors.text} font-medium` :
                  isCurrent ? `${colors.text} font-bold` :
                  'text-slate-400'
                }`}>
                  {step.shortLabel}
                </span>
              </div>
              {/* Connector line */}
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 rounded-full transition-all duration-500 ${
                  idx < currentIdx ? STEP_COLORS[STEPS[idx + 1].color].line : 'bg-slate-200'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile — all steps visible, scrollable */}
      <div className="sm:hidden">
        {/* Current step label + count */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${currentColor.bg} text-white shadow-sm`}>
              {currentStep?.icon}
            </span>
            <span className="text-sm font-bold text-slate-900">
              {currentStep?.label || status}
            </span>
          </div>
          <span className="text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
            {currentIdx + 1}/{STEPS.length}
          </span>
        </div>

        {/* Mini steps row */}
        <div className="flex items-center gap-1 mb-2">
          {STEPS.map((step, idx) => {
            const isDone = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            const colors = STEP_COLORS[step.color];
            return (
              <div key={step.status} className="flex items-center flex-1 last:flex-none">
                <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  isDone
                    ? `${colors.bg} text-white`
                    : isCurrent
                    ? `bg-white border-2 border-current ${colors.text} shadow-sm`
                    : 'bg-slate-100 text-slate-300'
                }`}>
                  {isDone ? (
                    <svg className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <span className="scale-[0.8]">{step.icon}</span>
                  )}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-0.5 rounded-full transition-all duration-500 ${
                    idx < currentIdx ? STEP_COLORS[STEPS[idx + 1].color].line : 'bg-slate-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-1.5">
          <div
            className={`bg-gradient-to-r ${currentColor.mobileGradient} h-1.5 rounded-full transition-all duration-700 ease-out`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
