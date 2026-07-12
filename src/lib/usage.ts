import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";

const KEY = "pg_anon_id";
let done = false;

function getAnonId(): string {
  let id = "";
  try { id = localStorage.getItem(KEY) ?? ""; } catch { /* ignore */ }
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random().toString(36).slice(2);
    try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
  }
  return id;
}

// Récupère la version native SANS jamais bloquer : si l'appel natif ne répond
// pas en 2 s, on continue quand même (c'était la cause du ping APK manquant).
async function nativeVersion(): Promise<string> {
  try {
    const info = await Promise.race([
      App.getInfo(),
      new Promise<null>((r) => setTimeout(() => r(null), 2000)),
    ]);
    return (info as { version?: string } | null)?.version ?? "apk";
  } catch {
    return "apk";
  }
}

export async function pingUsage() {
  if (done) return;
  done = true;
  try {
    const isNative = Capacitor.isNativePlatform();
    const platform = isNative ? "apk" : "web";
    const version = isNative ? await nativeVersion() : "web";

    const { error } = await supabase.rpc("ping_usage", {
      p_anon_id: getAnonId(),
      p_platform: platform,
      p_version: version,
    });
    if (error) console.error("[usage] ping échoué:", error.message);
    else console.log("[usage] ping ok:", platform, version);
  } catch (e) {
    console.error("[usage] ping exception:", e);
  }
}
