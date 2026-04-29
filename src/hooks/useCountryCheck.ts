import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CountryCheckResult {
  countryCode: string | null;
  countryName: string | null;
  isUS: boolean;
  isLoading: boolean;
  hasChecked: boolean;
}

const CACHE_KEY = "exhiby_country_check";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CachedCountry {
  country_code: string | null;
  country_name: string | null;
  timestamp: number;
}

export function useCountryCheck(userId: string | undefined): CountryCheckResult {
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [countryName, setCountryName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (!userId) { setIsLoading(false); return; }

    const detect = async () => {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed: CachedCountry = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
            setCountryCode(parsed.country_code);
            setCountryName(parsed.country_name);
            setIsLoading(false);
            setHasChecked(true);
            return;
          }
        }
      } catch { /* ignore */ }

      try {
        const { data, error } = await supabase.functions.invoke("detect-country");
        if (error) { console.error("[useCountryCheck]", error); return; }
        const code = data?.country_code ?? null;
        const name = data?.country_name ?? null;
        setCountryCode(code);
        setCountryName(name);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ country_code: code, country_name: name, timestamp: Date.now() }));
      } catch (err) {
        console.error("[useCountryCheck] Unexpected:", err);
      } finally {
        setIsLoading(false);
        setHasChecked(true);
      }
    };

    detect();
  }, [userId]);

  return { countryCode, countryName, isUS: countryCode === "US", isLoading, hasChecked };
}
