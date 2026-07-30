# 15. Phase I — 상호작용과 콘텐츠 사건

> 상위: [Design-Modules.md](../Design-Modules.md) · 원문 대응: 설계 원문 「13. Phase I — 상호작용과 콘텐츠 사건」
>
> **아래 「원문」 절은 설계 원문을 그대로 옮긴 것이다.** 원문에 없는 보조 정보는 맨 끝 「파생 메모」에만 둔다.

---

## 원문

# 13. Phase I — 상호작용과 콘텐츠 사건

## I0. 압력과 상황

| 항목 | 내용 |
| -- | -- |
| 목적 | 여러 주체의 해결되지 않은 목적을 하나의 사건 후보로 묶는다 |
| 포함 | Pressure Registry, Situation Clustering, Conflict Key |
| 대표 검증 | 마물 이동·상인 운송·마을 생존 문제가 하나의 국경 협곡 상황으로 결합 |
| 선행 | G3 |

## I1. 사회적 전략

| 항목 | 내용 |
| -- | -- |
| 목적 | 관계와 힘의 차이에 따라 요청·거래·협박·기만·동맹·배신을 선택한다 |
| 포함 | Social Utility, Relation Utility, Risk, Moral Cost |
| 대표 검증 | 같은 목적이어도 친구에게는 요청하고 적대적 약자에게는 협박함 |
| 선행 | U2, U3, G3, I0 |

## I2. 약속·거래·소유 이전

| 항목 | 내용 |
| -- | -- |
| 목적 | 퀘스트를 명시적인 사회적 약속과 자원 교환으로 표현한다 |
| 포함 | Offer, Acceptance, Commitment, Breach, Trade, Ownership Transfer |
| 대표 검증 | 제안을 수락하기 전에는 의무가 없고, 수락 후 위반하면 관계와 약속 결과가 적용됨 |
| 선행 | S2, I1, K2 |

## I3. 충돌 해결과 사건 연쇄

| 항목 | 내용 |
| -- | -- |
| 목적 | 동시에 제출된 행동을 세계 규칙으로 해결하고 다음 사건의 원인을 남긴다 |
| 포함 | Intent Grouping, Resolution, Phenomenon Emission, Event Hook, Escalation |
| 대표 검증 | 두 주체가 하나의 아이템을 동시에 획득하려 해도 소유자는 하나만 결정됨 |
| 선행 | K2, K3, I0~I2 |

플레이어에게 보이는 콘텐츠는 `EventHook`과 플레이어 믿음의 투영이다.

```text
세계 상황
    +
플레이어가 아는 정보
    +
플레이어의 능력
    +
플레이어 관계
    =
현재 개입 가능한 콘텐츠
```

---

## 파생 메모 (원문에 없음 — 작업 편의용)

### 패키지 경로

| ID | 패키지 |
|---|---|
| I0 | `packages/interaction/I0-pressure-situation` |
| I1 | `packages/interaction/I1-social-strategy` |
| I2 | `packages/interaction/I2-commitment-transaction` |
| I3 | `packages/interaction/I3-conflict-event-chain` |

### 관련 원문 절

- **I1 의 `MODULE.yaml` 전문이 원문 「3.1」의 예시다** — 목적·의존·소유 상태·입출력·불변조건·시나리오·명령까지 그대로 확정되어 있다. [00-Module-Contract.md](00-Module-Contract.md) 2절 참조.
- 원문 「24. 브라우저 Lab의 공통 화면」의 예시 화면도 I1(“주체가 믿음과 관계에 따라 사회 행동 선택”)을 대상으로 작성되어 있다. 후보 점수 표기(요청 72 / 거래 64 / 협박 21 / 기만 17)와 이유 표기(신뢰 +20, 힘의 차이 -5, 도덕 비용 -2)가 I1 Lab 의 기준이다.
- I3 은 [01-Global-Invariants.md](01-Global-Invariants.md) GI-11(고유 자원의 중복 소유 금지), I0 은 GI-10(플레이어 부재 시 세계 정지 금지)의 대상이다.
- 원문 「2.5」의 무효화 연쇄에 I3(Conflict Resolver)이 포함된다.

### 관련 수직 통합

| 슬라이스 | 포함 모듈 (원문 기준) |
|---|---|
| [VS3](30-Vertical-Slices.md#vs3-퀘스트-없는-요청) | S2, I0~I2 |
| [VS4](30-Vertical-Slices.md#vs4-경쟁과-사건-연쇄) | I3, S3 |

### 함께 읽을 세계 설계 원본

- `Pressure` / `Situation` / `Intent` / `WorldEvent` / `EventHook` 필드 — [Design-MMO.md](../Design-MMO.md) 19장 · 21장
- NPC 요청 생성 6조건, 관계별 전략 분기, `selectSocialStrategy` 의사 코드 — 같은 문서 20장
- 사건 해결 절차와 사건 연쇄 예시(마물 이동 → 식량 부족) — 같은 문서 19.4 · 21장
- `Commitment` 가 퀘스트·계약·동맹·협박·맹세·조약·서약을 통합한다는 규정 — 같은 문서 2장
