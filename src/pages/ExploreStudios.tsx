import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/categories";
import { triggerHaptic } from "@/lib/haptics";

interface CreatorProfile {
  name: string;
  avatar_url: string | null;
  user_id: string;
}

interface StudioItem {
  id: string;
  creator_id: string;
  category: string | null;
  status: "live" | "scheduled" | "quiet";
  creator?: CreatorProfile;
}

export default function ExploreStudios() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [studios, setStudios] = useState<StudioItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all studios (live events, scheduled events, and creators without active events)
  useEffect(() => {
    const fetchStudios = async () => {
      try {
        // Fetch live events
        const { data: liveEvents } = await supabase
          .from("events")
          .select("id, creator_id, category")
          .eq("is_live", true)
          .is("live_ended_at", null);

        // Fetch scheduled events
        const { data: scheduledEvents } = await supabase
          .from("events")
          .select("id, creator_id, category")
          .gt("scheduled_at", new Date().toISOString())
          .eq("is_live", false);

        // Get all creator profiles
        const { data: profiles } = await supabase.rpc("get_all_public_profiles");

        const profileMap = new Map(
          (profiles || []).map((p: CreatorProfile) => [p.user_id, p])
        );

        // Build studio list
        const studioList: StudioItem[] = [];
        const seenCreators = new Set<string>();

        // Add live studios first
        (liveEvents || []).forEach((event) => {
          studioList.push({
            id: event.id,
            creator_id: event.creator_id,
            category: event.category,
            status: "live",
            creator: profileMap.get(event.creator_id),
          });
          seenCreators.add(event.creator_id);
        });

        // Add scheduled studios
        (scheduledEvents || []).forEach((event) => {
          if (!seenCreators.has(event.creator_id)) {
            studioList.push({
              id: event.id,
              creator_id: event.creator_id,
              category: event.category,
              status: "scheduled",
              creator: profileMap.get(event.creator_id),
            });
            seenCreators.add(event.creator_id);
          }
        });

        // Add quiet studios (creators without active/scheduled events)
        (profiles || []).forEach((profile: CreatorProfile) => {
          if (!seenCreators.has(profile.user_id)) {
            studioList.push({
              id: `quiet-${profile.user_id}`,
              creator_id: profile.user_id,
              category: null,
              status: "quiet",
              creator: profile,
            });
          }
        });

        setStudios(studioList);
      } catch (err) {
        console.error("Error fetching studios:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudios();
  }, []);

  // Filter studios by category
  const filteredStudios = useMemo(() => {
    if (selectedCategory === "All") return studios;
    return studios.filter(
      (studio) =>
        studio.category === selectedCategory ||
        studio.category?.toLowerCase().replace(/\s+/g, "-") ===
          selectedCategory.toLowerCase().replace(/\s+/g, "-")
    );
  }, [studios, selectedCategory]);

  const handleStudioTap = (studio: StudioItem) => {
    triggerHaptic("light");
    if (studio.status === "live") {
      navigate(`/live/${studio.id}`);
    } else if (studio.status === "scheduled") {
      navigate(`/event/${studio.id}`);
    } else {
      // Quiet studio - navigate to creator profile
      navigate(`/profile/${studio.creator_id}`);
    }
  };

  const handleBack = () => {
    triggerHaptic("light");
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-carbon">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-carbon/95 backdrop-blur-sm border-b border-border/20">
        <div className="flex items-center gap-4 px-4 lg:px-6 py-4">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center hover:bg-muted/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="font-display text-xl text-foreground">
              Explore Studios
            </h1>
            <p className="text-sm text-muted-foreground">
              Discover open and upcoming artist studios
            </p>
          </div>
        </div>

        {/* Category Filter */}
        <div className="px-4 lg:px-6 pb-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.name;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    triggerHaptic("light");
                    setSelectedCategory(cat.name);
                  }}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    isActive
                      ? "bg-muted/40 text-foreground border border-border/60"
                      : "bg-transparent text-muted-foreground border border-transparent hover:border-border/30"
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 lg:p-6">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="aspect-[4/5] rounded-xl bg-muted/20 animate-pulse"
              />
            ))}
          </div>
        ) : filteredStudios.length === 0 ? (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <p className="text-muted-foreground text-sm">
              Studios are preparing to open.
            </p>
          </motion.div>
        ) : (
          /* Studios Grid */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredStudios.map((studio, index) => (
              <motion.button
                key={studio.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => handleStudioTap(studio)}
                className="group text-left"
              >
                <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-obsidian border border-border/20 hover:border-border/40 transition-colors">
                  {/* Avatar as background */}
                  {studio.creator?.avatar_url ? (
                    <img
                      src={studio.creator.avatar_url}
                      alt={studio.creator.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-muted/30 to-muted/10 flex items-center justify-center">
                      <span className="text-3xl font-display text-muted-foreground/50">
                        {studio.creator?.name?.charAt(0) || "?"}
                      </span>
                    </div>
                  )}

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-carbon via-carbon/20 to-transparent" />

                  {/* Status Badge */}
                  <div className="absolute top-3 left-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        studio.status === "live"
                          ? "bg-primary/90 text-white"
                          : studio.status === "scheduled"
                          ? "bg-muted/60 text-foreground border border-border/40"
                          : "bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      {studio.status === "live"
                        ? "Live"
                        : studio.status === "scheduled"
                        ? "Scheduled"
                        : "Quiet"}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-sm font-medium text-foreground truncate">
                      {studio.creator?.name || "Unknown Artist"}
                    </p>
                    {studio.category && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {studio.category}
                      </p>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
