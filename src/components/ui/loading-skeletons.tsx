import { Skeleton } from "@/components/ui/skeleton";

/**
 * Reusable loading skeleton components for consistent loading states
 */

export function ProfileHeaderSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Cover Image Skeleton */}
      <Skeleton className="w-full h-32 rounded-none" />
      
      {/* Avatar and Info */}
      <div className="px-4 -mt-12 flex items-end gap-4">
        <Skeleton className="w-20 h-20 rounded-full border-4 border-carbon" />
        <div className="flex-1 space-y-2 pb-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      
      {/* Stats */}
      <div className="px-4 flex gap-6">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

export function SessionCardSkeleton() {
  return (
    <div className="flex gap-3 p-3 bg-obsidian rounded-xl animate-pulse">
      <Skeleton className="w-20 h-20 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function SessionListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SessionCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PortfolioGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-lg" />
      ))}
    </div>
  );
}

export function LiveEventCardSkeleton() {
  return (
    <div className="relative w-[280px] flex-shrink-0 animate-pulse">
      <Skeleton className="w-full aspect-[4/5] rounded-xl" />
      <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function LiveEventRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <LiveEventCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-4 bg-carbon rounded-xl">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function NotificationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 p-3 animate-pulse">
          <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SearchResultsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 p-3 animate-pulse">
          <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
