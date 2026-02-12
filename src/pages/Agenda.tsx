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

export default function Agenda() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projetosAtivos, setProjetosAtivos] = useState(0);
  const [receitaMes, setReceitaMes] = useState(0);
  const [taxaConversao, setTaxaConversao] = useState(0);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [visitasHoje, setVisitasHoje] = useState<Atendimento[]>([]);
  const [orcPendentes, setOrcPendentes] = useState<Atendimento[]>([]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    const hoje = getDataBrasilia();

    const [atdRes, fechRes, orcRes] = await Promise.all([
      supabase.from('atendimentos').select('*').eq('user_id', user!.id),
      supabase.from('fechamentos').select('valor_recebido, created_at'),
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

    // KPI: Taxa de conversão (aprovados / (aprovados + enviados + reprovados))
    const enviados = allOrcamentos.filter(o => ['enviado', 'aprovado', 'reprovado'].includes(o.status));
    const aprovados = allOrcamentos.filter(o => o.status === 'aprovado');
    setTaxaConversao(enviados.length > 0 ? Math.round((aprovados.length / enviados.length) * 100) : 0);

    // KPI: Ticket médio
    const totalFech = allFechamentos.length;
    const somaRecebido = allFechamentos.reduce((acc, f) => acc + f.valor_recebido, 0);
    setTicketMedio(totalFech > 0 ? somaRecebido / totalFech : 0);

    // Visitas de hoje
    const visitasDeHoje = atendimentos.filter(a => {
      if (!a.data_visita) return false;
      return isSameDay(new Date(a.data_visita), hoje);
    }).sort((a, b) => new Date(a.data_visita!).getTime() - new Date(b.data_visita!).getTime());
    setVisitasHoje(visitasDeHoje);

    // Orçamentos pendentes
    const atdMap = new Map(atendimentos.map(a => [a.id, a]));
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

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE });

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
        <div className="bg-white rounded-xl border border-blue-100 p-4 shadow-sm">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Conversão</p>
          <p className="text-3xl font-bold text-blue-700 mt-1">{taxaConversao}%</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Ticket Médio</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(ticketMedio)}</p>
        </div>
      </div>

      {/* Visitas de Hoje — widget compacto */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Visitas de Hoje
          </h3>
          {visitasHoje.length > 0 && (
            <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
              {visitasHoje.length}
            </span>
          )}
        </div>
        {visitasHoje.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm text-center">
            <p className="text-sm text-slate-400">Nenhuma visita agendada para hoje</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visitasHoje.map((v) => (
              <button
                key={v.id}
                onClick={() => navigate(`/atendimentos/${v.id}`)}
                className="w-full bg-white rounded-xl border border-slate-100 p-3 shadow-sm text-left hover:border-purple-200 transition-colors flex items-center gap-3"
              >
                <span className="text-sm font-bold text-purple-600 flex-shrink-0 w-12">{formatTime(v.data_visita!)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">{v.cliente_nome}</p>
                  <p className="text-xs text-slate-400 truncate">{v.tipo_servico} — {v.endereco}</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>

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
