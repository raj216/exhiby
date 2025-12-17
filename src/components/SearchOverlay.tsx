import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, CheckCircle2 } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

interface Artist {
  id: string;
  name: string;
  avatar: string;
  isVerified: boolean;
  isLive?: boolean;
  eventTitle?: string;
}

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

// Mock data
const trendingTags = ["#Realism", "#Clay", "#Charcoal", "#Watercolor", "#Pottery", "#Digital"];

const recommendedCategories = [
  { id: "1", name: "Pencil Drawing", tag: "pencil" },
  { id: "2", name: "Sculpture", tag: "sculpture" },
  { id: "3", name: "Pottery", tag: "pottery" },
  { id: "4", name: "Oil Painting", tag: "oil" },
  { id: "5", name: "Digital Art", tag: "digital" },
  { id: "6", name: "Watercolor", tag: "watercolor" },
];

const allArtists: Artist[] = [
  { id: "1", name: "Mia Torres", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop", isVerified: true, isLive: true, eventTitle: "Color Theory" },
  { id: "2", name: "David Okonkwo", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop", isVerified: true },
  { id: "3", name: "Sophie Martin", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop", isVerified: true },
  { id: "4", name: "Kai Tanaka", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop", isVerified: false },
  { id: "5", name: "Ana Perez", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop", isVerified: true, isLive: true, eventTitle: "Ocean Series" },
  { id: "6", name: "Ben Wright", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop", isVerified: true },
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

  // Auto-focus when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  // Filter results based on query
  const filteredResults = useMemo(() => {
    if (!query.trim()) return null;

    const q = query.toLowerCase();
    
    // Find top hit (verified artists first)
    const topHit = allArtists
      .filter(a => a.name.toLowerCase().includes(q))
      .sort((a, b) => (b.isVerified ? 1 : 0) - (a.isVerified ? 1 : 0))[0];

    // Live events matching query
    const matchingLive = liveEvents.filter(
      e => e.title.toLowerCase().includes(q) || e.artistName.toLowerCase().includes(q)
    );

    // Artists matching query
    const matchingArtists = allArtists
      .filter(a => a.name.toLowerCase().includes(q) && a.id !== topHit?.id)
      .sort((a, b) => (b.isVerified ? 1 : 0) - (a.isVerified ? 1 : 0));

    // Categories matching query
    const matchingCategories = recommendedCategories.filter(
      c => c.name.toLowerCase().includes(q) || c.tag.toLowerCase().includes(q)
    );

    return { topHit, matchingLive, matchingArtists, matchingCategories };
  }, [query]);

  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
    triggerHaptic("light");
  };

  const handleTagClick = (tag: string) => {
    triggerHaptic("light");
    setQuery(tag.replace("#", ""));
  };

  const handleArtistClick = (artist: Artist) => {
    triggerHaptic("light");
    if (artist.isLive) {
      onJoinLive(artist.id);
    } else {
      onSelectArtist(artist.id);
    }
    onClose();
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 overflow-hidden"
          style={{ height: '100dvh' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Glass backdrop */}
          <motion.div
            className="absolute inset-0 bg-carbon/90 backdrop-blur-xl"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Search container - constrained to viewport */}
          <motion.div
            className="relative z-10 flex flex-col max-h-[100dvh] h-full"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {/* Floating Search Bar - sticky at top */}
            <div 
              className="flex-shrink-0 p-4 pt-6"
              style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top, 1.5rem))' }}
            >
              <div className="relative glass rounded-2xl border border-border/30">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search artists, events, styles..."
                  className="w-full pl-12 pr-12 py-4 bg-transparent text-foreground placeholder:text-muted-foreground font-sans text-base focus:outline-none"
                />
                {query && (
                  <button
                    onClick={handleClear}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            {/* Content Area - scrollable within viewport */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
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
                      <section className="mb-8">
                        <h3 className="font-display text-sm text-muted-foreground mb-3 uppercase tracking-wider">Recent</h3>
                        <div className="flex flex-wrap gap-2">
                          {recentSearches.map((term, i) => (
                            <button
                              key={i}
                              onClick={() => setQuery(term.replace("#", ""))}
                              className="px-4 py-2 rounded-full bg-obsidian border border-border/30 text-sm text-foreground hover:border-electric/50 transition-colors"
                            >
                              {term}
                            </button>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Trending Tags */}
                    <section className="mb-8">
                      <h3 className="font-display text-sm text-muted-foreground mb-3 uppercase tracking-wider">Trending Now</h3>
                      <div className="flex flex-wrap gap-2">
                        {trendingTags.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => handleTagClick(tag)}
                            className="px-4 py-2 rounded-full bg-gradient-to-r from-electric/20 to-crimson/20 border border-electric/30 text-sm text-foreground hover:border-electric/60 transition-colors"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </section>

                    {/* Recommended Categories */}
                    <section>
                      <h3 className="font-display text-sm text-muted-foreground mb-3 uppercase tracking-wider">Categories</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {recommendedCategories.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => handleCategoryClick(cat)}
                            className="p-4 rounded-xl bg-obsidian border border-border/30 text-left hover:border-gold/50 transition-colors"
                          >
                            <span className="font-sans text-foreground">{cat.name}</span>
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
                    {/* TOP HIT */}
                    {filteredResults?.topHit && (
                      <section>
                        <h3 className="font-display text-sm text-muted-foreground mb-3 uppercase tracking-wider">Top Hit</h3>
                        <button
                          onClick={() => handleArtistClick(filteredResults.topHit!)}
                          className="w-full p-4 rounded-xl bg-obsidian border border-gold/30 flex items-center gap-4 hover:border-gold/60 transition-colors"
                        >
                          <div className="relative">
                            <img
                              src={filteredResults.topHit.avatar}
                              alt={filteredResults.topHit.name}
                              className="w-16 h-16 rounded-full object-cover"
                            />
                            {filteredResults.topHit.isLive && (
                              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-crimson rounded-full flex items-center justify-center animate-pulse">
                                <span className="w-2 h-2 bg-white rounded-full" />
                              </span>
                            )}
                          </div>
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2">
                              <span className="font-display text-lg text-foreground">{filteredResults.topHit.name}</span>
                              {filteredResults.topHit.isVerified && (
                                <CheckCircle2 className="w-4 h-4 text-gold fill-gold/20" />
                              )}
                            </div>
                            {filteredResults.topHit.isLive && (
                              <span className="text-sm text-crimson font-medium">LIVE • {filteredResults.topHit.eventTitle}</span>
                            )}
                          </div>
                        </button>
                      </section>
                    )}

                    {/* LIVE NOW */}
                    {filteredResults?.matchingLive && filteredResults.matchingLive.length > 0 && (
                      <section>
                        <h3 className="font-display text-sm text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-2 h-2 bg-crimson rounded-full animate-pulse" />
                          Live Now
                        </h3>
                        <div className="space-y-3">
                          {filteredResults.matchingLive.map((event) => (
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

                    {/* ARTISTS */}
                    {filteredResults?.matchingArtists && filteredResults.matchingArtists.length > 0 && (
                      <section>
                        <h3 className="font-display text-sm text-muted-foreground mb-3 uppercase tracking-wider">Artists</h3>
                        <div className="space-y-2">
                          {filteredResults.matchingArtists.map((artist) => (
                            <button
                              key={artist.id}
                              onClick={() => handleArtistClick(artist)}
                              className="w-full p-3 rounded-xl bg-obsidian border border-border/30 flex items-center gap-3 hover:border-electric/50 transition-colors"
                            >
                              <img
                                src={artist.avatar}
                                alt={artist.name}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                              <div className="flex items-center gap-2">
                                <span className="font-sans text-foreground">{artist.name}</span>
                                {artist.isVerified && (
                                  <CheckCircle2 className="w-4 h-4 text-gold fill-gold/20" />
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* CATEGORIES */}
                    {filteredResults?.matchingCategories && filteredResults.matchingCategories.length > 0 && (
                      <section>
                        <h3 className="font-display text-sm text-muted-foreground mb-3 uppercase tracking-wider">Categories</h3>
                        <div className="flex flex-wrap gap-2">
                          {filteredResults.matchingCategories.map((cat) => (
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
                    {filteredResults && 
                     !filteredResults.topHit && 
                     filteredResults.matchingLive.length === 0 && 
                     filteredResults.matchingArtists.length === 0 && 
                     filteredResults.matchingCategories.length === 0 && (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">No results for "{query}"</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">Try a different search term</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Close hint - part of flex layout */}
            <div className="flex-shrink-0 pb-4 pt-2 flex justify-center">
              <button
                onClick={onClose}
                className="px-6 py-2 rounded-full glass border border-border/30 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Tap to close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}