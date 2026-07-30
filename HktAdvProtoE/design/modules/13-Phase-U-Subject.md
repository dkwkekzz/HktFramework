# 13. Phase U — 주체 인지 모듈

> 상위: [Design-Modules.md](../Design-Modules.md) · 원문 대응: 설계 원문 「11. Phase U — 주체 인지 모듈」
>
> **아래 「원문」 절은 설계 원문을 그대로 옮긴 것이다.** 원문에 없는 보조 정보는 맨 끝 「파생 메모」에만 둔다.

---

## 원문

# 11. Phase U — 주체 인지 모듈

## U0. 주체 핵심 상태

| 항목 | 내용 |
| -- | -- |
| 목적 | 사람·생물·조직·신이 목적을 만들 수 있는 공통 주체 구조를 제공한다 |
| 포함 | 욕구, 가치, 특성, 감정, 능력, 자원, 신체 연결 |
| 대표 검증 | 동일한 배고픔 상태에서도 가치와 성격이 다른 주체의 우선순위가 달라짐 |
| 선행 | K, S |

## U1. 현상과 지각

| 항목 | 내용 |
| -- | -- |
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

## U2. 믿음·주장·증거

| 항목 | 내용 |
| -- | -- |
| 목적 | 주체가 실제 세계와 다른 세계상을 가질 수 있게 한다 |
| 포함 | Claim Graph, Confidence, Evidence Link, Contradiction Resolution |
| 대표 검증 | 소문을 들은 NPC는 범인을 믿지만 실제 범인 상태는 변경되지 않음 |
| 선행 | U1, S3 |

## U3. 기억·관계·해석

| 항목 | 내용 |
| -- | -- |
| 목적 | 과거 경험과 상대 관계가 동일한 현상의 의미를 다르게 만들게 한다 |
| 포함 | Episodic Memory, Semantic Memory, Relation Update, Interpretation |
| 대표 검증 | 과거에 배신당한 NPC는 같은 선물도 호의보다 함정으로 해석할 확률이 높음 |
| 선행 | U0~U2, S2 |

모든 결정에는 `DecisionTrace`를 남긴다.

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

## 파생 메모 (원문에 없음 — 작업 편의용)

### 패키지 경로

| ID | 패키지 |
|---|---|
| U0 | `packages/subject/U0-subject-core` |
| U1 | `packages/subject/U1-perception` |
| U2 | `packages/subject/U2-belief` |
| U3 | `packages/subject/U3-memory-interpretation` |

### 관련 원문 절

- U1 의 대표 검증 장면(벽 양쪽 NPC와 종소리, `/lab/U1-perception`)은 원문 「2.4 모든 모듈은 대표 검증 장면을 하나 이상 가진다」에 있다. [Design-Modules.md](../Design-Modules.md) 2.4 참조.
- U1 → U2 의 상태 소유 경계는 원문 「2.2」의 `PerceptionModule → BeliefModule` 예시가 그대로 적용된다.
- U2 는 [01-Global-Invariants.md](01-Global-Invariants.md) GI-02(주체의 전지적 판단 금지)의 대상이다.

### 관련 수직 통합

| 슬라이스 | 포함 모듈 (원문 기준) |
|---|---|
| [VS1](30-Vertical-Slices.md#vs1-한-주체의-생존-행동) | U0, U1 |
| [VS2](30-Vertical-Slices.md#vs2-같은-현상-다른-캐릭터) | U2, U3 |

### 함께 읽을 세계 설계 원본

- 주체 인정 조건 5항 — [Design-MMO.md](../Design-MMO.md) 6장
- `SubjectState` / `RelationState` / `Phenomenon` / `Claim` 필드 — 같은 문서 10장
- 정보 전파 단계와 `InformationTransmission`, 거짓말 생성 4조건 — 같은 문서 26장
