import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import type { Atendimento } from '../types';
import StatusBadge from '../components/StatusBadge';
import LoadingSkeleton from '../components/LoadingSkeleton';

const TIMEZONE = 'America/Sao_Paulo';
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function getDataBrasilia(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(d: Date) {
  return isSameDay(d, new Date());
}

export default function Agenda() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [visitas, setVisitas] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);

  // Dashboard KPIs
  const [projetosAtivos, setProjetosAtivos] = useState(0);
  const [receitaMes, setReceitaMes] = useState(0);
  const [orcPendentes, setOrcPendentes] = useState<Atendimento[]>([]);

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user, currentMonth]);

  const loadAll = async () => {
    setLoading(true);
    const hoje = getDataBrasilia();

    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);

    const [atdRes, fechRes, orcRes] = await Promise.all([
      supabase.from('atendimentos').select('*').eq('user_id', user!.id),
      supabase.from('fechamentos').select('valor_recebido, created_at'),
      supabase.from('orcamentos').select('*').in('status', ['rascunho', 'enviado']),
    ]);

    const atendimentos: Atendimento[] = atdRes.data || [];

    // Visitas do mês (para o calendário)
    const visitasMes = atendimentos.filter(a => {
      if (!a.data_visita) return false;
      const dv = new Date(a.data_visita);
      return dv >= start && dv <= end;
    }).sort((a, b) => new Date(a.data_visita!).getTime() - new Date(b.data_visita!).getTime());
    setVisitas(visitasMes);

    // KPI: Projetos ativos
    setProjetosAtivos(atendimentos.filter(a => !['concluido', 'reprovado'].includes(a.status)).length);

    // KPI: Receita do mês
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    setReceitaMes((fechRes.data || []).reduce((acc, f) => {
      const d = new Date(f.created_at);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual ? acc + f.valor_recebido : acc;
    }, 0));

    // Orçamentos pendentes
    const atdMap = new Map(atendimentos.map(a => [a.id, a]));
    const pendentes = (orcRes.data || [])
      .filter(o => {
        const atd = atdMap.get(o.atendimento_id);
        return atd && !['concluido', 'reprovado'].includes(atd.status);
      })
      .map(o => atdMap.get(o.atendimento_id)!)
      .filter((atd, idx, arr) => arr.findIndex(x => x.id === atd.id) === idx)
      .slice(0, 5);
    setOrcPendentes(pendentes);

    setLoading(false);
  };

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const goToday = () => {
    setCurrentMonth(startOfMonth(new Date()));
    setSelectedDate(new Date());
  };

  // Calendar grid
  const totalDays = daysInMonth(currentMonth);
  const firstDow = currentMonth.getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) {
    cells.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d));
  }

  // Map: dateKey -> visits
  const visitasPorDia = new Map<string, Atendimento[]>();
  for (const v of visitas) {
    if (!v.data_visita) continue;
    const dt = new Date(v.data_visita);
    const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
    if (!visitasPorDia.has(key)) visitasPorDia.set(key, []);
    visitasPorDia.get(key)!.push(v);
  }

  const getVisitsForDate = (d: Date) => {
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return visitasPorDia.get(key) || [];
  };

  const selectedVisits = getVisitsForDate(selectedDate);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const hoje = getDataBrasilia();
  const saudacao = hoje.getHours() < 12 ? 'Bom dia' : hoje.getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-5">{saudacao}!</h2>
        <LoadingSkeleton type="kpi" />
        <div className="mt-4"><LoadingSkeleton count={3} /></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-slate-900">{saudacao}!</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          {hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TIMEZONE })}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Ativos</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{projetosAtivos}</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-100 p-4 shadow-sm">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Receita Mês</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(receitaMes)}</p>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={goToday} className="text-lg font-bold text-slate-900 hover:text-blue-600">
            {MESES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </button>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="text-center text-xs font-bold text-slate-400 py-1.5">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((date, i) => {
            if (!date) return <div key={`e-${i}`} />;
            const dayVisits = getVisitsForDate(date);
            const isSelected = isSameDay(date, selectedDate);
            const today = isToday(date);
            return (
              <button
                key={date.getDate()}
                onClick={() => setSelectedDate(date)}
                className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors duration-150 ${
                  isSelected
                    ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30'
                    : today
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {date.getDate()}
                {dayVisits.length > 0 && (
                  <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
                    isSelected ? 'bg-white' : 'bg-purple-500'
                  }`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Visits for selected date */}
      <div className="mb-2">
        <h3 className="text-sm font-bold text-slate-700 mb-2">
          {isToday(selectedDate) ? 'Visitas de Hoje' : `Visitas — ${selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}`}
          {selectedVisits.length > 0 && (
            <span className="ml-2 text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
              {selectedVisits.length}
            </span>
          )}
        </h3>
      </div>

      {selectedVisits.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-6 text-center shadow-sm mb-5">
          <p className="text-sm text-slate-400">Nenhuma visita agendada para este dia.</p>
        </div>
      ) : (
        <div className="space-y-2 mb-5">
          {selectedVisits.map((v) => (
            <button
              key={v.id}
              onClick={() => navigate(`/atendimentos/${v.id}`)}
              className="w-full bg-white rounded-xl border border-slate-100 p-4 shadow-sm text-left hover:border-blue-200 hover:shadow-md transition-all duration-150"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-purple-600">{formatTime(v.data_visita!)}</span>
                    <StatusBadge status={v.status} />
                  </div>
                  <p className="text-base font-bold text-slate-900 truncate">{v.cliente_nome}</p>
                  <p className="text-sm text-slate-500 truncate">{v.endereco}{v.numero ? `, ${v.numero}` : ''}{v.bairro ? ` — ${v.bairro}` : ''}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{v.tipo_servico}</p>
                </div>
                <svg className="w-5 h-5 text-slate-300 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              {v.observacoes_visita && (
                <p className="text-xs text-slate-400 mt-2 italic border-t border-slate-50 pt-2">{v.observacoes_visita}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Orçamentos Pendentes */}
      {orcPendentes.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-700">Orçamentos Pendentes</h3>
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              {orcPendentes.length}
            </span>
          </div>
          <div className="space-y-2">
            {orcPendentes.map((atd) => (
              <button
                key={atd.id}
                onClick={() => navigate(`/atendimentos/${atd.id}`)}
                className="w-full bg-white rounded-xl border border-slate-100 p-3 shadow-sm text-left hover:border-amber-200 transition-colors flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 text-sm truncate">{atd.cliente_nome}</p>
                    <StatusBadge status={atd.status} />
                  </div>
                  <p className="text-xs text-slate-400 truncate">{atd.tipo_servico}</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick action */}
      <Link
        to="/atendimentos/novo"
        className="block w-full py-3.5 text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98] no-underline"
      >
        + Novo Atendimento
      </Link>
    </div>
  );
}
