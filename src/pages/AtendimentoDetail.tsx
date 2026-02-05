import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Atendimento, Medicao, Orcamento, Execucao, AtendimentoStatus } from '../types';
import { STATUS_CONFIG, getNextStatuses } from '../lib/statusConfig';
import StatusBadge from '../components/StatusBadge';
import MedicaoForm from '../components/MedicaoForm';
import OrcamentoForm from '../components/OrcamentoForm';
import ExecucaoSection from '../components/ExecucaoSection';

type SectionId = 'medicao' | 'orcamento' | 'execucao';

export default function AtendimentoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [atendimento, setAtendimento] = useState<Atendimento | null>(null);
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(new Set(['medicao']));
  const [erro, setErro] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  const loadData = async () => {
    const { data: atd, error: atdError } = await supabase
      .from('atendimentos')
      .select('*')
      .eq('id', id)
      .single();

    if (atdError || !atd) {
      setErro('Erro ao carregar atendimento.');
      return;
    }

    setAtendimento(atd);

    const [medRes, orcRes, execRes] = await Promise.all([
      supabase.from('medicoes').select('*').eq('atendimento_id', id).order('created_at', { ascending: false }),
      supabase.from('orcamentos').select('*').eq('atendimento_id', id).order('created_at', { ascending: false }),
      supabase.from('execucoes').select('*').eq('atendimento_id', id).order('created_at', { ascending: false }),
    ]);

    setMedicoes(medRes.data || []);
    setOrcamentos(orcRes.data || []);
    setExecucoes(execRes.data || []);
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Excluir este atendimento e todos os dados relacionados?')) return;
    setDeleting(true);
    const { error } = await supabase.from('atendimentos').delete().eq('id', id);
    if (error) {
      setErro('Erro ao excluir atendimento.');
      setDeleting(false);
      return;
    }
    navigate('/');
  };

  const handleStatusChange = async (newStatus: AtendimentoStatus) => {
    if (!atendimento) return;
    setChangingStatus(true);
    const { error } = await supabase
      .from('atendimentos')
      .update({ status: newStatus })
      .eq('id', id);
    if (error) {
      setErro('Erro ao atualizar status.');
    } else {
      await loadData();
    }
    setChangingStatus(false);
  };

  const toggleSection = (section: SectionId) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const areaMedicao = medicoes[0]?.area_total || 0;

  const formatEndereco = (atd: Atendimento) =>
    [atd.endereco, atd.numero, atd.complemento, atd.bairro, atd.cidade].filter(Boolean).join(', ');

  if (erro && !atendimento) {
    return <p className="text-center text-red-500 mt-8">{erro}</p>;
  }
  if (!atendimento) {
    return <p className="text-center text-gray-500 mt-8">Carregando...</p>;
  }

  const nextStatuses = getNextStatuses(atendimento.status);

  const sections: { id: SectionId; label: string; hasData: boolean }[] = [
    { id: 'medicao', label: 'Medição', hasData: medicoes.length > 0 },
    { id: 'orcamento', label: 'Orçamento', hasData: orcamentos.length > 0 },
    { id: 'execucao', label: 'Execução', hasData: execucoes.length > 0 },
  ];

  return (
    <div>
      {erro && <p className="text-red-600 text-sm mb-3">{erro}</p>}

      {/* Cabeçalho */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <p className="text-xl font-bold text-gray-900">{atendimento.cliente_nome}</p>
            <p className="text-sm text-gray-500 mt-1">{atendimento.cliente_telefone}</p>
            <p className="text-sm text-gray-500 mt-1">{formatEndereco(atendimento)}</p>
            <p className="text-sm text-gray-400 mt-1">{atendimento.tipo_servico}</p>
          </div>
          <StatusBadge status={atendimento.status} />
        </div>

        {atendimento.observacoes && (
          <p className="text-sm text-gray-400 mt-2">{atendimento.observacoes}</p>
        )}

        {/* Ações */}
        <div className="flex items-center gap-4 mt-3">
          <Link to={`/atendimentos/${id}/editar`} className="text-sm text-blue-600 font-medium no-underline">
            Editar
          </Link>
          <button onClick={handleDelete} disabled={deleting} className="text-sm text-red-500 font-medium disabled:opacity-50">
            {deleting ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>

        {/* Avançar status */}
        {nextStatuses.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-gray-100">
            {nextStatuses.map((ns) => {
              const config = STATUS_CONFIG[ns];
              return (
                <button
                  key={ns}
                  onClick={() => handleStatusChange(ns)}
                  disabled={changingStatus}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 ${
                    ns === 'reprovado'
                      ? 'border border-red-300 text-red-600'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  {ns === 'reprovado' ? 'Reprovar' : `Avançar p/ ${config?.label || ns}`}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Seções colapsáveis */}
      <div className="space-y-3">
        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          return (
            <div key={section.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${section.hasData ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="font-semibold text-gray-900">{section.label}</span>
                </div>
                <span className={`text-gray-400 text-lg transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                  ›
                </span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                  {section.id === 'medicao' && (
                    <MedicaoForm atendimentoId={atendimento.id} medicoes={medicoes} onSave={loadData} />
                  )}
                  {section.id === 'orcamento' && (
                    <OrcamentoForm
                      atendimentoId={atendimento.id}
                      atendimento={atendimento}
                      orcamentos={orcamentos}
                      areaMedicao={areaMedicao}
                      onSave={loadData}
                    />
                  )}
                  {section.id === 'execucao' && (
                    <ExecucaoSection atendimentoId={atendimento.id} execucoes={execucoes} onSave={loadData} />
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
