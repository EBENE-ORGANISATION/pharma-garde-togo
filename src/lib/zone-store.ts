import { useEffect, useState } from "react";

const KEY = "pg_zone";
const DEFAULT = "grand-lome";

export function useZone() {
  const [zone, setZoneState] = useState<string>(DEFAULT);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = localStorage.getItem(KEY);
    if (v) setZoneState(v);
  }, []);
  const setZone = (z: string) => {
    setZoneState(z);
    if (typeof window !== "undefined") localStorage.setItem(KEY, z);
  };
  return { zone, setZone };
}
