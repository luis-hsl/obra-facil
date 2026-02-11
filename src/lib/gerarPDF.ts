import { jsPDF } from 'jspdf';
import type { Orcamento, OrcamentoItem, Produto, Atendimento, BrandConfig, DocumentTemplate, MockupBlock, OverlayTemplate } from '../types';
import { hexToRgb, fetchImageAsBase64 } from './imageUtils';
// DEFAULT_DOCUMENT_TEMPLATE used in MarcaConfig for merge with partial AI extractions

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
// Page break helper
// ============================================================

function checkPage(doc: jsPDF, y: number, needed: number, marginTop: number, marginBottom: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - marginBottom) {
    doc.addPage();
    return marginTop;
  }
  return y;
}

// ============================================================
// Mockup-based renderer (visual structure only)
// ============================================================

function renderFromMockup(
  params: GerarPDFParams,
  tpl: DocumentTemplate,
  logoBase64: string | null,
): string | void {
  const { atendimento, itens = [], produtosMap = {}, numeroParcelas = 12, taxaJuros = 2, preview } = params;
  const mockup = tpl.mockup!;
  const br = tpl.branding;
  const lm = tpl.layout_metadata;
  const margins = lm.margins;
  const font = br.font_family;
  const bc = params.brandConfig;

  const doc = new jsPDF(lm.orientation === 'landscape' ? 'l' : 'p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - margins.left - margins.right;
  const x0 = margins.left;
  let y = margins.top;

  // Company data
  const companyName = bc?.company_name || tpl.company_fields.find(f => f.type === 'text' && f.style === 'bold')?.value || '';
  const companyCnpj = bc?.company_cnpj || tpl.company_fields.find(f => f.type === 'cnpj')?.value || '';
  const companyPhone = bc?.company_phone || tpl.company_fields.find(f => f.type === 'phone')?.value || '';
  const companyEmail = bc?.company_email || tpl.company_fields.find(f => f.type === 'email')?.value || '';
  const companyAddress = bc?.company_address || tpl.company_fields.find(f => f.type === 'address')?.value || '';

  // Build items
  let items: Array<{ name: string; area: number; unitPrice: number; total: number }> = [];
  if (itens.length > 0) {
    items = itens.map(item => {
      const prod = item.produto_id ? produtosMap[item.produto_id] : null;
      return {
        name: prod ? `${prod.fabricante} — ${prod.linha}` : 'Produto',
        area: item.area_total,
        unitPrice: item.preco_por_m2,
        total: item.valor_total,
      };
    });
  } else if (params.produto && params.orcamento.area_total) {
    items = [{
      name: `${params.produto.fabricante} — ${params.produto.linha}`,
      area: params.orcamento.area_com_perda || params.orcamento.area_total,
      unitPrice: params.produto.preco_por_m2,
      total: params.orcamento.valor_total,
    }];
  }

  const discountPct = tpl.totals.discount_percent / 100;

  // Role → value mapping for client data
  const enderecoCompleto = [atendimento.endereco, atendimento.numero, atendimento.complemento, atendimento.bairro, atendimento.cidade].filter(Boolean).join(', ');
  const roleValues: Record<string, string> = {
    company_name: companyName,
    company_cnpj: companyCnpj,
    company_phone: companyPhone,
    company_email: companyEmail,
    company_address: companyAddress,
    company_contact: [companyPhone, companyEmail].filter(Boolean).join(' | '),
    client_name: atendimento.cliente_nome,
    client_phone: atendimento.cliente_telefone || '',
    client_address: enderecoCompleto,
    service_type: atendimento.tipo_servico,
    date: new Date().toLocaleDateString('pt-BR'),
  };

  // Iterate mockup blocks in visual order
  for (const block of mockup.blocks) {
    y = renderMockupBlock(doc, block, tpl, y, x0, contentW, pageW, font, br, margins, logoBase64, roleValues, items, discountPct, numeroParcelas, taxaJuros, bc);
    y += lm.section_spacing;
  }

  if (preview) return String(doc.output('bloburl'));
  doc.save(`orcamento-${atendimento.cliente_nome.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

function renderMockupBlock(
  doc: jsPDF,
  block: MockupBlock,
  tpl: DocumentTemplate,
  startY: number,
  x0: number,
  contentW: number,
  pageW: number,
  font: string,
  br: DocumentTemplate['branding'],
  margins: { top: number; right: number; bottom: number; left: number },
  logoBase64: string | null,
  roleValues: Record<string, string>,
  items: Array<{ name: string; area: number; unitPrice: number; total: number }>,
  discountPct: number,
  numeroParcelas: number,
  taxaJuros: number,
  bc: BrandConfig | null | undefined,
): number {
  let y = startY;
  const hdr = tpl.layout_metadata.header;

  switch (block.type) {
    case 'header': {
      // Background
      if (hdr.background_color) {
        doc.setFillColor(...hexToRgb(hdr.background_color));
        doc.rect(0, 0, pageW, hdr.height, 'F');
      }

      // Logo
      if (logoBase64) {
        const logoH = hdr.logo_max_height;
        const logoW = logoH * 2.5;
        let logoX = x0;
        if (hdr.logo_position === 'center') logoX = (pageW - logoW) / 2;
        else if (hdr.logo_position === 'right') logoX = pageW - margins.right - logoW;
        try { doc.addImage(logoBase64, 'PNG', logoX, y, logoW, logoH); } catch { /* skip */ }
      }

      // Render company info from elements
      if (block.elements) {
        let cY = y + 2;
        const companyInfoPos = hdr.company_info_position;
        const isRight = companyInfoPos === 'right';

        for (const el of block.elements) {
          if (el.role === 'logo') continue; // already rendered
          const value = roleValues[el.role] || el.text || '';
          if (!value) continue;

          const fontSize = el.style === 'small' ? 8 : el.style === 'bold' ? 10 : 9;
          doc.setFontSize(fontSize);
          doc.setFont(font, el.style === 'bold' ? 'bold' : 'normal');
          doc.setTextColor(...hexToRgb(br.header_text_color));

          if (isRight) {
            doc.text(value, pageW - margins.right, cY, { align: 'right' });
          } else {
            const elX = companyInfoPos === 'left' ? x0 : x0 + (logoBase64 ? hdr.logo_max_height * 2.5 + 5 : 0);
            doc.text(value, elX, cY);
          }
          cY += el.style === 'bold' ? 4.5 : 3.5;
        }
      }

      y += hdr.height;
      break;
    }

    case 'title': {
      const titleEl = block.elements?.[0];
      const titleText = titleEl?.text || hdr.title.text || 'ORÇAMENTO';
      const titleAlign = titleEl?.alignment || hdr.title.alignment || 'center';

      doc.setFontSize(hdr.title.font_size);
      doc.setFont(font, 'bold');
      doc.setTextColor(...hexToRgb(br.header_text_color));
      const titleX = titleAlign === 'center' ? pageW / 2
        : titleAlign === 'right' ? pageW - margins.right : x0;
      doc.text(titleText, titleX, y + 2, { align: titleAlign });
      y += 10;
      break;
    }

    case 'separator': {
      const sepColor = block.separator_style?.color || hdr.separator_color || br.primary_color;
      doc.setDrawColor(...hexToRgb(sepColor));
      doc.setLineWidth(0.5);
      doc.line(x0, y, pageW - margins.right, y);
      y += 3;
      break;
    }

    case 'client_data': {
      const cs = tpl.layout_metadata.client_section;
      const clientFields = tpl.client_fields;

      if (block.elements && block.elements.length > 0) {
        // Render from mockup elements
        doc.setFontSize(cs.value_font_size);

        for (const el of block.elements) {
          if (el.role === 'label' && el.text) {
            // Label + next value (handled as pair)
            doc.setTextColor(...hexToRgb(br.secondary_color));
            if (cs.label_bold) doc.setFont(font, 'bold');
            doc.text(el.text + ' ', x0, y);
            // We'll render the value in the next iteration
          } else {
            // Value element
            const value = roleValues[el.role] || '';
            if (!value) continue;
            doc.setFont(font, 'normal');
            doc.setTextColor(...hexToRgb(br.secondary_color));
            doc.text(value, x0, y);
            y += 5.5;
          }
        }
      } else {
        // Fallback: render from client_fields
        doc.setFontSize(cs.value_font_size);
        for (const field of clientFields) {
          let value = '';
          if (field.type === 'cliente_nome') value = roleValues.client_name;
          else if (field.type === 'cliente_telefone') value = roleValues.client_phone;
          else if (field.type === 'endereco_completo') value = roleValues.client_address;
          else if (field.type === 'tipo_servico') value = roleValues.service_type;
          else if (field.type === 'data') value = roleValues.date;
          if (!value && !field.required) continue;

          doc.setTextColor(...hexToRgb(br.secondary_color));
          if (cs.label_bold) doc.setFont(font, 'bold');
          doc.text(field.label + ' ', x0, y);
          const labelW = doc.getTextWidth(field.label + ' ');
          doc.setFont(font, 'normal');
          const lines = doc.splitTextToSize(value || '—', contentW - labelW - 4);
          doc.text(lines, x0 + labelW, y);
          y += 5.5 * Math.max(lines.length, 1);
        }
      }
      break;
    }

    case 'table': {
      const rowStyle = block.row_style || 'cards';
      const columns = block.columns || [];

      // Count text columns (labels) vs placeholder columns (data)
      const textColIndices: number[] = [];
      const placeholderColIndices: number[] = [];
      columns.forEach((col, i) => {
        if (col === '{{placeholder}}') placeholderColIndices.push(i);
        else textColIndices.push(i);
      });

      // Standard data fields to inject in placeholder order
      const dataFieldsForItem = (item: typeof items[0], _idx: number) => {
        const discountPrice = item.total * (1 - discountPct);
        const { parcela } = calcularParcelamento(item.total, taxaJuros, numeroParcelas);
        return [
          `${item.area} m²`,
          formatCurrency(item.unitPrice),
          formatCurrency(item.total),
          formatCurrency(discountPrice),
          `${numeroParcelas}x ${formatCurrency(parcela)}`,
        ];
      };

      if (rowStyle === 'cards') {
        // CARDS style
        items.forEach((item, idx) => {
          const hasPerItem = tpl.totals.position === 'per_item';
          const cardH = 32 + (hasPerItem ? 14 : 0);
          y = checkPage(doc, y, cardH, margins.top, margins.bottom);

          // Card background
          if (br.table_row_alt_bg) {
            doc.setFillColor(...hexToRgb(br.table_row_alt_bg));
            doc.rect(x0, y - 2, contentW, cardH - 4, 'F');
          }

          // Title bar
          if (br.table_header_bg) {
            doc.setFillColor(...hexToRgb(br.table_header_bg));
            doc.rect(x0, y - 2, contentW, 7, 'F');
          }
          doc.setFontSize(11);
          doc.setFont(font, 'bold');
          doc.setTextColor(...hexToRgb(br.table_header_text));
          doc.text(`OPÇÃO ${idx + 1}: ${item.name}`, x0 + 3, y + 2);
          y += 10;

          // Metrics line
          doc.setFontSize(10);
          doc.setFont(font, 'normal');
          doc.setTextColor(...hexToRgb(br.secondary_color));
          doc.text(`Área: ${item.area} m²  |  Preço: ${formatCurrency(item.unitPrice)}/m²`, x0 + 3, y);
          y += 6;

          // Per-item totals
          if (hasPerItem) {
            const discountPrice = item.total * (1 - discountPct);
            const { totalComTaxa, parcela } = calcularParcelamento(item.total, taxaJuros, numeroParcelas);
            const taxaText = taxaJuros > 0 ? ` (${taxaJuros}% taxa)` : '';

            doc.setFont(font, 'bold');
            doc.setTextColor(...hexToRgb(br.price_highlight_color));
            doc.text(`${tpl.totals.discount_label} ${formatCurrency(discountPrice)}`, x0 + 3, y);
            y += 5.5;

            doc.setFont(font, 'normal');
            doc.setTextColor(...hexToRgb(br.secondary_color));
            doc.text(`${tpl.totals.installment_label} ${numeroParcelas}x de ${formatCurrency(parcela)}${taxaText}`, x0 + 3, y);
            y += 5;

            doc.setFontSize(9);
            doc.setTextColor(128, 128, 128);
            doc.text(`Total: ${formatCurrency(totalComTaxa)}`, x0 + 3, y);
            doc.setTextColor(0, 0, 0);
            y += 3;
          }

          y += 6;
        });

      } else if (rowStyle === 'striped' || rowStyle === 'bordered') {
        // TABLE style
        const colCount = columns.length || 5;
        const colW = contentW / colCount;

        // Header
        y = checkPage(doc, y, 10, margins.top, margins.bottom);
        if (br.table_header_bg) {
          doc.setFillColor(...hexToRgb(br.table_header_bg));
          doc.rect(x0, y - 4, contentW, 7, 'F');
        }
        doc.setFontSize(10);
        doc.setFont(font, 'bold');
        doc.setTextColor(...hexToRgb(br.table_header_text));
        columns.forEach((col, i) => {
          const label = col === '{{placeholder}}' ? '' : col;
          doc.text(label, x0 + i * colW + 1, y);
        });
        y += 5;
        doc.setDrawColor(...hexToRgb(br.border_color));
        doc.setLineWidth(0.2);
        doc.line(x0, y, x0 + contentW, y);
        y += 2;

        // Rows
        doc.setFontSize(10);
        items.forEach((item, idx) => {
          y = checkPage(doc, y, 10, margins.top, margins.bottom);
          if (rowStyle === 'striped' && idx % 2 === 1 && br.table_row_alt_bg) {
            doc.setFillColor(...hexToRgb(br.table_row_alt_bg));
            doc.rect(x0, y - 3.5, contentW, 8, 'F');
          }

          const dataFields = dataFieldsForItem(item, idx);
          let dataIdx = 0;

          doc.setFont(font, 'normal');
          doc.setTextColor(...hexToRgb(br.secondary_color));

          columns.forEach((col, i) => {
            let cellValue: string;
            if (col === '{{placeholder}}') {
              cellValue = dataFields[dataIdx] || '';
              dataIdx++;
              // Highlight price columns (last placeholders)
              if (dataIdx >= 3) {
                doc.setFont(font, 'bold');
                doc.setTextColor(...hexToRgb(br.price_highlight_color));
              }
            } else {
              // Text column: option number or product name
              if (i === 0 && col.toLowerCase().includes('op')) cellValue = String(idx + 1);
              else cellValue = item.name;
            }
            doc.text(cellValue, x0 + i * colW + 1, y);
            doc.setFont(font, 'normal');
            doc.setTextColor(...hexToRgb(br.secondary_color));
          });

          y += 8;
          if (rowStyle === 'bordered') {
            doc.setDrawColor(...hexToRgb(br.border_color));
            doc.setLineWidth(0.1);
            doc.line(x0, y - 1, x0 + contentW, y - 1);
          }
        });

      } else {
        // PLAIN / list style
        items.forEach((item, idx) => {
          y = checkPage(doc, y, 20, margins.top, margins.bottom);
          doc.setFont(font, 'bold');
          doc.setFontSize(10);
          doc.setTextColor(...hexToRgb(br.primary_color));
          doc.text(`${idx + 1}. ${item.name}`, x0, y);
          y += 5;
          doc.setFont(font, 'normal');
          doc.setTextColor(...hexToRgb(br.secondary_color));
          doc.text(`${item.area} m² × ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.total)}`, x0 + 5, y);
          y += 5;
          if (tpl.totals.position === 'per_item') {
            const discountPrice = item.total * (1 - discountPct);
            doc.setFont(font, 'bold');
            doc.setTextColor(...hexToRgb(br.price_highlight_color));
            doc.text(`${tpl.totals.discount_label} ${formatCurrency(discountPrice)}`, x0 + 5, y);
            y += 5;
          }
          doc.setDrawColor(...hexToRgb(br.border_color));
          doc.setLineWidth(0.1);
          doc.line(x0, y, x0 + contentW, y);
          y += 6;
        });
      }
      break;
    }

    case 'observations': {
      const obs = tpl.observations;
      const obsText = bc?.footer_text || obs.default_text;
      if (obsText) {
        y = checkPage(doc, y, 15, margins.top, margins.bottom);
        doc.setFontSize(obs.font_size);
        const fontStyle = obs.style === 'italic' ? 'italic' : 'normal';
        doc.setFont(font, fontStyle);
        doc.setTextColor(128, 128, 128);
        const lines = doc.splitTextToSize(obsText, contentW);
        doc.text(lines, x0, y);
        y += 4 * lines.length;
      }
      break;
    }

    case 'footer': {
      const ft = tpl.layout_metadata.footer;
      if (ft.style === 'line' || ft.style === 'bar') {
        if (ft.separator_color) {
          doc.setDrawColor(...hexToRgb(ft.separator_color));
          doc.setLineWidth(0.3);
          doc.line(x0, y, pageW - margins.right, y);
        }
        y += 4;
      }
      const validityDays = bc?.validity_days || 15;
      doc.setFontSize(ft.font_size);
      doc.setFont(font, 'normal');
      doc.setTextColor(...hexToRgb(ft.text_color));
      const ftX = ft.text_alignment === 'center' ? pageW / 2
        : ft.text_alignment === 'right' ? pageW - margins.right : x0;
      doc.text(`Orçamento válido por ${validityDays} dias.`, ftX, y, { align: ft.text_alignment });
      y += 5;
      break;
    }
  }

  return y;
}

// ============================================================
// Legacy budget_table renderer (backward compat)
// ============================================================

function renderBudgetTable(
  doc: jsPDF,
  tpl: DocumentTemplate,
  items: Array<{ name: string; area: number; unitPrice: number; total: number }>,
  startY: number,
  x0: number,
  contentW: number,
  font: string,
  br: DocumentTemplate['branding'],
  margins: { top: number; bottom: number },
  numeroParcelas: number,
  taxaJuros: number,
): number {
  let y = startY;
  const bt = tpl.budget_table;
  const discountPct = tpl.totals.discount_percent / 100;

  if (bt.style === 'table') {
    const cols = bt.columns;
    const colWidths = cols.map(c => (c.width_percent / 100) * contentW);

    if (bt.show_header) {
      y = checkPage(doc, y, 10, margins.top, margins.bottom);
      if (br.table_header_bg) {
        doc.setFillColor(...hexToRgb(br.table_header_bg));
        doc.rect(x0, y - 4, contentW, 7, 'F');
      }
      doc.setFontSize(bt.header_font_size);
      doc.setFont(font, 'bold');
      doc.setTextColor(...hexToRgb(br.table_header_text));
      let cx = x0;
      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        const tx = col.align === 'center' ? cx + colWidths[i] / 2
          : col.align === 'right' ? cx + colWidths[i] - 1 : cx + 1;
        doc.text(col.label, tx, y, { align: col.align });
        cx += colWidths[i];
      }
      y += 5;
      if (bt.show_borders) {
        doc.setDrawColor(...hexToRgb(br.border_color));
        doc.setLineWidth(0.2);
        doc.line(x0, y, x0 + contentW, y);
      }
      y += 2;
    }

    doc.setFontSize(bt.body_font_size);
    items.forEach((item, idx) => {
      y = checkPage(doc, y, bt.row_padding + 6, margins.top, margins.bottom);
      if (idx % 2 === 1 && br.table_row_alt_bg) {
        doc.setFillColor(...hexToRgb(br.table_row_alt_bg));
        doc.rect(x0, y - 3.5, contentW, bt.row_padding + 2, 'F');
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
      doc.setFont(font, 'normal');
      doc.setTextColor(...hexToRgb(br.secondary_color));
      let cx = x0;
      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        const val = values[col.key] || '';
        if (col.key === 'discount_price') {
          doc.setFont(font, 'bold');
          doc.setTextColor(...hexToRgb(br.price_highlight_color));
        }
        const tx = col.align === 'center' ? cx + colWidths[i] / 2
          : col.align === 'right' ? cx + colWidths[i] - 1 : cx + 1;
        doc.text(val, tx, y, { align: col.align });
        if (col.key === 'discount_price') {
          doc.setFont(font, 'normal');
          doc.setTextColor(...hexToRgb(br.secondary_color));
        }
        cx += colWidths[i];
      }
      y += bt.row_padding;
      if (bt.show_borders) {
        doc.setDrawColor(...hexToRgb(br.border_color));
        doc.setLineWidth(0.1);
        doc.line(x0, y - 1, x0 + contentW, y - 1);
      }
    });

  } else if (bt.style === 'cards') {
    doc.setFontSize(bt.body_font_size);
    items.forEach((item, idx) => {
      const cardH = 32 + (tpl.totals.position === 'per_item' ? 14 : 0);
      y = checkPage(doc, y, cardH, margins.top, margins.bottom);
      if (br.table_row_alt_bg) {
        doc.setFillColor(...hexToRgb(br.table_row_alt_bg));
        doc.rect(x0, y - 2, contentW, cardH - 4, 'F');
      }
      if (br.table_header_bg) {
        doc.setFillColor(...hexToRgb(br.table_header_bg));
        doc.rect(x0, y - 2, contentW, 7, 'F');
      }
      doc.setFontSize(bt.header_font_size);
      doc.setFont(font, 'bold');
      doc.setTextColor(...hexToRgb(br.table_header_text));
      doc.text(`OPÇÃO ${idx + 1}: ${item.name}`, x0 + 3, y + 2);
      y += 10;
      doc.setFontSize(bt.body_font_size);
      doc.setFont(font, 'normal');
      doc.setTextColor(...hexToRgb(br.secondary_color));
      doc.text(`Área: ${item.area} m²  |  Preço: ${formatCurrency(item.unitPrice)}/m²`, x0 + 3, y);
      y += 6;
      if (tpl.totals.position === 'per_item') {
        const discountPrice = item.total * (1 - discountPct);
        const { totalComTaxa, parcela } = calcularParcelamento(item.total, taxaJuros, numeroParcelas);
        const taxaText = taxaJuros > 0 ? ` (${taxaJuros}% taxa)` : '';
        doc.setFont(font, 'bold');
        doc.setTextColor(...hexToRgb(br.price_highlight_color));
        doc.text(`${tpl.totals.discount_label} ${formatCurrency(discountPrice)}`, x0 + 3, y);
        y += 5.5;
        doc.setFont(font, 'normal');
        doc.setTextColor(...hexToRgb(br.secondary_color));
        doc.text(`${tpl.totals.installment_label} ${numeroParcelas}x de ${formatCurrency(parcela)}${taxaText}`, x0 + 3, y);
        y += 5;
        doc.setFontSize(bt.body_font_size - 1);
        doc.setTextColor(128, 128, 128);
        doc.text(`Total: ${formatCurrency(totalComTaxa)}`, x0 + 3, y);
        doc.setTextColor(0, 0, 0);
        y += 3;
      }
      y += bt.row_padding;
    });

  } else {
    doc.setFontSize(bt.body_font_size);
    items.forEach((item, idx) => {
      y = checkPage(doc, y, 20, margins.top, margins.bottom);
      doc.setFont(font, 'bold');
      doc.setTextColor(...hexToRgb(br.primary_color));
      doc.text(`${idx + 1}. ${item.name}`, x0, y);
      y += 5;
      doc.setFont(font, 'normal');
      doc.setTextColor(...hexToRgb(br.secondary_color));
      doc.text(`${item.area} m² × ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.total)}`, x0 + 5, y);
      y += 5;
      if (tpl.totals.position === 'per_item') {
        const discountPrice = item.total * (1 - discountPct);
        doc.setFont(font, 'bold');
        doc.setTextColor(...hexToRgb(br.price_highlight_color));
        doc.text(`${tpl.totals.discount_label} ${formatCurrency(discountPrice)}`, x0 + 5, y);
        doc.setFont(font, 'normal');
        doc.setTextColor(...hexToRgb(br.secondary_color));
        y += 5;
      }
      doc.setDrawColor(...hexToRgb(br.border_color));
      doc.setLineWidth(0.1);
      doc.line(x0, y, x0 + contentW, y);
      y += bt.row_padding;
    });
  }

  return y;
}

// ============================================================
// Document Template v2 renderer
// ============================================================

function renderFromTemplate(
  params: GerarPDFParams,
  tpl: DocumentTemplate,
  logoBase64: string | null,
): string | void {
  const { atendimento, itens = [], produtosMap = {}, numeroParcelas = 12, taxaJuros = 2, preview } = params;
  const br = tpl.branding;
  const lm = tpl.layout_metadata;
  const margins = lm.margins;
  const font = br.font_family;

  const doc = new jsPDF(lm.orientation === 'landscape' ? 'l' : 'p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - margins.left - margins.right;
  const x0 = margins.left;
  let y = margins.top;

  // Company fields: use brandConfig overrides if available, else template values
  const bc = params.brandConfig;
  const companyName = bc?.company_name || tpl.company_fields.find(f => f.type === 'text' && f.style === 'bold')?.value || '';
  const companyCnpj = bc?.company_cnpj || tpl.company_fields.find(f => f.type === 'cnpj')?.value || '';
  const companyPhone = bc?.company_phone || tpl.company_fields.find(f => f.type === 'phone')?.value || '';
  const companyEmail = bc?.company_email || tpl.company_fields.find(f => f.type === 'email')?.value || '';
  const companyAddress = bc?.company_address || tpl.company_fields.find(f => f.type === 'address')?.value || '';

  // Build items (normalize legacy single-product)
  let items: Array<{ name: string; area: number; unitPrice: number; total: number }> = [];
  if (itens.length > 0) {
    items = itens.map(item => {
      const prod = item.produto_id ? produtosMap[item.produto_id] : null;
      return {
        name: prod ? `${prod.fabricante} — ${prod.linha}` : 'Produto',
        area: item.area_total,
        unitPrice: item.preco_por_m2,
        total: item.valor_total,
      };
    });
  } else if (params.produto && params.orcamento.area_total) {
    items = [{
      name: `${params.produto.fabricante} — ${params.produto.linha}`,
      area: params.orcamento.area_com_perda || params.orcamento.area_total,
      unitPrice: params.produto.preco_por_m2,
      total: params.orcamento.valor_total,
    }];
  }

  // Iterate sections in order
  for (const section of lm.sections_order) {
    // ---- HEADER ----
    if (section === 'header') {
      const hdr = lm.header;

      // Background
      if (hdr.background_color) {
        doc.setFillColor(...hexToRgb(hdr.background_color));
        doc.rect(0, 0, pageW, hdr.height, 'F');
      }

      // Logo
      if (logoBase64) {
        const logoH = hdr.logo_max_height;
        const logoW = logoH * 2.5; // approximate aspect ratio
        let logoX = x0;
        if (hdr.logo_position === 'center') logoX = (pageW - logoW) / 2;
        else if (hdr.logo_position === 'right') logoX = pageW - margins.right - logoW;
        try {
          doc.addImage(logoBase64, 'PNG', logoX, y, logoW, logoH);
        } catch { /* logo failed, skip */ }
      }

      // Company info
      const companyLines = [companyName, companyCnpj, companyPhone, companyEmail, companyAddress].filter(Boolean);
      if (companyLines.length > 0) {
        let cY = y + 2;
        const cFontSize = 8;
        doc.setFontSize(cFontSize);
        doc.setTextColor(...hexToRgb(br.header_text_color));

        if (hdr.company_info_position === 'right') {
          const cX = pageW - margins.right;
          doc.setFont(font, 'bold');
          doc.text(companyLines[0], cX, cY, { align: 'right' });
          cY += 4;
          doc.setFont(font, 'normal');
          for (let i = 1; i < companyLines.length; i++) {
            doc.text(companyLines[i], cX, cY, { align: 'right' });
            cY += 3.5;
          }
        } else if (hdr.company_info_position === 'left') {
          doc.setFont(font, 'bold');
          doc.text(companyLines[0], x0, cY);
          cY += 4;
          doc.setFont(font, 'normal');
          for (let i = 1; i < companyLines.length; i++) {
            doc.text(companyLines[i], x0, cY);
            cY += 3.5;
          }
        } else {
          // below-logo / below-title
          const cYStart = y + (logoBase64 ? hdr.logo_max_height + 3 : 0);
          cY = cYStart;
          doc.setFont(font, 'bold');
          doc.text(companyLines[0], x0, cY);
          cY += 4;
          doc.setFont(font, 'normal');
          for (let i = 1; i < companyLines.length; i++) {
            doc.text(companyLines[i], x0, cY);
            cY += 3.5;
          }
        }
      }

      // Title
      const title = hdr.title;
      doc.setFontSize(title.font_size);
      doc.setFont(font, 'bold');
      doc.setTextColor(...hexToRgb(br.header_text_color));
      const titleX = title.alignment === 'center' ? pageW / 2
        : title.alignment === 'right' ? pageW - margins.right : x0;
      doc.text(title.text, titleX, y + hdr.height - 8, { align: title.alignment });

      // Separator
      if (hdr.show_separator) {
        doc.setDrawColor(...hexToRgb(hdr.separator_color || br.primary_color));
        doc.setLineWidth(0.5);
        doc.line(x0, y + hdr.height - 2, pageW - margins.right, y + hdr.height - 2);
      }

      y = y + hdr.height + lm.section_spacing;
    }

    // ---- CLIENT SECTION ----
    if (section === 'client') {
      const cs = lm.client_section;
      const clientData: Array<{ label: string; value: string }> = [];
      const enderecoCompleto = [atendimento.endereco, atendimento.numero, atendimento.complemento, atendimento.bairro, atendimento.cidade].filter(Boolean).join(', ');

      for (const field of tpl.client_fields) {
        let value = '';
        if (field.type === 'cliente_nome') value = atendimento.cliente_nome;
        else if (field.type === 'cliente_telefone') value = atendimento.cliente_telefone || '';
        else if (field.type === 'endereco_completo') value = enderecoCompleto;
        else if (field.type === 'tipo_servico') value = atendimento.tipo_servico;
        else if (field.type === 'data') value = new Date().toLocaleDateString('pt-BR');
        if (!value && !field.required) continue;
        clientData.push({ label: field.label, value: value || '—' });
      }

      if (cs.style === 'card' || cs.style === 'table') {
        // Card/table: draw background rect
        const cardH = clientData.length * 6 + 6;
        y = checkPage(doc, y, cardH, margins.top, margins.bottom);
        if (cs.background_color) {
          doc.setFillColor(...hexToRgb(cs.background_color));
          doc.rect(x0, y - 2, contentW, cardH, 'F');
        }
        if (cs.border && cs.border_color) {
          doc.setDrawColor(...hexToRgb(cs.border_color));
          doc.setLineWidth(0.3);
          doc.rect(x0, y - 2, contentW, cardH, 'S');
        }
      }

      doc.setFontSize(cs.value_font_size);
      for (const { label, value } of clientData) {
        doc.setTextColor(...hexToRgb(br.secondary_color));
        if (cs.label_bold) doc.setFont(font, 'bold');
        else doc.setFont(font, 'normal');
        const lx = cs.style === 'card' ? x0 + 4 : x0;
        doc.text(label + ' ', lx, y);
        const labelW = doc.getTextWidth(label + ' ');
        doc.setFont(font, 'normal');
        const lines = doc.splitTextToSize(value, contentW - labelW - 8);
        doc.text(lines, lx + labelW, y);
        y += 5.5 * Math.max(lines.length, 1);
      }

      y += lm.section_spacing;
    }

    // ---- BUDGET TABLE (legacy — used when no mockup) ----
    if (section === 'budget_table' || section === 'content_blocks') {
      y = renderBudgetTable(doc, tpl, items, y, x0, contentW, font, br, margins, numeroParcelas, taxaJuros);
      y += lm.section_spacing;
    }

    // ---- TOTALS (summary bottom) ----
    if (section === 'totals' && tpl.totals.position === 'summary_bottom' && items.length > 0) {
      y = checkPage(doc, y, 30, margins.top, margins.bottom);
      const discountPct = tpl.totals.discount_percent / 100;
      const sumTotal = items.reduce((s, i) => s + i.total, 0);
      const sumDiscount = sumTotal * (1 - discountPct);
      const { totalComTaxa, parcela } = calcularParcelamento(sumTotal, taxaJuros, numeroParcelas);

      // Separator line
      doc.setDrawColor(...hexToRgb(br.border_color));
      doc.setLineWidth(0.3);
      doc.line(x0, y, x0 + contentW, y);
      y += 6;

      // Discount total
      if (tpl.totals.show_discount) {
        doc.setFontSize(13);
        doc.setFont(font, 'bold');
        doc.setTextColor(...hexToRgb(br.price_highlight_color));
        doc.text(`${tpl.totals.discount_label} ${formatCurrency(sumDiscount)}`, x0, y);
        y += 7;
      }

      // Installments
      if (tpl.totals.show_installments) {
        const taxaText = taxaJuros > 0 ? ` (${taxaJuros}% taxa)` : '';
        doc.setFontSize(11);
        doc.setFont(font, 'normal');
        doc.setTextColor(...hexToRgb(br.secondary_color));
        doc.text(`${tpl.totals.installment_label} ${numeroParcelas}x de ${formatCurrency(parcela)}${taxaText}`, x0, y);
        y += 5;
        doc.setFontSize(9);
        doc.setTextColor(128, 128, 128);
        doc.text(`Total: ${formatCurrency(totalComTaxa)}`, x0, y);
        doc.setTextColor(0, 0, 0);
        y += 3;
      }

      y += lm.section_spacing;
    }

    // ---- OBSERVATIONS ----
    if (section === 'observations') {
      const obs = tpl.observations;
      const obsText = bc?.footer_text || obs.default_text;
      if (obsText) {
        y = checkPage(doc, y, 15, margins.top, margins.bottom);
        doc.setFontSize(obs.font_size);
        const fontStyle = obs.style === 'italic' ? 'italic' : 'normal';
        doc.setFont(font, fontStyle);
        doc.setTextColor(128, 128, 128);
        const lines = doc.splitTextToSize(obsText, contentW);
        doc.text(lines, x0, y);
        y += 4 * lines.length;
        y += lm.section_spacing;
      }
    }

    // ---- FOOTER ----
    if (section === 'footer') {
      const ft = lm.footer;
      // Separator
      if (ft.style === 'line' || ft.style === 'bar') {
        if (ft.style === 'bar' && ft.separator_color) {
          doc.setFillColor(...hexToRgb(ft.separator_color));
          doc.rect(x0, y, contentW, 1.5, 'F');
        } else if (ft.separator_color) {
          doc.setDrawColor(...hexToRgb(ft.separator_color));
          doc.setLineWidth(0.3);
          doc.line(x0, y, x0 + contentW, y);
        }
        y += 4;
      }

      // Validity text
      const validityDays = bc?.validity_days || 15;
      doc.setFontSize(ft.font_size);
      doc.setFont(font, 'normal');
      doc.setTextColor(...hexToRgb(ft.text_color));
      const ftX = ft.text_alignment === 'center' ? pageW / 2
        : ft.text_alignment === 'right' ? pageW - margins.right : x0;
      doc.text(`Orçamento válido por ${validityDays} dias.`, ftX, y, { align: ft.text_alignment });
    }
  }

  // Output
  if (preview) return String(doc.output('bloburl'));
  doc.save(`orcamento-${atendimento.cliente_nome.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

// ============================================================
// Overlay renderer (legado) — fundo do PDF original + texto
// ============================================================

async function renderWithOverlay(
  params: GerarPDFParams,
  tpl: OverlayTemplate,
  bgImageUrl: string,
): Promise<string | void> {
  const bgBase64 = await fetchImageAsBase64(bgImageUrl);
  const doc = new jsPDF('p', 'mm', 'a4');
  const font = tpl.fontFamily;

  const imgFormat = bgImageUrl.endsWith('.png') ? 'PNG' : 'JPEG';
  doc.addImage(bgBase64, imgFormat, 0, 0, 210, 297);

  for (const zone of tpl.erase) {
    doc.setFillColor(...hexToRgb(zone.color));
    doc.rect(zone.x, zone.y, zone.w, zone.h, 'F');
  }

  const { atendimento } = params;
  const cl = tpl.client;
  let y = cl.y;

  const drawLabelValue = (label: string, value: string, x: number, yPos: number) => {
    doc.setFontSize(cl.fontSize);
    if (cl.labelBold) doc.setFont(font, 'bold');
    doc.setTextColor(...hexToRgb(cl.fontColor));
    doc.text(label, x, yPos);
    const labelW = doc.getTextWidth(label);
    doc.setFont(font, 'normal');
    doc.text(value, x + labelW, yPos);
  };

  drawLabelValue('Cliente: ', atendimento.cliente_nome, cl.x, y);
  y += cl.lineHeight;
  if (atendimento.cliente_telefone) {
    drawLabelValue('Telefone: ', atendimento.cliente_telefone, cl.x, y);
    y += cl.lineHeight;
  }
  const endereco = [atendimento.endereco, atendimento.numero, atendimento.complemento, atendimento.bairro, atendimento.cidade].filter(Boolean).join(', ');
  if (endereco) {
    doc.setFontSize(cl.fontSize);
    if (cl.labelBold) doc.setFont(font, 'bold');
    doc.setTextColor(...hexToRgb(cl.fontColor));
    doc.text('Endereço: ', cl.x, y);
    const labelW = doc.getTextWidth('Endereço: ');
    doc.setFont(font, 'normal');
    const lines = doc.splitTextToSize(endereco, 210 - cl.x - 10 - labelW);
    doc.text(lines, cl.x + labelW, y);
    y += cl.lineHeight * lines.length;
  }
  drawLabelValue('Serviço: ', atendimento.tipo_servico, cl.x, y);
  y += cl.lineHeight;
  drawLabelValue('Data: ', new Date().toLocaleDateString('pt-BR'), cl.x, y);

  const pr = tpl.products;
  const itemList = params.itens && params.itens.length > 0 ? params.itens : [];
  const nParcelas = params.numeroParcelas || 12;
  const taxa = params.taxaJuros || 2;
  y = pr.y;

  if (itemList.length > 0) {
    itemList.forEach((item, idx) => {
      if (y > pr.maxY) return;
      const prod = item.produto_id ? (params.produtosMap || {})[item.produto_id] : null;
      const prodNome = prod ? `${prod.fabricante} — ${prod.linha}` : 'Produto';
      const valorDesc = item.valor_total * (1 - DESCONTO_AVISTA);
      const { totalComTaxa, parcela } = calcularParcelamento(item.valor_total, taxa, nParcelas);
      const taxaText = taxa > 0 ? ` (${taxa}% taxa)` : '';

      doc.setFontSize(pr.titleFontSize);
      doc.setFont(font, 'bold');
      doc.setTextColor(...hexToRgb(pr.titleColor));
      doc.text(`OPÇÃO ${idx + 1}: ${prodNome}`, pr.x, y);
      y += pr.lineHeight;

      doc.setFontSize(pr.fontSize);
      doc.setFont(font, 'normal');
      doc.setTextColor(...hexToRgb(pr.fontColor));
      doc.text(`Área: ${item.area_total} m²  |  Preço: ${formatCurrency(item.preco_por_m2)}/m²`, pr.x, y);
      y += pr.lineHeight;

      doc.setFont(font, 'bold');
      doc.setTextColor(...hexToRgb(pr.priceColor));
      doc.text(`À VISTA (5% desc.): ${formatCurrency(valorDesc)}`, pr.x, y);
      y += pr.lineHeight;

      doc.setFont(font, 'normal');
      doc.setTextColor(...hexToRgb(pr.fontColor));
      doc.text(`Parcelado: ${nParcelas}x de ${formatCurrency(parcela)}${taxaText}`, pr.x, y);
      y += pr.lineHeight;

      doc.setFontSize(pr.fontSize - 1);
      doc.setTextColor(128, 128, 128);
      doc.text(`Total: ${formatCurrency(totalComTaxa)}`, pr.x, y);
      doc.setTextColor(0, 0, 0);
      y += pr.itemSpacing;
    });
  }

  const ft = tpl.footer;
  const footerContent = tpl.footerText || `Orçamento válido por ${tpl.validityDays || 15} dias. Medidas devem ser confirmadas no local.`;
  doc.setFontSize(ft.fontSize);
  doc.setFont(font, 'normal');
  doc.setTextColor(...hexToRgb(ft.fontColor));
  const footerLines = doc.splitTextToSize(footerContent, ft.w);
  const ftX = ft.align === 'center' ? ft.x + ft.w / 2 : ft.align === 'right' ? ft.x + ft.w : ft.x;
  doc.text(footerLines, ftX, ft.y, { align: ft.align });

  if (params.preview) return String(doc.output('bloburl'));
  doc.save(`orcamento-${params.atendimento.cliente_nome.replace(/\s+/g, '-').toLowerCase()}.pdf`);
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
      y = checkPage(doc, y, 50, 20, 20);
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

  // 1. Mockup-based rendering (visual structure — highest priority)
  if (bc?.pdf_template && (bc.pdf_template as DocumentTemplate).version === 2 && (bc.pdf_template as DocumentTemplate).mockup?.blocks?.length) {
    try {
      return renderFromMockup(params, bc.pdf_template as DocumentTemplate, params.logoBase64 || null);
    } catch (err) {
      console.error('Mockup rendering failed, falling back:', err);
    }
  }

  // 2. Document Template v2 (legacy canonical JSON without mockup)
  if (bc?.pdf_template && (bc.pdf_template as DocumentTemplate).version === 2) {
    try {
      return renderFromTemplate(params, bc.pdf_template as DocumentTemplate, params.logoBase64 || null);
    } catch (err) {
      console.error('Template rendering failed, falling back:', err);
    }
  }

  // 2. Overlay approach (legado)
  if (bc?.overlay_template && bc?.background_image_url) {
    try {
      return await renderWithOverlay(params, bc.overlay_template, bc.background_image_url);
    } catch (err) {
      console.error('Overlay rendering failed, falling back:', err);
    }
  }

  // 3. Fallback: layout básico
  return renderBasicLayout(params);
}
