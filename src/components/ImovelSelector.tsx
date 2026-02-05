import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Imovel } from '../types';

interface Props {
  clienteId: string;
  value: string;
  onChange: (imovelId: string) => void;
}

export default function ImovelSelector({ clienteId, value, onChange }: Props) {
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [endereco, setEndereco] = useState('');
  const [apelido, setApelido] = useState('');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!clienteId) {
      setImoveis([]);
      return;
    }
    supabase
      .from('imoveis')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at')
      .then(({ data }) => setImoveis(data || []));
  }, [clienteId]);

  const handleCreate = async () => {
    if (!endereco.trim()) return;
    setErro('');
    setSaving(true);

    const { data, error } = await supabase
      .from('imoveis')
      .insert({
        cliente_id: clienteId,
        endereco: endereco.trim(),
        apelido: apelido.trim() || null,
      })
      .select()
      .single();

    if (error || !data) {
      setErro('Erro ao cadastrar imóvel.');
      setSaving(false);
      return;
    }

    setImoveis((prev) => [...prev, data]);
    onChange(data.id);
    setShowCreate(false);
    setEndereco('');
    setApelido('');
    setSaving(false);
  };

  if (!clienteId) return null;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Imóvel</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-3 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Sem imóvel definido</option>
        {imoveis.map((im) => (
          <option key={im.id} value={im.id}>
            {im.apelido ? `${im.apelido} — ${im.endereco}` : im.endereco}
          </option>
        ))}
      </select>

      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          className="mt-2 text-sm text-blue-600 font-medium"
        >
          + Adicionar imóvel
        </button>
      ) : (
        <div className="mt-2 bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-3">
          {erro && <p className="text-red-600 text-sm">{erro}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Endereço *</label>
            <input
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Rua das Flores, 123"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Apelido</label>
            <input
              type="text"
              value={apelido}
              onChange={(e) => setApelido(e.target.value)}
              placeholder="Ex: Apt Centro, Casa Praia"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !endereco.trim()}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
