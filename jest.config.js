'use strict'

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: false,
  collectCoverageFrom: ['./src/**/*.ts'],
  coverageReporters: ['json', 'lcov'],
  clearMocks: true,
  globalSetup: './test/setup.js',
  globalTeardown: './test/teardown.js'
}
