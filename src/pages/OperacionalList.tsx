import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Atendimento, Fechamento } from '../types';
import StatusBadge from '../components/StatusBadge';

export default function OperacionalList() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [fechamentos, setFechamentos] = useState<Record<string, Fechamento>>({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [atdRes, fechRes] = await Promise.all([
      supabase
        .from('atendimentos')
        .select('*')
        .in('status', ['aprovado', 'execucao'])
        .order('created_at', { ascending: false }),
      supabase.from('fechamentos').select('*'),
    ]);

    if (atdRes.error) {
      setErro('Erro ao carregar atendimentos.');
    } else {
      setAtendimentos(atdRes.data || []);
    }

    if (fechRes.data) {
      const map: Record<string, Fechamento> = {};
      fechRes.data.forEach((f) => {
        map[f.atendimento_id] = f;
      });
      setFechamentos(map);
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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  if (loading) {
    return <p className="text-center text-gray-500 mt-8">Carregando...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Operacional</h2>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Atendimentos em execução. Preencha os custos de distribuidores e instaladores.
      </p>

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
          {atendimentos.length === 0 ? 'Nenhum atendimento em execução' : 'Nenhum resultado encontrado'}
        </p>
      ) : (
        <div className="space-y-3">
          {filtrados.map((a) => {
            const fechamento = fechamentos[a.id];
            const temPrecificacao = !!fechamento;
            return (
              <Link
                key={a.id}
                to={`/precificacao/${a.id}`}
                className="block bg-white rounded-lg border border-gray-200 p-4 no-underline"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{a.cliente_nome}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {[a.endereco, a.numero, a.bairro, a.cidade].filter(Boolean).join(', ')}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">{a.tipo_servico}</p>

                    {fechamento ? (
                      <div className="flex gap-3 mt-2 text-sm">
                        <span className="text-gray-500">
                          Distribuidor: <strong className="text-gray-700">{formatCurrency(fechamento.custo_distribuidor)}</strong>
                        </span>
                        <span className="text-gray-500">
                          Instalador: <strong className="text-gray-700">{formatCurrency(fechamento.custo_instalador)}</strong>
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-orange-500 mt-2">Precificação pendente</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={a.status} />
                    {temPrecificacao && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        Custos OK
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
