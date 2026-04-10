/**
 * PM2에 등록된 split 워커만 restart | stop | delete | logs.
 * orders-worker 를 아직 start 안 했으면 건너뛰고 나머지만 처리(실패하지 않음).
 *
 * restart: `pm2 restart 이름` 만 쓰면 ecosystem.config.cjs 변경(env)이 반영되지 않음(PM2가 예전에 저장한 설정 유지).
 *        → `pm2 restart ecosystem.config.cjs --only <이름> --update-env` 로 ecosystem 기준으로 다시 적용.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPLIT_APPS = ["review-worker", "orders-worker"];
const ECOSYSTEM_FILE = "ecosystem.config.cjs";

const action = process.argv[2];
const valid = new Set(["restart", "stop", "delete", "logs"]);

if (!action || !valid.has(action)) {
  console.error(
    "Usage: node scripts/pm2-split-action.mjs <restart|stop|delete|logs> [lines]",
  );
  process.exit(1);
}

function pm2jlist() {
  const out = execSync("pnpm exec pm2 jlist", {
    encoding: "utf8",
    cwd: root,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(out);
}

const running = new Set(pm2jlist().map((p) => p.name));
let ran = false;

for (const name of SPLIT_APPS) {
  if (!running.has(name)) {
    console.warn(`[pm2-split] skip ${name} (not in pm2 list)`);
    continue;
  }
  ran = true;
  if (action === "logs") {
    const lines = process.argv[3] ?? "200";
    console.log(`[pm2-split] pm2 logs ${name} --lines ${lines} --nostream`);
    execSync(`pnpm exec pm2 logs ${name} --lines ${lines} --nostream`, {
      stdio: "inherit",
      cwd: root,
      shell: true,
    });
  } else if (action === "restart") {
    console.log(
      `[pm2-split] pm2 restart ${ECOSYSTEM_FILE} --only ${name} --update-env`,
    );
    execSync(
      `pnpm exec pm2 restart ${ECOSYSTEM_FILE} --only ${name} --update-env`,
      {
        stdio: "inherit",
        cwd: root,
        shell: true,
      },
    );
  } else {
    console.log(`[pm2-split] pm2 ${action} ${name}`);
    execSync(`pnpm exec pm2 ${action} ${name}`, {
      stdio: "inherit",
      cwd: root,
      shell: true,
    });
  }
}

if (!ran) {
  console.warn(
    "[pm2-split] no split apps in pm2; run worker:pm2:start:split or worker:pm2:start / worker:pm2:start:orders",
  );
}
