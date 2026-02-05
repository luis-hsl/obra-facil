import { jsPDF } from 'jspdf';
import type { Orcamento, OrcamentoItem, Produto, Atendimento } from '../types';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function calcularParcela(valorTotal: number, taxaMensal: number, numParcelas: number): number {
  if (taxaMensal === 0) return valorTotal / numParcelas;
  const i = taxaMensal / 100;
  const n = numParcelas;
  return valorTotal * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
}

interface GerarPDFParams {
  atendimento: Pick<Atendimento, 'cliente_nome' | 'cliente_telefone' | 'endereco' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'tipo_servico'>;
  orcamento: Orcamento;
  produto: Produto | null; // Legado
  itens?: OrcamentoItem[];
  produtosMap?: Record<string, Produto>;
  numeroParcelas?: number;
  taxaJuros?: number;
}

const DESCONTO_AVISTA = 0.05; // 5% de desconto à vista

export function gerarPDF({ atendimento, orcamento, produto, itens = [], produtosMap = {}, numeroParcelas = 12, taxaJuros = 2 }: GerarPDFParams) {
  const doc = new jsPDF();
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

  const enderecoCompleto = [
    atendimento.endereco,
    atendimento.numero,
    atendimento.complemento,
    atendimento.bairro,
    atendimento.cidade,
  ].filter(Boolean).join(', ');

  if (enderecoCompleto) {
    doc.setFont('helvetica', 'bold');
    doc.text('Endereço:', 20, y);
    doc.setFont('helvetica', 'normal');
    const maxWidth = pageWidth - 75;
    const lines = doc.splitTextToSize(enderecoCompleto, maxWidth);
    doc.text(lines, 55, y);
    y += 8 * lines.length;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Serviço:', 20, y);
  doc.setFont('helvetica', 'normal');
  doc.text(atendimento.tipo_servico, 55, y);
  y += 12;

  // Linha separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  // Se tem itens (novo formato com múltiplos produtos como opções)
  if (itens.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(itens.length === 1 ? 'OPÇÃO DE PRODUTO' : 'OPÇÕES DE PRODUTOS', 20, y);
    y += 12;

    itens.forEach((item, index) => {
      const prod = item.produto_id ? produtosMap[item.produto_id] : null;
      const prodNome = prod ? `${prod.fabricante} — ${prod.linha}` : 'Produto';

      // Cálculos
      const valorBase = item.valor_total;
      const valorComDesconto = valorBase * (1 - DESCONTO_AVISTA);
      const parcela = calcularParcela(valorBase, taxaJuros, numeroParcelas);
      const totalParcelado = parcela * numeroParcelas;

      // Cabeçalho da opção
      doc.setFillColor(240, 240, 240);
      doc.rect(20, y - 4, pageWidth - 40, 8, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`OPÇÃO ${index + 1}: ${prodNome}`, 22, y);
      y += 10;

      // Detalhes
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Área: ${item.area_total} m²  |  Preço: ${formatCurrency(item.preco_por_m2)}/m²`, 20, y);
      y += 8;

      // À vista com desconto
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 128, 0);
      doc.text(`À VISTA (5% desc.): ${formatCurrency(valorComDesconto)}`, 20, y);
      doc.setTextColor(0, 0, 0);
      y += 7;

      // Parcelado
      doc.setFont('helvetica', 'normal');
      doc.text(`Parcelado: ${numeroParcelas}x de ${formatCurrency(parcela)}`, 20, y);
      if (taxaJuros > 0) {
        doc.setTextColor(128, 128, 128);
        doc.text(` (${taxaJuros}% a.m.)`, 20 + doc.getTextWidth(`Parcelado: ${numeroParcelas}x de ${formatCurrency(parcela)}`), y);
        doc.setTextColor(0, 0, 0);
      }
      y += 6;

      doc.setFontSize(9);
      doc.setTextColor(128, 128, 128);
      doc.text(`Total parcelado: ${formatCurrency(totalParcelado)}`, 20, y);
      doc.setTextColor(0, 0, 0);
      y += 12;

      // Verificar se precisa de nova página
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
    });

  } else if (produto && orcamento.area_total) {
    // Formato legado (produto único no orçamento)
    const valorBase = orcamento.valor_total;
    const valorComDesconto = valorBase * (1 - DESCONTO_AVISTA);
    const parcela = calcularParcela(valorBase, taxaJuros, numeroParcelas);
    const totalParcelado = parcela * numeroParcelas;

    doc.setFont('helvetica', 'bold');
    doc.text('Produto:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${produto.fabricante} — ${produto.linha}`, 55, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.text('Área:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${orcamento.area_com_perda?.toFixed(2) || orcamento.area_total} m²`, 55, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.text('Preço:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${formatCurrency(produto.preco_por_m2)}/m²`, 55, y);
    y += 12;

    // Linha separadora
    doc.setDrawColor(200, 200, 200);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;

    // Condições de pagamento
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('CONDIÇÕES DE PAGAMENTO', 20, y);
    y += 10;

    // À vista com desconto
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 128, 0);
    doc.text(`À VISTA (5% desc.): ${formatCurrency(valorComDesconto)}`, 20, y);
    doc.setTextColor(0, 0, 0);
    y += 10;

    // Parcelado
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Parcelado: ${numeroParcelas}x de ${formatCurrency(parcela)}`, 20, y);
    if (taxaJuros > 0) {
      doc.text(` (${taxaJuros}% a.m.)`, 20 + doc.getTextWidth(`Parcelado: ${numeroParcelas}x de ${formatCurrency(parcela)}`), y);
    }
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text(`Total parcelado: ${formatCurrency(totalParcelado)}`, 20, y);
    doc.setTextColor(0, 0, 0);
    y += 12;
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
