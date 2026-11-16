import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = path.dirname(fileURLToPath(import.meta.url));

// Static GitHub Pages build. `npm run dev` keeps using vite.config.ts.
// Auth stays off so the game is playable without a server.
// Vite root is pages/, so src/styles.css uses @source "../src" to keep Tailwind utilities.
process.env.VITE_AUTH_ENABLED ??= "false";

export default defineConfig({
  base: "/terkerder/",
  root: path.join(root, "pages"),
  publicDir: path.join(root, "public"),
  envDir: root,
  resolve: {
    alias: { "@": path.join(root, "src") },
  },
  plugins: [tailwindcss(), viteReact()],
  build: {
    outDir: path.join(root, "dist-pages"),
    emptyOutDir: true,
    sourcemap: false,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
});
