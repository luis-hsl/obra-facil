import { formatCurrency } from './chartUtils';
import { supabase } from '../supabase';
import type { ConversionData } from './computeConversionData';

export interface Insight {
  id: string;
  tipo: 'success' | 'warning' | 'info' | 'danger';
  titulo: string;
  descricao: string;
  acao?: string;
}

interface InsightInput {
  receita: number;
  custos: number;
  lucro: number;
  margem: number;
  numProjetos: number;
  receitaAnterior: number;
  lucroAnterior: number;
  margemAnterior: number;
  topClients: { nome: string; receita: number }[];
  revenueByService: { servico: string; receita: number; lucro: number }[];
  trendData: { label: string; recebido: number; lucro: number }[];
}

export function computeInsights(data: InsightInput): Insight[] {
  const insights: Insight[] = [];

  // 1. Margin trend
  if (data.margemAnterior > 0 && data.margem > 0) {
    const diff = data.margem - data.margemAnterior;
    if (diff > 5) {
      insights.push({
        id: 'margem-up',
        tipo: 'success',
        titulo: 'Margem em alta',
        descricao: `Margem subiu ${diff.toFixed(1)}pp vs período anterior (${data.margem.toFixed(1)}%)`,
      });
    } else if (diff < -5) {
      insights.push({
        id: 'margem-down',
        tipo: 'warning',
        titulo: 'Margem em queda',
        descricao: `Margem caiu ${Math.abs(diff).toFixed(1)}pp vs período anterior (${data.margem.toFixed(1)}%)`,
      });
    }
  }

  // 2. Negative profit
  if (data.lucro < 0) {
    insights.push({
      id: 'lucro-negativo',
      tipo: 'danger',
      titulo: 'Lucro negativo no período',
      descricao: `Custos superaram a receita em ${formatCurrency(Math.abs(data.lucro))}. Revise seus custos.`,
    });
  }

  // 3. Best month
  const monthsWithRevenue = data.trendData.filter(m => m.recebido > 0);
  if (monthsWithRevenue.length >= 2) {
    const best = [...monthsWithRevenue].sort((a, b) => b.recebido - a.recebido)[0];
    insights.push({
      id: 'melhor-mes',
      tipo: 'info',
      titulo: `Melhor mês: ${best.label}`,
      descricao: `Maior faturamento do período com ${formatCurrency(best.recebido)}`,
    });
  }

  // 4. Client concentration
  if (data.topClients.length > 0 && data.receita > 0) {
    const topShare = (data.topClients[0].receita / data.receita) * 100;
    if (topShare > 40) {
      insights.push({
        id: 'concentracao',
        tipo: 'warning',
        titulo: 'Concentração de receita',
        descricao: `${data.topClients[0].nome} concentra ${topShare.toFixed(0)}% da receita. Diversifique.`,
      });
    }
  }

  // 5. Most profitable service
  if (data.revenueByService.length > 1) {
    const sorted = [...data.revenueByService].sort((a, b) => b.lucro - a.lucro);
    if (sorted[0].lucro > 0) {
      insights.push({
        id: 'servico-top',
        tipo: 'success',
        titulo: `Serviço mais lucrativo: ${sorted[0].servico}`,
        descricao: `${formatCurrency(sorted[0].lucro)} de lucro no período`,
      });
    }
  }

  // 6. Growth trend (last 3 vs previous 3)
  if (data.trendData.length >= 6) {
    const recent3 = data.trendData.slice(-3).reduce((s, m) => s + m.recebido, 0);
    const prev3 = data.trendData.slice(-6, -3).reduce((s, m) => s + m.recebido, 0);
    if (prev3 > 0) {
      const growth = ((recent3 - prev3) / prev3) * 100;
      if (growth > 15) {
        insights.push({
          id: 'crescimento',
          tipo: 'success',
          titulo: 'Tendência de crescimento',
          descricao: `Receita cresceu ${growth.toFixed(0)}% nos últimos 3 meses vs trimestre anterior`,
        });
      } else if (growth < -15) {
        insights.push({
          id: 'queda',
          tipo: 'danger',
          titulo: 'Tendência de queda',
          descricao: `Receita caiu ${Math.abs(growth).toFixed(0)}% nos últimos 3 meses vs trimestre anterior`,
        });
      }
    }
  }

  return insights.slice(0, 5);
}

// ── AI Conversion Insights with cache + rate limit ──

const AI_CACHE_KEY = 'ai-conversion-insights';
const AI_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
const AI_MIN_INTERVAL = 60 * 1000; // 1 min entre chamadas
const AI_RATE_KEY = 'ai-conversion-last-call';

interface CachedAiInsights {
  insights: Insight[];
  timestamp: number;
  dataHash: string;
}

function hashConversionData(data: ConversionData): string {
  return `${data.totalOrcamentos}-${data.taxaConversaoGeral.toFixed(1)}-${data.byServiceType.length}`;
}

export async function fetchAiInsights(data: ConversionData): Promise<Insight[]> {
  if (data.totalOrcamentos < 5) return [];

  const hash = hashConversionData(data);

  // Check cache
  try {
    const cached = localStorage.getItem(AI_CACHE_KEY);
    if (cached) {
      const parsed: CachedAiInsights = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < AI_CACHE_TTL && parsed.dataHash === hash) {
        return parsed.insights;
      }
    }
  } catch { /* cache miss */ }

  // Rate limit — min 1 min between calls
  try {
    const lastCall = localStorage.getItem(AI_RATE_KEY);
    if (lastCall && Date.now() - Number(lastCall) < AI_MIN_INTERVAL) {
      return []; // too soon, skip
    }
  } catch { /* proceed */ }

  try {
    localStorage.setItem(AI_RATE_KEY, String(Date.now()));

    const { data: result, error } = await supabase.functions.invoke('analyze-conversion', {
      body: data,
    });

    if (error || !result?.insights) return [];

    const insights: Insight[] = (result.insights as any[]).map((ins, i) => ({
      id: `ai-${i}-${ins.id || i}`,
      tipo: (['success', 'warning', 'info', 'danger'].includes(ins.tipo) ? ins.tipo : 'info') as Insight['tipo'],
      titulo: ins.titulo || 'Insight IA',
      descricao: ins.descricao || '',
      acao: ins.acao || undefined,
    }));

    // Save to cache
    const cacheEntry: CachedAiInsights = { insights, timestamp: Date.now(), dataHash: hash };
    localStorage.setItem(AI_CACHE_KEY, JSON.stringify(cacheEntry));

    return insights;
  } catch {
    return [];
  }
}
