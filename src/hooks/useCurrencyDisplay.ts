import { useState, useEffect } from "react";

const REGION_TO_CURRENCY: Record<string, string> = {
  US: "USD", GB: "GBP", IN: "INR", CA: "CAD", AU: "AUD",
  JP: "JPY", CN: "CNY", MX: "MXN", BR: "BRL", KR: "KRW",
  SG: "SGD", HK: "HKD", CH: "CHF", SE: "SEK", NO: "NOK",
  DK: "DKK", NZ: "NZD", ZA: "ZAR", AE: "AED", TR: "TRY",
  PH: "PHP", ID: "IDR", MY: "MYR", TH: "THB", PK: "PKR",
  NG: "NGN", KE: "KES", EG: "EGP", AR: "ARS", CO: "COP",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR",
  PT: "EUR", AT: "EUR", BE: "EUR", FI: "EUR", GR: "EUR", IE: "EUR",
};

const RATE_CACHE_KEY = "exhiby_fx_rates";
const RATE_CACHE_TTL = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4000;

function getLocalCurrencyCode(countryCode?: string | null): string {
  // Prefer explicit country code from server-side detection
  if (countryCode && REGION_TO_CURRENCY[countryCode]) {
    return REGION_TO_CURRENCY[countryCode];
  }
  try {
    const region = new Intl.Locale(navigator.language).region ?? "";
    return REGION_TO_CURRENCY[region] ?? "USD";
  } catch {
    return "USD";
  }
}

async function getExchangeRates(): Promise<Record<string, number> | null> {
  // Try cache first — never throw
  try {
    const cached = localStorage.getItem(RATE_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.rates && Date.now() - parsed.timestamp < RATE_CACHE_TTL) {
        return parsed.rates;
      }
    }
  } catch { /* ignore */ }

  // Network fetch with timeout — silently fall back to null on any failure
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.result !== "success" || !data?.rates) return null;
    try {
      localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rates: data.rates, timestamp: Date.now() }));
    } catch { /* storage full / disabled — non-fatal */ }
    return data.rates;
  } catch {
    return null;
  }
}

function safeFormat(amount: number, currencyCode: string): string | null {
  try {
    return new Intl.NumberFormat(navigator.language, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    }).format(amount);
  } catch {
    return null;
  }
}

/**
 * Returns a localized "≈ €99" approximation string for a USD amount.
 * Gracefully returns `null` (no string rendered) when:
 *   - the user is in USD region
 *   - country/locale detection failed
 *   - exchange-rate fetch failed or timed out
 *   - the resolved currency code is invalid
 * Consumers should render `{localAmountStr && <span>{localAmountStr}</span>}`.
 */
export function useCurrencyDisplay(
  usdAmount: number | null,
  countryCode?: string | null,
): { localAmountStr: string | null; isLoading: boolean } {
  const [localAmountStr, setLocalAmountStr] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        if (!usdAmount || usdAmount <= 0) {
          if (!cancelled) { setLocalAmountStr(null); setIsLoading(false); }
          return;
        }

        const currencyCode = getLocalCurrencyCode(countryCode);
        if (currencyCode === "USD") {
          if (!cancelled) { setLocalAmountStr(null); setIsLoading(false); }
          return;
        }

        const rates = await getExchangeRates();
        if (cancelled) return;

        const rate = rates?.[currencyCode];
        if (!rate || !Number.isFinite(rate) || rate <= 0) {
          setLocalAmountStr(null);
          setIsLoading(false);
          return;
        }

        const converted = usdAmount * rate;
        const formatted = safeFormat(converted, currencyCode);
        setLocalAmountStr(formatted ? `≈ ${formatted}` : null);
      } catch {
        // Belt-and-suspenders: never let this hook throw
        if (!cancelled) setLocalAmountStr(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    setIsLoading(true);
    run();

    return () => { cancelled = true; };
  }, [usdAmount, countryCode]);

  return { localAmountStr, isLoading };
}
