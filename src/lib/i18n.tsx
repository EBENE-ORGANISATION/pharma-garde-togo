import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "fr" | "en";

type Dict = Record<string, { fr: string; en: string }>;

export const translations: Dict = {
  app_name: { fr: "PharmaGarde", en: "PharmaGarde" },
  tagline: {
    fr: "Trouvez une pharmacie de garde au Togo",
    en: "Find an on-duty pharmacy in Togo",
  },
  select_zone: { fr: "Choisissez votre zone", en: "Choose your zone" },
  zone: { fr: "Zone", en: "Region" },
  quick_access: { fr: "Accès rapide", en: "Quick access" },
  on_duty: { fr: "Pharmacies de garde", en: "On-duty pharmacies" },
  map: { fr: "Carte", en: "Map" },
  emergency_numbers: { fr: "Numéros d'urgence", en: "Emergency numbers" },
  medicines: { fr: "Médicaments", en: "Medicines" },
  about: { fr: "À propos", en: "About" },
  home: { fr: "Accueil", en: "Home" },
  call: { fr: "Appeler", en: "Call" },
  address: { fr: "Adresse", en: "Address" },
  nearest: { fr: "La plus proche", en: "Nearest" },
  search_medicine: { fr: "Rechercher un médicament (DCI)", en: "Search a medicine (INN)" },
  search_placeholder: { fr: "Ex. paracétamol", en: "e.g. paracetamol" },
  no_results: { fr: "Aucun résultat", en: "No results" },
  molecule: { fr: "Molécule", en: "Molecule" },
  form: { fr: "Forme", en: "Form" },
  dosage: { fr: "Dosage", en: "Dosage" },
  no_price_note: {
    fr: "Les prix ne sont pas affichés.",
    en: "Prices are not shown.",
  },
  disclaimer_title: { fr: "Avertissement", en: "Disclaimer" },
  disclaimer: {
    fr: "Informations fournies à titre indicatif, à partir de sources publiques, pouvant contenir des erreurs. Appelez la pharmacie pour confirmer avant de vous déplacer. L'appli ne remplace pas un avis médical. En cas d'urgence vitale, appelez les secours.",
    en: "Information provided for guidance only, from public sources, and may contain errors. Call the pharmacy to confirm before travelling. This app does not replace medical advice. In a life-threatening emergency, call the emergency services.",
  },
  pharmacies_in: { fr: "Pharmacies de garde —", en: "On-duty pharmacies —" },
  see_on_map: { fr: "Voir sur la carte", en: "See on map" },
  back: { fr: "Retour", en: "Back" },
  language: { fr: "Langue", en: "Language" },
  loading_map: { fr: "Chargement de la carte…", en: "Loading map…" },
  no_pharmacies: {
    fr: "Aucune pharmacie de garde disponible pour cette zone pour le moment.",
    en: "No on-duty pharmacy available for this region at the moment.",
  },
  nearest_pharmacy: { fr: "Pharmacie la plus proche", en: "Nearest pharmacy" },
  use_my_location: { fr: "Utiliser ma position", en: "Use my location" },
  locating: { fr: "Localisation…", en: "Locating…" },
  location_unavailable: {
    fr: "Position non disponible — activez la localisation pour voir la pharmacie la plus proche.",
    en: "Location unavailable — enable location to see the nearest pharmacy.",
  },
  as_the_crow_flies: {
    fr: "Distance à vol d'oiseau (approximative).",
    en: "Straight-line distance (approximate).",
  },
  your_position: { fr: "Votre position", en: "Your position" },
  pharmacies_open: { fr: "Pharmacies ouvertes", en: "Open pharmacies" },
  pharmacies_open_in: { fr: "Pharmacies ouvertes —", en: "Open pharmacies —" },
  nearest_open: { fr: "Pharmacie ouverte la plus proche", en: "Nearest open pharmacy" },
  position_unknown: { fr: "Position non renseignée", en: "Location not available" },
  about_text: {
    fr: "PharmaGarde aide à localiser rapidement les pharmacies de garde au Togo, même avec une connexion limitée.",
    en: "PharmaGarde helps you quickly find on-duty pharmacies in Togo, even on a slow connection.",
  },
};

export const ZONES = [
  { id: "grand-lome", fr: "Grand Lomé", en: "Greater Lomé" },
  { id: "maritime", fr: "Maritime", en: "Maritime" },
  { id: "plateaux", fr: "Plateaux", en: "Plateaux" },
  { id: "centrale", fr: "Centrale", en: "Centrale" },
  { id: "kara", fr: "Kara", en: "Kara" },
  { id: "savanes", fr: "Savanes", en: "Savanes" },
] as const;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: keyof typeof translations) => string };
const LangContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");
  useEffect(() => {
    const stored = typeof window !== "undefined" ? (localStorage.getItem("pg_lang") as Lang | null) : null;
    if (stored === "fr" || stored === "en") setLangState(stored);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("pg_lang", l);
  };
  const t = (k: keyof typeof translations) => translations[k][lang];
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang outside provider");
  return ctx;
}
