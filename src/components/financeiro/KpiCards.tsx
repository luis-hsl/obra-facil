import { formatCurrency } from '../../lib/financeiro/chartUtils';

interface Delta {
  label: string;
  positive: boolean;
}

interface Props {
  kpis: {
    receita: number;
    custos: number;
    lucro: number;
    margem: number;
    ticketMedio: number;
    numProjetos: number;
  };
  deltas: {
    receita: Delta | null;
    custos: Delta | null;
    lucro: Delta | null;
    margem: Delta | null;
    ticketMedio: Delta | null;
    numProjetos: Delta | null;
  };
}

const cards: {
  key: keyof Props['kpis'];
  label: string;
  icon: string;
  format: (v: number) => string;
  colorClass: string;
  borderClass: string;
}[] = [
  { key: 'receita', label: 'Receita', icon: '💰', format: formatCurrency, colorClass: 'text-blue-700', borderClass: 'border-blue-100' },
  { key: 'custos', label: 'Custos', icon: '📉', format: formatCurrency, colorClass: 'text-red-600', borderClass: 'border-red-100' },
  { key: 'lucro', label: 'Lucro', icon: '✅', format: formatCurrency, colorClass: 'text-emerald-700', borderClass: 'border-emerald-100' },
  { key: 'margem', label: 'Margem', icon: '📊', format: (v) => `${v.toFixed(1)}%`, colorClass: 'text-violet-700', borderClass: 'border-violet-100' },
  { key: 'ticketMedio', label: 'Ticket Médio', icon: '🎯', format: formatCurrency, colorClass: 'text-amber-700', borderClass: 'border-amber-100' },
  { key: 'numProjetos', label: 'Projetos', icon: '📋', format: (v) => String(v), colorClass: 'text-slate-700', borderClass: 'border-slate-100' },
];

export default function KpiCards({ kpis, deltas }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
      {cards.map((c) => {
        const delta = deltas[c.key];
        const value = kpis[c.key];
        // Lucro with dynamic color
        const valueColor = c.key === 'lucro' ? (value >= 0 ? 'text-emerald-700' : 'text-red-700') : c.colorClass;
        const border = c.key === 'lucro' ? (value >= 0 ? 'border-emerald-100' : 'border-red-100') : c.borderClass;

        return (
          <div key={c.key} className={`bg-white rounded-xl border ${border} p-3 shadow-sm`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-base">{c.icon}</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{c.label}</span>
            </div>
            <p className={`text-lg sm:text-xl font-bold ${valueColor} leading-tight`}>
              {c.format(value)}
            </p>
            {delta && (
              <span className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                delta.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
                {delta.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
