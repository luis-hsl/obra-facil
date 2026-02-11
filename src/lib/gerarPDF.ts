import { jsPDF } from 'jspdf';
import type { Orcamento, OrcamentoItem, Produto, Atendimento, BrandConfig } from '../types';

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
// HTML Template renderer (async - uses jsPDF.html + html2canvas)
// ============================================================

function fillHtmlTemplate(params: GerarPDFParams): string {
  const { atendimento, brandConfig, logoBase64 } = params;
  const htmlTemplate = brandConfig?.html_template || '';
  const productTemplate = brandConfig?.product_html_template || '';

  const endereco = [
    atendimento.endereco, atendimento.numero,
    atendimento.complemento, atendimento.bairro,
    atendimento.cidade,
  ].filter(Boolean).join(', ');

  const hoje = new Date().toLocaleDateString('pt-BR');
  const validityDays = brandConfig?.validity_days || 15;

  // Build logo img tag
  const logoImg = logoBase64
    ? `<img src="${logoBase64}" style="max-height:60px;max-width:180px;object-fit:contain;" />`
    : '';

  // Build products section HTML
  const itemList = params.itens && params.itens.length > 0 ? params.itens : [];
  const nParcelas = params.numeroParcelas || 12;
  const taxa = params.taxaJuros || 2;

  let productsHtml = '';

  if (itemList.length > 0 && productTemplate) {
    productsHtml = itemList.map((item, idx) => {
      const prod = item.produto_id ? (params.produtosMap || {})[item.produto_id] : null;
      const prodNome = prod ? `${prod.fabricante} — ${prod.linha}` : 'Produto';
      const valorDesc = item.valor_total * (1 - DESCONTO_AVISTA);
      const { totalComTaxa, parcela } = calcularParcelamento(item.valor_total, taxa, nParcelas);
      const taxaText = taxa > 0 ? ` (${taxa}% taxa)` : '';

      return productTemplate
        .replace(/%%OPTION_NUMBER%%/g, String(idx + 1))
        .replace(/%%PRODUCT_NAME%%/g, prodNome)
        .replace(/%%AREA%%/g, String(item.area_total))
        .replace(/%%PRICE_M2%%/g, formatCurrency(item.preco_por_m2))
        .replace(/%%DISCOUNT_VALUE%%/g, formatCurrency(valorDesc))
        .replace(/%%INSTALLMENT_TEXT%%/g, `${nParcelas}x de ${formatCurrency(parcela)}${taxaText}`)
        .replace(/%%TOTAL_TEXT%%/g, `Total: ${formatCurrency(totalComTaxa)}`);
    }).join('\n');
  } else if (params.produto && params.orcamento.area_total) {
    // Legado: produto único
    const valorDesc = params.orcamento.valor_total * (1 - DESCONTO_AVISTA);
    const { totalComTaxa, parcela } = calcularParcelamento(params.orcamento.valor_total, taxa, nParcelas);
    const taxaText = taxa > 0 ? ` (${taxa}% taxa)` : '';

    if (productTemplate) {
      productsHtml = productTemplate
        .replace(/%%OPTION_NUMBER%%/g, '1')
        .replace(/%%PRODUCT_NAME%%/g, `${params.produto.fabricante} — ${params.produto.linha}`)
        .replace(/%%AREA%%/g, String(params.orcamento.area_com_perda?.toFixed(2) || params.orcamento.area_total))
        .replace(/%%PRICE_M2%%/g, formatCurrency(params.produto.preco_por_m2))
        .replace(/%%DISCOUNT_VALUE%%/g, formatCurrency(valorDesc))
        .replace(/%%INSTALLMENT_TEXT%%/g, `${nParcelas}x de ${formatCurrency(parcela)}${taxaText}`)
        .replace(/%%TOTAL_TEXT%%/g, `Total: ${formatCurrency(totalComTaxa)}`);
    }
  }

  // Fill main template
  let html = htmlTemplate
    .replace(/%%LOGO_IMG%%/g, logoImg)
    .replace(/%%COMPANY_NAME%%/g, brandConfig?.company_name || '')
    .replace(/%%COMPANY_CNPJ%%/g, brandConfig?.company_cnpj || '')
    .replace(/%%COMPANY_PHONE%%/g, brandConfig?.company_phone || '')
    .replace(/%%COMPANY_EMAIL%%/g, brandConfig?.company_email || '')
    .replace(/%%COMPANY_ADDRESS%%/g, brandConfig?.company_address || '')
    .replace(/%%CLIENT_NAME%%/g, atendimento.cliente_nome)
    .replace(/%%CLIENT_PHONE%%/g, atendimento.cliente_telefone || '')
    .replace(/%%CLIENT_ADDRESS%%/g, endereco)
    .replace(/%%SERVICE_TYPE%%/g, atendimento.tipo_servico)
    .replace(/%%DATE%%/g, hoje)
    .replace(/%%PRODUCTS_SECTION%%/g, productsHtml)
    .replace(/%%FOOTER_TEXT%%/g, brandConfig?.footer_text || '')
    .replace(/%%VALIDITY_DAYS%%/g, String(validityDays));

  return html;
}

async function renderFromHtmlTemplate(
  params: GerarPDFParams,
): Promise<string | void> {
  const filledHtml = fillHtmlTemplate(params);

  if (!filledHtml || filledHtml.trim().length < 10) {
    console.warn('HTML template is empty, falling back to basic layout');
    return renderBasicLayout(params);
  }

  // Create hidden container (must be visible to html2canvas, just off-screen)
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.background = '#fff';
  container.innerHTML = filledHtml;
  document.body.appendChild(container);

  // Wait a frame for the browser to render the HTML
  await new Promise(r => requestAnimationFrame(r));

  try {
    const doc = new jsPDF('p', 'mm', 'a4');

    // Use callback-based approach to ensure html2canvas completes
    await new Promise<void>((resolve, reject) => {
      try {
        doc.html(container, {
          callback: () => resolve(),
          x: 0,
          y: 0,
          width: 210,
          windowWidth: 794,
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
          },
        });
      } catch (err) {
        reject(err);
      }
    });

    if (params.preview) {
      return String(doc.output('bloburl'));
    }
    doc.save(`orcamento-${params.atendimento.cliente_nome.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  } catch (err) {
    console.error('HTML template rendering failed, falling back:', err);
    return renderBasicLayout(params);
  } finally {
    document.body.removeChild(container);
  }
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

// ============================================================
// Função principal (async)
// ============================================================

export async function gerarPDF(params: GerarPDFParams): Promise<string | void> {
  // 1. Se tem html_template, usar HTML renderer (mais fiel ao original)
  if (params.brandConfig?.html_template && params.brandConfig?.product_html_template) {
    return renderFromHtmlTemplate(params);
  }

  // 2. Fallback: layout básico
  return renderBasicLayout(params);
}

// Export helper for preview HTML directly (used by MarcaConfig)
export function getFilledHtml(params: GerarPDFParams): string {
  return fillHtmlTemplate(params);
}
