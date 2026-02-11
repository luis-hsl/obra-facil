import { jsPDF } from 'jspdf';
import type { Orcamento, OrcamentoItem, Produto, Atendimento, BrandConfig } from '../types';
import { hexToRgb } from './imageUtils';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

// Taxa da maquininha: percentual simples sobre a venda
function calcularParcelamento(valorTotal: number, taxaMaquina: number, numParcelas: number) {
  const totalComTaxa = valorTotal * (1 + taxaMaquina / 100);
  const parcela = totalComTaxa / numParcelas;
  return { totalComTaxa, parcela };
}

interface GerarPDFParams {
  atendimento: Pick<Atendimento, 'cliente_nome' | 'cliente_telefone' | 'endereco' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'tipo_servico'>;
  orcamento: Orcamento;
  produto: Produto | null; // Legado
  itens?: OrcamentoItem[];
  produtosMap?: Record<string, Produto>;
  numeroParcelas?: number;
  taxaJuros?: number;
  brandConfig?: BrandConfig | null;
  logoBase64?: string | null;
}

const DESCONTO_AVISTA = 0.05; // 5% de desconto à vista

// ============================================================
// Helpers de layout
// ============================================================

function checkPage(doc: jsPDF, y: number, needed: number = 40): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage();
    return 20;
  }
  return y;
}

function renderClienteInfo(
  doc: jsPDF,
  atendimento: GerarPDFParams['atendimento'],
  startY: number,
  font: string,
) {
  let y = startY;
  doc.setFontSize(11);
  doc.setFont(font, 'bold');
  doc.text('Cliente:', 20, y);
  doc.setFont(font, 'normal');
  doc.text(atendimento.cliente_nome, 55, y);
  y += 8;

  if (atendimento.cliente_telefone) {
    doc.setFont(font, 'bold');
    doc.text('Telefone:', 20, y);
    doc.setFont(font, 'normal');
    doc.text(atendimento.cliente_telefone, 55, y);
    y += 8;
  }

  const enderecoCompleto = [
    atendimento.endereco,
    atendimento.numero,
    atendimento.complemento,
    atendimento.bairro,
    atendimento.cidade,
  ].filter(Boolean).join(', ');

  if (enderecoCompleto) {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFont(font, 'bold');
    doc.text('Endereço:', 20, y);
    doc.setFont(font, 'normal');
    const maxWidth = pageWidth - 75;
    const lines = doc.splitTextToSize(enderecoCompleto, maxWidth);
    doc.text(lines, 55, y);
    y += 8 * lines.length;
  }

  doc.setFont(font, 'bold');
  doc.text('Serviço:', 20, y);
  doc.setFont(font, 'normal');
  doc.text(atendimento.tipo_servico, 55, y);
  y += 12;

  return y;
}

function renderItens(
  doc: jsPDF,
  itens: OrcamentoItem[],
  produtosMap: Record<string, Produto>,
  numeroParcelas: number,
  taxaJuros: number,
  startY: number,
  font: string,
  accentColor: [number, number, number],
) {
  let y = startY;
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(12);
  doc.setFont(font, 'bold');
  doc.text(itens.length === 1 ? 'OPÇÃO DE PRODUTO' : 'OPÇÕES DE PRODUTOS', 20, y);
  y += 12;

  itens.forEach((item, index) => {
    y = checkPage(doc, y, 50);
    const prod = item.produto_id ? produtosMap[item.produto_id] : null;
    const prodNome = prod ? `${prod.fabricante} — ${prod.linha}` : 'Produto';

    const valorBase = item.valor_total;
    const valorComDesconto = valorBase * (1 - DESCONTO_AVISTA);
    const { totalComTaxa, parcela } = calcularParcelamento(valorBase, taxaJuros, numeroParcelas);

    doc.setFillColor(240, 240, 240);
    doc.rect(20, y - 4, pageWidth - 40, 8, 'F');
    doc.setFontSize(11);
    doc.setFont(font, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`OPÇÃO ${index + 1}: ${prodNome}`, 22, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont(font, 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`Área: ${item.area_total} m²  |  Preço: ${formatCurrency(item.preco_por_m2)}/m²`, 20, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont(font, 'bold');
    doc.setTextColor(...accentColor);
    doc.text(`À VISTA (5% desc.): ${formatCurrency(valorComDesconto)}`, 20, y);
    doc.setTextColor(0, 0, 0);
    y += 7;

    doc.setFont(font, 'normal');
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

  return y;
}

function renderLegado(
  doc: jsPDF,
  orcamento: Orcamento,
  produto: Produto,
  numeroParcelas: number,
  taxaJuros: number,
  startY: number,
  font: string,
  accentColor: [number, number, number],
  primaryColor: [number, number, number],
) {
  let y = startY;
  const pageWidth = doc.internal.pageSize.getWidth();
  const valorBase = orcamento.valor_total;
  const valorComDesconto = valorBase * (1 - DESCONTO_AVISTA);
  const { totalComTaxa, parcela } = calcularParcelamento(valorBase, taxaJuros, numeroParcelas);

  doc.setFont(font, 'bold');
  doc.text('Produto:', 20, y);
  doc.setFont(font, 'normal');
  doc.text(`${produto.fabricante} — ${produto.linha}`, 55, y);
  y += 8;

  doc.setFont(font, 'bold');
  doc.text('Área:', 20, y);
  doc.setFont(font, 'normal');
  doc.text(`${orcamento.area_com_perda?.toFixed(2) || orcamento.area_total} m²`, 55, y);
  y += 8;

  doc.setFont(font, 'bold');
  doc.text('Preço:', 20, y);
  doc.setFont(font, 'normal');
  doc.text(`${formatCurrency(produto.preco_por_m2)}/m²`, 55, y);
  y += 12;

  doc.setDrawColor(...primaryColor);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  doc.setFontSize(12);
  doc.setFont(font, 'bold');
  doc.text('CONDIÇÕES DE PAGAMENTO', 20, y);
  y += 10;

  doc.setFontSize(14);
  doc.setFont(font, 'bold');
  doc.setTextColor(...accentColor);
  doc.text(`À VISTA (5% desc.): ${formatCurrency(valorComDesconto)}`, 20, y);
  doc.setTextColor(0, 0, 0);
  y += 10;

  doc.setFontSize(12);
  doc.setFont(font, 'normal');
  doc.text(`Parcelado: ${numeroParcelas}x de ${formatCurrency(parcela)}`, 20, y);
  if (taxaJuros > 0) {
    doc.text(` (${taxaJuros}% taxa)`, 20 + doc.getTextWidth(`Parcelado: ${numeroParcelas}x de ${formatCurrency(parcela)}`), y);
  }
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(128, 128, 128);
  doc.text(`Total: ${formatCurrency(totalComTaxa)}`, 20, y);
  doc.setTextColor(0, 0, 0);
  y += 12;

  return y;
}

// ============================================================
// Layout CLASSIC
// ============================================================

function renderClassic(doc: jsPDF, params: GerarPDFParams, brand: BrandConfig, logoBase64?: string | null) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const font = brand.font_family;
  const primary = hexToRgb(brand.primary_color);
  const secondary = hexToRgb(brand.secondary_color);
  const accent = hexToRgb(brand.accent_color);
  let y = 15;

  // Header: logo + dados empresa
  const logoW = 35;
  const logoH = 20;
  if (logoBase64) {
    const format = logoBase64.includes('image/png') ? 'PNG' : 'JPEG';
    if (brand.logo_position === 'left') {
      doc.addImage(logoBase64, format, 20, y - 5, logoW, logoH);
    } else if (brand.logo_position === 'center') {
      doc.addImage(logoBase64, format, (pageWidth - logoW) / 2, y - 5, logoW, logoH);
    } else {
      doc.addImage(logoBase64, format, pageWidth - 20 - logoW, y - 5, logoW, logoH);
    }
  }

  // Dados empresa no lado oposto ao logo
  const infoX = brand.logo_position === 'left' ? pageWidth - 20 : 20;
  const infoAlign = brand.logo_position === 'left' ? 'right' as const : 'left' as const;
  doc.setFontSize(9);
  doc.setFont(font, 'normal');
  doc.setTextColor(...secondary);
  if (brand.company_name) {
    doc.setFont(font, 'bold');
    doc.setFontSize(11);
    doc.text(brand.company_name, infoX, y, { align: infoAlign });
    doc.setFont(font, 'normal');
    doc.setFontSize(9);
    y += 5;
  }
  if (brand.company_phone) { doc.text(brand.company_phone, infoX, y, { align: infoAlign }); y += 4; }
  if (brand.company_email) { doc.text(brand.company_email, infoX, y, { align: infoAlign }); y += 4; }
  if (brand.company_cnpj) { doc.text(`CNPJ: ${brand.company_cnpj}`, infoX, y, { align: infoAlign }); y += 4; }
  if (brand.company_address) {
    const addrLines = doc.splitTextToSize(brand.company_address, 80);
    doc.text(addrLines, infoX, y, { align: infoAlign });
    y += 4 * addrLines.length;
  }

  y = Math.max(y, logoBase64 ? 38 : y) + 4;

  // Linha separadora primária
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.8);
  doc.line(20, y, pageWidth - 20, y);
  doc.setLineWidth(0.2);
  y += 10;

  // Título
  doc.setFontSize(16);
  doc.setFont(font, 'bold');
  doc.setTextColor(...primary);
  doc.text('ORÇAMENTO', pageWidth / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 12;

  // Cliente info
  y = renderClienteInfo(doc, params.atendimento, y, font);

  // Separador
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);
  doc.setLineWidth(0.2);
  y += 10;

  // Produtos
  if (params.itens && params.itens.length > 0) {
    y = renderItens(doc, params.itens, params.produtosMap || {}, params.numeroParcelas || 12, params.taxaJuros || 2, y, font, accent);
  } else if (params.produto && params.orcamento.area_total) {
    y = renderLegado(doc, params.orcamento, params.produto, params.numeroParcelas || 12, params.taxaJuros || 2, y, font, accent, primary);
  }

  // Footer
  y = checkPage(doc, y, 30);
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);
  doc.setLineWidth(0.2);
  y += 8;

  doc.setFontSize(9);
  doc.setFont(font, 'normal');
  doc.setTextColor(...secondary);
  const validityDays = brand.validity_days || 15;
  if (brand.footer_text) {
    const footerText = brand.footer_text.replace('{validity_days}', String(validityDays));
    const footerLines = doc.splitTextToSize(footerText, pageWidth - 40);
    doc.text(footerLines, 20, y);
  } else {
    doc.text(`Orçamento válido por ${validityDays} dias. Medidas devem ser confirmadas no local.`, 20, y);
    y += 5;
    doc.text('Valores sujeitos a alteração sem aviso prévio.', 20, y);
  }
}

// ============================================================
// Layout MODERN
// ============================================================

function renderModern(doc: jsPDF, params: GerarPDFParams, brand: BrandConfig, logoBase64?: string | null) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const font = brand.font_family;
  const primary = hexToRgb(brand.primary_color);
  const accent = hexToRgb(brand.accent_color);
  const secondary = hexToRgb(brand.secondary_color);

  // Header bar colorida
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageWidth, 40, 'F');

  let y = 18;

  // Logo centralizado no header
  if (logoBase64) {
    const format = logoBase64.includes('image/png') ? 'PNG' : 'JPEG';
    const logoW = 30;
    const logoH = 18;
    if (brand.logo_position === 'center') {
      doc.addImage(logoBase64, format, (pageWidth - logoW) / 2, 10, logoW, logoH);
    } else if (brand.logo_position === 'left') {
      doc.addImage(logoBase64, format, 15, 10, logoW, logoH);
    } else {
      doc.addImage(logoBase64, format, pageWidth - 15 - logoW, 10, logoW, logoH);
    }
  }

  // Empresa name no header
  if (brand.company_name && !logoBase64) {
    doc.setFontSize(18);
    doc.setFont(font, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(brand.company_name, pageWidth / 2, 22, { align: 'center' });
  }

  // Subtítulo ORÇAMENTO
  doc.setFontSize(10);
  doc.setFont(font, 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text('ORÇAMENTO', pageWidth / 2, 34, { align: 'center' });

  y = 50;

  // Dados da empresa abaixo do header
  doc.setFontSize(8);
  doc.setFont(font, 'normal');
  doc.setTextColor(...secondary);
  const companyParts = [brand.company_phone, brand.company_email, brand.company_cnpj ? `CNPJ: ${brand.company_cnpj}` : null].filter(Boolean);
  if (companyParts.length > 0) {
    doc.text(companyParts.join('  |  '), pageWidth / 2, y, { align: 'center' });
    y += 8;
  }

  // Card do cliente (fundo arredondado)
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(15, y - 3, pageWidth - 30, 45, 3, 3, 'F');
  y += 5;
  doc.setTextColor(0, 0, 0);
  y = renderClienteInfo(doc, params.atendimento, y, font);
  y = Math.max(y, y) + 5;

  // Produtos
  if (params.itens && params.itens.length > 0) {
    y = renderItens(doc, params.itens, params.produtosMap || {}, params.numeroParcelas || 12, params.taxaJuros || 2, y, font, accent);
  } else if (params.produto && params.orcamento.area_total) {
    y = renderLegado(doc, params.orcamento, params.produto, params.numeroParcelas || 12, params.taxaJuros || 2, y, font, accent, primary);
  }

  // Footer
  y = checkPage(doc, y, 25);
  doc.setFillColor(...primary);
  doc.rect(0, y + 5, pageWidth, 0.5, 'F');
  y += 14;

  doc.setFontSize(8);
  doc.setFont(font, 'normal');
  doc.setTextColor(...secondary);
  const validityDays = brand.validity_days || 15;
  if (brand.footer_text) {
    const footerText = brand.footer_text.replace('{validity_days}', String(validityDays));
    const footerLines = doc.splitTextToSize(footerText, pageWidth - 40);
    doc.text(footerLines, pageWidth / 2, y, { align: 'center' });
  } else {
    doc.text(`Orçamento válido por ${validityDays} dias. Medidas devem ser confirmadas no local.`, pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text('Valores sujeitos a alteração sem aviso prévio.', pageWidth / 2, y, { align: 'center' });
  }
}

// ============================================================
// Layout MINIMAL
// ============================================================

function renderMinimal(doc: jsPDF, params: GerarPDFParams, brand: BrandConfig, logoBase64?: string | null) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const font = brand.font_family;
  const primary = hexToRgb(brand.primary_color);
  const secondary = hexToRgb(brand.secondary_color);
  const accent = hexToRgb(brand.accent_color);
  let y = 20;

  // Logo pequeno + nome da empresa
  if (logoBase64) {
    const format = logoBase64.includes('image/png') ? 'PNG' : 'JPEG';
    doc.addImage(logoBase64, format, 20, y - 5, 20, 12);
    if (brand.company_name) {
      doc.setFontSize(12);
      doc.setFont(font, 'bold');
      doc.setTextColor(...primary);
      doc.text(brand.company_name, 45, y + 2);
    }
  } else if (brand.company_name) {
    doc.setFontSize(14);
    doc.setFont(font, 'bold');
    doc.setTextColor(...primary);
    doc.text(brand.company_name, 20, y);
  }

  // Info mínima no canto direito
  doc.setFontSize(8);
  doc.setFont(font, 'normal');
  doc.setTextColor(...secondary);
  let infoY = y - 2;
  if (brand.company_phone) { doc.text(brand.company_phone, pageWidth - 20, infoY, { align: 'right' }); infoY += 4; }
  if (brand.company_email) { doc.text(brand.company_email, pageWidth - 20, infoY, { align: 'right' }); infoY += 4; }

  y = Math.max(y + 12, infoY + 4);

  // Linha fina
  doc.setDrawColor(...secondary);
  doc.setLineWidth(0.3);
  doc.line(20, y, pageWidth - 20, y);
  doc.setLineWidth(0.2);
  y += 15;

  // Título discreto
  doc.setFontSize(12);
  doc.setFont(font, 'normal');
  doc.setTextColor(...secondary);
  doc.text('Orçamento', 20, y);
  y += 12;

  // Cliente
  doc.setTextColor(0, 0, 0);
  y = renderClienteInfo(doc, params.atendimento, y, font);
  y += 5;

  // Linha fina
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Produtos
  if (params.itens && params.itens.length > 0) {
    y = renderItens(doc, params.itens, params.produtosMap || {}, params.numeroParcelas || 12, params.taxaJuros || 2, y, font, accent);
  } else if (params.produto && params.orcamento.area_total) {
    y = renderLegado(doc, params.orcamento, params.produto, params.numeroParcelas || 12, params.taxaJuros || 2, y, font, accent, primary);
  }

  // Footer minimalista
  y = checkPage(doc, y, 20);
  y += 10;
  doc.setFontSize(8);
  doc.setFont(font, 'normal');
  doc.setTextColor(180, 180, 180);
  const validityDays = brand.validity_days || 15;
  if (brand.footer_text) {
    const footerText = brand.footer_text.replace('{validity_days}', String(validityDays));
    const footerLines = doc.splitTextToSize(footerText, pageWidth - 40);
    doc.text(footerLines, 20, y);
  } else {
    doc.text(`Válido por ${validityDays} dias  ·  Medidas a confirmar no local  ·  Valores sujeitos a alteração`, 20, y);
  }
}

// ============================================================
// Função principal
// ============================================================

export function gerarPDF({
  atendimento, orcamento, produto, itens = [], produtosMap = {},
  numeroParcelas = 12, taxaJuros = 2, brandConfig, logoBase64,
}: GerarPDFParams) {
  const doc = new jsPDF();

  // Se tem brand config, usar layout personalizado
  if (brandConfig) {
    switch (brandConfig.layout_style) {
      case 'modern':
        renderModern(doc, { atendimento, orcamento, produto, itens, produtosMap, numeroParcelas, taxaJuros }, brandConfig, logoBase64);
        break;
      case 'minimal':
        renderMinimal(doc, { atendimento, orcamento, produto, itens, produtosMap, numeroParcelas, taxaJuros }, brandConfig, logoBase64);
        break;
      case 'classic':
      default:
        renderClassic(doc, { atendimento, orcamento, produto, itens, produtosMap, numeroParcelas, taxaJuros }, brandConfig, logoBase64);
        break;
    }

    const nomeArquivo = `orcamento-${atendimento.cliente_nome.replace(/\s+/g, '-').toLowerCase()}.pdf`;
    doc.save(nomeArquivo);
    return;
  }

  // ============================================================
  // Fallback: layout original (sem brand config)
  // ============================================================

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Título
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO', pageWidth / 2, y, { align: 'center' });
  y += 12;

  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, pageWidth - 20, y);
  y += 12;

  // Cliente
  y = renderClienteInfo(doc, atendimento, y, 'helvetica');

  // Linha separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Se tem itens (novo formato com múltiplos produtos como opções)
  if (itens.length > 0) {
    y = renderItens(doc, itens, produtosMap, numeroParcelas, taxaJuros, y, 'helvetica', [0, 128, 0]);
  } else if (produto && orcamento.area_total) {
    y = renderLegado(doc, orcamento, produto, numeroParcelas, taxaJuros, y, 'helvetica', [0, 128, 0], [200, 200, 200]);
  }

  // Linha final
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Observação
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128, 128, 128);
  doc.text('Orçamento válido por 15 dias. Medidas devem ser confirmadas no local.', 20, y);
  y += 5;
  doc.text('Valores sujeitos a alteração sem aviso prévio.', 20, y);

  // Salvar
  const nomeArquivo = `orcamento-${atendimento.cliente_nome.replace(/\s+/g, '-').toLowerCase()}.pdf`;
  doc.save(nomeArquivo);
}
