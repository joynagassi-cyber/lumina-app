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
    // Alias tsconfig du backend (Phase D — le code canonique les utilise encore)
    '^@domains/(.*)$': '<rootDir>/src/safe-boot/backend/src/domains/$1',
    '^@shared/(.*)$': '<rootDir>/src/safe-boot/backend/src/shared/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/safe-boot/backend/src/infrastructure/$1',
    '^@config/(.*)$': '<rootDir>/src/safe-boot/backend/src/config/$1',
    '^@common/(.*)$': '<rootDir>/src/safe-boot/backend/src/common/$1',
  },
  // Le jest racine est backend : les tests frontend appartiennent à leurs workspaces
  // (jest-expo) et ne doivent pas être collectés ici (3 copies legacy de reporting).
  testPathIgnorePatterns: ['/node_modules/', '/backup-structure/', '/frontend/', '/src/safe-boot/frontend/'],
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
