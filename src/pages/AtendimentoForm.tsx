import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';

export default function AtendimentoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = Boolean(id);

  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
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
          setClienteNome(data.cliente_nome);
          setClienteTelefone(data.cliente_telefone);
          setEndereco(data.endereco);
          setNumero(data.numero || '');
          setComplemento(data.complemento || '');
          setBairro(data.bairro || '');
          setCidade(data.cidade || '');
          setTipoServico(data.tipo_servico);
          setObservacoes(data.observacoes || '');
          setStatus(data.status);
        });
    }
  }, [id, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteNome.trim()) {
      setErro('Informe o nome do cliente.');
      return;
    }
    if (!clienteTelefone.trim()) {
      setErro('Informe o telefone do cliente.');
      return;
    }
    if (!endereco.trim()) {
      setErro('Informe o endereço da obra.');
      return;
    }
    if (!tipoServico) {
      setErro('Selecione o tipo de serviço.');
      return;
    }
    setErro('');
    setLoading(true);

    const atendimentoData = {
      cliente_nome: clienteNome.trim(),
      cliente_telefone: clienteTelefone.trim(),
      endereco: endereco.trim(),
      numero: numero.trim() || null,
      complemento: complemento.trim() || null,
      bairro: bairro.trim() || null,
      cidade: cidade.trim() || null,
      tipo_servico: tipoServico,
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

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Cliente */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-700 mb-1">Cliente</legend>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input
              type="text"
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
              placeholder="Nome do cliente"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp *</label>
            <input
              type="tel"
              value={clienteTelefone}
              onChange={(e) => setClienteTelefone(e.target.value)}
              placeholder="(00) 00000-0000"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </fieldset>

        {/* Endereço */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-700 mb-1">Endereço da Obra</legend>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço *</label>
            <input
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Rua, Avenida..."
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
              <input
                type="text"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="123"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
              <input
                type="text"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                placeholder="Apto 12, Bloco B"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
              <input
                type="text"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                placeholder="Bairro"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
              <input
                type="text"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Cidade"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </fieldset>

        {/* Serviço */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-gray-700 mb-1">Serviço</legend>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Serviço *</label>
            <select
              value={tipoServico}
              onChange={(e) => setTipoServico(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione...</option>
              <option value="Piso">Piso</option>
              <option value="Gesso">Gesso</option>
              <option value="Vidro">Vidro</option>
              <option value="Outro">Outro</option>
            </select>
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
        </fieldset>

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
