import { jsPDF } from 'jspdf';
import type { Orcamento, OrcamentoItem, Produto, Atendimento } from '../types';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface GerarPDFParams {
  atendimento: Pick<Atendimento, 'cliente_nome' | 'cliente_telefone' | 'endereco' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'tipo_servico'>;
  orcamento: Orcamento;
  produto: Produto | null; // Legado
  itens?: OrcamentoItem[];
  produtosMap?: Record<string, Produto>;
}

export function gerarPDF({ atendimento, orcamento, produto, itens = [], produtosMap = {} }: GerarPDFParams) {
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
    // Quebrar texto longo
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

  // Se tem itens (novo formato com múltiplos produtos)
  if (itens.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('PRODUTOS', 20, y);
    y += 10;

    itens.forEach((item, index) => {
      const prod = item.produto_id ? produtosMap[item.produto_id] : null;
      const prodNome = prod ? `${prod.fabricante} — ${prod.linha}` : 'Produto';

      // Número e nome do produto
      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${prodNome}`, 20, y);
      y += 7;

      doc.setFont('helvetica', 'normal');
      doc.text(`   Área: ${item.area_total} m² + ${item.perda_percentual}% perda = ${item.area_com_perda.toFixed(2)} m²`, 20, y);
      y += 6;
      doc.text(`   Preço: ${formatCurrency(item.preco_por_m2)}/m²`, 20, y);
      y += 6;

      doc.setFont('helvetica', 'bold');
      doc.text(`   Subtotal: ${formatCurrency(item.valor_total)}`, 20, y);
      doc.setFont('helvetica', 'normal');
      y += 10;

      // Verificar se precisa de nova página
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
    });

  } else if (produto && orcamento.area_total) {
    // Formato legado (produto único no orçamento)
    doc.setFont('helvetica', 'bold');
    doc.text('Produto:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${produto.fabricante} — ${produto.linha}`, 55, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.text('Preço:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${formatCurrency(produto.preco_por_m2)}/m²`, 55, y);
    y += 12;

    doc.setDrawColor(200, 200, 200);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('Cálculo', 20, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.text(`Área informada: ${orcamento.area_total} m²`, 20, y);
    y += 7;
    if (orcamento.perda_percentual !== null && orcamento.perda_percentual !== undefined) {
      doc.text(`Perda aplicada: ${orcamento.perda_percentual}%`, 20, y);
      y += 7;
    }
    if (orcamento.area_com_perda) {
      doc.text(`Área final (com perda): ${orcamento.area_com_perda.toFixed(2)} m²`, 20, y);
      y += 7;
      doc.text(`${orcamento.area_com_perda.toFixed(2)} m² x ${formatCurrency(produto.preco_por_m2)}/m²`, 20, y);
      y += 10;
    }
  }

  // Total
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL À VISTA: ${formatCurrency(orcamento.valor_total)}`, 20, y);
  y += 12;

  // Condições de pagamento parcelado
  if (orcamento.forma_pagamento === 'parcelado' && orcamento.valor_parcela && orcamento.valor_total_parcelado) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('OPÇÃO PARCELADA:', 20, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    const parcelaText = `${orcamento.numero_parcelas}x de ${formatCurrency(orcamento.valor_parcela)}`;
    const jurosText = orcamento.taxa_juros_mensal > 0 ? ` (${orcamento.taxa_juros_mensal}% a.m.)` : ' (sem juros)';
    doc.text(`${parcelaText}${jurosText}`, 20, y);
    y += 7;

    doc.text(`Total parcelado: ${formatCurrency(orcamento.valor_total_parcelado)}`, 20, y);
    y += 7;

    if (orcamento.valor_total_parcelado > orcamento.valor_total) {
      const juros = orcamento.valor_total_parcelado - orcamento.valor_total;
      doc.setTextColor(128, 128, 128);
      doc.text(`Juros: ${formatCurrency(juros)}`, 20, y);
      doc.setTextColor(0, 0, 0);
      y += 7;
    }
  }

  y += 10;

  // Observação
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128, 128, 128);
  doc.text('Orçamento válido por 15 dias. Medidas devem ser confirmadas no local.', 20, y);

  // Salvar
  const nomeArquivo = `orcamento-${atendimento.cliente_nome.replace(/\s+/g, '-').toLowerCase()}.pdf`;
  doc.save(nomeArquivo);
}
