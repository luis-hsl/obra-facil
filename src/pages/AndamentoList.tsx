import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Atendimento, AtendimentoStatus } from '../types';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import LoadingSkeleton from '../components/LoadingSkeleton';

const ANDAMENTO_STATUSES: AtendimentoStatus[] = ['visita_tecnica', 'medicao', 'orcamento'];

export default function AndamentoList() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<AtendimentoStatus | ''>('');

  useEffect(() => {
    loadAtendimentos();
  }, []);

  const loadAtendimentos = async () => {
    const { data, error } = await supabase
      .from('atendimentos')
      .select('*')
      .in('status', ANDAMENTO_STATUSES)
      .order('created_at', { ascending: false });

    if (error) {
      setErro('Erro ao carregar atendimentos.');
    } else {
      setAtendimentos(data || []);
    }
    setLoading(false);
  };

  const filtrados = atendimentos.filter((a) => {
    const q = filtro.toLowerCase();
    const matchTexto =
      a.cliente_nome.toLowerCase().includes(q) ||
      a.endereco.toLowerCase().includes(q) ||
      a.tipo_servico.toLowerCase().includes(q);
    const matchStatus = !statusFiltro || a.status === statusFiltro;
    return matchTexto && matchStatus;
  });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  if (loading) {
    return <LoadingSkeleton count={4} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Em Andamento</h2>
          <p className="text-sm text-slate-500 mt-0.5">{atendimentos.length} atendimento(s)</p>
        </div>
        <Link
          to="/atendimentos/novo"
          className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold no-underline shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]"
        >
          + Novo
        </Link>
      </div>

      {erro && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4"><p className="text-red-600 text-sm">{erro}</p></div>}

      <div className="relative mb-3">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar por cliente, endereço ou serviço..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm placeholder:text-slate-300"
        />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { value: '' as const, label: 'Todos' },
          { value: 'visita_tecnica' as AtendimentoStatus, label: 'Visita' },
          { value: 'medicao' as AtendimentoStatus, label: 'Medição' },
          { value: 'orcamento' as AtendimentoStatus, label: 'Orçamento' },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFiltro(opt.value)}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold ${
              statusFiltro === opt.value
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        atendimentos.length === 0 ? (
          <EmptyState
            icon="andamento"
            titulo="Nenhum atendimento em andamento"
            descricao="Quando um atendimento avançar para visita, medição ou orçamento, aparecerá aqui"
            ctaLabel="+ Novo Atendimento"
            ctaTo="/atendimentos/novo"
          />
        ) : (
          <EmptyState icon="busca" titulo="Nenhum resultado encontrado" />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtrados.map((a) => (
            <Link
              key={a.id}
              to={`/atendimentos/${a.id}`}
              className="block bg-white rounded-xl border border-slate-100 p-4 no-underline shadow-sm hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900">{a.cliente_nome}</p>
                  <p className="text-sm text-slate-500 mt-1">
                    {[a.endereco, a.numero, a.bairro, a.cidade].filter(Boolean).join(', ')}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <p className="text-sm text-slate-400">{a.tipo_servico}</p>
                    <span className="text-xs text-slate-400">{formatDate(a.created_at)}</span>
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
