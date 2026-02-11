import { jsPDF } from 'jspdf';
import type { Orcamento, OrcamentoItem, Produto, Atendimento, BrandConfig, PdfTemplate } from '../types';
import { hexToRgb } from './imageUtils';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function calcularParcelamento(valorTotal: number, taxaMaquina: number, numParcelas: number) {
  const totalComTaxa = valorTotal * (1 + taxaMaquina / 100);
  const parcela = totalComTaxa / numParcelas;
  return { totalComTaxa, parcela };
}

interface GerarPDFParams {
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

const DESCONTO_AVISTA = 0.05;

// ============================================================
// Helpers
// ============================================================

function checkPage(doc: jsPDF, y: number, needed: number = 40, marginBottom = 20): number {
  if (y + needed > doc.internal.pageSize.getHeight() - marginBottom) {
    doc.addPage();
    return 20;
  }
  return y;
}

// ============================================================
// Template-based renderer
// ============================================================

function renderFromTemplate(
  doc: jsPDF,
  params: GerarPDFParams,
  tpl: PdfTemplate,
  logoBase64?: string | null,
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const font = tpl.fonts.family;
  const ml = tpl.spacing.margins.left;
  const mr = tpl.spacing.margins.right;
  const contentWidth = pageWidth - ml - mr;
  const lh = tpl.spacing.lineHeight;
  const gap = tpl.spacing.sectionGap;

  const primary = hexToRgb(tpl.colors.primary);
  const secondary = hexToRgb(tpl.colors.secondary);
  const accent = hexToRgb(tpl.colors.accent);
  const headerTextC = hexToRgb(tpl.colors.headerText);
  const bodyTextC = hexToRgb(tpl.colors.bodyText);

  let y = tpl.spacing.margins.top;

  // ── HEADER ──────────────────────────────────────────────
  if (tpl.header.backgroundColor) {
    doc.setFillColor(...hexToRgb(tpl.header.backgroundColor));
    doc.rect(0, 0, pageWidth, tpl.header.height, 'F');
  }

  const headerY = tpl.header.backgroundColor ? tpl.header.height / 2 - 2 : y;

  // Logo
  if (logoBase64) {
    const fmt = logoBase64.includes('image/png') ? 'PNG' : 'JPEG';
    const logoH = tpl.header.logoMaxHeight;
    const logoW = logoH * 1.8;
    const logoY = tpl.header.backgroundColor ? (tpl.header.height - logoH) / 2 : y - 3;
    let logoX = ml;
    if (tpl.header.logoPosition === 'center') logoX = (pageWidth - logoW) / 2;
    else if (tpl.header.logoPosition === 'right') logoX = pageWidth - mr - logoW;
    doc.addImage(logoBase64, fmt, logoX, logoY, logoW, logoH);
  }

  // Company info no header
  const textColor = tpl.header.backgroundColor ? headerTextC : secondary;
  doc.setTextColor(...textColor);
  doc.setFontSize(tpl.fonts.smallSize);
  doc.setFont(font, 'normal');

  let infoX: number;
  let infoAlign: 'left' | 'right';
  if (tpl.header.companyInfoPosition === 'right') {
    infoX = pageWidth - mr;
    infoAlign = 'right';
  } else if (tpl.header.companyInfoPosition === 'below-logo') {
    infoX = ml;
    infoAlign = 'left';
  } else {
    infoX = ml;
    infoAlign = 'left';
  }

  let iy = headerY - 4;
  if (tpl.header.companyInfoPosition !== 'below-logo') {
    if (tpl.company.name) {
      doc.setFont(font, 'bold');
      doc.setFontSize(tpl.fonts.subtitleSize);
      doc.text(tpl.company.name, infoX, iy, { align: infoAlign });
      doc.setFont(font, 'normal');
      doc.setFontSize(tpl.fonts.smallSize);
      iy += 5;
    }
    if (tpl.company.phone) { doc.text(tpl.company.phone, infoX, iy, { align: infoAlign }); iy += 4; }
    if (tpl.company.email) { doc.text(tpl.company.email, infoX, iy, { align: infoAlign }); iy += 4; }
    if (tpl.company.cnpj) { doc.text(`CNPJ: ${tpl.company.cnpj}`, infoX, iy, { align: infoAlign }); iy += 4; }
    if (tpl.company.address) {
      const addrLines = doc.splitTextToSize(tpl.company.address, 80);
      doc.text(addrLines, infoX, iy, { align: infoAlign });
    }
  }

  y = tpl.header.backgroundColor ? tpl.header.height + 5 : Math.max(iy + 6, y + tpl.header.logoMaxHeight + 5);

  // Company info below logo
  if (tpl.header.companyInfoPosition === 'below-logo' && !tpl.header.backgroundColor) {
    doc.setTextColor(...secondary);
    doc.setFontSize(tpl.fonts.smallSize);
    const parts = [tpl.company.phone, tpl.company.email, tpl.company.cnpj ? `CNPJ: ${tpl.company.cnpj}` : null].filter(Boolean);
    if (parts.length) {
      doc.text(parts.join('  |  '), pageWidth / 2, y, { align: 'center' });
      y += 6;
    }
  }

  // Title
  if (tpl.header.showTitle) {
    // Separador antes do título se não tem header colorido
    if (!tpl.header.backgroundColor) {
      doc.setDrawColor(...primary);
      doc.setLineWidth(0.8);
      doc.line(ml, y, pageWidth - mr, y);
      doc.setLineWidth(0.2);
      y += gap;
    }

    doc.setFontSize(tpl.fonts.titleSize);
    doc.setFont(font, 'bold');
    doc.setTextColor(...primary);
    const titleX = tpl.header.titleAlignment === 'center' ? pageWidth / 2
      : tpl.header.titleAlignment === 'right' ? pageWidth - mr : ml;
    doc.text(tpl.header.titleText || 'ORÇAMENTO', titleX, y, { align: tpl.header.titleAlignment });
    doc.setTextColor(0, 0, 0);
    y += gap;
  }

  // ── CLIENTE ─────────────────────────────────────────────
  y = checkPage(doc, y, 50);

  if (tpl.clientSection.style === 'card' && tpl.clientSection.backgroundColor) {
    doc.setFillColor(...hexToRgb(tpl.clientSection.backgroundColor));
    if (tpl.clientSection.borderRadius) {
      doc.roundedRect(ml, y - 3, contentWidth, 42, 3, 3, 'F');
    } else {
      doc.rect(ml, y - 3, contentWidth, 42, 'F');
    }
    y += 4;
  }

  doc.setTextColor(...bodyTextC);
  doc.setFontSize(tpl.fonts.bodySize);

  const labelX = ml + 2;
  const valueX = ml + 35;

  if (tpl.clientSection.labelBold) doc.setFont(font, 'bold');
  doc.text('Cliente:', labelX, y);
  doc.setFont(font, 'normal');
  doc.text(params.atendimento.cliente_nome, valueX, y);
  y += lh;

  if (params.atendimento.cliente_telefone) {
    if (tpl.clientSection.labelBold) doc.setFont(font, 'bold');
    doc.text('Telefone:', labelX, y);
    doc.setFont(font, 'normal');
    doc.text(params.atendimento.cliente_telefone, valueX, y);
    y += lh;
  }

  const endereco = [
    params.atendimento.endereco, params.atendimento.numero,
    params.atendimento.complemento, params.atendimento.bairro,
    params.atendimento.cidade,
  ].filter(Boolean).join(', ');
  if (endereco) {
    if (tpl.clientSection.labelBold) doc.setFont(font, 'bold');
    doc.text('Endereço:', labelX, y);
    doc.setFont(font, 'normal');
    const lines = doc.splitTextToSize(endereco, contentWidth - 40);
    doc.text(lines, valueX, y);
    y += lh * lines.length;
  }

  if (tpl.clientSection.labelBold) doc.setFont(font, 'bold');
  doc.text('Serviço:', labelX, y);
  doc.setFont(font, 'normal');
  doc.text(params.atendimento.tipo_servico, valueX, y);
  y += gap + 2;

  // ── SEPARADOR ───────────────────────────────────────────
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.5);
  doc.line(ml, y, pageWidth - mr, y);
  doc.setLineWidth(0.2);
  y += gap;

  // ── PRODUTOS ────────────────────────────────────────────
  const itemList = params.itens && params.itens.length > 0 ? params.itens : [];
  const nParcelas = params.numeroParcelas || 12;
  const taxa = params.taxaJuros || 2;

  if (itemList.length > 0) {
    doc.setFontSize(tpl.fonts.subtitleSize);
    doc.setFont(font, 'bold');
    doc.setTextColor(...bodyTextC);
    doc.text(itemList.length === 1 ? 'OPÇÃO DE PRODUTO' : 'OPÇÕES DE PRODUTOS', ml, y);
    y += gap;

    itemList.forEach((item, idx) => {
      y = checkPage(doc, y, 55);
      const prod = item.produto_id ? (params.produtosMap || {})[item.produto_id] : null;
      const prodNome = prod ? `${prod.fabricante} — ${prod.linha}` : 'Produto';

      const valorBase = item.valor_total;
      const valorDesc = valorBase * (1 - DESCONTO_AVISTA);
      const { totalComTaxa, parcela } = calcularParcelamento(valorBase, taxa, nParcelas);

      // Option header
      if (tpl.productsSection.headerBackgroundColor) {
        doc.setFillColor(...hexToRgb(tpl.productsSection.headerBackgroundColor));
        doc.rect(ml, y - 4, contentWidth, 8, 'F');
      }
      doc.setFontSize(tpl.fonts.bodySize + 1);
      doc.setFont(font, 'bold');
      doc.setTextColor(...hexToRgb(tpl.productsSection.headerTextColor));
      const optLabel = tpl.productsSection.showOptionNumber ? `OPÇÃO ${idx + 1}: ${prodNome}` : prodNome;
      doc.text(optLabel, ml + 2, y);
      y += lh + 2;

      // Details
      doc.setFontSize(tpl.fonts.bodySize);
      doc.setFont(font, 'normal');
      doc.setTextColor(...bodyTextC);
      if (tpl.productsSection.showUnitPrice) {
        doc.text(`Área: ${item.area_total} m²  |  Preço: ${formatCurrency(item.preco_por_m2)}/m²`, ml, y);
        y += lh;
      }

      // À vista
      if (tpl.paymentSection.showDiscount) {
        doc.setFont(font, 'bold');
        doc.setTextColor(...hexToRgb(tpl.productsSection.priceHighlightColor));
        doc.text(`${tpl.paymentSection.discountLabel} (5% desc.): ${formatCurrency(valorDesc)}`, ml, y);
        y += lh;
      }

      // Parcelado
      doc.setFont(font, 'normal');
      doc.setTextColor(...bodyTextC);
      doc.text(`${tpl.paymentSection.installmentLabel}: ${nParcelas}x de ${formatCurrency(parcela)}`, ml, y);
      if (taxa > 0) {
        doc.setTextColor(128, 128, 128);
        const pw = doc.getTextWidth(`${tpl.paymentSection.installmentLabel}: ${nParcelas}x de ${formatCurrency(parcela)}`);
        doc.text(` (${taxa}% taxa)`, ml + pw, y);
      }
      y += lh - 1;

      // Total
      doc.setFontSize(tpl.fonts.smallSize);
      doc.setTextColor(128, 128, 128);
      doc.text(`Total: ${formatCurrency(totalComTaxa)}`, ml, y);
      doc.setTextColor(0, 0, 0);
      y += gap;
    });
  } else if (params.produto && params.orcamento.area_total) {
    // Legado: produto único
    const valorBase = params.orcamento.valor_total;
    const valorDesc = valorBase * (1 - DESCONTO_AVISTA);
    const { totalComTaxa, parcela } = calcularParcelamento(valorBase, taxa, nParcelas);

    doc.setFontSize(tpl.fonts.bodySize);
    doc.setFont(font, 'bold');
    doc.text('Produto:', ml, y);
    doc.setFont(font, 'normal');
    doc.text(`${params.produto.fabricante} — ${params.produto.linha}`, ml + 35, y);
    y += lh;
    doc.setFont(font, 'bold');
    doc.text('Área:', ml, y);
    doc.setFont(font, 'normal');
    doc.text(`${params.orcamento.area_com_perda?.toFixed(2) || params.orcamento.area_total} m²`, ml + 35, y);
    y += lh;
    doc.setFont(font, 'bold');
    doc.text('Preço:', ml, y);
    doc.setFont(font, 'normal');
    doc.text(`${formatCurrency(params.produto.preco_por_m2)}/m²`, ml + 35, y);
    y += gap;

    doc.setDrawColor(...primary);
    doc.line(ml, y, pageWidth - mr, y);
    y += gap;

    doc.setFontSize(tpl.fonts.subtitleSize);
    doc.setFont(font, 'bold');
    doc.text('CONDIÇÕES DE PAGAMENTO', ml, y);
    y += gap;

    doc.setFontSize(tpl.fonts.subtitleSize + 2);
    doc.setFont(font, 'bold');
    doc.setTextColor(...accent);
    doc.text(`${tpl.paymentSection.discountLabel} (5% desc.): ${formatCurrency(valorDesc)}`, ml, y);
    doc.setTextColor(0, 0, 0);
    y += lh + 2;

    doc.setFontSize(tpl.fonts.bodySize);
    doc.setFont(font, 'normal');
    doc.text(`${tpl.paymentSection.installmentLabel}: ${nParcelas}x de ${formatCurrency(parcela)}`, ml, y);
    y += lh;

    doc.setFontSize(tpl.fonts.smallSize);
    doc.setTextColor(128, 128, 128);
    doc.text(`Total: ${formatCurrency(totalComTaxa)}`, ml, y);
    doc.setTextColor(0, 0, 0);
    y += gap;
  }

  // ── FOOTER ──────────────────────────────────────────────
  y = checkPage(doc, y, 25);

  if (tpl.footer.style === 'bar') {
    doc.setFillColor(...primary);
    doc.rect(0, y, pageWidth, 0.8, 'F');
    y += 8;
  } else if (tpl.footer.style === 'line') {
    doc.setDrawColor(...(tpl.footer.separatorColor ? hexToRgb(tpl.footer.separatorColor) : primary));
    doc.setLineWidth(0.5);
    doc.line(ml, y, pageWidth - mr, y);
    doc.setLineWidth(0.2);
    y += 8;
  } else {
    y += 5;
  }

  doc.setFontSize(tpl.fonts.smallSize);
  doc.setFont(font, 'normal');
  doc.setTextColor(...secondary);

  const validDays = tpl.validityDays || 15;
  const footerContent = tpl.footer.text
    ? tpl.footer.text.replace('{validity_days}', String(validDays))
    : `Orçamento válido por ${validDays} dias. Medidas devem ser confirmadas no local. Valores sujeitos a alteração sem aviso prévio.`;

  const footerLines = doc.splitTextToSize(footerContent, contentWidth);
  const footerX = tpl.footer.alignment === 'center' ? pageWidth / 2
    : tpl.footer.alignment === 'right' ? pageWidth - mr : ml;
  doc.text(footerLines, footerX, y, { align: tpl.footer.alignment });
}

// ============================================================
// Função principal
// ============================================================

export function gerarPDF({
  atendimento, orcamento, produto, itens = [], produtosMap = {},
  numeroParcelas = 12, taxaJuros = 2, brandConfig, logoBase64, preview,
}: GerarPDFParams): string | void {
  const doc = new jsPDF();

  // 1. Se tem pdf_template, usar renderer genérico
  if (brandConfig?.pdf_template) {
    renderFromTemplate(doc, { atendimento, orcamento, produto, itens, produtosMap, numeroParcelas, taxaJuros }, brandConfig.pdf_template, logoBase64);

    if (preview) return String(doc.output('bloburl'));
    doc.save(`orcamento-${atendimento.cliente_nome.replace(/\s+/g, '-').toLowerCase()}.pdf`);
    return;
  }

  // 2. Fallback: layout básico
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO', pageWidth / 2, y, { align: 'center' });
  y += 12;

  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, pageWidth - 20, y);
  y += 12;

  // Cliente
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', 20, y);
  doc.setFont('helvetica', 'normal');
  doc.text(atendimento.cliente_nome, 55, y);
  y += 8;
  if (atendimento.cliente_telefone) {
    doc.setFont('helvetica', 'bold');
    doc.text('Telefone:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(atendimento.cliente_telefone, 55, y);
    y += 8;
  }
  const endereco = [atendimento.endereco, atendimento.numero, atendimento.complemento, atendimento.bairro, atendimento.cidade].filter(Boolean).join(', ');
  if (endereco) {
    doc.setFont('helvetica', 'bold');
    doc.text('Endereço:', 20, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(endereco, pageWidth - 75);
    doc.text(lines, 55, y);
    y += 8 * lines.length;
  }
  doc.setFont('helvetica', 'bold');
  doc.text('Serviço:', 20, y);
  doc.setFont('helvetica', 'normal');
  doc.text(atendimento.tipo_servico, 55, y);
  y += 12;

  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Itens
  if (itens.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(itens.length === 1 ? 'OPÇÃO DE PRODUTO' : 'OPÇÕES DE PRODUTOS', 20, y);
    y += 12;
    itens.forEach((item, idx) => {
      y = checkPage(doc, y, 50);
      const prod = item.produto_id ? produtosMap[item.produto_id] : null;
      const prodNome = prod ? `${prod.fabricante} — ${prod.linha}` : 'Produto';
      const valorDesc = item.valor_total * (1 - DESCONTO_AVISTA);
      const { totalComTaxa, parcela } = calcularParcelamento(item.valor_total, taxaJuros, numeroParcelas);
      doc.setFillColor(240, 240, 240);
      doc.rect(20, y - 4, pageWidth - 40, 8, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`OPÇÃO ${idx + 1}: ${prodNome}`, 22, y);
      y += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Área: ${item.area_total} m²  |  Preço: ${formatCurrency(item.preco_por_m2)}/m²`, 20, y);
      y += 8;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 128, 0);
      doc.text(`À VISTA (5% desc.): ${formatCurrency(valorDesc)}`, 20, y);
      doc.setTextColor(0, 0, 0);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.text(`Parcelado: ${numeroParcelas}x de ${formatCurrency(parcela)}`, 20, y);
      if (taxaJuros > 0) {
        doc.setTextColor(128, 128, 128);
        doc.text(` (${taxaJuros}% taxa)`, 20 + doc.getTextWidth(`Parcelado: ${numeroParcelas}x de ${formatCurrency(parcela)}`), y);
        doc.setTextColor(0, 0, 0);
      }
      y += 6;
      doc.setFontSize(9);
      doc.setTextColor(128, 128, 128);
      doc.text(`Total: ${formatCurrency(totalComTaxa)}`, 20, y);
      doc.setTextColor(0, 0, 0);
      y += 12;
    });
  } else if (produto && orcamento.area_total) {
    const valorDesc = orcamento.valor_total * (1 - DESCONTO_AVISTA);
    const { totalComTaxa, parcela } = calcularParcelamento(orcamento.valor_total, taxaJuros, numeroParcelas);
    doc.setFont('helvetica', 'bold');
    doc.text('Produto:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${produto.fabricante} — ${produto.linha}`, 55, y);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Área:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${orcamento.area_com_perda?.toFixed(2) || orcamento.area_total} m²`, 55, y);
    y += 12;
    doc.setDrawColor(200, 200, 200);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 128, 0);
    doc.text(`À VISTA (5% desc.): ${formatCurrency(valorDesc)}`, 20, y);
    doc.setTextColor(0, 0, 0);
    y += 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Parcelado: ${numeroParcelas}x de ${formatCurrency(parcela)}`, 20, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text(`Total: ${formatCurrency(totalComTaxa)}`, 20, y);
    doc.setTextColor(0, 0, 0);
    y += 12;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128, 128, 128);
  doc.text('Orçamento válido por 15 dias. Medidas devem ser confirmadas no local.', 20, y);
  y += 5;
  doc.text('Valores sujeitos a alteração sem aviso prévio.', 20, y);

  if (preview) return String(doc.output('bloburl'));
  doc.save(`orcamento-${atendimento.cliente_nome.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}
