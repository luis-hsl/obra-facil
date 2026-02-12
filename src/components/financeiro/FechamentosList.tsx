import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { FechamentoComAtendimento } from '../../lib/financeiro/useFinanceiroData';
import { formatCurrency } from '../../lib/financeiro/chartUtils';
import EmptyState from '../EmptyState';

interface Props {
  fechamentos: FechamentoComAtendimento[];
}

type SortKey = 'recente' | 'receita' | 'lucro';

const TIMEZONE = 'America/Sao_Paulo';
const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { timeZone: TIMEZONE });

export default function FechamentosList({ fechamentos }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('recente');

  const sorted = [...fechamentos].sort((a, b) => {
    if (sortKey === 'receita') return b.valor_recebido - a.valor_recebido;
    if (sortKey === 'lucro') return b.lucro_final - a.lucro_final;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (fechamentos.length === 0) {
    return <EmptyState icon="financeiro" titulo="Nenhum fechamento no período" descricao="Ajuste o filtro ou registre novos fechamentos" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-600">{fechamentos.length} fechamento(s)</p>
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="recente">Mais recente</option>
          <option value="receita">Maior receita</option>
          <option value="lucro">Maior lucro</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sorted.map((f) => {
          const isExpanded = expandedId === f.id;
          return (
            <div key={f.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md">
              <button
                onClick={() => setExpandedId(isExpanded ? null : f.id)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{f.atendimento?.cliente_nome || 'Cliente não encontrado'}</p>
                    <span className="text-xs text-slate-400">{formatDate(f.created_at)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm mt-1">
                    <span className="text-slate-500">Recebido: <strong className="text-slate-700">{formatCurrency(f.valor_recebido)}</strong></span>
                    <span className={`font-semibold ${f.lucro_final >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      Lucro: {formatCurrency(f.lucro_final)}
                    </span>
                  </div>
                </div>
                <span className={`text-slate-400 text-lg ${isExpanded ? 'rotate-90' : ''}`}>›</span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-3 animate-fade-in">
                  <div className="bg-slate-50 rounded-xl p-3.5 text-sm text-slate-600 space-y-1">
                    {f.atendimento && (
                      <>
                        <p className="font-medium text-slate-700">{f.atendimento.tipo_servico}</p>
                        <p className="text-slate-400">
                          {[f.atendimento.endereco, f.atendimento.numero, f.atendimento.bairro, f.atendimento.cidade].filter(Boolean).join(', ')}
                        </p>
                      </>
                    )}
                    <div className="pt-2 mt-2 border-t border-slate-200">
                      <p className="font-semibold text-slate-700">Custos:</p>
                      <p>Distribuidor: {formatCurrency(f.custo_distribuidor)}</p>
                      <p>Instalador: {formatCurrency(f.custo_instalador)}</p>
                      <p>Extras: {formatCurrency(f.custo_extras)}</p>
                      {f.observacoes_extras && <p className="mt-2 text-slate-500">Obs: {f.observacoes_extras}</p>}
                    </div>
                  </div>
                  {f.atendimento && (
                    <Link to={`/atendimentos/${f.atendimento_id}`} className="block mt-3 text-sm text-blue-600 font-semibold no-underline">
                      Ver atendimento →
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
