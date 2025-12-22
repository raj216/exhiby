import { motion } from "framer-motion";
import { useUserMode } from "@/contexts/UserModeContext";
import { triggerHaptic } from "@/lib/haptics";
import { Pencil, Droplets, Palette, Brush, Scissors, Container, Gem, LayoutGrid } from "lucide-react";

const categories = [
  { id: "all", name: "All", icon: LayoutGrid },
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

export function LeftSidebar({ onSelectCategory, activeCategory = "All" }: LeftSidebarProps) {
  const { mode } = useUserMode();

  return (
    <aside className="hidden lg:flex flex-col w-[280px] min-w-[260px] max-w-[320px] h-screen sticky top-0 bg-carbon border-r border-border/20">
      {/* Logo / Brand */}
      <div className="p-5 border-b border-border/20">
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="font-logo text-2xl text-gradient-electric"
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
            const isActive = activeCategory === cat.name;
            
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
                  isActive
                    ? "bg-electric/15 text-electric border border-electric/30"
                    : "text-foreground/80 hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <IconComponent className={`w-4 h-4 ${isActive ? "text-electric" : "text-muted-foreground"}`} />
                {cat.name}
                {isActive && (
                  <motion.div
                    layoutId="category-indicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-electric"
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </nav>

    </aside>
  );
}
