/** Runs once after the end-to-end tests: stops the test server. */
module.exports = async function globalTeardown() {
  const child = globalThis.__E2E_SERVER__;
  if (child && child.exitCode === null) {
    child.kill();
  }
};
