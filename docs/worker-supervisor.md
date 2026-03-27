# Worker Supervisor

## PM2 (Windows/Linux 공통)

```bash
pnpm worker:pm2:start
pnpm worker:pm2:logs
pnpm worker:pm2:save
```

재시작/중지/삭제:

```bash
pnpm worker:pm2:restart
pnpm worker:pm2:stop
pnpm worker:pm2:delete
```

## systemd (Linux only)

PM2를 systemd에 연결해서 부팅 시 자동 실행:

```bash
pm2 startup systemd -u <linux-user> --hp /home/<linux-user>
pm2 save
```

위 `pm2 startup ...` 실행 후 출력되는 `sudo ...` 명령을 1회 실행해야 systemd 유닛이 등록된다.
