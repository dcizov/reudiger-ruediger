/* eslint-disable import/no-anonymous-default-export */

/**
 * Commitlint configuration enforcing conventional commits with strict scope and type rules.
 * Ensures all commit messages follow a consistent pattern to improve project maintainability,
 * changelog automation, and developer collaboration.
 *
 * Commit message format:
 * <type>(<scope>): <short summary>
 *
 * Example:
 * feat(ui): add responsive navigation drawer
 *
 * Types and scopes are restricted below for consistency.
 */
export default {
  // Extending base conventional commit configuration for standard commit message formats
  extends: ["@commitlint/config-conventional"],

  rules: {
    /**
     * Enforce that commits must always include a scope.
     * Scope is a required descriptive area/module of the change (e.g., 'auth', 'api').
     * Helps in categorizing commits by feature or subproject.
     *
     * Examples of valid scopes:
     * - auth:    authentication logic and user management
     * - api:     API routes, handlers, and data fetching
     * - ui:      user interface components and styling
     * - config:  config files, environment settings
     * - build:   build tools, bundlers, and related scripts
     * - tests:   test files and test-related code
     * - infra:   deployment, cloud, infrastructure scripts
     * - docs:    documentation updates
     */
    "scope-empty": [2, "never"],

    /**
     * Limit allowed scopes to the following values to maintain consistency
     * across the repo. Adjust this list to fit your repo's structure.
     */
    "scope-enum": [
      2,
      "always",
      [
        "auth", // Authentication-related changes
        "api", // API handlers, endpoints, or data-fetching
        "ui", // User interface components and styles
        "config", // Configuration files and settings
        "build", // Build system and tooling
        "tests", // Test files and test-related code
        "infra", // Infrastructure, deployment, cloud, and environment
        "docs", // Documentation files
      ],
    ],

    /**
     * Restrict commit types to the following list. Each type signals
     * the intent of the commit, enabling automated changelog generation
     * and semantic versioning workflows.
     *
     * Usage examples:
     * - feat:    feat(api): add user registration endpoint
     *            A new feature added
     *
     * - fix:     fix(auth): resolve token expiration bug
     *            A bug fix
     *
     * - docs:    docs(ui): update button component README
     *            Documentation only changes
     *
     * - chore:   chore(build): upgrade dependencies to latest versions
     *            Routine tasks not affecting source or tests
     *
     * - style:   style(ui): fix indentation and remove trailing spaces
     *            Formatting or style changes without code logic change
     *
     * - refactor:refactor(api): simplify request validation logic
     *            Code change that neither fixes a bug nor adds a feature
     *
     * - ci:      ci(github): add caching to workflow
     *            Changes related to CI configuration and scripts
     *
     * - test:    test(auth): add tests for login flow
     *            Adding or updating tests without affecting source code
     *
     * - revert:  revert(ui): revert "feat(ui): add new sidebar menu"
     *            Reverts a previous commit
     *
     * - perf:    perf(api): optimize query speed on large datasets
     *            Performance improvements
     */
    "type-enum": [
      2,
      "always",
      [
        "feat", // A new feature for users
        "fix", // A bug fix for existing functionality
        "docs", // Documentation only changes
        "chore", // Non-source code related chores (build, deps)
        "style", // Code style changes (formatting, whitespace)
        "refactor", // Code changes without feature or fix (cleanup)
        "ci", // Continuous Integration config or scripts
        "test", // Tests addition or modification
        "revert", // Revert a previous commit
        "perf", // Performance improvements
      ],
    ],
  },
};
