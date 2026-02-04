import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Obra, Medicao, Orcamento, Execucao } from '../types';
import MedicaoForm from '../components/MedicaoForm';
import OrcamentoForm from '../components/OrcamentoForm';
import ExecucaoSection from '../components/ExecucaoSection';

type StepId = 'medicao' | 'orcamento' | 'execucao';

interface StepConfig {
  id: StepId;
  label: string;
  sublabel: string;
}

const STEPS: StepConfig[] = [
  { id: 'medicao', label: 'Medição', sublabel: 'Registrar área total' },
  { id: 'orcamento', label: 'Orçamento', sublabel: 'Calcular valor e gerar PDF' },
  { id: 'execucao', label: 'Execução', sublabel: 'Acompanhar a instalação' },
];

export default function ObraDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [obra, setObra] = useState<Obra | null>(null);
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [expandedStep, setExpandedStep] = useState<StepId>('medicao');
  const [erro, setErro] = useState('');
  const [deleting, setDeleting] = useState(false);

  const medicaoConcluida = medicoes.length > 0;
  const orcamentoConcluido = orcamentos.some((o) => o.status === 'aprovado');
  const execucaoConcluida = execucoes.some((e) => e.status === 'concluido');

  const getStepStatus = (stepId: StepId): 'done' | 'active' | 'locked' => {
    if (stepId === 'medicao') {
      return medicaoConcluida ? 'done' : 'active';
    }
    if (stepId === 'orcamento') {
      if (!medicaoConcluida) return 'locked';
      return orcamentoConcluido ? 'done' : 'active';
    }
    // execucao
    if (!orcamentoConcluido) return 'locked';
    return execucaoConcluida ? 'done' : 'active';
  };

  const getActiveStep = (): StepId => {
    if (!medicaoConcluida) return 'medicao';
    if (!orcamentoConcluido) return 'orcamento';
    return 'execucao';
  };

  const loadData = async () => {
    const [obraRes, medRes, orcRes, execRes] = await Promise.all([
      supabase.from('obras').select('*').eq('id', id).single(),
      supabase.from('medicoes').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
      supabase.from('orcamentos').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
      supabase.from('execucoes').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
    ]);

    if (obraRes.error) {
      setErro('Erro ao carregar visita.');
      return;
    }

    setObra(obraRes.data);
    setMedicoes(medRes.data || []);
    setOrcamentos(orcRes.data || []);
    setExecucoes(execRes.data || []);
  };

  // Atualizar status da obra automaticamente
  const updateObraStatus = async () => {
    if (!obra) return;

    let newStatus: string;
    if (execucaoConcluida) {
      newStatus = 'finalizado';
    } else if (orcamentos.length > 0) {
      newStatus = 'orcado';
    } else if (medicaoConcluida) {
      newStatus = 'medicao';
    } else {
      newStatus = 'lead';
    }

    if (newStatus !== obra.status) {
      await supabase.from('obras').update({ status: newStatus }).eq('id', id);
    }
  };

  const handleSave = async () => {
    await loadData();
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Quando os dados mudam, expandir a etapa ativa e atualizar status
  useEffect(() => {
    setExpandedStep(getActiveStep());
    updateObraStatus();
  }, [medicoes.length, orcamentos.length, execucoes.length, orcamentoConcluido, execucaoConcluida]);

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir esta visita? Todas as medições, orçamentos e execuções serão excluídos também.')) {
      return;
    }
    setDeleting(true);
    const { error } = await supabase.from('obras').delete().eq('id', id);
    if (error) {
      setErro('Erro ao excluir visita.');
      setDeleting(false);
      return;
    }
    navigate('/');
  };

  const handleStepClick = (stepId: StepId) => {
    const status = getStepStatus(stepId);
    if (status === 'locked') return;
    setExpandedStep(expandedStep === stepId ? expandedStep : stepId);
  };

  const areaMedicao = medicoes[0]?.valor || 0;

  if (erro && !obra) {
    return <p className="text-center text-red-500 mt-8">{erro}</p>;
  }

  if (!obra) {
    return <p className="text-center text-gray-500 mt-8">Carregando...</p>;
  }

  return (
    <div>
      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      {/* Cabeçalho da visita */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">{obra.cliente_nome}</h2>
        {obra.endereco && <p className="text-sm text-gray-500">{obra.endereco}</p>}
        {obra.tipo_servico && <p className="text-sm text-gray-400">{obra.tipo_servico}</p>}
        {obra.observacoes && <p className="text-sm text-gray-400 mt-2">{obra.observacoes}</p>}
        <div className="flex items-center gap-4 mt-3">
          <Link
            to={`/obras/${obra.id}/editar`}
            className="text-sm text-blue-600 font-medium no-underline"
          >
            Editar visita
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm text-red-500 font-medium disabled:opacity-50"
          >
            {deleting ? 'Excluindo...' : 'Excluir visita'}
          </button>
        </div>
      </div>

      {/* Stepper vertical */}
      <div className="space-y-0">
        {STEPS.map((step, index) => {
          const status = getStepStatus(step.id);
          const isExpanded = expandedStep === step.id;
          const isLast = index === STEPS.length - 1;

          return (
            <div key={step.id} className="relative">
              {/* Conector vertical */}
              {!isLast && (
                <div
                  className={`absolute left-[19px] top-[40px] w-0.5 bottom-0 ${
                    status === 'done' ? 'bg-green-400' : 'bg-gray-200'
                  }`}
                />
              )}

              {/* Header do step */}
              <button
                onClick={() => handleStepClick(step.id)}
                disabled={status === 'locked'}
                className={`relative z-10 flex items-center gap-3 w-full text-left py-3 px-1 ${
                  status === 'locked' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                }`}
              >
                {/* Ícone do step */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                    status === 'done'
                      ? 'bg-green-500 text-white'
                      : status === 'active'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {status === 'done' ? '✓' : index + 1}
                </div>

                {/* Texto */}
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold ${
                    status === 'locked' ? 'text-gray-400' : 'text-gray-900'
                  }`}>
                    {step.label}
                  </p>
                  <p className={`text-sm ${
                    status === 'locked' ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    {status === 'locked' ? 'Complete a etapa anterior' : step.sublabel}
                  </p>
                </div>

                {/* Seta de expansão */}
                {status !== 'locked' && (
                  <span className={`text-gray-400 text-lg transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    ›
                  </span>
                )}
              </button>

              {/* Conteúdo expandido */}
              {isExpanded && status !== 'locked' && (
                <div className="ml-[19px] pl-8 pb-6 border-l-2 border-transparent">
                  {step.id === 'medicao' && (
                    <MedicaoForm obraId={obra.id} medicoes={medicoes} onSave={handleSave} />
                  )}
                  {step.id === 'orcamento' && (
                    <OrcamentoForm
                      obraId={obra.id}
                      obra={obra}
                      orcamentos={orcamentos}
                      areaMedicao={areaMedicao}
                      onSave={handleSave}
                    />
                  )}
                  {step.id === 'execucao' && (
                    <ExecucaoSection obraId={obra.id} execucoes={execucoes} onSave={handleSave} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
