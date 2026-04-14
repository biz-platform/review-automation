/**
 * 플랫폼 주문 초기 동기화 구간(일수)·공개 URL·env 변수 **이름**.
 * 비밀값은 아니지만 키 문자열을 상수로 두어 오타·문서화 일원화.
 */

/** 워커·스크립트 공통 기본: KST 오늘 포함 최근 N일 */
export const DEFAULT_PLATFORM_ORDERS_INITIAL_DAYS_BACK = 60;

/**
 * `store_platform_orders` cron 퍼지 기본값(일). 동기화·glance 최대 구간(~60일)보다 넉넉히 두고 오래된 원장만 제거.
 * `STORE_PLATFORM_ORDERS_RETENTION_DAYS` env로 30~366 범위 덮어쓰기 가능.
 */
export const STORE_PLATFORM_ORDERS_RETENTION_DAYS_DEFAULT = 90;

/** 한 번에 조회·집계하는 구간 상한 (윤년 달력·부하 제한) */
export const MAX_PLATFORM_ORDERS_INCLUSIVE_DAYS = 366;

export const ENV_BAEMIN_ORDERS_INITIAL_DAYS_BACK =
  "BAEMIN_ORDERS_INITIAL_DAYS_BACK" as const;
export const ENV_YOGIYO_ORDERS_INITIAL_DAYS_BACK =
  "YOGIYO_ORDERS_INITIAL_DAYS_BACK" as const;
export const ENV_DDANGYO_ORDERS_INITIAL_DAYS_BACK =
  "DDANGYO_ORDERS_INITIAL_DAYS_BACK" as const;
export const ENV_COUPANG_EATS_ORDERS_INITIAL_DAYS_BACK =
  "COUPANG_EATS_ORDERS_INITIAL_DAYS_BACK" as const;

/** 로컬 dev 스크립트 전용 (`*_INITIAL_*` 없을 때 동일 의미로 사용 가능) */
export const ENV_DDANGYO_ORDERS_DAYS_BACK = "DDANGYO_ORDERS_DAYS_BACK" as const;
export const ENV_YOGIYO_ORDERS_DAYS_BACK = "YOGIYO_ORDERS_DAYS_BACK" as const;

/** 로컬 dev 스크립트 `--persist` 대체: `1`이면 수집 후 DB 반영 */
export const ENV_DDANGYO_ORDERS_PERSIST = "DDANGYO_ORDERS_PERSIST" as const;
export const ENV_YOGIYO_ORDERS_PERSIST = "YOGIYO_ORDERS_PERSIST" as const;

/** 워커 `baemin_link` 연동 직후 v4/orders 스모크 */
export const ENV_BAEMIN_V4_ORDERS_SMOKE_AFTER_LINK =
  "BAEMIN_V4_ORDERS_SMOKE_AFTER_LINK" as const;

/** 배민 셀프웹 주문내역 (공개 URL) */
export const BAEMIN_SELF_ORDERS_HISTORY_URL =
  "https://self.baemin.com/orders/history" as const;

function readInclusiveDaysFromEnv(raw: string | undefined): number {
  const n = Number(raw?.trim());
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_PLATFORM_ORDERS_INITIAL_DAYS_BACK;
  }
  return Math.min(Math.floor(n), MAX_PLATFORM_ORDERS_INCLUSIVE_DAYS);
}

export function getBaeminOrdersInitialDaysBack(): number {
  return readInclusiveDaysFromEnv(process.env[ENV_BAEMIN_ORDERS_INITIAL_DAYS_BACK]);
}

export function getYogiyoOrdersInitialDaysBack(): number {
  return readInclusiveDaysFromEnv(process.env[ENV_YOGIYO_ORDERS_INITIAL_DAYS_BACK]);
}

export function getDdangyoOrdersInitialDaysBack(): number {
  return readInclusiveDaysFromEnv(process.env[ENV_DDANGYO_ORDERS_INITIAL_DAYS_BACK]);
}

export function getCoupangEatsOrdersInitialDaysBack(): number {
  return readInclusiveDaysFromEnv(process.env[ENV_COUPANG_EATS_ORDERS_INITIAL_DAYS_BACK]);
}

export function getDdangyoDevOrdersDaysBack(): number {
  const raw =
    process.env[ENV_DDANGYO_ORDERS_DAYS_BACK] ??
    process.env[ENV_DDANGYO_ORDERS_INITIAL_DAYS_BACK];
  return readInclusiveDaysFromEnv(raw);
}

export function getYogiyoDevOrdersDaysBack(): number {
  const raw =
    process.env[ENV_YOGIYO_ORDERS_DAYS_BACK] ??
    process.env[ENV_YOGIYO_ORDERS_INITIAL_DAYS_BACK];
  return readInclusiveDaysFromEnv(raw);
}
