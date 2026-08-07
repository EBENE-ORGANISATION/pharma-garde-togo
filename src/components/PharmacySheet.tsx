import { MapPin, Phone, Navigation, X, Clock } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useModeOuverture } from "@/lib/horaires";
import { formatKm } from "@/lib/geo";
import type { Pharmacy } from "@/lib/db";
import { SignalerDialog } from "@/components/SignalerDialog";

function directionsHref(p: Pharmacy): string | null {
  if (p.latitude == null || p.longitude == null) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}&travelmode=driving`;
}

/**
 * Fiche détaillée d'une pharmacie, en « fenêtre qui remonte » (bottom sheet).
 * Réutilisable partout : accueil, garde, carte.
 */
export function PharmacySheet({
  pharmacy,
  distanceKm,
  onClose,
}: {
  pharmacy: Pharmacy;
  distanceKm?: number | null;
  onClose: () => void;
}) {
  const { t, lang } = useLang();
  const { libelle } = useModeOuverture();
  const dir = directionsHref(pharmacy);

  return (
    <>
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
      />
      <div
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-[28px] border-t border-border bg-card p-5 shadow-soft"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />

        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-extrabold leading-tight text-primary-dark">
            {pharmacy.nom}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-dark active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {pharmacy.adresse && (
          <p className="mt-2 text-sm leading-snug text-muted-foreground">
            {pharmacy.adresse}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {distanceKm != null && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground">
                {formatKm(distanceKm, lang)}
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
            href={pharmacy.telephone ? `tel:${pharmacy.telephone}` : "#"}
            aria-disabled={!pharmacy.telephone}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-base font-bold text-primary-foreground shadow-soft active:scale-[0.97] disabled:opacity-60"
          >
            <Phone className="h-5 w-5" /> {t("call")}
          </a>
          {dir ? (
            <a
              href={dir}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-base font-bold text-primary-dark active:scale-[0.97]"
            >
              <Navigation className="h-5 w-5" /> {t("directions")}
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-base font-bold text-primary-dark opacity-50"
            >
              <Navigation className="h-5 w-5" /> {t("directions")}
            </button>
          )}
        </div>

        <div className="mt-3 flex justify-center">
          <SignalerDialog pharmacie={pharmacy} showHint />
        </div>
      </div>
    </>
  );
}
