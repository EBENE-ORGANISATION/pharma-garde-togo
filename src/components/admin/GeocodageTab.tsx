import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/lib/i18n";
import {
  type PharmacieGeo,
  type ZoneAdmin,
  listPharmaciesSansGps,
  rechercherPharmacie,
  listZones,
  majCoordsPharmacie,
} from "@/lib/admin-api";

// Zone centers: [lat, lng, zoom]
const ZONE_CENTERS: Record<string, [number, number, number]> = {
  "grand-lome": [6.17, 1.23, 13],
  maritime:     [6.35, 1.30, 10],
  plateaux:     [7.00, 0.80,  9],
  centrale:     [8.98, 1.13, 12],
  kara:         [9.55, 1.19, 12],
  savanes:      [10.87, 0.21, 12],
};
const DEFAULT_CENTER: [number, number, number] = [6.13, 1.22, 12];

function zoneCenter(slug?: string): [number, number, number] {
  return (slug && ZONE_CENTERS[slug]) || DEFAULT_CENTER;
}

export function GeocodageTab() {
  const { t } = useLang();

  const [pharmsSansGps, setPharmsSansGps] = useState<PharmacieGeo[]>([]);
  const [zones, setZones] = useState<ZoneAdmin[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<PharmacieGeo[] | null>(null);

  const [selected, setSelected] = useState<PharmacieGeo | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [markerCoords, setMarkerCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  // ── Load sans-GPS list + zones ────────────────────────────────────────────

  async function loadSansGps() {
    setLoadingList(true);
    const { data } = await listPharmaciesSansGps();
    setPharmsSansGps((data ?? []) as PharmacieGeo[]);
    setLoadingList(false);
  }

  useEffect(() => {
    loadSansGps();
    listZones().then(({ data }) => setZones((data ?? []) as ZoneAdmin[]));
  }, []);

  // ── Debounced search ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }
    const id = setTimeout(async () => {
      const { data } = await rechercherPharmacie(searchTerm.trim());
      setSearchResults((data ?? []) as PharmacieGeo[]);
    }, 300);
    return () => clearTimeout(id);
  }, [searchTerm]);

  // ── Init Leaflet (once, client-only) ──────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined" || !containerRef.current) return;
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      const [iconPng, icon2xPng, shadowPng] = await Promise.all([
        import("leaflet/dist/images/marker-icon.png"),
        import("leaflet/dist/images/marker-icon-2x.png"),
        import("leaflet/dist/images/marker-shadow.png"),
      ]);
      if (cancelled || !containerRef.current) return;

      const icon = L.icon({
        iconUrl: iconPng.default,
        iconRetinaUrl: icon2xPng.default,
        shadowUrl: shadowPng.default,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      (L.Marker.prototype as any).options.icon = icon;

      const [lat, lng, zoom] = DEFAULT_CENTER;
      const map = L.map(containerRef.current).setView([lat, lng], zoom);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // ── Map click → place / move marker ──────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const handleClick = async (e: any) => {
      const { lat, lng } = e.latlng;
      const L = (await import("leaflet")).default;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const m = L.marker([lat, lng], { draggable: true }).addTo(map);
        m.on("dragend", (ev: any) => {
          const pos = ev.target.getLatLng();
          setMarkerCoords({ lat: pos.lat, lng: pos.lng });
        });
        markerRef.current = m;
      }
      setMarkerCoords({ lat, lng });
    };

    map.on("click", handleClick);
    return () => { map.off("click", handleClick); };
  }, [mapReady]);

  // ── Update map when selection changes ─────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    (async () => {
      const L = (await import("leaflet")).default;

      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }

      if (!selected) return;

      const zoneSlug = zones.find((z) => z.id === selected.zone_id)?.slug;
      const [cLat, cLng, cZoom] = zoneCenter(zoneSlug);

      if (selected.latitude != null && selected.longitude != null) {
        const m = L.marker(
          [selected.latitude, selected.longitude],
          { draggable: true },
        ).addTo(map);
        m.on("dragend", (ev: any) => {
          const pos = ev.target.getLatLng();
          setMarkerCoords({ lat: pos.lat, lng: pos.lng });
        });
        markerRef.current = m;
        setMarkerCoords({ lat: selected.latitude, lng: selected.longitude });
        map.flyTo([selected.latitude, selected.longitude], Math.max(cZoom, 14));
      } else {
        setMarkerCoords(null);
        map.flyTo([cLat, cLng], cZoom);
      }
    })();
  }, [mapReady, selected, zones]);

  // ── Selection ─────────────────────────────────────────────────────────────

  function selectPharmacy(p: PharmacieGeo) {
    setSelected(p);
    setSelectedZoneId(p.zone_id ?? "");
    setSuccessMsg(null);
    setSaveError(null);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function save() {
    if (!selected || !markerCoords) return;
    if (!selectedZoneId) {
      setSaveError(t("geocodage_choisir_zone"));
      return;
    }
    setSaving(true);
    setSaveError(null);
    const { error } = await majCoordsPharmacie(
      selected.id,
      markerCoords.lat,
      markerCoords.lng,
      selectedZoneId,
    );
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    setSuccessMsg(t("geocodage_succes"));
    setTimeout(() => setSuccessMsg(null), 3000);

    if (selected.latitude == null) {
      // Remove from sans-GPS list and advance to next
      const idx = pharmsSansGps.findIndex((p) => p.id === selected.id);
      const newList = pharmsSansGps.filter((p) => p.id !== selected.id);
      setPharmsSansGps(newList);
      if (newList.length > 0 && !searchTerm.trim()) {
        selectPharmacy(newList[Math.min(idx, newList.length - 1)]);
      } else if (!searchTerm.trim()) {
        setSelected(null);
        setMarkerCoords(null);
      }
    }
  }

  // ── Grouped list ──────────────────────────────────────────────────────────

  const grouped = useMemo(() => {
    const byZone = new Map<string | null, PharmacieGeo[]>();
    for (const p of pharmsSansGps) {
      const k = p.zone_id;
      if (!byZone.has(k)) byZone.set(k, []);
      byZone.get(k)!.push(p);
    }
    const result: { zoneId: string | null; zoneName: string; items: PharmacieGeo[] }[] = [];
    const sansZone = byZone.get(null);
    if (sansZone?.length) result.push({ zoneId: null, zoneName: "Sans zone", items: sansZone });
    for (const z of zones) {
      const items = byZone.get(z.id);
      if (items?.length) result.push({ zoneId: z.id, zoneName: z.nom, items });
    }
    return result;
  }, [pharmsSansGps, zones]);

  const isSearching = !!searchTerm.trim();
  const displayList = isSearching ? (searchResults ?? []) : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{t("geocodage_titre")}</h2>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* ── Left column: search + list ── */}
        <div className="w-full space-y-3 lg:w-72 lg:shrink-0">
          <Input
            placeholder={t("geocodage_recherche")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {loadingList ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : isSearching ? (
            <div className="h-80 overflow-y-auto rounded-xl border border-border">
              {displayList!.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">Aucun résultat.</p>
              ) : (
                displayList!.map((p) => (
                  <PharmItem
                    key={p.id}
                    p={p}
                    selected={selected?.id === p.id}
                    onSelect={selectPharmacy}
                    showCoords
                  />
                ))
              )}
            </div>
          ) : pharmsSansGps.length === 0 ? (
            <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
              {t("geocodage_aucune")}
            </p>
          ) : (
            <div className="h-80 overflow-y-auto rounded-xl border border-border">
              {grouped.map((group) => (
                <div key={group.zoneId ?? "__null__"}>
                  <div
                    className={[
                      "sticky top-0 px-3 py-1 text-xs font-bold uppercase tracking-wide",
                      group.zoneId === null
                        ? "bg-orange-50 text-orange-700"
                        : "bg-muted text-muted-foreground",
                    ].join(" ")}
                  >
                    {group.zoneName}{" "}
                    <span className="font-normal">({group.items.length})</span>
                  </div>
                  {group.items.map((p) => (
                    <PharmItem
                      key={p.id}
                      p={p}
                      selected={selected?.id === p.id}
                      onSelect={selectPharmacy}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right column: info card + map ── */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {selected && (
            <div className="rounded-xl border border-border bg-card p-3 text-sm">
              <p className="font-semibold">{selected.nom}</p>
              {selected.adresse && (
                <p className="text-muted-foreground">{selected.adresse}</p>
              )}

              {markerCoords ? (
                <p className="mt-1 font-mono text-xs">
                  {markerCoords.lat.toFixed(6)}, {markerCoords.lng.toFixed(6)}
                </p>
              ) : (
                <p className="mt-1 italic text-muted-foreground">
                  {t("geocodage_cliquer_carte")}
                </p>
              )}

              <div className="mt-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Zone{!selected.zone_id ? " *" : ""}
                </label>
                <select
                  value={selectedZoneId}
                  onChange={(e) => setSelectedZoneId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {!selected.zone_id && (
                    <option value="">— {t("geocodage_choisir_zone")} —</option>
                  )}
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.nom}
                    </option>
                  ))}
                </select>
              </div>

              {saveError && (
                <p className="mt-2 text-xs text-destructive">{saveError}</p>
              )}
              {successMsg && (
                <p className="mt-2 text-xs text-green-700">{successMsg}</p>
              )}

              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  disabled={!markerCoords || saving || !!successMsg}
                  onClick={save}
                >
                  {saving ? "Enregistrement…" : t("geocodage_enregistrer")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelected(null);
                    setMarkerCoords(null);
                    setSaveError(null);
                  }}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}

          <div
            ref={containerRef}
            className="h-96 w-full overflow-hidden rounded-2xl border border-border bg-muted lg:h-[500px]"
          >
            {!mapReady && (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                Chargement de la carte…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small helper ──────────────────────────────────────────────────────────────

function PharmItem({
  p,
  selected,
  onSelect,
  showCoords = false,
}: {
  p: PharmacieGeo;
  selected: boolean;
  onSelect: (p: PharmacieGeo) => void;
  showCoords?: boolean;
}) {
  return (
    <button
      onClick={() => onSelect(p)}
      className={[
        "w-full px-3 py-2 text-left text-sm transition-colors hover:bg-primary/5",
        selected ? "bg-primary/10 font-semibold" : "",
      ].join(" ")}
    >
      <span className="block">{p.nom}</span>
      {p.adresse && (
        <span className="block text-xs text-muted-foreground">{p.adresse}</span>
      )}
      {showCoords && p.latitude != null && (
        <span className="block font-mono text-xs text-primary">
          {p.latitude.toFixed(4)}, {p.longitude?.toFixed(4)}
        </span>
      )}
    </button>
  );
}
