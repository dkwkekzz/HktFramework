# 15. Phase I — 상호작용과 콘텐츠 사건

> 상위: [Design-Modules.md](../Design-Modules.md) · 선행: [14-Phase-G-Possibility.md](14-Phase-G-Possibility.md) · 후속: [16-Phase-R-Progression.md](16-Phase-R-Progression.md)

**퀘스트 없이 콘텐츠를 만드는 페이즈다.** 콘텐츠의 최소 단위는 퀘스트가 아니라 다음 결합이다.

```text
주체가 믿는 문제 + 목적 + 공통 자원·공간 + 상충하는 목적 + 규칙 = 사건
```

---

## 모듈 목록

| ID | 목적 | 대표 검증 | 선행 |
|---|---|---|---|
| I0 | 여러 주체의 해결되지 않은 목적을 하나의 사건 후보로 묶는다 | 마물 이동·상인 운송·마을 생존이 하나의 협곡 상황으로 결합 | G3 |
| I1 | 관계와 힘의 차이에 따라 사회적 전략을 선택한다 | 같은 목적이어도 친구에게는 요청, 적대적 약자에게는 협박 | U2, U3, G3, I0 |
| I2 | 퀘스트를 명시적 약속과 자원 교환으로 표현한다 | 수락 전에는 의무가 없고, 수락 후 위반하면 결과가 적용됨 | S2, I1, K2 |
| I3 | 동시 제출된 행동을 해결하고 다음 사건의 원인을 남긴다 | 두 주체가 같은 아이템을 동시에 획득해도 소유자는 하나 | K2, K3, I0~I2 |

---

## I0 — pressure-situation

패키지: `packages/interaction/I0-pressure-situation`

| 항목 | 내용 |
|---|---|
| 목적 | 여러 주체의 해결되지 않은 목적을 하나의 사건 후보로 묶는다 |
| 포함 | Pressure Registry, Situation Clustering, Conflict Key |
| 대표 검증 | 마물 이동·상인 운송·마을 생존 문제가 하나의 국경 협곡 상황으로 결합 |
| 선행 | G3 |

콘텐츠를 만들려면 먼저 “사건”이 아니라 해결되지 않은 **압력**을 만들어야 한다.
`Pressure` / `Situation` 구조는 [Design-MMO.md](../Design-MMO.md) 19.1~19.2 를 따른다.

같은 자원·장소·시간·인물·정보에 관련된 압력들을 묶어 `Situation` 을 만들고, `conflictKeys` / `cooperationKeys` 로 충돌·협력 축을 명시한다.

GI-10(플레이어 부재 시 세계 정지 금지)은 이 모듈에서 시작된다. 압력은 플레이어와 무관하게 등록·상승한다.

---

## I1 — social-strategy

패키지: `packages/interaction/I1-social-strategy`

| 항목 | 내용 |
|---|---|
| 목적 | 관계와 힘의 차이에 따라 요청·거래·협박·기만·동맹·배신을 선택한다 |
| 포함 | Social Utility, Relation Utility, Risk, Moral Cost |
| 대표 검증 | 같은 목적이어도 친구에게는 요청하고 적대적 약자에게는 협박함 |
| 선행 | U2, U3, G3, I0 |
| 소유 상태 | none (읽기 전용 판단 모듈) |

NPC 가 요청을 생성하려면 다음 여섯 조건을 **모두** 통과해야 한다.

```text
1. NPC에게 해결되지 않은 목적이 있다.
2. NPC 혼자서는 필요한 행동을 수행하기 어렵다.
3. NPC는 플레이어가 필요한 능력이나 자원을 가진다고 믿는다.
4. 플레이어를 이용하는 기대 이익이 다른 대안보다 높다.
5. 플레이어와 접촉할 수 있다.
6. NPC의 가치관과 관계가 협력을 허용한다.
```

관계·성격에 따른 전략 분기:

```text
신뢰 높음 + 힘의 차이 작음        → 정직한 요청
신뢰 낮음 + 플레이어가 강함       → 거래 또는 부분적 기만
신뢰 낮음 + NPC가 강함            → 협박 또는 강제
적대적이지만 공통 위협 존재       → 임시 동맹
결과만 필요하고 제거 계획         → 이용 후 배신
NPC가 플레이어에게 빚을 짐        → 보상 조건이 좋은 요청
```

```ts
function selectSocialStrategy(
  npc: SubjectState,
  target: SubjectState,
  goal: PossibilityNode,
  alternatives: readonly Intent[],
  rng: DeterministicRng
): Intent | null {
  const valid = alternatives.filter(intent =>
    canPerformIntent(npc, intent) &&
    isGoalRelevant(intent, goal)
  );

  if (valid.length === 0) {
    return null;
  }

  const relation = npc.relations[target.id];

  const scored = valid.map(intent => ({
    intent,
    score:
      expectedGoalUtility(npc, intent) +
      relationUtility(intent, relation) +
      personalityUtility(npc, intent) -
      expectedRisk(npc, intent) -
      moralCost(npc, intent)
  }));

  return weightedSoftmaxChoice(scored, npc, rng);
}
```

플레이어가 거부하면 NPC 는 기다리지 않는다. 다른 대상을 찾거나, 협박하거나, 스스로 시도하거나, 목적을 포기하거나, 플레이어를 적으로 간주한다.

이 모듈의 `MODULE.yaml` 예시는 [00-Module-Contract.md](00-Module-Contract.md) 2절에 있다.

---

## I2 — commitment-transaction

패키지: `packages/interaction/I2-commitment-transaction`

| 항목 | 내용 |
|---|---|
| 목적 | 퀘스트를 명시적인 사회적 약속과 자원 교환으로 표현한다 |
| 포함 | Offer, Acceptance, Commitment, Breach, Trade, Ownership Transfer |
| 대표 검증 | 제안을 수락하기 전에는 의무가 없고, 수락 후 위반하면 관계와 약속 결과가 적용됨 |
| 선행 | S2, I1, K2 |

`Commitment` 는 퀘스트·계약·동맹·협박·맹세·능력 제약·조약·서약을 하나로 통합한다.
퀘스트 UI 는 이 `Commitment` 를 플레이어가 이해할 수 있게 표시하는 **표현 계층일 뿐이다** (X3 담당).

---

## I3 — conflict-event-chain

패키지: `packages/interaction/I3-conflict-event-chain`

| 항목 | 내용 |
|---|---|
| 목적 | 동시에 제출된 행동을 세계 규칙으로 해결하고 다음 사건의 원인을 남긴다 |
| 포함 | Intent Grouping, Resolution, Phenomenon Emission, Event Hook, Escalation |
| 대표 검증 | 두 주체가 하나의 아이템을 동시에 획득하려 해도 소유자는 하나만 결정됨 |
| 선행 | K2, K3, I0~I2 |

해결 절차:

```text
주체들이 같은 시간대에 Intent 제출
    ↓
읽고 쓰려는 상태 집합 분석
    ↓
서로 충돌하는 Intent를 하나의 해결 그룹으로 묶음
    ↓
적용 가능한 세계 규칙 수집
    ↓
비용·조건·우선순위 검사
    ↓
상태 변화 계산
    ↓
사건 생성
    ↓
흔적·소리·소문·부상·채무 등 현상 방출
```

모든 사건은 다음 가능성의 재료를 남긴다 (`EventHook`). 사건 연쇄는 미리 작성된 스토리라인이 아니라 **같은 압력이 형태를 바꾸며 이어지는 구조**다.

```text
마물 이동 → 상단 운송 중단 → 약 가격 상승 → 환자 가족의 절도
→ 경비대의 추적 → 범죄 조직의 포섭 → 국가의 치안 강화
→ 밀수로 폐쇄 → 다른 지역의 식량 부족
```

플레이어에게 보이는 콘텐츠는 `EventHook` 과 플레이어 믿음의 투영이다.

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

## 페이즈 완료 결과

```text
퀘스트 데이터 없이 NPC 가 요청·거래·협박을 생성한다.
플레이어가 거부해도 사건이 멈추지 않는다.
고유 자원의 소유자는 항상 하나다 (GI-11).
사건마다 후속 압력이 생성된다.
```

## 관련 수직 통합

| 슬라이스 | 관계 |
|---|---|
| [VS3](30-Vertical-Slices.md#vs3-퀘스트-없는-요청) | I0~I2 — 이 페이즈의 핵심 슬라이스 |
| [VS4](30-Vertical-Slices.md#vs4-경쟁과-사건-연쇄) | I3 |
