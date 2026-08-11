# WORKFLOW-OPS.md — HktAdvProtoH Agent Workflow 운영 가이드

> [design/Design-Workflow.md](../design/Design-Workflow.md) §28 Agent Workflow 를 실제 작업 단위로 운영하기 위한 규칙.
> 이 문서가 **운영 절차의 진본**이다. 설계 철학의 진본은 Design-Workflow.md, 게임 개념의 진본은 Design-Concept.md 이며,
> 각 Agent 는 그 문서 전체를 읽지 않는다 — 필요한 규칙은 각 Skill 에 증류되어 있다.

## 1. 파이프라인과 Skill 대응

```text
Human Design (Goal/Possibility Graph)     ← design/graphs/
        ↓
[1] Intent Agent          → /advprotoh-intent       Graph → 10-intent.md
        ↓
[2] World Model Agent     → /advprotoh-world-model  Intent → 20-world.md (State/Rule/Observable/View)
        ↓
    Human Semantic Review →                          30-review.md (인간이 승인 기록)
        ↓
[3] Implementation Agent  → /advprotoh-implement    Package → 코드 + 40-implementation.md
        ↓
[4] Verification Agent    → /advprotoh-verify       Closure 검사 + 50-verification.md
        ↓
    Human Observation     (View 에서 설계 언어 그대로 관측)
```

한 번의 Agent 호출은 **한 Package 의 한 단계**만 수행한다. 단계를 건너뛰거나 합치지 않는다.

## 2. Package — 작업 단위

작업 단위는 Design-Workflow.md §19 의 Implementation Package 다.
하나의 Package = 하나의 Intent 를 `State → Rule → Transition → Observable` 로 닫는 것.

디렉토리 구조:

```text
workflow/packages/<PKG-ID>/
├── PACKAGE.md            # 헤더: 추적 ID, 상태, 단계 로그 (모든 단계가 읽고 갱신)
├── 10-intent.md          # [1] Intent Agent 출력
├── 20-world.md           # [2] World Model Agent 출력 (State / Rule / Observable / View 계약)
├── 30-review.md          # 인간 Semantic Review 기록 (인간만 승인 가능)
├── 40-implementation.md  # [3] Implementation Agent 보고 (코드 맵, Gap Proposal)
└── 50-verification.md    # [4] Verification Agent 판정 (Closure 2종 + Runtime Scenario 증거)
```

템플릿: [templates/](templates/) — 각 단계는 자기 템플릿을 복사해 채운다.

## 3. Package 상태 기계

`PACKAGE.md` 의 `Status` 필드가 진본이다.

```text
DRAFT → INTENT_READY → WORLD_READY → REVIEWED → IMPLEMENTED → VERIFIED
                                        ↑
                              (인간만 이 전이를 만든다)
```

| 전이 | 만드는 주체 | 조건 |
|---|---|---|
| DRAFT → INTENT_READY | Intent Agent | 10-intent.md 완성, Graph 추적 ID 연결 |
| INTENT_READY → WORLD_READY | World Model Agent | 20-world.md 완성, Intent 의 모든 의미가 State/Rule 로 매핑 |
| WORLD_READY → REVIEWED | **인간** | 30-review.md 에 승인 기록 |
| REVIEWED → IMPLEMENTED | Implementation Agent | 코드 + 40-implementation.md, §24 완료 체크리스트 자체 통과 |
| IMPLEMENTED → VERIFIED | Verification Agent | Semantic Closure + Observable Closure + Runtime Scenario 통과 |

**게이트 규칙**: 각 Agent 는 시작 전에 `PACKAGE.md` 의 Status 를 확인하고,
자기 단계의 선행 상태가 아니면 **작업하지 않고 중단**한 뒤 사용자에게 알린다.
특히 Implementation Agent 는 `REVIEWED` 가 아니면 절대 코드를 작성하지 않는다.

## 4. ID 규칙

| 접두어 | 의미 | 정의 위치 |
|---|---|---|
| `GOAL-*` | Goal 노드 | design/graphs/ |
| `POSS-*` | Possibility 노드 | design/graphs/ |
| `INTENT-*` | Intent | 10-intent.md |
| `RULE-*` | World Rule | 20-world.md |
| `OBS-*` | Observable 계약 | 20-world.md |
| `PKG-*` | Package | workflow/packages/ |

형식: `<접두어>-<도메인>-<3자리>` — 예: `GOAL-RESOURCE-001`, `INTENT-MINING-001`, `PKG-MINING-001`.
모든 하위 산출물은 상위 ID 를 명시적으로 참조한다 (Goal → Possibility → Intent → Rule → Transition 추적 사슬, §27).

## 5. Graph — Human Design 입력

Goal/Possibility Graph 는 `design/graphs/<도메인>.md` 에 도메인별로 나눠 작성한다.
형식은 [templates/graph.md](templates/graph.md).

- Graph 는 **인간만 수정한다**. 어떤 Agent 도 노드를 추가/삭제/의미 변경할 수 없다.
- Agent 가 Graph 의 부족함을 발견하면 Gap Proposal (§23 형식) 을 제출할 뿐이다.

## 6. 각 단계가 읽는 것 (읽기 범위 통제)

토큰 효율과 의미 오염 방지를 위해 각 단계는 아래 범위만 읽는다.

| 단계 | 읽는 것 | 읽지 않는 것 |
|---|---|---|
| Intent | 대상 Graph 파일, PACKAGE.md | Design-Concept.md 전체, 코드 |
| World Model | 10-intent.md, PACKAGE.md, 기존 다른 Package 의 20-world.md (State/Rule 재사용 확인) | Graph 원문 전체, 코드 상세 |
| Implementation | PACKAGE.md, 10-intent.md, 20-world.md, 30-review.md, 관련 코드 | Graph, Design 문서 |
| Verification | Package 전체 + 구현 코드 + 실행 결과 | Design 문서 전체 |

설계 문서의 특정 절이 꼭 필요하면 해당 절만 부분 읽기한다 (섹션 번호로 Grep).

## 7. 상시 불변 원칙 (모든 단계 공통)

Design-Workflow.md §30 의 8 Rule 요약 — 어느 단계에서든 위반이 보이면 작업을 멈추고 보고한다.

1. Goal/Possibility Graph 가 게임 의도의 Source of Truth 다.
2. Intent 는 Graph 에서 추출하며 Implementation Agent 가 임의로 변경하지 않는다.
3. Intent 의 모든 의미는 World State 또는 World Rule 로 표현되어야 한다.
4. 세계의 의미 있는 상태 변화는 World Rule 에 의해서만 발생한다.
5. Rule 의 판단·결과에 관계되는 의미적 상태는 Observable 해야 한다.
6. View 는 World 내부 구현이 아니라 Observable World State 만 읽는다.
7. 정적 Graph 와 동적 Runtime 상태는 동일한 설계 언어로 함께 관찰 가능해야 한다.
8. 설계적으로 의미 있는 상태가 관측되지 않는 기능은 구현 완료가 아니다.
