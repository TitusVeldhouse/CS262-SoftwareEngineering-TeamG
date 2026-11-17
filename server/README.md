# CalvinFinder server

Express API used by the Expo app (`/api/v1/...`). Campus data (buildings, floors,
rooms, points of interest, search) is read from the Supabase database defined in
`../supabase/`. Accounts and favorites are still handled by `accountStore.js`
(in memory, saved to `.data/accounts.json`); moving them to Supabase is a later PR.

## Setup

You need Node.js 20.12 or newer and Docker (for local Supabase).

```bash
# From the repo root: start the local database and load the schema + seed data
npx supabase start
npx supabase db reset

# In server/
npm install
cp .env.example .env        # then paste the values printed by `npx supabase start`
npm start                   # http://localhost:3000
```

`.env` needs:

| Variable | Where to find it |
| --- | --- |
| `SUPABASE_URL` | "API URL" from `npx supabase start` (local: `http://127.0.0.1:54321`) |
| `SUPABASE_ANON_KEY` | The anon / "Publishable" key from `npx supabase start` |

The server only uses the anon key. It can read campus data but cannot change it,
because the database's row-level security only allows reads. Never put a service
role key in the client app.

## Tests

```bash
npm test
```

- `business.test.js` tests the services with a mocked data layer, so it runs
  anywhere without Supabase.
- `catalog.integration.test.js` runs the catalog routes against a real local
  Supabase. If Supabase is not reachable (no `.env`, or `supabase start` not run),
  these tests are skipped and Jest prints a note saying so.
- `app.test.js` and `favorites.test.js` cover accounts and favorites, which do not
  use Supabase yet.
