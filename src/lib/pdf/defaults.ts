import type { PdfBrandConfig } from '../../types/pdfTokens';

export const DEFAULT_PDF_BRAND_CONFIG: PdfBrandConfig = {
  version: 3,
  templateId: 'modern',
  colors: {
    primary: '#1e40af',
    secondary: '#059669',
    text: '#374151',
    muted: '#9ca3af',
    border: '#e5e7eb',
  },
  typography: {
    fontFamily: 'helvetica',
    headingWeight: 'bold',
    bodyWeight: 'normal',
  },
  logo: {
    url: null,
    alignment: 'left',
    size: 'medium',
  },
  layout: {
    density: 'normal',
    showNotes: true,
    showFooter: true,
  },
};
