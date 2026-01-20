import { useEffect, useRef } from "react";

/**
 * Hook to lock body scroll when modals/sheets are open.
 * Prevents iOS rubber-band effect and ensures proper viewport sizing.
 * 
 * @param isLocked - Whether to lock the scroll
 */
export function useScrollLock(isLocked: boolean) {
  const scrollPositionRef = useRef(0);
  const originalStylesRef = useRef<{
    overflow: string;
    position: string;
    top: string;
    width: string;
    height: string;
  } | null>(null);

  useEffect(() => {
    if (isLocked) {
      // Store current scroll position
      scrollPositionRef.current = window.scrollY;
      
      // Store original styles
      originalStylesRef.current = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        top: document.body.style.top,
        width: document.body.style.width,
        height: document.body.style.height,
      };

      // Apply scroll lock styles
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollPositionRef.current}px`;
      document.body.style.width = "100%";
      document.body.style.height = "100%";
      
      // Also lock the html element for iOS
      document.documentElement.style.overflow = "hidden";
      document.documentElement.style.height = "100%";
    } else {
      // Restore original styles
      if (originalStylesRef.current) {
        document.body.style.overflow = originalStylesRef.current.overflow;
        document.body.style.position = originalStylesRef.current.position;
        document.body.style.top = originalStylesRef.current.top;
        document.body.style.width = originalStylesRef.current.width;
        document.body.style.height = originalStylesRef.current.height;
        
        // Restore scroll position
        window.scrollTo(0, scrollPositionRef.current);
      }
      
      // Restore html element
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
    }

    // Cleanup on unmount
    return () => {
      if (originalStylesRef.current) {
        document.body.style.overflow = originalStylesRef.current.overflow;
        document.body.style.position = originalStylesRef.current.position;
        document.body.style.top = originalStylesRef.current.top;
        document.body.style.width = originalStylesRef.current.width;
        document.body.style.height = originalStylesRef.current.height;
        window.scrollTo(0, scrollPositionRef.current);
      }
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
    };
  }, [isLocked]);
}
