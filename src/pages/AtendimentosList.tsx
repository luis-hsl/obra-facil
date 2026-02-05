import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Atendimento } from '../types';
import StatusBadge from '../components/StatusBadge';

export default function AtendimentosList() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    loadAtendimentos();
  }, []);

  const loadAtendimentos = async () => {
    const { data, error } = await supabase
      .from('atendimentos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setErro('Erro ao carregar atendimentos.');
    } else {
      setAtendimentos(data || []);
    }
    setLoading(false);
  };

  const filtrados = atendimentos.filter((a) => {
    const q = filtro.toLowerCase();
    return (
      a.cliente_nome.toLowerCase().includes(q) ||
      a.endereco.toLowerCase().includes(q) ||
      a.tipo_servico.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return <p className="text-center text-gray-500 mt-8">Carregando...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Atendimentos</h2>
        <Link
          to="/atendimentos/novo"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold no-underline"
        >
          + Novo
        </Link>
      </div>

      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      <input
        type="text"
        placeholder="Buscar por cliente, endereço ou serviço..."
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        className="w-full px-4 py-3 rounded-lg border border-gray-300 mb-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {filtrados.length === 0 ? (
        <p className="text-center text-gray-400 mt-8">
          {atendimentos.length === 0 ? 'Nenhum atendimento' : 'Nenhum resultado encontrado'}
        </p>
      ) : (
        <div className="space-y-3">
          {filtrados.map((a) => (
            <Link
              key={a.id}
              to={`/atendimentos/${a.id}`}
              className="block bg-white rounded-lg border border-gray-200 p-4 no-underline"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{a.cliente_nome}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {[a.endereco, a.numero, a.bairro, a.cidade].filter(Boolean).join(', ')}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">{a.tipo_servico}</p>
                </div>
                <StatusBadge status={a.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
