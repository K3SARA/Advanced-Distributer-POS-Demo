import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@lucky/shared": path.resolve(__dirname, "./src/shared.js")
    }
  },
  plugins: [
    react({
      babel: {
        compact: false,
      }
    }),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: false, // We already have manifest.webmanifest in public
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg}"],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: true
      }
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true
  }
});
