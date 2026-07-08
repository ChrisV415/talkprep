import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/.expo/**",
      "**/node_modules/**",
      "**/*.d.ts",
      "**/drizzle/**",
      "artifacts/api-server/dist/**",
      "lib/api-spec/generated/**",
      "lib/api-zod/src/generated/**",
      "lib/api-client-react/src/generated/**",
      ".local/**",
      "attached_assets/**",
      "artifacts/mockup-sandbox/src/components/ui/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["artifacts/mobile/**/*.{ts,tsx}"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
    settings: { react: { version: "detect" } },
  },
  {
    files: ["artifacts/mockup-sandbox/**/*.{ts,tsx}"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react/no-unknown-property": ["error", { ignore: ["cmdk-input-wrapper"] }],
    },
    settings: { react: { version: "detect" } },
  },
  {
    files: ["artifacts/api-server/**/*.ts", "lib/**/*.ts", "scripts/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: [
      "**/*.config.js",
      "**/*.config.mjs",
      "**/*.config.cjs",
      "**/build.mjs",
      "artifacts/mobile/scripts/**/*.js",
      "artifacts/mobile/server/**/*.js",
      "artifacts/mobile/babel.config.js",
      "artifacts/mobile/metro.config.js",
      "*.mjs",
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["**/*audio-playback-worklet.js"],
    languageOptions: {
      globals: { ...globals.worker, AudioWorkletProcessor: "readonly", registerProcessor: "readonly" },
    },
  },
  {
    files: ["**/public/sw.js"],
    languageOptions: {
      globals: { ...globals.serviceworker },
    },
  },
  prettierConfig,
);
