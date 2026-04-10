/**
 * PM2: review-worker = WORKER_JOB_FAMILY=reviews, orders-worker = orders (마이그레이션 066 후).
 * 단일 프로세스(리뷰+주문 동일 큐)로 돌리려면 review-worker 의 env 에서 WORKER_JOB_FAMILY·전용 ID/락 제거하고 orders-worker 는 기동하지 않음.
 * 분리 운영:
 *   1) `pnpm run worker:pm2:start:split` (둘 다 기동)
 *   주문 워커만: worker:pm2:start:orders (restart|stop|delete|logs 도 :orders 접미사)
 *      재시작·중지·삭제·로그(split): PM2 에 없는 앱은 건너뜀(예: orders-worker 미기동 시 restart:split 은 review-worker 만).
 *      ecosystem env 반영: `pm2 restart 이름` 만 하면 파일 변경이 안 먹음 → restart:split / worker:pm2:restart* 는 ecosystem 경로 + `--update-env` 사용.
 *      worker:pm2:restart:split | stop:split | delete:split | logs:split — 실시간 tail 은 pm2 logs <name>
 *      (review-worker 가 reviews 로 제한되지 않으면 주문 job 을 리뷰 워커가 같이 잡아 분리 효과가 줄어듦)
 * Supabase 마이그레이션 066 적용 후 jobFamily 선점이 동작한다.
 */
module.exports = {
  apps: [
    {
      name: "review-worker",
      cwd: ".",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "--no-cache scripts/worker.ts",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 50,
      exp_backoff_restart_delay: 3000,
      kill_timeout: 15000,
      env: {
        NODE_ENV: "production",
        WORKER_JOB_FAMILY: "reviews",
        WORKER_ID: "pm2-reviews",
        WORKER_LOCK_FILE: ".worker-reviews-pm2.lock",
      },
    },
    {
      name: "orders-worker",
      cwd: ".",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "--no-cache scripts/worker.ts",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 50,
      exp_backoff_restart_delay: 3000,
      kill_timeout: 15000,
      env: {
        NODE_ENV: "production",
        WORKER_JOB_FAMILY: "orders",
        WORKER_ID: "pm2-orders",
        WORKER_LOCK_FILE: ".worker-orders-pm2.lock",
      },
    },
  ],
};
