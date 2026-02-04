import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Orcamento, Produto } from '../types';
import StatusBadge from './StatusBadge';

interface Props {
  obraId: string;
  orcamentos: Orcamento[];
  onSave: () => void;
}

function calcularOrcamento(area: number, perda: number, produto: Produto) {
  const areaComPerda = area * (1 + perda / 100);
  const caixas = Math.ceil(areaComPerda / produto.metragem_por_caixa);
  const total = caixas * produto.preco_por_caixa;
  return { areaComPerda, caixas, total };
}

export default function OrcamentoForm({ obraId, orcamentos, onSave }: Props) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoId, setProdutoId] = useState('');
  const [areaTotal, setAreaTotal] = useState('');
  const [perdaPercentual, setPerdaPercentual] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [erro, setErro] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Mapa de produtos para exibir nome nos orçamentos salvos
  const [produtosMap, setProdutosMap] = useState<Record<string, Produto>>({});

  useEffect(() => {
    supabase
      .from('produtos')
      .select('*')
      .order('nome')
      .then(({ data }) => {
        const lista = data || [];
        setProdutos(lista);
        const map: Record<string, Produto> = {};
        lista.forEach((p) => { map[p.id] = p; });
        setProdutosMap(map);
      });
  }, []);

  const produtoSelecionado = produtos.find((p) => p.id === produtoId);

  // Preencher perda padrão do produto ao selecionar
  const handleProdutoChange = (id: string) => {
    setProdutoId(id);
    const prod = produtos.find((p) => p.id === id);
    if (prod) {
      setPerdaPercentual(String(prod.perda_padrao));
    }
  };

  // Cálculo em tempo real
  const area = parseFloat(areaTotal);
  const perda = parseFloat(perdaPercentual);
  const calculo = produtoSelecionado && area > 0 && perda >= 0
    ? calcularOrcamento(area, perda, produtoSelecionado)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calculo || !produtoSelecionado) return;
    setErro('');
    setLoading(true);

    const { error } = await supabase.from('orcamentos').insert({
      obra_id: obraId,
      produto_id: produtoId,
      area_total: area,
      area_com_perda: calculo.areaComPerda,
      perda_percentual: perda,
      quantidade_caixas: calculo.caixas,
      valor_total: calculo.total,
    });

    if (error) {
      setErro('Erro ao salvar orçamento.');
      setLoading(false);
      return;
    }

    setProdutoId('');
    setAreaTotal('');
    setPerdaPercentual('');
    setShowForm(false);
    setLoading(false);
    onSave();
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    const { error } = await supabase.from('orcamentos').update({ status: newStatus }).eq('id', id);
    if (error) {
      setErro('Erro ao atualizar status.');
    } else {
      onSave();
    }
    setUpdatingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este orçamento?')) return;
    setDeletingId(id);
    const { error } = await supabase.from('orcamentos').delete().eq('id', id);
    if (error) {
      setErro('Erro ao excluir orçamento.');
    } else {
      onSave();
    }
    setDeletingId(null);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <div>
      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      {/* Lista de orçamentos */}
      {orcamentos.length > 0 && (
        <div className="space-y-3 mb-4">
          {orcamentos.map((o) => {
            const prod = o.produto_id ? produtosMap[o.produto_id] : null;
            return (
              <div key={o.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-gray-900 text-lg">
                    {formatCurrency(o.valor_total)}
                  </p>
                  <StatusBadge status={o.status} />
                </div>

                {/* Breakdown do cálculo */}
                {o.area_total && o.quantidade_caixas && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm text-gray-600 space-y-1">
                    {prod && <p className="font-medium text-gray-800">{prod.nome}</p>}
                    <p>Área medida: {o.area_total} m²</p>
                    <p>Perda: {o.perda_percentual}% → {o.area_com_perda?.toFixed(1)} m²</p>
                    <p>Caixas necessárias: {o.quantidade_caixas}</p>
                    {prod && <p>Valor da caixa: {formatCurrency(prod.preco_por_caixa)}</p>}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {o.status !== 'enviado' && (
                    <button
                      onClick={() => handleStatusChange(o.id, 'enviado')}
                      disabled={updatingId === o.id}
                      className="text-sm text-blue-600 font-medium disabled:opacity-50"
                    >
                      Enviado
                    </button>
                  )}
                  {o.status !== 'aprovado' && (
                    <button
                      onClick={() => handleStatusChange(o.id, 'aprovado')}
                      disabled={updatingId === o.id}
                      className="text-sm text-green-600 font-medium disabled:opacity-50"
                    >
                      Aprovar
                    </button>
                  )}
                  {o.status !== 'perdido' && (
                    <button
                      onClick={() => handleStatusChange(o.id, 'perdido')}
                      disabled={updatingId === o.id}
                      className="text-sm text-red-600 font-medium disabled:opacity-50"
                    >
                      Perdido
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(o.id)}
                    disabled={deletingId === o.id}
                    className="text-sm text-gray-400 ml-auto disabled:opacity-50"
                  >
                    {deletingId === o.id ? '...' : 'Excluir'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-medium"
        >
          + Gerar Orçamento
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          {produtos.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhum produto cadastrado.{' '}
              <a href="/produtos/novo" className="text-blue-600 font-medium">Cadastrar piso</a>
            </p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selecione o piso *
                </label>
                <select
                  value={produtoId}
                  onChange={(e) => handleProdutoChange(e.target.value)}
                  required
                  className="w-full px-3 py-3 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Escolha um produto...</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} — {formatCurrency(p.preco_por_caixa)}/caixa
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Área total do ambiente (m²) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={areaTotal}
                  onChange={(e) => setAreaTotal(e.target.value)}
                  required
                  placeholder="Ex: 48"
                  className="w-full px-3 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Soma de todos os ambientes que receberão o piso</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Perda (%) *
                </label>
                <input
                  type="number"
                  step="1"
                  value={perdaPercentual}
                  onChange={(e) => setPerdaPercentual(e.target.value)}
                  required
                  placeholder="10"
                  className="w-full px-3 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Cálculo em tempo real */}
              {calculo && produtoSelecionado && (
                <div className="bg-blue-100 rounded-lg p-4 space-y-1">
                  <p className="text-sm text-blue-800">Área medida: <strong>{area} m²</strong></p>
                  <p className="text-sm text-blue-800">Perda: {perda}% → <strong>{calculo.areaComPerda.toFixed(1)} m²</strong></p>
                  <p className="text-sm text-blue-800">Caixas necessárias: <strong>{calculo.caixas}</strong></p>
                  <p className="text-sm text-blue-800">Valor da caixa: <strong>{formatCurrency(produtoSelecionado.preco_por_caixa)}</strong></p>
                  <p className="text-lg font-bold text-blue-900 mt-2">
                    Total: {formatCurrency(calculo.total)}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setErro(''); }}
                  className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !calculo}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Gerar Orçamento'}
                </button>
              </div>
            </>
          )}
        </form>
      )}
    </div>
  );
}
