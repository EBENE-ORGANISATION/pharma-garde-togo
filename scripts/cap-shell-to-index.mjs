import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const src = resolve(".output/public/_shell.html");
const dest = resolve(".output/public/index.html");

if (!existsSync(src)) {
  console.error(`[cap-shell-to-index] ${src} introuvable — lance "npm run build" d'abord.`);
  process.exit(1);
}

copyFileSync(src, dest);
console.log(`[cap-shell-to-index] ${src} → ${dest}`);
