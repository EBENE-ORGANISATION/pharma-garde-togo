import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Pill,
  MapPin,
  Phone,
  Navigation,
  Clock,
  Wifi,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLang } from "@/lib/i18n";
import { useZone } from "@/lib/zone-store";
import { useZones, usePharmacies, useAllPharmacies } from "@/lib/supabase-hooks";
import { useUserLocation, haversineKm, formatKm } from "@/lib/geo";
import { useModeOuverture } from "@/lib/horaires";
import type { Pharmacy } from "@/lib/db";

export const Route = createFileRoute("/")({
  component: Index,
});

function directionsHref(p: Pharmacy): string | null {
  if (p.latitude == null || p.longitude == null) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}&travelmode=driving`;
}

function initials(name: string): string {
  return name
    .replace(/pharmacie/i, "")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "PH";
}

function Index() {
  const { t, lang } = useLang();
  const { zone, setZone } = useZone();
  const { zones, loading } = useZones();
  const { mode, libelle } = useModeOuverture();

  const { items: gardePharmacies } = usePharmacies(zone || null);
  const { items: allPharmacies } = useAllPharmacies(zone || null);

  const pharmacies = mode === "jour" ? allPharmacies : gardePharmacies;
  const loc = useUserLocation();
  const [zoneOpen, setZoneOpen] = useState(false);

  useEffect(() => {
    if (loading || zones.length === 0) return;
    if (!zone || !zones.find((z) => z.id === zone)) {
      setZone(zones[0].id);
    }
  }, [loading, zones, zone, setZone]);

  const currentZone = zones.find((z) => z.id === zone);

  // Pharmacies enriched with distance (if available) and sorted
  const enriched = useMemo(() => {
    const list = pharmacies.map((p) => {
      let km: number | null = null;
      if (loc.coords && p.latitude != null && p.longitude != null) {
        km = haversineKm(loc.coords, {
          lat: p.latitude as number,
          lon: p.longitude as number,
        });
      }
      return { p, km };
    });
    list.sort((a, b) => {
      if (a.km == null && b.km == null) return a.p.nom.localeCompare(b.p.nom);
      if (a.km == null) return 1;
      if (b.km == null) return -1;
      return a.km - b.km;
    });
    return list;
  }, [pharmacies, loc.coords]);

  const hero = enriched[0];
  const others = enriched.slice(1, 5);

  const statusLabel = mode === "jour" ? t("status_open") : t("status_on_duty");
  const sectionLabel = mode === "jour" ? t("today_open") : t("tonight_on_duty");
  const othersLabel = mode === "jour" ? t("other_open") : t("other_on_duty");

  const emergencies = [
    { label: t("samu"), num: "111", tone: "emergency" as const },
    { label: t("police"), num: "117", tone: "primary" as const },
    { label: t("firemen"), num: "118", tone: "primary" as const },
  ];

  return (
    <AppShell hideHeader>
      {/* Green hero header */}
      <section className="rounded-b-[32px] bg-primary px-4 pt-5 pb-6 text-primary-foreground shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-primary">
              <Pill className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div className="truncate text-xl font-extrabold tracking-tight">
              {t("app_name")}
            </div>
          </div>
          <LangSwitchInverse />
        </div>

        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          <Wifi className="h-3.5 w-3.5" />
          {t("offline_available")}
        </div>

        {/* Zone selector card */}
        <div className="relative mt-4">
          <button
            type="button"
            onClick={() => setZoneOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 text-left text-foreground shadow-card active:scale-[0.99]"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <MapPin className="h-5 w-5 shrink-0 text-primary" />
              <span className="truncate text-base font-bold text-primary-dark">
                {currentZone ? (lang === "fr" ? currentZone.nom : currentZone.nom) : "—"}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
              {t("change_zone")}
              <ChevronDown
                className={"h-4 w-4 transition-transform " + (zoneOpen ? "rotate-180" : "")}
              />
            </span>
          </button>

          {zoneOpen && (
            <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-border bg-white shadow-card">
              {loading ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">…</div>
              ) : (
                zones.map((z) => {
                  const active = z.id === zone;
                  return (
                    <button
                      key={z.id}
                      onClick={() => {
                        setZone(z.id);
                        setZoneOpen(false);
                      }}
                      className={
                        "flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold transition-colors " +
                        (active
                          ? "bg-primary-soft text-primary-dark"
                          : "text-foreground hover:bg-primary-soft/60")
                      }
                    >
                      <span>{z.nom}</span>
                      {active && (
                        <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </section>

      {/* Section title */}
      <section className="px-4 pt-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Clock className="h-4 w-4 text-primary" />
          <span>{sectionLabel}</span>
        </div>

        {/* Hero pharmacy card */}
        {hero ? (
          <article className="mt-3 rounded-[24px] border border-border bg-card p-5 shadow-card">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-primary-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              {statusLabel}
            </span>
            <h2 className="mt-3 text-2xl font-extrabold leading-tight text-primary-dark">
              {hero.p.nom}
            </h2>
            {hero.p.adresse && (
              <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
                {hero.p.adresse}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {hero.km != null && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground">
                    {formatKm(hero.km, lang)}
                  </span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-dark">
                <Clock className="h-3.5 w-3.5" />
                {libelle}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <a
                href={hero.p.telephone ? `tel:${hero.p.telephone}` : "#"}
                aria-disabled={!hero.p.telephone}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-base font-bold text-primary-foreground shadow-soft transition-transform active:scale-[0.97] disabled:opacity-60"
              >
                <Phone className="h-5 w-5" /> {t("call")}
              </a>
              <DirectionsButton p={hero.p} label={t("directions")} />
            </div>
          </article>
        ) : (
          <div className="mt-3 rounded-[24px] border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
            {t("no_pharmacies")}
          </div>
        )}
      </section>

      {/* Other pharmacies list */}
      {others.length > 0 && (
        <section className="px-4 pt-7">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-base font-extrabold text-primary-dark">{othersLabel}</h3>
            <Link
              to="/garde"
              className="text-sm font-semibold text-primary-dark underline-offset-4 hover:underline"
            >
              {t("see_all")} ›
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-[24px] border border-border bg-card shadow-card">
            {others.map(({ p, km }) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-sm font-extrabold text-primary-dark">
                  {initials(p.nom)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-primary-dark">{p.nom}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[
                      p.adresse,
                      km != null ? formatKm(km, lang) : null,
                      `${t("open_until_short")} 8h`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <a
                  href={p.telephone ? `tel:${p.telephone}` : "#"}
                  aria-disabled={!p.telephone}
                  aria-label={t("call")}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-soft active:scale-[0.96]"
                >
                  <Phone className="h-5 w-5" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Emergencies block */}
      <section className="px-4 pt-7">
        <h3 className="text-base font-extrabold text-primary-dark">{t("emergency_quick")}</h3>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {emergencies.map((e) => (
            <a
              key={e.num}
              href={`tel:${e.num}`}
              className={
                "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-3 text-center shadow-card active:scale-[0.97] " +
                (e.tone === "emergency"
                  ? "bg-emergency text-emergency-foreground"
                  : "bg-primary-soft text-primary-dark")
              }
            >
              <span className="text-xl font-extrabold leading-none">{e.num}</span>
              <span className="text-[11px] font-semibold opacity-90">{e.label}</span>
            </a>
          ))}
        </div>
      </section>

      {/* Geolocation hint */}
      {!loc.coords && (
        <section className="px-4 pt-5">
          <button
            onClick={loc.request}
            disabled={loc.status === "loading"}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3 py-3 text-sm font-bold text-primary-dark shadow-card active:scale-[0.99] disabled:opacity-60"
          >
            <Navigation className="h-4 w-4 text-primary" />
            {loc.status === "loading" ? t("locating") : t("use_my_location")}
          </button>
        </section>
      )}

      {/* Disclaimer */}
      <section className="px-4 pb-6 pt-7">
        <div className="flex gap-2 rounded-2xl bg-primary-soft/60 px-3.5 py-3 text-[11px] leading-snug text-primary-dark/80">
          <AlertTriangle className="h-4 w-4 shrink-0 text-primary" />
          <p>{t("disclaimer")}</p>
        </div>
      </section>

      {/* unused, prevents tree-shake noise */}
      <span className="hidden">
        <ChevronRight />
      </span>
    </AppShell>
  );
}

function LangSwitchInverse() {
  const { lang, setLang } = useLang();
  return (
    <div className="inline-flex shrink-0 rounded-full bg-white/15 p-0.5 text-xs font-bold backdrop-blur">
      {(["fr", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={
            "rounded-full px-3 py-1 transition-colors " +
            (lang === l ? "bg-white text-primary-dark" : "text-white/85")
          }
          aria-pressed={lang === l}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function DirectionsButton({ p, label }: { p: Pharmacy; label: string }) {
  const href = directionsHref(p);
  const cls =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-base font-bold text-primary-dark transition-transform active:scale-[0.97]";
  if (!href) {
    return (
      <button type="button" disabled className={cls + " opacity-50"}>
        <Navigation className="h-5 w-5" /> {label}
      </button>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      <Navigation className="h-5 w-5" /> {label}
    </a>
  );
}
