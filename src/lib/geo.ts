import { useEffect, useState } from "react";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";

export type Coords = { lat: number; lon: number };

export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function formatKm(km: number, lang: "fr" | "en"): string {
  const v = km.toFixed(1);
  const s = lang === "fr" ? v.replace(".", ",") : v;
  return `≈ ${s} km`;
}

// Module-level shared geolocation state so all screens see the same position.
type State = {
  coords: Coords | null;
  status: "idle" | "loading" | "ok" | "denied" | "unavailable";
};

let state: State = { coords: null, status: "idle" };
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

export function requestLocation() {
  if (typeof window === "undefined") {
    state = { coords: null, status: "unavailable" };
    emit();
    return;
  }
  state = { ...state, status: "loading" };
  emit();

  (async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await Geolocation.requestPermissions();
      }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
      });
      state = {
        coords: { lat: pos.coords.latitude, lon: pos.coords.longitude },
        status: "ok",
      };
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      state = {
        coords: null,
        status: code === 1 ? "denied" : "unavailable",
      };
    }
    emit();
  })();
}

export function useUserLocation() {
  const [s, setS] = useState<State>(state);
  useEffect(() => {
    const l = () => setS({ ...state });
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { ...s, request: requestLocation };
}
