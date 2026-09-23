import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: [
      "src/app/router.tsx",
      "src/main.tsx",
      "src/components/feedback/confirm-dialog.tsx",
      "src/components/ui/button.tsx",
      "src/features/auth/auth-provider.tsx",
    ],
    rules: {
      // These modules intentionally colocate route definitions or shared hooks with components.
      "react-refresh/only-export-components": "off",
    },
  },
]);
