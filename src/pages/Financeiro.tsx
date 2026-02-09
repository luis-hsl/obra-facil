import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Atendimento, Fechamento } from '../types';

interface FechamentoComAtendimento extends Fechamento {
  atendimento?: Atendimento;
}

type Periodo = 'hoje' | 'semana' | 'mes' | 'ano' | 'personalizado';

// Fuso horário de Brasília
const TIMEZONE = 'America/Sao_Paulo';

// Retorna a data atual em Brasília
function getDataBrasilia(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
}

// Formata data para input date (YYYY-MM-DD)
function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Converte data local de Brasília para UTC (início do dia)
function toUTCStartOfDay(dateStr: string): string {
  // dateStr é YYYY-MM-DD em horário de Brasília
  // Brasília é UTC-3, então meia-noite em Brasília = 03:00 UTC
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
  return date.toISOString();
}

// Converte data local de Brasília para UTC (fim do dia)
function toUTCEndOfDay(dateStr: string): string {
  // 23:59:59 em Brasília = 02:59:59 do dia seguinte em UTC
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1, 2, 59, 59, 999));
  return date.toISOString();
}

// Calcula o range de datas baseado no período selecionado
function calcularRangeDatas(periodo: Periodo, dataInicio?: string, dataFim?: string): { inicio: string; fim: string } | null {
  const hoje = getDataBrasilia();

  switch (periodo) {
    case 'hoje': {
      const hojeStr = formatDateInput(hoje);
      return { inicio: toUTCStartOfDay(hojeStr), fim: toUTCEndOfDay(hojeStr) };
    }
    case 'semana': {
      const inicioSemana = new Date(hoje);
      inicioSemana.setDate(hoje.getDate() - hoje.getDay()); // Domingo
      const fimSemana = new Date(inicioSemana);
      fimSemana.setDate(inicioSemana.getDate() + 6); // Sábado
      return {
        inicio: toUTCStartOfDay(formatDateInput(inicioSemana)),
        fim: toUTCEndOfDay(formatDateInput(fimSemana)),
      };
    }
    case 'mes': {
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      return {
        inicio: toUTCStartOfDay(formatDateInput(inicioMes)),
        fim: toUTCEndOfDay(formatDateInput(fimMes)),
      };
    }
    case 'ano': {
      const inicioAno = new Date(hoje.getFullYear(), 0, 1);
      const fimAno = new Date(hoje.getFullYear(), 11, 31);
      return {
        inicio: toUTCStartOfDay(formatDateInput(inicioAno)),
        fim: toUTCEndOfDay(formatDateInput(fimAno)),
      };
    }
    case 'personalizado': {
      if (!dataInicio || !dataFim) return null;
      return {
        inicio: toUTCStartOfDay(dataInicio),
        fim: toUTCEndOfDay(dataFim),
      };
    }
    default:
      return null;
  }
}

export default function Financeiro() {
  const [fechamentos, setFechamentos] = useState<FechamentoComAtendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filtro de período
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const hoje = getDataBrasilia();
  const [dataInicio, setDataInicio] = useState(formatDateInput(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
  const [dataFim, setDataFim] = useState(formatDateInput(hoje));

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [fechRes, atdRes] = await Promise.all([
      supabase.from('fechamentos').select('*').order('created_at', { ascending: false }),
      supabase.from('atendimentos').select('*'),
    ]);

    if (fechRes.error) {
      setErro('Erro ao carregar fechamentos.');
      setLoading(false);
      return;
    }

    const atendimentosMap: Record<string, Atendimento> = {};
    (atdRes.data || []).forEach((a) => {
      atendimentosMap[a.id] = a;
    });

    const fechamentosComAtd: FechamentoComAtendimento[] = (fechRes.data || []).map((f) => ({
      ...f,
      atendimento: atendimentosMap[f.atendimento_id],
    }));

    setFechamentos(fechamentosComAtd);
    setLoading(false);
  };

  // Filtra fechamentos pelo período selecionado
  const fechamentosFiltrados = useMemo(() => {
    const range = calcularRangeDatas(periodo, dataInicio, dataFim);
    if (!range) return fechamentos;

    return fechamentos.filter((f) => {
      const createdAt = new Date(f.created_at).toISOString();
      return createdAt >= range.inicio && createdAt <= range.fim;
    });
  }, [fechamentos, periodo, dataInicio, dataFim]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: TIMEZONE });

  const totalRecebido = fechamentosFiltrados.reduce((acc, f) => acc + f.valor_recebido, 0);
  const totalCustos = fechamentosFiltrados.reduce(
    (acc, f) => acc + f.custo_distribuidor + f.custo_instalador + f.custo_extras,
    0
  );
  const totalLucro = fechamentosFiltrados.reduce((acc, f) => acc + f.lucro_final, 0);

  if (loading) {
    return <p className="text-center text-gray-500 mt-8">Carregando...</p>;
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Financeiro</h2>

      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      {/* Filtro de período */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Período</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {[
            { value: 'hoje', label: 'Hoje' },
            { value: 'semana', label: 'Semana' },
            { value: 'mes', label: 'Mês' },
            { value: 'ano', label: 'Ano' },
            { value: 'personalizado', label: 'Personalizado' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriodo(opt.value as Periodo)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                periodo === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {periodo === 'personalizado' && (
          <div className="flex flex-wrap gap-3 items-center">
            <div>
              <label className="block text-xs text-gray-500 mb-1">De</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Até</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-2">
          Fuso horário: Brasília (UTC-3)
        </p>
      </div>

      {/* Resumo consolidado */}
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
          <p className={`text-2xl font-bold ${totalLucro >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {formatCurrency(totalLucro)}
          </p>
        </div>
      </div>

      {/* Lista detalhada */}
      {fechamentosFiltrados.length === 0 ? (
        <div className="text-center text-gray-400 mt-8">
          <p>Nenhum fechamento no período selecionado.</p>
          <p className="text-sm mt-1">Ajuste o filtro ou registre novos fechamentos.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-600">
            {fechamentosFiltrados.length} fechamento(s) no período
          </p>

          {fechamentosFiltrados.map((f) => {
            const isExpanded = expandedId === f.id;
            return (
              <div key={f.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : f.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">
                        {f.atendimento?.cliente_nome || 'Cliente não encontrado'}
                      </p>
                      <span className="text-xs text-gray-400">{formatDate(f.created_at)}</span>
                    </div>
                    <div className="flex gap-4 text-sm mt-1">
                      <span className="text-gray-500">
                        Recebido: <strong className="text-gray-700">{formatCurrency(f.valor_recebido)}</strong>
                      </span>
                      <span className={f.lucro_final >= 0 ? 'text-green-600' : 'text-red-600'}>
                        Lucro: <strong>{formatCurrency(f.lucro_final)}</strong>
                      </span>
                    </div>
                  </div>
                  <span className={`text-gray-400 text-lg transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    ›
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 space-y-1">
                      {f.atendimento && (
                        <>
                          <p>{f.atendimento.tipo_servico}</p>
                          <p className="text-gray-400">
                            {[f.atendimento.endereco, f.atendimento.numero, f.atendimento.bairro, f.atendimento.cidade]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        </>
                      )}
                      <div className="pt-2 mt-2 border-t border-gray-200">
                        <p className="font-semibold text-gray-700">Custos:</p>
                        <p>Distribuidor: {formatCurrency(f.custo_distribuidor)}</p>
                        <p>Instalador: {formatCurrency(f.custo_instalador)}</p>
                        <p>Extras: {formatCurrency(f.custo_extras)}</p>
                        {f.observacoes_extras && (
                          <p className="mt-2 text-gray-500">Obs: {f.observacoes_extras}</p>
                        )}
                      </div>
                    </div>
                    {f.atendimento && (
                      <Link
                        to={`/atendimentos/${f.atendimento_id}`}
                        className="block mt-3 text-sm text-blue-600 font-medium no-underline"
                      >
                        Ver atendimento →
                      </Link>
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
