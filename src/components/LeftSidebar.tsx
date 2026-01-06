import { motion } from "framer-motion";
import { useUserMode } from "@/contexts/UserModeContext";
import { triggerHaptic } from "@/lib/haptics";
import { CATEGORIES } from "@/lib/categories";

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
          className="font-display text-2xl font-semibold text-gradient-electric tracking-tight"
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
          {CATEGORIES.map((cat, index) => {
            const IconComponent = cat.icon;
            const isActive = activeCategory === cat.name;
            
            return (
              <motion.button
                key={cat.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  triggerHaptic("light");
                  onSelectCategory?.(cat.name);
                }}
                className={`group w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ease-out relative overflow-hidden ${
                  isActive
                    ? "text-foreground"
                    : "text-foreground/60 hover:text-foreground"
                }`}
              >
                {/* Subtle glow background for active state */}
                {isActive && (
                  <motion.div
                    layoutId="category-bg"
                    className="absolute inset-0 bg-gradient-to-r from-primary/8 via-primary/5 to-transparent border-l-2 border-primary/40"
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                
                {/* Hover glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <IconComponent className={`relative z-10 w-4 h-4 transition-colors duration-300 ${
                  isActive ? "text-primary/80" : "text-muted-foreground group-hover:text-foreground/70"
                }`} />
                <span className="relative z-10">{cat.name}</span>
                
                {/* Active indicator dot with subtle glow */}
                {isActive && (
                  <motion.div
                    layoutId="category-indicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-primary/60 shadow-[0_0_8px_rgba(255,107,88,0.3)]"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
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
