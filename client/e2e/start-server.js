/**
 * Starts the real Express server (server/app.js) for the end-to-end tests.
 *
 * It listens on a free port chosen by the operating system (port 0), so it
 * never clashes with a dev server already running on port 3000, then prints
 * the port for global-setup.js to read. Run by global-setup.js, not by hand.
 */
const path = require('node:path');

const app = require(path.join(__dirname, '..', '..', 'server', 'app'));

const server = app.listen(0, '127.0.0.1', () => {
  console.log(`E2E_SERVER_PORT=${server.address().port}`);
});
