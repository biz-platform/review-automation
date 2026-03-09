# Supabase Send SMS Hook 설정 체크리스트

Vercel에 `[send-sms-hook]` 로그가 전혀 안 찍히면 **Supabase가 이 훅 URL을 호출하지 않는 것**이다. 아래 순서대로 확인하자.

## 1. Supabase 대시보드

- **Authentication** → **Hooks** 이동
- **Send SMS** 훅 추가/수정:
  - **Type**: **HTTP** (Postgres 아님)
  - **HTTP URL**: `https://<배포도메인>/api/auth/hooks/send-sms`
    - 예: `https://oliview.kr/api/auth/hooks/send-sms`
    - 오타 주의: `sens-sms` (X) → `send-sms` (O)
  - **HTTP Secret**: Supabase가 표시하는 값 그대로 복사 (예: `v1,whsec_...`)

## 2. Vercel 환경변수

- **SEND_SMS_HOOK_SECRET**: Supabase Hooks에서 복사한 Secret과 **완전 동일**
- **COOLSMS_API_KEY**, **COOLSMS_API_SECRET**, **COOLSMS_SENDER**: CoolSMS 발송용

배포 후 반드시 **Redeploy** 한 번 해서 env 반영 여부 확인.

## 3. Phone Auth와 훅 관계

- [Phone Login 문서](https://supabase.com/docs/guides/auth/phone-login): 휴대폰 OTP 사용 시 **SMS 프로바이더** 설정이 필요하다고 안내함.
- **Send SMS Hook**을 쓰면 **내장 프로바이더(Twilio, MessageBird 등) 없이** 이 훅만 사용한다 ([Send SMS Hook 문서](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook)).
- 훅이 활성화되어 있으면, Auth 설정에서 별도 SMS 프로바이더를 고르지 않아도 된다 (Supabase 쪽 수정 반영됨).

## 4. 훅 호출 여부 확인

- 휴대폰 인증 요청 후 **Vercel 로그**에서 `[send-sms-hook] POST received` 검색.
- **한 줄도 없으면**: Supabase가 우리 URL을 호출하지 않는 것.
  - Hooks에 등록한 URL이 배포 도메인과 일치하는지 다시 확인.
  - 브라우저에서 직접 `https://<도메인>/api/auth/hooks/send-sms` 로 POST 해보면 401 등으로라도 응답이 오는지 확인 (훅이 도달하는지 검증).

## 5. 참고

- 훅은 **Standard Webhooks** 서명으로 검증한다. Secret 불일치 시 401.
- 성공 시 훅은 **body 없이 200**만 반환해야 한다. `Response.json({})` 같은 JSON body는 Supabase 쪽에서 "Error unmarshaling Send SMS output" 을 유발할 수 있음.
