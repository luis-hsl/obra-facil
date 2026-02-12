interface LoadingSkeletonProps {
  count?: number;
  type?: 'card' | 'kpi';
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 animate-shimmer rounded-lg w-40 mb-2.5" />
          <div className="h-3 animate-shimmer rounded-lg w-56 mb-1.5" />
          <div className="h-3 animate-shimmer rounded-lg w-24" />
        </div>
        <div className="h-6 animate-shimmer rounded-lg w-20" />
      </div>
    </div>
  );
}

function SkeletonKpi() {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
      <div className="h-3 animate-shimmer rounded-lg w-24 mb-2.5" />
      <div className="h-7 animate-shimmer rounded-lg w-32" />
    </div>
  );
}

export default function LoadingSkeleton({ count = 4, type = 'card' }: LoadingSkeletonProps) {
  if (type === 'kpi') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonKpi key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
