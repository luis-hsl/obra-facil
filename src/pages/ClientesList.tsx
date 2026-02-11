import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Atendimento } from '../types';
import EmptyState from '../components/EmptyState';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ConfirmModal from '../components/ConfirmModal';

interface Cliente {
  nome: string;
  telefone: string;
  atendimentos: Atendimento[];
  concluidos: number;
}

const ITEMS_PER_PAGE = 20;
const STORAGE_KEY = 'clientes-expanded';

export default function ClientesList() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');
  const [expandedCliente, setExpandedCliente] = useState<string | null>(() => {
    try { return sessionStorage.getItem(STORAGE_KEY); } catch { return null; }
  });
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [deletando, setDeletando] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Cliente | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  useEffect(() => {
    loadClientes();
  }, []);

  // Persist expanded state
  const toggleExpanded = useCallback((key: string) => {
    setExpandedCliente(prev => {
      const next = prev === key ? null : key;
      try {
        if (next) sessionStorage.setItem(STORAGE_KEY, next);
        else sessionStorage.removeItem(STORAGE_KEY);
      } catch { /* noop */ }
      return next;
    });
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

    const clientesMap: Record<string, Cliente> = {};
    (data || []).forEach((atd) => {
      const key = `${atd.cliente_nome}|${atd.cliente_telefone}`;
      if (!clientesMap[key]) {
        clientesMap[key] = { nome: atd.cliente_nome, telefone: atd.cliente_telefone, atendimentos: [], concluidos: 0 };
      }
      clientesMap[key].atendimentos.push(atd);
      if (atd.status === 'concluido') clientesMap[key].concluidos++;
    });

    setClientes(Object.values(clientesMap).sort((a, b) => a.nome.localeCompare(b.nome)));
    setLoading(false);
  };

  const handleDeleteCliente = async (cliente: Cliente) => {
    setDeletando(true);
    setMenuAberto(null);
    const ids = cliente.atendimentos.map((a) => a.id);
    const { error } = await supabase.from('atendimentos').delete().in('id', ids);
    if (error) {
      setErro('Erro ao apagar cliente.');
    } else {
      await loadClientes();
    }
    setDeletando(false);
    setConfirmDelete(null);
  };

  const filtrados = clientes.filter((c) => {
    const q = filtro.toLowerCase();
    return c.nome.toLowerCase().includes(q) || c.telefone.toLowerCase().includes(q);
  });

  // Pagination
  const paginados = filtrados.slice(0, visibleCount);
  const hasMore = filtrados.length > visibleCount;

  // Reset pagination when filter changes
  useEffect(() => { setVisibleCount(ITEMS_PER_PAGE); }, [filtro]);

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      iniciado: 'Cadastrado', visita_tecnica: 'Visita', medicao: 'Medição',
      orcamento: 'Orçamento', aprovado: 'Aprovado', execucao: 'Execução',
      concluido: 'Concluído', reprovado: 'Reprovado',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      iniciado: 'bg-gray-100 text-gray-600', visita_tecnica: 'bg-purple-100 text-purple-700',
      medicao: 'bg-yellow-100 text-yellow-700', orcamento: 'bg-blue-100 text-blue-700',
      aprovado: 'bg-green-100 text-green-700', execucao: 'bg-orange-100 text-orange-700',
      concluido: 'bg-emerald-100 text-emerald-700', reprovado: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  if (loading) return <LoadingSkeleton count={5} />;

  // Build delete description with atendimento list
  const deleteDescricao = confirmDelete
    ? `Isso vai excluir ${confirmDelete.atendimentos.length} atendimento(s):\n${confirmDelete.atendimentos
        .slice(0, 5)
        .map(a => `  - ${a.tipo_servico} (${getStatusLabel(a.status)})`)
        .join('\n')}${confirmDelete.atendimentos.length > 5 ? `\n  ... e mais ${confirmDelete.atendimentos.length - 5}` : ''}`
    : '';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Clientes</h2>
        <Link to="/atendimentos/novo" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold no-underline">
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
        clientes.length === 0 ? (
          <EmptyState icon="clientes" titulo="Nenhum cliente cadastrado" descricao="Crie seu primeiro atendimento para começar" ctaLabel="+ Novo Atendimento" ctaTo="/atendimentos/novo" />
        ) : (
          <EmptyState icon="busca" titulo="Nenhum resultado encontrado" descricao="Tente outro termo de busca" />
        )
      ) : (
        <>
          <div className="space-y-3">
            {paginados.map((cliente) => {
              const key = `${cliente.nome}|${cliente.telefone}`;
              const isExpanded = expandedCliente === key;
              return (
                <div key={key} className="bg-white rounded-lg border border-gray-200 relative" style={{ overflow: 'visible' }}>
                  <div className="flex items-center">
                    <button
                      onClick={() => toggleExpanded(key)}
                      className="flex-1 flex items-center justify-between px-4 py-3 text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{cliente.nome}</p>
                        <p className="text-sm text-gray-500">{cliente.telefone}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-700">{cliente.atendimentos.length} atendimento(s)</p>
                          {cliente.concluidos > 0 && (
                            <p className="text-xs text-green-600">{cliente.concluidos} concluído(s)</p>
                          )}
                        </div>
                        <span className={`text-gray-400 text-lg transition-transform ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                      </div>
                    </button>

                    <div className="relative pr-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuAberto(menuAberto === key ? null : key); }}
                        className="p-2 text-gray-400 hover:text-gray-600"
                      >⋮</button>
                      {menuAberto === key && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 min-w-[120px]">
                          <button
                            onClick={() => { setMenuAberto(null); setConfirmDelete(cliente); }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                          >Apagar cliente</button>
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
                        >+ Novo atendimento</Link>
                      </div>
                      <div className="space-y-2">
                        {cliente.atendimentos.map((atd) => (
                          <Link key={atd.id} to={`/atendimentos/${atd.id}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg no-underline">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{atd.tipo_servico}</p>
                              <p className="text-xs text-gray-500">
                                {[atd.endereco, atd.numero, atd.bairro].filter(Boolean).join(', ')}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">{formatDate(atd.created_at)}</p>
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

          {/* Carregar mais */}
          {hasMore && (
            <button
              onClick={() => setVisibleCount(v => v + ITEMS_PER_PAGE)}
              className="w-full mt-4 py-3 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              Carregar mais ({filtrados.length - visibleCount} restantes)
            </button>
          )}
        </>
      )}

      <ConfirmModal
        aberto={!!confirmDelete}
        titulo={`Apagar ${confirmDelete?.nome || ''}?`}
        descricao={deleteDescricao}
        confirmLabel="Apagar tudo"
        variante="danger"
        loading={deletando}
        onConfirm={() => confirmDelete && handleDeleteCliente(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
