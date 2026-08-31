/** Iteration 0.1 — lightweight engine test runner.
 * The engine modules are pure TypeScript (no React Native), so we transpile-only
 * with ts-jest in a node environment. isolatedModules (set inside the inline
 * tsconfig, scoped to this transform only) => no type-checking, so tests never
 * depend on or alter engine typing/behaviour, and the project's tsconfig.json is
 * left untouched.
 */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: {
        isolatedModules: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        module: "commonjs",
        moduleResolution: "node",
        strict: false,
        skipLibCheck: true,
      },
    }],
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
};
