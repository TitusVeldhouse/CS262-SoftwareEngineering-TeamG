/**
 * Jest global setup: runs once before any test file.
 *
 * It checks whether a Supabase database is reachable with the settings in
 * server/.env and records the answer in process.env.SUPABASE_AVAILABLE
 * ('1' or '0'). Test files that need the real database use that flag to run
 * or skip (see catalog.integration.test.js), so `npm test` still works on a
 * machine without Docker or Supabase.
 */
const { createClient } = require('@supabase/supabase-js');
const { loadEnvFile } = require('../db/supabase');

const PROBE_TIMEOUT_MS = 5000;

async function canReachSupabase() {
  loadEnvFile();
  const { SUPABASE_URL: url, SUPABASE_ANON_KEY: key } = process.env;
  if (!url || !key) {
    return { ok: false, reason: 'SUPABASE_URL or SUPABASE_ANON_KEY is not set (no server/.env?)' };
  }

  const client = createClient(url, key, { auth: { persistSession: false } });
  const timeout = new Promise((resolve) =>
    setTimeout(() => resolve({ error: { message: `no answer within ${PROBE_TIMEOUT_MS} ms` } }), PROBE_TIMEOUT_MS)
  );
  try {
    const { error } = await Promise.race([client.from('buildings').select('id').limit(1), timeout]);
    return error ? { ok: false, reason: error.message } : { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

module.exports = async function supabaseProbe() {
  const { ok, reason } = await canReachSupabase();
  process.env.SUPABASE_AVAILABLE = ok ? '1' : '0';
  if (!ok) {
    console.log(
      `\nSupabase is not reachable (${reason}).\n` +
        'Skipping catalog.integration.test.js. Run `npx supabase start` and ' +
        '`npx supabase db reset`, and fill in server/.env to include it.\n'
    );
  }
};
