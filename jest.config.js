/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/client/'],
  collectCoverageFrom: ['*.js', '!jest.config.js', '!node_modules/**'],
  coverageDirectory: 'coverage',
};
