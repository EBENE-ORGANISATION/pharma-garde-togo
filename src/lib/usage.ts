import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";

const KEY = "pg_anon_id";
const DIAG_KEY = "pg_usage_diag";
const SRC_KEY = "pg_src";
const SRC_RE = /^[a-z0-9_-]{1,32}$/;
let done = false;
let clicksInstalled = false;
let lastSearchAt = 0;

export type UsageEvent = "appel" | "appel_urgence" | "itineraire" | "recherche_medicament" | "arrivee";

// Origine de la visite : ?src=wa-groupe, ?src=qr-pharma… (utm_source accepté aussi).
function sourceFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get("src") ?? params.get("utm_source") ?? "").trim().toLowerCase();
    return SRC_RE.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

// Première origine connue de l'appareil (first-touch), conservée localement.
function firstSource(current: string | null): string | null {
  let stored = "";
  try { stored = localStorage.getItem(SRC_KEY) ?? ""; } catch { /* ignore */ }
  if (stored) return stored;
  if (current) {
    try { localStorage.setItem(SRC_KEY, current); } catch { /* ignore */ }
  }
  return current;
}

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
  installClickTracking();
  try {
    const isNative = Capacitor.isNativePlatform();
    const platform = isNative ? "apk" : "web";
    saveDiag(`début — natif=${isNative}, plateforme=${platform}`);

    const version = isNative ? await nativeVersion() : "web";
    const anonId = getAnonId();
    const current = sourceFromUrl();
    const source = firstSource(current);
    saveDiag(`envoi — ${platform} / ${version} / id=${anonId.slice(0, 8)}… / src=${source ?? "-"}`);

    let { error } = await supabase.rpc("ping_usage_v2", {
      p_anon_id: anonId,
      p_platform: platform,
      p_version: version,
      p_source: source ?? "",
    });
    // Migration absente ou v2 en échec : on retombe sur l'ancien ping pour ne pas perdre la visite.
    if (error) {
      ({ error } = await supabase.rpc("ping_usage", {
        p_anon_id: anonId,
        p_platform: platform,
        p_version: version,
      }));
    }

    if (error) saveDiag(`ÉCHEC — ${error.message} (code ${error.code ?? "?"})`);
    else saveDiag(`OK — ${platform} / ${version} envoyé`);

    if (current) trackEvent("arrivee", current);
  } catch (e) {
    saveDiag(`EXCEPTION — ${e instanceof Error ? e.message : String(e)}`);
  }
}

// Envoi « tire et oublie » : une mesure perdue (hors-ligne) ne doit jamais gêner l'utilisateur.
export function trackEvent(event: UsageEvent, detail?: string) {
  try {
    const row: { anon_id: string; event: UsageEvent; detail?: string } = { anon_id: getAnonId(), event };
    if (detail && SRC_RE.test(detail)) row.detail = detail;
    void supabase.from("app_events").insert(row).then(() => undefined, () => undefined);
  } catch {
    // ignore
  }
}

// Une recherche de médicament au plus toutes les 20 s (la frappe déclenche plusieurs requêtes).
export function trackMedicineSearch(found: boolean) {
  const now = Date.now();
  if (now - lastSearchAt < 20_000) return;
  lastSearchAt = now;
  trackEvent("recherche_medicament", found ? "trouve" : "vide");
}

// Repère les liens d'appel et d'itinéraire où qu'ils soient dans l'appli.
function installClickTracking() {
  if (clicksInstalled || typeof document === "undefined") return;
  clicksInstalled = true;
  document.addEventListener(
    "click",
    (e) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("tel:")) {
        // Numéros courts (111, 117, 118…) = urgences ; les autres = pharmacies.
        const digits = href.slice(4).replace(/\D/g, "");
        trackEvent(digits.length > 0 && digits.length <= 4 ? "appel_urgence" : "appel");
      } else if (href.includes("google.com/maps/dir")) {
        trackEvent("itineraire");
      }
    },
    true,
  );
}
