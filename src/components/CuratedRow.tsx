import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { StudioCard, CreatorStatus } from "./StudioCard";
import { EventTiming } from "@/hooks/useEventStatus";
import { useRef, useState, useEffect } from "react";

export interface CuratedItem {
  id: string;
  image: string;
  artistName: string;
  timing?: EventTiming;
  status?: CreatorStatus;
  scheduledTime?: string;
  eventTitle?: string;
  price?: number;
}

interface CuratedRowProps {
  title: string;
  items: CuratedItem[];
  onCardTap: (item: CuratedItem, status: CreatorStatus) => void;
}

export function CuratedRow({ title, items, onCardTap }: CuratedRowProps) {
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
      const scrollAmount = scrollRef.current.clientWidth * 0.6;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between px-4 lg:px-8 mb-4">
        <h3 className="font-display text-lg lg:text-xl text-foreground">{title}</h3>
        <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-electric transition-colors">
          See all
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Items with arrows */}
      <div className="relative group px-4 lg:px-8">
        {/* Left Arrow */}
        {canScrollLeft && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => scroll("left")}
            className="hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-carbon/90 border border-border/50 items-center justify-center shadow-lg backdrop-blur-sm hover:bg-obsidian transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-foreground rotate-180" />
          </motion.button>
        )}

        {/* Right Arrow */}
        {canScrollRight && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => scroll("right")}
            className="hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-carbon/90 border border-border/50 items-center justify-center shadow-lg backdrop-blur-sm hover:bg-obsidian transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-foreground" />
          </motion.button>
        )}

        {/* Scrollable Container */}
        <div
          ref={scrollRef}
          className="flex gap-3 lg:gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        >
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="snap-start flex-shrink-0 w-28 sm:w-32 md:w-36 lg:w-32 xl:w-36"
            >
              <StudioCard
                id={item.id}
                image={item.image}
                artistName={item.artistName}
                timing={item.timing}
                status={item.status}
                scheduledTime={item.scheduledTime}
                eventTitle={item.eventTitle}
                price={item.price}
                onTap={(status) => onCardTap(item, status)}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
