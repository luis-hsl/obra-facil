import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Orcamento } from '../types';
import StatusBadge from './StatusBadge';

interface Props {
  obraId: string;
  orcamentos: Orcamento[];
  onSave: () => void;
}

export default function OrcamentoForm({ obraId, orcamentos, onSave }: Props) {
  const [valorTotal, setValorTotal] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    await supabase.from('orcamentos').insert({
      obra_id: obraId,
      valor_total: parseFloat(valorTotal),
    });

    setValorTotal('');
    setShowForm(false);
    setLoading(false);
    onSave();
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    await supabase.from('orcamentos').update({ status: newStatus }).eq('id', id);
    onSave();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Excluir este orçamento?')) {
      await supabase.from('orcamentos').delete().eq('id', id);
      onSave();
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div>
      {/* Lista de orçamentos */}
      {orcamentos.length > 0 && (
        <div className="space-y-2 mb-4">
          {orcamentos.map((o) => (
            <div key={o.id} className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-gray-900 text-lg">
                  {formatCurrency(o.valor_total)}
                </p>
                <StatusBadge status={o.status} />
              </div>
              <div className="flex gap-2">
                {o.status !== 'aprovado' && (
                  <button
                    onClick={() => handleStatusChange(o.id, 'aprovado')}
                    className="text-sm text-green-600 font-medium"
                  >
                    Aprovar
                  </button>
                )}
                {o.status !== 'perdido' && (
                  <button
                    onClick={() => handleStatusChange(o.id, 'perdido')}
                    className="text-sm text-red-600 font-medium"
                  >
                    Perdido
                  </button>
                )}
                {o.status !== 'enviado' && (
                  <button
                    onClick={() => handleStatusChange(o.id, 'enviado')}
                    className="text-sm text-blue-600 font-medium"
                  >
                    Enviado
                  </button>
                )}
                <button
                  onClick={() => handleDelete(o.id)}
                  className="text-sm text-gray-400 ml-auto"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-medium"
        >
          + Novo Orçamento
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor Total (R$) *
            </label>
            <input
              type="number"
              step="0.01"
              value={valorTotal}
              onChange={(e) => setValorTotal(e.target.value)}
              required
              placeholder="0,00"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
