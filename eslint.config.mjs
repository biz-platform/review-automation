import { defineConfig, globalIgnores } from "eslint/config";
import nextTs from "eslint-config-next/typescript";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  /**
   * react-hooks 7 “effect 안 setState / render 중 ref” 룰은 기존 코드베이스에 광범위.
   * 하네스 CI 우선: 규칙은 켜 두되 에러로 깨지는 항목은 단계적으로 끈다(리팩터 시 재검토).
   */
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
  {
    files: ["scripts/**/*.{ts,mjs,cjs}", "ecosystem.config.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    ".lintstagedrc.mjs",
    ".husky/**",
    ".cursor/**",
    "scripts/output/**",
    "tmp/**",
    "public/landing/**",
  ]),
]);
