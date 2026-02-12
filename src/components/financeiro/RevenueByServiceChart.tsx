import { formatCurrency } from '../../lib/financeiro/chartUtils';

interface Props {
  data: { servico: string; receita: number; lucro: number }[];
}

const BAR_COLORS = [
  'from-blue-500 to-blue-400',
  'from-indigo-500 to-indigo-400',
  'from-violet-500 to-violet-400',
  'from-purple-500 to-purple-400',
  'from-fuchsia-500 to-fuchsia-400',
  'from-pink-500 to-pink-400',
];

export default function RevenueByServiceChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-700 mb-3">Receita por Serviço</p>
        <p className="text-sm text-slate-400 text-center py-6">Sem dados no período</p>
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => d.receita), 1);

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-700 mb-4">Receita por Serviço</p>

      <div className="space-y-3">
        {data.map((item, i) => {
          const pct = (item.receita / maxVal) * 100;
          return (
            <div key={item.servico} className="group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-700 truncate">{item.servico}</span>
                <span className="text-sm font-bold text-slate-900 ml-2 flex-shrink-0">{formatCurrency(item.receita)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full bg-gradient-to-r ${BAR_COLORS[i % BAR_COLORS.length]} group-hover:opacity-100 opacity-85`}
                  style={{ width: `${pct}%`, transition: 'width 0.5s ease-out' }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
