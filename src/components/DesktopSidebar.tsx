import { motion } from "framer-motion";
import { Bell, ChevronRight, Clock, TrendingUp } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

const trendingTags = [
  "#Realism", "#Clay", "#Charcoal", "#Watercolor", 
  "#Pottery", "#Digital", "#Portraits", "#Miniatures"
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
    <aside className="w-full">
      <div className="sticky top-16 space-y-4 p-4 max-h-[calc(100vh-4rem)] overflow-y-auto">
        {/* Trending Tags */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-display text-sm text-foreground">Trending Tags</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {trendingTags.map((tag) => (
              <button
                key={tag}
                onClick={() => triggerHaptic("light")}
                className="px-3 py-1.5 rounded-full bg-obsidian border border-border/30 text-xs text-foreground hover:border-border/60 hover:bg-muted/20 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Studio Schedule */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm text-foreground">Studio Schedule</h3>
            <button className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
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
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/30 border border-border/40 text-muted-foreground text-xs font-medium hover:bg-muted/50 hover:text-foreground transition-colors"
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
