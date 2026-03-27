import type { CookieItem } from "@/lib/types/dto/platform-dto";

/**
 * 과거 워커가 Node `fetch`로 `v4/store/shops/search`를 호출하던 모듈.
 * 이후 브라우저 컨텍스트의 `fetchAllShopsFromSearchPaginated`로 통합되어 삭제됐고,
 * 다매장 번호는 `loginBaeminAndGetCookies`의 `allShopNos` / `allShops`만 사용한다.
 *
 * 일부 로컬 `scripts/worker.ts`에 남아 있던 동적 import가
 * `ERR_MODULE_NOT_FOUND`를 내는 경우를 막기 위한 호환 스텁.
 *
 * @deprecated 호출하지 말 것. 새 코드는 `loginBaeminAndGetCookies` 결과만 사용.
 */
export async function listAllBaeminShopNosForOwner(
  _cookies: CookieItem[],
  _shopOwnerNo: string,
): Promise<string[]> {
  console.warn(
    "[baemin-shops-list-service] listAllBaeminShopNosForOwner는 사용되지 않습니다. loginBaeminAndGetCookies의 allShopNos를 사용하세요.",
  );
  return [];
}
