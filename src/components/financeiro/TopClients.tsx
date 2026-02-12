import { formatCurrency } from '../../lib/financeiro/chartUtils';

interface Props {
  data: { nome: string; receita: number; lucro: number; projetos: number }[];
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
];

export default function TopClients({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-700 mb-3">Top Clientes</p>
        <p className="text-sm text-slate-400 text-center py-6">Sem dados no período</p>
      </div>
    );
  }

  const maxReceita = Math.max(...data.map(d => d.receita), 1);

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-700 mb-4">Top Clientes</p>

      <div className="space-y-3">
        {data.map((client, i) => (
          <div key={client.nome} className="flex items-center gap-3">
            {/* Rank + Avatar */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-bold text-slate-300 w-4 text-right">{i + 1}</span>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                {getInitials(client.nome)}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-sm font-semibold text-slate-900 truncate">{client.nome}</p>
                <span className="text-sm font-bold text-slate-700 ml-2 flex-shrink-0">{formatCurrency(client.receita)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-400"
                    style={{ width: `${(client.receita / maxReceita) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 flex-shrink-0">
                  {client.projetos} proj.
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
