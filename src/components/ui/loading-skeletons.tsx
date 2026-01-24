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

/**
 * HomeScreen skeleton - shows loading state for Live Now and Studio Schedule sections
 */
export function HomeScreenSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Live Now Section Skeleton */}
      <section className="py-6">
        <div className="px-4 lg:px-6 mb-4">
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
        
        {/* Mobile: Horizontal scroll */}
        <div className="px-4 lg:hidden">
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex-shrink-0" style={{ width: 'min(65vw, 280px)' }}>
                <Skeleton className="w-full aspect-[4/5] rounded-xl" />
                <div className="pt-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Desktop: Grid */}
        <div className="hidden lg:block px-6">
          <div className="grid grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="w-full aspect-[4/5] rounded-xl" />
                <div className="pt-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Studio Schedule Section Skeleton */}
      <section className="py-6">
        <div className="px-4 lg:px-6 mb-4">
          <Skeleton className="h-7 w-40 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        
        {/* Mobile: Horizontal scroll */}
        <div className="px-4 lg:hidden">
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex-shrink-0" style={{ width: 'min(65vw, 280px)' }}>
                {/* Artist header */}
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="w-full aspect-[4/5] rounded-xl" />
                <div className="pt-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Desktop: Grid */}
        <div className="hidden lg:block px-6">
          <div className="grid grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i}>
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="w-full aspect-[4/5] rounded-xl" />
                <div className="pt-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Profile page skeleton - shows loading state for profile header and content
 */
export function ProfilePageSkeleton() {
  return (
    <div className="min-h-screen bg-carbon animate-pulse">
      {/* Cover Photo */}
      <Skeleton className="w-full h-48 sm:h-56 rounded-none" />
      
      {/* Profile Section */}
      <div className="relative px-4 -mt-16">
        {/* Avatar */}
        <Skeleton className="w-28 h-28 rounded-full border-4 border-carbon" />
        
        {/* Name & Handle */}
        <div className="mt-4 space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        
        {/* Stats */}
        <div className="flex gap-4 mt-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-3 mt-4">
          <Skeleton className="h-10 w-32 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        
        {/* Passport Line */}
        <Skeleton className="h-3 w-48 mt-4" />
      </div>
      
      {/* Tabs */}
      <div className="border-b border-border/30 mt-6">
        <div className="flex max-w-2xl mx-auto px-4 gap-4">
          <Skeleton className="h-12 flex-1" />
          <Skeleton className="h-12 flex-1" />
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="p-4 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 p-3 bg-obsidian rounded-xl">
            <Skeleton className="w-20 h-20 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Upcoming event card skeleton - matches UpcomingEventCard layout
 */
export function UpcomingEventCardSkeleton() {
  return (
    <div className="w-full animate-pulse">
      {/* Artist Header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <Skeleton className="w-8 h-8 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      
      {/* Image Container */}
      <Skeleton className="w-full aspect-[4/5] rounded-xl" />
      
      {/* Info Section */}
      <div className="pt-3 pb-1 px-1 space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

/**
 * Explore Studios page skeleton - shows loading grid for studio discovery
 */
export function ExploreStudiosSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-pulse">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="space-y-2">
          {/* Card */}
          <Skeleton className="aspect-[4/5] rounded-xl" />
        </div>
      ))}
    </div>
  );
}

/**
 * LiveRoom skeleton - shows loading state for live streaming page
 */
export function LiveRoomSkeleton() {
  return (
    <div className="fixed inset-0 bg-carbon flex flex-col animate-pulse">
      {/* Header skeleton */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="w-10 h-10 rounded-full" />
        </div>
      </div>
      
      {/* Video area skeleton */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted/30 mx-auto flex items-center justify-center">
            <Skeleton className="w-8 h-8 rounded" />
          </div>
          <Skeleton className="h-4 w-40 mx-auto" />
        </div>
      </div>
      
      {/* Controls skeleton */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4">
        <div className="flex items-center justify-center gap-4">
          <Skeleton className="w-12 h-12 rounded-full" />
          <Skeleton className="w-12 h-12 rounded-full" />
          <Skeleton className="w-12 h-12 rounded-full" />
          <Skeleton className="w-12 h-12 rounded-full" />
        </div>
      </div>
    </div>
  );
}
