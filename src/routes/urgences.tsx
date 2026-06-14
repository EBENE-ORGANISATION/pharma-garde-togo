import { createFileRoute } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLang } from "@/lib/i18n";
import { useZone } from "@/lib/zone-store";
import { useEmergencies } from "@/lib/supabase-hooks";

export const Route = createFileRoute("/urgences")({
  component: UrgencesPage,
});

function UrgencesPage() {
  const { t } = useLang();
  const { zone } = useZone();
  const { items, loading } = useEmergencies(zone || null);

  return (
    <AppShell title={t("emergency_numbers")}>
      <div className="px-4 pt-4">
        <h2 className="text-lg font-bold">{t("emergency_numbers")}</h2>
        <ul className="mt-4 space-y-3">
          {items.map((e) => (
            <li
              key={e.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              <div className="min-w-0">
                <div className="truncate text-base font-bold">{e.libelle}</div>
                <div className="text-2xl font-extrabold text-emergency">{e.numero}</div>
              </div>
              <a
                href={`tel:${e.numero}`}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emergency px-4 py-3 text-sm font-bold text-emergency-foreground active:scale-[0.98]"
              >
                <Phone className="h-4 w-4" /> {t("call")}
              </a>
            </li>
          ))}
          {!loading && items.length === 0 && (
            <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {t("no_results")}
            </li>
          )}
        </ul>
      </div>
    </AppShell>
  );
}
