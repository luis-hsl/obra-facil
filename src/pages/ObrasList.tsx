import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Obra } from '../types';

function StepIndicator({ status }: { status: string }) {
  // Derivar etapa do status da obra
  const steps = [
    { label: 'Medição', done: ['medicao', 'orcado', 'execucao', 'finalizado'].includes(status) },
    { label: 'Orçamento', done: ['orcado', 'execucao', 'finalizado'].includes(status) },
    { label: 'Execução', done: ['finalizado'].includes(status) },
  ];

  return (
    <div className="flex gap-2 mt-2">
      {steps.map((step) => (
        <span
          key={step.label}
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            step.done
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          {step.done ? '✓' : '○'} {step.label}
        </span>
      ))}
    </div>
  );
}

export default function ObrasList() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    loadObras();
  }, []);

  const loadObras = async () => {
    const { data, error } = await supabase
      .from('obras')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setErro('Erro ao carregar visitas.');
    } else {
      setObras(data || []);
    }
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
        <h2 className="text-xl font-bold text-gray-900">Visitas</h2>
        <Link
          to="/obras/nova"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold no-underline"
        >
          + Nova Visita
        </Link>
      </div>

      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      <input
        type="text"
        placeholder="Buscar por cliente ou endereço..."
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        className="w-full px-4 py-3 rounded-lg border border-gray-300 mb-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {obrasFiltradas.length === 0 ? (
        <p className="text-center text-gray-400 mt-8">
          {obras.length === 0 ? 'Nenhuma visita cadastrada' : 'Nenhum resultado encontrado'}
        </p>
      ) : (
        <div className="space-y-3">
          {obrasFiltradas.map((obra) => (
            <Link
              key={obra.id}
              to={`/obras/${obra.id}`}
              className="block bg-white rounded-lg border border-gray-200 p-4 no-underline"
            >
              <p className="font-semibold text-gray-900">{obra.cliente_nome}</p>
              {obra.endereco && (
                <p className="text-sm text-gray-500 mt-1">{obra.endereco}</p>
              )}
              {obra.tipo_servico && (
                <p className="text-sm text-gray-400 mt-1">{obra.tipo_servico}</p>
              )}
              <StepIndicator status={obra.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
