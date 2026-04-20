# CoolSMS 알림톡 이식 가이드

이 레포에서 **알림톡(카카오 비즈메시지)** 은 CoolSMS REST API `messages/v4/send` 를 `fetch` 로 직접 호출하는 방식이다. (`package.json` 의 `coolsms-node-sdk` 는 알림톡 경로에서 **사용하지 않음**.)

> 참고: `/api/alimtalk` 는 **알리고(Aligo)** URL을 쓰는 별도 구현이므로 CoolSMS 이식 문서와는 분리해서 보면 된다.

---

## 1. 콘솔·사전 준비 (다른 서비스로 옮길 때)

1. [Solapi/CoolSMS](https://console.solapi.com) 에서 API Key / Secret 발급.
2. **발신번호** 등록 및 인증 (알림톡 발신에 쓰는 번호).
3. 카카오 비즈니스 채널 연동 후 **발신 프로필(pfId)** 확보.
4. 카카오톡 채널 관리자센터에서 **알림톡 템플릿** 등록·심사 후, CoolSMS 쪽에 연동된 **템플릿 ID**(`KA01TP...`)를 코드의 `TEMPLATES[].templateId` 와 맞출 것.
5. 템플릿에 선언한 **변수명·본문**과 코드의 `generateMessage` / `variables` 키가 심사된 템플릿과 **글자 단위로 일치**해야 발송·대체 실패가 줄어든다.

---

## 2. 환경 변수

| 변수                    | 용도                                                  |
| ----------------------- | ----------------------------------------------------- |
| `COOLSMS_API_KEY`       | API Key                                               |
| `COOLSMS_API_SECRET`    | API Secret (HMAC 서명에 사용)                         |
| `COOLSMS_SENDER_NUMBER` | 알림톡 `from` 발신번호                                |
| `COOLSMS_PFID`          | 카카오 비즈메시지 **프로필 ID** (`kakaoOptions.pfId`) |

**알림톡만** 이식하면 위 4개면 된다.

추가로 이 레포에는 **일반 SMS** 경로가 있다 (`src/app/api/sms/route.ts` 등). SMS는 같은 Key/Secret과 `COOLSMS_SENDER_NUMBER` 를 쓰고, 인증용 별도 발신자로 `COOLSMS_SENDER` 를 참조하는 코드가 `sendVerificationSMS.ts` 의 SMS 분기에 있다(알림톡과 env 이름이 다름에 유의).

---

## 3. 복사하면 되는 파일

| 경로                                             | 역할                                                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `src/utils/notifications/sendCoolSMSAlimTalk.ts` | **핵심** – HMAC 인증, 요청 바디, 템플릿 맵, `sendCoolSMSAlimTalk`                                     |
| `src/app/api/coolsms/route.ts`                   | (선택) HTTP로 알림톡 호출용 라우트 – **현재 구현은 인자 순서가 잘못됨** → 아래 §7 참고해 수정 후 사용 |

선택 참고:

- `src/utils/sms/sendVerificationSMS.ts` – `method: "alimtalk"` 일 때 `sendCoolSMSAlimTalk` 호출 예시.
- `src/app/api/sms/route.ts` – CoolSMS **SMS** (`type: "SMS"`) + 올바른 HMAC 예시.

---

## 4. API 스펙 요약 (현재 구현 기준)

- **URL:** `POST https://api.coolsms.co.kr/messages/v4/send`
- **Header**
  - `Authorization`: `HMAC-SHA256 apiKey={apiKey}, date={ISO8601}, salt={random}, signature={hex}`
  - `signature` = `HMAC-SHA256(apiSecret, date + salt)` → `digest("hex")`
- **Body**

```json
{
  "message": {
    "to": "01012345678",
    "from": "{COOLSMS_SENDER_NUMBER}",
    "text": "카카오에 등록한 템플릿과 동일한 내용으로 생성한 문자열",
    "kakaoOptions": {
      "pfId": "{COOLSMS_PFID}",
      "templateId": "KA01TP...",
      "buttons": []
    }
  }
}
```

- **성공 판별:** HTTP 200 이어도 본문 `statusCode === "2000"` 인지 확인 (구현상 그렇게 처리함).

---

## 5. `sendCoolSMSAlimTalk` 사용법

**파일:** `src/utils/notifications/sendCoolSMSAlimTalk.ts`

### 시그니처

```ts
sendCoolSMSAlimTalk(
  phoneNumber: string,
  variables: Record<string, string>,
  buttons?: Button[],
  template: TemplateType = "signup"
): Promise<unknown>
```

### 수신번호

함수 내부에서 `normalizeToDomesticNumber` 로 정규화한다.

- `821012345678` 형태 → `01012345678`
- 이미 `010` + 10자리 숫자 → 그대로
- 하이픈 포함 문자열 → 비숫자 제거 후 위 규칙 적용 (`010-1234-5678` 도 동작)

그래서 **E.164만 넘겨도 되고**, 기존처럼 `formatE164ToKorean` 으로 `010-xxxx-xxxx` 를 넘겨도 된다.

### `Button`

```ts
interface Button {
  buttonType: string; // 예: "AC"(채널 추가), "WL"(웹링크)
  buttonName: string;
  linkMo?: string;
  linkPc?: string;
}
```

### `TemplateType` 와 변수 (레포 기본값 – 이식 시 전부 교체)

| `template`            | 용도          | `variables` 키 (예)                                            |
| --------------------- | ------------- | -------------------------------------------------------------- |
| `signup`              | 회원가입 완료 | `고객명`, `회사명`                                             |
| `payment`             | 결제 완료     | `회사명`, `상품명`, `시간`, `결제금액`                         |
| `completion`          | 작업 완료     | `회사명`, `상품명`, `링크`                                     |
| `seller notification` | 셀러용        | `회사명`, `주문자명`, `상품명`, `결제금액`, `주문자ID`, `수당` |
| `verification`        | 인증 안내     | `인증번호` (메시지에 하드코된 브랜드명 있음 – 이식 시 수정)    |

`TEMPLATES[*].templateId` 는 **반드시** 새 서비스의 카카오 심사 템플릿 ID로 바꿀 것. (현재 레포에서 `signup` 과 `verification` 이 같은 `templateId` 로 잡혀 있으면, 실제 콘솔 템플릿이 다르면 **둘 중 하나는 틀린 설정**이다.)

---

## 6. 이 레포에서 호출하는 위치 (참고)

| 위치                                            | 템플릿 타입                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/app/(pages)/(auth)/action.ts`              | `signup` (+ 버튼)                                                                               |
| `src/app/api/payments/korpay/complete/route.ts` | `payment` (고객·관리자)                                                                         |
| `src/app/api/rtpay/webhook/route.ts`            | `payment` (고객·관리자 다건)                                                                    |
| `src/utils/api/sendExternalApiRequest.ts`       | `completion`                                                                                    |
| `src/utils/sms/sendVerificationSMS.ts`          | `templateId` 옵션으로 전달 (기본값 `signup` – 인증 전용이면 `verification` 으로 바꾸는 게 맞음) |

공통 패턴: `try/catch` 로 감싸고 **알림톡 실패해도 본 플로우(결제/가입 등)는 중단하지 않음**.

---

## 7. `src/app/api/coolsms/route.ts` 버그 및 수정안

요청 바디를 `templateId` 로 받아 `sendCoolSMSAlimTalk(phoneNumber, templateId, variables)` 처럼 넘기고 있는데, 실제 2번째 인자는 **`variables` 객체**여야 한다.

**권장 요청 JSON:**

```json
{
  "phoneNumber": "01012345678",
  "variables": { "회사명": "...", "상품명": "..." },
  "buttons": [],
  "template": "payment"
}
```

**라우트 예시 (시그니처 정렬):**

```ts
import { NextResponse } from "next/server";
import {
  sendCoolSMSAlimTalk,
  type TemplateType,
} from "@/utils/notifications/sendCoolSMSAlimTalk";

export async function POST(request: Request) {
  try {
    const { phoneNumber, variables, buttons, template } = await request.json();

    if (!phoneNumber || !variables || typeof variables !== "object") {
      return NextResponse.json(
        { success: false, error: "phoneNumber, variables 필수" },
        { status: 400 },
      );
    }

    const result = await sendCoolSMSAlimTalk(
      phoneNumber,
      variables,
      Array.isArray(buttons) ? buttons : undefined,
      (template as TemplateType) ?? "signup",
    );

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("알림톡 발송 중 오류 발생:", error);
    return NextResponse.json(
      { success: false, error: "알림톡 발송에 실패했습니다." },
      { status: 500 },
    );
  }
}
```

---

## 8. 이식 체크리스트

1. [ ] `sendCoolSMSAlimTalk.ts` 복사 후 `TEMPLATES` 의 `templateId` / `generateMessage` 를 **심사된 템플릿**에 맞게 수정.
2. [ ] `.env` 에 `COOLSMS_*` 4종 설정 (배포 환경에도 동일).
3. [ ] Node 18+ (`fetch` 내장) 또는 폴리필.
4. [ ] 템플릿 변수·본문 불일치 시 CoolSMS/카카오 쪽 에러 코드 로그로 원인 확인.
5. [ ] 외부에 노출하는 발송 API를 쓸 경우 **인증·레이트리밋** 필수 (이 레포의 `coolsms` 라우트는 그대로 두면 위험).

---

## 9. 출처

- CoolSMS/Solapi 메시지 API: 공식 문서의 **Messages v4 / Send** 스펙과 동일한 패턴.
- 구현 코드: `src/utils/notifications/sendCoolSMSAlimTalk.ts`
