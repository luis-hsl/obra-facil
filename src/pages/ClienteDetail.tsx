import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Cliente, Imovel, Atendimento } from '../types';
import StatusBadge from '../components/StatusBadge';

export default function ClienteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [erro, setErro] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Inline imóvel form
  const [showImovelForm, setShowImovelForm] = useState(false);
  const [imovelEndereco, setImovelEndereco] = useState('');
  const [imovelApelido, setImovelApelido] = useState('');
  const [savingImovel, setSavingImovel] = useState(false);
  const [deletingImovelId, setDeletingImovelId] = useState<string | null>(null);

  const loadData = async () => {
    const [clienteRes, imoveisRes, atendRes] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', id).single(),
      supabase.from('imoveis').select('*').eq('cliente_id', id).order('created_at'),
      supabase.from('atendimentos').select('*').eq('cliente_id', id).order('created_at', { ascending: false }),
    ]);

    if (clienteRes.error) {
      setErro('Erro ao carregar cliente.');
      return;
    }

    setCliente(clienteRes.data);
    setImoveis(imoveisRes.data || []);
    setAtendimentos(atendRes.data || []);
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleDelete = async () => {
    if (atendimentos.length > 0) {
      if (!confirm(`Este cliente tem ${atendimentos.length} atendimento(s). Excluir tudo?`)) return;
    } else {
      if (!confirm('Excluir este cliente?')) return;
    }
    setDeleting(true);
    // Precisamos deletar os atendimentos primeiro (por causa das FKs)
    for (const a of atendimentos) {
      await supabase.from('atendimentos').delete().eq('id', a.id);
    }
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) {
      setErro('Erro ao excluir cliente.');
      setDeleting(false);
      return;
    }
    navigate('/clientes');
  };

  const handleAddImovel = async () => {
    if (!imovelEndereco.trim()) return;
    setSavingImovel(true);
    const { error } = await supabase.from('imoveis').insert({
      cliente_id: id,
      endereco: imovelEndereco.trim(),
      apelido: imovelApelido.trim() || null,
    });
    if (error) {
      setErro('Erro ao adicionar imóvel.');
    } else {
      setImovelEndereco('');
      setImovelApelido('');
      setShowImovelForm(false);
      loadData();
    }
    setSavingImovel(false);
  };

  const handleDeleteImovel = async (imovelId: string) => {
    if (!confirm('Excluir este imóvel?')) return;
    setDeletingImovelId(imovelId);
    const { error } = await supabase.from('imoveis').delete().eq('id', imovelId);
    if (error) {
      setErro('Erro ao excluir imóvel.');
    } else {
      loadData();
    }
    setDeletingImovelId(null);
  };

  if (erro && !cliente) {
    return <p className="text-center text-red-500 mt-8">{erro}</p>;
  }
  if (!cliente) {
    return <p className="text-center text-gray-500 mt-8">Carregando...</p>;
  }

  return (
    <div>
      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      {/* Cabeçalho */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <h2 className="text-xl font-bold text-gray-900 mb-1">{cliente.nome}</h2>
        {cliente.telefone && <p className="text-sm text-gray-500">{cliente.telefone}</p>}
        {cliente.email && <p className="text-sm text-gray-400">{cliente.email}</p>}
        {cliente.cpf_cnpj && <p className="text-sm text-gray-400">{cliente.cpf_cnpj}</p>}
        {cliente.observacoes && <p className="text-sm text-gray-400 mt-2">{cliente.observacoes}</p>}
        <div className="flex items-center gap-4 mt-3">
          <Link to={`/clientes/${id}/editar`} className="text-sm text-blue-600 font-medium no-underline">
            Editar
          </Link>
          <button onClick={handleDelete} disabled={deleting} className="text-sm text-red-500 font-medium disabled:opacity-50">
            {deleting ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>

      {/* Imóveis */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Imóveis</h3>
        {imoveis.length > 0 && (
          <div className="space-y-2 mb-3">
            {imoveis.map((im) => (
              <div key={im.id} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {im.apelido ? `${im.apelido} — ${im.endereco}` : im.endereco}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{im.tipo}</p>
                </div>
                <button
                  onClick={() => handleDeleteImovel(im.id)}
                  disabled={deletingImovelId === im.id}
                  className="text-sm text-red-500 disabled:opacity-50"
                >
                  {deletingImovelId === im.id ? '...' : 'Excluir'}
                </button>
              </div>
            ))}
          </div>
        )}

        {!showImovelForm ? (
          <button
            onClick={() => setShowImovelForm(true)}
            className="text-sm text-blue-600 font-medium"
          >
            + Adicionar imóvel
          </button>
        ) : (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Endereço *</label>
              <input
                type="text"
                value={imovelEndereco}
                onChange={(e) => setImovelEndereco(e.target.value)}
                placeholder="Rua das Flores, 123"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Apelido</label>
              <input
                type="text"
                value={imovelApelido}
                onChange={(e) => setImovelApelido(e.target.value)}
                placeholder="Ex: Apt Centro"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowImovelForm(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddImovel}
                disabled={savingImovel || !imovelEndereco.trim()}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {savingImovel ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Atendimentos */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Atendimentos</h3>
        {atendimentos.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum atendimento</p>
        ) : (
          <div className="space-y-2">
            {atendimentos.map((a) => (
              <Link
                key={a.id}
                to={`/atendimentos/${a.id}`}
                className="block bg-white rounded-lg border border-gray-200 p-3 no-underline"
              >
                <div className="flex items-center justify-between">
                  <div>
                    {a.tipo_servico && <p className="font-medium text-gray-900">{a.tipo_servico}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(a.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
