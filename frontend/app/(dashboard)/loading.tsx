function CardSkeleton() {
  return <div className="h-24 animate-pulse rounded-2xl bg-gray-200" />;
}

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-foreground/5 py-4">
      <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-1/4 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-32 animate-pulse rounded-3xl bg-gray-200" />

      <div className="grid gap-4 md:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      <div className="h-96 animate-pulse rounded-3xl bg-gray-100 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-10 w-24 animate-pulse rounded-xl bg-gray-200" />
        </div>
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
