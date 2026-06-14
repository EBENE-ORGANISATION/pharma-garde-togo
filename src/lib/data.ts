export type Pharmacy = {
  id: string;
  name: string;
  address: string;
  phone: string;
  zone: string;
  lat: number;
  lng: number;
};

export const PHARMACIES: Pharmacy[] = [
  { id: "p1", name: "Pharmacie de l'Étoile", address: "Bd du 13 Janvier, Lomé", phone: "+22822215050", zone: "grand-lome", lat: 6.1725, lng: 1.2314 },
  { id: "p2", name: "Pharmacie du Port", address: "Rue du Port, Lomé", phone: "+22822216161", zone: "grand-lome", lat: 6.1310, lng: 1.2766 },
  { id: "p3", name: "Pharmacie Bè", address: "Quartier Bè, Lomé", phone: "+22822217272", zone: "grand-lome", lat: 6.1450, lng: 1.2400 },
  { id: "p4", name: "Pharmacie Adidogomé", address: "Avenue de la Paix, Adidogomé", phone: "+22822218383", zone: "grand-lome", lat: 6.1700, lng: 1.1700 },
  { id: "p5", name: "Pharmacie Centrale d'Aného", address: "Route Nationale, Aného", phone: "+22823310101", zone: "maritime", lat: 6.2300, lng: 1.5950 },
  { id: "p6", name: "Pharmacie de Tsévié", address: "Centre-ville, Tsévié", phone: "+22823320202", zone: "maritime", lat: 6.4250, lng: 1.2130 },
  { id: "p7", name: "Pharmacie Kpalimé", address: "Rue du Marché, Kpalimé", phone: "+22824410303", zone: "plateaux", lat: 6.9000, lng: 0.6300 },
  { id: "p8", name: "Pharmacie Atakpamé", address: "Quartier Agbonou, Atakpamé", phone: "+22824420404", zone: "plateaux", lat: 7.5300, lng: 1.1300 },
  { id: "p9", name: "Pharmacie Sokodé Centre", address: "Avenue de la République, Sokodé", phone: "+22825510505", zone: "centrale", lat: 8.9833, lng: 1.1333 },
  { id: "p10", name: "Pharmacie Tchamba", address: "Centre-ville, Tchamba", phone: "+22825520606", zone: "centrale", lat: 9.0333, lng: 1.4167 },
  { id: "p11", name: "Pharmacie Kara Nord", address: "Bd du 30 Août, Kara", phone: "+22826610707", zone: "kara", lat: 9.5511, lng: 1.1861 },
  { id: "p12", name: "Pharmacie Bassar", address: "Route de Kara, Bassar", phone: "+22826620808", zone: "kara", lat: 9.2533, lng: 0.7833 },
  { id: "p13", name: "Pharmacie Dapaong", address: "Centre Commercial, Dapaong", phone: "+22827710909", zone: "savanes", lat: 10.8625, lng: 0.2078 },
  { id: "p14", name: "Pharmacie Mango", address: "Route Nationale 1, Mango", phone: "+22827721010", zone: "savanes", lat: 10.3611, lng: 0.4711 },
];

export type Emergency = { id: string; fr: string; en: string; phone: string };
export const EMERGENCIES: Emergency[] = [
  { id: "police", fr: "Police", en: "Police", phone: "117" },
  { id: "pompiers", fr: "Sapeurs-Pompiers", en: "Fire Brigade", phone: "118" },
  { id: "samu", fr: "SAMU", en: "Ambulance (SAMU)", phone: "111" },
  { id: "gendarmerie", fr: "Gendarmerie", en: "Gendarmerie", phone: "1722" },
];

export type Medicine = { id: string; molecule: string; form_fr: string; form_en: string; dosage: string };
export const MEDICINES: Medicine[] = [
  { id: "m1", molecule: "Paracétamol", form_fr: "Comprimé", form_en: "Tablet", dosage: "500 mg" },
  { id: "m2", molecule: "Paracétamol", form_fr: "Sirop", form_en: "Syrup", dosage: "120 mg / 5 mL" },
  { id: "m3", molecule: "Ibuprofène", form_fr: "Comprimé", form_en: "Tablet", dosage: "400 mg" },
  { id: "m4", molecule: "Amoxicilline", form_fr: "Gélule", form_en: "Capsule", dosage: "500 mg" },
  { id: "m5", molecule: "Amoxicilline", form_fr: "Poudre pour suspension", form_en: "Powder for suspension", dosage: "250 mg / 5 mL" },
  { id: "m6", molecule: "Métronidazole", form_fr: "Comprimé", form_en: "Tablet", dosage: "500 mg" },
  { id: "m7", molecule: "Artéméther + Luméfantrine", form_fr: "Comprimé", form_en: "Tablet", dosage: "20/120 mg" },
  { id: "m8", molecule: "Oméprazole", form_fr: "Gélule", form_en: "Capsule", dosage: "20 mg" },
  { id: "m9", molecule: "Cétirizine", form_fr: "Comprimé", form_en: "Tablet", dosage: "10 mg" },
  { id: "m10", molecule: "Loratadine", form_fr: "Comprimé", form_en: "Tablet", dosage: "10 mg" },
  { id: "m11", molecule: "Aspirine", form_fr: "Comprimé", form_en: "Tablet", dosage: "500 mg" },
  { id: "m12", molecule: "Sulfadoxine + Pyriméthamine", form_fr: "Comprimé", form_en: "Tablet", dosage: "500/25 mg" },
  { id: "m13", molecule: "Ciprofloxacine", form_fr: "Comprimé", form_en: "Tablet", dosage: "500 mg" },
  { id: "m14", molecule: "Salbutamol", form_fr: "Aérosol", form_en: "Inhaler", dosage: "100 µg/dose" },
];
