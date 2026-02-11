interface LoadingSkeletonProps {
  count?: number;
  type?: 'card' | 'kpi';
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-40 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-56 mb-1" />
          <div className="h-3 bg-gray-100 rounded w-24" />
        </div>
        <div className="h-6 bg-gray-200 rounded-full w-20" />
      </div>
    </div>
  );
}

function SkeletonKpi() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
      <div className="h-3 bg-gray-100 rounded w-24 mb-2" />
      <div className="h-7 bg-gray-200 rounded w-32" />
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
