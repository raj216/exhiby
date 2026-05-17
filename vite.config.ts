import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Production only: mark console.log/info/debug as side-effect-free so the
  // minifier drops them. console.error and console.warn are intentionally NOT
  // listed — real error reporting must survive in production. In dev (mode !==
  // "production") nothing is stripped, so local debugging is unaffected.
  esbuild: {
    pure:
      mode === "production"
        ? ["console.log", "console.info", "console.debug"]
        : [],
  },
  build: {
    // Warn at 400 KB (down from default 500 KB) to catch chunk bloat earlier
    chunkSizeWarningLimit: 400,
    // Stop eagerly <link rel="modulepreload">-ing vendor chunks that are NOT
    // needed for the first paint of the auth/landing page. These were stealing
    // mobile bandwidth from the render-blocking CSS, delaying FCP.
    // The chunks still load normally the moment their code is actually imported
    // — this only removes the speculative preload hint. Purely a network
    // prioritisation change; zero functional/behaviour impact.
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter(
          (dep) =>
            !dep.includes("vendor-date") &&   // date-fns: no dates on login screen
            !dep.includes("vendor-daily"),    // Daily WebRTC: live room only
        ),
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — cached permanently, changes almost never
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // Animation — large library, rarely changes
          "vendor-motion": ["framer-motion"],
          // Supabase client — separate so it can be cached independently
          "vendor-supabase": ["@supabase/supabase-js"],
          // Query layer
          "vendor-query": ["@tanstack/react-query"],
          // Daily.co WebRTC SDK — very large, only needed in live room
          "vendor-daily": ["@daily-co/daily-js"],
          // Date utilities — used across many pages
          "vendor-date": ["date-fns"],
        },
      },
    },
  },
}));
