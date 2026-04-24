/**
 * lib 레이어가 App Router(`@/app/*`)에 역의존하지 않도록 한다.
 * @see AGENTS.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const GUARDS = [
  { dir: path.join(root, "src", "lib", "services"), label: "src/lib/services" },
  { dir: path.join(root, "src", "lib", "dashboard"), label: "src/lib/dashboard" },
];

const importRe =
  /from\s+["'](@\/app\/[^"']+)["']|import\s*\(\s*["'](@\/app\/[^"']+)["']\s*\)/g;

function walkTsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      walkTsFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(name.name) && !name.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

const violations = [];
for (const { dir, label } of GUARDS) {
  for (const file of walkTsFiles(dir)) {
    const text = fs.readFileSync(file, "utf8");
    importRe.lastIndex = 0;
    let m;
    while ((m = importRe.exec(text)) !== null) {
      violations.push({
        label,
        file: path.relative(root, file),
        spec: m[1] ?? m[2],
      });
    }
  }
}

if (violations.length) {
  console.error(
    "[check-import-boundaries] `@/app/` import is forbidden under guarded lib dirs:\n",
  );
  for (const v of violations) {
    console.error(`  [${v.label}] ${v.file}  →  ${v.spec}`);
  }
  process.exit(1);
}

console.log(
  "[check-import-boundaries] OK (no @/app imports under src/lib/services, src/lib/dashboard)",
);
