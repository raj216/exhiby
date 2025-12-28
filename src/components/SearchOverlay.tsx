import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, CheckCircle2, Loader2 } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { useProfileSearch, SearchResult } from "@/hooks/useProfileSearch";

interface LiveEvent {
  id: string;
  title: string;
  thumbnail: string;
  artistName: string;
  viewers: number;
}

interface Category {
  id: string;
  name: string;
  tag: string;
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectArtist: (artistId: string) => void;
  onJoinLive: (eventId: string) => void;
  onSelectCategory: (tag: string) => void;
}

// Mock data for non-profile content
const trendingTags = ["#Realism", "#Clay", "#Charcoal", "#Watercolor", "#Pottery", "#Digital"];

const recommendedCategories = [
  { id: "1", name: "Pencil Drawing", tag: "pencil" },
  { id: "2", name: "Sculpture", tag: "sculpture" },
  { id: "3", name: "Pottery", tag: "pottery" },
  { id: "4", name: "Oil Painting", tag: "oil" },
  { id: "5", name: "Digital Art", tag: "digital" },
  { id: "6", name: "Watercolor", tag: "watercolor" },
];

const liveEvents: LiveEvent[] = [
  { id: "1", title: "Color Theory Masterclass", thumbnail: "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?w=300&h=200&fit=crop", artistName: "Mia Torres", viewers: 53 },
  { id: "2", title: "Ocean Series Unveiling", thumbnail: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=300&h=200&fit=crop", artistName: "Ana Perez", viewers: 89 },
  { id: "3", title: "Pottery Throwing Session", thumbnail: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=200&fit=crop", artistName: "Ben Wright", viewers: 42 },
];

const recentSearches = ["Sophie Martin", "Pottery", "#Realism"];

export function SearchOverlay({ isOpen, onClose, onSelectArtist, onJoinLive, onSelectCategory }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { results: profileResults, isSearching, searchProfiles, clearResults } = useProfileSearch();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-focus when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!isOpen) {
      setQuery("");
      clearResults();
    }
  }, [isOpen, clearResults]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        searchProfiles(query);
      }, 300);
    } else {
      clearResults();
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, searchProfiles, clearResults]);

  // Filter mock live events and categories based on query
  const matchingLive = query.trim()
    ? liveEvents.filter(
        (e) => e.title.toLowerCase().includes(query.toLowerCase()) || e.artistName.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const matchingCategories = query.trim()
    ? recommendedCategories.filter(
        (c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.tag.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const handleClear = () => {
    setQuery("");
    clearResults();
    inputRef.current?.focus();
    triggerHaptic("light");
  };

  const handleTagClick = (tag: string) => {
    triggerHaptic("light");
    setQuery(tag.replace("#", ""));
  };

  const handleProfileClick = (profile: SearchResult) => {
    triggerHaptic("light");
    onClose();
    navigate(`/profile/${profile.user_id}`);
  };

  const handleLiveClick = (event: LiveEvent) => {
    triggerHaptic("medium");
    onJoinLive(event.id);
    onClose();
  };

  const handleCategoryClick = (category: Category) => {
    triggerHaptic("light");
    onSelectCategory(category.tag);
    setQuery(category.name);
  };

  const hasResults = profileResults.length > 0 || matchingLive.length > 0 || matchingCategories.length > 0;
  const topHit = profileResults.length > 0 ? profileResults[0] : null;
  const otherProfiles = profileResults.slice(1);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 overflow-hidden flex items-start md:items-center justify-center"
          style={{ height: '100dvh' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Glass backdrop */}
          <motion.div
            className="absolute inset-0 bg-carbon/90 backdrop-blur-xl md:bg-carbon/80"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Search container */}
          <motion.div
            className="relative z-10 flex flex-col w-full h-full md:h-auto md:max-h-[80vh] md:max-w-2xl md:mx-4 md:rounded-2xl md:border md:border-border/30 md:bg-carbon/95 md:backdrop-blur-2xl md:shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            initial={{ y: -20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {/* Search Bar Header */}
            <div 
              className="flex-shrink-0 px-4 pb-3"
              style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 1rem))' }}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="p-2 rounded-full bg-obsidian/50 hover:bg-obsidian transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
                <div className="flex-1 relative glass rounded-xl border border-border/30">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search artists, events, styles..."
                    className="w-full pl-10 pr-10 py-3 bg-transparent text-foreground placeholder:text-muted-foreground font-sans text-sm focus:outline-none"
                  />
                  {query && (
                    <button
                      onClick={handleClear}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 md:px-6 md:pb-6">
              <AnimatePresence mode="wait">
                {!query.trim() ? (
                  /* Discovery State */
                  <motion.div
                    key="discovery"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Recent Searches */}
                    {recentSearches.length > 0 && (
                      <section className="mb-6">
                        <h3 className="font-display text-xs text-muted-foreground mb-2 uppercase tracking-wider">Recent</h3>
                        <div className="flex flex-wrap gap-2">
                          {recentSearches.map((term, i) => (
                            <button
                              key={i}
                              onClick={() => setQuery(term.replace("#", ""))}
                              className="px-3 py-1.5 rounded-full bg-obsidian border border-border/30 text-xs text-foreground hover:border-electric/50 transition-colors"
                            >
                              {term}
                            </button>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Trending Tags */}
                    <section className="mb-6">
                      <h3 className="font-display text-xs text-muted-foreground mb-2 uppercase tracking-wider">Trending Now</h3>
                      <div className="flex flex-wrap gap-2">
                        {trendingTags.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => handleTagClick(tag)}
                            className="px-3 py-1.5 rounded-full bg-gradient-to-r from-electric/20 to-crimson/20 border border-electric/30 text-xs text-foreground hover:border-electric/60 transition-colors"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </section>

                    {/* Recommended Categories */}
                    <section className="lg:hidden">
                      <h3 className="font-display text-xs text-muted-foreground mb-2 uppercase tracking-wider">Categories</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {recommendedCategories.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => handleCategoryClick(cat)}
                            className="p-3 rounded-lg bg-obsidian border border-border/30 text-left hover:border-gold/50 transition-colors"
                          >
                            <span className="font-sans text-sm text-foreground">{cat.name}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  </motion.div>
                ) : (
                  /* Search Results */
                  <motion.div
                    key="results"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    {/* Loading State */}
                    {isSearching && (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-electric animate-spin" />
                      </div>
                    )}

                    {/* TOP HIT - First Profile Result */}
                    {!isSearching && topHit && (
                      <section>
                        <h3 className="font-display text-sm text-muted-foreground mb-3 uppercase tracking-wider">Top Hit</h3>
                        <button
                          onClick={() => handleProfileClick(topHit)}
                          className="w-full p-4 rounded-xl bg-obsidian border border-gold/30 flex items-center gap-4 hover:border-gold/60 transition-colors"
                        >
                          <div className="relative">
                            {topHit.avatar_url ? (
                              <img
                                src={topHit.avatar_url}
                                alt={topHit.name}
                                className="w-16 h-16 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-full bg-obsidian border border-border/30 flex items-center justify-center">
                                <span className="text-2xl font-display text-muted-foreground">
                                  {topHit.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2">
                              <span className="font-display text-lg text-foreground">{topHit.name}</span>
                            </div>
                            {topHit.handle && (
                              <span className="text-sm text-muted-foreground">@{topHit.handle}</span>
                            )}
                            {topHit.bio && (
                              <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-1">{topHit.bio}</p>
                            )}
                          </div>
                        </button>
                      </section>
                    )}

                    {/* LIVE NOW */}
                    {!isSearching && matchingLive.length > 0 && (
                      <section>
                        <h3 className="font-display text-sm text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-2 h-2 bg-crimson rounded-full animate-pulse" />
                          Live Now
                        </h3>
                        <div className="space-y-3">
                          {matchingLive.map((event) => (
                            <button
                              key={event.id}
                              onClick={() => handleLiveClick(event)}
                              className="w-full rounded-xl overflow-hidden bg-obsidian border border-border/30 hover:border-crimson/50 transition-colors"
                            >
                              <div className="relative aspect-video">
                                <img
                                  src={event.thumbnail}
                                  alt={event.title}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute top-3 left-3 px-2 py-1 bg-crimson rounded-md flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                  <span className="text-xs font-bold text-white">LIVE</span>
                                </div>
                                <div className="absolute bottom-3 right-3 px-2 py-1 bg-carbon/80 backdrop-blur-sm rounded text-xs text-foreground">
                                  {event.viewers} watching
                                </div>
                              </div>
                              <div className="p-3 text-left">
                                <p className="font-display text-foreground">{event.title}</p>
                                <p className="text-sm text-muted-foreground">{event.artistName}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* OTHER PROFILES */}
                    {!isSearching && otherProfiles.length > 0 && (
                      <section>
                        <h3 className="font-display text-sm text-muted-foreground mb-3 uppercase tracking-wider">People</h3>
                        <div className="space-y-2">
                          {otherProfiles.map((profile) => (
                            <button
                              key={profile.user_id}
                              onClick={() => handleProfileClick(profile)}
                              className="w-full p-3 rounded-xl bg-obsidian border border-border/30 flex items-center gap-3 hover:border-electric/50 transition-colors"
                            >
                              {profile.avatar_url ? (
                                <img
                                  src={profile.avatar_url}
                                  alt={profile.name}
                                  className="w-12 h-12 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-obsidian border border-border/30 flex items-center justify-center">
                                  <span className="text-lg font-display text-muted-foreground">
                                    {profile.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <div className="flex-1 text-left">
                                <span className="font-sans text-foreground">{profile.name}</span>
                                {profile.handle && (
                                  <p className="text-xs text-muted-foreground">@{profile.handle}</p>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* CATEGORIES */}
                    {!isSearching && matchingCategories.length > 0 && (
                      <section className="lg:hidden">
                        <h3 className="font-display text-sm text-muted-foreground mb-3 uppercase tracking-wider">Categories</h3>
                        <div className="flex flex-wrap gap-2">
                          {matchingCategories.map((cat) => (
                            <button
                              key={cat.id}
                              onClick={() => handleCategoryClick(cat)}
                              className="px-4 py-2 rounded-full bg-obsidian border border-border/30 text-sm text-foreground hover:border-gold/50 transition-colors"
                            >
                              {cat.name}
                            </button>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* No Results */}
                    {!isSearching && !hasResults && (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">No results for "{query}"</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">Try a different search term</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
