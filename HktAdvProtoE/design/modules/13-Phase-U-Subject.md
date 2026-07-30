# 13. Phase U — 주체 인지 모듈

> 상위: [Design-Modules.md](../Design-Modules.md) · 선행: [12-Phase-S-World-State.md](12-Phase-S-World-State.md) · 후속: [14-Phase-G-Possibility.md](14-Phase-G-Possibility.md)

주체가 **실제 세계가 아니라 자기 믿음으로** 행동하게 만드는 계층이다.
GI-02(전지적 판단 금지)의 핵심 강제 지점이며, 정보 비대칭·수사·배신·음모 콘텐츠의 근원이다.

---

## 모듈 목록

| ID | 목적 | 대표 검증 | 선행 |
|---|---|---|---|
| U0 | 사람·생물·조직·신이 목적을 만들 수 있는 공통 주체 구조를 제공한다 | 같은 배고픔에서도 가치·성격이 다르면 우선순위가 달라짐 | K, S |
| U1 | 실제 사건을 주체가 감지할 수 있는 현상으로 변환한다 | 벽 뒤 사건은 보지 못하지만 큰 폭발음은 들을 수 있음 | S0, S3, U0 |
| U2 | 주체가 실제 세계와 다른 세계상을 가질 수 있게 한다 | 소문을 들은 NPC는 범인을 믿지만 실제 범인 상태는 불변 | U1, S3 |
| U3 | 과거 경험과 관계가 동일 현상의 의미를 다르게 만들게 한다 | 배신당한 NPC는 같은 선물도 함정으로 해석할 확률이 높음 | U0~U2, S2 |

---

## U0 — subject-core

패키지: `packages/subject/U0-subject-core`

| 항목 | 내용 |
|---|---|
| 목적 | 사람·생물·조직·신이 목적을 만들 수 있는 공통 주체 구조를 제공한다 |
| 포함 | 욕구, 가치, 특성, 감정, 능력, 자원, 신체 연결 |
| 대표 검증 | 동일한 배고픔 상태에서도 가치와 성격이 다른 주체의 우선순위가 달라짐 |
| 선행 | K, S |

주체 인정 조건 (원설계 6장) — 이 다섯 가지를 만족하면 플레이어·NPC·마물·조직·국가·신·도시·생태계가 **같은 인터페이스**를 구현한다.

```text
자기 경계가 있다.
현재 상태를 유지하거나 바꾸려는 방향성이 있다.
세계를 감지하는 방식이 있다.
상태를 바꿀 행동 수단이 있다.
과거 사건의 영향을 보존한다.
```

`SubjectState` 필드는 [Design-MMO.md](../Design-MMO.md) 10장을 따른다.

---

## U1 — perception

패키지: `packages/subject/U1-perception`

| 항목 | 내용 |
|---|---|
| 목적 | 실제 사건을 주체가 감지할 수 있는 현상으로 변환한다 |
| 포함 | 시각, 청각, 냄새, 접촉, 의념, 보고, 소문 |
| 대표 검증 | 벽 뒤 사건은 보지 못하지만 큰 폭발음은 들을 수 있음 |
| 선행 | S0, S3, U0 |

```text
WorldEvent
    ↓
Phenomenon
    ↓ 센서별 필터
PerceivedPhenomenon
```

대표 Lab 장면 (`/lab/U1-perception`):

```text
NPC A와 NPC B가 벽 양쪽에 있다.
종이 울린다.
기대 결과:
A는 소리를 듣는다.
B는 시각적으로 종을 보지 못한다.
시각 주장과 청각 주장이 구분된다.
```

---

## U2 — belief

패키지: `packages/subject/U2-belief`

| 항목 | 내용 |
|---|---|
| 목적 | 주체가 실제 세계와 다른 세계상을 가질 수 있게 한다 |
| 포함 | Claim Graph, Confidence, Evidence Link, Contradiction Resolution |
| 대표 검증 | 소문을 들은 NPC는 범인을 믿지만 실제 범인 상태는 변경되지 않음 |
| 선행 | U1, S3 |
| 소유 상태 | `BeliefState` (실제 세계 상태 수정 금지) |

정보 전파는 단계마다 변형될 수 있다.

```text
실제 사건 → 직접 목격 → 증거 생성 → 증언 → 소문 → 공식 발표 → 역사 기록
```

거짓말은 텍스트 생성기가 임의로 만들지 않는다. 다음 조건을 모두 충족해야 생성된다.

```text
화자가 진실 또는 다른 믿음을 가지고 있다.
화자가 정보를 숨길 목적을 가지고 있다.
거짓 주장이 목적 달성에 도움이 된다고 판단한다.
거짓말이 들킬 위험을 계산한다.
```

`InformationTransmission`(distortion / concealment / persuasion)은 [Design-MMO.md](../Design-MMO.md) 26장을 따른다.

---

## U3 — memory-interpretation

패키지: `packages/subject/U3-memory-interpretation`

| 항목 | 내용 |
|---|---|
| 목적 | 과거 경험과 상대 관계가 동일한 현상의 의미를 다르게 만들게 한다 |
| 포함 | Episodic Memory, Semantic Memory, Relation Update, Interpretation |
| 대표 검증 | 과거에 배신당한 NPC는 같은 선물도 호의보다 함정으로 해석할 확률이 높음 |
| 선행 | U0~U2, S2 |

모든 결정에는 `DecisionTrace` 를 남긴다. 이것이 없으면 G4(직관 게이트)와 A5(인과 감사)가 불가능하다.

```ts
interface DecisionTrace {
  subjectId: string;
  perceivedPhenomenonIds: string[];
  relevantMemoryIds: string[];
  activatedNeedIds: string[];
  candidateGoalScores: Record<string, number>;
  candidateActionScores: Record<string, number>;
  selectedActionId: string;
  rejectedReasons: Record<string, string[]>;
}
```

---

## 페이즈 완료 결과

```text
NPC 가 서버의 실제 상태가 아니라 자기 믿음으로 행동한다.
같은 사건을 두 NPC 가 다르게 믿는 상태가 Lab 에서 나란히 보인다.
모든 결정에 DecisionTrace 가 남는다.
```

## 관련 수직 통합

| 슬라이스 | 관계 |
|---|---|
| [VS1](30-Vertical-Slices.md#vs1-한-주체의-생존-행동) | U0, U1 |
| [VS2](30-Vertical-Slices.md#vs2-같은-현상-다른-캐릭터) | U2, U3 — 이 페이즈의 핵심 슬라이스 |
