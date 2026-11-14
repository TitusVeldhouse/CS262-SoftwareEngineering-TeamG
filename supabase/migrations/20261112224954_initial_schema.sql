-- =============================================================================
-- CalvinFinder: initial database schema
-- =============================================================================
-- This file creates every table, view, and function the app needs. It follows
-- the team domain model (docs/updatedDomainModel.jpeg):
--
--   Campus Map -> Buildings -> Floors -> Rooms
--                                     -> POIs (points of interest)
--   User (Supabase auth.users) -> Accounts (profiles) -> Favorite List (favorites)
--
-- Quick notes for anyone who has not used Postgres before:
--   * "bigint generated always as identity" makes the id an auto-numbered column
--     that Postgres fills in for you; you never insert it yourself.
--   * "references other_table(id)" is a foreign key: the value has to match a row
--     in the other table. "on delete cascade" means that if the parent row is
--     deleted, its child rows are deleted too (delete a building and its floors,
--     rooms, and POIs go with it).
--   * "check (...)" is a rule Postgres enforces on every insert and update.
--   * Row-level security (RLS) decides which rows each user may read or change.
--     Once RLS is enabled, nothing is allowed unless a policy allows it. The
--     Express server uses the service role key, which skips RLS entirely.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- campus_map
-- The single campus overview image the app draws building pins on.
-- Domain model: "Campus Map".
-- -----------------------------------------------------------------------------
create table public.campus_map (
  id bigint generated always as identity primary key,
  name text not null,
  -- Path relative to client/assets/images/, e.g. 'campus-map.png'.
  image_path text not null,
  -- Real pixel size of the image, used to turn percentages into positions.
  width int not null check (width > 0),
  height int not null check (height > 0),
  created_at timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- buildings
-- One row per campus building. Domain model: "Buildings".
-- -----------------------------------------------------------------------------
create table public.buildings (
  id bigint generated always as identity primary key,
  campus_map_id bigint not null references public.campus_map (id) on delete cascade,
  -- Canonical name, taken from the floor plan manifest.
  name text not null unique,
  -- Short code used in room ids, e.g. 'HH' for Hiemenga Hall. Optional.
  code text unique,
  -- Other names people use for the building, e.g. 'Spoelhof Center'.
  aliases text[] not null default '{}',
  -- Pin position on the campus map as a percent of its width (x = left) and
  -- height (y = top). Empty when we do not have a pin for the building yet.
  campus_x numeric(5, 2) check (campus_x between 0 and 100),
  campus_y numeric(5, 2) check (campus_y between 0 and 100),
  created_at timestamptz not null default now()
);

create index buildings_campus_map_id_idx on public.buildings (campus_map_id);


-- -----------------------------------------------------------------------------
-- floors
-- One floor of a building, with its floor plan image. Domain model: "Floors".
-- -----------------------------------------------------------------------------
create table public.floors (
  id bigint generated always as identity primary key,
  building_id bigint not null references public.buildings (id) on delete cascade,
  -- Numeric level used for ordering: 0 = ground/basement, -1 = sub-basement.
  level int not null,
  -- Label shown to users, e.g. 'Level 2' or 'Sub-Basement'.
  label text not null,
  -- Path relative to client/assets/floorplans/.
  plan_path text,
  plan_width int,
  plan_height int,
  created_at timestamptz not null default now(),
  -- A building cannot have two floors with the same level. The index behind
  -- this rule starts with building_id, so it also serves as the foreign key
  -- index for building_id.
  unique (building_id, level)
);


-- -----------------------------------------------------------------------------
-- room_type
-- The allowed room categories. Must match the RoomType union in
-- client/src/data/campus-layout.ts.
-- -----------------------------------------------------------------------------
create type public.room_type as enum (
  'classroom',
  'lecture_hall',
  'lab',
  'office',
  'auditorium',
  'study',
  'dining',
  'restroom',
  'facility',
  'lounge'
);


-- -----------------------------------------------------------------------------
-- rooms
-- A room on a floor. Domain model: "Rooms".
-- -----------------------------------------------------------------------------
create table public.rooms (
  id bigint generated always as identity primary key,
  floor_id bigint not null references public.floors (id) on delete cascade,
  -- Room number as written on the door, e.g. '211' or '010' (text keeps
  -- leading zeros).
  room_number text not null,
  name text,
  type public.room_type,
  -- Search tags and alternate names, e.g. '{SAS, Academic Advising}'.
  aliases text[] not null default '{}',
  -- Pixel position on the floor plan image.
  x numeric,
  y numeric,
  created_at timestamptz not null default now(),
  -- Room numbers are unique within a floor. The index behind this rule starts
  -- with floor_id, so it also serves as the foreign key index for floor_id.
  unique (floor_id, room_number)
);


-- -----------------------------------------------------------------------------
-- poi_type
-- The allowed kinds of point of interest.
-- -----------------------------------------------------------------------------
create type public.poi_type as enum (
  'restroom',
  'printer',
  'water_fountain',
  'vending_machine',
  'elevator',
  'other'
);


-- -----------------------------------------------------------------------------
-- points_of_interest
-- A useful spot on a floor, such as a printer or water fountain.
-- Domain model: "POIs". Every POI belongs to a floor; there are no outdoor POIs.
-- -----------------------------------------------------------------------------
create table public.points_of_interest (
  id bigint generated always as identity primary key,
  floor_id bigint not null references public.floors (id) on delete cascade,
  type public.poi_type not null,
  label text not null,
  -- Pixel position on the floor plan image.
  x numeric,
  y numeric,
  created_at timestamptz not null default now()
);

create index points_of_interest_floor_id_idx on public.points_of_interest (floor_id);


-- -----------------------------------------------------------------------------
-- profiles
-- App-specific data for a signed-in user. Domain model: "Accounts".
-- The "User" box is Supabase's built-in auth.users table, which stores the
-- email and password. Each auth user gets exactly one profile (1-1).
-- -----------------------------------------------------------------------------
create table public.profiles (
  -- Same id as the auth user, so the two rows are linked one-to-one.
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  -- Free-form user preferences, stored as JSON.
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Creates a profile automatically whenever someone signs up.
-- "security definer" runs the function with its owner's permissions, because
-- the signing-up user is not yet allowed to write to profiles. The empty
-- search_path stops it from picking up a look-alike table from another schema;
-- that is why every name inside is written in full (public.profiles).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- favorites
-- One saved room or POI for one user. Domain model: "Favorite List".
-- A user's favorite list is all of their rows here; there is no separate list
-- table. Buildings cannot be favorited.
-- -----------------------------------------------------------------------------
create table public.favorites (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  room_id bigint references public.rooms (id) on delete cascade,
  poi_id bigint references public.points_of_interest (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Exactly one of room_id / poi_id is filled in: a favorite points at either a
  -- room or a POI, never both and never neither.
  check (num_nonnulls(room_id, poi_id) = 1)
);

create index favorites_user_id_idx on public.favorites (user_id);
create index favorites_room_id_idx on public.favorites (room_id);
create index favorites_poi_id_idx on public.favorites (poi_id);

-- A user cannot favorite the same room or the same POI twice. "where ... is not
-- null" limits each rule to rows of that kind.
create unique index favorites_user_room_unique
  on public.favorites (user_id, room_id) where room_id is not null;
create unique index favorites_user_poi_unique
  on public.favorites (user_id, poi_id) where poi_id is not null;


-- -----------------------------------------------------------------------------
-- search_index (view)
-- One row per searchable thing (building, room, or POI) so search only has to
-- look in one place. A view stores no data; it is a saved query that always
-- shows the current rows. security_invoker makes it respect the RLS of the
-- person querying it instead of the view's owner.
-- -----------------------------------------------------------------------------
create view public.search_index
with (security_invoker = true)
as
select
  'building'::text as kind,
  b.id,
  b.name,
  b.id as building_id,
  b.name as building_name,
  null::bigint as floor_id,
  null::int as floor_level,
  null::text as floor_label,
  lower(concat_ws(' ', b.name, b.code, array_to_string(b.aliases, ' '))) as search_text
from public.buildings b

union all

select
  'room'::text,
  r.id,
  -- Rooms without a name fall back to their room number.
  coalesce(r.name, r.room_number),
  b.id,
  b.name,
  f.id,
  f.level,
  f.label,
  lower(concat_ws(' ', r.name, r.room_number, array_to_string(r.aliases, ' ')))
from public.rooms r
join public.floors f on f.id = r.floor_id
join public.buildings b on b.id = f.building_id

union all

select
  'poi'::text,
  p.id,
  p.label,
  b.id,
  b.name,
  f.id,
  f.level,
  f.label,
  -- The type is added both as stored ('water_fountain') and with spaces
  -- ('water fountain') so either spelling matches.
  lower(concat_ws(' ', p.label, p.type::text, replace(p.type::text, '_', ' ')))
from public.points_of_interest p
join public.floors f on f.id = p.floor_id
join public.buildings b on b.id = f.building_id;


-- -----------------------------------------------------------------------------
-- search_locations(q)
-- Case-insensitive "contains" search over search_index, for
-- GET /api/v1/search. Blank or missing q returns no rows. Results are ordered
-- buildings first, then rooms, then POIs, then by name, capped at 50.
-- "stable" tells Postgres the function only reads data.
-- -----------------------------------------------------------------------------
create function public.search_locations(q text)
returns setof public.search_index
language sql
stable
set search_path = ''
as $$
  select s.*
  from public.search_index s
  where btrim(q) <> ''
    -- strpos does a plain substring match, so characters like % and _ in the
    -- search text are treated literally (unlike LIKE).
    and strpos(s.search_text, lower(btrim(q))) > 0
  order by
    case s.kind when 'building' then 1 when 'room' then 2 else 3 end,
    s.name
  limit 50;
$$;

grant execute on function public.search_locations(text) to anon, authenticated;


-- =============================================================================
-- Row-level security
-- =============================================================================

alter table public.campus_map enable row level security;
alter table public.buildings enable row level security;
alter table public.floors enable row level security;
alter table public.rooms enable row level security;
alter table public.points_of_interest enable row level security;
alter table public.profiles enable row level security;
alter table public.favorites enable row level security;

-- Campus data is public: anyone, signed in or not, can read it. There are no
-- insert/update/delete policies, so only the server (service role) can change it.
create policy "campus map is readable by everyone"
  on public.campus_map for select to anon, authenticated using (true);

create policy "buildings are readable by everyone"
  on public.buildings for select to anon, authenticated using (true);

create policy "floors are readable by everyone"
  on public.floors for select to anon, authenticated using (true);

create policy "rooms are readable by everyone"
  on public.rooms for select to anon, authenticated using (true);

create policy "points of interest are readable by everyone"
  on public.points_of_interest for select to anon, authenticated using (true);

-- Profiles: a user can see and edit only their own row. auth.uid() is the id of
-- the signed-in user. "(select auth.uid())" lets Postgres work it out once per
-- query instead of once per row.
create policy "users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

-- "using" picks which rows can be edited; "with check" stops a user from
-- changing the id to someone else's.
create policy "users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Favorites: a user can see, add, and remove only their own favorites.
create policy "users can read their own favorites"
  on public.favorites for select to authenticated
  using ((select auth.uid()) = user_id);

-- "with check" stops a user from adding a favorite under someone else's id.
create policy "users can add their own favorites"
  on public.favorites for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users can delete their own favorites"
  on public.favorites for delete to authenticated
  using ((select auth.uid()) = user_id);
