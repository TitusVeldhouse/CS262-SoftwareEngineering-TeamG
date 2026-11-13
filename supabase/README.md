# CalvinFinder database (Supabase)

This folder holds everything needed to build the CalvinFinder Postgres database:
the schema, the seed data, and the script that generates the seed data.

```
supabase/
  config.toml                              Supabase CLI settings (from `npx supabase init`)
  migrations/20261112224954_initial_schema.sql   tables, view, search function, security rules
  seed.sql                                 starting data (GENERATED; do not edit by hand)
  scripts/generate-seed.mjs                builds seed.sql from the client/server data files
```

## Running the database locally

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) running.
The Supabase CLI runs through `npx`, so there is nothing else to install.

From the repo root:

```bash
npx supabase start      # first run downloads the Docker images (a few minutes)
npx supabase db reset   # wipes the local database, runs the migration, then seed.sql
```

`supabase start` prints the local URLs and keys. Useful ones:

- **Studio** (web UI to browse tables): http://127.0.0.1:54323
- **Database URL**: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- **API URL**, **anon key**, and **service_role key**: these are what the server will use
  in PR 2. The local keys are public demo keys, but never commit the keys of the real
  hosted project.

Stop everything with `npx supabase stop`.

## Changing the seed data

`seed.sql` is generated. Do not edit it by hand. Change the source file, then regenerate:

| Data | Source file |
| --- | --- |
| Buildings and floors | `client/src/data/floorplan-manifest.ts` |
| Rooms and room types | `client/src/data/campus-layout.ts` (`PRELOADED_ROOMS`, `RoomType`) |
| Campus map pins and alternate building names | `client/src/app/finder.tsx` (`LOCATIONS`, `CAMPUS_TO_MANIFEST_BUILDINGS`) |
| Campus map image size | `client/assets/images/campus-map.png` |
| Points of interest | `server/data.js` |

```bash
node supabase/scripts/generate-seed.mjs   # rewrites supabase/seed.sql
npx supabase db reset                     # reload it locally
```

The script prints row counts and any import notes (skipped floors, cleaned-up names,
unmatched rooms or POIs). The same notes are written at the top of `seed.sql`. Commit
the script change and the new `seed.sql` together.

If you add a value to `RoomType` in `campus-layout.ts`, also add it to the `room_type`
enum. To do that, write a **new** migration (`npx supabase migration new add_room_type`
containing `alter type public.room_type add value '...';`), then update the check in
`generate-seed.mjs` that reads the enum. Never edit a migration that has already been
applied to the hosted project.

## Tables

| Table | Domain model box | What it holds |
| --- | --- | --- |
| `campus_map` | Campus Map | The single campus overview image and its pixel size. |
| `buildings` | Buildings | Name, optional short code (`HH`), aliases, and pin position on the campus map (percent). |
| `floors` | Floors | One floor of a building: numeric `level`, display `label`, floor plan image path and size. |
| `rooms` | Rooms | Room number, name, `room_type`, aliases, and pixel position on the floor plan. |
| `points_of_interest` | POIs | Restrooms, printers, water fountains, and so on. Each one is on a floor. |
| `profiles` | Accounts | One row per signed-up user (created automatically on sign-up). The "User" box is Supabase's own `auth.users`. |
| `favorites` | Favorite List | One saved room **or** POI per row. A user's favorite list is all of their rows. |

Hierarchy: `campus_map` → `buildings` → `floors` → `rooms` / `points_of_interest`.
Deleting a parent deletes its children.

Floor levels: `Level N` → `N`, `Sub-Basement` → `-1`, and `Storage Loft` → one above the
building's highest level. The manifest's `Overall Map` image is not a floor, so it is skipped.

### Search

- `search_index` is a view with one row per building, room, and POI. Its columns are `kind`
  (`building` / `room` / `poi`), `id`, `name`, `building_id`, `building_name`, `floor_id`,
  `floor_level`, `floor_label`, and a lowercase `search_text`.
- `search_locations(q)` does a case-insensitive "contains" search over it. Blank input
  returns nothing. Results come back buildings first, then rooms, then POIs, then by name,
  with at most 50 rows. Call it from the Supabase JS client with
  `supabase.rpc('search_locations', { q: 'hiemenga' })`.

### Who can do what (row-level security)

| Table | Anyone (anon) | Signed-in user | Server (service role) |
| --- | --- | --- | --- |
| campus data (`campus_map`, `buildings`, `floors`, `rooms`, `points_of_interest`) | read | read | full access |
| `profiles` | no access | read and update **own** row | full access |
| `favorites` | no access | read, add, and delete **own** rows | full access |

The service role key skips row-level security, so it must stay on the server and never
be shipped in the Expo app.
