#!/usr/bin/env node
import { copyFileSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, "dist-pages");

copyFileSync(join(out, "index.html"), join(out, "404.html"));
writeFileSync(join(out, ".nojekyll"), "");
writeFileSync(
  join(out, "manifest.webmanifest"),
  `${JSON.stringify(
    {
      name: "Terkerder",
      short_name: "Terkerder",
      description:
        "A city-state economy year by year. Set policy, adopt automation, and read unemployment, wages, tax, and stability.",
      start_url: "/terkerder/",
      scope: "/terkerder/",
      display: "standalone",
      background_color: "#0e0f12",
      theme_color: "#0e0f12",
      icons: [
        {
          src: "/terkerder/__grok/icon-180.png",
          sizes: "180x180",
          type: "image/png",
        },
        {
          src: "/terkerder/favicon.svg",
          sizes: "any",
          type: "image/svg+xml",
        },
      ],
    },
    null,
    2,
  )}\n`,
);

const cssFiles = readdirSync(join(out, "assets")).filter((name) => name.endsWith(".css"));
const css = cssFiles.map((name) => readFileSync(join(out, "assets", name), "utf8")).join("\n");
for (const token of ["fixed", "inset-0", "h-dvh", "pointer-events-none", "text-gold"]) {
  if (!css.includes(token)) {
    throw new Error(`Pages CSS is missing required utility "${token}". Tailwind probably did not scan src/.`);
  }
}

console.log("Pages build ready in dist-pages (index, 404 fallback, manifest, .nojekyll).");
