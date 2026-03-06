# Color System (Design Tokens)

가이드: **성격에 맞는 컬러를 아래 가이드 내에서 사용. Opacity 없는 단색 사용 권장.**

토큰은 `src/app/globals.css`의 `@theme`에 정의되어 있으며, Tailwind 유틸리티로 사용 가능 (`bg-main-01`, `text-gray-02` 등).

---

## Main

| 토큰        | HEX      | 용도       |
|------------|----------|------------|
| `main-01`  | #57AE00  | 메인 강조  |
| `main-02`  | #67CE00  |            |
| `main-03`  | #82DC28  |            |
| `main-04`  | #E0F687  |            |
| `main-05`  | #F5FAE6  | 배경/연한  |

---

## Text / Line (GRAY)

| 토큰       | HEX      |
|------------|----------|
| `gray-01`  | #242424  |
| `gray-02`  | #444444  |
| `gray-03`  | #555555  |
| `gray-04`  | #6F6F6F  |
| `gray-05`  | #8B8B8B  |
| `gray-06`  | #C1C1C1  |
| `gray-07`  | #DFDFDF  |
| `gray-08`  | #F9F9F9  |
| `black`    | #000000  |
| `white`    | #FFFFFF  |

---

## Button (WGRAY / RED / BLUE)

| 토큰        | HEX      |
|------------|----------|
| `wgray-01` | #3E3C41  |
| `wgray-02` | #5D5B59  |
| `wgray-03` | #959088  |
| `wgray-04` | #CAC5BB  |
| `wgray-05` | #F6F4EE  |
| `wgray-06` | #FAFAF6  |
| `red-01`   | #DF1D1D  |
| `red-02`   | #E9462B  |
| `blue-01`  | #0073CB  |
| `blue-02`  | #469FE3  |
| `blue-03`  | #E0F1FF  |

---

## Semantic (컴포넌트용)

기존 Button, Card 등에서 사용하는 이름. 위 팔레트에 매핑됨.

| 토큰               | 매핑      |
|--------------------|-----------|
| `background`       | white     |
| `foreground`       | gray-01   |
| `primary`          | main-01   |
| `primary-foreground` | black   |
| `muted`            | gray-08   |
| `muted-foreground` | gray-04   |
| `border`           | gray-07   |
| `destructive`      | red-01    |
| `ring`             | main-01   |
