'use strict'

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: false,
  collectCoverageFrom: ['./src/**/*.ts'],
  coverageReporters: ['json', 'lcov'],
  clearMocks: true,
  globalSetup: './test/setup.js',
  globalTeardown: './test/teardown.js',
  coverageThreshold: {
    global: {
      statements: 90,
      functions: 90,
      branches: 90,
      lines: 90
    }
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/index.ts",
    "!src/relays/*.ts",
    "!src/services/authorizations-service.ts",
    "!src/services/ilp-service.ts"
  ]
}
