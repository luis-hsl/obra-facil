import type { Orcamento, Atendimento } from '../../types';

export interface ConversionData {
  byServiceType: { tipo: string; total: number; aprovados: number; reprovados: number; taxaConversao: number; valorMedio: number }[];
  byPriceRange: { faixa: string; total: number; aprovados: number; taxaConversao: number }[];
  byBairro: { bairro: string; total: number; aprovados: number; taxaConversao: number }[];
  followupStats: {
    semFollowup: { total: number; aprovados: number };
    comFollowup: { total: number; aprovados: number };
  };
  byFormaPagamento: {
    aVista: { total: number; aprovados: number };
    parcelado: { total: number; aprovados: number };
  };
  tempoMedioAprovacao: number;
  totalOrcamentos: number;
  taxaConversaoGeral: number;
}

// Only consider orcamentos that left draft stage
const RELEVANT_STATUSES = ['enviado', 'aprovado', 'reprovado'];

export function computeConversionData(
  orcamentos: Orcamento[],
  atendimentos: Atendimento[],
): ConversionData {
  const atdMap = new Map(atendimentos.map(a => [a.id, a]));
  const relevant = orcamentos.filter(o => RELEVANT_STATUSES.includes(o.status));

  const totalOrcamentos = relevant.length;
  const aprovados = relevant.filter(o => o.status === 'aprovado');
  const taxaConversaoGeral = totalOrcamentos > 0 ? (aprovados.length / totalOrcamentos) * 100 : 0;

  // --- By service type ---
  const serviceMap = new Map<string, { total: number; aprovados: number; reprovados: number; somaValor: number }>();
  for (const o of relevant) {
    const atd = atdMap.get(o.atendimento_id);
    const tipo = atd?.tipo_servico || 'Outro';
    const entry = serviceMap.get(tipo) || { total: 0, aprovados: 0, reprovados: 0, somaValor: 0 };
    entry.total++;
    entry.somaValor += o.valor_total;
    if (o.status === 'aprovado') entry.aprovados++;
    if (o.status === 'reprovado') entry.reprovados++;
    serviceMap.set(tipo, entry);
  }
  const byServiceType = [...serviceMap.entries()]
    .map(([tipo, v]) => ({
      tipo,
      ...v,
      taxaConversao: v.total > 0 ? (v.aprovados / v.total) * 100 : 0,
      valorMedio: v.total > 0 ? v.somaValor / v.total : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // --- By price range ---
  const ranges: [string, number, number][] = [
    ['Até R$2.000', 0, 2000],
    ['R$2.000 – R$5.000', 2000, 5000],
    ['R$5.000 – R$10.000', 5000, 10000],
    ['Acima de R$10.000', 10000, Infinity],
  ];
  const byPriceRange = ranges.map(([faixa, min, max]) => {
    const inRange = relevant.filter(o => o.valor_total >= min && o.valor_total < max);
    const apr = inRange.filter(o => o.status === 'aprovado').length;
    return {
      faixa,
      total: inRange.length,
      aprovados: apr,
      taxaConversao: inRange.length > 0 ? (apr / inRange.length) * 100 : 0,
    };
  }).filter(r => r.total > 0);

  // --- By bairro ---
  const bairroMap = new Map<string, { total: number; aprovados: number }>();
  for (const o of relevant) {
    const atd = atdMap.get(o.atendimento_id);
    const bairro = atd?.bairro || atd?.cidade || 'Não informado';
    const entry = bairroMap.get(bairro) || { total: 0, aprovados: 0 };
    entry.total++;
    if (o.status === 'aprovado') entry.aprovados++;
    bairroMap.set(bairro, entry);
  }
  const byBairro = [...bairroMap.entries()]
    .map(([bairro, v]) => ({
      bairro,
      ...v,
      taxaConversao: v.total > 0 ? (v.aprovados / v.total) * 100 : 0,
    }))
    .filter(b => b.total >= 2)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // --- Follow-up stats ---
  const semFollowup = { total: 0, aprovados: 0 };
  const comFollowup = { total: 0, aprovados: 0 };
  for (const o of relevant) {
    const atd = atdMap.get(o.atendimento_id);
    const hasFollowup = atd && (atd.followup_count || 0) > 0;
    if (hasFollowup) {
      comFollowup.total++;
      if (o.status === 'aprovado') comFollowup.aprovados++;
    } else {
      semFollowup.total++;
      if (o.status === 'aprovado') semFollowup.aprovados++;
    }
  }

  // --- By forma de pagamento ---
  const aVista = { total: 0, aprovados: 0 };
  const parcelado = { total: 0, aprovados: 0 };
  for (const o of relevant) {
    if (o.forma_pagamento === 'parcelado') {
      parcelado.total++;
      if (o.status === 'aprovado') parcelado.aprovados++;
    } else {
      aVista.total++;
      if (o.status === 'aprovado') aVista.aprovados++;
    }
  }

  // --- Tempo médio até aprovação ---
  let tempoMedioAprovacao = 0;
  if (aprovados.length > 0) {
    const atdCreatedMap = new Map(atendimentos.map(a => [a.id, new Date(a.created_at).getTime()]));
    let somaTempos = 0;
    let count = 0;
    for (const o of aprovados) {
      const atdCreated = atdCreatedMap.get(o.atendimento_id);
      if (atdCreated) {
        const orcCreated = new Date(o.created_at).getTime();
        const diffDays = (orcCreated - atdCreated) / (1000 * 60 * 60 * 24);
        if (diffDays >= 0) {
          somaTempos += diffDays;
          count++;
        }
      }
    }
    tempoMedioAprovacao = count > 0 ? somaTempos / count : 0;
  }

  return {
    byServiceType,
    byPriceRange,
    byBairro,
    followupStats: { semFollowup, comFollowup },
    byFormaPagamento: { aVista, parcelado },
    tempoMedioAprovacao,
    totalOrcamentos,
    taxaConversaoGeral,
  };
}
