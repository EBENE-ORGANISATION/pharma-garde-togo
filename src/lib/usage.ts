import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";

const KEY = "pg_anon_id";
let done = false;

function getAnonId(): string {
  let id = "";
  try { id = localStorage.getItem(KEY) ?? ""; } catch {}
  if (!id) {
    id = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(36).slice(2);
    try { localStorage.setItem(KEY, id); } catch {}
  }
  return id;
}

export async function pingUsage() {
  if (done) return;
  done = true;
  try {
    const platform = Capacitor.isNativePlatform() ? "apk" : "web";
    let version = "web";
    if (Capacitor.isNativePlatform()) {
      try { version = (await App.getInfo()).version; } catch {}
    }
    await supabase.rpc("ping_usage", {
      p_anon_id: getAnonId(),
      p_platform: platform,
      p_version: version,
    });
  } catch { /* silencieux : un échec de ping ne doit jamais gêner l'utilisateur */ }
}
