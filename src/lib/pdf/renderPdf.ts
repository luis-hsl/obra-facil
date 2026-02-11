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

type RGB = [number, number, number];

/**
 * Padding interno padrão para cards/boxes (em mm).
 * Usado em todos os componentes para garantir alinhamento consistente.
 */
const PAD = 4;

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
  if (stored && stored.version === 3) return stored as unknown as PdfBrandConfig;
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
    typography: { fontFamily: bc.font_family || 'helvetica', headingWeight: 'bold', bodyWeight: 'normal' },
    logo: { url: bc.logo_url || null, alignment: bc.logo_position || 'left', size: 'medium' },
    layout: { density: 'normal', showNotes: true, showFooter: true },
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
  doc: jsPDF, s: ResolvedPdfStyle, company: CompanyData,
  y: number, pageW: number, x0: number, contentW: number,
): number {
  const { preset, colors, fontFamily, headingWeight, fontSizes } = s;

  // Background — full bleed
  if (colors.headerBg) {
    doc.setFillColor(...colors.headerBg);
    doc.rect(0, 0, pageW, s.headerHeight + 4, 'F');
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
    doc.setFontSize(8);
    doc.setTextColor(...colors.headerText);

    if (preset.header.companyInfoPosition === 'right') {
      let cY = y + 1;
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
      let cY = y + (s.logoBase64 ? s.logoMaxHeight + 4 : 0);
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

  // Separator — solid accent line (1mm height)
  if (preset.header.showSeparator) {
    const sepY = y + s.headerHeight;
    doc.setFillColor(...colors.separatorColor);
    doc.rect(x0, sepY, contentW, 1, 'F');
  }

  return y + s.headerHeight + s.sectionSpacing + 2;
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

  const lineH = 5.5;
  const totalH = clientData.length * lineH;

  // Card background
  if (cs.style === 'card') {
    const cardH = totalH + PAD * 2;
    y = checkPage(doc, y, cardH, margins.top, margins.bottom);
    if (colors.clientSectionBg) {
      doc.setFillColor(...colors.clientSectionBg);
      doc.roundedRect(x0, y, contentW, cardH, 2, 2, 'F');
    }
    if (colors.clientSectionBorder) {
      doc.setDrawColor(...colors.clientSectionBorder);
      doc.setLineWidth(0.3);
      doc.roundedRect(x0, y, contentW, cardH, 2, 2, 'S');
    }
    y += PAD;
  }

  doc.setFontSize(fontSizes.body);
  const inset = cs.style === 'card' ? PAD : 0;

  // Primeira passada: medir largura máxima de labels para alinhar colunas
  doc.setFont(fontFamily, cs.labelBold ? headingWeight : 'normal');
  let maxLabelW = 0;
  for (const { label } of clientData) {
    const w = doc.getTextWidth(label + ' ');
    if (w > maxLabelW) maxLabelW = w;
  }

  // Renderizar dados alinhados em duas colunas
  for (const { label, value } of clientData) {
    const lx = x0 + inset;
    // Label
    doc.setFont(fontFamily, cs.labelBold ? headingWeight : 'normal');
    doc.setTextColor(...colors.muted);
    doc.text(label, lx, y + lineH * 0.7);
    // Value — alinhado pela largura máxima do label
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(...colors.text);
    const vx = lx + maxLabelW;
    const maxValueW = contentW - maxLabelW - inset * 2;
    const lines = doc.splitTextToSize(value, maxValueW);
    doc.text(lines, vx, y + lineH * 0.7);
    y += lineH * Math.max(lines.length, 1);
  }

  if (cs.style === 'card') y += PAD;

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
    const rowH = rowPadding + 4;
    const headerH = 8;

    if (bt.showHeader) {
      y = checkPage(doc, y, headerH + 4, margins.top, margins.bottom);
      // Header background
      doc.setFillColor(...colors.tableHeaderBg);
      doc.roundedRect(x0, y, contentW, headerH, 1.5, 1.5, 'F');
      // Header text — vertically centered
      const textY = y + headerH / 2 + 1;
      doc.setFontSize(fontSizes.body);
      doc.setFont(fontFamily, headingWeight);
      doc.setTextColor(...colors.tableHeaderText);
      let cx = x0;
      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        const tx = col.align === 'center' ? cx + colWidths[i] / 2
          : col.align === 'right' ? cx + colWidths[i] - PAD : cx + PAD;
        doc.text(col.label, tx, textY, { align: col.align as 'left' | 'center' | 'right' });
        cx += colWidths[i];
      }
      y += headerH + 2;
    }

    doc.setFontSize(fontSizes.body);
    items.forEach((item, idx) => {
      y = checkPage(doc, y, rowH, margins.top, margins.bottom);
      // Alternating row — rect alinhado ao texto
      if (idx % 2 === 0 && colors.tableRowAltBg) {
        doc.setFillColor(...colors.tableRowAltBg);
        doc.rect(x0, y, contentW, rowH, 'F');
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
      // Text centered in row height
      const textY = y + rowH / 2 + 1;
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
          : col.align === 'right' ? cx + colWidths[i] - PAD : cx + PAD;
        doc.text(val, tx, textY, { align: col.align as 'left' | 'center' | 'right' });
        if (col.key === 'discount_price') {
          doc.setFont(fontFamily, 'normal');
          doc.setTextColor(...colors.text);
        }
        cx += colWidths[i];
      }
      y += rowH;
      // Separator between rows (not after last)
      if (bt.showBorders && idx < items.length - 1) {
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.2);
        doc.line(x0 + PAD, y, x0 + contentW - PAD, y);
      }
    });

  // ---- CARDS STYLE ----
  } else if (bt.style === 'cards') {
    items.forEach((item, idx) => {
      const hasPerItem = totals.position === 'per_item';
      // Dimensões calculadas com precisão
      const headerH = 10;
      const bodyBase = 14;                        // Área + Preço
      const priceBlock = hasPerItem ? 24 : 0;     // Desconto + parcelado + total
      const cardH = headerH + bodyBase + priceBlock + PAD;
      y = checkPage(doc, y, cardH + 4, margins.top, margins.bottom);

      const cardTop = y;
      const cardR = 2;

      // 1) Card inteiro na cor do header (dá os cantos arredondados do topo)
      doc.setFillColor(...colors.tableHeaderBg);
      doc.roundedRect(x0, cardTop, contentW, cardH, cardR, cardR, 'F');

      // 2) Corpo sobre o header — cobre de headerH até o fim, cantos arredondados embaixo
      const bodyColor: RGB = colors.tableRowAltBg || [248, 249, 250];
      doc.setFillColor(...bodyColor);
      doc.roundedRect(x0, cardTop + headerH, contentW, cardH - headerH, cardR, cardR, 'F');
      // Preencher os cantos superiores do corpo (que ficaram arredondados)
      doc.rect(x0, cardTop + headerH, contentW, cardR, 'F');

      // Header text
      const headerTextY = cardTop + headerH / 2 + 1;
      doc.setFontSize(fontSizes.body);
      doc.setFont(fontFamily, headingWeight);
      doc.setTextColor(...colors.tableHeaderText);
      doc.text(`OPÇÃO ${idx + 1}: ${item.name}`, x0 + PAD, headerTextY);

      // Body
      let bY = cardTop + headerH + PAD + 2;
      doc.setFontSize(fontSizes.body);
      doc.setFont(fontFamily, 'normal');
      doc.setTextColor(...colors.text);
      doc.text(`Área: ${item.area} m²`, x0 + PAD, bY);
      doc.text(`Preço: ${formatCurrency(item.unitPrice)}/m²`, x0 + contentW / 2, bY);
      bY += 8;

      if (hasPerItem) {
        const discountPrice = item.total * (1 - discountPct);
        const { totalComTaxa, parcela } = calcularParcelamento(item.total, taxaJuros, numeroParcelas);
        const taxaText = taxaJuros > 0 ? ` (${taxaJuros}% taxa)` : '';

        // Linha separadora
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.2);
        doc.line(x0 + PAD, bY, x0 + contentW - PAD, bY);
        bY += 5;

        // Preço à vista — destaque
        doc.setFontSize(fontSizes.heading);
        doc.setFont(fontFamily, headingWeight);
        doc.setTextColor(...colors.priceHighlight);
        doc.text(`${totals.discountLabel} ${formatCurrency(discountPrice)}`, x0 + PAD, bY);
        bY += 6;

        // Parcelado
        doc.setFontSize(fontSizes.body);
        doc.setFont(fontFamily, 'normal');
        doc.setTextColor(...colors.text);
        doc.text(`${totals.installmentLabel} ${numeroParcelas}x de ${formatCurrency(parcela)}${taxaText}`, x0 + PAD, bY);
        bY += 5;

        // Total com taxa
        doc.setFontSize(fontSizes.small);
        doc.setTextColor(...colors.muted);
        doc.text(`Total parcelado: ${formatCurrency(totalComTaxa)}`, x0 + PAD, bY);
      }

      y = cardTop + cardH + rowPadding;
    });

  // ---- LIST STYLE ----
  } else {
    const numW = 8;
    items.forEach((item, idx) => {
      const hasPerItem = totals.position === 'per_item';
      const blockH = hasPerItem ? 24 : 14;
      y = checkPage(doc, y, blockH, margins.top, margins.bottom);

      // Número + nome na mesma linha
      doc.setFontSize(fontSizes.body + 1);
      doc.setFont(fontFamily, headingWeight);
      doc.setTextColor(...colors.primary);
      doc.text(`${idx + 1}.`, x0, y);
      doc.text(item.name, x0 + numW, y);
      y += 5;

      // Detalhes
      doc.setFontSize(fontSizes.body);
      doc.setFont(fontFamily, 'normal');
      doc.setTextColor(...colors.muted);
      doc.text(`${item.area} m²  ×  ${formatCurrency(item.unitPrice)}/m²`, x0 + numW, y);

      // Total alinhado à direita
      doc.setFont(fontFamily, headingWeight);
      doc.setTextColor(...colors.text);
      doc.text(formatCurrency(item.total), x0 + contentW, y, { align: 'right' });
      y += 5;

      if (hasPerItem) {
        const discountPrice = item.total * (1 - discountPct);
        doc.setFont(fontFamily, headingWeight);
        doc.setTextColor(...colors.priceHighlight);
        doc.text(`${totals.discountLabel} ${formatCurrency(discountPrice)}`, x0 + numW, y);
        y += 5;
      }

      // Divider (not after last)
      if (idx < items.length - 1) {
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.2);
        doc.line(x0, y, x0 + contentW, y);
      }
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

  y = checkPage(doc, y, 40, margins.top, margins.bottom);
  const discountPct = totals.discountPercent / 100;
  const sumTotal = items.reduce((sum, i) => sum + i.total, 0);
  const sumDiscount = sumTotal * (1 - discountPct);
  const { totalComTaxa, parcela } = calcularParcelamento(sumTotal, taxaJuros, numeroParcelas);

  // Calcular altura do box
  const boxR = 2;
  const barW = 3;
  let lineCount = 0;
  if (totals.showDiscount) lineCount++;
  if (totals.showInstallments) lineCount += 2;
  const boxH = PAD * 2 + lineCount * 8;

  // Box de fundo
  const bgColor: RGB = colors.tableRowAltBg || [248, 249, 250];
  doc.setFillColor(...bgColor);
  doc.roundedRect(x0, y, contentW, boxH, boxR, boxR, 'F');

  // Barra lateral de accent (mesmo raio que o box)
  doc.setFillColor(...colors.priceHighlight);
  doc.roundedRect(x0, y, barW, boxH, boxR, boxR, 'F');
  // Retângulo para cobrir os cantos arredondados da direita da barra
  doc.rect(x0 + barW - boxR, y, boxR, boxH, 'F');

  let ty = y + PAD + 4;

  if (totals.showDiscount) {
    doc.setFontSize(14);
    doc.setFont(fontFamily, headingWeight);
    doc.setTextColor(...colors.priceHighlight);
    doc.text(totals.discountLabel, x0 + barW + PAD, ty);
    doc.text(formatCurrency(sumDiscount), x0 + contentW - PAD, ty, { align: 'right' });
    ty += 8;
  }

  if (totals.showInstallments) {
    const taxaText = taxaJuros > 0 ? ` (${taxaJuros}% taxa)` : '';
    doc.setFontSize(fontSizes.heading);
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(...colors.text);
    doc.text(`${totals.installmentLabel} ${numeroParcelas}x de ${formatCurrency(parcela)}${taxaText}`, x0 + barW + PAD, ty);
    ty += 6;
    doc.setFontSize(fontSizes.small);
    doc.setTextColor(...colors.muted);
    doc.text(`Total parcelado: ${formatCurrency(totalComTaxa)}`, x0 + barW + PAD, ty);
  }

  return y + boxH + s.sectionSpacing;
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
    doc.setFillColor(...colors.primary);
    doc.rect(x0, y, contentW, 1, 'F');
    y += 5;
  } else if (ft.style === 'line') {
    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.3);
    doc.line(x0, y, x0 + contentW, y);
    y += 5;
  } else {
    y += 3;
  }

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
    header: () => { y = renderHeader(doc, style, company, y, pageW, x0, contentW); },
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
