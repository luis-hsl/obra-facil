import { hexToRgb } from '../imageUtils';
import { PDF_PRESETS } from './presets';
import type { PdfBrandConfig, ResolvedPdfStyle } from '../../types/pdfTokens';

type RGB = [number, number, number];

/** Clareia uma cor hex (amount 0-1, onde 1 = branco) */
function lightenHex(hex: string, amount: number): RGB {
  const [r, g, b] = hexToRgb(hex);
  return [
    Math.min(255, r + Math.round((255 - r) * amount)),
    Math.min(255, g + Math.round((255 - g) * amount)),
    Math.min(255, b + Math.round((255 - b) * amount)),
  ];
}

const DENSITY_MAP = {
  compact:  { margins: 10, sectionSpacing: 4,  rowPadding: 4,  headerHeight: 32, titleSize: 16, headingSize: 10, bodySize: 9,  smallSize: 7 },
  normal:   { margins: 15, sectionSpacing: 8,  rowPadding: 6,  headerHeight: 40, titleSize: 18, headingSize: 11, bodySize: 10, smallSize: 8 },
  spacious: { margins: 20, sectionSpacing: 12, rowPadding: 8,  headerHeight: 48, titleSize: 20, headingSize: 12, bodySize: 11, smallSize: 9 },
} as const;

const LOGO_SIZE_MAP = { small: 15, medium: 25 } as const;

/**
 * Resolve tokens semânticos → valores concretos para o renderer jsPDF.
 * Função pura, sem side effects.
 */
export function resolveTokens(
  config: PdfBrandConfig,
  logoBase64: string | null,
): ResolvedPdfStyle {
  const preset = PDF_PRESETS[config.templateId] || PDF_PRESETS.modern;
  const d = DENSITY_MAP[config.layout.density];
  const c = config.colors;

  const primary = hexToRgb(c.primary);
  const secondary = hexToRgb(c.secondary);
  const text = hexToRgb(c.text);
  const muted = hexToRgb(c.muted);
  const border = hexToRgb(c.border);

  return {
    fontFamily: config.typography.fontFamily,
    headingWeight: config.typography.headingWeight,
    bodyWeight: 'normal', // jsPDF only supports normal/bold/italic

    colors: {
      primary,
      secondary,
      text,
      muted,
      border,
      // Derivados do preset + tokens
      headerBg: preset.header.showBackground ? primary : null,
      headerText: preset.header.showBackground ? [255, 255, 255] : primary,
      tableHeaderBg: primary,
      tableHeaderText: [255, 255, 255],
      tableRowAltBg: preset.budgetTable.showAlternatingRows ? lightenHex(c.border, 0.5) : null,
      priceHighlight: secondary,
      separatorColor: primary,
      footerText: muted,
      clientSectionBg: preset.clientSection.style === 'card' ? lightenHex(c.border, 0.6) : null,
      clientSectionBorder: preset.clientSection.showBorder ? border : null,
    },

    margins: { top: d.margins, right: d.margins, bottom: d.margins, left: d.margins },
    sectionSpacing: d.sectionSpacing,
    rowPadding: d.rowPadding,
    headerHeight: d.headerHeight,
    logoMaxHeight: LOGO_SIZE_MAP[config.logo.size],

    fontSizes: {
      title: d.titleSize,
      heading: d.headingSize,
      body: d.bodySize,
      small: d.smallSize,
      footer: d.smallSize,
    },

    preset,
    logoBase64,
    logoAlignment: config.logo.alignment,
  };
}
