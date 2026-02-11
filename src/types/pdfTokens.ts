// ============================================================
// Design Tokens — superfície de customização do PDF
// ============================================================

/** Tokens visuais controlados pelo usuário. Salvo no Supabase como brand_configs.pdf_template */
export interface PdfBrandConfig {
  version: 3;
  templateId: 'classic' | 'modern' | 'minimal';
  colors: {
    primary: string;
    secondary: string;
    text: string;
    muted: string;
    border: string;
  };
  typography: {
    fontFamily: 'helvetica' | 'times' | 'courier';
    headingWeight: 'bold' | 'normal';
    bodyWeight: 'normal' | 'light';
  };
  logo: {
    url: string | null;
    alignment: 'left' | 'center' | 'right';
    size: 'small' | 'medium';
  };
  layout: {
    density: 'compact' | 'normal' | 'spacious';
    showNotes: boolean;
    showFooter: boolean;
  };
}

/** Preset de template — estrutura fixa, hardcoded */
export interface PdfPreset {
  id: 'classic' | 'modern' | 'minimal';
  label: string;
  description: string;
  header: {
    showBackground: boolean;
    companyInfoPosition: 'right' | 'below-logo';
    titleAlignment: 'left' | 'center' | 'right';
    titleFontSize: number;
    showSeparator: boolean;
  };
  clientSection: {
    style: 'inline' | 'card';
    showBorder: boolean;
    labelBold: boolean;
  };
  budgetTable: {
    style: 'table' | 'cards' | 'list';
    columns: Array<{
      key: string;
      label: string;
      widthPercent: number;
      align: 'left' | 'center' | 'right';
    }>;
    showHeader: boolean;
    showBorders: boolean;
    showAlternatingRows: boolean;
  };
  totals: {
    showDiscount: boolean;
    discountLabel: string;
    discountPercent: number;
    showInstallments: boolean;
    installmentLabel: string;
    position: 'per_item' | 'summary_bottom';
  };
  observations: {
    fontStyle: 'italic' | 'normal';
  };
  footer: {
    style: 'line' | 'bar' | 'minimal';
    textAlignment: 'left' | 'center' | 'right';
  };
  sectionsOrder: string[];
}

type RGB = [number, number, number];

/** Estilo resolvido — saída do resolver, consumido pelo renderer */
export interface ResolvedPdfStyle {
  fontFamily: string;
  headingWeight: string;
  bodyWeight: string;
  colors: {
    primary: RGB;
    secondary: RGB;
    text: RGB;
    muted: RGB;
    border: RGB;
    headerBg: RGB | null;
    headerText: RGB;
    tableHeaderBg: RGB;
    tableHeaderText: RGB;
    tableRowAltBg: RGB | null;
    priceHighlight: RGB;
    separatorColor: RGB;
    footerText: RGB;
    clientSectionBg: RGB | null;
    clientSectionBorder: RGB | null;
  };
  margins: { top: number; right: number; bottom: number; left: number };
  sectionSpacing: number;
  rowPadding: number;
  headerHeight: number;
  logoMaxHeight: number;
  fontSizes: {
    title: number;
    heading: number;
    body: number;
    small: number;
    footer: number;
  };
  preset: PdfPreset;
  logoBase64: string | null;
  logoAlignment: 'left' | 'center' | 'right';
}
