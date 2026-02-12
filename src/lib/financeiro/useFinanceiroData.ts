import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../supabase';
import type { Atendimento, Fechamento } from '../../types';
import { useBrandConfig } from '../useBrandConfig';
import { fetchImageAsBase64 } from '../imageUtils';
import { gerarRelatorioFinanceiroPDF } from '../gerarRelatorioFinanceiroPDF';
import { computeDelta } from './chartUtils';

export interface FechamentoComAtendimento extends Fechamento {
  atendimento?: Atendimento;
}

export type Periodo = 'hoje' | 'semana' | 'mes' | 'ano' | 'personalizado';

const TIMEZONE = 'America/Sao_Paulo';

function getDataBrasilia(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
}

function formatDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toUTCStartOfDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0)).toISOString();
}

function toUTCEndOfDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1, 2, 59, 59, 999)).toISOString();
}

function calcularRange(periodo: Periodo, dataInicio?: string, dataFim?: string): { inicio: string; fim: string } | null {
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

function calcularRangeAnterior(periodo: Periodo, dataInicio?: string, dataFim?: string): { inicio: string; fim: string } | null {
  const hoje = getDataBrasilia();
  switch (periodo) {
    case 'hoje': {
      const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
      const h = formatDateInput(ontem);
      return { inicio: toUTCStartOfDay(h), fim: toUTCEndOfDay(h) };
    }
    case 'semana': {
      const ini = new Date(hoje); ini.setDate(hoje.getDate() - hoje.getDay() - 7);
      const fim = new Date(ini); fim.setDate(ini.getDate() + 6);
      return { inicio: toUTCStartOfDay(formatDateInput(ini)), fim: toUTCEndOfDay(formatDateInput(fim)) };
    }
    case 'mes': {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
      return { inicio: toUTCStartOfDay(formatDateInput(ini)), fim: toUTCEndOfDay(formatDateInput(fim)) };
    }
    case 'ano': {
      const ini = new Date(hoje.getFullYear() - 1, 0, 1);
      const fim = new Date(hoje.getFullYear() - 1, 11, 31);
      return { inicio: toUTCStartOfDay(formatDateInput(ini)), fim: toUTCEndOfDay(formatDateInput(fim)) };
    }
    case 'personalizado': {
      if (!dataInicio || !dataFim) return null;
      const d1 = new Date(dataInicio);
      const d2 = new Date(dataFim);
      const diff = d2.getTime() - d1.getTime();
      const prevEnd = new Date(d1.getTime() - 86400000);
      const prevStart = new Date(prevEnd.getTime() - diff);
      return { inicio: toUTCStartOfDay(formatDateInput(prevStart)), fim: toUTCEndOfDay(formatDateInput(prevEnd)) };
    }
    default: return null;
  }
}

function filterByRange(items: FechamentoComAtendimento[], range: { inicio: string; fim: string } | null): FechamentoComAtendimento[] {
  if (!range) return items;
  return items.filter(f => {
    const iso = new Date(f.created_at).toISOString();
    return iso >= range.inicio && iso <= range.fim;
  });
}

export interface TrendMonth {
  label: string;
  yearMonth: string;
  recebido: number;
  custos: number;
  lucro: number;
  margem: number;
}

export function useFinanceiroData() {
  const [fechamentos, setFechamentos] = useState<FechamentoComAtendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const { config: brandConfig } = useBrandConfig();

  const hoje = getDataBrasilia();
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [dataInicio, setDataInicio] = useState(formatDateInput(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
  const [dataFim, setDataFim] = useState(formatDateInput(hoje));
  const [activeMonthFilter, setActiveMonthFilter] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [fechRes, atdRes] = await Promise.all([
        supabase.from('fechamentos').select('*').order('created_at', { ascending: false }),
        supabase.from('atendimentos').select('*'),
      ]);
      if (fechRes.error) { setErro('Erro ao carregar dados financeiros.'); setLoading(false); return; }
      const map: Record<string, Atendimento> = {};
      (atdRes.data || []).forEach(a => { map[a.id] = a; });
      setFechamentos((fechRes.data || []).map(f => ({ ...f, atendimento: map[f.atendimento_id] })));
      setLoading(false);
    })();
  }, []);

  const dateError = periodo === 'personalizado' && dataInicio && dataFim && dataInicio > dataFim;

  // Current period filtered
  const fechamentosFiltrados = useMemo(() => {
    if (dateError) return [];
    const range = calcularRange(periodo, dataInicio, dataFim);
    let filtered = filterByRange(fechamentos, range);
    if (activeMonthFilter) {
      filtered = filtered.filter(f => {
        const d = new Date(f.created_at);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === activeMonthFilter;
      });
    }
    return filtered;
  }, [fechamentos, periodo, dataInicio, dataFim, dateError, activeMonthFilter]);

  // Previous period for deltas
  const fechamentosAnterior = useMemo(() => {
    if (dateError) return [];
    const range = calcularRangeAnterior(periodo, dataInicio, dataFim);
    return filterByRange(fechamentos, range);
  }, [fechamentos, periodo, dataInicio, dataFim, dateError]);

  // KPIs
  const kpis = useMemo(() => {
    const receita = fechamentosFiltrados.reduce((s, f) => s + f.valor_recebido, 0);
    const custos = fechamentosFiltrados.reduce((s, f) => s + f.custo_distribuidor + f.custo_instalador + f.custo_extras, 0);
    const lucro = fechamentosFiltrados.reduce((s, f) => s + f.lucro_final, 0);
    const margem = receita > 0 ? (lucro / receita) * 100 : 0;
    const numProjetos = fechamentosFiltrados.length;
    const ticketMedio = numProjetos > 0 ? receita / numProjetos : 0;
    return { receita, custos, lucro, margem, ticketMedio, numProjetos };
  }, [fechamentosFiltrados]);

  const kpisAnterior = useMemo(() => {
    const receita = fechamentosAnterior.reduce((s, f) => s + f.valor_recebido, 0);
    const custos = fechamentosAnterior.reduce((s, f) => s + f.custo_distribuidor + f.custo_instalador + f.custo_extras, 0);
    const lucro = fechamentosAnterior.reduce((s, f) => s + f.lucro_final, 0);
    const margem = receita > 0 ? (lucro / receita) * 100 : 0;
    const numProjetos = fechamentosAnterior.length;
    const ticketMedio = numProjetos > 0 ? receita / numProjetos : 0;
    return { receita, custos, lucro, margem, ticketMedio, numProjetos };
  }, [fechamentosAnterior]);

  const kpiDeltas = useMemo(() => ({
    receita: computeDelta(kpis.receita, kpisAnterior.receita),
    custos: computeDelta(kpis.custos, kpisAnterior.custos),
    lucro: computeDelta(kpis.lucro, kpisAnterior.lucro),
    margem: computeDelta(kpis.margem, kpisAnterior.margem),
    ticketMedio: computeDelta(kpis.ticketMedio, kpisAnterior.ticketMedio),
    numProjetos: computeDelta(kpis.numProjetos, kpisAnterior.numProjetos),
  }), [kpis, kpisAnterior]);

  // 12-month trend
  const trendData = useMemo(() => {
    const now = getDataBrasilia();
    const months: TrendMonth[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('pt-BR', { month: 'short', timeZone: TIMEZONE }).replace('.', '');
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      let recebido = 0, custos = 0, lucro = 0;
      fechamentos.forEach(f => {
        const fd = new Date(f.created_at);
        if (`${fd.getFullYear()}-${String(fd.getMonth() + 1).padStart(2, '0')}` === ym) {
          recebido += f.valor_recebido;
          custos += f.custo_distribuidor + f.custo_instalador + f.custo_extras;
          lucro += f.lucro_final;
        }
      });
      const margem = recebido > 0 ? (lucro / recebido) * 100 : 0;
      months.push({ label, yearMonth: ym, recebido, custos, lucro, margem });
    }
    return months;
  }, [fechamentos]);

  // Cost breakdown
  const costBreakdown = useMemo(() => {
    const distribuidor = fechamentosFiltrados.reduce((s, f) => s + f.custo_distribuidor, 0);
    const instalador = fechamentosFiltrados.reduce((s, f) => s + f.custo_instalador, 0);
    const extras = fechamentosFiltrados.reduce((s, f) => s + f.custo_extras, 0);
    return { distribuidor, instalador, extras };
  }, [fechamentosFiltrados]);

  // Revenue by service
  const revenueByService = useMemo(() => {
    const map: Record<string, { receita: number; lucro: number }> = {};
    fechamentosFiltrados.forEach(f => {
      const servico = f.atendimento?.tipo_servico || 'Outro';
      if (!map[servico]) map[servico] = { receita: 0, lucro: 0 };
      map[servico].receita += f.valor_recebido;
      map[servico].lucro += f.lucro_final;
    });
    return Object.entries(map)
      .map(([servico, v]) => ({ servico, ...v }))
      .sort((a, b) => b.receita - a.receita)
      .slice(0, 6);
  }, [fechamentosFiltrados]);

  // Top clients
  const topClients = useMemo(() => {
    const map: Record<string, { receita: number; lucro: number; projetos: number }> = {};
    fechamentosFiltrados.forEach(f => {
      const nome = f.atendimento?.cliente_nome || 'Desconhecido';
      if (!map[nome]) map[nome] = { receita: 0, lucro: 0, projetos: 0 };
      map[nome].receita += f.valor_recebido;
      map[nome].lucro += f.lucro_final;
      map[nome].projetos += 1;
    });
    return Object.entries(map)
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.receita - a.receita)
      .slice(0, 5);
  }, [fechamentosFiltrados]);

  // Margin trend (12 months)
  const marginTrend = useMemo(() =>
    trendData.map(m => ({ label: m.label, margem: m.margem })),
  [trendData]);

  // Export CSV
  const exportCSV = useCallback(() => {
    const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { timeZone: TIMEZONE });
    const header = 'Cliente,Serviço,Data,Recebido,Distribuidor,Instalador,Extras,Lucro\n';
    const rows = fechamentosFiltrados.map(f =>
      `"${f.atendimento?.cliente_nome || 'N/A'}","${f.atendimento?.tipo_servico || 'N/A'}",${formatDate(f.created_at)},${f.valor_recebido},${f.custo_distribuidor},${f.custo_instalador},${f.custo_extras},${f.lucro_final}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financeiro-${formatDateInput(getDataBrasilia())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [fechamentosFiltrados]);

  // Export PDF
  const exportPDF = useCallback(async () => {
    let logoBase64: string | null = null;
    if (brandConfig?.logo_url) {
      try { logoBase64 = await fetchImageAsBase64(brandConfig.logo_url); } catch { /* ignore */ }
    }
    const periodoLabels: Record<Periodo, string> = {
      hoje: 'Hoje',
      semana: 'Semana Atual',
      mes: getDataBrasilia().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: TIMEZONE }),
      ano: `Ano ${getDataBrasilia().getFullYear()}`,
      personalizado: `${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')}`,
    };
    gerarRelatorioFinanceiroPDF({
      periodo: periodoLabels[periodo],
      fechamentos: fechamentosFiltrados,
      totais: { recebido: kpis.receita, custos: kpis.custos, lucro: kpis.lucro },
      brandConfig,
      logoBase64,
    });
  }, [fechamentosFiltrados, kpis, periodo, dataInicio, dataFim, brandConfig]);

  return {
    loading, erro,
    periodo, setPeriodo, dataInicio, setDataInicio, dataFim, setDataFim, dateError,
    fechamentosFiltrados,
    kpis, kpiDeltas,
    trendData, costBreakdown, revenueByService, topClients, marginTrend,
    activeMonthFilter, setActiveMonthFilter,
    exportCSV, exportPDF,
    receitaAnterior: kpisAnterior.receita,
    lucroAnterior: kpisAnterior.lucro,
    margemAnterior: kpisAnterior.margem,
    brandConfig,
  };
}
