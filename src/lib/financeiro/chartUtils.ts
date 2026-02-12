// SVG chart utility functions — no external deps

export const CHART_COLORS = {
  blue: '#3b82f6',
  blueDark: '#2563eb',
  blueLight: '#93c5fd',
  emerald: '#10b981',
  emeraldDark: '#059669',
  emeraldLight: '#6ee7b7',
  red: '#ef4444',
  redDark: '#dc2626',
  amber: '#f59e0b',
  amberLight: '#fbbf24',
  violet: '#8b5cf6',
  violetLight: '#a78bfa',
  slate: '#64748b',
  slateLight: '#94a3b8',
  gray: '#9ca3af',
  grayLight: '#d1d5db',
};

/** Map value to SVG Y coordinate (0=top, height=bottom) */
export function scaleY(value: number, max: number, height: number): number {
  if (max === 0) return height;
  return height - (value / max) * height;
}

/** Linear scale mapping */
export function scaleLinear(value: number, domainMin: number, domainMax: number, rangeMin: number, rangeMax: number): number {
  if (domainMax === domainMin) return rangeMin;
  return rangeMin + ((value - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin);
}

/** SVG donut arc path (outer + inner radius) */
export function donutArc(
  cx: number, cy: number,
  r: number, innerR: number,
  startAngle: number, endAngle: number
): string {
  const angle = Math.min(endAngle - startAngle, 359.99);
  const end = startAngle + angle;
  const rad = (deg: number) => (Math.PI / 180) * deg;

  const x1 = cx + r * Math.cos(rad(startAngle));
  const y1 = cy + r * Math.sin(rad(startAngle));
  const x2 = cx + r * Math.cos(rad(end));
  const y2 = cy + r * Math.sin(rad(end));

  const ix1 = cx + innerR * Math.cos(rad(end));
  const iy1 = cy + innerR * Math.sin(rad(end));
  const ix2 = cx + innerR * Math.cos(rad(startAngle));
  const iy2 = cy + innerR * Math.sin(rad(startAngle));

  const largeArc = angle > 180 ? 1 : 0;

  return [
    `M ${x1} ${y1}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${ix1} ${iy1}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2}`,
    'Z',
  ].join(' ');
}

/** Catmull-Rom smooth path through points */
export function smoothPath(points: { x: number; y: number }[], tension = 0.3): string {
  if (points.length < 2) return '';
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return path;
}

/** Area chart path (smooth line + close to baseline) */
export function areaPath(points: { x: number; y: number }[], baseline: number, tension = 0.3): string {
  if (points.length < 2) return '';
  const line = smoothPath(points, tension);
  return `${line} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;
}

/** Compact currency: R$ 12,5k / R$ 1,2M */
export function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(1).replace('.', ',')}k`;
  return `${sign}R$ ${abs.toFixed(0)}`;
}

/** Full BRL format */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/** Format delta: ↑12% or ↓5% */
export function computeDelta(current: number, previous: number): { label: string; positive: boolean } | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return { label: current > 0 ? '↑∞' : '↓∞', positive: current > 0 };
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  return {
    label: `${delta >= 0 ? '↑' : '↓'}${Math.abs(delta).toFixed(0)}%`,
    positive: delta >= 0,
  };
}

/** Nice Y-axis scale values */
export function niceScale(max: number, ticks = 4): number[] {
  if (max <= 0) return [0];
  const rough = max / ticks;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const nice = rough / pow;
  let step: number;
  if (nice <= 1) step = 1 * pow;
  else if (nice <= 2) step = 2 * pow;
  else if (nice <= 5) step = 5 * pow;
  else step = 10 * pow;

  const result: number[] = [];
  for (let v = 0; v <= max + step * 0.1; v += step) {
    result.push(Math.round(v * 100) / 100);
  }
  return result;
}
