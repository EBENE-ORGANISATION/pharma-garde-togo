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
  admin_tab_gps: { fr: "GPS", en: "GPS" },
  geocodage_titre: { fr: "Géocodage des pharmacies", en: "Pharmacy geocoding" },
  geocodage_recherche: { fr: "Rechercher une pharmacie…", en: "Search a pharmacy…" },
  geocodage_sans_gps: { fr: "Pharmacies sans coordonnées GPS", en: "Pharmacies without GPS" },
  geocodage_choisir_zone: { fr: "Choisir une zone", en: "Choose a zone" },
  geocodage_cliquer_carte: {
    fr: "Cliquez sur la carte pour placer la pharmacie",
    en: "Click on the map to place the pharmacy",
  },
  geocodage_enregistrer: { fr: "Enregistrer les coordonnées", en: "Save coordinates" },
  geocodage_succes: { fr: "Coordonnées enregistrées.", en: "Coordinates saved." },
  geocodage_aucune: {
    fr: "Toutes les pharmacies ont des coordonnées GPS.",
    en: "All pharmacies have GPS coordinates.",
  },
  about_text: {
    fr: "PharmaGarde aide à localiser rapidement les pharmacies de garde au Togo, même avec une connexion limitée.",
    en: "PharmaGarde helps you quickly find on-duty pharmacies in Togo, even on a slow connection.",
  },
  offline_available: { fr: "Disponible hors-ligne · à jour", en: "Available offline · up to date" },
  change_zone: { fr: "Changer de zone", en: "Change zone" },
  tonight_on_duty: { fr: "Ce soir · pharmacies de garde", en: "Tonight · on-duty pharmacies" },
  today_open: { fr: "Maintenant · pharmacies ouvertes", en: "Now · open pharmacies" },
  status_on_duty: { fr: "DE GARDE", en: "ON DUTY" },
  status_open: { fr: "OUVERTE", en: "OPEN" },
  directions: { fr: "Itinéraire", en: "Directions" },
  other_on_duty: { fr: "Autres pharmacies de garde", en: "Other on-duty pharmacies" },
  other_open: { fr: "Autres pharmacies ouvertes", en: "Other open pharmacies" },
  see_all: { fr: "Voir tout", en: "See all" },
  emergency_quick: { fr: "Urgences", en: "Emergencies" },
  see_all_numbers: { fr: "Voir tous les numéros", en: "See all numbers" },
  update_available: { fr: "Une nouvelle version est disponible", en: "A new version is available" },
  update_now: { fr: "Mettre à jour", en: "Update" },
  later: { fr: "Plus tard", en: "Later" },
  samu: { fr: "SAMU", en: "Ambulance" },
  police: { fr: "Police", en: "Police" },
  firemen: { fr: "Pompiers", en: "Fire dept." },
  open_until_short: { fr: "ouverte jusqu'à", en: "open until" },
  // Map
  my_location: { fr: "Ma position", en: "My location" },
  legend_on_duty: { fr: "De garde", en: "On duty" },
  legend_open: { fr: "Ouverte", en: "Open" },
  legend_you: { fr: "Vous", en: "You" },
  tap_marker_hint: {
    fr: "Touchez un marqueur pour les détails.",
    en: "Tap a marker for details.",
  },
  close: { fr: "Fermer", en: "Close" },
  // Medicines
  search_medicine_short: { fr: "Rechercher un médicament…", en: "Search a medicine…" },
  medicines_subtitle: {
    fr: "Annuaire par molécule (DCI), à titre indicatif.",
    en: "Directory by active ingredient (INN), for guidance only.",
  },
  loading: { fr: "Chargement…", en: "Loading…" },
  no_results_hint: {
    fr: "Essayez avec une autre orthographe ou la DCI (paracétamol, amoxicilline…).",
    en: "Try another spelling or the INN (paracetamol, amoxicillin…).",
  },
  type_to_search: {
    fr: "Tapez le nom d'un médicament pour lancer la recherche.",
    en: "Type a medicine name to start searching.",
  },
  // About
  about_intro: {
    fr: "PharmaGarde vous aide à trouver, à toute heure, la pharmacie de garde ou ouverte la plus proche au Togo. Pensée pour fonctionner même avec une connexion limitée.",
    en: "PharmaGarde helps you find, at any time, the nearest on-duty or open pharmacy in Togo. Built to work even with a slow connection.",
  },
  version: { fr: "Version", en: "Version" },
  sources_title: { fr: "Sources", en: "Sources" },
  sources_text: {
    fr: "Données issues de la Liste Nationale des Médicaments Essentiels (LNME) et de sources publiques. Pour signaler une erreur, contactez-nous.",
    en: "Data from the National Essential Medicines List (LNME) and public sources. To report an error, please contact us.",
  },
  language_choice: { fr: "Langue de l'application", en: "App language" },
  report_problem: { fr: "Signaler un problème", en: "Report a problem" },
  report_type_position: { fr: "La localisation est incorrecte", en: "The location is incorrect" },
  report_type_ferme: { fr: "La pharmacie a fermé ou déménagé", en: "The pharmacy has closed or moved" },
  report_type_autre: { fr: "Autre information incorrecte", en: "Other incorrect information" },
  report_use_location: { fr: "Je suis sur place — utiliser ma position", en: "I'm here — use my location" },
  report_location_loading: { fr: "Localisation en cours…", en: "Locating…" },
  report_location_captured: { fr: "Position enregistrée ✓", en: "Location captured ✓" },
  report_location_error: { fr: "Impossible d'obtenir votre position. Autorisez la localisation.", en: "Could not get your location. Please allow location access." },
  report_location_hint: { fr: "Utilisez ce bouton uniquement si vous êtes devant la pharmacie.", en: "Only use this if you are standing at the pharmacy." },
  report_message_ph: { fr: "Détails (facultatif)", en: "Details (optional)" },
  report_send: { fr: "Envoyer", en: "Send" },
  report_thanks: { fr: "Merci ! Votre signalement a été envoyé. Il sera vérifié avant toute mise à jour.", en: "Thank you! Your report has been sent. It will be reviewed before any update." },
  report_error: { fr: "Échec de l'envoi. Veuillez réessayer.", en: "Sending failed. Please try again." },
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
