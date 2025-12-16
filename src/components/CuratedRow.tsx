import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { StudioCard, CreatorStatus } from "./StudioCard";

export interface CuratedItem {
  id: string;
  image: string;
  artistName: string;
  status: CreatorStatus;
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
  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-4">
        <h3 className="font-display text-xl text-foreground">{title}</h3>
        <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-electric transition-colors">
          See all
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Items */}
      <div className="scroll-snap-x gap-3 px-4">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <StudioCard
              id={item.id}
              image={item.image}
              artistName={item.artistName}
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
  );
}