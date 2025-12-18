import { useRef, useState, useEffect, ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CarouselWithArrowsProps {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
  showArrows?: boolean;
}

export function CarouselWithArrows({ 
  children, 
  className = "", 
  itemClassName = "",
  showArrows = true 
}: CarouselWithArrowsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll);
      window.addEventListener("resize", checkScroll);
      return () => {
        el.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
      };
    }
  }, []);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.75;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="relative group">
      {/* Left Arrow */}
      {showArrows && canScrollLeft && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => scroll("left")}
          className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-carbon/90 border border-border/50 items-center justify-center shadow-lg backdrop-blur-sm hover:bg-obsidian transition-colors -ml-5"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </motion.button>
      )}

      {/* Right Arrow */}
      {showArrows && canScrollRight && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => scroll("right")}
          className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-carbon/90 border border-border/50 items-center justify-center shadow-lg backdrop-blur-sm hover:bg-obsidian transition-colors -mr-5"
        >
          <ChevronRight className="w-5 h-5 text-foreground" />
        </motion.button>
      )}

      {/* Scroll Container */}
      <div
        ref={scrollRef}
        className={`flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
