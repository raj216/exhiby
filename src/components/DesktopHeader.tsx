import { motion } from "framer-motion";
import { Search, User, Bell, Plus } from "lucide-react";

interface DesktopHeaderProps {
  onOpenSearch?: () => void;
  onViewProfile?: () => void;
  onGoLive?: () => void;
  hideLogo?: boolean;
}

export function DesktopHeader({ onOpenSearch, onViewProfile, onGoLive, hideLogo = false }: DesktopHeaderProps) {
  return (
    <header className="sticky top-0 z-40 glass border-b border-border/20 w-full">
      <div className="w-full px-4 lg:px-6 xl:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo - Hidden on desktop when left sidebar shows it */}
          {!hideLogo && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex-shrink-0 lg:hidden"
            >
              <h1 className="font-display text-2xl text-gradient-electric">Exhiby</h1>
            </motion.div>
          )}

          {/* Spacer for desktop when logo is hidden */}
          {hideLogo && <div className="hidden lg:block w-4" />}

          {/* Search Bar - Centered and wider on desktop */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="hidden md:flex flex-1 max-w-2xl mx-4 lg:mx-8"
          >
            <button
              onClick={onOpenSearch}
              className="w-full flex items-center gap-3 px-5 py-2.5 rounded-xl bg-obsidian border border-border/30 hover:border-electric/50 transition-colors group"
            >
              <Search className="w-4 h-4 text-muted-foreground group-hover:text-electric transition-colors" />
              <span className="text-sm text-muted-foreground">Search artists, events, styles...</span>
              <kbd className="hidden lg:flex ml-auto items-center gap-1 px-2 py-0.5 rounded bg-surface text-[10px] text-muted-foreground border border-border/30">
                ⌘K
              </kbd>
            </button>
          </motion.div>

          {/* Right Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 lg:gap-3"
          >
            {/* Mobile Search */}
            <button
              onClick={onOpenSearch}
              className="md:hidden p-2 rounded-full bg-obsidian border border-border/30 hover:bg-muted/50 transition-colors"
            >
              <Search className="w-5 h-5 text-muted-foreground" />
            </button>

            {/* Go Live Button - Desktop */}
            <button
              onClick={onGoLive}
              className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-electric to-crimson text-white font-medium text-sm hover:shadow-electric transition-shadow"
            >
              <Plus className="w-4 h-4" />
              Go Live
            </button>

            {/* Notifications */}
            <button className="hidden sm:flex p-2 rounded-full bg-obsidian border border-border/30 hover:bg-muted/50 transition-colors relative">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-crimson" />
            </button>

            {/* Profile */}
            <button
              onClick={onViewProfile}
              className="p-2 rounded-full bg-obsidian border border-border/30 hover:bg-muted/50 transition-colors"
            >
              <User className="w-5 h-5 text-muted-foreground" />
            </button>
          </motion.div>
        </div>
      </div>
    </header>
  );
}
