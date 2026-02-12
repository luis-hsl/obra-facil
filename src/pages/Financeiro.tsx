import { useMemo } from 'react';
import { useFinanceiroData } from '../lib/financeiro/useFinanceiroData';
import type { Periodo } from '../lib/financeiro/useFinanceiroData';
import { computeInsights } from '../lib/financeiro/computeInsights';
import LoadingSkeleton from '../components/LoadingSkeleton';
import KpiCards from '../components/financeiro/KpiCards';
import RevenueProfitChart from '../components/financeiro/RevenueProfitChart';
import CostBreakdownChart from '../components/financeiro/CostBreakdownChart';
import RevenueByServiceChart from '../components/financeiro/RevenueByServiceChart';
import TopClients from '../components/financeiro/TopClients';
import ProfitMarginChart from '../components/financeiro/ProfitMarginChart';
import InsightsPanel from '../components/financeiro/InsightsPanel';
import FechamentosList from '../components/financeiro/FechamentosList';

const PERIOD_OPTIONS: { value: Periodo; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
  { value: 'ano', label: 'Ano' },
  { value: 'personalizado', label: 'Custom' },
];

export default function Financeiro() {
  const d = useFinanceiroData();

  const insights = useMemo(() =>
    computeInsights({
      receita: d.kpis.receita,
      custos: d.kpis.custos,
      lucro: d.kpis.lucro,
      margem: d.kpis.margem,
      numProjetos: d.kpis.numProjetos,
      receitaAnterior: d.receitaAnterior,
      lucroAnterior: d.lucroAnterior,
      margemAnterior: d.margemAnterior,
      topClients: d.topClients,
      revenueByService: d.revenueByService,
      trendData: d.trendData,
    }),
  [d.kpis, d.receitaAnterior, d.lucroAnterior, d.margemAnterior, d.topClients, d.revenueByService, d.trendData]);

  if (d.loading) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-5">Financeiro</h2>
        <LoadingSkeleton type="kpi" />
        <div className="mt-4"><LoadingSkeleton count={3} /></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header — title + period + export all inline */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Financeiro</h2>
          {d.fechamentosFiltrados.length > 0 && (
            <div className="flex gap-2">
              <button onClick={d.exportPDF} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                PDF
              </button>
              <button onClick={d.exportCSV} className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                CSV
              </button>
            </div>
          )}
        </div>

        {/* Period pills inline */}
        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { d.setPeriodo(opt.value); d.setActiveMonthFilter(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                d.periodo === opt.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {d.periodo === 'personalizado' && (
            <>
              <div className="flex items-center gap-1.5 ml-1">
                <input type="date" value={d.dataInicio} onChange={e => d.setDataInicio(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-xs text-slate-400">a</span>
                <input type="date" value={d.dataFim} onChange={e => d.setDataFim(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {d.dateError && <span className="text-xs text-red-500 font-semibold">Datas inválidas</span>}
            </>
          )}
        </div>
      </div>

      {d.erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-red-600 text-sm">{d.erro}</p>
        </div>
      )}

      {/* KPIs */}
      <KpiCards kpis={d.kpis} deltas={d.kpiDeltas} />

      {/* Row 1: Revenue chart + Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <RevenueProfitChart
            data={d.trendData}
            activeMonth={d.activeMonthFilter}
            onMonthClick={d.setActiveMonthFilter}
          />
        </div>
        <div className="flex flex-col gap-5">
          <CostBreakdownChart data={d.costBreakdown} />
        </div>
      </div>

      {/* Row 2: Insights + Revenue by service */}
      {(insights.length > 0 || d.revenueByService.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {insights.length > 0 && (
            <div className="lg:col-span-2">
              <InsightsPanel insights={insights} />
            </div>
          )}
          {d.revenueByService.length > 0 && (
            <div className={insights.length === 0 ? 'lg:col-span-3' : ''}>
              <RevenueByServiceChart data={d.revenueByService} />
            </div>
          )}
        </div>
      )}

      {/* Row 3: Margin chart + Top clients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <ProfitMarginChart data={d.marginTrend} />
        </div>
        <div>
          <TopClients data={d.topClients} />
        </div>
      </div>

      {/* Fechamentos */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 rounded-full bg-gradient-to-b from-blue-600 to-indigo-600" />
          <h3 className="text-lg font-bold text-slate-900">Fechamentos</h3>
        </div>
        <FechamentosList fechamentos={d.fechamentosFiltrados} />
      </div>
    </div>
  );
}
