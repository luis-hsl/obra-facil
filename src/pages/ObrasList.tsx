import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Obra } from '../types';
import StatusBadge from '../components/StatusBadge';

export default function ObrasList() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    loadObras();
  }, []);

  const loadObras = async () => {
    const { data } = await supabase
      .from('obras')
      .select('*')
      .order('created_at', { ascending: false });
    setObras(data || []);
    setLoading(false);
  };

  const obrasFiltradas = obras.filter(
    (o) =>
      o.cliente_nome.toLowerCase().includes(filtro.toLowerCase()) ||
      (o.endereco || '').toLowerCase().includes(filtro.toLowerCase())
  );

  if (loading) {
    return <p className="text-center text-gray-500 mt-8">Carregando...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Obras</h2>
        <Link
          to="/obras/nova"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold no-underline"
        >
          + Nova Obra
        </Link>
      </div>

      <input
        type="text"
        placeholder="Buscar por cliente ou endereço..."
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        className="w-full px-4 py-3 rounded-lg border border-gray-300 mb-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {obrasFiltradas.length === 0 ? (
        <p className="text-center text-gray-400 mt-8">
          {obras.length === 0 ? 'Nenhuma obra cadastrada' : 'Nenhum resultado encontrado'}
        </p>
      ) : (
        <div className="space-y-3">
          {obrasFiltradas.map((obra) => (
            <Link
              key={obra.id}
              to={`/obras/${obra.id}`}
              className="block bg-white rounded-lg border border-gray-200 p-4 no-underline"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{obra.cliente_nome}</p>
                  {obra.endereco && (
                    <p className="text-sm text-gray-500 mt-1">{obra.endereco}</p>
                  )}
                  {obra.tipo_servico && (
                    <p className="text-sm text-gray-400 mt-1">{obra.tipo_servico}</p>
                  )}
                </div>
                <StatusBadge status={obra.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
