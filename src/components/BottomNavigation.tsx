import { motion } from "framer-motion";
import { Home, Search, User, Compass, BarChart3, Menu, Palette } from "lucide-react";
import { triggerClickHaptic } from "@/lib/haptics";

type AudienceTab = "home" | "search" | "passport" | "profile";
type CreatorTab = "studio" | "insights" | "menu" | "profile";

interface BottomNavigationProps {
  mode: "audience" | "creator";
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const audienceTabs: { id: AudienceTab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "search", label: "Search", icon: Search },
  { id: "passport", label: "Passport", icon: Compass },
  { id: "profile", label: "Profile", icon: User },
];

const creatorTabs: { id: CreatorTab; label: string; icon: typeof Palette }[] = [
  { id: "studio", label: "Studio", icon: Palette },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "menu", label: "Menu", icon: Menu },
  { id: "profile", label: "Profile", icon: User },
];

export function BottomNavigation({ mode, activeTab, onTabChange }: BottomNavigationProps) {
  const tabs = mode === "audience" ? audienceTabs : creatorTabs;
  const accentColor = mode === "creator" ? "text-electric" : "text-foreground";

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
    >
      <div className="bg-carbon/95 backdrop-blur-xl border-t border-border/30 px-2 pb-6 pt-2 max-w-lg mx-auto">
        <div className="flex items-center justify-around">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  triggerClickHaptic();
                  onTabChange(tab.id);
                }}
                className="flex flex-col items-center gap-1 py-2 px-4 relative"
              >
                <motion.div
                  animate={{
                    scale: isActive ? 1.1 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  <tab.icon
                    className={`w-5 h-5 transition-colors ${
                      isActive ? accentColor : "text-muted-foreground"
                    }`}
                  />
                </motion.div>
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    isActive ? accentColor : "text-muted-foreground"
                  }`}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="navIndicator"
                    className={`absolute -top-1 w-8 h-0.5 rounded-full ${
                      mode === "creator" ? "bg-electric" : "bg-foreground"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
