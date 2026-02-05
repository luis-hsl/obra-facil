import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Atendimento, Orcamento, Fechamento } from '../types';
import StatusBadge from '../components/StatusBadge';
import FechamentoForm from '../components/FechamentoForm';

export default function Precificacao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [atendimento, setAtendimento] = useState<Atendimento | null>(null);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [fechamento, setFechamento] = useState<Fechamento | null>(null);
  const [erro, setErro] = useState('');

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

    const [orcRes, fechRes] = await Promise.all([
      supabase.from('orcamentos').select('*').eq('atendimento_id', id).order('created_at', { ascending: false }),
      supabase.from('fechamentos').select('*').eq('atendimento_id', id).single(),
    ]);

    setOrcamentos(orcRes.data || []);
    setFechamento(fechRes.data || null);
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleConcluir = async () => {
    if (!confirm('Finalizar este atendimento? Ele será movido para Concluídos.')) return;
    const { error } = await supabase
      .from('atendimentos')
      .update({ status: 'concluido' })
      .eq('id', id);
    if (error) {
      setErro('Erro ao concluir atendimento.');
    } else {
      navigate('/operacional');
    }
  };

  const formatEndereco = (atd: Atendimento) =>
    [atd.endereco, atd.numero, atd.complemento, atd.bairro, atd.cidade].filter(Boolean).join(', ');

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  if (erro && !atendimento) {
    return <p className="text-center text-red-500 mt-8">{erro}</p>;
  }
  if (!atendimento) {
    return <p className="text-center text-gray-500 mt-8">Carregando...</p>;
  }

  const orcamentoAprovado = orcamentos.find((o) => o.status === 'aprovado');

  return (
    <div>
      {/* Voltar */}
      <Link
        to="/operacional"
        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-4 text-sm font-medium no-underline"
      >
        <span className="text-lg">←</span> Voltar para Operacional
      </Link>

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

        {/* Resumo do orçamento aprovado */}
        {orcamentoAprovado && (
          <div className="bg-blue-50 rounded-lg p-3 mt-3 text-sm">
            <p className="font-semibold text-blue-900">Orçamento Aprovado</p>
            <p className="text-blue-800 text-lg font-bold mt-1">
              {formatCurrency(orcamentoAprovado.valor_total)}
            </p>
            {orcamentoAprovado.forma_pagamento === 'parcelado' && orcamentoAprovado.valor_parcela && (
              <p className="text-blue-700 text-sm">
                {orcamentoAprovado.numero_parcelas}x de {formatCurrency(orcamentoAprovado.valor_parcela)}
                {orcamentoAprovado.valor_total_parcelado && (
                  <span className="text-blue-600"> = {formatCurrency(orcamentoAprovado.valor_total_parcelado)}</span>
                )}
              </p>
            )}
            <p className="text-blue-600 mt-1">
              Área: {orcamentoAprovado.area_com_perda?.toFixed(2)} m² (c/ {orcamentoAprovado.perda_percentual}% perda)
            </p>
          </div>
        )}
      </div>

      {/* Precificação */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <h3 className="font-semibold text-gray-900 mb-4">Precificação</h3>
        <FechamentoForm
          atendimentoId={atendimento.id}
          orcamentos={orcamentos}
          fechamento={fechamento}
          onSave={loadData}
        />
      </div>

      {/* Botão Concluir */}
      {fechamento && (
        <button
          onClick={handleConcluir}
          className="w-full py-4 bg-green-600 text-white rounded-lg font-semibold text-lg"
        >
          Concluir Atendimento
        </button>
      )}
    </div>
  );
}
