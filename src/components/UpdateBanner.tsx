import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { AppLauncher } from "@capacitor/app-launcher";
import { useLang } from "@/lib/i18n";

const REPO = "EBENE-ORGANISATION/pharma-garde-togo";
const APK_URL = `https://github.com/${REPO}/releases/latest/download/app-release.apk`;
const DISMISS_KEY = "pg_update_dismissed";

let cached: Promise<{ current: number; latest: number } | null> | null = null;
function getUpdateInfo() {
  if (!cached) {
    cached = (async () => {
      if (!Capacitor.isNativePlatform()) return null;
      try {
        const info = await App.getInfo();
        const current = parseInt(info.build, 10);
        const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
          headers: { Accept: "application/vnd.github+json" },
        });
        if (!res.ok) return null;
        const json = await res.json();
        const latest = parseInt(String(json.tag_name ?? "").replace(/[^0-9]/g, ""), 10);
        if (!Number.isFinite(current) || !Number.isFinite(latest)) return null;
        return { current, latest };
      } catch {
        return null;
      }
    })();
  }
  return cached;
}

export function UpdateBanner() {
  const { t } = useLang();
  const [info, setInfo] = useState<{ current: number; latest: number } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let on = true;
    getUpdateInfo().then((r) => {
      if (on) setInfo(r);
    });
    return () => {
      on = false;
    };
  }, []);

  if (!info || info.latest <= info.current || dismissed) return null;
  if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === String(info.latest)) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 border-b border-border bg-primary-soft px-4 py-2.5">
      <span className="flex-1 text-sm font-semibold text-primary-dark">{t("update_available")}</span>
      <button
        onClick={() => { AppLauncher.openUrl({ url: APK_URL }); }}
        className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground active:scale-[0.97]"
      >
        {t("update_now")}
      </button>
      <button
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, String(info.latest));
          setDismissed(true);
        }}
        className="shrink-0 text-xs font-semibold text-muted-foreground"
      >
        {t("later")}
      </button>
    </div>
  );
}
