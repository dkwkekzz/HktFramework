# design/graph/ — Human Design (Stage 0)

**Goal Graph 와 Possibility Graph 의 Source of Truth** 다. 게임 디자이너(인간)가 작성한다.

Agent 는 이 폴더를 **읽기만** 한다. Goal 추가·삭제·의미 변경은 구현 변경이 아니라 **Design Change** 이며,
Agent 는 그것을 수행하지 않고 `artifacts/design-gaps/GAP-*.md` 로 제안만 한다.

Stage 1 Intent Agent 는 이 폴더 전체가 아니라 **작업 대상 subset 파일 하나**만 읽는다.
따라서 도메인 단위로 파일을 쪼갠다.

```
design/graph/
├── README.md
└── <domain>.md        예) resource.md, survival.md, craft.md
```

## 파일 양식

```markdown
# GRAPH-<DOMAIN>

## GOAL-<DOMAIN>-<NAME>
설명: <이 목적이 세계에서 무엇이 참이기를 원하는가 — 상태로 표현한다>
상위 목적: <GOAL-... 또는 없음>

가능성:
- POSSIBILITY-<NAME>
- POSSIBILITY-<NAME>

## POSSIBILITY-<NAME>
설명: <이 가능성이 목적을 어떻게 달성하는가>
요구 조건:
- <조건> → 미충족 시 GOAL-<...> 로 이어짐
```

## 예시 (형식 참고용 — 실제 설계 아님)

```
AcquireStone
│
├─ PickUpStone
├─ MineStone      →  Requires Pickaxe  →  AcquirePickaxe
├─ BuyStone
└─ ReceiveStone
```

Possibility 내부에서 다시 Goal 로 이어질 수 있다. 이 재귀가 계획 탐색의 근거다.

## 규칙

- 목적은 **행동이 아니라 상태**로 쓴다. (`돌을 캔다` ✗ / `돌을 보유한 상태` ○)
- 하나의 목적에는 **여러 가능성**이 달릴 수 있어야 한다. 가능성이 하나뿐이면 그것은 목적이 아니라 행동일 수 있다.
- 그래프에 없는 목적은 Runtime 에 자동으로 생기지 않는다.
- 개념 정의가 흔들리면 `design/Design-Concept.md` §6~§8 을 본다 (절 지도:
  `.claude/skills/observable-world-workflow/references/world-semantics-source.md`).
