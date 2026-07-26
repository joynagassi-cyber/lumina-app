import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testDirectory: "../test",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  collectCoverageFrom: [
    "**/*.(t|j)s",
    "!main.ts",
    "!**/*.dto.ts",
    "!**/*.module.ts",
    "!**/*.controller.ts",
    "!**/*.service.ts",
    "!**/*.guard.ts",
    "!**/*.interceptor.ts",
    "!**/*.middleware.ts",
    "!**/*.filter.ts",
    "!**/*.pipe.ts",
  ],
  coverageDirectory: "../coverage",
  coveragePathIgnorePatterns: ["/node_modules/", "/test/"],
  testEnvironment: "node",
  moduleNameMapper: {
    "^@domains/(.*)$": "<rootDir>/domains/$1",
    "^@infrastructure/(.*)$": "<rootDir>/infrastructure/$1",
    "^@shared/(.*)$": "<rootDir>/shared/$1",
    "^@config/(.*)$": "<rootDir>/config/$1",
    "^@common/(.*)$": "<rootDir>/common/$1",
  },
  globals: {
    "ts-jest": {
      tsconfig: "../tsconfig.json",
    },
  },
};

export default config;
