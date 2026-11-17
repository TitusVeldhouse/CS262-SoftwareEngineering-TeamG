const { assertSupabaseConfig } = require('./db/supabase');
const app = require('./app');

// Stop right away with a clear message if the Supabase settings are missing.
assertSupabaseConfig();

app.listen(3000, '0.0.0.0', () => console.log('Listening on http://localhost:3000'));
