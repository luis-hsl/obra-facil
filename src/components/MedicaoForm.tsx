import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Medicao } from '../types';

interface Props {
  obraId: string;
  medicoes: Medicao[];
  onSave: () => void;
}

export default function MedicaoForm({ obraId, medicoes, onSave }: Props) {
  const [tipoMedida, setTipoMedida] = useState('m2');
  const [valor, setValor] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [erro, setErro] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    const valorNum = parseFloat(valor);
    if (!valorNum || valorNum <= 0) {
      setErro('O valor da medição precisa ser maior que zero.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('medicoes').insert({
      obra_id: obraId,
      tipo_medida: tipoMedida,
      valor: parseFloat(valor),
      observacoes: observacoes || null,
    });

    if (error) {
      setErro('Erro ao salvar medição.');
      setLoading(false);
      return;
    }

    setValor('');
    setObservacoes('');
    setShowForm(false);
    setLoading(false);
    onSave();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta medição?')) return;
    setDeletingId(id);
    const { error } = await supabase.from('medicoes').delete().eq('id', id);
    if (error) {
      setErro('Erro ao excluir medição.');
    } else {
      onSave();
    }
    setDeletingId(null);
  };

  return (
    <div>
      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      {/* Lista de medições */}
      {medicoes.length > 0 && (
        <div className="space-y-2 mb-4">
          {medicoes.map((m) => (
            <div key={m.id} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">
                  {m.valor} {m.tipo_medida}
                </p>
                {m.observacoes && (
                  <p className="text-sm text-gray-500">{m.observacoes}</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(m.id)}
                disabled={deletingId === m.id}
                className="text-red-500 text-sm disabled:opacity-50"
              >
                {deletingId === m.id ? '...' : 'Excluir'}
              </button>
            </div>
          ))}

          {/* Resumo total */}
          {(() => {
            const totalM2 = medicoes.filter((m) => m.tipo_medida === 'm2').reduce((sum, m) => sum + m.valor, 0);
            const totalMl = medicoes.filter((m) => m.tipo_medida === 'ml').reduce((sum, m) => sum + m.valor, 0);
            return (
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
                <p className="font-semibold">Resumo das medições</p>
                {totalM2 > 0 && <p>Área total: {totalM2.toFixed(2)} m²</p>}
                {totalMl > 0 && <p>Comprimento total: {totalMl.toFixed(2)} ml</p>}
              </div>
            );
          })()}
        </div>
      )}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-medium"
        >
          + Adicionar Medição
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                required
                placeholder="Ex: 48.5"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="w-28">
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
              <select
                value={tipoMedida}
                onChange={(e) => setTipoMedida(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="m2">m²</option>
                <option value="ml">ml</option>
                <option value="unidade">unidade</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <input
              type="text"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Sala principal"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setShowForm(false); setErro(''); }}
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
