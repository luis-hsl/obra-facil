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
  { value: 'personalizado', label: 'Personalizado' },
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-slate-900">Financeiro</h2>
        {d.fechamentosFiltrados.length > 0 && (
          <div className="flex gap-2">
            <button onClick={d.exportPDF} className="px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg">
              PDF
            </button>
            <button onClick={d.exportCSV} className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm">
              CSV
            </button>
          </div>
        )}
      </div>

      {d.erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-red-600 text-sm">{d.erro}</p>
        </div>
      )}

      {/* Period filter */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-700 mb-2">Período</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { d.setPeriodo(opt.value); d.setActiveMonthFilter(null); }}
              className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold ${
                d.periodo === opt.value
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {d.periodo === 'personalizado' && (
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1 font-medium">De</label>
              <input type="date" value={d.dataInicio} onChange={e => d.setDataInicio(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1 font-medium">Até</label>
              <input type="date" value={d.dataFim} onChange={e => d.setDataFim(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
            </div>
            {d.dateError && <p className="text-xs text-red-500 font-semibold">Data inicial deve ser anterior à final</p>}
          </div>
        )}
      </div>

      {/* KPIs */}
      <KpiCards kpis={d.kpis} deltas={d.kpiDeltas} />

      {/* Charts grid — desktop 3 cols */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Revenue & Profit — 2/3 */}
        <div className="md:col-span-2">
          <RevenueProfitChart
            data={d.trendData}
            activeMonth={d.activeMonthFilter}
            onMonthClick={d.setActiveMonthFilter}
          />
        </div>

        {/* Cost breakdown donut — 1/3 */}
        <div>
          <CostBreakdownChart data={d.costBreakdown} />
        </div>

        {/* Insights — 2/3 */}
        <div className="md:col-span-2">
          <InsightsPanel insights={insights} />
        </div>

        {/* Revenue by service — 1/3 */}
        <div>
          <RevenueByServiceChart data={d.revenueByService} />
        </div>

        {/* Profit margin chart — 2/3 */}
        <div className="md:col-span-2">
          <ProfitMarginChart data={d.marginTrend} />
        </div>

        {/* Top clients — 1/3 */}
        <div>
          <TopClients data={d.topClients} />
        </div>
      </div>

      {/* Fechamentos list */}
      <FechamentosList fechamentos={d.fechamentosFiltrados} />
    </div>
  );
}
