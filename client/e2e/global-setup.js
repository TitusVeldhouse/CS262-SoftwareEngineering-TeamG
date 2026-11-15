/**
 * Runs once before the end-to-end tests: starts the real server in its own
 * Node process and points the client at it.
 *
 * The client reads the server address from EXPO_PUBLIC_API_URL, so setting it
 * here makes src/services/api.ts talk to this test server over real HTTP.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const SERVER_DIR = path.join(__dirname, '..', '..', 'server');
const STARTUP_TIMEOUT_MS = 15000;

module.exports = async function globalSetup() {
  if (!fs.existsSync(path.join(SERVER_DIR, 'node_modules'))) {
    throw new Error(
      'The end-to-end tests start the real server, but its packages are not installed. ' +
        'Run `npm install` in the server/ folder first.',
    );
  }

  // NODE_ENV=test keeps the server's account store in memory, so test
  // accounts are never written to server/.data/accounts.json.
  const child = spawn(process.execPath, [path.join(__dirname, 'start-server.js')], {
    cwd: SERVER_DIR,
    env: { ...process.env, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const port = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Test server did not start within ${STARTUP_TIMEOUT_MS} ms.\n${output}`));
    }, STARTUP_TIMEOUT_MS);

    const onData = (chunk) => {
      output += chunk.toString();
      const match = output.match(/E2E_SERVER_PORT=(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Test server exited early (code ${code}).\n${output}`));
    });
  });

  process.env.EXPO_PUBLIC_API_URL = `http://127.0.0.1:${port}`;
  // Saved so global-teardown.js can stop the server.
  globalThis.__E2E_SERVER__ = child;
};
