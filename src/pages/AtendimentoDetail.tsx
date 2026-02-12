import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Atendimento, Medicao, Orcamento, Fechamento } from '../types';
import StatusBadge from '../components/StatusBadge';
import StatusProgress from '../components/StatusProgress';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ConfirmModal from '../components/ConfirmModal';
import MedicaoForm from '../components/MedicaoForm';
import OrcamentoForm from '../components/OrcamentoForm';
import FechamentoForm from '../components/FechamentoForm';

type SectionId = 'medicao' | 'orcamento' | 'fechamento';

const SECTION_STORAGE_KEY = 'atd-sections-';

const WORKFLOW_HINTS: Record<string, { message: string; section?: SectionId }> = {
  visita_tecnica: { message: 'Adicione a medição dos cômodos para continuar.', section: 'medicao' },
  medicao: { message: 'Gere um orçamento com os produtos disponíveis.', section: 'orcamento' },
  orcamento: { message: 'Envie o orçamento ao cliente e aguarde aprovação.' },
  aprovado: { message: 'Orçamento aprovado! Acompanhe a execução do serviço.' },
  execucao: { message: 'Preencha o fechamento com os custos reais.', section: 'fechamento' },
};

export default function AtendimentoDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = searchParams.get('novo') === '1';

  const [atendimento, setAtendimento] = useState<Atendimento | null>(null);
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [fechamento, setFechamento] = useState<Fechamento | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(() => {
    try {
      const saved = sessionStorage.getItem(SECTION_STORAGE_KEY + id);
      if (saved) return new Set(JSON.parse(saved));
    } catch { /* noop */ }
    return new Set(['medicao']);
  });
  const [erro, setErro] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNewHint, setShowNewHint] = useState(isNew);

  const loadData = async () => {
    const { data: atd, error: atdError } = await supabase
      .from('atendimentos').select('*').eq('id', id).single();
    if (atdError || !atd) { setErro('Erro ao carregar atendimento.'); return; }
    setAtendimento(atd);

    const [medRes, orcRes, fechRes] = await Promise.all([
      supabase.from('medicoes').select('*').eq('atendimento_id', id).order('created_at', { ascending: false }),
      supabase.from('orcamentos').select('*').eq('atendimento_id', id).order('created_at', { ascending: false }),
      supabase.from('fechamentos').select('*').eq('atendimento_id', id).single(),
    ]);
    setMedicoes(medRes.data || []);
    setOrcamentos(orcRes.data || []);
    setFechamento(fechRes.data || null);
  };

  useEffect(() => { loadData(); }, [id]);

  useEffect(() => {
    if (showNewHint) {
      const t = setTimeout(() => setShowNewHint(false), 5000);
      return () => clearTimeout(t);
    }
  }, [showNewHint]);

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from('atendimentos').delete().eq('id', id);
    if (error) { setErro('Erro ao excluir atendimento.'); setDeleting(false); setShowDeleteConfirm(false); return; }
    navigate('/');
  };

  const toggleSection = (section: SectionId) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section); else next.add(section);
      try { sessionStorage.setItem(SECTION_STORAGE_KEY + id, JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  };

  const areaMedicao = medicoes[0]?.area_total || 0;

  const formatEndereco = (atd: Atendimento) =>
    [atd.endereco, atd.numero, atd.complemento, atd.bairro, atd.cidade].filter(Boolean).join(', ');

  if (erro && !atendimento) return <p className="text-center text-red-500 mt-8">{erro}</p>;
  if (!atendimento) return <LoadingSkeleton count={3} />;

  const statusOrder = ['iniciado', 'visita_tecnica', 'medicao', 'orcamento', 'aprovado', 'execucao', 'concluido'];
  const currentIndex = statusOrder.indexOf(atendimento.status);

  const allSections: { id: SectionId; label: string; hasData: boolean; minStatus: string }[] = [
    { id: 'medicao', label: 'Medição', hasData: medicoes.length > 0, minStatus: 'visita_tecnica' },
    { id: 'orcamento', label: 'Orçamento', hasData: orcamentos.length > 0, minStatus: 'medicao' },
    { id: 'fechamento', label: 'Fechamento', hasData: !!fechamento, minStatus: 'execucao' },
  ];

  const sections = allSections.filter((s) => currentIndex >= statusOrder.indexOf(s.minStatus));

  const hint = WORKFLOW_HINTS[atendimento.status];

  return (
    <div>
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-slate-500 hover:text-slate-700 mb-4 text-sm font-semibold">
        <span className="text-lg">←</span> Voltar
      </button>

      {erro && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4"><p className="text-red-600 text-sm">{erro}</p></div>}

      {/* New atendimento success hint */}
      {showNewHint && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <p className="text-sm text-emerald-700 font-semibold">Atendimento criado com sucesso!</p>
          </div>
          <button onClick={() => setShowNewHint(false)} className="text-emerald-600 text-lg leading-none hover:text-emerald-800">×</button>
        </div>
      )}

      {/* Progress */}
      <StatusProgress status={atendimento.status} />

      {/* Workflow hint */}
      {hint && atendimento.status !== 'concluido' && atendimento.status !== 'reprovado' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-blue-700">
            <span className="font-bold">Próximo passo:</span> {hint.message}
          </p>
          {hint.section && !expandedSections.has(hint.section) && (
            <button onClick={() => toggleSection(hint.section!)} className="text-sm text-blue-600 font-semibold mt-1 hover:text-blue-700">
              Abrir seção →
            </button>
          )}
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 mb-4 shadow-sm">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <p className="text-xl font-bold text-slate-900">{atendimento.cliente_nome}</p>
            <p className="text-sm text-slate-500 mt-1">{atendimento.cliente_telefone}</p>
            <p className="text-sm text-slate-500 mt-0.5">{formatEndereco(atendimento)}</p>
            <p className="text-sm text-slate-400 mt-0.5">{atendimento.tipo_servico}</p>
          </div>
          <StatusBadge status={atendimento.status} />
        </div>

        {atendimento.observacoes && <p className="text-sm text-slate-400 mt-2 italic">{atendimento.observacoes}</p>}

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
          <Link to={`/atendimentos/${id}/editar`} className="text-sm text-blue-600 font-semibold no-underline hover:text-blue-700">Editar</Link>
          <button onClick={() => setShowDeleteConfirm(true)} className="text-sm text-red-500 font-semibold hover:text-red-600">Excluir</button>
        </div>
      </div>

      {/* Collapsible sections */}
      <div className="space-y-3">
        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          return (
            <div key={section.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
              <button onClick={() => toggleSection(section.id)} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${section.hasData ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-300'}`} />
                  <span className="font-bold text-slate-900">{section.label}</span>
                  {section.id === 'medicao' && medicoes.length > 1 && (
                    <span className="text-xs text-slate-400 font-medium">({medicoes.length} registros)</span>
                  )}
                </div>
                <span className={`text-slate-400 text-lg ${isExpanded ? 'rotate-90' : ''}`}>›</span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                  {section.id === 'medicao' && (
                    <MedicaoForm atendimentoId={atendimento.id} medicoes={medicoes} currentStatus={atendimento.status} onSave={loadData} />
                  )}
                  {section.id === 'orcamento' && (
                    <OrcamentoForm
                      atendimentoId={atendimento.id}
                      atendimento={atendimento}
                      orcamentos={orcamentos}
                      areaMedicao={areaMedicao}
                      perdaMedicao={medicoes[0]?.perda_percentual || 10}
                      onSave={loadData}
                    />
                  )}
                  {section.id === 'fechamento' && (
                    <FechamentoForm atendimentoId={atendimento.id} orcamentos={orcamentos} fechamento={fechamento} onSave={loadData} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmModal
        aberto={showDeleteConfirm}
        titulo="Excluir atendimento?"
        descricao="Isso vai apagar todas as medições, orçamentos e fechamentos relacionados. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variante="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
