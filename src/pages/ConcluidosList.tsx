import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Atendimento, Fechamento, Medicao, Orcamento, Execucao } from '../types';

interface AtendimentoCompleto extends Atendimento {
  fechamento?: Fechamento;
  medicao?: Medicao;
  orcamento?: Orcamento;
  execucao?: Execucao;
}

export default function ConcluidosList() {
  const [atendimentos, setAtendimentos] = useState<AtendimentoCompleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      if (o.status === 'aprovado' || !orcMap[o.atendimento_id]) {
        orcMap[o.atendimento_id] = o;
      }
    });

    const execMap: Record<string, Execucao> = {};
    (execRes.data || []).forEach((e) => { execMap[e.atendimento_id] = e; });

    const completos: AtendimentoCompleto[] = (atdRes.data || []).map((a) => ({
      ...a,
      fechamento: fechMap[a.id],
      medicao: medMap[a.id],
      orcamento: orcMap[a.id],
      execucao: execMap[a.id],
    }));

    setAtendimentos(completos);
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

  if (loading) {
    return <p className="text-center text-gray-500 mt-8">Carregando...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Concluídos</h2>
        <span className="text-sm text-gray-500">{atendimentos.length} atendimento(s)</span>
      </div>

      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      <input
        type="text"
        placeholder="Buscar por cliente, endereço ou serviço..."
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        className="w-full px-4 py-3 rounded-lg border border-gray-300 mb-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {filtrados.length === 0 ? (
        <p className="text-center text-gray-400 mt-8">
          {atendimentos.length === 0 ? 'Nenhum atendimento concluído' : 'Nenhum resultado encontrado'}
        </p>
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
                        <span className="text-gray-500">
                          {formatCurrency(a.fechamento.valor_recebido)}
                        </span>
                        <span className={a.fechamento.lucro_final >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          Lucro: {formatCurrency(a.fechamento.lucro_final)}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className={`text-gray-400 text-lg transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    ›
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                    {/* Dados do cliente */}
                    <div className="bg-gray-50 rounded-lg p-3 text-sm">
                      <p className="font-semibold text-gray-700 mb-1">Cliente</p>
                      <p className="text-gray-600">{a.cliente_nome}</p>
                      <p className="text-gray-500">{a.cliente_telefone}</p>
                      <p className="text-gray-500">
                        {[a.endereco, a.numero, a.complemento, a.bairro, a.cidade].filter(Boolean).join(', ')}
                      </p>
                      {a.observacoes && (
                        <p className="text-gray-400 mt-1 italic">Obs: {a.observacoes}</p>
                      )}
                    </div>

                    {/* Medição */}
                    {a.medicao && (
                      <div className="bg-yellow-50 rounded-lg p-3 text-sm">
                        <p className="font-semibold text-yellow-800 mb-1">Medição</p>
                        <p className="text-yellow-700">Área: {a.medicao.area_total} m²</p>
                        {a.medicao.observacoes && (
                          <p className="text-yellow-600 mt-1">Obs: {a.medicao.observacoes}</p>
                        )}
                      </div>
                    )}

                    {/* Orçamento */}
                    {a.orcamento && (
                      <div className="bg-blue-50 rounded-lg p-3 text-sm">
                        <p className="font-semibold text-blue-800 mb-1">Orçamento</p>
                        <p className="text-blue-700">Total: {formatCurrency(a.orcamento.valor_total)}</p>
                        {a.orcamento.forma_pagamento === 'parcelado' && a.orcamento.valor_parcela && (
                          <p className="text-blue-600">
                            {a.orcamento.numero_parcelas}x de {formatCurrency(a.orcamento.valor_parcela)}
                          </p>
                        )}
                        {a.orcamento.observacoes && (
                          <p className="text-blue-600 mt-1">Obs: {a.orcamento.observacoes}</p>
                        )}
                      </div>
                    )}

                    {/* Execução */}
                    {a.execucao && (
                      <div className="bg-orange-50 rounded-lg p-3 text-sm">
                        <p className="font-semibold text-orange-800 mb-1">Execução</p>
                        {a.execucao.observacoes && (
                          <p className="text-orange-700">Obs: {a.execucao.observacoes}</p>
                        )}
                        {a.execucao.foto_final_url && (
                          <img
                            src={a.execucao.foto_final_url}
                            alt="Foto final"
                            className="mt-2 w-full max-h-40 object-cover rounded"
                          />
                        )}
                      </div>
                    )}

                    {/* Fechamento */}
                    {a.fechamento && (
                      <div className={`rounded-lg p-3 text-sm ${a.fechamento.lucro_final >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                        <p className={`font-semibold mb-1 ${a.fechamento.lucro_final >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                          Fechamento
                        </p>
                        <p className="text-gray-600">Recebido: {formatCurrency(a.fechamento.valor_recebido)}</p>
                        <p className="text-gray-500">Distribuidor: {formatCurrency(a.fechamento.custo_distribuidor)}</p>
                        <p className="text-gray-500">Instalador: {formatCurrency(a.fechamento.custo_instalador)}</p>
                        <p className="text-gray-500">Extras: {formatCurrency(a.fechamento.custo_extras)}</p>
                        {a.fechamento.observacoes_extras && (
                          <p className="text-gray-500 mt-1">Obs: {a.fechamento.observacoes_extras}</p>
                        )}
                        <p className={`font-bold mt-2 ${a.fechamento.lucro_final >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          Lucro: {formatCurrency(a.fechamento.lucro_final)}
                        </p>
                      </div>
                    )}

                    <Link
                      to={`/atendimentos/${a.id}`}
                      className="block text-center py-2 text-sm text-blue-600 font-medium no-underline border border-blue-200 rounded-lg"
                    >
                      Ver detalhes completos
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
