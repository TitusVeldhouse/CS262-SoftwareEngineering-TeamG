import { FLOOR_PLANS } from "./floorplan-manifest";

export type FloorPlan = {
  label: string;
  asset: number;
  width: number;
  height: number;
};

export type CampusBuilding = {
  name: string;
  floors: FloorPlan[];
};

const buildingPlans = new Map<string, FloorPlan[]>();

// The manifest keeps per-floor dimensions with the asset for correctly fitted overlays.
for (const plan of FLOOR_PLANS) {
  const floors = buildingPlans.get(plan.building) ?? [];
  floors.push({
    label: plan.label,
    asset: plan.asset,
    width: plan.width,
    height: plan.height,
  });
  buildingPlans.set(plan.building, floors);
}

export const BUILDINGS: CampusBuilding[] = Array.from(
  buildingPlans,
  ([name, floors]) => ({
    name,
    floors: floors.sort((first, second) =>
      first.label.localeCompare(second.label, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    ),
  }),
).sort((first, second) => first.name.localeCompare(second.name));