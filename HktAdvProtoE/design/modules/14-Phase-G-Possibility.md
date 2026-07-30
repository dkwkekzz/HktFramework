# 14. Phase G — 가능성 그래프와 목적 결정

> 상위: [Design-Modules.md](../Design-Modules.md) · 원문 대응: 설계 원문 「12. Phase G — 가능성 그래프와 목적 결정」
>
> **아래 「원문」 절은 설계 원문을 그대로 옮긴 것이다.** 원문에 없는 보조 정보는 맨 끝 「파생 메모」에만 둔다.

---

## 원문

# 12. Phase G — 가능성 그래프와 목적 결정

## G0. 행동 원자 사전

| 항목 | 내용 |
| -- | -- |
| 목적 | 모든 행동을 재사용 가능한 최소 동사로 정의한다 |
| 포함 | 획득, 보호, 제거, 이동, 교환, 은폐, 설득, 위협, 동맹, 배신 등 |
| 대표 검증 | 동일한 `획득` 행동이 채집·절도·거래·사냥 결과 획득에 재사용됨 |
| 선행 | K2, S0 |

행동은 다음 조합으로 만들어진다.

```text
동사 × 대상 × 수단 × 관계 × 비용 × 시간 × 공간
```

## G1. 가능성 문법

| 항목 | 내용 |
| -- | -- |
| 목적 | 종·문화·역할·개인이 가질 수 있는 가능성을 문법으로 정의한다 |
| 포함 | Species Grammar, Culture Grammar, Role Grammar, Personal Modifiers |
| 대표 검증 | 같은 인간 종이라도 사냥 문화와 상인 문화에서 다른 전략 후보가 생성됨 |
| 선행 | U0, G0 |

## G2. 가능성 그래프 생성과 활성화

| 항목 | 내용 |
| -- | -- |
| 목적 | 전체 그래프를 미리 펼치지 않고 현재 현상과 관련된 부분만 생성한다 |
| 포함 | Lazy Expansion, Node Merge, Edge Creation, Activation Score |
| 대표 검증 | 거대 발자국을 본 사냥꾼은 추적 노드가, 겁이 많은 상인은 도주 노드가 활성화 |
| 선행 | G1, U3 |

## G3. 목적 유지·계획·행동 선택

| 항목 | 내용 |
| -- | -- |
| 목적 | 활성 가능성 중 하나를 지속적인 목적으로 선택하고 실행 경로를 만든다 |
| 포함 | Commitment Inertia, Strategy Planner, Feasibility, Intent Selection |
| 대표 검증 | 문이 잠겼을 때 목적을 즉시 포기하지 않고 열쇠 탐색이나 우회 경로를 선택 |
| 선행 | G2, S0, K1 |

---

## 파생 메모 (원문에 없음 — 작업 편의용)

### 패키지 경로

| ID | 패키지 |
|---|---|
| G0 | `packages/possibility/G0-action-ontology` |
| G1 | `packages/possibility/G1-possibility-grammar` |
| G2 | `packages/possibility/G2-graph-activation` |
| G3 | `packages/possibility/G3-goal-planner` |

### 관련 원문 절

- G3 은 [01-Global-Invariants.md](01-Global-Invariants.md) GI-03(목적 없는 행동 금지)의 대상이다.
- 원문 「2.2」의 `DecisionModule` 이 이 페이즈에 해당한다 — 믿음을 바탕으로 행동 의도를 만들며, 실제 세계 변화는 K2 가 담당한다.

### 관련 수직 통합

| 슬라이스 | 포함 모듈 (원문 기준) |
|---|---|
| [VS1](30-Vertical-Slices.md#vs1-한-주체의-생존-행동) | G0~G3 |
| [VS2](30-Vertical-Slices.md#vs2-같은-현상-다른-캐릭터) | G1~G3 |

### 함께 읽을 세계 설계 원본

- 행동 원자 전체 목록(21개)과 가능성 문법 조합축 — [Design-MMO.md](../Design-MMO.md) 8.1
- 개별 그래프 합성식 `G_i = G_species ⊕ G_culture ⊕ G_role ⊕ G_personal ⊕ G_history` 과 런타임 노드 예산 — 같은 문서 8.2
- 노드 활성도 `A(v)` 계산식, `Softmax(A/Temperature)`, `Commitment Inertia` 6항 — 같은 문서 9장
- 가능성 노드 유형·간선 유형 — 같은 문서 7.2 · 7.3
- 플레이어 그래프가 행동을 자동 결정하지 않는다는 예외 규정 — 같은 문서 25장
- 프로토타입 초기 행동 원자 12개 — 같은 문서 37장
