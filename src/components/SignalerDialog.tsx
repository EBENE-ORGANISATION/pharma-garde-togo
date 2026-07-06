import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, MapPin, Check } from "lucide-react";

type SignalablePharmacie = {
  id: string;
  nom?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type Probleme = "position" | "ferme" | "autre";

export function SignalerDialog({
  pharmacie,
  showHint = false,
}: {
  pharmacie: SignalablePharmacie;
  showHint?: boolean;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<Probleme>("position");
  const [message, setMessage] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gps, setGps] = useState<"idle" | "loading" | "error">("idle");
  const [state, setState] = useState<"form" | "sending" | "done" | "error">("form");

  function reset() {
    setType("position"); setMessage(""); setCoords(null);
    setGps("idle"); setState("form");
  }

  function captureLocation() {
    if (!("geolocation" in navigator)) { setGps("error"); return; }
    setGps("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGps("idle"); },
      () => setGps("error"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function submit() {
    setState("sending");
    let anonId: string | null = null;
    try { anonId = localStorage.getItem("pg_anon_id"); } catch { /* ignore */ }
    const { error } = await (supabase as any).from("signalements").insert({
      pharmacie_id: pharmacie.id,
      type,
      message: message.trim() || null,
      lat_suggeree: type === "position" ? coords?.lat ?? null : null,
      lng_suggeree: type === "position" ? coords?.lng ?? null : null,
      anon_id: anonId,
      statut: "nouveau",
    });
    setState(error ? "error" : "done");
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogTrigger asChild>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive active:scale-[0.98] hover:bg-destructive/15">
            <AlertCircle className="h-4 w-4" /> {t("report_problem")}
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          {state === "done" ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-semibold">{t("report_thanks")}</p>
              <Button onClick={() => setOpen(false)} className="mt-1 w-full">{t("close")}</Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">{t("report_problem")}</DialogTitle>
              </DialogHeader>
              {pharmacie.nom && <p className="-mt-1 text-xs text-muted-foreground">{pharmacie.nom}</p>}

              <p className="rounded-lg bg-muted/50 p-2.5 text-xs leading-snug text-muted-foreground">
                {t("report_intro")}
              </p>

              <div className="space-y-2">
                {([
                  ["position", t("report_type_position")],
                  ["ferme", t("report_type_ferme")],
                  ["autre", t("report_type_autre")],
                ] as [Probleme, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setType(val)}
                    className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm ${
                      type === val ? "border-primary bg-primary/5 font-semibold" : "border-border"
                    }`}
                  >
                    <span className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${type === val ? "border-primary bg-primary" : "border-muted-foreground"}`} />
                    {label}
                  </button>
                ))}
              </div>

              {type === "position" && (
                <div className="rounded-xl bg-muted/50 p-3">
                  <Button
                    type="button"
                    variant={coords ? "outline" : "default"}
                    className="w-full"
                    onClick={captureLocation}
                    disabled={gps === "loading"}
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    {coords ? t("report_location_captured") : gps === "loading" ? t("report_location_loading") : t("report_use_location")}
                  </Button>
                  {gps === "error" && <p className="mt-2 text-xs text-destructive">{t("report_location_error")}</p>}
                  <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{t("report_location_hint")}</p>
                </div>
              )}

              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("report_message_ph")}
                maxLength={500}
                rows={3}
              />

              {state === "error" && <p className="text-xs text-destructive">{t("report_error")}</p>}

              <DialogFooter>
                <Button
                  onClick={submit}
                  disabled={state === "sending" || (type === "position" && !coords && !message.trim())}
                  className="w-full"
                >
                  {state === "sending" ? "…" : t("report_send")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      {showHint && (
        <p className="max-w-[16rem] text-center text-[11px] leading-snug text-muted-foreground">
          {t("report_hint")}
        </p>
      )}
    </div>
  );
}
