// ESLint 9 flat config. Replaces the legacy .eslintrc.json (`{ "extends": "next/core-web-vitals" }`).
//
// eslint-config-next@15.5.20 still ships ONLY eslintrc-format configs (index.js / core-web-vitals.js
// — no `exports` field, no flat entrypoint), so FlatCompat from @eslint/eslintrc bridges them into
// flat config. A native flat config lands in eslint-config-next v16; drop the bridge then.
//
// .mjs, not .js: this repo is CommonJS (no "type": "module"), but ESLint's lookup order puts
// eslint.config.js ahead of .mjs, so never add a .js variant alongside this file — it would
// silently shadow it. .mjs also matches what create-next-app@15 and the Next codemods emit.
import { FlatCompat } from "@eslint/eslintrc";
// Flat config requires a rule's plugin to be registered in the SAME config object.
// FlatCompat registers @typescript-eslint for its own generated objects, but our
// no-unused-vars rule block below lives in a separate object, so we register it there
// too. It resolves to the same singleton module FlatCompat uses (require cache), so
// there is no "plugin redefined" conflict.
import tseslint from "@typescript-eslint/eslint-plugin";

// import.meta.dirname requires Node >= 20.11 — satisfied by engines.node "22.x" / .nvmrc.
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

// Assigned to a named const before export: a bare `export default [...]` makes this file trip
// import/no-anonymous-default-export when it lints itself (flat config widens the lint surface
// to root config files).
const eslintConfig = [
  {
    // An object containing only `ignores` is a global ignore in flat config.
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**", // vitest --coverage emits .js report assets that ESLint would otherwise lint
      "next-env.d.ts",
    ],
  },
  // Only core-web-vitals, matching the old .eslintrc.json exactly. Deliberately NOT
  // "next/typescript" — it enables @typescript-eslint/recommended, which fails this codebase
  // with 34 errors (mostly no-explicit-any). Adopting it is a separate cleanup, not this phase.
  ...compat.extends("next/core-web-vitals"),
  {
    // Restore `next lint`'s extension coverage (.js/.jsx/.ts/.tsx). Flat config only lints
    // .js/.cjs/.mjs by default; the next config's TS override adds .ts/.tsx but nothing adds
    // .jsx, so a stray .jsx would silently go unlinted. No .jsx exists today — this is parity
    // insurance so the rules above apply if one is ever added.
    files: ["**/*.jsx"],
  },
  {
    // ESLint 9 flipped linterOptions.reportUnusedDisableDirectives from "off" (v8) to "warn".
    // This repo has 5 file-level eslint-disable comments for rules next/core-web-vitals never
    // enables, so they were always no-ops and would now all warn. Keeping this off makes the
    // v8 -> v9 move strictly behaviour-preserving; removing those 5 stale directives instead
    // is queued as a cleanup.
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },
  {
    // Plain JS/MJS (eslint.config.mjs, postcss.config.js, scripts/*.js) — the TS-aware rule
    // below only covers .ts/.tsx, so without this the "enable no-unused-vars" goal would
    // leave every non-TS file unchecked. Base rule here; no type information needed.
    files: ["**/*.js", "**/*.mjs", "**/*.cjs", "**/*.jsx"],
    rules: {
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // BUGS-2: enforce no-unused-vars. The @typescript-eslint plugin is already registered
    // for .ts/.tsx by the FlatCompat bridge above (eslint-config-next's TS override), so we
    // switch off the base rule and enable the TS-aware one (it understands type-only usage,
    // avoiding false positives on interfaces/imported types). Underscore-prefixed names are
    // treated as intentionally-unused (e.g. `const [, x]` array holes, `_arg` params).
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];

export default eslintConfig;
