module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: [
    '**/tests/**/*.{test,spec}.{ts,tsx}',
    '!**/tests/flows/**',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    // Les domaines backend vivent dans src/safe-boot/backend/src (Phase C)
    '^@/domains/(.*)$': '<rootDir>/src/safe-boot/backend/src/domains/$1',
    '^@/shared/(.*)$': '<rootDir>/src/safe-boot/backend/src/shared/$1',
    '^@/(.*)$': '<rootDir>/src/safe-boot/backend/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      diagnostics: false,
      isolatedModules: true,
    }],
  },
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'src/features/new-feature/**/*.{ts,tsx}',
    'src/models/**/*.{ts,tsx}',
    'src/core/**/*.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 80,
      statements: 80,
    },
  },
};
