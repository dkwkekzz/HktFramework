# 14. Phase G — 가능성 그래프와 목적 결정

> 상위: [Design-Modules.md](../Design-Modules.md) · 선행: [13-Phase-U-Subject.md](13-Phase-U-Subject.md) · 후속: [15-Phase-I-Interaction.md](15-Phase-I-Interaction.md)

목적 트리를 미리 열거하지 않고 **문법으로 생성**하며, 현재 현상과 관련된 부분만 지연 확장한다.
GI-03(목적 없는 행동 금지)의 강제 지점이다.

---

## 모듈 목록

| ID | 목적 | 대표 검증 | 선행 |
|---|---|---|---|
| G0 | 모든 행동을 재사용 가능한 최소 동사로 정의한다 | 동일한 `획득` 이 채집·절도·거래·사냥에 재사용됨 | K2, S0 |
| G1 | 종·문화·역할·개인의 가능성을 문법으로 정의한다 | 같은 인간이라도 사냥 문화와 상인 문화가 다른 전략 후보 생성 | U0, G0 |
| G2 | 관련된 그래프 부분만 생성하고 활성도를 계산한다 | 발자국을 본 사냥꾼은 추적, 겁 많은 상인은 도주 노드 활성 | G1, U3 |
| G3 | 활성 가능성 중 하나를 지속 목적으로 선택하고 경로를 만든다 | 문이 잠겼을 때 포기하지 않고 열쇠 탐색·우회 선택 | G2, S0, K1 |

---

## G0 — action-ontology

패키지: `packages/possibility/G0-action-ontology`

| 항목 | 내용 |
|---|---|
| 목적 | 모든 행동을 재사용 가능한 최소 동사로 정의한다 |
| 포함 | 획득, 보호, 제거, 이동, 교환, 은폐, 설득, 위협, 동맹, 배신 등 |
| 대표 검증 | 동일한 `획득` 행동이 채집·절도·거래·사냥 결과 획득에 재사용됨 |
| 선행 | K2, S0 |

행동은 다음 조합으로 만들어진다.

```text
동사 × 대상 × 수단 × 관계 × 비용 × 시간 × 공간
```

행동 원자 전체 목록은 [Design-MMO.md](../Design-MMO.md) 8.1 (획득·보호·제거·이동·변형·교환·결합·분리·은폐·드러냄·설득·속임·강제·복종·연합·배신·관찰·탐험·모방·계승·초월)을 따른다.
프로토타입 초기 행동 원자는 12개로 제한한다: 이동, 관찰, 획득, 공격, 보호, 거래, 요청, 협박, 기만, 추적, 각인, 능력 사용.

---

## G1 — possibility-grammar

패키지: `packages/possibility/G1-possibility-grammar`

| 항목 | 내용 |
|---|---|
| 목적 | 종·문화·역할·개인이 가질 수 있는 가능성을 문법으로 정의한다 |
| 포함 | Species Grammar, Culture Grammar, Role Grammar, Personal Modifiers |
| 대표 검증 | 같은 인간 종이라도 사냥 문화와 상인 문화에서 다른 전략 후보가 생성됨 |
| 선행 | U0, G0 |

개별 그래프는 문법의 합성이다.

```text
G_i = G_species ⊕ G_culture ⊕ G_role ⊕ G_personal ⊕ G_history
```

**완성된 거대한 트리를 저장하지 않는다.** 조합 폭발을 피하기 위해 문법만 보관한다.

---

## G2 — graph-activation

패키지: `packages/possibility/G2-graph-activation`

| 항목 | 내용 |
|---|---|
| 목적 | 전체 그래프를 미리 펼치지 않고 현재 현상과 관련된 부분만 생성한다 |
| 포함 | Lazy Expansion, Node Merge, Edge Creation, Activation Score |
| 대표 검증 | 거대 발자국을 본 사냥꾼은 추적 노드가, 겁이 많은 상인은 도주 노드가 활성화 |
| 선행 | G1, U3 |

활성도는 다음 요소로 계산한다.

```text
A(v) = N + V + T + M + R + F - C - Risk - Taboo

N     현재 욕구의 긴급도
V     가치관과의 일치
T     성격과의 일치
M     관련 기억
R     대상과의 관계
F     행동 가능성
C     비용
Risk  위험
Taboo 금기 위반
```

선택은 `Softmax(A/Temperature)` 이며 `Temperature` 는 성격(충동적/일관적)과 감정(공포·혼란)으로 조절한다.

런타임 예산은 다음으로 제한한다.

```text
활성 관심 노드: 4~8개
활성 목적 노드: 2~4개
목적별 전략 후보: 3~6개
행동 탐색 깊이: 2~4단계
장기 잠재 노드: 문법 형태로 보관
```

간선 유형은 `requires / enables / alternative / conflicts / decomposes / failure_transition / relationship_condition / learns_into` 이다.

---

## G3 — goal-planner

패키지: `packages/possibility/G3-goal-planner`

| 항목 | 내용 |
|---|---|
| 목적 | 활성 가능성 중 하나를 지속적인 목적으로 선택하고 실행 경로를 만든다 |
| 포함 | Commitment Inertia, Strategy Planner, Feasibility, Intent Selection |
| 대표 검증 | 문이 잠겼을 때 목적을 즉시 포기하지 않고 열쇠 탐색이나 우회 경로를 선택 |
| 선행 | G2, S0, K1 |

매 순간 무작위 선택을 하면 캐릭터의 일관성이 사라진다. `Commitment Inertia` 는 다음을 관리한다.

```text
현재 목적에 대한 집착도
이미 투자한 비용
타인에게 한 약속
자기 정체성과의 일치
목표를 포기했을 때의 수치심
성공 직전인지 여부
```

**플레이어 그래프는 예외다.** 플레이어의 그래프는 행동을 자동 결정하지 않고 다음만 담당한다 ([Design-MMO.md](../Design-MMO.md) 25장).

```text
현재 사용할 수 있는 행동 원자 결정
능력·지식에 따라 인식 가능한 현상 결정
행동의 조건과 비용 계산
도달 가능한 가능성 표시
성장으로 새 행동 조합 해금
플레이어가 만든 맹세와 정체성 기록
```

---

## 페이즈 완료 결과

```text
같은 현상에서 성격이 다른 주체가 다른 목적을 선택한다.
목적이 한 번의 실패로 즉시 폐기되지 않는다.
어떤 의도적 행동도 활성 목적 없이 제출되지 않는다 (GI-03).
```

## 관련 수직 통합

| 슬라이스 | 관계 |
|---|---|
| [VS1](30-Vertical-Slices.md#vs1-한-주체의-생존-행동) | G0~G3 |
| [VS2](30-Vertical-Slices.md#vs2-같은-현상-다른-캐릭터) | G1~G3 |
