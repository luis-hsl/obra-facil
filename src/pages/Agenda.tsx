import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import type { Atendimento } from '../types';
import StatusBadge from '../components/StatusBadge';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

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
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [visitas, setVisitas] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);

    supabase
      .from('atendimentos')
      .select('*')
      .eq('user_id', user.id)
      .not('data_visita', 'is', null)
      .gte('data_visita', start.toISOString())
      .lte('data_visita', end.toISOString())
      .order('data_visita', { ascending: true })
      .then(({ data }) => {
        setVisitas(data || []);
        setLoading(false);
      });
  }, [user, currentMonth]);

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const goToday = () => {
    setCurrentMonth(startOfMonth(new Date()));
    setSelectedDate(new Date());
  };

  // Build calendar grid
  const totalDays = daysInMonth(currentMonth);
  const firstDow = currentMonth.getDay(); // 0=Sun
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

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-5">Agenda</h2>

      {/* Calendar */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <button onClick={goToday} className="text-lg font-bold text-slate-900 hover:text-blue-600">
              {MESES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </button>
          </div>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="text-center text-xs font-bold text-slate-400 py-1.5">{d}</div>
          ))}
        </div>

        {/* Day cells */}
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

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : selectedVisits.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-8 text-center shadow-sm">
          <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-slate-400">Nenhuma visita agendada para este dia.</p>
        </div>
      ) : (
        <div className="space-y-2">
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
    </div>
  );
}
