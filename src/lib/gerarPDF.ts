import { jsPDF } from 'jspdf';
import type { Orcamento, Produto, Atendimento, Cliente, Imovel } from '../types';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface GerarPDFParams {
  cliente: Pick<Cliente, 'nome' | 'telefone' | 'email'>;
  imovel: Pick<Imovel, 'endereco'> | null;
  atendimento: Pick<Atendimento, 'tipo_servico'>;
  orcamento: Orcamento;
  produto: Produto | null;
}

export function gerarPDF({ cliente, imovel, atendimento, orcamento, produto }: GerarPDFParams) {
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
  doc.text(cliente.nome, 55, y);
  y += 8;

  if (cliente.telefone) {
    doc.setFont('helvetica', 'bold');
    doc.text('Telefone:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(cliente.telefone, 55, y);
    y += 8;
  }

  if (cliente.email) {
    doc.setFont('helvetica', 'bold');
    doc.text('E-mail:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(cliente.email, 55, y);
    y += 8;
  }

  if (imovel) {
    doc.setFont('helvetica', 'bold');
    doc.text('Endereço:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(imovel.endereco, 55, y);
    y += 8;
  }

  if (atendimento.tipo_servico) {
    doc.setFont('helvetica', 'bold');
    doc.text('Serviço:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(atendimento.tipo_servico, 55, y);
    y += 8;
  }

  y += 6;

  // Produto
  if (produto) {
    doc.setDrawColor(200, 200, 200);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('Produto:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${produto.fabricante} — ${produto.linha}`, 55, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.text('Preço:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${formatCurrency(produto.preco_por_m2)}/m²`, 55, y);
    y += 8;
  }

  y += 6;

  // Cálculo
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.text('Cálculo', 20, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  if (orcamento.area_total) {
    doc.text(`Área informada: ${orcamento.area_total} m²`, 20, y);
    y += 7;
  }
  if (orcamento.perda_percentual !== null && orcamento.perda_percentual !== undefined) {
    doc.text(`Perda aplicada: ${orcamento.perda_percentual}%`, 20, y);
    y += 7;
  }
  if (orcamento.area_com_perda) {
    doc.text(`Área final (com perda): ${orcamento.area_com_perda.toFixed(2)} m²`, 20, y);
    y += 7;
  }
  if (orcamento.area_com_perda && produto) {
    doc.text(`${orcamento.area_com_perda.toFixed(2)} m² x ${formatCurrency(produto.preco_por_m2)}/m²`, 20, y);
    y += 10;
  }

  // Total
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL: ${formatCurrency(orcamento.valor_total)}`, 20, y);
  y += 14;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128, 128, 128);
  doc.text('Cálculo estimado. Medidas devem ser confirmadas no local.', 20, y);

  const nomeArquivo = `orcamento-${cliente.nome.replace(/\s+/g, '-').toLowerCase()}.pdf`;
  doc.save(nomeArquivo);
}
