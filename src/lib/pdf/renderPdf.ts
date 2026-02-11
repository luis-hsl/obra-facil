import { jsPDF } from 'jspdf';
import type { Orcamento, OrcamentoItem, Produto, Atendimento, BrandConfig } from '../../types';
import type { PdfBrandConfig, ResolvedPdfStyle } from '../../types/pdfTokens';
import { resolveTokens } from './resolveTokens';
import { DEFAULT_PDF_BRAND_CONFIG } from './defaults';

// ============================================================
// Helpers
// ============================================================

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function calcularParcelamento(valorTotal: number, taxaMaquina: number, numParcelas: number) {
  const totalComTaxa = valorTotal * (1 + taxaMaquina / 100);
  const parcela = totalComTaxa / numParcelas;
  return { totalComTaxa, parcela };
}

function checkPage(doc: jsPDF, y: number, needed: number, marginTop: number, marginBottom: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - marginBottom) {
    doc.addPage();
    return marginTop;
  }
  return y;
}

// ============================================================
// Types
// ============================================================

export interface GerarPDFParams {
  atendimento: Pick<Atendimento, 'cliente_nome' | 'cliente_telefone' | 'endereco' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'tipo_servico'>;
  orcamento: Orcamento;
  produto: Produto | null;
  itens?: OrcamentoItem[];
  produtosMap?: Record<string, Produto>;
  numeroParcelas?: number;
  taxaJuros?: number;
  brandConfig?: BrandConfig | null;
  logoBase64?: string | null;
  preview?: boolean;
}

interface CompanyData {
  name: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
}

interface BudgetItem {
  name: string;
  area: number;
  unitPrice: number;
  total: number;
}

// ============================================================
// v2 → v3 migration
// ============================================================

function extractPdfBrandConfig(bc: BrandConfig | null | undefined): PdfBrandConfig {
  if (!bc) return DEFAULT_PDF_BRAND_CONFIG;

  const stored = bc.pdf_template as Record<string, unknown> | null;

  // v3 token config — use directly
  if (stored && stored.version === 3) return stored as unknown as PdfBrandConfig;

  // v2 DocumentTemplate or missing — synthesize from flat BrandConfig fields
  return {
    version: 3,
    templateId: (bc.layout_style as PdfBrandConfig['templateId']) || 'modern',
    colors: {
      primary: bc.primary_color || '#1e40af',
      secondary: bc.accent_color || '#059669',
      text: bc.secondary_color || '#374151',
      muted: '#9ca3af',
      border: '#e5e7eb',
    },
    typography: {
      fontFamily: bc.font_family || 'helvetica',
      headingWeight: 'bold',
      bodyWeight: 'normal',
    },
    logo: {
      url: bc.logo_url || null,
      alignment: bc.logo_position || 'left',
      size: 'medium',
    },
    layout: {
      density: 'normal',
      showNotes: true,
      showFooter: true,
    },
  };
}

function buildItems(params: GerarPDFParams): BudgetItem[] {
  const { itens = [], produtosMap = {} } = params;
  if (itens.length > 0) {
    return itens.map(item => {
      const prod = item.produto_id ? produtosMap[item.produto_id] : null;
      return {
        name: prod ? `${prod.fabricante} — ${prod.linha}` : 'Produto',
        area: item.area_total,
        unitPrice: item.preco_por_m2,
        total: item.valor_total,
      };
    });
  }
  if (params.produto && params.orcamento.area_total) {
    return [{
      name: `${params.produto.fabricante} — ${params.produto.linha}`,
      area: params.orcamento.area_com_perda || params.orcamento.area_total,
      unitPrice: params.produto.preco_por_m2,
      total: params.orcamento.valor_total,
    }];
  }
  return [];
}

// ============================================================
// Section: Header
// ============================================================

function renderHeader(
  doc: jsPDF, s: ResolvedPdfStyle, company: CompanyData, y: number, pageW: number, x0: number,
): number {
  const { preset, colors, fontFamily, headingWeight, fontSizes } = s;

  // Background
  if (colors.headerBg) {
    doc.setFillColor(...colors.headerBg);
    doc.rect(0, 0, pageW, s.headerHeight, 'F');
  }

  // Logo
  if (s.logoBase64) {
    const logoH = s.logoMaxHeight;
    const logoW = logoH * 2.5;
    let logoX = x0;
    if (s.logoAlignment === 'center') logoX = (pageW - logoW) / 2;
    else if (s.logoAlignment === 'right') logoX = pageW - s.margins.right - logoW;
    try { doc.addImage(s.logoBase64, 'PNG', logoX, y, logoW, logoH); } catch { /* skip */ }
  }

  // Company info
  const companyLines = [company.name, company.cnpj, company.phone, company.email, company.address].filter(Boolean);
  if (companyLines.length > 0) {
    let cY = y + 2;
    doc.setFontSize(8);
    doc.setTextColor(...colors.headerText);

    if (preset.header.companyInfoPosition === 'right') {
      const cX = pageW - s.margins.right;
      doc.setFont(fontFamily, headingWeight);
      doc.text(companyLines[0], cX, cY, { align: 'right' });
      cY += 4;
      doc.setFont(fontFamily, 'normal');
      for (let i = 1; i < companyLines.length; i++) {
        doc.text(companyLines[i], cX, cY, { align: 'right' });
        cY += 3.5;
      }
    } else {
      // below-logo
      const cYStart = y + (s.logoBase64 ? s.logoMaxHeight + 3 : 0);
      cY = cYStart;
      doc.setFont(fontFamily, headingWeight);
      doc.text(companyLines[0], x0, cY);
      cY += 4;
      doc.setFont(fontFamily, 'normal');
      for (let i = 1; i < companyLines.length; i++) {
        doc.text(companyLines[i], x0, cY);
        cY += 3.5;
      }
    }
  }

  // Title
  doc.setFontSize(fontSizes.title);
  doc.setFont(fontFamily, headingWeight);
  doc.setTextColor(...colors.headerText);
  const titleAlign = preset.header.titleAlignment;
  const titleX = titleAlign === 'center' ? pageW / 2
    : titleAlign === 'right' ? pageW - s.margins.right : x0;
  doc.text('ORÇAMENTO', titleX, y + s.headerHeight - 8, { align: titleAlign });

  // Separator
  if (preset.header.showSeparator) {
    doc.setDrawColor(...colors.separatorColor);
    doc.setLineWidth(0.5);
    doc.line(x0, y + s.headerHeight - 2, pageW - s.margins.right, y + s.headerHeight - 2);
  }

  return y + s.headerHeight + s.sectionSpacing;
}

// ============================================================
// Section: Client Info
// ============================================================

function renderClientInfo(
  doc: jsPDF, s: ResolvedPdfStyle,
  atendimento: GerarPDFParams['atendimento'],
  y: number, contentW: number, x0: number,
): number {
  const { preset, colors, fontFamily, headingWeight, fontSizes, margins } = s;
  const cs = preset.clientSection;

  const enderecoCompleto = [atendimento.endereco, atendimento.numero, atendimento.complemento, atendimento.bairro, atendimento.cidade].filter(Boolean).join(', ');
  const clientData = [
    { label: 'Cliente:', value: atendimento.cliente_nome },
    { label: 'Telefone:', value: atendimento.cliente_telefone || '' },
    { label: 'Endereço:', value: enderecoCompleto },
    { label: 'Serviço:', value: atendimento.tipo_servico },
    { label: 'Data:', value: new Date().toLocaleDateString('pt-BR') },
  ].filter(f => f.value);

  if (cs.style === 'card') {
    const cardH = clientData.length * 6 + 6;
    y = checkPage(doc, y, cardH, margins.top, margins.bottom);
    if (colors.clientSectionBg) {
      doc.setFillColor(...colors.clientSectionBg);
      doc.rect(x0, y - 2, contentW, cardH, 'F');
    }
    if (colors.clientSectionBorder) {
      doc.setDrawColor(...colors.clientSectionBorder);
      doc.setLineWidth(0.3);
      doc.rect(x0, y - 2, contentW, cardH, 'S');
    }
  }

  doc.setFontSize(fontSizes.body);
  for (const { label, value } of clientData) {
    doc.setTextColor(...colors.text);
    if (cs.labelBold) doc.setFont(fontFamily, headingWeight);
    else doc.setFont(fontFamily, 'normal');
    const lx = cs.style === 'card' ? x0 + 4 : x0;
    doc.text(label + ' ', lx, y);
    const labelW = doc.getTextWidth(label + ' ');
    doc.setFont(fontFamily, 'normal');
    const lines = doc.splitTextToSize(value, contentW - labelW - 8);
    doc.text(lines, lx + labelW, y);
    y += 5.5 * Math.max(lines.length, 1);
  }

  return y + s.sectionSpacing;
}

// ============================================================
// Section: Budget Table
// ============================================================

function renderBudgetTable(
  doc: jsPDF, s: ResolvedPdfStyle,
  items: BudgetItem[], y: number,
  x0: number, contentW: number,
  numeroParcelas: number, taxaJuros: number,
): number {
  const { preset, colors, fontFamily, headingWeight, fontSizes, margins, rowPadding } = s;
  const bt = preset.budgetTable;
  const totals = preset.totals;
  const discountPct = totals.discountPercent / 100;

  // ---- TABLE STYLE ----
  if (bt.style === 'table') {
    const cols = bt.columns;
    const colWidths = cols.map(c => (c.widthPercent / 100) * contentW);

    if (bt.showHeader) {
      y = checkPage(doc, y, 10, margins.top, margins.bottom);
      doc.setFillColor(...colors.tableHeaderBg);
      doc.rect(x0, y - 4, contentW, 7, 'F');
      doc.setFontSize(fontSizes.body);
      doc.setFont(fontFamily, headingWeight);
      doc.setTextColor(...colors.tableHeaderText);
      let cx = x0;
      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        const tx = col.align === 'center' ? cx + colWidths[i] / 2
          : col.align === 'right' ? cx + colWidths[i] - 1 : cx + 1;
        doc.text(col.label, tx, y, { align: col.align as 'left' | 'center' | 'right' });
        cx += colWidths[i];
      }
      y += 5;
      if (bt.showBorders) {
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.2);
        doc.line(x0, y, x0 + contentW, y);
      }
      y += 2;
    }

    doc.setFontSize(fontSizes.body);
    items.forEach((item, idx) => {
      y = checkPage(doc, y, rowPadding + 6, margins.top, margins.bottom);
      if (idx % 2 === 1 && colors.tableRowAltBg) {
        doc.setFillColor(...colors.tableRowAltBg);
        doc.rect(x0, y - 3.5, contentW, rowPadding + 2, 'F');
      }
      const discountPrice = item.total * (1 - discountPct);
      const { parcela } = calcularParcelamento(item.total, taxaJuros, numeroParcelas);
      const values: Record<string, string> = {
        option_number: String(idx + 1),
        product_name: item.name,
        area: `${item.area} m²`,
        unit_price: formatCurrency(item.unitPrice),
        total: formatCurrency(item.total),
        discount_price: formatCurrency(discountPrice),
        installment_price: `${numeroParcelas}x ${formatCurrency(parcela)}`,
      };
      doc.setFont(fontFamily, 'normal');
      doc.setTextColor(...colors.text);
      let cx = x0;
      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        const val = values[col.key] || '';
        if (col.key === 'discount_price') {
          doc.setFont(fontFamily, headingWeight);
          doc.setTextColor(...colors.priceHighlight);
        }
        const tx = col.align === 'center' ? cx + colWidths[i] / 2
          : col.align === 'right' ? cx + colWidths[i] - 1 : cx + 1;
        doc.text(val, tx, y, { align: col.align as 'left' | 'center' | 'right' });
        if (col.key === 'discount_price') {
          doc.setFont(fontFamily, 'normal');
          doc.setTextColor(...colors.text);
        }
        cx += colWidths[i];
      }
      y += rowPadding;
      if (bt.showBorders) {
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.1);
        doc.line(x0, y - 1, x0 + contentW, y - 1);
      }
    });

  // ---- CARDS STYLE ----
  } else if (bt.style === 'cards') {
    doc.setFontSize(fontSizes.body);
    items.forEach((item, idx) => {
      const cardH = 32 + (totals.position === 'per_item' ? 14 : 0);
      y = checkPage(doc, y, cardH, margins.top, margins.bottom);
      if (colors.tableRowAltBg) {
        doc.setFillColor(...colors.tableRowAltBg);
        doc.rect(x0, y - 2, contentW, cardH - 4, 'F');
      }
      doc.setFillColor(...colors.tableHeaderBg);
      doc.rect(x0, y - 2, contentW, 7, 'F');
      doc.setFontSize(fontSizes.body);
      doc.setFont(fontFamily, headingWeight);
      doc.setTextColor(...colors.tableHeaderText);
      doc.text(`OPÇÃO ${idx + 1}: ${item.name}`, x0 + 3, y + 2);
      y += 10;
      doc.setFontSize(fontSizes.body);
      doc.setFont(fontFamily, 'normal');
      doc.setTextColor(...colors.text);
      doc.text(`Área: ${item.area} m²  |  Preço: ${formatCurrency(item.unitPrice)}/m²`, x0 + 3, y);
      y += 6;
      if (totals.position === 'per_item') {
        const discountPrice = item.total * (1 - discountPct);
        const { totalComTaxa, parcela } = calcularParcelamento(item.total, taxaJuros, numeroParcelas);
        const taxaText = taxaJuros > 0 ? ` (${taxaJuros}% taxa)` : '';
        doc.setFont(fontFamily, headingWeight);
        doc.setTextColor(...colors.priceHighlight);
        doc.text(`${totals.discountLabel} ${formatCurrency(discountPrice)}`, x0 + 3, y);
        y += 5.5;
        doc.setFont(fontFamily, 'normal');
        doc.setTextColor(...colors.text);
        doc.text(`${totals.installmentLabel} ${numeroParcelas}x de ${formatCurrency(parcela)}${taxaText}`, x0 + 3, y);
        y += 5;
        doc.setFontSize(fontSizes.body - 1);
        doc.setTextColor(...colors.muted);
        doc.text(`Total: ${formatCurrency(totalComTaxa)}`, x0 + 3, y);
        y += 3;
      }
      y += rowPadding;
    });

  // ---- LIST STYLE ----
  } else {
    doc.setFontSize(fontSizes.body);
    items.forEach((item, idx) => {
      y = checkPage(doc, y, 20, margins.top, margins.bottom);
      doc.setFont(fontFamily, headingWeight);
      doc.setTextColor(...colors.primary);
      doc.text(`${idx + 1}. ${item.name}`, x0, y);
      y += 5;
      doc.setFont(fontFamily, 'normal');
      doc.setTextColor(...colors.text);
      doc.text(`${item.area} m² × ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.total)}`, x0 + 5, y);
      y += 5;
      if (totals.position === 'per_item') {
        const discountPrice = item.total * (1 - discountPct);
        doc.setFont(fontFamily, headingWeight);
        doc.setTextColor(...colors.priceHighlight);
        doc.text(`${totals.discountLabel} ${formatCurrency(discountPrice)}`, x0 + 5, y);
        doc.setFont(fontFamily, 'normal');
        doc.setTextColor(...colors.text);
        y += 5;
      }
      doc.setDrawColor(...colors.border);
      doc.setLineWidth(0.1);
      doc.line(x0, y, x0 + contentW, y);
      y += rowPadding;
    });
  }

  return y;
}

// ============================================================
// Section: Totals (summary bottom)
// ============================================================

function renderTotals(
  doc: jsPDF, s: ResolvedPdfStyle,
  items: BudgetItem[], y: number,
  x0: number, contentW: number,
  numeroParcelas: number, taxaJuros: number,
): number {
  const { preset, colors, fontFamily, headingWeight, fontSizes, margins } = s;
  const totals = preset.totals;

  if (totals.position !== 'summary_bottom' || items.length === 0) return y;

  y = checkPage(doc, y, 30, margins.top, margins.bottom);
  const discountPct = totals.discountPercent / 100;
  const sumTotal = items.reduce((sum, i) => sum + i.total, 0);
  const sumDiscount = sumTotal * (1 - discountPct);
  const { totalComTaxa, parcela } = calcularParcelamento(sumTotal, taxaJuros, numeroParcelas);

  // Separator
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.3);
  doc.line(x0, y, x0 + contentW, y);
  y += 6;

  if (totals.showDiscount) {
    doc.setFontSize(13);
    doc.setFont(fontFamily, headingWeight);
    doc.setTextColor(...colors.priceHighlight);
    doc.text(`${totals.discountLabel} ${formatCurrency(sumDiscount)}`, x0, y);
    y += 7;
  }

  if (totals.showInstallments) {
    const taxaText = taxaJuros > 0 ? ` (${taxaJuros}% taxa)` : '';
    doc.setFontSize(fontSizes.heading);
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(...colors.text);
    doc.text(`${totals.installmentLabel} ${numeroParcelas}x de ${formatCurrency(parcela)}${taxaText}`, x0, y);
    y += 5;
    doc.setFontSize(fontSizes.small);
    doc.setTextColor(...colors.muted);
    doc.text(`Total: ${formatCurrency(totalComTaxa)}`, x0, y);
    y += 3;
  }

  return y + s.sectionSpacing;
}

// ============================================================
// Section: Observations
// ============================================================

function renderObservations(
  doc: jsPDF, s: ResolvedPdfStyle,
  text: string, y: number,
  x0: number, contentW: number,
): number {
  if (!text) return y;

  const { preset, colors, fontFamily, fontSizes, margins } = s;
  y = checkPage(doc, y, 15, margins.top, margins.bottom);
  doc.setFontSize(fontSizes.small);
  const fontStyle = preset.observations.fontStyle === 'italic' ? 'italic' : 'normal';
  doc.setFont(fontFamily, fontStyle);
  doc.setTextColor(...colors.muted);
  const lines = doc.splitTextToSize(text, contentW);
  doc.text(lines, x0, y);
  y += 4 * lines.length;

  return y + s.sectionSpacing;
}

// ============================================================
// Section: Footer
// ============================================================

function renderFooter(
  doc: jsPDF, s: ResolvedPdfStyle,
  validityDays: number, y: number,
  pageW: number, x0: number, contentW: number,
): number {
  const { preset, colors, fontFamily, fontSizes, margins } = s;
  const ft = preset.footer;

  if (ft.style === 'bar') {
    doc.setFillColor(...colors.border);
    doc.rect(x0, y, contentW, 1.5, 'F');
    y += 4;
  } else if (ft.style === 'line') {
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.3);
    doc.line(x0, y, x0 + contentW, y);
    y += 4;
  }
  // 'minimal' — no separator

  doc.setFontSize(fontSizes.footer);
  doc.setFont(fontFamily, 'normal');
  doc.setTextColor(...colors.footerText);
  const ftX = ft.textAlignment === 'center' ? pageW / 2
    : ft.textAlignment === 'right' ? pageW - margins.right : x0;
  doc.text(`Orçamento válido por ${validityDays} dias.`, ftX, y, { align: ft.textAlignment });

  return y;
}

// ============================================================
// Main entry point
// ============================================================

export async function gerarPDF(params: GerarPDFParams): Promise<string | void> {
  const bc = params.brandConfig;
  const tokenConfig = extractPdfBrandConfig(bc);
  const style = resolveTokens(tokenConfig, params.logoBase64 || null);

  const company: CompanyData = {
    name: bc?.company_name || '',
    cnpj: bc?.company_cnpj || '',
    phone: bc?.company_phone || '',
    email: bc?.company_email || '',
    address: bc?.company_address || '',
  };

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - style.margins.left - style.margins.right;
  const x0 = style.margins.left;
  let y = style.margins.top;

  const items = buildItems(params);
  const numeroParcelas = params.numeroParcelas || 12;
  const taxaJuros = params.taxaJuros || 2;
  const footerText = bc?.footer_text || 'Orçamento válido por 15 dias. Medidas devem ser confirmadas no local. Valores sujeitos a alteração sem aviso prévio.';
  const validityDays = bc?.validity_days || 15;

  const renderers: Record<string, () => void> = {
    header: () => { y = renderHeader(doc, style, company, y, pageW, x0); },
    client: () => { y = renderClientInfo(doc, style, params.atendimento, y, contentW, x0); },
    budget_table: () => {
      y = renderBudgetTable(doc, style, items, y, x0, contentW, numeroParcelas, taxaJuros);
      y += style.sectionSpacing;
    },
    totals: () => { y = renderTotals(doc, style, items, y, x0, contentW, numeroParcelas, taxaJuros); },
    observations: () => {
      if (tokenConfig.layout.showNotes) {
        y = renderObservations(doc, style, footerText, y, x0, contentW);
      }
    },
    footer: () => {
      if (tokenConfig.layout.showFooter) {
        y = renderFooter(doc, style, validityDays, y, pageW, x0, contentW);
      }
    },
  };

  for (const section of style.preset.sectionsOrder) {
    renderers[section]?.();
  }

  if (params.preview) return String(doc.output('bloburl'));
  doc.save(`orcamento-${params.atendimento.cliente_nome.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}
