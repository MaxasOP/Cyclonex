import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor libraries into separate chunks
          "three": ["three"],
          "leaflet": ["leaflet", "react-leaflet"],
          "google-maps": ["@vis.gl/react-google-maps"],
        }
      }
    }
  }
});
