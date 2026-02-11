import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Atendimento, Fechamento } from '../types';
import EmptyState from '../components/EmptyState';
import LoadingSkeleton from '../components/LoadingSkeleton';

interface FechamentoComAtendimento extends Fechamento {
  atendimento?: Atendimento;
}

type Periodo = 'hoje' | 'semana' | 'mes' | 'ano' | 'personalizado';

const TIMEZONE = 'America/Sao_Paulo';

function getDataBrasilia(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toUTCStartOfDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0)).toISOString();
}

function toUTCEndOfDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1, 2, 59, 59, 999)).toISOString();
}

function calcularRangeDatas(periodo: Periodo, dataInicio?: string, dataFim?: string): { inicio: string; fim: string } | null {
  const hoje = getDataBrasilia();
  switch (periodo) {
    case 'hoje': {
      const h = formatDateInput(hoje);
      return { inicio: toUTCStartOfDay(h), fim: toUTCEndOfDay(h) };
    }
    case 'semana': {
      const ini = new Date(hoje); ini.setDate(hoje.getDate() - hoje.getDay());
      const fim = new Date(ini); fim.setDate(ini.getDate() + 6);
      return { inicio: toUTCStartOfDay(formatDateInput(ini)), fim: toUTCEndOfDay(formatDateInput(fim)) };
    }
    case 'mes': {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      return { inicio: toUTCStartOfDay(formatDateInput(ini)), fim: toUTCEndOfDay(formatDateInput(fim)) };
    }
    case 'ano': {
      const ini = new Date(hoje.getFullYear(), 0, 1);
      const fim = new Date(hoje.getFullYear(), 11, 31);
      return { inicio: toUTCStartOfDay(formatDateInput(ini)), fim: toUTCEndOfDay(formatDateInput(fim)) };
    }
    case 'personalizado': {
      if (!dataInicio || !dataFim) return null;
      return { inicio: toUTCStartOfDay(dataInicio), fim: toUTCEndOfDay(dataFim) };
    }
    default: return null;
  }
}

export default function Financeiro() {
  const [fechamentos, setFechamentos] = useState<FechamentoComAtendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const hoje = getDataBrasilia();
  const [dataInicio, setDataInicio] = useState(formatDateInput(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
  const [dataFim, setDataFim] = useState(formatDateInput(hoje));

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [fechRes, atdRes] = await Promise.all([
      supabase.from('fechamentos').select('*').order('created_at', { ascending: false }),
      supabase.from('atendimentos').select('*'),
    ]);
    if (fechRes.error) { setErro('Erro ao carregar fechamentos.'); setLoading(false); return; }
    const atendimentosMap: Record<string, Atendimento> = {};
    (atdRes.data || []).forEach((a) => { atendimentosMap[a.id] = a; });
    setFechamentos((fechRes.data || []).map((f) => ({ ...f, atendimento: atendimentosMap[f.atendimento_id] })));
    setLoading(false);
  };

  // Validate dates
  const dateError = periodo === 'personalizado' && dataInicio && dataFim && dataInicio > dataFim;

  const fechamentosFiltrados = useMemo(() => {
    if (dateError) return [];
    const range = calcularRangeDatas(periodo, dataInicio, dataFim);
    if (!range) return fechamentos;
    return fechamentos.filter((f) => {
      const createdAt = new Date(f.created_at).toISOString();
      return createdAt >= range.inicio && createdAt <= range.fim;
    });
  }, [fechamentos, periodo, dataInicio, dataFim, dateError]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: TIMEZONE });

  const totalRecebido = fechamentosFiltrados.reduce((acc, f) => acc + f.valor_recebido, 0);
  const totalCustos = fechamentosFiltrados.reduce((acc, f) => acc + f.custo_distribuidor + f.custo_instalador + f.custo_extras, 0);
  const totalLucro = fechamentosFiltrados.reduce((acc, f) => acc + f.lucro_final, 0);

  // Monthly trend data (last 6 months)
  const trendData = useMemo(() => {
    const now = getDataBrasilia();
    const months: { label: string; recebido: number; lucro: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('pt-BR', { month: 'short', timeZone: TIMEZONE });
      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      let recebido = 0, lucro = 0;
      fechamentos.forEach(f => {
        const fDate = new Date(f.created_at);
        const fYM = `${fDate.getFullYear()}-${String(fDate.getMonth() + 1).padStart(2, '0')}`;
        if (fYM === yearMonth) { recebido += f.valor_recebido; lucro += f.lucro_final; }
      });
      months.push({ label, recebido, lucro });
    }
    return months;
  }, [fechamentos]);

  const trendMax = Math.max(...trendData.map(m => Math.max(m.recebido, Math.abs(m.lucro))), 1);

  // CSV Export
  const exportCSV = () => {
    const header = 'Cliente,Serviço,Data,Recebido,Distribuidor,Instalador,Extras,Lucro\n';
    const rows = fechamentosFiltrados.map(f => {
      const nome = f.atendimento?.cliente_nome || 'N/A';
      const servico = f.atendimento?.tipo_servico || 'N/A';
      return `"${nome}","${servico}",${formatDate(f.created_at)},${f.valor_recebido},${f.custo_distribuidor},${f.custo_instalador},${f.custo_extras},${f.lucro_final}`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financeiro-${formatDateInput(getDataBrasilia())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Financeiro</h2>
        <LoadingSkeleton type="kpi" />
        <div className="mt-4"><LoadingSkeleton count={3} /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Financeiro</h2>
        {fechamentosFiltrados.length > 0 && (
          <button onClick={exportCSV} className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Exportar CSV
          </button>
        )}
      </div>

      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      {/* Period filter */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Período</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {[
            { value: 'hoje', label: 'Hoje' }, { value: 'semana', label: 'Semana' },
            { value: 'mes', label: 'Mês' }, { value: 'ano', label: 'Ano' },
            { value: 'personalizado', label: 'Personalizado' },
          ].map((opt) => (
            <button key={opt.value} onClick={() => setPeriodo(opt.value as Periodo)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                periodo === opt.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >{opt.label}</button>
          ))}
        </div>
        {periodo === 'personalizado' && (
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">De</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Até</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {dateError && <p className="text-xs text-red-500 font-medium">A data inicial deve ser anterior à final</p>}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Recebido</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRecebido)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Custos</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalCustos)}</p>
        </div>
        <div className={`rounded-lg border p-4 ${totalLucro >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-sm text-gray-500">Lucro Total</p>
          <p className={`text-2xl font-bold ${totalLucro >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(totalLucro)}</p>
        </div>
      </div>

      {/* Summary chart */}
      {fechamentosFiltrados.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Resumo Visual</p>
          <div className="space-y-3">
            {[
              { label: 'Recebido', value: totalRecebido, color: 'bg-blue-500', max: Math.max(totalRecebido, totalCustos, Math.abs(totalLucro)) },
              { label: 'Custos', value: totalCustos, color: 'bg-red-400', max: Math.max(totalRecebido, totalCustos, Math.abs(totalLucro)) },
              { label: 'Lucro', value: totalLucro, color: totalLucro >= 0 ? 'bg-green-500' : 'bg-red-500', max: Math.max(totalRecebido, totalCustos, Math.abs(totalLucro)) },
            ].map((bar) => (
              <div key={bar.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{bar.label}</span>
                  <span className="font-medium text-gray-900">{formatCurrency(bar.value)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className={`h-3 rounded-full transition-all duration-500 ${bar.color}`}
                    style={{ width: bar.max > 0 ? `${(Math.abs(bar.value) / bar.max) * 100}%` : '0%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly trend */}
      {fechamentos.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Tendência (6 meses)</p>
          <div className="flex items-end gap-2 h-32">
            {trendData.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col items-center justify-end h-24">
                  <div className="w-full flex gap-0.5 items-end justify-center h-full">
                    <div className="w-1/2 bg-blue-400 rounded-t" style={{ height: trendMax > 0 ? `${(m.recebido / trendMax) * 100}%` : '0%', minHeight: m.recebido > 0 ? '4px' : '0' }} />
                    <div className={`w-1/2 rounded-t ${m.lucro >= 0 ? 'bg-green-400' : 'bg-red-400'}`} style={{ height: trendMax > 0 ? `${(Math.abs(m.lucro) / trendMax) * 100}%` : '0%', minHeight: m.lucro !== 0 ? '4px' : '0' }} />
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 capitalize">{m.label}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-4 mt-2">
            <span className="flex items-center gap-1 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-blue-400" />Recebido</span>
            <span className="flex items-center gap-1 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-green-400" />Lucro</span>
          </div>
        </div>
      )}

      {/* Detailed list */}
      {fechamentosFiltrados.length === 0 ? (
        <EmptyState icon="financeiro" titulo="Nenhum fechamento no período" descricao="Ajuste o filtro de período ou registre novos fechamentos nos atendimentos" />
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-600">{fechamentosFiltrados.length} fechamento(s) no período</p>
          {fechamentosFiltrados.map((f) => {
            const isExpanded = expandedId === f.id;
            return (
              <div key={f.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <button onClick={() => setExpandedId(isExpanded ? null : f.id)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{f.atendimento?.cliente_nome || 'Cliente não encontrado'}</p>
                      <span className="text-xs text-gray-400">{formatDate(f.created_at)}</span>
                    </div>
                    <div className="flex gap-4 text-sm mt-1">
                      <span className="text-gray-500">Recebido: <strong className="text-gray-700">{formatCurrency(f.valor_recebido)}</strong></span>
                      <span className={f.lucro_final >= 0 ? 'text-green-600' : 'text-red-600'}>Lucro: <strong>{formatCurrency(f.lucro_final)}</strong></span>
                    </div>
                  </div>
                  <span className={`text-gray-400 text-lg transition-transform ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 space-y-1">
                      {f.atendimento && (
                        <>
                          <p>{f.atendimento.tipo_servico}</p>
                          <p className="text-gray-400">{[f.atendimento.endereco, f.atendimento.numero, f.atendimento.bairro, f.atendimento.cidade].filter(Boolean).join(', ')}</p>
                        </>
                      )}
                      <div className="pt-2 mt-2 border-t border-gray-200">
                        <p className="font-semibold text-gray-700">Custos:</p>
                        <p>Distribuidor: {formatCurrency(f.custo_distribuidor)}</p>
                        <p>Instalador: {formatCurrency(f.custo_instalador)}</p>
                        <p>Extras: {formatCurrency(f.custo_extras)}</p>
                        {f.observacoes_extras && <p className="mt-2 text-gray-500">Obs: {f.observacoes_extras}</p>}
                      </div>
                    </div>
                    {f.atendimento && (
                      <Link to={`/atendimentos/${f.atendimento_id}`} className="block mt-3 text-sm text-blue-600 font-medium no-underline">Ver atendimento →</Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
