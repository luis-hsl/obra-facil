import { useState, useRef } from 'react';
import type { TrendMonth } from '../../lib/financeiro/useFinanceiroData';
import { formatCurrencyCompact, formatCurrency, niceScale, CHART_COLORS } from '../../lib/financeiro/chartUtils';
import ChartTooltip from './ChartTooltip';

interface Props {
  data: TrendMonth[];
  activeMonth: string | null;
  onMonthClick: (ym: string | null) => void;
}

const PADDING = { top: 20, right: 16, bottom: 40, left: 56 };
const VIEW_W = 720;
const VIEW_H = 280;
const CHART_W = VIEW_W - PADDING.left - PADDING.right;
const CHART_H = VIEW_H - PADDING.top - PADDING.bottom;

export default function RevenueProfitChart({ data, activeMonth, onMonthClick }: Props) {
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const maxVal = Math.max(...data.map(m => Math.max(m.recebido, Math.abs(m.lucro))), 1);
  const gridValues = niceScale(maxVal);
  const scaleMax = gridValues[gridValues.length - 1] || maxVal;

  const barGroupW = CHART_W / data.length;
  const barW = barGroupW * 0.3;
  const gap = barGroupW * 0.06;

  const scaleY = (v: number) => CHART_H - (v / scaleMax) * CHART_H;

  const handleMouseMove = (_e: React.MouseEvent, idx: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = rect.width / VIEW_W;
    const scaleYRatio = rect.height / VIEW_H;
    const cx = PADDING.left + idx * barGroupW + barGroupW / 2;
    setHover({ idx, x: cx * scaleX, y: (PADDING.top + scaleY(data[idx].recebido)) * scaleYRatio - 8 });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-700">Receita & Lucro (12 meses)</p>
        <div className="flex gap-3">
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.blue }} />Receita
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.emerald }} />Lucro
          </span>
        </div>
      </div>

      {activeMonth && (
        <button
          onClick={() => onMonthClick(null)}
          className="mb-2 text-xs bg-blue-50 text-blue-700 font-semibold px-2.5 py-1 rounded-full hover:bg-blue-100"
        >
          Filtro: {data.find(m => m.yearMonth === activeMonth)?.label} ✕
        </button>
      )}

      <div className="relative w-full" style={{ aspectRatio: `${VIEW_W}/${VIEW_H}` }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full h-full"
          onMouseLeave={() => setHover(null)}
        >
          {/* Grid lines */}
          {gridValues.map((v, i) => (
            <g key={i}>
              <line
                x1={PADDING.left} y1={PADDING.top + scaleY(v)}
                x2={VIEW_W - PADDING.right} y2={PADDING.top + scaleY(v)}
                stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth={1}
              />
              <text
                x={PADDING.left - 8} y={PADDING.top + scaleY(v) + 4}
                textAnchor="end" className="text-[9px]" fill="#94a3b8"
              >
                {formatCurrencyCompact(v)}
              </text>
            </g>
          ))}

          {/* Baseline */}
          <line
            x1={PADDING.left} y1={PADDING.top + CHART_H}
            x2={VIEW_W - PADDING.right} y2={PADDING.top + CHART_H}
            stroke="#cbd5e1" strokeWidth={1}
          />

          {/* Bars */}
          {data.map((m, i) => {
            const cx = PADDING.left + i * barGroupW + barGroupW / 2;
            const isActive = activeMonth === m.yearMonth;
            const recH = (m.recebido / scaleMax) * CHART_H;
            const lucH = (Math.abs(m.lucro) / scaleMax) * CHART_H;

            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseMove={(e) => handleMouseMove(e, i)}
                onClick={() => onMonthClick(isActive ? null : m.yearMonth)}
              >
                {/* Hit area */}
                <rect
                  x={PADDING.left + i * barGroupW}
                  y={PADDING.top}
                  width={barGroupW}
                  height={CHART_H}
                  fill="transparent"
                />

                {/* Active highlight */}
                {isActive && (
                  <rect
                    x={PADDING.left + i * barGroupW + 2}
                    y={PADDING.top}
                    width={barGroupW - 4}
                    height={CHART_H}
                    fill="#eff6ff" rx={4}
                  />
                )}

                {/* Revenue bar */}
                <rect
                  x={cx - barW - gap / 2}
                  y={PADDING.top + CHART_H - recH}
                  width={barW}
                  height={Math.max(recH, 0)}
                  rx={3}
                  fill={CHART_COLORS.blue}
                  opacity={hover?.idx === i ? 1 : 0.85}
                  className="animate-grow-up"
                  style={{ animationDelay: `${i * 40}ms` }}
                />

                {/* Profit bar */}
                <rect
                  x={cx + gap / 2}
                  y={PADDING.top + CHART_H - lucH}
                  width={barW}
                  height={Math.max(lucH, 0)}
                  rx={3}
                  fill={m.lucro >= 0 ? CHART_COLORS.emerald : CHART_COLORS.red}
                  opacity={hover?.idx === i ? 1 : 0.85}
                  className="animate-grow-up"
                  style={{ animationDelay: `${i * 40 + 20}ms` }}
                />

                {/* Month label */}
                <text
                  x={cx} y={VIEW_H - 10}
                  textAnchor="middle"
                  className="text-[10px]"
                  fill={isActive ? CHART_COLORS.blue : '#94a3b8'}
                  fontWeight={isActive ? 700 : 500}
                >
                  {m.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hover && (
          <ChartTooltip x={hover.x} y={hover.y} visible>
            <p className="font-semibold mb-1">{data[hover.idx].label}</p>
            <p>Receita: {formatCurrency(data[hover.idx].recebido)}</p>
            <p>Lucro: {formatCurrency(data[hover.idx].lucro)}</p>
            <p>Margem: {data[hover.idx].margem.toFixed(1)}%</p>
          </ChartTooltip>
        )}
      </div>
    </div>
  );
}
