// Shared mocked campus locations, POI categories, and manifest building mapping.
// Kept in a standalone data module so screens and campus-layout can reference
// them without circular imports.

export const LOCATIONS = [
  { name: "Hekman Library", top: "62.3%", left: "31.2%" },
  { name: "Covenant Fine Arts Center", top: "58.1%", left: "37.4%" },
  { name: "Spoelhof Center", top: "63.3%", left: "24.2%" },
  { name: "Fieldhouse", top: "39.7%", left: "23.8%" },
  { name: "Hiemenga Hall", top: "64.1%", left: "28.3%" },
  { name: "Devos Communication Building", top: "61.8%", left: "46.6%" },
  { name: "Science Building", top: "54.6%", left: "25.7%" },
  { name: "DeVries Hall", top: "55.0%", left: "23.5%" },
  { name: "North Hall", top: "51.8%", left: "26.6%" },
  { name: "Chapel", top: "66.5%", left: "27.4%" },
  { name: "Commons Annex", top: "58.7%", left: "32.5%" },
  { name: "Commons", top: "56.5%", left: "32.8%" },
] as const;

// Maps campus locations to their catalog names in room-search-data.ts / floorplan-manifest.ts
export const CAMPUS_TO_MANIFEST_BUILDINGS: Record<string, string> = {
  "Hekman Library": "Hekman Library",
  "Covenant Fine Arts Center": "Covenant Fine Arts Center",
  "Spoelhof Center": "Spoelhof University Center",
  "Fieldhouse": "Spoelhof Fieldhouse",
  "Hiemenga Hall": "Hiemenga Hall",
  "Devos Communication Building": "Devos Communication Center",
  "Science Building": "Science Building",
  "DeVries Hall": "Devries Hall",
  "North Hall": "North Hall",
  "Chapel": "Chapel",
  "Commons Annex": "Commons Annex",
  "Commons": "Commons",
};

export type LocationName = (typeof LOCATIONS)[number]["name"];

// Mocked category filters shown in the horizontal checklist above the campus map.
export const POINTS_OF_INTEREST = [
  "Restrooms",
  "Printers",
  "Water Fountains",
  "Vending Machines",
] as const;

export type PointOfInterest = (typeof POINTS_OF_INTEREST)[number];
