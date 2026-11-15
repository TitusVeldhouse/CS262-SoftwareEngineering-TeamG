/**
 * Jest config for the end-to-end tests in e2e/ (run with `npm run test:e2e`).
 *
 * These tests use the client's real API code against the real server over
 * HTTP. They reuse jest-expo only to compile TypeScript, and run in a plain
 * Node environment instead of the React Native one, because the React Native
 * test setup replaces fetch() with a mock.
 */
const expoPreset = require('jest-expo/jest-preset');

module.exports = {
  rootDir: __dirname,
  transform: expoPreset.transform,
  transformIgnorePatterns: expoPreset.transformIgnorePatterns,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/e2e/**/*.e2e.test.ts'],
  globalSetup: '<rootDir>/e2e/global-setup.js',
  globalTeardown: '<rootDir>/e2e/global-teardown.js',
  testTimeout: 15000,
};
