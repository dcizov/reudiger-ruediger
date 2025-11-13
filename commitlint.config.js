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
 *
 * @type {import('@commitlint/types').UserConfig}
 */
const commitLintConfig = {
  extends: ['@commitlint/config-conventional'],

  rules: {
    'scope-empty': [2, 'never'],

    'scope-enum': [
      2,
      'always',
      [
        'auth',
        'api',
        'ui',
        'db',
        'config',
        'build',
        'tests',
        'infra',
        'docs',
        'deps',
      ],
    ],

    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'chore',
        'style',
        'refactor',
        'ci',
        'test',
        'revert',
        'perf',
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-empty': [2, 'never'],
    'body-max-line-length': [2, 'always', 100],
  },
};

export default commitLintConfig;
