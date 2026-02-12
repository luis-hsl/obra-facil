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

const TIME_SLOTS = ['07:00', '08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const WEEK_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

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

  // Calendar state
  const [visitaCalMonth, setVisitaCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

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
            setVisitaCalMonth(new Date(dt.getFullYear(), dt.getMonth(), 1));
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

  // Calendar helpers
  const calYear = visitaCalMonth.getFullYear();
  const calMonth = visitaCalMonth.getMonth();
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDayOfWeek = getFirstDayOfWeek(calYear, calMonth);
  const today = new Date();

  // Parse selected date/time from dataVisita
  const selectedTime = dataVisita ? dataVisita.slice(11, 16) : '';
  const selectedDateObj = dataVisita ? new Date(dataVisita) : null;

  const handleSelectDay = (day: number) => {
    const year = calYear;
    const month = calMonth;
    const time = selectedTime || '09:00';
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    setDataVisita(`${year}-${mm}-${dd}T${time}`);
  };

  const handleSelectTime = (time: string) => {
    if (!dataVisita) {
      // Default to today
      const y = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setDataVisita(`${y}-${mm}-${dd}T${time}`);
    } else {
      setDataVisita(dataVisita.slice(0, 11) + time);
    }
  };

  const handleCustomTime = (time: string) => {
    if (!dataVisita) {
      const y = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setDataVisita(`${y}-${mm}-${dd}T${time}`);
    } else {
      setDataVisita(dataVisita.slice(0, 11) + time);
    }
  };

  const formatSelectedDate = () => {
    if (!selectedDateObj) return '';
    return selectedDateObj.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

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

        {/* Agendamento de Visita — Premium */}
        <fieldset className="bg-white rounded-2xl border border-purple-100 p-4 shadow-sm space-y-4">
          <legend className="text-sm font-bold text-slate-700 px-1 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Agendamento de Visita
          </legend>

          {/* Desktop: calendar left + time right | Mobile: stacked */}
          <div className="flex flex-col md:flex-row md:gap-5">
            {/* Calendar */}
            <div className="rounded-xl border border-slate-100 overflow-hidden md:w-[280px] flex-shrink-0">
              {/* Month nav */}
              <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-purple-50 to-indigo-50">
                <button
                  type="button"
                  onClick={() => setVisitaCalMonth(new Date(calYear, calMonth - 1, 1))}
                  className="p-1 rounded-lg hover:bg-white/60 transition-colors"
                >
                  <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-bold text-purple-800">
                  {MONTH_NAMES[calMonth]} {calYear}
                </span>
                <button
                  type="button"
                  onClick={() => setVisitaCalMonth(new Date(calYear, calMonth + 1, 1))}
                  className="p-1 rounded-lg hover:bg-white/60 transition-colors"
                >
                  <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Grid */}
              <div className="p-2.5">
                {/* Week headers */}
                <div className="grid grid-cols-7 mb-1">
                  {WEEK_DAYS.map((d, i) => (
                    <div key={i} className="text-center text-[10px] font-bold text-slate-300 uppercase py-0.5">
                      {d}
                    </div>
                  ))}
                </div>
                {/* Days */}
                <div className="grid grid-cols-7">
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`e-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                    const isSelected = selectedDateObj
                      && day === selectedDateObj.getDate()
                      && calMonth === selectedDateObj.getMonth()
                      && calYear === selectedDateObj.getFullYear();
                    const isPast = new Date(calYear, calMonth, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleSelectDay(day)}
                        className={`
                          w-full aspect-square flex items-center justify-center text-xs md:text-sm rounded-lg transition-all
                          ${isSelected
                            ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white font-bold shadow-md shadow-purple-500/25 scale-105'
                            : isToday
                              ? 'bg-purple-50 text-purple-700 font-bold ring-2 ring-purple-300 ring-inset'
                              : isPast
                                ? 'text-slate-300 hover:bg-slate-50'
                                : 'text-slate-600 font-medium hover:bg-purple-50 hover:text-purple-700'
                          }
                        `}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Time picker + Summary */}
            <div className="flex-1 mt-4 md:mt-0 space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Horário
                </p>

                {/* Morning slots */}
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">Manhã</p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mb-2.5">
                  {TIME_SLOTS.filter(t => parseInt(t) < 12).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleSelectTime(t)}
                      className={`
                        py-1.5 rounded-lg text-sm font-semibold transition-all
                        ${selectedTime === t
                          ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25'
                          : 'bg-slate-50 text-slate-600 hover:bg-purple-50 hover:text-purple-700 border border-slate-100'
                        }
                      `}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* Afternoon slots */}
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">Tarde</p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {TIME_SLOTS.filter(t => parseInt(t) >= 12).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleSelectTime(t)}
                      className={`
                        py-1.5 rounded-lg text-sm font-semibold transition-all
                        ${selectedTime === t
                          ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25'
                          : 'bg-slate-50 text-slate-600 hover:bg-purple-50 hover:text-purple-700 border border-slate-100'
                        }
                      `}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* Custom time */}
                <div className="flex items-center gap-2 mt-2.5">
                  <span className="text-xs text-slate-400 font-medium">Outro:</span>
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => handleCustomTime(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Summary badge */}
              {dataVisita && (
                <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-3 border border-purple-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-purple-800">
                        {formatSelectedDate()} {selectedTime && `às ${selectedTime}`}
                      </p>
                      <p className="text-[10px] text-purple-500 font-medium">Visita agendada</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDataVisita('')}
                    className="text-xs text-purple-400 hover:text-red-500 font-semibold transition-colors px-2 py-1 rounded-lg hover:bg-white/50"
                  >
                    Limpar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Observações da visita */}
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
