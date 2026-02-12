import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Fechamento, Orcamento } from '../types';
import ConfirmModal from './ConfirmModal';

interface Props {
  atendimentoId: string;
  orcamentos: Orcamento[];
  fechamento: Fechamento | null;
  onSave: () => void;
}

export default function FechamentoForm({ atendimentoId, orcamentos, fechamento, onSave }: Props) {
  const orcamentoAprovado = orcamentos.find((o) => o.status === 'aprovado');
  const valorSugerido = orcamentoAprovado?.valor_total_parcelado || orcamentoAprovado?.valor_total || 0;

  const [valorRecebido, setValorRecebido] = useState('');
  const [custoDistribuidor, setCustoDistribuidor] = useState('');
  const [custoInstalador, setCustoInstalador] = useState('');
  const [custoExtras, setCustoExtras] = useState('');
  const [observacoesExtras, setObservacoesExtras] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [editing, setEditing] = useState(!fechamento);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (fechamento) {
      setValorRecebido(fechamento.valor_recebido.toFixed(2));
      setCustoDistribuidor(fechamento.custo_distribuidor.toFixed(2));
      setCustoInstalador(fechamento.custo_instalador.toFixed(2));
      setCustoExtras(fechamento.custo_extras.toFixed(2));
      setObservacoesExtras(fechamento.observacoes_extras || '');
    } else if (valorSugerido > 0 && !valorRecebido) {
      setValorRecebido(valorSugerido.toFixed(2));
    }
  }, [fechamento, valorSugerido]);

  const recebido = parseFloat(valorRecebido) || 0;
  const distribuidor = parseFloat(custoDistribuidor) || 0;
  const instalador = parseFloat(custoInstalador) || 0;
  const extras = parseFloat(custoExtras) || 0;
  const lucroCalculado = recebido - distribuidor - instalador - extras;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recebido <= 0) { setErro('O valor recebido precisa ser maior que zero.'); return; }
    setErro('');
    setLoading(true);

    const data = {
      atendimento_id: atendimentoId,
      valor_recebido: recebido,
      custo_distribuidor: distribuidor,
      custo_instalador: instalador,
      custo_extras: extras,
      observacoes_extras: observacoesExtras || null,
    };

    let error;
    if (fechamento) {
      const result = await supabase.from('fechamentos').update(data).eq('id', fechamento.id);
      error = result.error;
    } else {
      const result = await supabase.from('fechamentos').insert(data);
      error = result.error;
    }

    if (error) { setErro('Erro ao salvar fechamento.'); setLoading(false); return; }

    // Auto-advance to concluído
    if (!fechamento) {
      await supabase.from('atendimentos').update({ status: 'concluido' }).eq('id', atendimentoId);
    }

    setEditing(false);
    setLoading(false);
    onSave();
  };

  const handleDelete = async () => {
    if (!fechamento) return;
    setLoading(true);
    const { error } = await supabase.from('fechamentos').delete().eq('id', fechamento.id);
    if (error) { setErro('Erro ao excluir fechamento.'); setLoading(false); return; }
    // Revert status back to execucao
    await supabase.from('atendimentos').update({ status: 'execucao' }).eq('id', atendimentoId);
    setValorRecebido(String(valorSugerido));
    setCustoDistribuidor('');
    setCustoInstalador('');
    setCustoExtras('');
    setObservacoesExtras('');
    setEditing(true);
    setLoading(false);
    setShowDeleteConfirm(false);
    onSave();
  };

  if (fechamento && !editing) {
    return (
      <div className="space-y-3">
        <div className={`rounded-xl p-4 ${fechamento.lucro_final >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-xl font-bold ${fechamento.lucro_final >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
            Lucro: {formatCurrency(fechamento.lucro_final)}
          </p>
        </div>

        <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600 space-y-1">
          <p>Valor Recebido: <strong className="text-slate-800">{formatCurrency(fechamento.valor_recebido)}</strong></p>
          <p className="font-semibold text-slate-700 mt-2">Custos:</p>
          <p>Distribuidor (material): {formatCurrency(fechamento.custo_distribuidor)}</p>
          <p>Instalador (mão de obra): {formatCurrency(fechamento.custo_instalador)}</p>
          <p>Extras (imprevistos): {formatCurrency(fechamento.custo_extras)}</p>
          {fechamento.observacoes_extras && (
            <p className="mt-2 text-slate-500">Obs: {fechamento.observacoes_extras}</p>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={() => setEditing(true)} className="flex-1 py-2 text-sm text-blue-600 font-medium border border-blue-200 rounded-xl">
            Editar
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} disabled={loading} className="py-2 px-4 text-sm text-red-500 font-medium disabled:opacity-50">
            Excluir
          </button>
        </div>

        <ConfirmModal
          aberto={showDeleteConfirm}
          titulo="Excluir fechamento?"
          descricao="Isso vai apagar os dados financeiros e reverter o status para execução."
          confirmLabel="Excluir"
          variante="danger"
          loading={loading}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {erro && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><p className="text-red-600 text-sm">{erro}</p></div>}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Valor Recebido *</label>
        <input type="number" inputMode="decimal" step="0.01" min="0.01"
          value={valorRecebido} onChange={(e) => setValorRecebido(e.target.value)} required placeholder="Ex: 5000"
          className="w-full px-3 py-3 rounded-xl border border-slate-200 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-300" />
        {orcamentoAprovado && (
          <p className="text-xs text-slate-400 mt-1">Valor do orçamento aprovado: {formatCurrency(valorSugerido)}</p>
        )}
      </div>

      <div className="border-t border-slate-200 pt-4">
        <p className="text-sm font-medium text-slate-700 mb-1">Custos</p>
        <p className="text-xs text-slate-400 mb-3">Informe os custos reais do projeto para calcular o lucro.</p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Distribuidor (material)</label>
            <input type="number" inputMode="decimal" step="0.01" min="0"
              value={custoDistribuidor} onChange={(e) => setCustoDistribuidor(e.target.value)} placeholder="Ex: 2000"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-300" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Instalador (mão de obra)</label>
            <input type="number" inputMode="decimal" step="0.01" min="0"
              value={custoInstalador} onChange={(e) => setCustoInstalador(e.target.value)} placeholder="Ex: 800"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-300" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Extras (imprevistos)</label>
            <input type="number" inputMode="decimal" step="0.01" min="0"
              value={custoExtras} onChange={(e) => setCustoExtras(e.target.value)} placeholder="Ex: 150"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-300" />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Observações (extras, imprevistos)</label>
            <textarea value={observacoesExtras} onChange={(e) => setObservacoesExtras(e.target.value)}
              placeholder="Ex: Faltou material, precisou comprar mais uma caixa" rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-300" />
          </div>
        </div>
      </div>

      {recebido > 0 && (
        <div className={`rounded-xl p-4 ${lucroCalculado >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
          <p className="text-sm text-slate-600 mb-1">Lucro calculado:</p>
          <p className={`text-2xl font-bold ${lucroCalculado >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>{formatCurrency(lucroCalculado)}</p>
          <p className="text-xs text-slate-500 mt-1">{formatCurrency(recebido)} - {formatCurrency(distribuidor + instalador + extras)} (custos)</p>
        </div>
      )}

      {!fechamento && (
        <p className="text-xs text-blue-600 bg-blue-50 rounded-xl px-3 py-2">
          Ao salvar, o atendimento será automaticamente marcado como concluído.
        </p>
      )}

      <div className="flex gap-3">
        {fechamento && (
          <button type="button" onClick={() => setEditing(false)} className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-700 font-medium">
            Cancelar
          </button>
        )}
        <button type="submit" disabled={loading} className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold disabled:opacity-50 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]">
          {loading ? 'Salvando...' : fechamento ? 'Atualizar' : 'Salvar e Concluir'}
        </button>
      </div>
    </form>
  );
}
