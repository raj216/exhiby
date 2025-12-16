import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

interface CuratedItem {
  id: string;
  image: string;
  artistName: string;
}

interface CuratedRowProps {
  title: string;
  items: CuratedItem[];
}

export function CuratedRow({ title, items }: CuratedRowProps) {
  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-4">
        <h3 className="font-serif text-xl text-foreground">{title}</h3>
        <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
          See all
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Items */}
      <div className="scroll-snap-x gap-3 px-4">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            className="flex-shrink-0 snap-start"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="w-28 aspect-square rounded-xl overflow-hidden bg-surface-elevated mb-2">
              <img
                src={item.image}
                alt={item.artistName}
                className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
              />
            </div>
            <p className="text-xs text-muted-foreground text-center truncate">
              {item.artistName}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
