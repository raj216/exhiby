// Generates public/sitemap.xml. Runs before dev/build via predev/prebuild hooks.
// Fetches public events and creator profiles from Supabase REST so dynamic routes
// (/s/:sessionId, /profile/:userId) get one entry per real row.
// Network/auth failures fall back to the static route list — never block the build.

import { writeFileSync, readFileSync, existsSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://joinexhiby.com";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/explore", changefreq: "hourly", priority: "0.9" },
  { path: "/browse", changefreq: "hourly", priority: "0.9" },
  { path: "/schedule", changefreq: "daily", priority: "0.7" },
  { path: "/pricing", changefreq: "weekly", priority: "0.8" },
  { path: "/auth", changefreq: "monthly", priority: "0.5" },
];

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  const envPath = resolve(".env");
  if (existsSync(envPath)) {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const val = m[2].replace(/^["']|["']$/g, "");
      if (!env[m[1]]) env[m[1]] = val;
    }
  }
  return env;
}

async function fetchDynamic(env: Record<string, string>): Promise<SitemapEntry[]> {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];

  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const entries: SitemapEntry[] = [];

  try {
    // Public events: anything with a scheduled_at; RLS may restrict to public rows.
    const eventsRes = await fetch(
      `${url}/rest/v1/events?select=id,scheduled_at,live_ended_at&order=scheduled_at.desc&limit=1000`,
      { headers }
    );
    if (eventsRes.ok) {
      const rows = (await eventsRes.json()) as Array<{ id: string; scheduled_at: string | null; live_ended_at: string | null }>;
      for (const r of rows) {
        entries.push({
          path: `/s/${r.id}`,
          lastmod: (r.live_ended_at || r.scheduled_at || undefined)?.slice(0, 10),
          changefreq: "weekly",
          priority: "0.6",
        });
      }
    }
  } catch (err) {
    console.warn("[sitemap] events fetch failed:", (err as Error).message);
  }

  try {
    const profilesRes = await fetch(
      `${url}/rest/v1/profiles?select=user_id,handle&limit=1000`,
      { headers }
    );
    if (profilesRes.ok) {
      const rows = (await profilesRes.json()) as Array<{ user_id: string; handle: string | null }>;
      for (const r of rows) {
        entries.push({ path: `/profile/${r.user_id}`, changefreq: "weekly", priority: "0.6" });
        if (r.handle) {
          entries.push({ path: `/user/${r.handle}`, changefreq: "weekly", priority: "0.6" });
        }
      }
    }
  } catch (err) {
    console.warn("[sitemap] profiles fetch failed:", (err as Error).message);
  }

  return entries;
}

function generateSitemap(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n")
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

async function main() {
  const env = loadEnv();
  const dynamic = await fetchDynamic(env);
  const entries = [...staticEntries, ...dynamic];
  writeFileSync(resolve("public/sitemap.xml"), generateSitemap(entries));
  console.log(`sitemap.xml written (${entries.length} entries: ${staticEntries.length} static + ${dynamic.length} dynamic)`);
}

main().catch((err) => {
  console.warn("[sitemap] generation failed, keeping existing file:", err);
});
