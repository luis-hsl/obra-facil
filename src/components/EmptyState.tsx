import { Link } from 'react-router-dom';

interface EmptyStateProps {
  icon?: 'clientes' | 'andamento' | 'operacional' | 'concluidos' | 'produtos' | 'financeiro' | 'busca';
  titulo: string;
  descricao?: string;
  ctaLabel?: string;
  ctaTo?: string;
}

const iconConfigs: Record<string, { svg: React.ReactNode; bgColor: string; iconColor: string }> = {
  clientes: {
    bgColor: 'bg-blue-50',
    iconColor: 'text-blue-400',
    svg: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  andamento: {
    bgColor: 'bg-amber-50',
    iconColor: 'text-amber-400',
    svg: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  operacional: {
    bgColor: 'bg-orange-50',
    iconColor: 'text-orange-400',
    svg: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  concluidos: {
    bgColor: 'bg-emerald-50',
    iconColor: 'text-emerald-400',
    svg: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  produtos: {
    bgColor: 'bg-indigo-50',
    iconColor: 'text-indigo-400',
    svg: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  financeiro: {
    bgColor: 'bg-green-50',
    iconColor: 'text-green-400',
    svg: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  busca: {
    bgColor: 'bg-slate-50',
    iconColor: 'text-slate-400',
    svg: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
};

export default function EmptyState({ icon = 'busca', titulo, descricao, ctaLabel, ctaTo }: EmptyStateProps) {
  const config = iconConfigs[icon] || iconConfigs.busca;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className={`w-16 h-16 rounded-2xl ${config.bgColor} flex items-center justify-center mb-4 ${config.iconColor}`}>
        {config.svg}
      </div>
      <p className="text-base font-semibold text-slate-500">{titulo}</p>
      {descricao && <p className="mt-1.5 text-sm text-slate-400 text-center max-w-xs">{descricao}</p>}
      {ctaLabel && ctaTo && (
        <Link
          to={ctaTo}
          className="mt-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold no-underline shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
