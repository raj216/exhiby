import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Loader2 } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { useProfileSearch, SearchResult } from "@/hooks/useProfileSearch";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { useAuth } from "@/contexts/AuthContext";
import { useScrollLock } from "@/hooks/useScrollLock";

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
  onOpenOwnProfile?: () => void;
}

const categories: Category[] = [
  { id: "1", name: "Pencil Drawing", tag: "pencil" },
  { id: "2", name: "Sculpture", tag: "sculpture" },
  { id: "3", name: "Pottery", tag: "pottery" },
  { id: "4", name: "Oil Painting", tag: "oil" },
  { id: "5", name: "Digital Art", tag: "digital" },
  { id: "6", name: "Watercolor", tag: "watercolor" },
];

export function SearchOverlay({ isOpen, onClose, onSelectArtist, onJoinLive, onSelectCategory, onOpenOwnProfile }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { results: profileResults, isSearching, searchProfiles, clearResults } = useProfileSearch();
  const { recentSearches, addSearch } = useRecentSearches();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Lock body scroll when overlay is open
  useScrollLock(isOpen);

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

  const handleClear = () => {
    setQuery("");
    clearResults();
    inputRef.current?.focus();
    triggerHaptic("light");
  };

  const handleProfileClick = (profile: SearchResult) => {
    triggerHaptic("light");
    
    // Save search to recent
    addSearch(profile.name);
    
    const isSelf = user && profile.user_id === user.id;

    // If navigating away (to /profile/:id), do NOT close first.
    // Parent may be encoding the overlay open state in URL history;
    // closing would destroy the history entry and break back navigation.
    if (isSelf && onOpenOwnProfile) {
      onClose();
      onOpenOwnProfile();
    } else if (isSelf) {
      onClose();
      navigate("/", { state: { openProfile: true } });
    } else {
      // HARD FIX: pass explicit return context so PublicProfile back button
      // can return to Search even if history is empty/reset.
      const baseState =
        location.state && typeof location.state === "object" ? (location.state as Record<string, unknown>) : {};

      const returnTo = {
        pathname: location.pathname,
        search: location.search,
        state:
          location.pathname === "/"
            ? {
                ...baseState,
                openSearch: true,
              }
            : {
                ...baseState,
                openSearch: true,
              },
      };

      try {
        sessionStorage.setItem("exhiby_return_to", JSON.stringify(returnTo));
      } catch {
        // ignore
      }

      navigate(`/profile/${profile.user_id}`, {
        state: { returnTo },
      });
    }
  };

  const handleCategoryClick = (category: Category) => {
    triggerHaptic("light");
    addSearch(category.name);
    onSelectCategory(category.tag);
    onClose();
  };

  const handleRecentClick = (term: string) => {
    triggerHaptic("light");
    setQuery(term);
    searchProfiles(term);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      addSearch(query.trim());
    }
  };

  const topHit = profileResults.length > 0 ? profileResults[0] : null;
  const otherProfiles = profileResults.slice(1);
  const hasQuery = query.trim().length > 0;
  const noResults = hasQuery && !isSearching && profileResults.length === 0;

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
            <form 
              onSubmit={handleSearchSubmit}
              className="flex-shrink-0 px-4 pb-3"
              style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 1rem))' }}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
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
                    placeholder="Explore studios, artists, and process..."
                    className="w-full pl-10 pr-10 py-3 bg-transparent text-foreground placeholder:text-muted-foreground font-sans text-sm focus:outline-none"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
            </form>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 md:px-6 md:pb-6">
              <AnimatePresence mode="wait">
                {!hasQuery ? (
                  /* Discovery State - Only show real recent searches + categories (mobile/tablet only) */
                  <motion.div
                    key="discovery"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Recent Searches - Only show if user has searched something */}
                    {recentSearches.length > 0 && (
                      <section className="mb-6">
                        <h3 className="font-display text-xs text-muted-foreground mb-2 uppercase tracking-wider">Recent</h3>
                        <div className="flex flex-wrap gap-2">
                          {recentSearches.map((term, i) => (
                            <button
                              key={`${term}-${i}`}
                              onClick={() => handleRecentClick(term)}
                              className="px-3 py-1.5 rounded-full bg-obsidian border border-border/30 text-xs text-foreground hover:border-electric/50 transition-colors"
                            >
                              {term}
                            </button>
                          ))}
                        </div>
                      </section>
                    )}

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

                    {/* No Results State */}
                    {noResults && (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Search className="w-10 h-10 text-muted-foreground/50 mb-3" />
                        <p className="text-muted-foreground text-sm">No results found for "{query}"</p>
                        <p className="text-muted-foreground/70 text-xs mt-1">Try a different search term</p>
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
                                <span className="font-display text-foreground">{profile.name}</span>
                                {profile.handle && (
                                  <span className="block text-xs text-muted-foreground">@{profile.handle}</span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </section>
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
