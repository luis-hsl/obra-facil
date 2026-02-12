import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import type { Atendimento } from '../types';
import StatusBadge from '../components/StatusBadge';
import LoadingSkeleton from '../components/LoadingSkeleton';

const TIMEZONE = 'America/Sao_Paulo';

function getDataBrasilia(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

interface FollowUp {
  atendimento: Atendimento;
  diasEnviado: number;
  orcamentoId: string;
}

export default function Agenda() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projetosAtivos, setProjetosAtivos] = useState(0);
  const [receitaMes, setReceitaMes] = useState(0);
  const [taxaConversao, setTaxaConversao] = useState(0);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [margemLucro, setMargemLucro] = useState(0);
  const [todosAtendimentos, setTodosAtendimentos] = useState<Atendimento[]>([]);
  const [orcPendentes, setOrcPendentes] = useState<Atendimento[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [visitasDias, setVisitasDias] = useState<Map<string, number>>(new Map());
  const [selectedDate, setSelectedDate] = useState<Date>(() => getDataBrasilia());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = getDataBrasilia();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    const hoje = getDataBrasilia();

    const [atdRes, fechRes, orcRes] = await Promise.all([
      supabase.from('atendimentos').select('*').eq('user_id', user!.id),
      supabase.from('fechamentos').select('valor_recebido, lucro_final, created_at'),
      supabase.from('orcamentos').select('*'),
    ]);

    const atendimentos: Atendimento[] = atdRes.data || [];
    const allOrcamentos = orcRes.data || [];
    const allFechamentos = fechRes.data || [];

    // KPI: Projetos ativos
    setProjetosAtivos(atendimentos.filter(a => !['concluido', 'reprovado'].includes(a.status)).length);

    // KPI: Receita do mês
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    setReceitaMes(allFechamentos.reduce((acc, f) => {
      const d = new Date(f.created_at);
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual ? acc + f.valor_recebido : acc;
    }, 0));

    // KPI: Taxa de conversão
    const enviados = allOrcamentos.filter(o => ['enviado', 'aprovado', 'reprovado'].includes(o.status));
    const aprovados = allOrcamentos.filter(o => o.status === 'aprovado');
    setTaxaConversao(enviados.length > 0 ? Math.round((aprovados.length / enviados.length) * 100) : 0);

    // KPI: Ticket médio
    const totalFech = allFechamentos.length;
    const somaRecebido = allFechamentos.reduce((acc, f) => acc + f.valor_recebido, 0);
    setTicketMedio(totalFech > 0 ? somaRecebido / totalFech : 0);

    // KPI: Margem de lucro
    const somaLucro = allFechamentos.reduce((acc, f) => acc + (f.lucro_final || 0), 0);
    setMargemLucro(somaRecebido > 0 ? Math.round((somaLucro / somaRecebido) * 100) : 0);

    // Guardar todos atendimentos para filtrar visitas por dia selecionado
    setTodosAtendimentos(atendimentos);

    // Map: dia -> contagem de visitas (para dots no calendário)
    const diasMap = new Map<string, number>();
    atendimentos.forEach(a => {
      if (a.data_visita) {
        const d = new Date(a.data_visita);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        diasMap.set(key, (diasMap.get(key) || 0) + 1);
      }
    });
    setVisitasDias(diasMap);

    // Follow-ups: orçamentos enviados há mais de 3 dias sem resposta
    const atdMap = new Map(atendimentos.map(a => [a.id, a]));
    const tresDiasAtras = new Date(hoje);
    tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);

    const followUpList = allOrcamentos
      .filter(o => {
        if (o.status !== 'enviado') return false;
        const atd = atdMap.get(o.atendimento_id);
        if (!atd || ['concluido', 'reprovado'].includes(atd.status)) return false;
        return new Date(o.created_at) < tresDiasAtras;
      })
      .map(o => {
        const atd = atdMap.get(o.atendimento_id)!;
        const dias = Math.floor((hoje.getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24));
        return { atendimento: atd, diasEnviado: dias, orcamentoId: o.id };
      })
      .filter((item, idx, arr) => arr.findIndex(x => x.atendimento.id === item.atendimento.id) === idx)
      .sort((a, b) => b.diasEnviado - a.diasEnviado)
      .slice(0, 5);
    setFollowUps(followUpList);

    // Orçamentos pendentes
    const pendentes = allOrcamentos
      .filter(o => {
        if (!['rascunho', 'enviado'].includes(o.status)) return false;
        const atd = atdMap.get(o.atendimento_id);
        return atd && !['concluido', 'reprovado'].includes(atd.status);
      })
      .map(o => atdMap.get(o.atendimento_id)!)
      .filter((atd, idx, arr) => arr.findIndex(x => x.id === atd.id) === idx)
      .slice(0, 5);
    setOrcPendentes(pendentes);

    setLoading(false);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatCurrencyShort = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE });

  const hoje = getDataBrasilia();
  const saudacao = hoje.getHours() < 12 ? 'Bom dia' : hoje.getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  // Calendar
  const calYear = calendarMonth.getFullYear();
  const calMonth = calendarMonth.getMonth();
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDayOfWeek = getFirstDayOfWeek(calYear, calMonth);
  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const prevMonth = () => setCalendarMonth(new Date(calYear, calMonth - 1, 1));
  const nextMonth = () => setCalendarMonth(new Date(calYear, calMonth + 1, 1));

  // Visitas do dia selecionado (derivado)
  const visitasDoDia = todosAtendimentos
    .filter(a => a.data_visita && isSameDay(new Date(a.data_visita), selectedDate))
    .sort((a, b) => new Date(a.data_visita!).getTime() - new Date(b.data_visita!).getTime());

  const isSelectedToday = isSameDay(selectedDate, hoje);

  const handleSelectDay = (day: number) => {
    setSelectedDate(new Date(calYear, calMonth, day));
  };

  const formatSelectedLabel = () => {
    if (isSelectedToday) return 'Visitas de Hoje';
    return `Visitas em ${selectedDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`;
  };

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
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{saudacao}!</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          {hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TIMEZONE })}
        </p>
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {/* Ativos */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-indigo-500 rounded-l-2xl" />
          <div className="flex items-center gap-3 pl-1">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-900 leading-none">{projetosAtivos}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">Projetos Ativos</p>
            </div>
          </div>
        </div>

        {/* Receita Mês */}
        <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-l-2xl" />
          <div className="flex items-center gap-3 pl-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-emerald-700 leading-none truncate">{formatCurrency(receitaMes)}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">Receita do Mês</p>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Conversão */}
        <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm text-center">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-1.5">
            <svg className="w-[18px] h-[18px] text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <p className="text-xl font-extrabold text-slate-900 leading-none">{taxaConversao}%</p>
          <p className="text-[10px] text-slate-400 font-semibold mt-1 uppercase tracking-wider">Conversão</p>
        </div>

        {/* Ticket Médio */}
        <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm text-center">
          <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center mx-auto mb-1.5">
            <svg className="w-[18px] h-[18px] text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
          <p className="text-base font-extrabold text-slate-900 leading-none truncate px-0.5">{formatCurrencyShort(ticketMedio)}</p>
          <p className="text-[10px] text-slate-400 font-semibold mt-1 uppercase tracking-wider">Ticket Médio</p>
        </div>

        {/* Margem de Lucro */}
        <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm text-center">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-1.5 ${
            margemLucro >= 30 ? 'bg-emerald-50' : margemLucro >= 15 ? 'bg-amber-50' : 'bg-red-50'
          }`}>
            <svg className={`w-[18px] h-[18px] ${
              margemLucro >= 30 ? 'text-emerald-600' : margemLucro >= 15 ? 'text-amber-600' : 'text-red-500'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className={`text-xl font-extrabold leading-none ${
            margemLucro >= 30 ? 'text-emerald-700' : margemLucro >= 15 ? 'text-amber-700' : 'text-red-600'
          }`}>{margemLucro}%</p>
          <p className="text-[10px] text-slate-400 font-semibold mt-1 uppercase tracking-wider">Margem</p>
        </div>
      </div>

      {/* Mini Calendar + Visitas de Hoje */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Calendar header */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
          <button onClick={prevMonth} className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-sm font-bold text-slate-700">
            {monthNames[calMonth]} {calYear}
          </h3>
          <button onClick={nextMonth} className="p-1.5 -mr-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Calendar grid */}
        <div className="px-3 pb-3">
          {/* Week headers */}
          <div className="grid grid-cols-7 mb-1">
            {weekDays.map((d, i) => (
              <div key={i} className="text-center text-[10px] font-bold text-slate-300 uppercase py-1">
                {d}
              </div>
            ))}
          </div>
          {/* Days */}
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`e-${i}`} className="p-0.5" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = day === hoje.getDate() && calMonth === hoje.getMonth() && calYear === hoje.getFullYear();
              const isSelected = day === selectedDate.getDate() && calMonth === selectedDate.getMonth() && calYear === selectedDate.getFullYear();
              const key = `${calYear}-${calMonth}-${day}`;
              const hasVisita = visitasDias.has(key);
              const count = visitasDias.get(key) || 0;

              return (
                <div key={day} className="p-0.5">
                  <button
                    onClick={() => handleSelectDay(day)}
                    className="w-full flex flex-col items-center"
                  >
                    <span
                      className={`
                        w-9 h-9 flex items-center justify-center text-[13px] rounded-2xl
                        transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                        ${isSelected
                          ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white font-bold scale-110 shadow-lg shadow-purple-500/40'
                          : isToday
                            ? 'bg-blue-50 text-blue-700 font-bold ring-[1.5px] ring-blue-300'
                            : hasVisita
                              ? 'bg-purple-100/80 text-purple-700 font-semibold hover:bg-purple-200/80 hover:scale-105'
                              : 'text-slate-500 font-medium hover:bg-slate-100/60 hover:scale-105'
                        }
                      `}
                      style={isSelected ? { animation: 'calPop 0.35s ease-out' } : undefined}
                    >
                      {day}
                    </span>
                    <div className="h-[7px] flex items-end">
                      {hasVisita && (
                        <div className={`flex gap-[3px] transition-opacity duration-300 ${isSelected ? 'opacity-0' : 'opacity-100'}`}>
                          {Array.from({ length: Math.min(count, 3) }).map((_, j) => (
                            <div key={j} className={`w-[6px] h-[6px] rounded-full transition-all duration-300 ${isToday ? 'bg-blue-500' : 'bg-purple-500'}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Keyframe para animação de seleção */}
          <style>{`
            @keyframes calPop {
              0% { transform: scale(0.85); opacity: 0.5; box-shadow: 0 0 0 0 rgba(147,51,234,0.5); }
              50% { transform: scale(1.18); box-shadow: 0 8px 24px -4px rgba(147,51,234,0.45); }
              100% { transform: scale(1.1); box-shadow: 0 4px 12px -2px rgba(147,51,234,0.4); }
            }
          `}</style>
        </div>

        {/* Visitas do dia selecionado */}
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{formatSelectedLabel()}</p>
            </div>
            {visitasDoDia.length > 0 && (
              <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">
                {visitasDoDia.length}
              </span>
            )}
          </div>
          {visitasDoDia.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-3">
              {isSelectedToday ? 'Nenhuma visita agendada para hoje' : 'Nenhuma visita neste dia'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {visitasDoDia.map((v) => (
                <button
                  key={v.id}
                  onClick={() => navigate(`/atendimentos/${v.id}`)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-purple-50/50 transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-100 transition-colors">
                    <span className="text-xs font-bold text-purple-600 leading-none">{formatTime(v.data_visita!)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{v.cliente_nome}</p>
                    <p className="text-[11px] text-slate-400 truncate">{v.tipo_servico} — {v.endereco}</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-300 flex-shrink-0 group-hover:text-purple-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Follow-up: Orçamentos sem resposta */}
      {followUps.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-red-50 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              Aguardando Resposta
            </h3>
            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              {followUps.length}
            </span>
          </div>
          <div className="space-y-2">
            {followUps.map((f) => (
              <button
                key={f.orcamentoId}
                onClick={() => navigate(`/atendimentos/${f.atendimento.id}`)}
                className="w-full bg-white rounded-xl border border-red-100 p-3 shadow-sm text-left hover:border-red-200 hover:shadow-md transition-all flex items-center gap-3 group"
              >
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 group-hover:bg-red-100 transition-colors">
                  <span className="text-xs font-extrabold text-red-600">{f.diasEnviado}d</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{f.atendimento.cliente_nome}</p>
                  <p className="text-xs text-slate-400 truncate">Orçamento enviado há {f.diasEnviado} dias</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 flex-shrink-0 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Orçamentos Pendentes */}
      {orcPendentes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-amber-50 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              Orçamentos Pendentes
            </h3>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              {orcPendentes.length}
            </span>
          </div>
          <div className="space-y-2">
            {orcPendentes.map((atd) => (
              <button
                key={atd.id}
                onClick={() => navigate(`/atendimentos/${atd.id}`)}
                className="w-full bg-white rounded-xl border border-slate-100 p-3 shadow-sm text-left hover:border-amber-200 hover:shadow-md transition-all flex items-center gap-3 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 text-sm truncate">{atd.cliente_nome}</p>
                    <StatusBadge status={atd.status} />
                  </div>
                  <p className="text-xs text-slate-400 truncate">{atd.tipo_servico}</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 flex-shrink-0 group-hover:text-amber-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
