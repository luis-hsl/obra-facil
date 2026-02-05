import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Medicao } from '../types';

interface Props {
  atendimentoId: string;
  medicoes: Medicao[];
  currentStatus: string;
  onSave: () => void;
}

export default function MedicaoForm({ atendimentoId, medicoes, currentStatus, onSave }: Props) {
  const medicao = medicoes[0] || null;
  const [editing, setEditing] = useState(false);
  const [areaTotal, setAreaTotal] = useState('');
  const [perdaPercentual, setPerdaPercentual] = useState('10');
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const showForm = !medicao || editing;

  const startEdit = () => {
    if (medicao) {
      setAreaTotal(String(medicao.area_total));
      setPerdaPercentual(String(medicao.perda_percentual || 10));
      setObservacoes(medicao.observacoes || '');
    }
    setEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    const valor = parseFloat(areaTotal);
    const perda = parseFloat(perdaPercentual) || 10;

    if (!valor || valor <= 0) {
      setErro('A área precisa ser maior que zero.');
      return;
    }

    setLoading(true);

    if (medicao) {
      const { error } = await supabase
        .from('medicoes')
        .update({ area_total: valor, perda_percentual: perda, observacoes: observacoes || null })
        .eq('id', medicao.id);

      if (error) {
        setErro('Erro ao atualizar medição.');
        setLoading(false);
        return;
      }
    } else {
      const { error } = await supabase.from('medicoes').insert({
        atendimento_id: atendimentoId,
        area_total: valor,
        perda_percentual: perda,
        observacoes: observacoes || null,
      });

      if (error) {
        setErro('Erro ao salvar medição.');
        setLoading(false);
        return;
      }

      // Auto-avançar status para 'medicao' se ainda estiver em visita_tecnica
      if (currentStatus === 'visita_tecnica') {
        await supabase.from('atendimentos').update({ status: 'medicao' }).eq('id', atendimentoId);
      }
    }

    setAreaTotal('');
    setPerdaPercentual('10');
    setObservacoes('');
    setEditing(false);
    setLoading(false);
    onSave();
  };

  return (
    <div>
      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      {!showForm && medicao ? (
        <div className="bg-green-50 rounded-lg border border-green-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-green-800">Medição registrada</p>
            <button onClick={startEdit} className="text-sm text-blue-600 font-medium">
              Editar
            </button>
          </div>
          <p className="text-2xl font-bold text-green-900">{medicao.area_total} m²</p>
          <p className="text-sm text-green-700">Perda: {medicao.perda_percentual || 10}%</p>
          <p className="text-sm text-green-600">
            Área final: {(medicao.area_total * (1 + (medicao.perda_percentual || 10) / 100)).toFixed(2)} m²
          </p>
          {medicao.observacoes && (
            <p className="text-sm text-green-700 mt-1">{medicao.observacoes}</p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Área total (m²) *
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={areaTotal}
              onChange={(e) => setAreaTotal(e.target.value)}
              required
              placeholder="Ex: 48.5"
              className="w-full px-3 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Perda (%)</label>
            <input
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              value={perdaPercentual}
              onChange={(e) => setPerdaPercentual(e.target.value)}
              placeholder="Ex: 10"
              className="w-full px-3 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Recortes geram perda de material. O padrão é 10%</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <input
              type="text"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Sala + cozinha"
              className="w-full px-3 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3">
            {editing && (
              <button
                type="button"
                onClick={() => { setEditing(false); setErro(''); }}
                className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar Medição'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
