import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Obra, Medicao, Orcamento, Execucao } from '../types';
import StatusBadge from '../components/StatusBadge';
import MedicaoForm from '../components/MedicaoForm';
import OrcamentoForm from '../components/OrcamentoForm';
import ExecucaoSection from '../components/ExecucaoSection';

export default function ObraDetail() {
  const { id } = useParams();
  const [obra, setObra] = useState<Obra | null>(null);
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [tab, setTab] = useState<'medicao' | 'orcamento' | 'execucao'>('medicao');

  const loadData = async () => {
    const [obraRes, medRes, orcRes, execRes] = await Promise.all([
      supabase.from('obras').select('*').eq('id', id).single(),
      supabase.from('medicoes').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
      supabase.from('orcamentos').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
      supabase.from('execucoes').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
    ]);
    setObra(obraRes.data);
    setMedicoes(medRes.data || []);
    setOrcamentos(orcRes.data || []);
    setExecucoes(execRes.data || []);
  };

  useEffect(() => {
    loadData();
  }, [id]);

  if (!obra) {
    return <p className="text-center text-gray-500 mt-8">Carregando...</p>;
  }

  return (
    <div>
      {/* Cabeçalho da obra */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-xl font-bold text-gray-900">{obra.cliente_nome}</h2>
          <StatusBadge status={obra.status} />
        </div>
        {obra.endereco && <p className="text-sm text-gray-500">{obra.endereco}</p>}
        {obra.tipo_servico && <p className="text-sm text-gray-400">{obra.tipo_servico}</p>}
        {obra.observacoes && <p className="text-sm text-gray-400 mt-2">{obra.observacoes}</p>}
        <Link
          to={`/obras/${obra.id}/editar`}
          className="inline-block mt-3 text-sm text-blue-600 font-medium no-underline"
        >
          Editar obra
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        {(['medicao', 'orcamento', 'execucao'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium text-center border-b-2 ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            {t === 'medicao' ? 'Medições' : t === 'orcamento' ? 'Orçamentos' : 'Execução'}
          </button>
        ))}
      </div>

      {/* Conteúdo da tab */}
      {tab === 'medicao' && (
        <MedicaoForm obraId={obra.id} medicoes={medicoes} onSave={loadData} />
      )}
      {tab === 'orcamento' && (
        <OrcamentoForm obraId={obra.id} orcamentos={orcamentos} onSave={loadData} />
      )}
      {tab === 'execucao' && (
        <ExecucaoSection obraId={obra.id} execucoes={execucoes} onSave={loadData} />
      )}
    </div>
  );
}
