import { jsPDF } from 'jspdf';
import type { Orcamento, OrcamentoItem, Produto, Atendimento, BrandConfig, OverlayTemplate } from '../types';
import { hexToRgb, fetchImageAsBase64 } from './imageUtils';

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
// Overlay renderer — fundo do PDF original + texto sobreposto
// ============================================================

async function renderWithOverlay(
  params: GerarPDFParams,
  tpl: OverlayTemplate,
  bgImageUrl: string,
): Promise<string | void> {
  // Fetch background image
  const bgBase64 = await fetchImageAsBase64(bgImageUrl);

  const doc = new jsPDF('p', 'mm', 'a4');
  const font = tpl.fontFamily;

  // 1. Draw background (full A4 page)
  doc.addImage(bgBase64, 'JPEG', 0, 0, 210, 297);

  // 2. Erase dynamic zones (draw colored rects over sample data)
  for (const zone of tpl.erase) {
    doc.setFillColor(...hexToRgb(zone.color));
    doc.rect(zone.x, zone.y, zone.w, zone.h, 'F');
  }

  // 3. Write client info
  const { atendimento } = params;
  const cl = tpl.client;
  let y = cl.y;

  doc.setFont(font, 'normal');
  doc.setFontSize(cl.fontSize);
  doc.setTextColor(...hexToRgb(cl.fontColor));

  // Cliente
  if (cl.labelBold) doc.setFont(font, 'bold');
  doc.text('Cliente: ', cl.x, y);
  doc.setFont(font, 'normal');
  doc.text(atendimento.cliente_nome, cl.x + doc.getTextWidth('Cliente: '), y);
  y += cl.lineHeight;

  // Telefone
  if (atendimento.cliente_telefone) {
    if (cl.labelBold) doc.setFont(font, 'bold');
    doc.text('Telefone: ', cl.x, y);
    doc.setFont(font, 'normal');
    doc.text(atendimento.cliente_telefone, cl.x + doc.getTextWidth('Telefone: '), y);
    y += cl.lineHeight;
  }

  // Endereço
  const endereco = [
    atendimento.endereco, atendimento.numero,
    atendimento.complemento, atendimento.bairro, atendimento.cidade,
  ].filter(Boolean).join(', ');
  if (endereco) {
    if (cl.labelBold) doc.setFont(font, 'bold');
    doc.text('Endereço: ', cl.x, y);
    doc.setFont(font, 'normal');
    const labelW = doc.getTextWidth('Endereço: ');
    const lines = doc.splitTextToSize(endereco, 170 - labelW);
    doc.text(lines, cl.x + labelW, y);
    y += cl.lineHeight * lines.length;
  }

  // Serviço
  if (cl.labelBold) doc.setFont(font, 'bold');
  doc.text('Serviço: ', cl.x, y);
  doc.setFont(font, 'normal');
  doc.text(atendimento.tipo_servico, cl.x + doc.getTextWidth('Serviço: '), y);

  // 4. Write products
  const pr = tpl.products;
  const itemList = params.itens && params.itens.length > 0 ? params.itens : [];
  const nParcelas = params.numeroParcelas || 12;
  const taxa = params.taxaJuros || 2;
  y = pr.y;

  if (itemList.length > 0) {
    itemList.forEach((item, idx) => {
      if (y > pr.maxY) return; // don't overflow

      const prod = item.produto_id ? (params.produtosMap || {})[item.produto_id] : null;
      const prodNome = prod ? `${prod.fabricante} — ${prod.linha}` : 'Produto';
      const valorDesc = item.valor_total * (1 - DESCONTO_AVISTA);
      const { totalComTaxa, parcela } = calcularParcelamento(item.valor_total, taxa, nParcelas);
      const taxaText = taxa > 0 ? ` (${taxa}% taxa)` : '';

      // Title
      doc.setFontSize(pr.titleFontSize);
      doc.setFont(font, 'bold');
      doc.setTextColor(...hexToRgb(pr.titleColor));
      doc.text(`OPÇÃO ${idx + 1}: ${prodNome}`, pr.x, y);
      y += pr.lineHeight;

      // Area / Price
      doc.setFontSize(pr.fontSize);
      doc.setFont(font, 'normal');
      doc.setTextColor(...hexToRgb(pr.fontColor));
      doc.text(`Área: ${item.area_total} m²  |  Preço: ${formatCurrency(item.preco_por_m2)}/m²`, pr.x, y);
      y += pr.lineHeight;

      // À vista
      doc.setFont(font, 'bold');
      doc.setTextColor(...hexToRgb(pr.priceColor));
      doc.text(`À VISTA (5% desc.): ${formatCurrency(valorDesc)}`, pr.x, y);
      y += pr.lineHeight;

      // Parcelado
      doc.setFont(font, 'normal');
      doc.setTextColor(...hexToRgb(pr.fontColor));
      doc.text(`Parcelado: ${nParcelas}x de ${formatCurrency(parcela)}${taxaText}`, pr.x, y);
      y += pr.lineHeight - 1;

      // Total
      doc.setFontSize(pr.fontSize - 1);
      doc.setTextColor(128, 128, 128);
      doc.text(`Total: ${formatCurrency(totalComTaxa)}`, pr.x, y);
      doc.setTextColor(0, 0, 0);
      y += pr.itemSpacing;
    });
  } else if (params.produto && params.orcamento.area_total) {
    // Legado: produto único
    const valorDesc = params.orcamento.valor_total * (1 - DESCONTO_AVISTA);
    const { totalComTaxa, parcela } = calcularParcelamento(params.orcamento.valor_total, taxa, nParcelas);

    doc.setFontSize(pr.fontSize);
    doc.setFont(font, 'bold');
    doc.setTextColor(...hexToRgb(pr.fontColor));
    doc.text(`${params.produto.fabricante} — ${params.produto.linha}`, pr.x, y);
    y += pr.lineHeight;
    doc.setFont(font, 'normal');
    doc.text(`Área: ${params.orcamento.area_com_perda?.toFixed(2) || params.orcamento.area_total} m²  |  ${formatCurrency(params.produto.preco_por_m2)}/m²`, pr.x, y);
    y += pr.lineHeight + 2;

    doc.setFont(font, 'bold');
    doc.setTextColor(...hexToRgb(pr.priceColor));
    doc.text(`À VISTA (5% desc.): ${formatCurrency(valorDesc)}`, pr.x, y);
    y += pr.lineHeight;

    doc.setFont(font, 'normal');
    doc.setTextColor(...hexToRgb(pr.fontColor));
    doc.text(`Parcelado: ${nParcelas}x de ${formatCurrency(parcela)}`, pr.x, y);
    y += pr.lineHeight;

    doc.setFontSize(pr.fontSize - 1);
    doc.setTextColor(128, 128, 128);
    doc.text(`Total: ${formatCurrency(totalComTaxa)}`, pr.x, y);
  }

  // 5. Write footer
  const ft = tpl.footer;
  const validDays = tpl.validityDays || 15;
  const footerContent = tpl.footerText
    || `Orçamento válido por ${validDays} dias. Medidas devem ser confirmadas no local. Valores sujeitos a alteração sem aviso prévio.`;

  doc.setFontSize(ft.fontSize);
  doc.setFont(font, 'normal');
  doc.setTextColor(...hexToRgb(ft.fontColor));

  const footerLines = doc.splitTextToSize(footerContent, ft.w);
  const ftX = ft.align === 'center' ? ft.x + ft.w / 2
    : ft.align === 'right' ? ft.x + ft.w : ft.x;
  doc.text(footerLines, ftX, ft.y, { align: ft.align });

  // Output
  if (params.preview) {
    return String(doc.output('bloburl'));
  }
  doc.save(`orcamento-${params.atendimento.cliente_nome.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

// ============================================================
// Helpers (for fallback renderer)
// ============================================================

function checkPage(doc: jsPDF, y: number, needed: number = 40, marginBottom = 20): number {
  if (y + needed > doc.internal.pageSize.getHeight() - marginBottom) {
    doc.addPage();
    return 20;
  }
  return y;
}

// ============================================================
// Fallback: layout básico (sem template)
// ============================================================

function renderBasicLayout(params: GerarPDFParams): string | void {
  const { atendimento, orcamento, produto, itens = [], produtosMap = {},
    numeroParcelas = 12, taxaJuros = 2, preview } = params;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO', pageWidth / 2, y, { align: 'center' });
  y += 12;

  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, pageWidth - 20, y);
  y += 12;

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

// ============================================================
// Função principal (async)
// ============================================================

export async function gerarPDF(params: GerarPDFParams): Promise<string | void> {
  const bc = params.brandConfig;

  // 1. Overlay approach: fundo original + zonas de texto
  if (bc?.overlay_template && bc?.background_image_url) {
    try {
      return await renderWithOverlay(params, bc.overlay_template, bc.background_image_url);
    } catch (err) {
      console.error('Overlay rendering failed, falling back:', err);
    }
  }

  // 2. Fallback: layout básico
  return renderBasicLayout(params);
}
