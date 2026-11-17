-- =============================================================================
-- CalvinFinder: let a favorite point at a building, a floor, or a POI category
-- =============================================================================
-- The app lets users save four kinds of favorites (see
-- client/src/data/favorites.ts):
--
--   building   "building:Hiemenga Hall"          -> buildings.id
--   floor      "floor:Hiemenga Hall:Level 2"     -> floors.id
--   room       "room:HH-211"                     -> rooms.id        (already supported)
--   POI type   "poi:Printers" (a map filter)     -> poi_type value  (all printers)
--
-- The initial schema only allowed rooms and single POIs. This migration adds
-- three more target columns and keeps the rule that every favorite points at
-- exactly one thing.
--
-- This is a NEW migration on purpose: never edit a migration that has already
-- been applied (20261112224954_initial_schema.sql).
-- =============================================================================

alter table public.favorites
  -- A whole building. Deleting the building deletes the favorite.
  add column building_id bigint references public.buildings (id) on delete cascade,
  -- One floor of a building (the floor row already says which building).
  add column floor_id bigint references public.floors (id) on delete cascade,
  -- A kind of POI rather than one POI, e.g. 'printer' for "all printers".
  -- It uses the same enum as points_of_interest.type, so only real types fit.
  add column poi_type public.poi_type;

-- Replace the old "room or POI" rule with "exactly one of the five targets".
-- The old check was created without a name, so Postgres named it for us. This
-- block looks the name up instead of guessing it.
do $$
declare
  old_check_name text;
begin
  select conname into old_check_name
  from pg_constraint
  where conrelid = 'public.favorites'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%num_nonnulls(room_id, poi_id)%';

  if old_check_name is not null then
    execute format('alter table public.favorites drop constraint %I', old_check_name);
  end if;
end;
$$;

alter table public.favorites
  add constraint favorites_exactly_one_target
  check (num_nonnulls(room_id, poi_id, building_id, floor_id, poi_type) = 1);

-- Indexes for the new foreign keys, so deleting a building or floor can find
-- its favorites quickly.
create index favorites_building_id_idx on public.favorites (building_id);
create index favorites_floor_id_idx on public.favorites (floor_id);

-- A user cannot save the same building, floor, or POI type twice. As with the
-- room and POI rules, "where ... is not null" limits each rule to its own kind.
create unique index favorites_user_building_unique
  on public.favorites (user_id, building_id) where building_id is not null;
create unique index favorites_user_floor_unique
  on public.favorites (user_id, floor_id) where floor_id is not null;
create unique index favorites_user_poi_type_unique
  on public.favorites (user_id, poi_type) where poi_type is not null;

-- Row-level security does not need to change: the existing favorites policies
-- check only user_id, so they already cover the new columns.
