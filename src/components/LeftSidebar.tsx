import { motion } from "framer-motion";
import { useUserMode } from "@/contexts/UserModeContext";
import { triggerHaptic } from "@/lib/haptics";
import { Pencil, Droplets, Palette, Brush, Scissors, Container, Gem } from "lucide-react";

const categories = [
  { id: "1", name: "Pencil Art", icon: Pencil },
  { id: "2", name: "Watercolor", icon: Droplets },
  { id: "3", name: "Oil Painting", icon: Palette },
  { id: "4", name: "Acrylic", icon: Brush },
  { id: "5", name: "Handmade Art", icon: Scissors },
  { id: "6", name: "Pottery", icon: Container },
  { id: "7", name: "Jewelry", icon: Gem },
];

interface LeftSidebarProps {
  onSelectCategory?: (category: string) => void;
  activeCategory?: string;
}

export function LeftSidebar({ onSelectCategory, activeCategory }: LeftSidebarProps) {
  const { mode } = useUserMode();

  return (
    <aside className="hidden lg:flex flex-col w-[280px] min-w-[260px] max-w-[320px] h-screen sticky top-0 bg-carbon border-r border-border/20">
      {/* Logo / Brand */}
      <div className="p-5 border-b border-border/20">
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="font-display text-2xl text-gradient-electric"
        >
          Exhiby
        </motion.h1>
      </div>

      {/* Categories List */}
      <nav className="flex-1 overflow-y-auto p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 px-3">
          Categories
        </p>
        <div className="space-y-1">
          {categories.map((cat, index) => {
            const IconComponent = cat.icon;
            return (
              <motion.button
                key={cat.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => {
                  triggerHaptic("light");
                  onSelectCategory?.(cat.name);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                  activeCategory === cat.name
                    ? "bg-electric/15 text-electric border border-electric/30"
                    : "text-foreground/80 hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <IconComponent className={`w-4 h-4 ${activeCategory === cat.name ? "text-electric" : "text-muted-foreground"}`} />
                {cat.name}
              </motion.button>
            );
          })}
        </div>
      </nav>

      {/* User Block - Sticky Bottom */}
      <div className="p-4 border-t border-border/20 bg-carbon">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-obsidian border border-border/30"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-electric to-crimson flex items-center justify-center">
              <span className="text-white font-semibold text-sm">MC</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">Hi, Marcus</p>
              <p className="text-xs text-muted-foreground capitalize">{mode}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </aside>
  );
}
