import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';

const TIPOS_SERVICO = [
  'Piso laminado',
  'Piso vinílico',
  'Porcelanato',
  'Gesso',
  'Vidro temperado',
  'Pintura',
  'Elétrica',
  'Hidráulica',
];

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const inputClass = 'w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm placeholder:text-slate-300';

export default function AtendimentoForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = Boolean(id);

  const clienteParam = searchParams.get('cliente') || '';
  const telefoneParam = searchParams.get('telefone') || '';

  const [clienteNome, setClienteNome] = useState(clienteParam);
  const [clienteTelefone, setClienteTelefone] = useState(telefoneParam);
  const [endereco, setEndereco] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [tipoServico, setTipoServico] = useState('');
  const [tipoServicoCustom, setTipoServicoCustom] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [dataVisita, setDataVisita] = useState('');
  const [observacoesVisita, setObservacoesVisita] = useState('');
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
          if (error || !data) { setErro('Erro ao carregar atendimento.'); return; }
          setClienteNome(data.cliente_nome);
          setClienteTelefone(data.cliente_telefone);
          setEndereco(data.endereco);
          setNumero(data.numero || '');
          setComplemento(data.complemento || '');
          setBairro(data.bairro || '');
          setCidade(data.cidade || '');
          setObservacoes(data.observacoes || '');
          if (data.data_visita) {
            const dt = new Date(data.data_visita);
            const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            setDataVisita(local);
          }
          setObservacoesVisita(data.observacoes_visita || '');
          setStatus(data.status);
          if (TIPOS_SERVICO.includes(data.tipo_servico)) {
            setTipoServico(data.tipo_servico);
          } else {
            setTipoServico('outro');
            setTipoServicoCustom(data.tipo_servico);
          }
        });
    }
  }, [id, isEditing]);

  const tipoFinal = tipoServico === 'outro' ? tipoServicoCustom.trim() : tipoServico;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteNome.trim()) { setErro('Informe o nome do cliente.'); return; }
    if (!clienteTelefone.trim()) { setErro('Informe o telefone do cliente.'); return; }
    if (!endereco.trim()) { setErro('Informe o endereço da obra.'); return; }
    if (!tipoFinal) { setErro('Selecione o tipo de serviço.'); return; }
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
      tipo_servico: tipoFinal,
      observacoes: observacoes.trim() || null,
      data_visita: dataVisita ? new Date(dataVisita).toISOString() : null,
      observacoes_visita: observacoesVisita.trim() || null,
      status,
    };

    if (isEditing) {
      const { error } = await supabase.from('atendimentos').update(atendimentoData).eq('id', id);
      if (error) { setErro('Erro ao salvar atendimento.'); setLoading(false); return; }
      navigate(`/atendimentos/${id}`);
    } else {
      const { data, error } = await supabase
        .from('atendimentos')
        .insert({ ...atendimentoData, status: 'visita_tecnica', user_id: user!.id })
        .select()
        .single();

      if (error || !data) { setErro('Erro ao salvar atendimento.'); setLoading(false); return; }
      navigate(`/atendimentos/${data.id}?novo=1`);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-5">
        {isEditing ? 'Editar Atendimento' : 'Novo Atendimento'}
      </h2>

      {erro && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4"><p className="text-red-600 text-sm">{erro}</p></div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cliente */}
        <fieldset className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm space-y-3">
          <legend className="text-sm font-bold text-slate-700 px-1">Cliente</legend>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Nome *</label>
            <input
              type="text"
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
              placeholder="Nome do cliente"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Telefone / WhatsApp *</label>
            <input
              type="tel"
              value={clienteTelefone}
              onChange={(e) => setClienteTelefone(formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              className={inputClass}
            />
          </div>
        </fieldset>

        {/* Endereço */}
        <fieldset className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm space-y-3">
          <legend className="text-sm font-bold text-slate-700 px-1">Endereço da Obra</legend>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Endereço *</label>
            <input type="text" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, Avenida..."
              className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Número</label>
              <input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="123"
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Complemento</label>
              <input type="text" value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Apto 12, Bloco B"
                className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Bairro</label>
              <input type="text" value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Bairro"
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Cidade</label>
              <input type="text" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade"
                className={inputClass} />
            </div>
          </div>
        </fieldset>

        {/* Serviço */}
        <fieldset className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm space-y-3">
          <legend className="text-sm font-bold text-slate-700 px-1">Serviço</legend>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Tipo de Serviço *</label>
            <select
              value={tipoServico}
              onChange={(e) => { setTipoServico(e.target.value); if (e.target.value !== 'outro') setTipoServicoCustom(''); }}
              className={inputClass}
            >
              <option value="">Selecione...</option>
              {TIPOS_SERVICO.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="outro">Outro...</option>
            </select>
          </div>
          {tipoServico === 'outro' && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Especifique o serviço *</label>
              <input
                type="text"
                value={tipoServicoCustom}
                onChange={(e) => setTipoServicoCustom(e.target.value)}
                placeholder="Ex: Instalação de persianas"
                className={inputClass}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Ex: Cliente prefere horário pela manhã"
              className={inputClass}
            />
          </div>
        </fieldset>

        {/* Agendamento de Visita */}
        <fieldset className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm space-y-3">
          <legend className="text-sm font-bold text-slate-700 px-1">Agendamento de Visita</legend>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Data e Hora</label>
            <input
              type="datetime-local"
              value={dataVisita}
              onChange={(e) => setDataVisita(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Observações da Visita</label>
            <textarea
              value={observacoesVisita}
              onChange={(e) => setObservacoesVisita(e.target.value)}
              rows={2}
              placeholder="Ex: Levar trena laser, portão azul"
              className={inputClass}
            />
          </div>
        </fieldset>

        {isEditing && (
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputClass}
            >
              <option value="iniciado">Iniciado</option>
              <option value="visita_tecnica">Visita Técnica</option>
              <option value="medicao">Medição</option>
              <option value="orcamento">Orçamento</option>
              <option value="aprovado">Aprovado</option>
              <option value="reprovado">Reprovado</option>
              <option value="execucao">Execução</option>
              <option value="concluido">Concluído</option>
            </select>
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(-1)}
            className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-700 font-semibold bg-white shadow-sm hover:bg-slate-50 active:scale-[0.98]">
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold disabled:opacity-50 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]">
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
