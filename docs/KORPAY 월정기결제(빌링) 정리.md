# KORPAY 월정기결제(빌링) 연동 정리

이 문서는 **KORPAY 월정기결제(빌링) API만**을 기준으로, 카드 등록(빌키 발급)부터 정기 과금, 취소/환불, 결제수단 해제, (선택) PG 스케줄 등록까지 **연동에 필요한 요구사항·제약·구현 체크리스트**를 한 곳에 정리한다.

---

## 0) 전제 / 용어

- **빌키(`bid`)**: 카드(결제수단)를 대표하는 키. 이후 과금은 `bid`로 수행.
- **거래ID(`tid`)**: 과금(approve) 단위 식별자. **취소(canel)에 필수**.
- **주문번호(`ordNo`)**: 모든 요청의 트래킹 키. 문서상 **반드시 30자리, 중복 불가**.
- **승인요청시간(`ediDate`)**: `yyyyMMddHHmmss` (KST를 쓰든 UTC를 쓰든 “형식”은 고정).
- **해시키(`hashStr`)**: `sha256(mid + ediDate + goodsAmt + mkey)` 결과를 **영문 소문자**로 전송(일반적으로 hex lower).

---

## 1) 공통 제약(문서 명시)

- **요청 메서드**: `POST`, `DELETE` (문서에 `DELTE` 오타)
- **할부**: **일시불만 허용** → `quotaMon = "00"` 고정
- **부분취소**: **미지원** → 취소는 원칙적으로 전액만
- **`ordNo`**: **반드시 30자리**, **중복 불가**

> `ordNo`는 “예시 응답”에서 규칙을 지키지 않는 케이스가 있으니, 예시보다 **제약 문구를 우선**한다.

---

## 2) API 목록(월정기결제/빌링)

문서상 빌링 API는 다음 6종으로 구성된다.

- **빌키 발급(카드 등록)**: `POST /api/bill/new`
- **빌키 결제(과금)**: `POST /api/bill/approve`
- **빌링 결제 취소(전액)**: `POST /api/bill/cancel`
- **빌키 해제(결제수단 삭제)**: `DELETE /api/bill`
- **스케줄 등록(자동과금 위임)**: `POST /api/bill/schedule`
- **스케줄 삭제/조회**: `DELETE /api/bill/schedule`, `POST /api/bill/schedule/list`

테스트 서버(문서 기준):
- `https://staging-pgapi.korpay.com/api/bill/*`

> 문서에 `.../newPOST`, `.../schedulePOST`처럼 붙어있는 표기는 포맷 오류로 보이며, 아래 curl 예시가 가리키는 형태처럼 **`.../api/bill/new` + HTTP 메서드가 정답**으로 보는 게 합리적.

---

## 3) 엔드포인트 상세(요청/응답 필드)

### 3.1 빌키 발급 `POST /api/bill/new`

**목적**: 카드 정보를 이용해 **빌키(`bid`)**를 발급받는다.

**요청(핵심 필드)**
- `mid`: 상점 ID
- `mkey`: MID 암호화키
- `goodsAmt`: 금액(문서상 12byte 문자열)
- `goodsNm`: 상품명
- `cardNo`: 카드번호
- `cardPw`: 카드 비밀번호 앞 2자리
- `expireYymm`: 유효기간(yyMM)
- `ordAuthNo`: 개인카드면 생년월일(yyMMdd), 법인카드면 사업자번호(10자리)
- `ediDate`: 승인요청시간(yyyyMMddHHmmss)
- `hashStr`: `sha256(mid + ediDate + goodsAmt + mkey)` 소문자
- `payMethod`: `"CARD"` 고정
- (옵션) `ordNm`, `ordTel`, `ordEmail`, `mbsUsrId`, `mbsReserved`

**응답(핵심 필드)**
- `resultCd`: `"0000"` 또는 `"3001"`이 정상으로 서술됨(성공코드 혼재)
- `resultMsg`
- `bid`: 빌키
- `fnCd`: 카드 매입사 코드
- `appDtm`: 승인시각(yyyyMMddHHmmss)

**중요**
- 문서 스펙대로면 카드정보(`cardNo` 등)를 우리 서비스가 입력받아 전송하는 구조가 된다. (호스티드/토큰화 옵션은 문서에 없음)

---

### 3.2 빌키 결제(과금) `POST /api/bill/approve`

**목적**: 발급받은 `bid`로 즉시 과금(승인)을 수행한다.

**요청(핵심 필드)**
- `ordNo`: 30자리 Unique
- `bid`
- `mid`, `mkey`
- `goodsAmt`, `goodsNm`
- `quotaMon`: `"00"` 고정
- `ediDate`: 승인요청시간(예시에 존재, 스펙 라인에 주석 표기지만 포함 권장)
- `hashStr`: `sha256(mid + ediDate + goodsAmt + mkey)` 소문자
- `payMethod`: `"CARD"` 고정
- (옵션) `ordNm`, `ordTel`, `ordEmail`, `mbsUsrId`, `mbsReserved`

**응답(핵심 필드)**
- `resultCd`: `"0000"` 또는 `"3001"` 정상으로 서술됨
- `resultMsg`
- `tid`: 거래고유번호(**취소 시 필요**)
- `appNo`: 승인번호
- `appDtm`: 승인시각
- `amt`: 금액
- `ordNo`
- `cancelYN`: `"N"` 고정(승인 응답 기준)

**문서 함정**
- 요청 예시에 `msbUsrId`(오타)가 보임. 스펙은 `mbsUsrId`. 수신/정규화 시 오타 케이스를 허용하는 편이 안전.

---

### 3.3 빌링 결제 취소 `POST /api/bill/cancel`

**목적**: 승인된 결제를 취소한다. (문서상 **부분취소 불가**)

**요청(핵심 필드)**
- `tid`
- `bid`
- `ordNo`
- `canAmt`: 취소금액(부분취소 불가이므로 전액만)
- `canNm`: 취소자 이름
- `canMsg`: 취소 사유
- `mid`, `mkey`

**응답(핵심 필드)**
- `res_code`: `"0000"` 정상
- `res_msg`
- `cancel_date`: `yyyyMMdd`
- `cancel_time`: `hhmmss`

---

### 3.4 빌키 해제 `DELETE /api/bill`

**목적**: 발급된 `bid`를 해지하여 더 이상 과금되지 않게 한다. (결제수단 삭제)

**요청(핵심 필드)**
- `bid`
- `mid`, `mkey`
- `goodsAmt`
- `ediDate`
- `hashStr`: `sha256(mid + ediDate + goodsAmt + mkey)` 소문자

**응답(핵심 필드)**
- `resultCd`: `"0000"` 정상
- `resultMsg`

---

### 3.5 스케줄 등록 `POST /api/bill/schedule` (선택)

**목적**: “정기 과금 트리거”를 PG에 위임하는 스케줄을 생성한다.

**요청(핵심 필드)**
- `mid`, `mkey`
- `bid`
- `reqNo`: 30자리 Unique (요청번호)
- `amt`: 금액
- `goodsNm`: 상품명
- `frDt`: 시작일자 `yyyy-MM-dd` (익일부터 가능)
- `toDt`: 종료일자 `yyyy-MM-dd` (default: `9999-12-31`)
- `intervalType`: `weekly | monthly`
- `day`: `intervalType=monthly`일 때 1~28
- `weekDay`: `intervalType=weekly`일 때 0(월) ~ 6(일)

**응답(핵심 필드)**
- `resultCd`: `"0000"` 성공
- `resultMsg`
- `scheduleId`

---

### 3.6 스케줄 삭제/조회 (선택)

**삭제 `DELETE /api/bill/schedule`**
- 요청: `mid`, `mkey`, `bid`, `scheduleId`
- 응답: `resultCd`, `resultMsg`

**조회 `POST /api/bill/schedule/list`**
- 요청: `id`(상점 ID로 서술), `key`(암호화키로 서술), (옵션) `bid`, `scheduleId`
- 응답: `data[]` (스케줄 객체 배열)

**중요**
- 문서에 “삭제된 `bid`의 스케줄은 조회할 수 없다”고 명시됨 → 결제수단 해제(`DELETE /api/bill`)는 스케줄 운영에도 영향.

---

## 4) 성공코드/에러 판정(문서 기반 권장)

문서 내에서 정상 승인 코드가 `"0000"` 또는 `"3001"`로 혼재되어 언급된다.

- 구현 권장:
  - **성공코드 허용 리스트**: `["0000", "3001"]`
  - 모든 요청/응답을 DB에 감사 가능하게 기록(민감정보 제외)하고, 실제 테스트 결과로 최종 확정한다.

---

## 5) `ordNo` / `reqNo` 30자리 생성 규칙(권장안)

문서 요구는 “정확히 30자리 + 중복 불가”뿐이라, 서비스에서 **결정해야 하는 것**이 많다.

권장:
- 문자셋: **숫자만**(운영/CS/로그 가독성 유리)
- 구성: `YYYYMMDDHHmmss(14)` + `랜덤 16자리` = 30
- 랜덤: CSPRNG 기반(충돌 방지)
- 중복 방지: DB 유니크 키(예: `invoice_code` 또는 `billing_period_key` 등)와 함께 사용

> 단, KORPAY가 “숫자만”을 강제하는지 문서로 확정되지 않았으니, 운영 계약/기술담당 통해 문자 허용 범위를 확인하는 게 제일 안전하다.

---

## 6) 반드시 저장해야 하는 데이터(운영 필수)

월정기결제 운영에서 “없으면 나중에 취소/정산/장애 대응이 불가능한 값”은 아래다.

- 결제수단(카드) 단위
  - `bid` (필수)
  - (표시용) `payment_card_bin4`, `payment_card_last4` 정도만 보관(이미 이 레포에 존재)
- 과금(승인) 단위
  - `tid` (취소에 필수)
  - `ordNo` (트래킹/중복방지에 유리)
  - `amount`, `paidAt`, `resultCd/resultMsg`
- (PG 스케줄 사용 시)
  - `scheduleId`, `reqNo`, `intervalType`, `day/weekDay`, `frDt/toDt`, 활성/비활성 상태

---

## 7) 구현 체크리스트(“월정기결제만” 붙일 때 해야 하는 것)

### 7.1 환경변수/설정
- KORPAY base URL (staging/prod)
- `mid`, `mkey`
- 크론 실행 인증(서버만 호출 가능하도록)

### 7.2 서버 모듈
- KORPAY 요청 공통:
  - `ediDate` 생성기
  - `hashStr` 생성기(sha256 lower)
  - `ordNo`/`reqNo` 생성기(30자리)
  - 성공코드 판정 함수(허용 리스트)
- 엔드포인트 래핑:
  - `bill/new`(빌키 발급)
  - `bill/approve`(과금)
  - `bill/cancel`(취소)
  - `DELETE bill`(빌키 해제)
  - `schedule*`(선택)

### 7.3 DB 스키마
- `bid` 저장 위치 결정(유저당 1개 vs 다중)
- 승인 이력(청구/인보이스)에 `tid`/`ordNo`/성공코드/실패코드 저장
- **중복 청구 방지**를 위한 유니크 키 설계(예: “user + 청구월”)

### 7.4 정기 과금 실행(두 가지 방식 중 택1)

#### (A) 우리 서버 크론이 매달 `approve` 호출
- 장점: 서비스가 “정기과금 로직/재시도/정산”을 완전히 통제
- 필수: idempotency(중복 청구 방지), 재시도 정책, 실패 시 이용제한/알림 정책

#### (B) KORPAY 스케줄 기능을 사용
- 장점: 과금 트리거링 단순
- 필수: 스케줄 상태 동기화(조회/list), 실패 대응(어떻게 실패를 감지/재시도할지)

---

## 8) 카드정보 취급(문서 기준 리스크/권장)

문서 스펙(`bill/new`)은 `cardNo`, `cardPw`, `expireYymm`, `ordAuthNo`를 요청에 포함한다.

- 문서대로 구현 시:
  - 서비스(프론트/서버)가 카드정보를 **입력/전송 경로에서 취급**하게 된다.
- 권장:
  - KORPAY가 **호스티드 등록/토큰화**(카드정보를 우리 서버로 안 가져오게) 옵션을 제공하는지 먼저 확인.
  - 불가 시에도 최소한:
    - 카드정보는 DB에 저장하지 않기
    - request/response 로깅에서 카드정보 마스킹/제거
    - 에러 리포팅/추적 시스템으로 유출되지 않게 차단

---

## 9) 문서 기반 “그대로 따르면 터질 수 있는” 함정 모음

- **전송 방식 오타**: `DELTE` → `DELETE`
- **URL 표기 포맷 오류**: `.../newPOST`, `.../schedulePOST` → 실제는 endpoint + HTTP 메서드
- **필드명 오타**: `msbUsrId` vs `mbsUsrId`
- **성공코드 혼재**: `"0000"` vs `"3001"` → 실제 테스트로 확정 필요
- **예시 응답의 `ordNo`가 30자리 제약을 위반** → 예시보다 제약 문구 우선

