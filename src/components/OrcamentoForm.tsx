import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Orcamento, OrcamentoItem, Produto, Atendimento } from '../types';
import StatusBadge from './StatusBadge';
import { gerarPDF } from '../lib/gerarPDF';

interface Props {
  atendimentoId: string;
  atendimento: Atendimento;
  orcamentos: Orcamento[];
  areaMedicao: number;
  perdaMedicao: number;
  onSave: () => void;
}

interface ItemForm {
  produtoId: string;
  produto: Produto | null;
  areaTotal: number;
  perda: number;
  areaComPerda: number;
  valorTotal: number;
}

function calcularItem(area: number, perda: number, precoPorM2: number) {
  const areaComPerda = area * (1 + perda / 100);
  const total = areaComPerda * precoPorM2;
  return { areaComPerda, total };
}

function calcularParcela(valorTotal: number, taxaMensal: number, numParcelas: number): number {
  if (taxaMensal === 0) return valorTotal / numParcelas;
  const i = taxaMensal / 100;
  const n = numParcelas;
  return valorTotal * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
}

const OPCOES_PARCELAS = [2, 3, 4, 5, 6, 10, 12];
const OPCOES_JUROS = [
  { label: 'Sem juros', value: 0 },
  { label: '1,5% a.m.', value: 1.5 },
  { label: '2% a.m.', value: 2 },
  { label: '2,5% a.m.', value: 2.5 },
  { label: '3% a.m.', value: 3 },
];

export default function OrcamentoForm({ atendimentoId, atendimento, orcamentos, areaMedicao, perdaMedicao, onSave }: Props) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtosMap, setProdutosMap] = useState<Record<string, Produto>>({});
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [erro, setErro] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Itens do orçamento sendo criado
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState('');

  // Pagamento
  const [formaPagamento, setFormaPagamento] = useState<'a_vista' | 'parcelado'>('a_vista');
  const [numeroParcelas, setNumeroParcelas] = useState(2);
  const [taxaJuros, setTaxaJuros] = useState(0);
  const [taxaJurosCustom, setTaxaJurosCustom] = useState('');
  const [usarTaxaCustom, setUsarTaxaCustom] = useState(false);

  // Itens dos orçamentos existentes
  const [orcamentoItens, setOrcamentoItens] = useState<Record<string, OrcamentoItem[]>>({});

  useEffect(() => {
    supabase
      .from('produtos')
      .select('*')
      .order('fabricante')
      .then(({ data }) => {
        const lista = data || [];
        setProdutos(lista);
        const map: Record<string, Produto> = {};
        lista.forEach((p) => { map[p.id] = p; });
        setProdutosMap(map);
      });
  }, []);

  // Carregar itens dos orçamentos existentes
  useEffect(() => {
    if (orcamentos.length > 0) {
      const orcIds = orcamentos.map(o => o.id);
      supabase
        .from('orcamento_itens')
        .select('*')
        .in('orcamento_id', orcIds)
        .then(({ data }) => {
          const map: Record<string, OrcamentoItem[]> = {};
          (data || []).forEach((item) => {
            if (!map[item.orcamento_id]) map[item.orcamento_id] = [];
            map[item.orcamento_id].push(item);
          });
          setOrcamentoItens(map);
        });
    }
  }, [orcamentos]);

  const adicionarProduto = () => {
    if (!produtoSelecionado) return;
    const produto = produtos.find(p => p.id === produtoSelecionado);
    if (!produto) return;

    // Verificar se já foi adicionado
    if (itens.some(i => i.produtoId === produtoSelecionado)) {
      setErro('Este produto já foi adicionado.');
      return;
    }

    const area = areaMedicao || 0;
    const perda = perdaMedicao || 10;
    const calc = calcularItem(area, perda, produto.preco_por_m2);

    setItens([...itens, {
      produtoId: produto.id,
      produto,
      areaTotal: area,
      perda,
      areaComPerda: calc.areaComPerda,
      valorTotal: calc.total,
    }]);

    setProdutoSelecionado('');
    setErro('');
  };

  const removerItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const atualizarItemArea = (index: number, novaArea: number) => {
    const item = itens[index];
    if (!item.produto) return;
    const calc = calcularItem(novaArea, item.perda, item.produto.preco_por_m2);
    const novosItens = [...itens];
    novosItens[index] = {
      ...item,
      areaTotal: novaArea,
      areaComPerda: calc.areaComPerda,
      valorTotal: calc.total,
    };
    setItens(novosItens);
  };

  const totalGeral = itens.reduce((sum, item) => sum + item.valorTotal, 0);

  const taxaEfetiva = usarTaxaCustom ? parseFloat(taxaJurosCustom) || 0 : taxaJuros;
  const valorParcela = totalGeral > 0 && formaPagamento === 'parcelado'
    ? calcularParcela(totalGeral, taxaEfetiva, numeroParcelas)
    : null;
  const valorTotalParcelado = valorParcela ? valorParcela * numeroParcelas : null;
  const jurosTotal = valorTotalParcelado ? valorTotalParcelado - totalGeral : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (itens.length === 0) {
      setErro('Adicione pelo menos um produto ao orçamento.');
      return;
    }
    setErro('');
    setLoading(true);

    // Criar o orçamento principal
    const { data: orcamento, error: orcError } = await supabase.from('orcamentos').insert({
      atendimento_id: atendimentoId,
      produto_id: null, // Agora os produtos ficam nos itens
      area_total: null,
      area_com_perda: null,
      perda_percentual: null,
      valor_total: Math.round(totalGeral * 100) / 100,
      forma_pagamento: formaPagamento,
      numero_parcelas: formaPagamento === 'parcelado' ? numeroParcelas : 1,
      taxa_juros_mensal: formaPagamento === 'parcelado' ? taxaEfetiva : 0,
      valor_parcela: formaPagamento === 'parcelado' ? Math.round(valorParcela! * 100) / 100 : null,
      valor_total_parcelado: formaPagamento === 'parcelado' ? Math.round(valorTotalParcelado! * 100) / 100 : null,
    }).select().single();

    if (orcError || !orcamento) {
      setErro('Erro ao salvar orçamento.');
      setLoading(false);
      return;
    }

    // Criar os itens do orçamento
    const itensParaInserir = itens.map(item => ({
      orcamento_id: orcamento.id,
      produto_id: item.produtoId,
      area_total: Math.round(item.areaTotal * 100) / 100,
      area_com_perda: Math.round(item.areaComPerda * 100) / 100,
      perda_percentual: item.perda,
      preco_por_m2: item.produto!.preco_por_m2,
      valor_total: Math.round(item.valorTotal * 100) / 100,
    }));

    const { error: itensError } = await supabase.from('orcamento_itens').insert(itensParaInserir);

    if (itensError) {
      setErro('Erro ao salvar itens do orçamento.');
      // Rollback: deletar o orçamento criado
      await supabase.from('orcamentos').delete().eq('id', orcamento.id);
      setLoading(false);
      return;
    }

    // Auto-avançar status para 'orcamento' se ainda estiver em medicao
    if (atendimento.status === 'medicao') {
      await supabase.from('atendimentos').update({ status: 'orcamento' }).eq('id', atendimentoId);
    }

    // Reset form
    setItens([]);
    setProdutoSelecionado('');
    setFormaPagamento('a_vista');
    setNumeroParcelas(2);
    setTaxaJuros(0);
    setTaxaJurosCustom('');
    setUsarTaxaCustom(false);
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
      // Auto-avançar atendimento para 'execucao' quando orçamento é aprovado (vai para Operacional)
      if (newStatus === 'aprovado') {
        await supabase.from('atendimentos').update({ status: 'execucao' }).eq('id', atendimentoId);
      }
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

  const handleGerarPDF = (orcamento: Orcamento) => {
    const itensDoOrcamento = orcamentoItens[orcamento.id] || [];
    // Legado: se não tem itens, usa o produto_id do orçamento
    const produto = orcamento.produto_id ? produtosMap[orcamento.produto_id] : null;
    gerarPDF({ atendimento, orcamento, produto, itens: itensDoOrcamento, produtosMap });
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  // Produtos ainda não adicionados
  const produtosDisponiveis = produtos.filter(p => !itens.some(i => i.produtoId === p.id));

  return (
    <div>
      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      {/* Orçamentos existentes */}
      {orcamentos.length > 0 && (
        <div className="space-y-3 mb-4">
          {orcamentos.map((o) => {
            const itensDoOrc = orcamentoItens[o.id] || [];
            const temItens = itensDoOrc.length > 0;
            // Legado: produto direto no orçamento
            const prodLegado = o.produto_id ? produtosMap[o.produto_id] : null;

            return (
              <div key={o.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-gray-900 text-lg">{formatCurrency(o.valor_total)}</p>
                  <StatusBadge status={o.status} />
                </div>

                {/* Itens do orçamento */}
                {temItens ? (
                  <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-3">
                    <p className="text-sm font-semibold text-gray-700">Produtos incluídos:</p>
                    {itensDoOrc.map((item, idx) => {
                      const prod = item.produto_id ? produtosMap[item.produto_id] : null;
                      return (
                        <div key={item.id} className="text-sm text-gray-600 border-b border-gray-200 pb-2 last:border-0 last:pb-0">
                          <p className="font-medium text-gray-800">
                            {idx + 1}. {prod ? `${prod.fabricante} — ${prod.linha}` : 'Produto removido'}
                          </p>
                          <p>Área: {item.area_total} m² → {item.area_com_perda.toFixed(2)} m² (c/ {item.perda_percentual}% perda)</p>
                          <p>Preço: {formatCurrency(item.preco_por_m2)}/m² = <strong>{formatCurrency(item.valor_total)}</strong></p>
                        </div>
                      );
                    })}
                  </div>
                ) : prodLegado && o.area_total ? (
                  // Orçamento legado (produto único)
                  <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm text-gray-600 space-y-1">
                    <p className="font-semibold text-gray-700">Como calculamos:</p>
                    <p className="font-medium text-gray-800">{prodLegado.fabricante} — {prodLegado.linha}</p>
                    <p>Área informada: {o.area_total} m²</p>
                    <p>Perda aplicada: {o.perda_percentual}% → Área final: {o.area_com_perda?.toFixed(2)} m²</p>
                    <p>Preço: {formatCurrency(prodLegado.preco_por_m2)}/m²</p>
                    <p className="font-semibold text-gray-800">{o.area_com_perda?.toFixed(2)} m² x {formatCurrency(prodLegado.preco_por_m2)}/m² = {formatCurrency(o.valor_total)}</p>
                  </div>
                ) : null}

                {/* Condições de pagamento */}
                {o.forma_pagamento === 'parcelado' && o.valor_parcela && o.valor_total_parcelado && (
                  <div className="bg-blue-50 rounded-lg p-3 mb-3 text-sm">
                    <p className="font-semibold text-blue-700">Condições de Pagamento:</p>
                    <p className="text-blue-800">{o.numero_parcelas}x de {formatCurrency(o.valor_parcela)} {o.taxa_juros_mensal > 0 && `(${o.taxa_juros_mensal}% a.m.)`}</p>
                    <p className="text-blue-800">Total parcelado: {formatCurrency(o.valor_total_parcelado)}</p>
                    {o.valor_total_parcelado > o.valor_total && (
                      <p className="text-blue-600">Juros: {formatCurrency(o.valor_total_parcelado - o.valor_total)}</p>
                    )}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {o.status !== 'enviado' && (
                    <button onClick={() => handleStatusChange(o.id, 'enviado')} disabled={updatingId === o.id} className="text-sm text-blue-600 font-medium disabled:opacity-50">
                      Enviado
                    </button>
                  )}
                  {o.status !== 'aprovado' && (
                    <button onClick={() => handleStatusChange(o.id, 'aprovado')} disabled={updatingId === o.id} className="text-sm text-green-600 font-medium disabled:opacity-50">
                      Aprovar
                    </button>
                  )}
                  {o.status !== 'reprovado' && (
                    <button onClick={() => handleStatusChange(o.id, 'reprovado')} disabled={updatingId === o.id} className="text-sm text-red-600 font-medium disabled:opacity-50">
                      Reprovar
                    </button>
                  )}
                  <button onClick={() => handleGerarPDF(o)} className="text-sm text-purple-600 font-medium">
                    PDF
                  </button>
                  <button onClick={() => handleDelete(o.id)} disabled={deletingId === o.id} className="text-sm text-gray-400 ml-auto disabled:opacity-50">
                    {deletingId === o.id ? '...' : 'Excluir'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Botão para criar novo orçamento */}
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-medium">
          + Gerar Orçamento
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          {produtos.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhum produto cadastrado.{' '}
              <a href="/produtos/novo" className="text-blue-600 font-medium">Cadastrar produto</a>
            </p>
          ) : (
            <>
              {/* Adicionar produtos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adicionar produto</label>
                <div className="flex gap-2">
                  <select
                    value={produtoSelecionado}
                    onChange={(e) => setProdutoSelecionado(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Escolha um produto...</option>
                    {produtosDisponiveis.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fabricante} {p.linha} — {formatCurrency(p.preco_por_m2)}/m²
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={adicionarProduto}
                    disabled={!produtoSelecionado}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
                {areaMedicao > 0 && <p className="text-xs text-gray-400 mt-1">Área da medição: {areaMedicao} m² | Perda: {perdaMedicao}%</p>}
              </div>

              {/* Lista de itens adicionados */}
              {itens.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Produtos no orçamento:</p>
                  {itens.map((item, index) => (
                    <div key={item.produtoId} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-800">{item.produto?.fabricante} — {item.produto?.linha}</p>
                          <p className="text-xs text-gray-500">{formatCurrency(item.produto?.preco_por_m2 || 0)}/m²</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removerItem(index)}
                          className="text-red-500 text-sm font-medium"
                        >
                          Remover
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <label className="text-sm text-gray-600">Área:</label>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0.01"
                          value={item.areaTotal || ''}
                          onChange={(e) => atualizarItemArea(index, parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 rounded border border-gray-300 text-sm"
                        />
                        <span className="text-sm text-gray-500">m²</span>
                      </div>

                      <div className="text-sm text-gray-600">
                        <p>Área c/ perda ({item.perda}%): <strong>{item.areaComPerda.toFixed(2)} m²</strong></p>
                        <p className="text-base font-semibold text-gray-800 mt-1">
                          Subtotal: {formatCurrency(item.valorTotal)}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Total */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-xl font-bold text-blue-900">
                      Total à vista: {formatCurrency(totalGeral)}
                    </p>

                    {/* Forma de Pagamento */}
                    <div className="pt-3 mt-3 border-t border-blue-200">
                      <p className="text-sm font-semibold text-blue-900 mb-2">Forma de Pagamento:</p>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="formaPagamento"
                            checked={formaPagamento === 'a_vista'}
                            onChange={() => setFormaPagamento('a_vista')}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm text-blue-800">À vista</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="formaPagamento"
                            checked={formaPagamento === 'parcelado'}
                            onChange={() => setFormaPagamento('parcelado')}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm text-blue-800">Parcelado</span>
                        </label>
                      </div>
                    </div>

                    {formaPagamento === 'parcelado' && (
                      <div className="space-y-3 pt-3">
                        <div>
                          <label className="block text-sm font-medium text-blue-800 mb-1">Parcelas:</label>
                          <select
                            value={numeroParcelas}
                            onChange={(e) => setNumeroParcelas(parseInt(e.target.value))}
                            className="w-full px-3 py-2 rounded-lg border border-blue-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {OPCOES_PARCELAS.map((n) => (
                              <option key={n} value={n}>{n}x</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-blue-800 mb-1">Taxa de juros:</label>
                          <select
                            value={usarTaxaCustom ? 'custom' : taxaJuros}
                            onChange={(e) => {
                              if (e.target.value === 'custom') {
                                setUsarTaxaCustom(true);
                              } else {
                                setUsarTaxaCustom(false);
                                setTaxaJuros(parseFloat(e.target.value));
                              }
                            }}
                            className="w-full px-3 py-2 rounded-lg border border-blue-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {OPCOES_JUROS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                            <option value="custom">Outro...</option>
                          </select>
                        </div>

                        {usarTaxaCustom && (
                          <div>
                            <label className="block text-sm font-medium text-blue-800 mb-1">Taxa personalizada (% a.m.):</label>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.1"
                              min="0"
                              value={taxaJurosCustom}
                              onChange={(e) => setTaxaJurosCustom(e.target.value)}
                              placeholder="Ex: 1.8"
                              className="w-full px-3 py-2 rounded-lg border border-blue-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}

                        {valorParcela && valorTotalParcelado && (
                          <div className="bg-blue-100 rounded-lg p-3 space-y-1">
                            <p className="text-lg font-bold text-blue-900">
                              {numeroParcelas}x de {formatCurrency(valorParcela)}
                              {taxaEfetiva > 0 && <span className="text-sm font-normal"> ({taxaEfetiva}% a.m.)</span>}
                            </p>
                            <p className="text-sm text-blue-800">
                              Total parcelado: <strong>{formatCurrency(valorTotalParcelado)}</strong>
                            </p>
                            {jurosTotal > 0 && (
                              <p className="text-sm text-blue-700">
                                Juros: {formatCurrency(jurosTotal)} ({((jurosTotal / totalGeral) * 100).toFixed(1)}% sobre o valor à vista)
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {itens.length === 0 && (
                <p className="text-center text-gray-400 py-4">
                  Adicione produtos para gerar o orçamento
                </p>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowForm(false); setItens([]); setErro(''); }} className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium">
                  Cancelar
                </button>
                <button type="submit" disabled={loading || itens.length === 0} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50">
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
