import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "xb_recent_searches";
const MAX_SEARCHES = 8;

export interface RecentSearch {
  query: string;
  timestamp: number;
}

export function useRecentSearches() {
  const { user } = useAuth();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load recent searches on mount
  useEffect(() => {
    const loadSearches = async () => {
      setIsLoading(true);
      
      if (user) {
        // Fetch from Supabase for logged-in users
        try {
          const { data, error } = await supabase
            .from("recent_searches")
            .select("query")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(MAX_SEARCHES);

          if (!error && data) {
            // Deduplicate
            const uniqueQueries = [...new Set(data.map(d => d.query))];
            setRecentSearches(uniqueQueries.slice(0, MAX_SEARCHES));
          }
        } catch (err) {
          console.error("Failed to fetch recent searches:", err);
        }
      } else {
        // Load from localStorage for anonymous users
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed: RecentSearch[] = JSON.parse(stored);
            setRecentSearches(parsed.map(s => s.query).slice(0, MAX_SEARCHES));
          }
        } catch (err) {
          console.error("Failed to load local recent searches:", err);
        }
      }
      
      setIsLoading(false);
    };

    loadSearches();
  }, [user]);

  const addSearch = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    // Update local state immediately (deduplicate, most-recent-first)
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.toLowerCase() !== trimmedQuery.toLowerCase());
      return [trimmedQuery, ...filtered].slice(0, MAX_SEARCHES);
    });

    if (user) {
      // Persist to Supabase
      try {
        await supabase.from("recent_searches").insert({
          user_id: user.id,
          query: trimmedQuery,
        });
      } catch (err) {
        console.error("Failed to save search to database:", err);
      }
    } else {
      // Persist to localStorage
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const existing: RecentSearch[] = stored ? JSON.parse(stored) : [];
        const filtered = existing.filter(s => s.query.toLowerCase() !== trimmedQuery.toLowerCase());
        const updated = [{ query: trimmedQuery, timestamp: Date.now() }, ...filtered].slice(0, MAX_SEARCHES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to save search locally:", err);
      }
    }
  }, [user]);

  const clearSearches = useCallback(async () => {
    setRecentSearches([]);

    if (user) {
      try {
        await supabase.from("recent_searches").delete().eq("user_id", user.id);
      } catch (err) {
        console.error("Failed to clear searches from database:", err);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  return {
    recentSearches,
    isLoading,
    addSearch,
    clearSearches,
  };
}
