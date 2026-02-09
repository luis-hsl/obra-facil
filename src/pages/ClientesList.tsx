import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Atendimento } from '../types';

interface Cliente {
  nome: string;
  telefone: string;
  atendimentos: Atendimento[];
  concluidos: number;
}

export default function ClientesList() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');
  const [expandedCliente, setExpandedCliente] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [deletando, setDeletando] = useState(false);

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    const { data, error } = await supabase
      .from('atendimentos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setErro('Erro ao carregar clientes.');
      setLoading(false);
      return;
    }

    // Agrupar por cliente (nome + telefone)
    const clientesMap: Record<string, Cliente> = {};

    (data || []).forEach((atd) => {
      const key = `${atd.cliente_nome}|${atd.cliente_telefone}`;
      if (!clientesMap[key]) {
        clientesMap[key] = {
          nome: atd.cliente_nome,
          telefone: atd.cliente_telefone,
          atendimentos: [],
          concluidos: 0,
        };
      }
      clientesMap[key].atendimentos.push(atd);
      if (atd.status === 'concluido') {
        clientesMap[key].concluidos++;
      }
    });

    // Ordenar por nome
    const lista = Object.values(clientesMap).sort((a, b) =>
      a.nome.localeCompare(b.nome)
    );

    setClientes(lista);
    setLoading(false);
  };

  const handleDeleteCliente = async (cliente: Cliente) => {
    const count = cliente.atendimentos.length;
    if (!confirm(`Apagar ${cliente.nome} e todos os ${count} atendimento(s) relacionados?`)) {
      setMenuAberto(null);
      return;
    }

    setDeletando(true);
    setMenuAberto(null);

    // Deletar todos os atendimentos do cliente
    const ids = cliente.atendimentos.map((a) => a.id);
    const { error } = await supabase
      .from('atendimentos')
      .delete()
      .in('id', ids);

    if (error) {
      setErro('Erro ao apagar cliente.');
    } else {
      await loadClientes();
    }
    setDeletando(false);
  };

  const filtrados = clientes.filter((c) => {
    const q = filtro.toLowerCase();
    return (
      c.nome.toLowerCase().includes(q) ||
      c.telefone.toLowerCase().includes(q)
    );
  });

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      iniciado: 'Cadastrado',
      visita_tecnica: 'Visita',
      medicao: 'Medição',
      orcamento: 'Orçamento',
      aprovado: 'Aprovado',
      execucao: 'Execução',
      concluido: 'Concluído',
      reprovado: 'Reprovado',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      iniciado: 'bg-gray-100 text-gray-600',
      visita_tecnica: 'bg-purple-100 text-purple-700',
      medicao: 'bg-yellow-100 text-yellow-700',
      orcamento: 'bg-blue-100 text-blue-700',
      aprovado: 'bg-green-100 text-green-700',
      execucao: 'bg-orange-100 text-orange-700',
      concluido: 'bg-emerald-100 text-emerald-700',
      reprovado: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  };

  if (loading) {
    return <p className="text-center text-gray-500 mt-8">Carregando...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Clientes</h2>
        <Link
          to="/atendimentos/novo"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold no-underline"
        >
          + Novo
        </Link>
      </div>

      <p className="text-sm text-gray-500 mb-4">{clientes.length} cliente(s) cadastrado(s)</p>

      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      <input
        type="text"
        placeholder="Buscar por nome ou telefone..."
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
          {filtrados.map((cliente) => {
            const key = `${cliente.nome}|${cliente.telefone}`;
            const isExpanded = expandedCliente === key;
            return (
              <div key={key} className="bg-white rounded-lg border border-gray-200 relative" style={{ overflow: 'visible' }}>
                <div className="flex items-center">
                  <button
                    onClick={() => setExpandedCliente(isExpanded ? null : key)}
                    className="flex-1 flex items-center justify-between px-4 py-3 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{cliente.nome}</p>
                      <p className="text-sm text-gray-500">{cliente.telefone}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-700">
                          {cliente.atendimentos.length} atendimento(s)
                        </p>
                        {cliente.concluidos > 0 && (
                          <p className="text-xs text-green-600">
                            {cliente.concluidos} concluído(s)
                          </p>
                        )}
                      </div>
                      <span className={`text-gray-400 text-lg transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                        ›
                      </span>
                    </div>
                  </button>

                  {/* Menu ... */}
                  <div className="relative pr-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuAberto(menuAberto === key ? null : key);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      ⋮
                    </button>

                    {menuAberto === key && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 min-w-[120px]">
                        <button
                          onClick={() => handleDeleteCliente(cliente)}
                          disabled={deletando}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletando ? 'Apagando...' : 'Apagar cliente'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-sm font-medium text-gray-600">Histórico de atendimentos</p>
                      <Link
                        to={`/atendimentos/novo?cliente=${encodeURIComponent(cliente.nome)}&telefone=${encodeURIComponent(cliente.telefone)}`}
                        className="text-sm text-blue-600 font-medium no-underline"
                      >
                        + Novo atendimento
                      </Link>
                    </div>

                    <div className="space-y-2">
                      {cliente.atendimentos.map((atd) => (
                        <Link
                          key={atd.id}
                          to={`/atendimentos/${atd.id}`}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg no-underline"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-800">{atd.tipo_servico}</p>
                            <p className="text-xs text-gray-500">
                              {[atd.endereco, atd.numero, atd.bairro].filter(Boolean).join(', ')}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(atd.status)}`}>
                            {getStatusLabel(atd.status)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
