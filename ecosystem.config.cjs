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
      },
    },
  ],
};
