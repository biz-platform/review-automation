# Signup 이메일/휴대전화 input disabled 시 배경색 이슈 — 원인 및 해결

## 현상

- **증상**: 회원가입 Step1/Step2에서 "인증" 버튼을 누르면 이메일/휴대전화 input이 disabled로 바뀌어야 하는데, **배경이 회색이 아니라 파란색(rgb(232, 240, 254))**으로 보임.
- **추가 관찰**: "다음"으로 넘어갔다가 "이전"으로 돌아오면 그때는 **회색**으로 정상 표시됨.

즉, **상태(disabled)는 정상인데, 첫 번째로 disabled가 적용될 때만 시각(배경색)이 잘못 보이는 문제**였다.

---

## 원인

### 1. 상태·DOM은 정상이었음

- `disabled={true}`가 React → TextField → `<input disabled>`까지 제대로 전달됨.
- 디버깅 로그에서도 `input.disabled: true`, `disabled_prop: true`로 확인됨.
- 따라서 **“disabled가 안 된다”**가 아니라 **“disabled인데도 배경만 파란색으로 보인다”**가 맞는 문제.

### 2. 실제 원인: Chrome(브라우저) 기본 스타일

disabled로 바뀐 직후에도 **input에 포커스가 남아 있는 상태**이거나, **Chrome 자동완성(autofill)** 스타일이 적용된 상태였다.

- Chrome은 input에 **autofill**이나 **포커스** 시 배경을 **연한 파란색(rgb(232, 240, 254))**으로 칠함.
- 이 스타일은 브라우저 내부 스타일시트에서 **`!important`** 로 들어가거나, **inset box-shadow**로 “배경처럼” 칠해짐.
- 우리가 적용한 것:
  - Tailwind `disabled:bg-gray-08` (클래스)
  - 또는 인라인 `style={{ backgroundColor: "var(--color-gray-08)" }}`
- **일반 CSS/인라인 스타일은 브라우저의 `!important`나 box-shadow 기법을 이기지 못함** → 그래서 화면에는 계속 파란색이 보였음.

#### 왜 “Chrome 스타일이 우선”으로 보였나? (우선순위가 밀린 이유)

CSS에서 **어떤 스타일이 적용되는지**는 보통 다음과 같은 순서로 결정된다.

1. **선택자 우선순위**: `인라인 > id > class > 태그` (우리가 쓴 건 class 또는 인라인)
2. **같은 우선순위면**: 나중에 선언된 규칙이 이김
3. **`!important`**: 같은 속성에 `!important`가 붙으면, **안 붙은 규칙은 무시**됨

우리 쪽에서는:

- Tailwind `disabled:bg-gray-08` → **클래스 선택자**, `!important` 없음
- 인라인 `style={{ backgroundColor: "..." }}` → **인라인 스타일**, `!important` 없음

Chrome 쪽에서는:

- **경우 1**: 브라우저가 `input:-webkit-autofill` 같은 선택자로  
  `background-color: rgb(232, 240, 254) !important;` 를 넣음  
  → **같은 속성(background-color)에 `!important`가 있으면, 우리 인라인/클래스는 전부 무시됨.**
- **경우 2**: Chrome이 배경을 **`background-color`가 아니라 `box-shadow: ... inset`** 로 그리는 경우  
  → 우리는 `background-color`만 바꿨기 때문에, **“배경처럼 보이는 box-shadow”는 그대로**라서 파란색이 계속 보임.

정리하면:

- **“Chrome 기본 스타일이 우선 순위가 높다”**는 말은,  
  **Chrome이 `!important`를 쓰거나, 우리가 수정하지 않은 다른 속성(box-shadow)으로 색을 칠했기 때문에**  
  우리가 넣은 **일반 우선순위의 background-color**가 **덮어쓰이거나, 아예 다른 레이어(박스 그림자)** 때문에 가려진 상황이라고 보면 된다.

### 3. “이전”으로 돌아오면 회색으로 보였던 이유

- "다음"으로 이동했다가 "이전"으로 돌아오면 **input이 한 번 unmount되었다가 다시 mount**됨.
- 그때는 **포커스가 input에 없고**, **autofill 하이라이트도 그 시점에는 적용되지 않은 상태**로 그려짐.
- 그래서 우리가 지정한 `disabled:bg-gray-08`만 적용되어 **회색**으로 보였음.

정리하면:

- **원인**: disabled 직후에도 **브라우저의 포커스/autofill 배경(파란색)** 이 우리 스타일보다 **우선 적용**되고 있었음.
- **상태값/disabled 적용 자체는 정상**이었고, **시각(배경색)만 브라우저 기본 스타일에 의해 덮여 있었음**.

---

## 해결 방법

### 전략: 브라우저 스타일보다 우선하게 만들기

1. **`!important` 사용**  
   - 브라우저가 `!important`로 배경을 넣기 때문에, 우리도 **같은 속성에 `!important`**를 써서 덮어쓰기.

2. **Chrome autofill의 “배경처럼 보이는 box-shadow”까지 덮기**  
   - Chrome은 배경을 **`box-shadow: ... inset`** 로 그리는 경우가 있어서, `background-color`만으로는 파란색이 사라지지 않음.
   - **같은 방식으로** input 안쪽을 전부 칠하는 **inset box-shadow**를 우리 회색으로 넣어서, 시각적으로 우리 배경이 보이게 함.

### 구현 내용

**1. globals.css — 전용 클래스 추가**

```css
@layer components {
  .input-disabled-force-bg:disabled {
    background-color: var(--color-gray-08) !important;
    box-shadow: 0 0 0 1000px var(--color-gray-08) inset !important;
  }
}
```

- `:disabled` 일 때만 적용되므로, disabled가 아닌 input에는 영향 없음.
- `background-color ... !important`: 브라우저가 넣는 배경색을 우리 회색(gray-08)으로 덮음.
- `box-shadow: 0 0 0 1000px ... inset !important`: input 안쪽을 넓게 칠해서, Chrome이 box-shadow로 그리는 “파란 배경” 위에 우리 회색이 보이게 함.

**2. TextField — disabled일 때만 클래스 부여**

- 이메일/휴대전화 input(일반 분기 + trailingAddon 분기) 모두:
  - `disabled`일 때 `className`에 `input-disabled-force-bg` 추가.
- 인라인 `style`로 배경을 넣던 부분은 제거 (위 클래스로 통일).

이렇게 하면:

- **disabled 직후**에도
- **포커스/autofill** 이 있어도

항상 **회색 배경(gray-08)** 으로 보이게 됨.

---

## 요약 표

| 구분 | 내용 |
|------|------|
| **현상** | 인증 클릭 후 이메일/휴대전화 input이 disabled인데 배경만 파란색(rgb(232, 240, 254))으로 보임. 이전으로 갔다 오면 회색으로 보임. |
| **원인** | Chrome 포커스/autofill 스타일이 `!important` 또는 inset box-shadow로 적용되어, 우리가 지정한 disabled 배경(회색)을 덮어씀. |
| **해결** | `input-disabled-force-bg:disabled` 클래스에서 `background-color`와 `box-shadow` 둘 다 `var(--color-gray-08)` + `!important`로 지정해, 브라우저 스타일을 덮어쓰기. |
| **수정 파일** | `src/app/globals.css`, `src/components/ui/text-field.tsx` |

---

## 참고: 디버깅으로 확인한 것

- `[Step1] render` / `[TextField] render`: `emailInputDisabled`, `disabled_prop` 이 true로 잘 넘어옴.
- `[TextField] DOM after commit`: `input.disabled: true`, `computedBackgroundColor: 'rgb(232, 240, 254)'` → DOM은 disabled인데 **계산된 배경은 Chrome이 넣은 파란색**이었음.
- 위 해결 적용 후에는 동일 시나리오에서 `computedBackgroundColor`가 gray-08(rgb(249, 249, 249))로 나오는 것을 확인함.
