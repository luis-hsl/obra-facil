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

  // KPIs
  const totalRecebido = atendimentos.reduce((acc, a) => acc + (a.fechamento?.valor_recebido || 0), 0);
  const totalLucro = atendimentos.reduce((acc, a) => acc + (a.fechamento?.lucro_final || 0), 0);

  if (loading) return <LoadingSkeleton count={4} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Concluídos</h2>
        <span className="text-sm text-gray-500">{atendimentos.length} atendimento(s)</span>
      </div>

      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      {/* KPI Cards */}
      {atendimentos.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
            <p className="text-lg font-bold text-gray-900">{atendimentos.length}</p>
            <p className="text-xs text-gray-500">Projetos</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalRecebido)}</p>
            <p className="text-xs text-gray-500">Recebido</p>
          </div>
          <div className={`rounded-lg border p-3 text-center ${totalLucro >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className={`text-lg font-bold ${totalLucro >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(totalLucro)}</p>
            <p className="text-xs text-gray-500">Lucro</p>
          </div>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="flex-1 px-4 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="px-3 py-3 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <div key={a.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{a.cliente_nome}</p>
                    <p className="text-sm text-gray-500 mt-1">{a.tipo_servico}</p>
                    {a.fechamento && (
                      <div className="flex gap-4 mt-1 text-sm">
                        <span className="text-gray-500">{formatCurrency(a.fechamento.valor_recebido)}</span>
                        <span className={a.fechamento.lucro_final >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          Lucro: {formatCurrency(a.fechamento.lucro_final)}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className={`text-gray-400 text-lg transition-transform ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-sm">
                      <p className="font-semibold text-gray-700 mb-1">Cliente</p>
                      <p className="text-gray-600">{a.cliente_nome}</p>
                      <p className="text-gray-500">{a.cliente_telefone}</p>
                      <p className="text-gray-500">
                        {[a.endereco, a.numero, a.complemento, a.bairro, a.cidade].filter(Boolean).join(', ')}
                      </p>
                      {a.observacoes && <p className="text-gray-400 mt-1 italic">Obs: {a.observacoes}</p>}
                    </div>

                    {a.medicao && (
                      <div className="bg-yellow-50 rounded-lg p-3 text-sm">
                        <p className="font-semibold text-yellow-800 mb-1">Medição</p>
                        <p className="text-yellow-700">Área: {a.medicao.area_total} m²</p>
                      </div>
                    )}

                    {a.orcamento && (
                      <div className="bg-blue-50 rounded-lg p-3 text-sm">
                        <p className="font-semibold text-blue-800 mb-1">Orçamento</p>
                        <p className="text-blue-700">Total: {formatCurrency(a.orcamento.valor_total)}</p>
                        {a.orcamento.forma_pagamento === 'parcelado' && a.orcamento.valor_parcela && (
                          <p className="text-blue-600">{a.orcamento.numero_parcelas}x de {formatCurrency(a.orcamento.valor_parcela)}</p>
                        )}
                      </div>
                    )}

                    {a.execucao && (
                      <div className="bg-orange-50 rounded-lg p-3 text-sm">
                        <p className="font-semibold text-orange-800 mb-1">Execução</p>
                        {a.execucao.observacoes && <p className="text-orange-700">Obs: {a.execucao.observacoes}</p>}
                        {a.execucao.foto_final_url && (
                          <img
                            src={a.execucao.foto_final_url}
                            alt="Foto final"
                            className="mt-2 w-full max-h-40 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setLightboxUrl(a.execucao!.foto_final_url)}
                          />
                        )}
                      </div>
                    )}

                    {a.fechamento && (
                      <div className={`rounded-lg p-3 text-sm ${a.fechamento.lucro_final >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                        <p className={`font-semibold mb-1 ${a.fechamento.lucro_final >= 0 ? 'text-green-800' : 'text-red-800'}`}>Fechamento</p>
                        <p className="text-gray-600">Recebido: {formatCurrency(a.fechamento.valor_recebido)}</p>
                        <p className="text-gray-500">Distribuidor: {formatCurrency(a.fechamento.custo_distribuidor)}</p>
                        <p className="text-gray-500">Instalador: {formatCurrency(a.fechamento.custo_instalador)}</p>
                        <p className="text-gray-500">Extras: {formatCurrency(a.fechamento.custo_extras)}</p>
                        {a.fechamento.observacoes_extras && <p className="text-gray-500 mt-1">Obs: {a.fechamento.observacoes_extras}</p>}
                        <p className={`font-bold mt-2 ${a.fechamento.lucro_final >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          Lucro: {formatCurrency(a.fechamento.lucro_final)}
                        </p>
                      </div>
                    )}

                    <Link
                      to={`/atendimentos/${a.id}`}
                      className="block text-center py-2 text-sm text-blue-600 font-medium no-underline border border-blue-200 rounded-lg"
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
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 text-white text-3xl font-light hover:text-gray-300"
          >×</button>
          <img
            src={lightboxUrl}
            alt="Foto ampliada"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
