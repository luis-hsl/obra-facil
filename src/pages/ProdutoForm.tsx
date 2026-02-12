import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';

const inputClass = 'w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm placeholder:text-slate-300';

export default function ProdutoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = Boolean(id);

  const [fabricante, setFabricante] = useState('');
  const [linha, setLinha] = useState('');
  const [precoPorM2, setPrecoPorM2] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (isEditing) {
      supabase
        .from('produtos')
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            setErro('Erro ao carregar produto.');
            return;
          }
          setFabricante(data.fabricante);
          setLinha(data.linha);
          setPrecoPorM2(String(data.preco_por_m2));
        });
    }
  }, [id, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    const preco = parseFloat(precoPorM2);

    if (!preco || preco <= 0) {
      setErro('O valor do m² precisa ser maior que zero.');
      return;
    }

    setLoading(true);

    const produtoData = {
      fabricante,
      linha,
      preco_por_m2: preco,
    };

    const { error } = isEditing
      ? await supabase.from('produtos').update(produtoData).eq('id', id)
      : await supabase.from('produtos').insert({ ...produtoData, user_id: user!.id });

    if (error) {
      setErro('Erro ao salvar produto. Tente novamente.');
      setLoading(false);
      return;
    }

    navigate('/produtos');
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const preco = parseFloat(precoPorM2);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-5">
        {isEditing ? 'Editar Produto' : 'Cadastrar Produto'}
      </h2>

      {erro && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4"><p className="text-red-600 text-sm">{erro}</p></div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Fabricante *
            </label>
            <input
              type="text"
              value={fabricante}
              onChange={(e) => setFabricante(e.target.value)}
              required
              placeholder="Ex: Durafloor"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Linha *
            </label>
            <input
              type="text"
              value={linha}
              onChange={(e) => setLinha(e.target.value)}
              required
              placeholder="Ex: New Way"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Valor do m² (R$) *
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={precoPorM2}
              onChange={(e) => setPrecoPorM2(e.target.value)}
              required
              placeholder="Ex: 120.00"
              className={inputClass}
            />
            <p className="text-xs text-slate-400 mt-1.5">Preço por metro quadrado do produto</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/produtos')}
            className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-700 font-semibold bg-white shadow-sm hover:bg-slate-50 active:scale-[0.98]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold disabled:opacity-50 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]"
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>

      {/* Resumo do produto */}
      {fabricante && linha && preco > 0 && (
        <div className="mt-6 bg-emerald-50 rounded-xl border border-emerald-200 p-4 space-y-1">
          <p className="text-sm font-bold text-emerald-800">{fabricante} — {linha}</p>
          <p className="text-sm text-emerald-700">{formatCurrency(preco)}/m²</p>
        </div>
      )}
    </div>
  );
}
