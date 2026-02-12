import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Atendimento, Fechamento, Medicao, Orcamento, Execucao } from '../types';
import EmptyState from '../components/EmptyState';
import LoadingSkeleton from '../components/LoadingSkeleton';

interface AtendimentoCompleto extends Atendimento {
  fechamento?: Fechamento;
  medicao?: Medicao;
  orcamento?: Orcamento;
  execucao?: Execucao;
}

type SortOption = 'data_desc' | 'data_asc' | 'lucro_desc' | 'lucro_asc' | 'recebido_desc';

export default function ConcluidosList() {
  const [atendimentos, setAtendimentos] = useState<AtendimentoCompleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('data_desc');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [atdRes, fechRes, medRes, orcRes, execRes] = await Promise.all([
      supabase.from('atendimentos').select('*').eq('status', 'concluido').order('created_at', { ascending: false }),
      supabase.from('fechamentos').select('*'),
      supabase.from('medicoes').select('*'),
      supabase.from('orcamentos').select('*'),
      supabase.from('execucoes').select('*'),
    ]);

    if (atdRes.error) {
      setErro('Erro ao carregar atendimentos.');
      setLoading(false);
      return;
    }

    const fechMap: Record<string, Fechamento> = {};
    (fechRes.data || []).forEach((f) => { fechMap[f.atendimento_id] = f; });
    const medMap: Record<string, Medicao> = {};
    (medRes.data || []).forEach((m) => { medMap[m.atendimento_id] = m; });
    const orcMap: Record<string, Orcamento> = {};
    (orcRes.data || []).forEach((o) => {
      if (o.status === 'aprovado' || !orcMap[o.atendimento_id]) orcMap[o.atendimento_id] = o;
    });
    const execMap: Record<string, Execucao> = {};
    (execRes.data || []).forEach((e) => { execMap[e.atendimento_id] = e; });

    setAtendimentos((atdRes.data || []).map((a) => ({
      ...a, fechamento: fechMap[a.id], medicao: medMap[a.id], orcamento: orcMap[a.id], execucao: execMap[a.id],
    })));
    setLoading(false);
  };

  const filtrados = useMemo(() => {
    let result = atendimentos.filter((a) => {
      const q = filtro.toLowerCase();
      return a.cliente_nome.toLowerCase().includes(q) || a.endereco.toLowerCase().includes(q) || a.tipo_servico.toLowerCase().includes(q);
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case 'data_asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'lucro_desc': return (b.fechamento?.lucro_final || 0) - (a.fechamento?.lucro_final || 0);
        case 'lucro_asc': return (a.fechamento?.lucro_final || 0) - (b.fechamento?.lucro_final || 0);
        case 'recebido_desc': return (b.fechamento?.valor_recebido || 0) - (a.fechamento?.valor_recebido || 0);
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [atendimentos, filtro, sortBy]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const totalRecebido = atendimentos.reduce((acc, a) => acc + (a.fechamento?.valor_recebido || 0), 0);
  const totalLucro = atendimentos.reduce((acc, a) => acc + (a.fechamento?.lucro_final || 0), 0);

  if (loading) return <LoadingSkeleton count={4} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-bold text-slate-900">Concluídos</h2>
        <span className="text-sm text-slate-500 font-medium">{atendimentos.length} atendimento(s)</span>
      </div>

      {erro && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4"><p className="text-red-600 text-sm">{erro}</p></div>}

      {/* KPI Cards */}
      {atendimentos.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-slate-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-slate-900">{atendimentos.length}</p>
            <p className="text-xs text-slate-500 font-medium">Projetos</p>
          </div>
          <div className="bg-white rounded-xl border border-blue-100 p-3 text-center shadow-sm">
            <p className="text-lg font-bold text-blue-700">{formatCurrency(totalRecebido)}</p>
            <p className="text-xs text-slate-500 font-medium">Recebido</p>
          </div>
          <div className={`rounded-xl border p-3 text-center shadow-sm ${totalLucro >= 0 ? 'bg-white border-emerald-100' : 'bg-white border-red-100'}`}>
            <p className={`text-lg font-bold ${totalLucro >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(totalLucro)}</p>
            <p className="text-xs text-slate-500 font-medium">Lucro</p>
          </div>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm placeholder:text-slate-300"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="px-3 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        >
          <option value="data_desc">Mais recentes</option>
          <option value="data_asc">Mais antigos</option>
          <option value="lucro_desc">Maior lucro</option>
          <option value="lucro_asc">Menor lucro</option>
          <option value="recebido_desc">Maior valor</option>
        </select>
      </div>

      {filtrados.length === 0 ? (
        atendimentos.length === 0 ? (
          <EmptyState icon="concluidos" titulo="Nenhum atendimento concluído" descricao="Serviços finalizados aparecerão aqui com o resumo financeiro" />
        ) : (
          <EmptyState icon="busca" titulo="Nenhum resultado encontrado" />
        )
      ) : (
        <div className="space-y-3">
          {filtrados.map((a) => {
            const isExpanded = expandedId === a.id;
            return (
              <div key={a.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{a.cliente_nome}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{a.tipo_servico}</p>
                    {a.fechamento && (
                      <div className="flex gap-4 mt-1 text-sm">
                        <span className="text-slate-500">{formatCurrency(a.fechamento.valor_recebido)}</span>
                        <span className={`font-semibold ${a.fechamento.lucro_final >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          Lucro: {formatCurrency(a.fechamento.lucro_final)}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className={`text-slate-400 text-lg ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3 animate-fade-in">
                    <div className="bg-slate-50 rounded-xl p-3.5 text-sm">
                      <p className="font-semibold text-slate-700 mb-1">Cliente</p>
                      <p className="text-slate-600">{a.cliente_nome}</p>
                      <p className="text-slate-500">{a.cliente_telefone}</p>
                      <p className="text-slate-500">
                        {[a.endereco, a.numero, a.complemento, a.bairro, a.cidade].filter(Boolean).join(', ')}
                      </p>
                      {a.observacoes && <p className="text-slate-400 mt-1 italic">Obs: {a.observacoes}</p>}
                    </div>

                    {a.medicao && (
                      <div className="bg-amber-50 rounded-xl p-3.5 text-sm">
                        <p className="font-semibold text-amber-800 mb-1">Medição</p>
                        <p className="text-amber-700">Área: {a.medicao.area_total} m²</p>
                      </div>
                    )}

                    {a.orcamento && (
                      <div className="bg-blue-50 rounded-xl p-3.5 text-sm">
                        <p className="font-semibold text-blue-800 mb-1">Orçamento</p>
                        <p className="text-blue-700">Total: {formatCurrency(a.orcamento.valor_total)}</p>
                        {a.orcamento.forma_pagamento === 'parcelado' && a.orcamento.valor_parcela && (
                          <p className="text-blue-600">{a.orcamento.numero_parcelas}x de {formatCurrency(a.orcamento.valor_parcela)}</p>
                        )}
                      </div>
                    )}

                    {a.execucao && (
                      <div className="bg-orange-50 rounded-xl p-3.5 text-sm">
                        <p className="font-semibold text-orange-800 mb-1">Execução</p>
                        {a.execucao.observacoes && <p className="text-orange-700">Obs: {a.execucao.observacoes}</p>}
                        {a.execucao.foto_final_url && (
                          <img
                            src={a.execucao.foto_final_url}
                            alt="Foto final"
                            className="mt-2 w-full max-h-40 object-cover rounded-xl cursor-pointer hover:opacity-90"
                            onClick={() => setLightboxUrl(a.execucao!.foto_final_url)}
                          />
                        )}
                      </div>
                    )}

                    {a.fechamento && (
                      <div className={`rounded-xl p-3.5 text-sm ${a.fechamento.lucro_final >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                        <p className={`font-semibold mb-1 ${a.fechamento.lucro_final >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>Fechamento</p>
                        <p className="text-slate-600">Recebido: {formatCurrency(a.fechamento.valor_recebido)}</p>
                        <p className="text-slate-500">Distribuidor: {formatCurrency(a.fechamento.custo_distribuidor)}</p>
                        <p className="text-slate-500">Instalador: {formatCurrency(a.fechamento.custo_instalador)}</p>
                        <p className="text-slate-500">Extras: {formatCurrency(a.fechamento.custo_extras)}</p>
                        {a.fechamento.observacoes_extras && <p className="text-slate-500 mt-1">Obs: {a.fechamento.observacoes_extras}</p>}
                        <p className={`font-bold mt-2 text-lg ${a.fechamento.lucro_final >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          Lucro: {formatCurrency(a.fechamento.lucro_final)}
                        </p>
                      </div>
                    )}

                    <Link
                      to={`/atendimentos/${a.id}`}
                      className="block text-center py-2.5 text-sm text-blue-600 font-semibold no-underline border border-blue-200 rounded-xl hover:bg-blue-50"
                    >Ver detalhes completos</Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl"
          >×</button>
          <img
            src={lightboxUrl}
            alt="Foto ampliada"
            className="max-w-full max-h-[90vh] object-contain rounded-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
