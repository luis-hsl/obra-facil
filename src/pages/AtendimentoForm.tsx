import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import ClienteSelector from '../components/ClienteSelector';
import ImovelSelector from '../components/ImovelSelector';

export default function AtendimentoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = Boolean(id);

  const [clienteId, setClienteId] = useState('');
  const [imovelId, setImovelId] = useState('');
  const [tipoServico, setTipoServico] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [status, setStatus] = useState('iniciado');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (isEditing) {
      supabase
        .from('atendimentos')
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            setErro('Erro ao carregar atendimento.');
            return;
          }
          setClienteId(data.cliente_id);
          setImovelId(data.imovel_id || '');
          setTipoServico(data.tipo_servico || '');
          setObservacoes(data.observacoes || '');
          setStatus(data.status);
        });
    }
  }, [id, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId) {
      setErro('Selecione um cliente.');
      return;
    }
    setErro('');
    setLoading(true);

    const atendimentoData = {
      cliente_id: clienteId,
      imovel_id: imovelId || null,
      tipo_servico: tipoServico.trim() || null,
      observacoes: observacoes.trim() || null,
      status,
    };

    if (isEditing) {
      const { error } = await supabase.from('atendimentos').update(atendimentoData).eq('id', id);
      if (error) {
        setErro('Erro ao salvar atendimento.');
        setLoading(false);
        return;
      }
      navigate(`/atendimentos/${id}`);
    } else {
      const { data, error } = await supabase
        .from('atendimentos')
        .insert({ ...atendimentoData, user_id: user!.id })
        .select()
        .single();

      if (error || !data) {
        setErro('Erro ao salvar atendimento.');
        setLoading(false);
        return;
      }
      navigate(`/atendimentos/${data.id}`);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        {isEditing ? 'Editar Atendimento' : 'Novo Atendimento'}
      </h2>

      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <ClienteSelector value={clienteId} onChange={setClienteId} />

        <ImovelSelector clienteId={clienteId} value={imovelId} onChange={setImovelId} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Serviço</label>
          <input
            type="text"
            value={tipoServico}
            onChange={(e) => setTipoServico(e.target.value)}
            placeholder="Ex: Piso laminado, Vidro temperado, Gesso"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
            placeholder="Ex: Cliente prefere horário pela manhã"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {isEditing && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="iniciado">Iniciado</option>
              <option value="visita_tecnica">Visita Técnica</option>
              <option value="medicao">Medição</option>
              <option value="orcamento">Orçamento</option>
              <option value="aprovado">Aprovado</option>
              <option value="reprovado">Reprovado</option>
              <option value="execucao">Execução</option>
              <option value="pos_atendimento">Pós-atendimento</option>
            </select>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
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
    </div>
  );
}
