import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';

export default function ProdutoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = Boolean(id);

  const [nome, setNome] = useState('');
  const [metragemPorCaixa, setMetragemPorCaixa] = useState('');
  const [precoPorCaixa, setPrecoPorCaixa] = useState('');
  const [perdaPadrao, setPerdaPadrao] = useState('10');
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
          setNome(data.nome);
          setMetragemPorCaixa(String(data.metragem_por_caixa));
          setPrecoPorCaixa(String(data.preco_por_caixa));
          setPerdaPadrao(String(data.perda_padrao));
        });
    }
  }, [id, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    const produtoData = {
      nome,
      metragem_por_caixa: parseFloat(metragemPorCaixa),
      preco_por_caixa: parseFloat(precoPorCaixa),
      perda_padrao: parseFloat(perdaPadrao),
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

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        {isEditing ? 'Editar Produto' : 'Cadastrar Piso'}
      </h2>

      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome do piso *
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            placeholder="Ex: Piso Vinílico Durafloor"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Uma caixa cobre quantos m²? *
          </label>
          <input
            type="number"
            step="0.01"
            value={metragemPorCaixa}
            onChange={(e) => setMetragemPorCaixa(e.target.value)}
            required
            placeholder="Ex: 2,30"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Informação vem na caixa do produto</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Valor de uma caixa (R$) *
          </label>
          <input
            type="number"
            step="0.01"
            value={precoPorCaixa}
            onChange={(e) => setPrecoPorCaixa(e.target.value)}
            required
            placeholder="Ex: 189,00"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Valor pago na distribuidora</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Perda padrão (%)
          </label>
          <input
            type="number"
            step="1"
            value={perdaPadrao}
            onChange={(e) => setPerdaPadrao(e.target.value)}
            required
            placeholder="10"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Pode alterar depois no orçamento</p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/produtos')}
            className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>

      {/* Preview do resumo */}
      {nome && metragemPorCaixa && precoPorCaixa && (
        <div className="mt-6 bg-blue-100 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-800">
            {nome}
          </p>
          <p className="text-sm text-blue-800 mt-1">
            1 caixa cobre {metragemPorCaixa} m² • R$ {parseFloat(precoPorCaixa || '0').toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
}
