import { motion } from "framer-motion";
import { Bell, ChevronRight, Clock, TrendingUp } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

const trendingTags = [
  "#Realism", "#Clay", "#Charcoal", "#Watercolor", 
  "#Pottery", "#Digital", "#Portraits", "#Miniatures"
];

const categories = [
  { id: "1", name: "Pencil Drawing", count: 24 },
  { id: "2", name: "Sculpture", count: 18 },
  { id: "3", name: "Pottery", count: 31 },
  { id: "4", name: "Oil Painting", count: 12 },
  { id: "5", name: "Digital Art", count: 45 },
  { id: "6", name: "Watercolor", count: 27 },
];

const upcomingEvents = [
  { id: "1", title: "Portrait Sketching", artist: "Alex Rivera", time: "15 min", price: 5 },
  { id: "2", title: "Oil Painting Basics", artist: "Emma Liu", time: "1 hour", price: 10 },
  { id: "3", title: "Digital Art Stream", artist: "Jay Kim", time: "2 hours", price: 0 },
  { id: "4", title: "Charcoal Techniques", artist: "David O.", time: "Tomorrow", price: 8 },
];

interface DesktopSidebarProps {
  onRemind?: (eventId: string) => void;
}

export function DesktopSidebar({ onRemind }: DesktopSidebarProps) {
  return (
    <aside className="hidden lg:block w-80 xl:w-96 flex-shrink-0">
      <div className="sticky top-20 space-y-6 p-4">
        {/* Trending Tags */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-electric" />
            <h3 className="font-display text-sm text-foreground">Trending Tags</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {trendingTags.map((tag) => (
              <button
                key={tag}
                onClick={() => triggerHaptic("light")}
                className="px-3 py-1.5 rounded-full bg-obsidian border border-border/30 text-xs text-foreground hover:border-electric/50 hover:text-electric transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Recommended Categories */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm text-foreground">Categories</h3>
            <button className="text-xs text-muted-foreground hover:text-electric transition-colors flex items-center gap-1">
              See all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => triggerHaptic("light")}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-obsidian/50 hover:bg-obsidian border border-transparent hover:border-border/30 transition-all"
              >
                <span className="text-sm text-foreground">{cat.name}</span>
                <span className="text-xs text-muted-foreground">{cat.count} live</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Upcoming Events */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm text-foreground">Upcoming</h3>
            <button className="text-xs text-muted-foreground hover:text-electric transition-colors flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <div
                key={event.id}
                className="p-3 rounded-xl bg-obsidian/50 border border-border/20"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.artist}</p>
                  </div>
                  <span className="price-tag text-xs flex-shrink-0 ml-2">
                    {event.price === 0 ? "Free" : `$${event.price}`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {event.time}
                  </span>
                  <button
                    onClick={() => {
                      triggerHaptic("light");
                      onRemind?.(event.id);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-electric/10 text-electric text-xs font-medium hover:bg-electric/20 transition-colors"
                  >
                    <Bell className="w-3 h-3" />
                    Remind
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </aside>
  );
}
