import type { ReactNode } from 'react';
import type { Insight } from '../../lib/financeiro/computeInsights';

interface Props {
  insights: Insight[];
}

const ICONS: Record<Insight['tipo'], { icon: ReactNode; bg: string; text: string; iconBg: string }> = {
  success: {
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
    bg: 'bg-emerald-50', text: 'text-emerald-700', iconBg: 'bg-emerald-100 text-emerald-700',
  },
  warning: {
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    bg: 'bg-amber-50', text: 'text-amber-700', iconBg: 'bg-amber-100 text-amber-700',
  },
  info: {
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    bg: 'bg-blue-50', text: 'text-blue-700', iconBg: 'bg-blue-100 text-blue-700',
  },
  danger: {
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    bg: 'bg-red-50', text: 'text-red-700', iconBg: 'bg-red-100 text-red-700',
  },
};

export default function InsightsPanel({ insights }: Props) {
  if (insights.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-700 mb-3">Insights</p>

      <div className="space-y-2.5">
        {insights.map((ins) => {
          const style = ICONS[ins.tipo];
          return (
            <div key={ins.id} className={`flex items-start gap-3 ${style.bg} rounded-lg px-3 py-2.5`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${style.iconBg}`}>
                {style.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${style.text}`}>{ins.titulo}</p>
                <p className="text-xs text-slate-600 mt-0.5">{ins.descricao}</p>
                {ins.acao && (
                  <p className="text-xs font-semibold text-slate-700 mt-1">
                    <span className="text-slate-400 mr-1">&rarr;</span>{ins.acao}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
