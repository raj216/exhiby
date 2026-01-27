import { useState, useRef, useCallback, useEffect } from "react";
import { triggerHaptic } from "@/lib/haptics";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
  disabled?: boolean;
}

interface UsePullToRefreshReturn {
  pullDistance: number;
  isRefreshing: boolean;
  isPulling: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  indicatorStyle: React.CSSProperties;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  
  const containerRef = useRef<HTMLElement | null>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const isPullingRef = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    // Only start pull if at the top of the scroll container
    if (container.scrollTop <= 0) {
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPullingRef.current || disabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    currentYRef.current = e.touches[0].clientY;
    const delta = currentYRef.current - startYRef.current;
    
    // Only allow pulling down, not up
    if (delta > 0 && container.scrollTop <= 0) {
      // Apply resistance - the further you pull, the harder it gets
      const resistance = 0.5;
      const adjustedDelta = Math.min(delta * resistance, maxPull);
      
      setPullDistance(adjustedDelta);
      setIsPulling(true);
      
      // Haptic feedback when crossing threshold
      if (adjustedDelta >= threshold && pullDistance < threshold) {
        triggerHaptic("light");
      }
      
      // Prevent default scrolling when pulling
      if (adjustedDelta > 5) {
        e.preventDefault();
      }
    }
  }, [disabled, isRefreshing, maxPull, threshold, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current || disabled) return;
    
    isPullingRef.current = false;
    setIsPulling(false);
    
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      triggerHaptic("medium");
      
      try {
        await onRefresh();
      } catch (error) {
        console.error("[PullToRefresh] Refresh failed:", error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Animate back to 0
      setPullDistance(0);
    }
  }, [disabled, pullDistance, threshold, isRefreshing, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, disabled]);

  // Calculate indicator style
  const indicatorStyle: React.CSSProperties = {
    transform: `translateY(${pullDistance - 40}px)`,
    opacity: Math.min(pullDistance / threshold, 1),
    transition: isPulling ? "none" : "transform 0.3s ease, opacity 0.3s ease",
  };

  return {
    pullDistance,
    isRefreshing,
    isPulling,
    containerRef,
    indicatorStyle,
  };
}
