import type { ReactNode } from 'react';
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

const IconReceita = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconCustos = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
  </svg>
);

const IconLucro = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const IconMargem = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const IconTicket = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
  </svg>
);

const IconProjetos = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

interface CardDef {
  key: keyof Props['kpis'];
  label: string;
  icon: () => ReactNode;
  format: (v: number) => string;
  colorClass: string;
  iconBg: string;
  borderClass: string;
}

const heroCards: CardDef[] = [
  { key: 'receita', label: 'Receita', icon: IconReceita, format: formatCurrency, colorClass: 'text-blue-700', iconBg: 'bg-blue-50 text-blue-600', borderClass: 'border-blue-100' },
  { key: 'custos', label: 'Custos', icon: IconCustos, format: formatCurrency, colorClass: 'text-red-600', iconBg: 'bg-red-50 text-red-500', borderClass: 'border-red-100' },
  { key: 'lucro', label: 'Lucro', icon: IconLucro, format: formatCurrency, colorClass: 'text-emerald-700', iconBg: 'bg-emerald-50 text-emerald-600', borderClass: 'border-emerald-100' },
];

const secondaryCards: CardDef[] = [
  { key: 'margem', label: 'Margem', icon: IconMargem, format: (v) => `${v.toFixed(1)}%`, colorClass: 'text-violet-700', iconBg: 'bg-violet-50 text-violet-600', borderClass: 'border-violet-100' },
  { key: 'ticketMedio', label: 'Ticket Médio', icon: IconTicket, format: formatCurrency, colorClass: 'text-amber-700', iconBg: 'bg-amber-50 text-amber-600', borderClass: 'border-amber-100' },
  { key: 'numProjetos', label: 'Projetos', icon: IconProjetos, format: (v) => String(v), colorClass: 'text-slate-700', iconBg: 'bg-slate-50 text-slate-500', borderClass: 'border-slate-200' },
];

export default function KpiCards({ kpis, deltas }: Props) {
  return (
    <div className="space-y-3">
      {/* Hero KPIs — 3 cols, bigger */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {heroCards.map((c) => {
          const delta = deltas[c.key];
          const value = kpis[c.key];
          const valueColor = c.key === 'lucro' ? (value >= 0 ? 'text-emerald-700' : 'text-red-700') : c.colorClass;
          const border = c.key === 'lucro' ? (value >= 0 ? 'border-emerald-100' : 'border-red-100') : c.borderClass;
          const iconBg = c.key === 'lucro' ? (value >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500') : c.iconBg;

          return (
            <div key={c.key} className={`bg-white rounded-xl border ${border} p-4 shadow-sm`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
                  {c.icon()}
                </div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{c.label}</span>
                {delta && (
                  <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    delta.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {delta.label}
                  </span>
                )}
              </div>
              <p className={`text-2xl font-bold ${valueColor} leading-tight`}>
                {c.format(value)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Secondary KPIs — 3 cols, compact */}
      <div className="grid grid-cols-3 gap-3">
        {secondaryCards.map((c) => {
          const delta = deltas[c.key];
          const value = kpis[c.key];

          return (
            <div key={c.key} className={`bg-white rounded-xl border ${c.borderClass} px-3 py-2.5 shadow-sm`}>
              <div className="flex items-center gap-1.5 mb-1">
                <div className={`w-5 h-5 rounded flex items-center justify-center ${c.iconBg}`}>
                  {c.icon()}
                </div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{c.label}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className={`text-base sm:text-lg font-bold ${c.colorClass} leading-tight`}>
                  {c.format(value)}
                </p>
                {delta && (
                  <span className={`text-[10px] font-bold ${
                    delta.positive ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {delta.label}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
