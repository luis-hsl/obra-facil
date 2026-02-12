import { useState } from 'react';
import { donutArc, formatCurrency, CHART_COLORS } from '../../lib/financeiro/chartUtils';

interface Props {
  data: { distribuidor: number; instalador: number; extras: number };
}

const SEGMENTS = [
  { key: 'distribuidor' as const, label: 'Distribuidor', color: CHART_COLORS.amber },
  { key: 'instalador' as const, label: 'Instalador', color: CHART_COLORS.violet },
  { key: 'extras' as const, label: 'Extras', color: CHART_COLORS.slateLight },
];

const CX = 100;
const CY = 100;
const R = 80;
const INNER_R = 52;

export default function CostBreakdownChart({ data }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const total = data.distribuidor + data.instalador + data.extras;
  if (total === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm h-full">
        <p className="text-sm font-semibold text-slate-700 mb-3">Custos por Categoria</p>
        <p className="text-sm text-slate-400 text-center py-8">Sem dados no período</p>
      </div>
    );
  }

  // Build arc segments
  let startAngle = -90; // start from top
  const arcs = SEGMENTS.map((seg) => {
    const value = data[seg.key];
    const angle = (value / total) * 360;
    const arc = {
      ...seg,
      value,
      percent: (value / total) * 100,
      startAngle,
      endAngle: startAngle + angle,
    };
    startAngle += angle;
    return arc;
  }).filter(a => a.value > 0);

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-700 mb-3">Custos por Categoria</p>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Donut */}
        <div className="relative flex-shrink-0 overflow-hidden" style={{ width: 200, height: 200 }}>
          <svg viewBox="0 0 200 200" className="w-full h-full" overflow="hidden">
            {arcs.map((arc, i) => (
              <path
                key={arc.key}
                d={donutArc(
                  CX, CY,
                  hoverIdx === i ? R + 4 : R,
                  hoverIdx === i ? INNER_R - 2 : INNER_R,
                  arc.startAngle,
                  arc.endAngle
                )}
                fill={arc.color}
                opacity={hoverIdx !== null && hoverIdx !== i ? 0.4 : 1}
                className="cursor-pointer"
                style={{ transition: 'opacity 0.2s, d 0.2s' }}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              />
            ))}
            {/* Center text */}
            <text x={CX} y={CY - 6} textAnchor="middle" className="text-[10px]" fill="#94a3b8" fontWeight={500}>
              Total
            </text>
            <text x={CX} y={CY + 12} textAnchor="middle" className="text-[13px]" fill="#1e293b" fontWeight={700}>
              {formatCurrency(total)}
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2.5 flex-1 min-w-0">
          {arcs.map((arc, i) => (
            <div
              key={arc.key}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer ${
                hoverIdx === i ? 'bg-slate-50' : ''
              }`}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: arc.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700">{arc.label}</p>
                <p className="text-xs text-slate-400">{arc.percent.toFixed(1)}%</p>
              </div>
              <p className="text-sm font-bold text-slate-900">{formatCurrency(arc.value)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
