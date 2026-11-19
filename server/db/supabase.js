/**
 * Creates the one Supabase client the server uses to read campus data.
 *
 * How the pieces fit together:
 *   - The Expo app never talks to Supabase. It calls this Express server
 *     (/api/v1/...), and the server talks to Supabase.
 *   - Supabase gives every project two kinds of keys. The "anon" key can only
 *     do what the database's row-level security (RLS) rules allow; for campus
 *     data that means read-only. The "service role" key skips RLS entirely, so
 *     anyone holding it can change or delete anything.
 *   - Campus data (buildings, floors, rooms, POIs, search) is public and
 *     read-only, so the server uses the anon key for it. That way even a bug in
 *     the server cannot change campus data through this client.
 *   - Accounts and favorites still use server/accountStore.js for now. When they
 *     move to Supabase, any service role key must stay in server/.env only and
 *     never be put in the client app, because the app bundle is public.
 *
 * Settings come from environment variables. For local development they are
 * read from server/.env (copy .env.example to .env and fill it in).
 */
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const ENV_FILE_PATH = path.join(__dirname, '..', '.env');
const REQUIRED_VARIABLES = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];

let catalogClient = null;

/**
 * Loads server/.env into process.env if the file exists. Values that are
 * already set (for example by the shell or a test) are not overwritten.
 */
function loadEnvFile() {
  if (fs.existsSync(ENV_FILE_PATH)) {
    process.loadEnvFile(ENV_FILE_PATH);
  }
}

/**
 * Throws a clear error if a required setting is missing, so the server stops
 * at startup instead of failing later on the first request.
 */
function assertSupabaseConfig() {
  loadEnvFile();
  const missing = REQUIRED_VARIABLES.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing Supabase settings: ${missing.join(', ')}. ` +
        'Copy server/.env.example to server/.env and fill in the values printed by ' +
        '`npx supabase start` (see server/README.md).'
    );
  }
}

/**
 * Returns the shared read-only client for campus data. It is created on first
 * use, so modules can be loaded (for example by tests that mock the data
 * layer) without any Supabase settings.
 */
function getCatalogClient() {
  if (!catalogClient) {
    assertSupabaseConfig();
    catalogClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      // The server keeps no user sessions in this client; it only reads public data.
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return catalogClient;
}

module.exports = {
  assertSupabaseConfig,
  getCatalogClient,
  loadEnvFile,
};
