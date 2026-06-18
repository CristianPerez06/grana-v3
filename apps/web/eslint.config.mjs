// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Storybook build output (regenerable artifact).
    "storybook-static/**",
  ]),
  ...storybook.configs["flat/recommended"],
  {
    rules: {
      // Mount-time setState is intentional in this codebase: query-param "open
      // this drawer" bridges (read window.location once on mount, then open) and
      // SSR "mounted" flags. This rule arrived via a react-hooks plugin bump and
      // flags those idiomatic patterns, so keep it as a warning instead of
      // failing CI.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
