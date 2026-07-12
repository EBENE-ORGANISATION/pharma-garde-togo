import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";

const KEY = "pg_anon_id";
const DIAG_KEY = "pg_usage_diag";
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

function saveDiag(msg: string) {
  try { localStorage.setItem(DIAG_KEY, `${new Date().toISOString()} — ${msg}`); } catch { /* ignore */ }
}

export function getDiag(): string {
  try { return localStorage.getItem(DIAG_KEY) ?? "aucun ping enregistré"; } catch { return "indisponible"; }
}

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
    saveDiag(`début — natif=${isNative}, plateforme=${platform}`);

    const version = isNative ? await nativeVersion() : "web";
    const anonId = getAnonId();
    saveDiag(`envoi — ${platform} / ${version} / id=${anonId.slice(0, 8)}…`);

    const { error } = await supabase.rpc("ping_usage", {
      p_anon_id: anonId,
      p_platform: platform,
      p_version: version,
    });

    if (error) saveDiag(`ÉCHEC — ${error.message} (code ${error.code ?? "?"})`);
    else saveDiag(`OK — ${platform} / ${version} envoyé`);
  } catch (e) {
    saveDiag(`EXCEPTION — ${e instanceof Error ? e.message : String(e)}`);
  }
}
