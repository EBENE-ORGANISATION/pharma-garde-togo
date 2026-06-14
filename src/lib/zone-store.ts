import { useEffect, useState } from "react";

const KEY = "pg_zone_id";

export function useZone() {
  const [zone, setZoneState] = useState<string>("");
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
