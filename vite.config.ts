// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Le prérendu de TanStack Start importe dist/server/server.js, mais Nitro nomme
// sa sortie dist/server/index.mjs. Ce plugin écrit un pont server.js qui
// ré-exporte le bundle SSR intermédiaire (qui a la bonne forme : default.fetch).
function shimPrerenderServer() {
  return {
    name: "pharmagarde:shim-prerender-server",
    writeBundle() {
      const serverDir = resolve("dist/server");
      const ssrBundle = resolve("node_modules/.nitro/vite/services/ssr/index.js");
      if (!existsSync(ssrBundle)) return;
      mkdirSync(serverDir, { recursive: true });
      const shim = resolve(serverDir, "server.js");
      writeFileSync(
        shim,
        'export { default } from "../../node_modules/.nitro/vite/services/ssr/index.js";\n',
      );
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    spa: { enabled: process.env.CAPACITOR_BUILD === "true" },
  },
  vite: {
    plugins: [shimPrerenderServer()],
  },
});
