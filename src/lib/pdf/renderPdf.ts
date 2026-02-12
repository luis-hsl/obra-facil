import { jsPDF } from 'jspdf';
import type { Orcamento, OrcamentoItem, Produto, Atendimento, BrandConfig } from '../../types';
import type { PdfBrandConfig, ResolvedPdfStyle } from '../../types/pdfTokens';
import { resolveTokens } from './resolveTokens';
import { DEFAULT_PDF_BRAND_CONFIG } from './defaults';
import { loadFont } from './fontLoader';
import type { FontFamily } from './fontLoader';

// ============================================================
// Helpers
// ============================================================

const fmt = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function calcParcel(total: number, taxa: number, n: number) {
  const comTaxa = total * (1 + taxa / 100);
  return { comTaxa, parcela: comTaxa / n };
}

function pageBreak(doc: jsPDF, y: number, need: number, mTop: number, mBot: number): number {
  if (y + need > doc.internal.pageSize.getHeight() - mBot) {
    doc.addPage();
    return mTop;
  }
  return y;
}

type RGB = [number, number, number];

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

interface Company {
  name: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
}

interface Item {
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

function buildItems(params: GerarPDFParams): Item[] {
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
  doc: jsPDF, s: ResolvedPdfStyle, company: Company,
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
  const lines = [company.name, company.cnpj, company.phone, company.email, company.address].filter(Boolean);
  if (lines.length > 0) {
    doc.setFontSize(8);
    doc.setTextColor(...colors.headerText);
    let cy = y + 1;

    if (preset.header.companyInfoPosition === 'right') {
      const rx = pageW - s.margins.right;
      doc.setFont(fontFamily, headingWeight);
      doc.text(lines[0], rx, cy, { align: 'right' });
      cy += 4;
      doc.setFont(fontFamily, 'normal');
      for (let i = 1; i < lines.length; i++) {
        doc.text(lines[i], rx, cy, { align: 'right' });
        cy += 3.5;
      }
    } else {
      cy = y + (s.logoBase64 ? s.logoMaxHeight + 4 : 0);
      doc.setFont(fontFamily, headingWeight);
      doc.text(lines[0], x0, cy);
      cy += 4;
      doc.setFont(fontFamily, 'normal');
      for (let i = 1; i < lines.length; i++) {
        doc.text(lines[i], x0, cy);
        cy += 3.5;
      }
    }
  }

  // Title
  doc.setFontSize(fontSizes.title);
  doc.setFont(fontFamily, headingWeight);
  doc.setTextColor(...colors.headerText);
  const align = preset.header.titleAlignment;
  const tx = align === 'center' ? pageW / 2 : align === 'right' ? pageW - s.margins.right : x0;
  doc.text('Orçamento', tx, y + s.headerHeight - 8, { align });

  // Separator
  if (preset.header.showSeparator) {
    doc.setFillColor(...colors.separatorColor);
    doc.rect(x0, y + s.headerHeight, contentW, 0.8, 'F');
  }

  return y + s.headerHeight + s.sectionSpacing + 2;
}

// ============================================================
// Section: Client Info
// ============================================================

function renderClientInfo(
  doc: jsPDF, s: ResolvedPdfStyle,
  at: GerarPDFParams['atendimento'],
  y: number, contentW: number, x0: number,
): number {
  const { preset, colors, fontFamily, headingWeight, fontSizes, margins } = s;
  const cs = preset.clientSection;
  const PAD = 4;

  const endereco = [at.endereco, at.numero, at.complemento, at.bairro, at.cidade].filter(Boolean).join(', ');
  const fields = [
    { label: 'Cliente:', value: at.cliente_nome },
    { label: 'Telefone:', value: at.cliente_telefone || '' },
    { label: 'Endereço:', value: endereco },
    { label: 'Serviço:', value: at.tipo_servico },
    { label: 'Data:', value: new Date().toLocaleDateString('pt-BR') },
  ].filter(f => f.value);

  const lineH = 5.5;
  const cardH = fields.length * lineH + PAD * 2;

  if (cs.style === 'card') {
    y = pageBreak(doc, y, cardH, margins.top, margins.bottom);
    if (colors.clientSectionBg) {
      doc.setFillColor(...colors.clientSectionBg);
      doc.roundedRect(x0, y, contentW, cardH, 2, 2, 'F');
    }
    if (colors.clientSectionBorder) {
      doc.setDrawColor(...colors.clientSectionBorder);
      doc.setLineWidth(0.3);
      doc.roundedRect(x0, y, contentW, cardH, 2, 2, 'S');
    }
  }

  const inset = cs.style === 'card' ? PAD + 1 : 0;
  let ty = y + PAD + 2; // text baseline inside card

  doc.setFontSize(fontSizes.body);
  for (const { label, value } of fields) {
    doc.setFont(fontFamily, cs.labelBold ? headingWeight : 'normal');
    doc.setTextColor(...colors.muted);
    doc.text(label, x0 + inset, ty);
    const lw = doc.getTextWidth(label + ' ');

    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(...colors.text);
    const wrapped = doc.splitTextToSize(value, contentW - lw - inset * 2);
    doc.text(wrapped, x0 + inset + lw, ty);
    ty += lineH * Math.max(wrapped.length, 1);
  }

  return ty + s.sectionSpacing;
}

// ============================================================
// Section: Budget Table
// ============================================================

function renderBudgetTable(
  doc: jsPDF, s: ResolvedPdfStyle,
  items: Item[], y: number,
  x0: number, contentW: number,
  nParcelas: number, taxa: number,
): number {
  const { preset, colors, fontFamily, headingWeight, fontSizes, margins, rowPadding } = s;
  const bt = preset.budgetTable;
  const totals = preset.totals;
  const disc = totals.discountPercent / 100;
  const PAD = 4;

  // ──── TABLE ────
  if (bt.style === 'table') {
    const cols = bt.columns;
    const colW = cols.map(c => (c.widthPercent / 100) * contentW);
    const rowH = rowPadding + 4;
    const headerH = 8;

    // Header row
    if (bt.showHeader) {
      y = pageBreak(doc, y, headerH + 4, margins.top, margins.bottom);
      doc.setFillColor(...colors.tableHeaderBg);
      doc.roundedRect(x0, y, contentW, headerH, 1.5, 1.5, 'F');

      doc.setFontSize(fontSizes.body);
      doc.setFont(fontFamily, headingWeight);
      doc.setTextColor(...colors.tableHeaderText);

      const textY = y + headerH / 2 + 1; // vertically centered
      let cx = x0;
      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        const tx = col.align === 'center' ? cx + colW[i] / 2
          : col.align === 'right' ? cx + colW[i] - PAD : cx + PAD;
        doc.text(col.label, tx, textY, { align: col.align as 'left' | 'center' | 'right' });
        cx += colW[i];
      }
      y += headerH + 2;
    }

    // Data rows
    doc.setFontSize(fontSizes.body);
    items.forEach((item, idx) => {
      y = pageBreak(doc, y, rowH, margins.top, margins.bottom);

      // Alternating row bg — aligned to row bounds
      if (idx % 2 === 0 && colors.tableRowAltBg) {
        doc.setFillColor(...colors.tableRowAltBg);
        doc.rect(x0, y, contentW, rowH, 'F');
      }

      const discPrice = item.total * (1 - disc);
      const { parcela } = calcParcel(item.total, taxa, nParcelas);
      const vals: Record<string, string> = {
        option_number: String(idx + 1),
        product_name: item.name,
        area: `${item.area} m²`,
        unit_price: fmt(item.unitPrice),
        total: fmt(item.total),
        discount_price: fmt(discPrice),
        installment_price: `${nParcelas}x ${fmt(parcela)}`,
      };

      const textY = y + rowH / 2 + 1; // vertically centered in row
      doc.setFont(fontFamily, 'normal');
      doc.setTextColor(...colors.text);

      let cx = x0;
      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        const val = vals[col.key] || '';
        const isHighlight = col.key === 'discount_price';
        if (isHighlight) {
          doc.setFont(fontFamily, headingWeight);
          doc.setTextColor(...colors.priceHighlight);
        }
        const tx = col.align === 'center' ? cx + colW[i] / 2
          : col.align === 'right' ? cx + colW[i] - PAD : cx + PAD;
        doc.text(val, tx, textY, { align: col.align as 'left' | 'center' | 'right' });
        if (isHighlight) {
          doc.setFont(fontFamily, 'normal');
          doc.setTextColor(...colors.text);
        }
        cx += colW[i];
      }

      y += rowH;

      // Row divider
      if (bt.showBorders && idx < items.length - 1) {
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.2);
        doc.line(x0 + PAD, y, x0 + contentW - PAD, y);
      }
    });

  // ──── CARDS ────
  } else if (bt.style === 'cards') {
    items.forEach((item, idx) => {
      const hasPerItem = totals.position === 'per_item';
      const bodyH = hasPerItem ? 32 : 14;
      const headerH = 10;
      const cardH = headerH + bodyH;
      const R = 2.5;

      y = pageBreak(doc, y, cardH + 6, margins.top, margins.bottom);

      // Card: full background in body color
      const bodyBg: RGB = colors.tableRowAltBg || [248, 249, 250];
      doc.setFillColor(...bodyBg);
      doc.roundedRect(x0, y, contentW, cardH, R, R, 'F');

      // Header strip: fill top portion with primary
      // Draw full-width rect clipped visually by the card above
      doc.setFillColor(...colors.tableHeaderBg);
      // Top rounded rect — same width, header height + radius so the bottom is straight
      doc.roundedRect(x0, y, contentW, headerH + R, R, R, 'F');
      // Cover the rounded bottom corners with body color
      doc.setFillColor(...bodyBg);
      doc.rect(x0, y + headerH, contentW, R, 'F');

      // Header text — vertically centered
      doc.setFontSize(fontSizes.body);
      doc.setFont(fontFamily, headingWeight);
      doc.setTextColor(...colors.tableHeaderText);
      doc.text(`OPÇÃO ${idx + 1}: ${item.name}`, x0 + PAD + 1, y + headerH / 2 + 1);

      // Body starts after header
      let by = y + headerH + PAD + 2;

      // Area + Price side by side
      doc.setFontSize(fontSizes.body);
      doc.setFont(fontFamily, 'normal');
      doc.setTextColor(...colors.muted);
      doc.text('Área:', x0 + PAD + 1, by);
      doc.setTextColor(...colors.text);
      doc.text(`${item.area} m²`, x0 + PAD + 1 + doc.getTextWidth('Área: '), by);

      const priceLabel = 'Preço:';
      const midX = x0 + contentW / 2;
      doc.setTextColor(...colors.muted);
      doc.text(priceLabel, midX, by);
      doc.setTextColor(...colors.text);
      doc.text(`${fmt(item.unitPrice)}/m²`, midX + doc.getTextWidth(priceLabel + ' '), by);

      by += 6;

      if (hasPerItem) {
        const discPrice = item.total * (1 - disc);
        const { comTaxa, parcela } = calcParcel(item.total, taxa, nParcelas);
        const taxaText = taxa > 0 ? ` (${taxa}% taxa)` : '';

        // Separator line
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.2);
        doc.line(x0 + PAD + 1, by, x0 + contentW - PAD - 1, by);
        by += 5;

        // Discount price — highlight
        doc.setFontSize(fontSizes.heading);
        doc.setFont(fontFamily, headingWeight);
        doc.setTextColor(...colors.priceHighlight);
        doc.text(`${totals.discountLabel} ${fmt(discPrice)}`, x0 + PAD + 1, by);
        by += 6;

        // Installment
        doc.setFontSize(fontSizes.body);
        doc.setFont(fontFamily, 'normal');
        doc.setTextColor(...colors.text);
        doc.text(`${totals.installmentLabel} ${nParcelas}x de ${fmt(parcela)}${taxaText}`, x0 + PAD + 1, by);
        by += 5;

        // Total with interest
        doc.setFontSize(fontSizes.small);
        doc.setTextColor(...colors.muted);
        doc.text(`Total parcelado: ${fmt(comTaxa)}`, x0 + PAD + 1, by);
      }

      y += cardH + rowPadding + 2;
    });

  // ──── LIST ────
  } else {
    const indent = 8;
    items.forEach((item, idx) => {
      const hasPerItem = totals.position === 'per_item';
      y = pageBreak(doc, y, hasPerItem ? 28 : 18, margins.top, margins.bottom);

      // Number
      doc.setFontSize(fontSizes.body + 1);
      doc.setFont(fontFamily, headingWeight);
      doc.setTextColor(...colors.primary);
      doc.text(`${idx + 1}.`, x0, y);

      // Product name (same line)
      doc.text(item.name, x0 + indent, y);
      y += 6;

      // Details: area × price
      doc.setFontSize(fontSizes.body);
      doc.setFont(fontFamily, 'normal');
      doc.setTextColor(...colors.muted);
      doc.text(`${item.area} m²  ×  ${fmt(item.unitPrice)}/m²`, x0 + indent, y);

      // Total right-aligned
      doc.setFont(fontFamily, headingWeight);
      doc.setTextColor(...colors.text);
      doc.text(fmt(item.total), x0 + contentW, y, { align: 'right' });
      y += 5;

      if (hasPerItem) {
        const discPrice = item.total * (1 - disc);
        doc.setFont(fontFamily, headingWeight);
        doc.setTextColor(...colors.priceHighlight);
        doc.text(`${totals.discountLabel} ${fmt(discPrice)}`, x0 + indent, y);
        y += 5;
      }

      // Divider
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
// Section: Totals (summary_bottom)
// ============================================================

function renderTotals(
  doc: jsPDF, s: ResolvedPdfStyle,
  items: Item[], y: number,
  x0: number, contentW: number,
  nParcelas: number, taxa: number,
): number {
  const { preset, colors, fontFamily, headingWeight, fontSizes, margins } = s;
  const totals = preset.totals;
  if (totals.position !== 'summary_bottom' || items.length === 0) return y;

  const disc = totals.discountPercent / 100;
  const sum = items.reduce((s, i) => s + i.total, 0);
  const discTotal = sum * (1 - disc);
  const { comTaxa, parcela } = calcParcel(sum, taxa, nParcelas);
  const PAD = 5;
  const R = 2;

  // Calculate box height
  let boxH = PAD * 2 + 8;
  if (totals.showInstallments) boxH += 12;

  y = pageBreak(doc, y, boxH + 4, margins.top, margins.bottom);

  // Background box
  const bgColor: RGB = colors.tableRowAltBg || [248, 249, 250];
  doc.setFillColor(...bgColor);
  doc.roundedRect(x0, y, contentW, boxH, R, R, 'F');

  // Accent sidebar — same radius as box, aligned to top/bottom
  doc.setFillColor(...colors.priceHighlight);
  doc.roundedRect(x0, y, 3, boxH, R, R, 'F');
  // Cover right side of accent bar to make it flush with box edge
  doc.rect(x0 + 1.5, y, 1.5, boxH, 'F');

  let ty = y + PAD + 3;

  // Discount total
  if (totals.showDiscount) {
    doc.setFontSize(14);
    doc.setFont(fontFamily, headingWeight);
    doc.setTextColor(...colors.priceHighlight);
    doc.text(totals.discountLabel, x0 + PAD + 4, ty);
    doc.text(fmt(discTotal), x0 + contentW - PAD, ty, { align: 'right' });
    ty += 8;
  }

  // Installments
  if (totals.showInstallments) {
    const taxaText = taxa > 0 ? ` (${taxa}% taxa)` : '';
    doc.setFontSize(fontSizes.heading);
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(...colors.text);
    doc.text(`${totals.installmentLabel} ${nParcelas}x de ${fmt(parcela)}${taxaText}`, x0 + PAD + 4, ty);
    ty += 5;
    doc.setFontSize(fontSizes.small);
    doc.setTextColor(...colors.muted);
    doc.text(`Total parcelado: ${fmt(comTaxa)}`, x0 + PAD + 4, ty);
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

  y = pageBreak(doc, y, 15, margins.top, margins.bottom);
  doc.setFontSize(fontSizes.small);
  doc.setFont(fontFamily, preset.observations.fontStyle === 'italic' ? 'italic' : 'normal');
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
    doc.roundedRect(x0, y, contentW, 1, 0.5, 0.5, 'F');
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
  const align = ft.textAlignment;
  const tx = align === 'center' ? pageW / 2 : align === 'right' ? pageW - margins.right : x0;
  doc.text(`Orçamento válido por ${validityDays} dias.`, tx, y, { align });

  return y;
}

// ============================================================
// Main
// ============================================================

export async function gerarPDF(params: GerarPDFParams): Promise<string | void> {
  const bc = params.brandConfig;
  const tokenConfig = extractPdfBrandConfig(bc);
  const style = resolveTokens(tokenConfig, params.logoBase64 || null);

  const company: Company = {
    name: bc?.company_name || '',
    cnpj: bc?.company_cnpj || '',
    phone: bc?.company_phone || '',
    email: bc?.company_email || '',
    address: bc?.company_address || '',
  };

  const doc = new jsPDF('p', 'mm', 'a4');

  // Load custom font if needed (fetches from CDN + caches in IndexedDB)
  const fontKey = tokenConfig.typography.fontFamily as FontFamily;
  const resolvedFontFamily = await loadFont(doc, fontKey);
  style.fontFamily = resolvedFontFamily;

  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - style.margins.left - style.margins.right;
  const x0 = style.margins.left;
  let y = style.margins.top;

  const items = buildItems(params);
  const nParcelas = params.numeroParcelas || 12;
  const taxa = params.taxaJuros || 2;
  const footerText = bc?.footer_text || 'Orçamento válido por 15 dias. Medidas devem ser confirmadas no local. Valores sujeitos a alteração sem aviso prévio.';
  const validityDays = bc?.validity_days || 15;

  const renderers: Record<string, () => void> = {
    header: () => { y = renderHeader(doc, style, company, y, pageW, x0, contentW); },
    client: () => { y = renderClientInfo(doc, style, params.atendimento, y, contentW, x0); },
    budget_table: () => {
      y = renderBudgetTable(doc, style, items, y, x0, contentW, nParcelas, taxa);
      y += style.sectionSpacing;
    },
    totals: () => { y = renderTotals(doc, style, items, y, x0, contentW, nParcelas, taxa); },
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
