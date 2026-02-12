import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Produto } from '../types';
import EmptyState from '../components/EmptyState';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ConfirmModal from '../components/ConfirmModal';

export default function ProdutosList() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadProdutos();
  }, []);

  const loadProdutos = async () => {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .order('fabricante');

    if (error) {
      setErro('Erro ao carregar produtos.');
    } else {
      setProdutos(data || []);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('produtos').delete().eq('id', id);
    if (error) {
      setErro('Erro ao excluir produto.');
    } else {
      setProdutos(produtos.filter((p) => p.id !== id));
    }
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const filtrados = produtos.filter((p) => {
    const q = filtro.toLowerCase();
    return p.fabricante.toLowerCase().includes(q) || p.linha.toLowerCase().includes(q);
  });

  if (loading) return <LoadingSkeleton count={4} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Produtos</h2>
          <p className="text-sm text-slate-500 mt-0.5">{produtos.length} produto(s)</p>
        </div>
        <Link to="/produtos/novo" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold no-underline shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]">
          + Novo Produto
        </Link>
      </div>

      {erro && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4"><p className="text-red-600 text-sm">{erro}</p></div>}

      {produtos.length > 0 && (
        <div className="relative mb-4">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por fabricante ou linha..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm placeholder:text-slate-300"
          />
        </div>
      )}

      {produtos.length === 0 ? (
        <EmptyState
          icon="produtos"
          titulo="Nenhum produto cadastrado"
          descricao="Cadastre seus produtos para usar nos orçamentos"
          ctaLabel="+ Novo Produto"
          ctaTo="/produtos/novo"
        />
      ) : filtrados.length === 0 ? (
        <EmptyState icon="busca" titulo="Nenhum produto encontrado" descricao="Tente outro termo de busca" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtrados.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{p.fabricante} — {p.linha}</p>
                  <p className="text-sm text-slate-500 mt-1">{formatCurrency(p.preco_por_m2)}/m²</p>
                </div>
                <div className="flex gap-3">
                  <Link to={`/produtos/${p.id}/editar`} className="text-sm text-blue-600 font-semibold no-underline hover:text-blue-700">Editar</Link>
                  <button onClick={() => setConfirmDeleteId(p.id)} className="text-sm text-red-500 font-semibold hover:text-red-600">Excluir</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        aberto={!!confirmDeleteId}
        titulo="Excluir produto?"
        descricao="Esta ação não pode ser desfeita. Orçamentos existentes que usam este produto não serão afetados."
        confirmLabel="Excluir"
        variante="danger"
        loading={!!deletingId}
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
