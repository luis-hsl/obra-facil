import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Atendimento, AtendimentoStatus } from '../types';
import StatusBadge from '../components/StatusBadge';

const ANDAMENTO_STATUSES: AtendimentoStatus[] = ['visita_tecnica', 'medicao', 'orcamento'];

export default function AndamentoList() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<AtendimentoStatus | ''>('');

  useEffect(() => {
    loadAtendimentos();
  }, []);

  const loadAtendimentos = async () => {
    const { data, error } = await supabase
      .from('atendimentos')
      .select('*')
      .in('status', ANDAMENTO_STATUSES)
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
    const matchTexto =
      a.cliente_nome.toLowerCase().includes(q) ||
      a.endereco.toLowerCase().includes(q) ||
      a.tipo_servico.toLowerCase().includes(q);
    const matchStatus = !statusFiltro || a.status === statusFiltro;
    return matchTexto && matchStatus;
  });

  if (loading) {
    return <p className="text-center text-gray-500 mt-8">Carregando...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Em Andamento</h2>
      </div>

      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      <input
        type="text"
        placeholder="Buscar por cliente, endereço ou serviço..."
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        className="w-full px-4 py-3 rounded-lg border border-gray-300 mb-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setStatusFiltro('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            !statusFiltro ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          Todos
        </button>
        {ANDAMENTO_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFiltro(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              statusFiltro === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {s === 'visita_tecnica' ? 'Visita' : s === 'medicao' ? 'Medição' : 'Orçamento'}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <p className="text-center text-gray-400 mt-8">
          {atendimentos.length === 0 ? 'Nenhum atendimento em andamento' : 'Nenhum resultado encontrado'}
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
