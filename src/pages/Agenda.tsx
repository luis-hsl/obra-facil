import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import type { Atendimento } from '../types';
import StatusBadge from '../components/StatusBadge';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { STATUS_ORDER, STATUS_CONFIG } from '../lib/statusConfig';

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

type FollowUpStage = 1 | 2 | 3;

interface FollowUp {
  atendimento: Atendimento;
  diasDesdeContato: number;
  stage: FollowUpStage;
}

const STAGE_CONFIG: Record<FollowUpStage, { label: string; sublabel: string; action: string; color: string; bgColor: string; hoverBg: string }> = {
  1: { label: '1o Follow-up', sublabel: 'Enviar WhatsApp', action: 'WhatsApp', color: 'text-green-700', bgColor: 'bg-green-50', hoverBg: 'hover:bg-green-100' },
  2: { label: '2o Follow-up', sublabel: 'Ligar diretamente', action: 'Ligar', color: 'text-blue-700', bgColor: 'bg-blue-50', hoverBg: 'hover:bg-blue-100' },
  3: { label: 'Último follow-up', sublabel: 'Tentativa final', action: 'WhatsApp', color: 'text-orange-700', bgColor: 'bg-orange-50', hoverBg: 'hover:bg-orange-100' },
};

export default function Agenda() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [novosNaSemana, setNovosNaSemana] = useState(0);
  const [semAcao, setSemAcao] = useState(0);
  const [todosAtendimentos, setTodosAtendimentos] = useState<Atendimento[]>([]);
  const [orcPendentes, setOrcPendentes] = useState<Atendimento[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [followUpLoading, setFollowUpLoading] = useState<string | null>(null);
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

    const [atdRes, orcRes] = await Promise.all([
      supabase.from('atendimentos').select('*').eq('user_id', user!.id),
      supabase.from('orcamentos').select('*'),
    ]);

    const atendimentos: Atendimento[] = atdRes.data || [];
    const allOrcamentos = orcRes.data || [];

    // KPI: Novos na semana
    const umaSemanaAtras = new Date(hoje);
    umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);
    setNovosNaSemana(atendimentos.filter(a => new Date(a.created_at) >= umaSemanaAtras).length);

    // KPI: Sem ação (5+ dias sem progresso)
    const cincoDiasAtras = new Date(hoje);
    cincoDiasAtras.setDate(cincoDiasAtras.getDate() - 5);
    setSemAcao(atendimentos.filter(a => {
      if (['concluido', 'reprovado'].includes(a.status)) return false;
      const lastActivity = a.ultimo_followup_at || a.created_at;
      return new Date(lastActivity) < cincoDiasAtras;
    }).length);

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

    // Follow-ups: sistema de 3 estágios
    // Estágio 1: count=0, criado há 3+ dias, ainda em 'iniciado' → WhatsApp
    // Estágio 2: count=1, último follow-up há 4+ dias, status ativo → Ligar
    // Estágio 3: count=2, último follow-up há 15+ dias, status ativo → Último
    const atdMap = new Map(atendimentos.map(a => [a.id, a]));
    const ACTIVE_STATUSES = ['iniciado', 'visita_tecnica', 'medicao', 'orcamento'];
    const daysSince = (dateStr: string) =>
      Math.floor((hoje.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));

    const followUpList: FollowUp[] = atendimentos
      .filter(a => ACTIVE_STATUSES.includes(a.status))
      .map(a => {
        const count = a.followup_count || 0;
        if (count === 0 && a.status === 'iniciado' && daysSince(a.created_at) >= 3) {
          return { atendimento: a, diasDesdeContato: daysSince(a.created_at), stage: 1 as FollowUpStage };
        }
        if (count === 1 && a.ultimo_followup_at && daysSince(a.ultimo_followup_at) >= 4) {
          return { atendimento: a, diasDesdeContato: daysSince(a.ultimo_followup_at), stage: 2 as FollowUpStage };
        }
        if (count === 2 && a.ultimo_followup_at && daysSince(a.ultimo_followup_at) >= 15) {
          return { atendimento: a, diasDesdeContato: daysSince(a.ultimo_followup_at), stage: 3 as FollowUpStage };
        }
        return null;
      })
      .filter((f): f is FollowUp => f !== null)
      .sort((a, b) => a.stage - b.stage || b.diasDesdeContato - a.diasDesdeContato)
      .slice(0, 10);
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

  const handleFollowUpDone = async (atendimentoId: string) => {
    setFollowUpLoading(atendimentoId);
    const atd = todosAtendimentos.find(a => a.id === atendimentoId);
    const newCount = (atd?.followup_count || 0) + 1;
    const now = new Date().toISOString();
    await supabase
      .from('atendimentos')
      .update({ ultimo_followup_at: now, followup_count: newCount })
      .eq('id', atendimentoId);
    setFollowUps(prev => prev.filter(f => f.atendimento.id !== atendimentoId));
    setTodosAtendimentos(prev =>
      prev.map(a => a.id === atendimentoId ? { ...a, ultimo_followup_at: now, followup_count: newCount } : a)
    );
    setFollowUpLoading(null);
  };

  const handleFollowUpCall = (atendimento: Atendimento) => {
    let tel = (atendimento.cliente_telefone || '').replace(/\D/g, '');
    if (tel.length >= 10 && tel.length <= 11 && !tel.startsWith('55')) {
      tel = '55' + tel;
    }
    window.open(`tel:+${tel}`, '_self');
  };

  const handleFollowUpWhatsApp = (atendimento: Atendimento) => {
    let tel = (atendimento.cliente_telefone || '').replace(/\D/g, '');
    if (tel.length >= 10 && tel.length <= 11 && !tel.startsWith('55')) {
      tel = '55' + tel;
    }
    const msg = encodeURIComponent(
      `Olá ${atendimento.cliente_nome}! Tudo bem? Gostaria de saber se tem alguma novidade sobre nosso orçamento. Fico à disposição!`
    );
    window.open(`https://wa.me/${tel}?text=${msg}`, '_blank');
  };

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

  const visitasHoje = todosAtendimentos.filter(a => a.data_visita && isSameDay(new Date(a.data_visita), hoje)).length;
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
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{saudacao}!</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TIMEZONE })}
          </p>
        </div>
        <Link
          to="/atendimentos/novo"
          className="hidden md:inline-flex bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold no-underline shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]"
        >
          + Novo Atendimento
        </Link>
      </div>

      {/* KPIs — 5 cards operacionais */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {/* Visitas Hoje */}
        <div className="bg-white rounded-2xl border border-purple-100 p-3.5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Visitas Hoje</p>
          </div>
          <p className="text-2xl font-extrabold text-purple-700 leading-none">{visitasHoje}</p>
        </div>

        {/* Follow-ups */}
        <div className={`bg-white rounded-2xl border p-3.5 shadow-sm ${followUps.length > 0 ? 'border-red-100' : 'border-slate-100'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${followUps.length > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
              <svg className={`w-4 h-4 ${followUps.length > 0 ? 'text-red-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Follow-ups</p>
          </div>
          <p className={`text-2xl font-extrabold leading-none ${followUps.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>{followUps.length}</p>
        </div>

        {/* Orçamentos Pendentes */}
        <div className={`bg-white rounded-2xl border p-3.5 shadow-sm ${orcPendentes.length > 0 ? 'border-amber-100' : 'border-slate-100'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${orcPendentes.length > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
              <svg className={`w-4 h-4 ${orcPendentes.length > 0 ? 'text-amber-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Orçamentos</p>
          </div>
          <p className={`text-2xl font-extrabold leading-none ${orcPendentes.length > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{orcPendentes.length}</p>
        </div>

        {/* Novos na Semana */}
        <div className="bg-white rounded-2xl border border-blue-100 p-3.5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Novos/Semana</p>
          </div>
          <p className="text-2xl font-extrabold text-blue-700 leading-none">{novosNaSemana}</p>
        </div>

        {/* Sem Ação */}
        <div className={`bg-white rounded-2xl border p-3.5 shadow-sm col-span-2 sm:col-span-1 ${semAcao > 0 ? 'border-orange-100' : 'border-slate-100'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${semAcao > 0 ? 'bg-orange-50' : 'bg-slate-50'}`}>
              <svg className={`w-4 h-4 ${semAcao > 0 ? 'text-orange-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Sem Ação</p>
          </div>
          <p className={`text-2xl font-extrabold leading-none ${semAcao > 0 ? 'text-orange-600' : 'text-slate-900'}`}>{semAcao}</p>
        </div>
      </div>

      {/* Pipeline de Atendimentos */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-blue-600 to-indigo-600" />
          <p className="text-sm font-bold text-slate-700">Pipeline</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_ORDER.map(status => {
            const count = todosAtendimentos.filter(a => a.status === status).length;
            const cfg = STATUS_CONFIG[status];
            return (
              <div
                key={status}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${cfg.color}`}
              >
                <span>{cfg.label}</span>
                <span className="bg-white/60 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold leading-none">
                  {count}
                </span>
              </div>
            );
          })}
          {/* Reprovado — só se houver */}
          {todosAtendimentos.filter(a => a.status === 'reprovado').length > 0 && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${STATUS_CONFIG.reprovado.color}`}>
              <span>{STATUS_CONFIG.reprovado.label}</span>
              <span className="bg-white/60 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold leading-none">
                {todosAtendimentos.filter(a => a.status === 'reprovado').length}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Desktop 2-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

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

      {/* Right column: Follow-ups + Pending */}
      <div className="space-y-5">

      {/* Follow-up Pendente — 3 estágios */}
      {followUps.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-red-50 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              Follow-up Pendente
            </h3>
            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              {followUps.length}
            </span>
          </div>
          <div className="space-y-2">
            {followUps.map((f) => {
              const cfg = STAGE_CONFIG[f.stage];
              return (
              <div
                key={f.atendimento.id}
                className="bg-white rounded-xl border border-red-100 p-3 shadow-sm hover:border-red-200 hover:shadow-md transition-all"
              >
                {/* Top row: info */}
                <button
                  onClick={() => navigate(`/atendimentos/${f.atendimento.id}`)}
                  className="w-full flex items-center gap-3 text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 group-hover:bg-red-100 transition-colors">
                    <span className="text-xs font-extrabold text-red-600">{f.diasDesdeContato}d</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 text-sm truncate">{f.atendimento.cliente_nome}</p>
                      <StatusBadge status={f.atendimento.status} />
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      {f.atendimento.tipo_servico} — {cfg.sublabel}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.bgColor} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </button>
                {/* Bottom row: actions */}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                  {f.stage === 2 ? (
                    <button
                      onClick={() => handleFollowUpCall(f.atendimento)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${cfg.bgColor} ${cfg.color} ${cfg.hoverBg} transition-colors`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Ligar
                    </button>
                  ) : (
                    <button
                      onClick={() => handleFollowUpWhatsApp(f.atendimento)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${cfg.bgColor} ${cfg.color} ${cfg.hoverBg} transition-colors`}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      WhatsApp
                    </button>
                  )}
                  <button
                    onClick={() => handleFollowUpDone(f.atendimento.id)}
                    disabled={followUpLoading === f.atendimento.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    {followUpLoading === f.atendimento.id ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    Feito
                  </button>
                </div>
              </div>
              );
            })}
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

      </div>{/* end right column */}
      </div>{/* end 2-col grid */}

      {/* Quick action — mobile only (desktop has it in header) */}
      <Link
        to="/atendimentos/novo"
        className="block md:hidden w-full py-3.5 text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98] no-underline"
      >
        + Novo Atendimento
      </Link>
    </div>
  );
}
