import { useState, useRef } from 'react';
import { smoothPath, areaPath, scaleLinear, CHART_COLORS } from '../../lib/financeiro/chartUtils';
import ChartTooltip from './ChartTooltip';

interface Props {
  data: { label: string; margem: number }[];
}

const PADDING = { top: 16, right: 16, bottom: 32, left: 40 };
const VIEW_W = 720;
const VIEW_H = 220;
const CHART_W = VIEW_W - PADDING.left - PADDING.right;
const CHART_H = VIEW_H - PADDING.top - PADDING.bottom;

export default function ProfitMarginChart({ data }: Props) {
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const hasData = data.some(d => d.margem !== 0);
  if (!hasData) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-700 mb-3">Margem de Lucro (%)</p>
        <p className="text-sm text-slate-400 text-center py-8">Sem dados no período</p>
      </div>
    );
  }

  const maxM = Math.max(...data.map(d => d.margem), 40);
  const minM = Math.min(...data.map(d => d.margem), 0);
  const rangeMin = Math.min(minM, 0);
  const rangeMax = Math.max(maxM, 40);

  const points = data.map((d, i) => ({
    x: PADDING.left + (i / Math.max(data.length - 1, 1)) * CHART_W,
    y: PADDING.top + scaleLinear(d.margem, rangeMax, rangeMin, 0, CHART_H),
  }));

  const baseline = PADDING.top + CHART_H;
  const linePath = smoothPath(points, 0.25);
  const fillPath = areaPath(points, baseline, 0.25);

  // Reference line at 30%
  const refY = PADDING.top + scaleLinear(30, rangeMax, rangeMin, 0, CHART_H);

  // Y-axis labels
  const yLabels = [rangeMin, rangeMin + (rangeMax - rangeMin) * 0.33, rangeMin + (rangeMax - rangeMin) * 0.66, rangeMax].map(v => Math.round(v));

  const handleMouse = (e: React.MouseEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const idx = Math.round(((mouseX - PADDING.left) / CHART_W) * (data.length - 1));
    const clampedIdx = Math.max(0, Math.min(data.length - 1, idx));
    const scaleX = rect.width / VIEW_W;
    const scaleY = rect.height / VIEW_H;
    setHover({
      idx: clampedIdx,
      x: points[clampedIdx].x * scaleX,
      y: points[clampedIdx].y * scaleY,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-700 mb-3">Margem de Lucro (%)</p>

      <div className="relative w-full" style={{ aspectRatio: `${VIEW_W}/${VIEW_H}` }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full h-full"
          onMouseMove={handleMouse}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="marginGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.emerald} stopOpacity={0.3} />
              <stop offset="100%" stopColor={CHART_COLORS.emerald} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Y-axis grid */}
          {yLabels.map((v, i) => {
            const y = PADDING.top + scaleLinear(v, rangeMax, rangeMin, 0, CHART_H);
            return (
              <g key={i}>
                <line x1={PADDING.left} y1={y} x2={VIEW_W - PADDING.right} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
                <text x={PADDING.left - 8} y={y + 4} textAnchor="end" className="text-[9px]" fill="#94a3b8">
                  {v}%
                </text>
              </g>
            );
          })}

          {/* Reference line at 30% */}
          <line x1={PADDING.left} y1={refY} x2={VIEW_W - PADDING.right} y2={refY} stroke={CHART_COLORS.emerald} strokeDasharray="6 3" strokeWidth={1.5} opacity={0.5} />
          <text x={VIEW_W - PADDING.right + 4} y={refY + 3} className="text-[9px]" fill={CHART_COLORS.emerald} fontWeight={600}>
            30%
          </text>

          {/* Area fill */}
          <path d={fillPath} fill="url(#marginGrad)" />

          {/* Line */}
          <path d={linePath} fill="none" stroke={CHART_COLORS.emerald} strokeWidth={2.5} strokeLinecap="round" />

          {/* Dots */}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3} fill="white" stroke={CHART_COLORS.emerald} strokeWidth={2} />
          ))}

          {/* X labels */}
          {data.map((d, i) => (
            <text
              key={i}
              x={points[i].x}
              y={VIEW_H - 8}
              textAnchor="middle"
              className="text-[10px]"
              fill="#94a3b8"
              fontWeight={500}
            >
              {d.label}
            </text>
          ))}

          {/* Hover crosshair */}
          {hover && (
            <line
              x1={points[hover.idx].x} y1={PADDING.top}
              x2={points[hover.idx].x} y2={baseline}
              stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1}
            />
          )}
        </svg>

        {hover && (
          <ChartTooltip x={hover.x} y={hover.y} visible>
            <p className="font-semibold">{data[hover.idx].label}</p>
            <p>Margem: {data[hover.idx].margem.toFixed(1)}%</p>
          </ChartTooltip>
        )}
      </div>
    </div>
  );
}
