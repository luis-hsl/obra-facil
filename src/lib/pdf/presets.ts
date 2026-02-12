import type { PdfPreset } from '../../types/pdfTokens';

export const PRESET_CLASSIC: PdfPreset = {
  id: 'classic',
  label: 'Clássico',
  description: 'Tabela tradicional com cabeçalho e totais no final',
  header: {
    showBackground: false,
    companyInfoPosition: 'right',
    titleAlignment: 'center',
    titleFontSize: 18,
    showSeparator: true,
  },
  clientSection: { style: 'inline', showBorder: false, labelBold: true },
  budgetTable: {
    style: 'table',
    columns: [
      { key: 'option_number', label: 'Opção', widthPercent: 8, align: 'center' },
      { key: 'product_name', label: 'Produto', widthPercent: 32, align: 'left' },
      { key: 'area', label: 'Área (m²)', widthPercent: 12, align: 'right' },
      { key: 'unit_price', label: 'Valor/m²', widthPercent: 16, align: 'right' },
      { key: 'discount_price', label: 'À Vista', widthPercent: 16, align: 'right' },
      { key: 'installment_price', label: 'Parcelado', widthPercent: 16, align: 'right' },
    ],
    showHeader: true,
    showBorders: true,
    showAlternatingRows: true,
  },
  totals: {
    showDiscount: true,
    discountLabel: 'À Vista:',
    discountPercent: 0,
    showInstallments: true,
    installmentLabel: 'Parcelado:',
    position: 'summary_bottom',
  },
  observations: { fontStyle: 'italic' },
  footer: { style: 'line', textAlignment: 'center' },
  sectionsOrder: ['header', 'client', 'budget_table', 'totals', 'observations', 'footer'],
};

export const PRESET_MODERN: PdfPreset = {
  id: 'modern',
  label: 'Moderno',
  description: 'Cards por produto com cores e preços por item',
  header: {
    showBackground: false,
    companyInfoPosition: 'right',
    titleAlignment: 'left',
    titleFontSize: 20,
    showSeparator: true,
  },
  clientSection: { style: 'card', showBorder: true, labelBold: true },
  budgetTable: {
    style: 'cards',
    columns: [],
    showHeader: false,
    showBorders: false,
    showAlternatingRows: false,
  },
  totals: {
    showDiscount: true,
    discountLabel: 'À Vista:',
    discountPercent: 0,
    showInstallments: true,
    installmentLabel: 'Parcelado:',
    position: 'per_item',
  },
  observations: { fontStyle: 'normal' },
  footer: { style: 'line', textAlignment: 'center' },
  sectionsOrder: ['header', 'client', 'budget_table', 'observations', 'footer'],
};

export const PRESET_BOLD: PdfPreset = {
  id: 'bold',
  label: 'Impacto',
  description: 'Header colorido, cards compactos e totais em destaque',
  header: {
    showBackground: true,
    companyInfoPosition: 'right',
    titleAlignment: 'left',
    titleFontSize: 24,
    showSeparator: false,
  },
  clientSection: { style: 'card', showBorder: true, labelBold: true },
  budgetTable: {
    style: 'cards',
    columns: [],
    showHeader: false,
    showBorders: false,
    showAlternatingRows: false,
  },
  totals: {
    showDiscount: true,
    discountLabel: 'À Vista:',
    discountPercent: 0,
    showInstallments: true,
    installmentLabel: 'Parcelado:',
    position: 'summary_bottom',
  },
  observations: { fontStyle: 'normal' },
  footer: { style: 'bar', textAlignment: 'center' },
  sectionsOrder: ['header', 'client', 'budget_table', 'totals', 'observations', 'footer'],
};

export const PDF_PRESETS: Record<string, PdfPreset> = {
  classic: PRESET_CLASSIC,
  modern: PRESET_MODERN,
  bold: PRESET_BOLD,
};
