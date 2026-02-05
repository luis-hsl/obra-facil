import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Cliente } from '../types';

export default function ClientesList() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nome');

    if (error) {
      setErro('Erro ao carregar clientes.');
    } else {
      setClientes(data || []);
    }
    setLoading(false);
  };

  const filtrados = clientes.filter(
    (c) =>
      c.nome.toLowerCase().includes(filtro.toLowerCase()) ||
      (c.telefone || '').includes(filtro) ||
      (c.cpf_cnpj || '').includes(filtro)
  );

  if (loading) {
    return <p className="text-center text-gray-500 mt-8">Carregando...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Clientes</h2>
        <Link
          to="/clientes/novo"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold no-underline"
        >
          + Novo Cliente
        </Link>
      </div>

      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      <input
        type="text"
        placeholder="Buscar por nome, telefone ou CPF/CNPJ..."
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        className="w-full px-4 py-3 rounded-lg border border-gray-300 mb-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {filtrados.length === 0 ? (
        <p className="text-center text-gray-400 mt-8">
          {clientes.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum resultado encontrado'}
        </p>
      ) : (
        <div className="space-y-3">
          {filtrados.map((c) => (
            <Link
              key={c.id}
              to={`/clientes/${c.id}`}
              className="block bg-white rounded-lg border border-gray-200 p-4 no-underline"
            >
              <p className="font-semibold text-gray-900">{c.nome}</p>
              {c.telefone && <p className="text-sm text-gray-500 mt-1">{c.telefone}</p>}
              {c.email && <p className="text-sm text-gray-400 mt-1">{c.email}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
