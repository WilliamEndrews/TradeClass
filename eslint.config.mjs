// Fast lint tier for TradeClass monorepo (pnpm workspaces).
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";

import quality from "./eslint-rules/index.cjs";

export default defineConfig([
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
      globals: {
        console: "readonly",
        process: "readonly",
        fetch: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        document: "readonly",
        window: "readonly",
        HTMLElement: "readonly",
        HTMLCanvasElement: "readonly",
        CanvasRenderingContext2D: "readonly",
        Image: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        localStorage: "readonly",
        WebSocket: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        MouseEvent: "readonly",
        KeyboardEvent: "readonly",
        WheelEvent: "readonly",
        ResizeObserver: "readonly",
        performance: "readonly",
        atob: "readonly",
        btoa: "readonly",
        structuredClone: "readonly",
        crypto: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        AbortController: "readonly",
        Response: "readonly",
        Request: "readonly",
        Headers: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        File: "readonly",
        FileReader: "readonly",
        URLSearchParams: "readonly",
        navigator: "readonly",
        NodeJS: "readonly",
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.strict,

  {
    plugins: { "import-x": importX },
    settings: {
      "import-x/resolver-next": [createTypeScriptImportResolver()],
    },
    rules: {
      "import-x/no-unresolved": "off",
      "import-x/no-duplicates": "warn",
    },
  },
  {
    files: [
      "apps/**/*.{js,jsx,ts,tsx,mjs,cjs}",
      "packages/**/*.{js,jsx,ts,tsx,mjs,cjs}",
      "scripts/**/*.{js,mjs,cjs,ts}",
    ],
    plugins: { quality },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-var": "error",
      "prefer-const": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-dynamic-delete": "warn",
      "@typescript-eslint/no-invalid-void-type": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-require-imports": "off",
      complexity: ["warn", 12],
      "max-depth": ["warn", 4],
      "max-statements": ["warn", 20],
      "max-params": ["warn", 4],
      "max-lines-per-function": [
        "warn",
        { max: 150, skipBlankLines: true, skipComments: true },
      ],
      "max-nested-callbacks": ["warn", 3],
      // quality/max-lines: baseline pos-fork — promover a "error" quando zerar.
      // Decision gate (prompt 02): opcao B — corrigir o barato; cauda (lab ~3k,
      // sprite-factory, renderer) rastreada como divida, nao silenciar.
      "quality/max-lines": ["warn", { max: 350 }],
      "quality/no-direct-console": "warn",
    },
  },
  {
    files: [
      "apps/server/src/**/*.{ts,js}",
      "scripts/**/*.{js,mjs,cjs,ts}",
      "**/lab-server.mjs",
    ],
    rules: {
      "quality/no-direct-console": "off",
    },
  },
  {
    files: [
      "**/*.test.{ts,tsx,js,mjs}",
      "**/{__tests__,__mocks__,fixtures,mocks}/**/*.{ts,tsx,js,mjs}",
    ],
    plugins: { quality },
    rules: {
      "quality/max-lines": ["warn", { max: 350, includeTests: true }],
      "max-statements": "off",
      "max-lines-per-function": "off",
      "max-nested-callbacks": "off",
    },
  },
  {
    files: ["eslint-rules/**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { module: "readonly", require: "readonly", __dirname: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  globalIgnores([
    "node_modules/**",
    "dist/**",
    "build/**",
    "coverage/**",
    "**/*.tsbuildinfo",
    "pnpm-lock.yaml",
    "assets-source/**",
    "packages/contracts/schema/**",
    "**/.turbo/**",
    "out.log",
    "verify.mjs",
  ]),
]);
