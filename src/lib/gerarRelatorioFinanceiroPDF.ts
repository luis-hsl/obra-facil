import { jsPDF } from 'jspdf';
import type { Atendimento, Fechamento, BrandConfig } from '../types';

interface FechamentoComAtendimento extends Fechamento {
  atendimento?: Atendimento;
}

interface Params {
  periodo: string;
  fechamentos: FechamentoComAtendimento[];
  totais: { recebido: number; custos: number; lucro: number };
  brandConfig?: BrandConfig | null;
  logoBase64?: string | null;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const TIMEZONE = 'America/Sao_Paulo';

export function gerarRelatorioFinanceiroPDF(params: Params) {
  const { periodo, fechamentos, totais, brandConfig, logoBase64 } = params;
  const doc = new jsPDF('portrait', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mL = 15, mR = 15, mT = 15, mB = 20;
  const contentW = pageW - mL - mR;
  let y = mT;

  const hex2rgb = (hex: string): [number, number, number] => {
    const h = hex.replace('#', '');
    return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
  };

  const primaryColor = brandConfig?.primary_color ? hex2rgb(brandConfig.primary_color) : [37, 99, 235] as [number, number, number];

  // Header
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', mL, y, 25, 25);
    } catch { /* ignore */ }
  }

  const headerX = logoBase64 ? mL + 30 : mL;
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(brandConfig?.company_name || 'Relatório Financeiro', headerX, y + 8);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Período: ${periodo}`, headerX, y + 16);

  y += 32;

  // Separator line
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.8);
  doc.line(mL, y, pageW - mR, y);
  y += 10;

  // KPIs
  const kpiW = contentW / 3;
  const kpis = [
    { label: 'Total Recebido', value: fmt(totais.recebido), color: [37, 99, 235] as [number, number, number] },
    { label: 'Total Custos', value: fmt(totais.custos), color: [220, 38, 38] as [number, number, number] },
    { label: 'Lucro', value: fmt(totais.lucro), color: totais.lucro >= 0 ? [16, 185, 129] as [number, number, number] : [220, 38, 38] as [number, number, number] },
  ];

  kpis.forEach((kpi, i) => {
    const x = mL + i * kpiW;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + kpiW / 2, y, { align: 'center' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, x + kpiW / 2, y + 8, { align: 'center' });
  });

  y += 18;

  // Separator
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(mL, y, pageW - mR, y);
  y += 8;

  // Table Header
  const cols = [
    { label: 'Data', w: 22, align: 'left' as const },
    { label: 'Cliente', w: 45, align: 'left' as const },
    { label: 'Serviço', w: 30, align: 'left' as const },
    { label: 'Recebido', w: 28, align: 'right' as const },
    { label: 'Custos', w: 28, align: 'right' as const },
    { label: 'Lucro', w: 27, align: 'right' as const },
  ];

  doc.setFillColor(...primaryColor);
  doc.rect(mL, y, contentW, 8, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);

  let colX = mL;
  cols.forEach((col) => {
    const tx = col.align === 'right' ? colX + col.w - 2 : colX + 2;
    doc.text(col.label, tx, y + 5.5, { align: col.align });
    colX += col.w;
  });

  y += 8;

  // Table Rows
  doc.setFontSize(8);
  fechamentos.forEach((f, idx) => {
    // Page break check
    if (y + 7 > pageH - mB) {
      doc.addPage();
      y = mT;
    }

    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(mL, y, contentW, 7, 'F');
    }

    const custos = f.custo_distribuidor + f.custo_instalador + f.custo_extras;
    const data = new Date(f.created_at).toLocaleDateString('pt-BR', { timeZone: TIMEZONE, day: '2-digit', month: '2-digit', year: '2-digit' });
    const nome = f.atendimento?.cliente_nome || 'N/A';
    const servico = f.atendimento?.tipo_servico || 'N/A';

    const rowData = [
      data,
      nome.length > 22 ? nome.slice(0, 20) + '...' : nome,
      servico.length > 15 ? servico.slice(0, 13) + '...' : servico,
      fmt(f.valor_recebido),
      fmt(custos),
      fmt(f.lucro_final),
    ];

    doc.setFont('helvetica', 'normal');
    colX = mL;
    rowData.forEach((text, i) => {
      const col = cols[i];
      if (i === 5) {
        doc.setTextColor(f.lucro_final >= 0 ? 16 : 220, f.lucro_final >= 0 ? 185 : 38, f.lucro_final >= 0 ? 129 : 38);
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'normal');
      }
      const tx = col.align === 'right' ? colX + col.w - 2 : colX + 2;
      doc.text(text, tx, y + 5, { align: col.align });
      colX += col.w;
    });

    y += 7;
  });

  // Total row
  if (y + 10 > pageH - mB) { doc.addPage(); y = mT; }
  y += 2;
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.5);
  doc.line(mL, y, pageW - mR, y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('TOTAL', mL + 2, y + 1);

  colX = mL + cols[0].w + cols[1].w + cols[2].w;
  doc.text(fmt(totais.recebido), colX + cols[3].w - 2, y + 1, { align: 'right' });
  colX += cols[3].w;
  doc.text(fmt(totais.custos), colX + cols[4].w - 2, y + 1, { align: 'right' });
  colX += cols[4].w;
  doc.setTextColor(totais.lucro >= 0 ? 16 : 220, totais.lucro >= 0 ? 185 : 38, totais.lucro >= 0 ? 129 : 38);
  doc.text(fmt(totais.lucro), colX + cols[5].w - 2, y + 1, { align: 'right' });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    const dataGeracao = new Date().toLocaleDateString('pt-BR', { timeZone: TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    doc.text(`Gerado em ${dataGeracao}`, mL, pageH - 8);
    doc.text(`Página ${i}/${totalPages}`, pageW - mR, pageH - 8, { align: 'right' });
    if (brandConfig?.footer_text) {
      doc.text(brandConfig.footer_text, pageW / 2, pageH - 8, { align: 'center' });
    }
  }

  doc.save(`relatorio-financeiro-${periodo.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}
