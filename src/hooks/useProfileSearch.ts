import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SearchResult {
  id: string;
  user_id: string;
  handle: string | null;
  name: string;
  avatar_url: string | null;
  bio: string | null;
}

export function useProfileSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchProfiles = useCallback(async (searchText: string) => {
    if (!searchText.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc("search_public_profiles", {
        search_text: searchText.trim(),
      });

      if (rpcError) {
        console.error("Search error:", rpcError);
        setError("Search failed");
        setResults([]);
        return;
      }

      setResults(data || []);
    } catch (err) {
      console.error("Search error:", err);
      setError("Search failed");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    results,
    isSearching,
    error,
    searchProfiles,
    clearResults,
  };
}
