import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, MapPin } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLang, ZONES } from "@/lib/i18n";
import { useZone } from "@/lib/zone-store";
import { PHARMACIES } from "@/lib/data";

export const Route = createFileRoute("/garde")({
  component: GardePage,
});

function GardePage() {
  const { t, lang } = useLang();
  const { zone, setZone } = useZone();
  const list = PHARMACIES.filter((p) => p.zone === zone);
  const zoneLabel = ZONES.find((z) => z.id === zone)?.[lang] ?? "";

  return (
    <AppShell title={t("on_duty")}>
      <div className="px-4 pt-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("zone")}
        </label>
        <select
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm font-semibold"
        >
          {ZONES.map((z) => (
            <option key={z.id} value={z.id}>
              {z[lang]}
            </option>
          ))}
        </select>

        <h2 className="mt-5 text-lg font-bold">
          {t("pharmacies_in")} {zoneLabel}
        </h2>
      </div>

      <ul className="mt-3 space-y-3 px-4 pb-4">
        {list.map((p) => (
          <li key={p.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.address}</p>
                <p className="mt-1 text-sm font-mono">{p.phone}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href={`tel:${p.phone}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground active:scale-[0.98]"
              >
                <Phone className="h-4 w-4" /> {t("call")}
              </a>
              <Link
                to="/carte"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold"
              >
                <MapPin className="h-4 w-4" /> {t("see_on_map")}
              </Link>
            </div>
          </li>
        ))}
        {list.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("no_results")}
          </li>
        )}
      </ul>
    </AppShell>
  );
}
