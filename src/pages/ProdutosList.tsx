import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Produto } from '../types';

export default function ProdutosList() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadProdutos();
  }, []);

  const loadProdutos = async () => {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setErro('Erro ao carregar produtos.');
    } else {
      setProdutos(data || []);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este produto?')) return;
    setDeletingId(id);
    const { error } = await supabase.from('produtos').delete().eq('id', id);
    if (error) {
      setErro('Erro ao excluir produto.');
    } else {
      setProdutos(produtos.filter((p) => p.id !== id));
    }
    setDeletingId(null);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  if (loading) {
    return <p className="text-center text-gray-500 mt-8">Carregando...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Produtos</h2>
        <Link
          to="/produtos/novo"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold no-underline"
        >
          + Novo Produto
        </Link>
      </div>

      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      {produtos.length === 0 ? (
        <p className="text-center text-gray-400 mt-8">Nenhum produto cadastrado</p>
      ) : (
        <div className="space-y-3">
          {produtos.map((p) => (
            <div key={p.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{p.fabricante} — {p.linha}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatCurrency(p.preco_por_m2)}/m² • Perda: {p.perda_padrao}%
                  </p>
                </div>
                <div className="flex gap-3">
                  <Link
                    to={`/produtos/${p.id}/editar`}
                    className="text-sm text-blue-600 font-medium no-underline"
                  >
                    Editar
                  </Link>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                    className="text-sm text-red-500 font-medium disabled:opacity-50"
                  >
                    {deletingId === p.id ? '...' : 'Excluir'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
