/** @type {import('prettier').Config & import("@ianvs/prettier-plugin-sort-imports").PluginConfig} */
const prettierConfig = {
  plugins: [
    "@ianvs/prettier-plugin-sort-imports",
  ],
  arrowParens: "always",
  printWidth: 80,
  singleQuote: true,
  semi: true,
  trailingComma: "all",
  tabWidth: 2,
  useTabs: false,
  endOfLine: "lf",
  bracketSpacing: true,
  quoteProps: "as-needed",
  proseWrap: "always",
  jsxSingleQuote: true,
  importOrder: [
    "<THIRD_PARTY_MODULES>",
    "",
    "^@/types/(.*)$",
    "^@/env(.*)$",
    "^@/server/(.*)$",
    "^@/lib/(.*)$",
    "^@/services/(.*)$",
    "^@/commands/(.*)$",
    "^@/utils/(.*)$",
    "",
    "^[./]",
  ],
  importOrderParserPlugins: ["typescript", "decorators-legacy"],
};

export default prettierConfig;
