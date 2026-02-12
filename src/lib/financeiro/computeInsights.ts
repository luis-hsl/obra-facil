import { formatCurrency } from './chartUtils';

export interface Insight {
  id: string;
  tipo: 'success' | 'warning' | 'info' | 'danger';
  titulo: string;
  descricao: string;
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
