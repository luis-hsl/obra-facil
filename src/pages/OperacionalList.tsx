import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Atendimento, Fechamento } from '../types';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import LoadingSkeleton from '../components/LoadingSkeleton';

export default function OperacionalList() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [fechamentos, setFechamentos] = useState<Record<string, Fechamento>>({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [atdRes, fechRes] = await Promise.all([
      supabase
        .from('atendimentos')
        .select('*')
        .in('status', ['aprovado', 'execucao'])
        .order('created_at', { ascending: false }),
      supabase.from('fechamentos').select('*'),
    ]);

    if (atdRes.error) {
      setErro('Erro ao carregar atendimentos.');
    } else {
      setAtendimentos(atdRes.data || []);
    }

    if (fechRes.data) {
      const map: Record<string, Fechamento> = {};
      fechRes.data.forEach((f) => { map[f.atendimento_id] = f; });
      setFechamentos(map);
    }

    setLoading(false);
  };

  const filtrados = atendimentos.filter((a) => {
    const q = filtro.toLowerCase();
    return (
      a.cliente_nome.toLowerCase().includes(q) ||
      a.endereco.toLowerCase().includes(q) ||
      a.tipo_servico.toLowerCase().includes(q)
    );
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const pendentes = atendimentos.filter(a => !fechamentos[a.id]).length;
  const preenchidos = atendimentos.filter(a => !!fechamentos[a.id]).length;

  if (loading) {
    return <LoadingSkeleton count={4} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-slate-900">Operacional</h2>
        <span className="text-sm text-slate-500 font-medium">{atendimentos.length} atendimento(s)</span>
      </div>

      <p className="text-sm text-slate-500 mb-4">
        Controle de custos dos projetos aprovados e em execução.
      </p>

      {/* Mini KPIs */}
      {atendimentos.length > 0 && (
        <div className="flex gap-3 mb-4">
          <div className="flex-1 bg-white rounded-xl border border-orange-100 px-3 py-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-orange-600">{pendentes}</p>
            <p className="text-xs text-slate-500 font-medium">Pendentes</p>
          </div>
          <div className="flex-1 bg-white rounded-xl border border-emerald-100 px-3 py-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-emerald-600">{preenchidos}</p>
            <p className="text-xs text-slate-500 font-medium">Custos OK</p>
          </div>
        </div>
      )}

      {erro && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4"><p className="text-red-600 text-sm">{erro}</p></div>}

      <div className="relative mb-4">
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

      {filtrados.length === 0 ? (
        atendimentos.length === 0 ? (
          <EmptyState
            icon="operacional"
            titulo="Nenhum atendimento em execução"
            descricao="Quando um orçamento for aprovado, o atendimento aparecerá aqui para controle de custos"
          />
        ) : (
          <EmptyState icon="busca" titulo="Nenhum resultado encontrado" />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtrados.map((a) => {
            const fechamento = fechamentos[a.id];
            const temPrecificacao = !!fechamento;
            return (
              <Link
                key={a.id}
                to={`/atendimentos/${a.id}`}
                className={`block rounded-xl border p-4 no-underline shadow-sm hover:shadow-md ${
                  temPrecificacao ? 'bg-white border-emerald-100' : 'bg-white border-slate-100'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{a.cliente_nome}</p>
                      <span className="text-xs text-slate-400">{formatDate(a.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {[a.endereco, a.numero, a.bairro, a.cidade].filter(Boolean).join(', ')}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">{a.tipo_servico}</p>

                    {fechamento ? (
                      <div className="flex gap-3 mt-2 text-sm">
                        <span className="text-slate-500">
                          Dist: <strong className="text-slate-700">{formatCurrency(fechamento.custo_distribuidor)}</strong>
                        </span>
                        <span className="text-slate-500">
                          Inst: <strong className="text-slate-700">{formatCurrency(fechamento.custo_instalador)}</strong>
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-orange-500 font-semibold mt-2">Preencher custos →</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={a.status} />
                    {temPrecificacao && (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg font-semibold ring-1 ring-inset ring-emerald-200">
                        Custos OK
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
