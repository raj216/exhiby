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
  build: {
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
        },
      },
    },
    // Slightly raise the warning threshold — we know about the Daily.co chunk
    chunkSizeWarningLimit: 600,
  },
}));
