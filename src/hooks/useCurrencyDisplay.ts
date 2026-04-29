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

function getLocalCurrencyCode(): string {
  try {
    const region = new Intl.Locale(navigator.language).region ?? "";
    return REGION_TO_CURRENCY[region] ?? "USD";
  } catch { return "USD"; }
}

async function getExchangeRates(): Promise<Record<string, number> | null> {
  try {
    const cached = localStorage.getItem(RATE_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < RATE_CACHE_TTL) return parsed.rates;
    }
  } catch { /* ignore */ }
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) return null;
    const data = await res.json();
    if (data.result !== "success") return null;
    localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rates: data.rates, timestamp: Date.now() }));
    return data.rates;
  } catch { return null; }
}

export function useCurrencyDisplay(usdAmount: number | null): { localAmountStr: string | null; isLoading: boolean } {
  const [localAmountStr, setLocalAmountStr] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const currencyCode = getLocalCurrencyCode();
    if (!usdAmount || usdAmount <= 0 || currencyCode === "USD") {
      setLocalAmountStr(null);
      setIsLoading(false);
      return;
    }
    getExchangeRates().then((rates) => {
      if (!rates?.[currencyCode]) { setLocalAmountStr(null); setIsLoading(false); return; }
      const converted = usdAmount * rates[currencyCode];
      const formatted = new Intl.NumberFormat(navigator.language, {
        style: "currency", currency: currencyCode,
        maximumFractionDigits: converted >= 100 ? 0 : 2,
      }).format(converted);
      setLocalAmountStr(`≈ ${formatted}`);
      setIsLoading(false);
    });
  }, [usdAmount]);

  return { localAmountStr, isLoading };
}
