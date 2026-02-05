import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import type { Cliente } from '../types';

interface Props {
  value: string;
  onChange: (clienteId: string) => void;
}

export default function ClienteSelector({ value, onChange }: Props) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Cliente[]>([]);
  const [selected, setSelected] = useState<Cliente | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  // Carregar cliente selecionado (para modo edição)
  useEffect(() => {
    if (value && !selected) {
      supabase
        .from('clientes')
        .select('*')
        .eq('id', value)
        .single()
        .then(({ data }) => {
          if (data) {
            setSelected(data);
            setSearch(data.nome);
          }
        });
    }
  }, [value]);

  // Buscar clientes com debounce
  useEffect(() => {
    if (search.length < 2 || selected) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .ilike('nome', `%${search}%`)
        .order('nome')
        .limit(5);
      setResults(data || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, selected]);

  const handleSelect = (cliente: Cliente) => {
    setSelected(cliente);
    setSearch(cliente.nome);
    setResults([]);
    onChange(cliente.id);
  };

  const handleClear = () => {
    setSelected(null);
    setSearch('');
    onChange('');
  };

  const handleCreate = async () => {
    if (!nome.trim()) return;
    setErro('');
    setSaving(true);

    const { data, error } = await supabase
      .from('clientes')
      .insert({
        user_id: user!.id,
        nome: nome.trim(),
        telefone: telefone.trim() || null,
      })
      .select()
      .single();

    if (error || !data) {
      setErro('Erro ao cadastrar cliente.');
      setSaving(false);
      return;
    }

    handleSelect(data);
    setShowCreate(false);
    setNome('');
    setTelefone('');
    setSaving(false);
  };

  if (selected) {
    return (
      <div className="flex items-center gap-2 bg-blue-50 rounded-lg border border-blue-200 p-3">
        <div className="flex-1">
          <p className="font-medium text-blue-900">{selected.nome}</p>
          {selected.telefone && <p className="text-sm text-blue-700">{selected.telefone}</p>}
        </div>
        <button onClick={handleClear} className="text-sm text-blue-600 font-medium">
          Trocar
        </button>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar cliente pelo nome..."
        className="w-full px-3 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Resultados da busca */}
      {results.length > 0 && (
        <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
            >
              <p className="font-medium text-gray-900">{c.nome}</p>
              {c.telefone && <p className="text-sm text-gray-500">{c.telefone}</p>}
            </button>
          ))}
        </div>
      )}

      {/* Botão criar novo */}
      {search.length >= 2 && !showCreate && (
        <button
          onClick={() => { setShowCreate(true); setNome(search); }}
          className="mt-2 text-sm text-blue-600 font-medium"
        >
          + Cadastrar novo cliente
        </button>
      )}

      {/* Mini-form inline */}
      {showCreate && (
        <div className="mt-2 bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-3">
          {erro && <p className="text-red-600 text-sm">{erro}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Telefone</label>
            <input
              type="tel"
              inputMode="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(11) 99999-9999"
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
              disabled={saving || !nome.trim()}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Cadastrar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
