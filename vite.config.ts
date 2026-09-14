import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Let Rollup split shared code according to the lazy route graph. Large
    // manual groups forced every visitor to download admin UI, motion and
    // unused Radix modules before the first page could render.
    chunkSizeWarningLimit: 700,
  },
}));
