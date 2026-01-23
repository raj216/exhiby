import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SearchResult {
  id: string;
  user_id: string;
  handle: string | null;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  is_verified?: boolean;
  account_type?: string;
}

export function useProfileSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hydrateResults = useCallback((next: SearchResult[], options?: { clearError?: boolean }) => {
    setResults(Array.isArray(next) ? next : []);
    if (options?.clearError !== false) setError(null);
    setIsSearching(false);
  }, []);

  const searchProfiles = useCallback(async (searchText: string) => {
    const trimmed = searchText.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    // Client-side sanitization - remove SQL wildcards as extra layer of defense
    // (backend also escapes, but this prevents obviously malicious patterns)
    const sanitized = trimmed.replace(/[%_\\]/g, '');
    if (!sanitized) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc("search_public_profiles", {
        search_text: sanitized,
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
    hydrateResults,
  };
}
