# 17. Phase C — 복합 주체

> 상위: [Design-Modules.md](../Design-Modules.md) · 원문 대응: 설계 원문 「15. Phase C — 복합 주체」
>
> **아래 「원문」 절은 설계 원문을 그대로 옮긴 것이다.** 원문에 없는 보조 정보는 맨 끝 「파생 메모」에만 둔다.

---

## 원문

# 15. Phase C — 복합 주체

## C0. 종·생애·생태

| 항목 | 내용 |
| -- | -- |
| 목적 | 생물 종이 개체 생성기 이상의 생존 문법을 가지게 한다 |
| 포함 | Lifecycle, Feeding, Reproduction, Population, Habitat |
| 대표 검증 | 먹이 부족과 번식 주기가 개체군 변화로 이어짐 |
| 선행 | S1, U0, G1 |

## C1. 거대 마물

| 항목 | 내용 |
| -- | -- |
| 목적 | 거대 마물을 체력 높은 몬스터가 아니라 이동하는 생태 규칙 주체로 구현한다 |
| 포함 | 기관, 섭식 적응, 번식지, 이동 경로, 영역, 사체 영향 |
| 대표 검증 | 이동 경로 차단 시 마물이 마을 방향으로 우회하고 경제·생태 상황이 변함 |
| 선행 | C0, R2, I3 |

## C2. 조직과 국가

| 항목 | 내용 |
| -- | -- |
| 목적 | 조직이 구성원·자산·통치 구조를 통해 행동하게 한다 |
| 포함 | Governance, Faction, Cohesion, Orders, Assets, Territory, Law |
| 대표 검증 | 국가가 명령해도 지휘관이 배신하거나 보급이 끊기면 실행되지 않음 |
| 선행 | U, G, I, S2 |

## C3. 신과 규칙 보유 주체

| 항목 | 내용 |
| -- | -- |
| 목적 | 신을 지역 규칙과 유지 조건을 가진 주체로 표현한다 |
| 포함 | Anchor, Sustenance, Domain Rule, Worship, Taboo, Collapse |
| 대표 검증 | 국경석 이동으로 신의 영역과 공간 교란 규칙이 실제로 변함 |
| 선행 | S3, U0, G, I3 |

---

## 파생 메모 (원문에 없음 — 작업 편의용)

### 패키지 경로

| ID | 패키지 |
|---|---|
| C0 | `packages/complex-subjects/C0-species-ecology` |
| C1 | `packages/complex-subjects/C1-giant-beast` |
| C2 | `packages/complex-subjects/C2-organization-nation` |
| C3 | `packages/complex-subjects/C3-rule-bearing-god` |

### 관련 원문 절

- C2 는 [01-Global-Invariants.md](01-Global-Invariants.md) GI-08(조직의 추상 행동 금지)의 대상이다.
- 원문 「26. 원래 설계와 모듈 추적표」에서 “모든 주체가 자기 삶의 주인공”은 U0, G1, C0~C3 이 함께 담당한다.

### 관련 수직 통합

| 슬라이스 | 포함 모듈 (원문 기준) |
|---|---|
| [VS6](30-Vertical-Slices.md#vs6-거대-마물이-만드는-지역-사건) | C0, C1, I0~I3 |
| [VS7](30-Vertical-Slices.md#vs7-국가와-신의-충돌) | C2, C3 |

### 함께 읽을 세계 설계 원본

- 조직의 명령 전달 사슬과 `CollectiveSubjectState` — [Design-MMO.md](../Design-MMO.md) 6장
- 거대 마물의 기관 생성 원리와 사냥 경로 8종 — 같은 문서 17.1
- `RuleBearingSubject` 와 국경 신의 유지 조건 — 같은 문서 17.2
- 깊이 있는 캐릭터 생성 규칙(자기모순 2개 미만은 주요 인물 불채택) — 같은 문서 23장
- 캐릭터·거대 마물·조직·지역 품질 검증 체크리스트 — 같은 문서 36장
