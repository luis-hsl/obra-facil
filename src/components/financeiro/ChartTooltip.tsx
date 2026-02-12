import type { ReactNode } from 'react';

interface Props {
  x: number;
  y: number;
  visible: boolean;
  children: ReactNode;
}

export default function ChartTooltip({ x, y, visible, children }: Props) {
  if (!visible) return null;

  return (
    <div
      className="absolute pointer-events-none z-10 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap animate-fade-in"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -100%) translateY(-8px)',
      }}
    >
      {children}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0"
        style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #1e293b' }}
      />
    </div>
  );
}
