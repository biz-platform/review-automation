/**
 * 땡겨요 리뷰 답글 등록/수정/삭제 — API 직접 호출.
 * requestRegisterReview | requestUpdateReview | requestDeleteReview
 */
import * as DdangyoSession from "./ddangyo-session-service";
import { fetchAllDdangyoReviews } from "./ddangyo-review-service";

const ORIGIN = "https://boss.ddangyo.com";
const REGISTER_URL = `${ORIGIN}/o2o/shop/re/requestRegisterReview`;
const UPDATE_URL = `${ORIGIN}/o2o/shop/re/requestUpdateReview`;
const DELETE_URL = `${ORIGIN}/o2o/shop/re/requestDeleteReview`;

const REQUEST_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "Content-Type": "application/json",
  Referer: `${ORIGIN}/`,
  Origin: ORIGIN,
  submissionid: "mf_wfm_contents_wfm_tabFrame_sbm_commonSbmObject",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
};

type DmaRegParam = {
  patsto_no: string;
  rview_atcl_no: string;
  rply_no: string;
  rply_mbr_id: string;
  rply_cont: string;
  upvot_cnt: string;
  dnvot_cnt: string;
  rply_reg_dttm: string;
  del_dttm: string;
  del_yn: string;
  fst_reg_id: string;
  fst_reg_dttm: string;
  fin_chg_id: string;
  fin_chg_dttm: string;
  psnl_mbr_id: string;
};

/** 리뷰 목록에서 rview_atcl_no에 해당하는 psnl_mbr_id 조회 (필요 시) */
export async function getDdangyoPsnlMbrIdFromList(
  storeId: string,
  userId: string,
  rviewAtclNo: string,
  options?: { patstoNo?: string | null },
): Promise<string | null> {
  const pid = options?.patstoNo?.trim();
  const { list } = await fetchAllDdangyoReviews(
    storeId,
    userId,
    pid ? { patstoNos: [pid] } : undefined,
  );
  const review = list.find((r) => String(r.rview_atcl_no) === String(rviewAtclNo));
  const id = review?.psnl_mbr_id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/** 리뷰 목록에서 rview_atcl_no에 해당하는 rply_no, rply_mbr_id(수정/삭제 시 fin_chg_id 후보) 조회 */
export async function getDdangyoRplyInfoFromList(
  storeId: string,
  userId: string,
  rviewAtclNo: string,
  options?: { patstoNo?: string | null },
): Promise<{ rplyNo: string; rplyMbrId: string | null } | null> {
  const pid = options?.patstoNo?.trim();
  const { list } = await fetchAllDdangyoReviews(
    storeId,
    userId,
    pid ? { patstoNos: [pid] } : undefined,
  );
  const review = list.find((r) => String(r.rview_atcl_no) === String(rviewAtclNo));
  if (!review) return null;
  const no = review?.rply_no;
  const rplyNo = no != null && no !== "" ? String(no) : null;
  const rplyMbrId = review?.rply_mbr_id != null && String(review.rply_mbr_id).trim() !== "" ? String(review.rply_mbr_id).trim() : null;
  if (!rplyNo) return null;
  return { rplyNo, rplyMbrId };
}

/** @deprecated getDdangyoRplyInfoFromList 사용 권장 */
export async function getDdangyoRplyNoFromList(
  storeId: string,
  userId: string,
  rviewAtclNo: string,
): Promise<string | null> {
  const info = await getDdangyoRplyInfoFromList(storeId, userId, rviewAtclNo);
  return info?.rplyNo ?? null;
}

async function withSessionAndRetry401<T>(
  storeId: string,
  userId: string,
  fn: (cookieHeader: string) => Promise<Response>,
): Promise<Response> {
  let cookieHeader = await DdangyoSession.getDdangyoCookieHeader(storeId, userId);
  if (!cookieHeader) throw new Error("저장된 땡겨요 세션이 없습니다. 먼저 연동해 주세요.");
  let res = await fn(cookieHeader);
  if (res.status === 401) {
    await DdangyoSession.refreshDdangyoSession(storeId, userId);
    cookieHeader = (await DdangyoSession.getDdangyoCookieHeader(storeId, userId)) ?? "";
    if (!cookieHeader) throw new Error("땡겨요 세션 갱신 후에도 쿠키를 가져올 수 없습니다.");
    res = await fn(cookieHeader);
  }
  return res;
}

function parseDmaError(text: string): void {
  let json: { dma_error?: { resultCode?: string; resultMsg?: string | null } };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error(`땡겨요 API 응답 파싱 실패: ${text.slice(0, 200)}`);
  }
  const code = json?.dma_error?.resultCode;
  if (code && code !== "000") {
    const msg = json.dma_error?.resultMsg ?? code;
    throw new Error(`땡겨요 API 실패: ${msg}`);
  }
}

/**
 * 땡겨요 리뷰 답글 등록 API 호출.
 * psnl_mbr_id 없으면 목록 API로 조회 후 시도.
 */
export async function registerDdangyoReplyViaApi(
  storeId: string,
  userId: string,
  params: {
    rviewAtclNo: string;
    content: string;
    psnlMbrId?: string | null;
    patstoNo?: string | null;
  },
): Promise<void> {
  const fromSession = await DdangyoSession.getDdangyoPatstoNo(storeId, userId);
  const patstoNo =
    params.patstoNo != null && String(params.patstoNo).trim() !== ""
      ? String(params.patstoNo).trim()
      : fromSession?.trim() ?? null;
  if (!patstoNo) throw new Error("땡겨요 연동 정보(patsto_no)가 없습니다. 먼저 연동해 주세요.");

  let psnlMbrId = params.psnlMbrId?.trim() || null;
  if (!psnlMbrId) {
    psnlMbrId = await getDdangyoPsnlMbrIdFromList(storeId, userId, params.rviewAtclNo, {
      patstoNo,
    });
  }

  const body: { dma_regParam: DmaRegParam } = {
    dma_regParam: {
      patsto_no: patstoNo,
      rview_atcl_no: params.rviewAtclNo,
      rply_no: "",
      rply_mbr_id: "",
      rply_cont: params.content.slice(0, 2000),
      upvot_cnt: "",
      dnvot_cnt: "",
      rply_reg_dttm: "",
      del_dttm: "",
      del_yn: "",
      fst_reg_id: "",
      fst_reg_dttm: "",
      fin_chg_id: "",
      fin_chg_dttm: "",
      psnl_mbr_id: psnlMbrId ?? "",
    },
  };

  const res = await withSessionAndRetry401(storeId, userId, (cookie) =>
    fetch(REGISTER_URL, {
      method: "POST",
      headers: { ...REQUEST_HEADERS, Cookie: cookie },
      body: JSON.stringify(body),
      credentials: "include",
    }),
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`땡겨요 답글 등록 API ${res.status}: ${text.slice(0, 300)}`);
  parseDmaError(text);
}

/** 땡겨요 답글 수정 — requestUpdateReview. fin_chg_id는 로그인 유저 ID(필수). "재로그인" 오류 시 재로그인 후 1회 재시도 */
export async function modifyDdangyoReplyViaApi(
  storeId: string,
  userId: string,
  params: {
    rviewAtclNo: string;
    rplyNo: string;
    content: string;
    finChgId?: string;
    patstoNo?: string | null;
  },
): Promise<void> {
  const fromSession = await DdangyoSession.getDdangyoPatstoNo(storeId, userId);
  const patstoNo =
    params.patstoNo != null && String(params.patstoNo).trim() !== ""
      ? String(params.patstoNo).trim()
      : fromSession?.trim() ?? null;
  if (!patstoNo) throw new Error("땡겨요 연동 정보(patsto_no)가 없습니다. 먼저 연동해 주세요.");

  const finChgId = params.finChgId?.trim() || (await DdangyoSession.getDdangyoFinChgId(storeId, userId)) || null;
  if (!finChgId) {
    throw new Error(
      "땡겨요 수정/삭제에 필요한 로그인 ID가 없습니다. 땡겨요 연동을 해제한 뒤 다시 연동해 주세요.",
    );
  }

  const buildBody = () => ({
    dma_regParam: {
      patsto_no: patstoNo,
      rview_atcl_no: params.rviewAtclNo,
      rply_no: params.rplyNo,
      rply_mbr_id: "",
      rply_cont: params.content.slice(0, 2000),
      upvot_cnt: "",
      dnvot_cnt: "",
      rply_reg_dttm: "",
      del_dttm: "",
      del_yn: "",
      fst_reg_id: "",
      fst_reg_dttm: "",
      fin_chg_id: finChgId,
      fin_chg_dttm: "",
      psnl_mbr_id: "",
    },
  });

  const doRequest = (cookie: string) =>
    fetch(UPDATE_URL, {
      method: "POST",
      headers: { ...REQUEST_HEADERS, Cookie: cookie },
      body: JSON.stringify(buildBody()),
      credentials: "include",
    });

  let res = await withSessionAndRetry401(storeId, userId, doRequest);
  let text = await res.text();
  if (!res.ok) throw new Error(`땡겨요 답글 수정 API ${res.status}: ${text.slice(0, 300)}`);
  try {
    parseDmaError(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("재로그인")) {
      await DdangyoSession.refreshDdangyoSession(storeId, userId);
      const cookie = await DdangyoSession.getDdangyoCookieHeader(storeId, userId);
      if (!cookie) throw e;
      res = await doRequest(cookie);
      text = await res.text();
      if (!res.ok) throw new Error(`땡겨요 답글 수정 API ${res.status}: ${text.slice(0, 300)}`);
      parseDmaError(text);
    } else {
      throw e;
    }
  }
}

/** 땡겨요 답글 삭제 — requestDeleteReview. fin_chg_id는 로그인 유저 ID(필수). "재로그인" 오류 시 재로그인 후 1회 재시도 */
export async function deleteDdangyoReplyViaApi(
  storeId: string,
  userId: string,
  params: {
    rviewAtclNo: string;
    rplyNo: string;
    finChgId?: string;
    patstoNo?: string | null;
  },
): Promise<void> {
  const fromSession = await DdangyoSession.getDdangyoPatstoNo(storeId, userId);
  const patstoNo =
    params.patstoNo != null && String(params.patstoNo).trim() !== ""
      ? String(params.patstoNo).trim()
      : fromSession?.trim() ?? null;
  if (!patstoNo) throw new Error("땡겨요 연동 정보(patsto_no)가 없습니다. 먼저 연동해 주세요.");

  const finChgId = params.finChgId?.trim() || (await DdangyoSession.getDdangyoFinChgId(storeId, userId)) || null;
  if (!finChgId) {
    throw new Error(
      "땡겨요 수정/삭제에 필요한 로그인 ID가 없습니다. 땡겨요 연동을 해제한 뒤 다시 연동해 주세요.",
    );
  }

  const buildBody = () => ({
    dma_delParam: {
      patsto_no: patstoNo,
      rview_atcl_no: params.rviewAtclNo,
      rply_no: params.rplyNo,
      fin_chg_id: finChgId,
    },
  });

  const doRequest = (cookie: string) =>
    fetch(DELETE_URL, {
      method: "POST",
      headers: { ...REQUEST_HEADERS, Cookie: cookie },
      body: JSON.stringify(buildBody()),
      credentials: "include",
    });

  let res = await withSessionAndRetry401(storeId, userId, doRequest);
  let text = await res.text();
  if (!res.ok) throw new Error(`땡겨요 답글 삭제 API ${res.status}: ${text.slice(0, 300)}`);
  try {
    parseDmaError(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("재로그인")) {
      await DdangyoSession.refreshDdangyoSession(storeId, userId);
      const cookie = await DdangyoSession.getDdangyoCookieHeader(storeId, userId);
      if (!cookie) throw e;
      res = await doRequest(cookie);
      text = await res.text();
      if (!res.ok) throw new Error(`땡겨요 답글 삭제 API ${res.status}: ${text.slice(0, 300)}`);
      parseDmaError(text);
    } else {
      throw e;
    }
  }
}
