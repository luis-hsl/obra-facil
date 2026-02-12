import type { Insight } from '../../lib/financeiro/computeInsights';

interface Props {
  insights: Insight[];
}

const ICONS: Record<Insight['tipo'], { icon: string; bg: string; text: string }> = {
  success: { icon: '✓', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  warning: { icon: '!', bg: 'bg-amber-50', text: 'text-amber-700' },
  info: { icon: 'i', bg: 'bg-blue-50', text: 'text-blue-700' },
  danger: { icon: '✕', bg: 'bg-red-50', text: 'text-red-700' },
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
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${style.text} bg-white/70`}>
                {style.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${style.text}`}>{ins.titulo}</p>
                <p className="text-xs text-slate-600 mt-0.5">{ins.descricao}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
