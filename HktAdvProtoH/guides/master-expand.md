# Master Graph Expansion Stage Guide (M1)

## Role

Master Intent Graph 를 넓힌다 — 세계의 원인에서 출발해 누가 무엇을 왜 원하는지,
같은 목적에 이르는 다른 길이 무엇인지, 그 길들이 어떤 Capability 를 함께 쓰는지를 그린다.

**여기는 Cycle 이전이다.** 구현할 것을 정하지 않는다. 고를 수 있는 것을 늘린다.

## Input

- `master/graph/00-root.yaml` (World Premise · Root Goal · Design Constraint)
- 확장 대상 — 기존 Region 파일 또는 Human 이 준 새 Region 주제
- `master/graph/capabilities.yaml` (재사용 대상 확인)
- 경계 사례에서만 `design/Master-Intent-Graph-Policy.md` 의 해당 절

## Do

Policy §28 의 Step 1~7 이다.

1. **Owner 와 Motivation 확인** — 이 Goal 을 누가 왜 원하는가. 어떤 World State 가 그것을 만들었는가.
   답할 수 없으면 그것은 Goal 이 아니라 Capability 이거나 아직 미완성 Goal 이다.
2. **Possibility 를 폭으로 확장** — 의미가 서로 다른 3~6개를 탐색한다.
   `직접 · 싸움 · 탐색 · 경제 · 제작 · 협력 · 세력 · 조사 · 세계 조작 · 대체` 축을 훑는다.
3. **각 Possibility 의 Requirements 도출** — Capability · Knowledge · WorldState · Goal.
4. **기존 노드와 중복 검사** — 같은 의미면 새로 만들지 않고 참조한다.
5. **Actor Conflict 검사** — 이 선택이 누구의 목적을 돕고 누구를 막는가.
6. **Consequence 정의** — 성공하면 세계에서 무엇이 실제로 달라지는가.
7. **Reveal / Reframe / New Goal 검사** — 무엇을 새로 알게 되고 어떤 목적이 다시 생기는가.

마지막에 `npm run master:check` 를 돌린다. 위반이 있으면 닫힌 것이 아니다.

## Output

`master/graph/00-root.yaml` · `master/graph/R0xx-<name>.yaml` · `master/graph/capabilities.yaml`

파일 규격(필드 이름 · 필수 항목 · Id 접두)은
`advprotoh-master` 스킬의 `references/graph-format.md` 가 단일 출처다.

## Must

- 상위 Goal 은 Actor-owned 으로 쓴다 — owner · desired_state · motivation 이 반드시 있다.
- 하나의 Goal 에 대해 "방법이 하나뿐이다" 를 자동으로 가정하지 않는다.
- Capability 는 `capabilities.yaml` 에만 정의하고 Region 은 참조만 한다.
- 이미 있는 의미는 재사용한다 — 같은 것에 새 이름을 붙이지 않는다.
- 모든 Possibility 는 세계에서 무엇이 달라지는지(`changes`)를 가진다.
- 기존 Cycle 이 만든 Capability 는 실제 근거(Cycle ID + 구현 위치)로만 IMPLEMENTED 라고 쓴다.

## Must Not

- World State 이름 · 자료구조 · Rule · 화면 구성을 정하지 않는다 (Cycle 층의 책임이다).
- 저수준 재사용 능력을 Goal 로 만들지 않는다 (`걷는다` `줍는다` 는 Capability 다).
- Narrative 를 별도 노드나 별도 파일로 만들지 않는다 —
  원인 → 믿음 → 목적 → 선택 → 결과 → 앎의 연결이 곧 이야기다.
- Main Quest / Side Quest 같은 분류를 노드 type 으로 만들지 않는다.
- Root Goal 이나 Design Constraint 를 스스로 확정하지 않는다 — Human 소유다.
- 구현이 어렵다는 이유로 Possibility 를 지우지 않는다.

## Done When

- Policy §29 Goal Gate · §30 Possibility Gate · §31 Narrative Gate · §32 Reuse Gate 를 통과한다.
- `npm run master:check` 가 PASS 다.
- 확장한 Goal 마다 "이 목적에 이르는 실질적으로 다른 길" 이 무엇인지 그래프에서 읽힌다.
- 새로 만든 Capability 가 하나 이상의 Possibility 에서 요구된다.

## Gap

Root Goal · Design Constraint 가 없어 판단할 수 없으면 지어내지 않고 반환한다.

```text
MASTER GAP
Required   무엇을 표현해야 하는가
Missing    무엇이 없는가
Reason     왜 현재 입력으로 불가능한가
Return To  Human
```
