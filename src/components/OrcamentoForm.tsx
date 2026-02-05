import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Orcamento, Produto, Atendimento } from '../types';
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

function calcularOrcamento(area: number, perda: number, precoPorM2: number) {
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
  const [produtoId, setProdutoId] = useState('');
  const [areaTotal, setAreaTotal] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [erro, setErro] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [produtosMap, setProdutosMap] = useState<Record<string, Produto>>({});

  // Pagamento
  const [formaPagamento, setFormaPagamento] = useState<'a_vista' | 'parcelado'>('a_vista');
  const [numeroParcelas, setNumeroParcelas] = useState(2);
  const [taxaJuros, setTaxaJuros] = useState(0);
  const [taxaJurosCustom, setTaxaJurosCustom] = useState('');
  const [usarTaxaCustom, setUsarTaxaCustom] = useState(false);

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

  useEffect(() => {
    if (showForm && areaMedicao > 0 && !areaTotal) {
      setAreaTotal(String(areaMedicao));
    }
  }, [showForm, areaMedicao]);

  const produtoSelecionado = produtos.find((p) => p.id === produtoId);

  const handleProdutoChange = (id: string) => {
    setProdutoId(id);
  };

  const area = parseFloat(areaTotal);
  const perda = perdaMedicao || 10;
  const calculo = produtoSelecionado && area > 0
    ? calcularOrcamento(area, perda, produtoSelecionado.preco_por_m2)
    : null;

  const taxaEfetiva = usarTaxaCustom ? parseFloat(taxaJurosCustom) || 0 : taxaJuros;
  const valorParcela = calculo && formaPagamento === 'parcelado'
    ? calcularParcela(calculo.total, taxaEfetiva, numeroParcelas)
    : null;
  const valorTotalParcelado = valorParcela ? valorParcela * numeroParcelas : null;
  const jurosTotal = valorTotalParcelado && calculo ? valorTotalParcelado - calculo.total : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!produtoSelecionado) return;
    setErro('');

    if (!area || area <= 0) {
      setErro('A área precisa ser maior que zero.');
      return;
    }
    if (isNaN(perda) || perda < 0) {
      setErro('A perda precisa ser zero ou maior.');
      return;
    }
    if (!calculo) return;

    setLoading(true);

    const { error } = await supabase.from('orcamentos').insert({
      atendimento_id: atendimentoId,
      produto_id: produtoId,
      area_total: area,
      area_com_perda: calculo.areaComPerda,
      perda_percentual: perda,
      valor_total: calculo.total,
      forma_pagamento: formaPagamento,
      numero_parcelas: formaPagamento === 'parcelado' ? numeroParcelas : 1,
      taxa_juros_mensal: formaPagamento === 'parcelado' ? taxaEfetiva : 0,
      valor_parcela: formaPagamento === 'parcelado' ? valorParcela : null,
      valor_total_parcelado: formaPagamento === 'parcelado' ? valorTotalParcelado : null,
    });

    if (error) {
      setErro('Erro ao salvar orçamento.');
      setLoading(false);
      return;
    }

    // Auto-avançar status para 'orcamento' se ainda estiver em medicao
    if (atendimento.status === 'medicao') {
      await supabase.from('atendimentos').update({ status: 'orcamento' }).eq('id', atendimentoId);
    }

    setProdutoId('');
    setAreaTotal('');
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
      // Auto-avançar atendimento para 'aprovado' quando orçamento é aprovado
      if (newStatus === 'aprovado' && atendimento.status === 'orcamento') {
        await supabase.from('atendimentos').update({ status: 'aprovado' }).eq('id', atendimentoId);
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
    const produto = orcamento.produto_id ? produtosMap[orcamento.produto_id] : null;
    gerarPDF({ atendimento, orcamento, produto });
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <div>
      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      {orcamentos.length > 0 && (
        <div className="space-y-3 mb-4">
          {orcamentos.map((o) => {
            const prod = o.produto_id ? produtosMap[o.produto_id] : null;
            return (
              <div key={o.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-gray-900 text-lg">{formatCurrency(o.valor_total)}</p>
                  <StatusBadge status={o.status} />
                </div>

                {o.area_total && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm text-gray-600 space-y-1">
                    <p className="font-semibold text-gray-700">Como calculamos:</p>
                    {prod && <p className="font-medium text-gray-800">{prod.fabricante} — {prod.linha}</p>}
                    <p>Área informada: {o.area_total} m²</p>
                    <p>Perda aplicada: {o.perda_percentual}% → Área final: {o.area_com_perda?.toFixed(2)} m²</p>
                    {prod && <p>Preço: {formatCurrency(prod.preco_por_m2)}/m²</p>}
                    <p className="font-semibold text-gray-800">{o.area_com_perda?.toFixed(2)} m² x {prod ? formatCurrency(prod.preco_por_m2) : '—'}/m² = {formatCurrency(o.valor_total)}</p>

                    {o.forma_pagamento === 'parcelado' && o.valor_parcela && o.valor_total_parcelado && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="font-semibold text-gray-700">Condições de Pagamento:</p>
                        <p>{o.numero_parcelas}x de {formatCurrency(o.valor_parcela)} {o.taxa_juros_mensal > 0 && `(${o.taxa_juros_mensal}% a.m.)`}</p>
                        <p>Total parcelado: {formatCurrency(o.valor_total_parcelado)}</p>
                        {o.valor_total_parcelado > o.valor_total && (
                          <p className="text-gray-500">Juros: {formatCurrency(o.valor_total_parcelado - o.valor_total)}</p>
                        )}
                      </div>
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

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-medium">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Selecione o piso *</label>
                <select value={produtoId} onChange={(e) => handleProdutoChange(e.target.value)} required className="w-full px-3 py-3 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Escolha um produto...</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fabricante} {p.linha} — {formatCurrency(p.preco_por_m2)}/m²
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Área total (m²) *</label>
                <input type="number" inputMode="decimal" step="0.01" min="0.01" value={areaTotal} onChange={(e) => setAreaTotal(e.target.value)} required placeholder="Ex: 38" className="w-full px-3 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {areaMedicao > 0 && <p className="text-xs text-gray-400 mt-1">Área da medição: {areaMedicao} m² | Perda: {perdaMedicao}%</p>}
              </div>

              {calculo && produtoSelecionado && (
                <div className="bg-blue-50 rounded-lg p-4 space-y-3 border border-blue-200">
                  <p className="text-sm font-semibold text-blue-900">Como calculamos:</p>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>Área informada: <strong>{area} m²</strong></p>
                    <p>Perda (da medição): {perda}% → Área final: <strong>{calculo.areaComPerda.toFixed(2)} m²</strong></p>
                    <p>Preço: <strong>{formatCurrency(produtoSelecionado.preco_por_m2)}/m²</strong></p>
                  </div>
                  <p className="text-xl font-bold text-blue-900 pt-2 border-t border-blue-200">
                    Total à vista: {formatCurrency(calculo.total)}
                  </p>

                  {/* Forma de Pagamento */}
                  <div className="pt-2 border-t border-blue-200">
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
                    <div className="space-y-3 pt-2">
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
                              Juros: {formatCurrency(jurosTotal)} ({((jurosTotal / calculo.total) * 100).toFixed(1)}% sobre o valor à vista)
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-gray-500 mt-2">Cálculo estimado. Medidas devem ser confirmadas no local.</p>
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowForm(false); setErro(''); }} className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium">
                  Cancelar
                </button>
                <button type="submit" disabled={loading || !calculo} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50">
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
