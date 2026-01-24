/**
 * Lightweight Performance Logger for Development
 * Tracks route changes, TTI, and slow queries
 */

const IS_DEV = import.meta.env.DEV;
const SLOW_QUERY_THRESHOLD_MS = 800;

interface PerformanceEntry {
  type: 'route' | 'query' | 'render';
  name: string;
  duration: number;
  timestamp: number;
}

const performanceLog: PerformanceEntry[] = [];
const routeTimers = new Map<string, number>();
const queryTimers = new Map<string, number>();

export const perfLog = {
  /**
   * Mark the start of a route navigation
   */
  routeStart(routeName: string) {
    if (!IS_DEV) return;
    const now = performance.now();
    routeTimers.set(routeName, now);
    console.log(`[PERF] 🚀 Route Start: ${routeName}`);
  },

  /**
   * Mark the end of a route navigation (first render complete)
   */
  routeEnd(routeName: string) {
    if (!IS_DEV) return;
    const start = routeTimers.get(routeName);
    if (!start) return;
    
    const duration = Math.round(performance.now() - start);
    routeTimers.delete(routeName);
    
    const entry: PerformanceEntry = {
      type: 'route',
      name: routeName,
      duration,
      timestamp: Date.now(),
    };
    performanceLog.push(entry);
    
    const emoji = duration < 300 ? '✅' : duration < 800 ? '⚠️' : '🔴';
    console.log(`[PERF] ${emoji} Route Complete: ${routeName} in ${duration}ms`);
  },

  /**
   * Mark the start of a Supabase query
   */
  queryStart(queryName: string) {
    if (!IS_DEV) return;
    queryTimers.set(queryName, performance.now());
  },

  /**
   * Mark the end of a Supabase query
   */
  queryEnd(queryName: string) {
    if (!IS_DEV) return;
    const start = queryTimers.get(queryName);
    if (!start) return;
    
    const duration = Math.round(performance.now() - start);
    queryTimers.delete(queryName);
    
    const entry: PerformanceEntry = {
      type: 'query',
      name: queryName,
      duration,
      timestamp: Date.now(),
    };
    performanceLog.push(entry);
    
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      console.warn(`[PERF] 🐌 SLOW QUERY: ${queryName} took ${duration}ms`);
    }
  },

  /**
   * Wrap a Supabase query with automatic timing
   * Returns the awaited result of the query function
   */
  async trackQuery<T>(queryName: string, queryFn: () => PromiseLike<T>): Promise<T> {
    if (!IS_DEV) return queryFn();
    
    this.queryStart(queryName);
    try {
      const result = await queryFn();
      return result;
    } finally {
      this.queryEnd(queryName);
    }
  },

  /**
   * Get summary of slow operations
   */
  getSummary() {
    const slowQueries = performanceLog
      .filter(e => e.type === 'query' && e.duration > SLOW_QUERY_THRESHOLD_MS)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
    
    const slowRoutes = performanceLog
      .filter(e => e.type === 'route')
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);
    
    console.table({ slowQueries, slowRoutes });
    return { slowQueries, slowRoutes };
  },

  /**
   * Clear the log
   */
  clear() {
    performanceLog.length = 0;
    routeTimers.clear();
    queryTimers.clear();
  },
};

// Expose to window for debugging in dev
if (IS_DEV && typeof window !== 'undefined') {
  (window as unknown as { perfLog: typeof perfLog }).perfLog = perfLog;
}
