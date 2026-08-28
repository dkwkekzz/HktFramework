# Master Frontier Guide (NEXT)

## Role

NEED 가 판정한 Missing / Partial Capability 중 **한 Cycle 안에서 닫히는 플레이 가능한
단위**를 Frontier(FR-*) 후보로 만든다. 이것이 다음 Cycle Goal 의 후보다.
선택은 Human 이 한다 (Human Select → 기존 8 Stage Cycle).

## Input

- `master/overlay.md`
- `master/graph/possibilities.yaml` · `capabilities.yaml`
- `master/constraints/` — Active Constraint (Filter)
- `master/frontier/` — 트랙 인덱스(README.md)와 대상 트랙 파일의 기존 후보
  (닫힌 후보의 결과는 `master/feedback/<CycleId>.md`)

## 트랙 — 후보가 사는 곳

Frontier 는 트랙별 파일이다. 트랙은 세션이 아니라 **도메인**이다 — 근거 문서 영역과
`graph/systems.yaml` 의 시스템 축이 경계를 긋는다.

```text
후보 하나 = 한 트랙 파일        frontier/<트랙>.md 에만 산다. 두 파일에 두지 않는다
트랙 간 의존 = FR-ID 참조       상대 트랙 후보를 복사·흡수·수정하지 않는다
트랙 간 우선순위 = README 소유   트랙 안의 추천 순서는 트랙 파일, 트랙 사이의 판단은
                               frontier/README.md — 이 인덱스는 NEXT 작업만 고친다
새 트랙 신설·후보의 트랙 이동    NEXT 작업(직렬)만 한다. 새 도메인이 주입되면 새 트랙 파일을
                               만들고 README 의 트랙 표에 등록한다
키는 FR-ID                     위치 번호(1..N)를 매기지 않는다 — 후보가 줄어도 재번호가
                               없어야 병렬 diff 가 충돌하지 않는다
SELECTED 는 트랙별              "지금 도는 것"이 트랙마다 하나씩 있을 수 있다 —
                               한 트랙 = 동시에 한 세션 (frontier/README.md 병렬 규칙)
```

## Do

1. `overlay.md` 의 MISSING / PARTIAL 항목에서 시작한다.
2. 각 후보를 **플레이 결과 한 문장**으로 쓴다 — 기능 이름이 아니다.

```text
BAD    Perfect Guard 시스템 구현
GOOD   Player 가 적의 공격 직전에 Guard 하여 피해를 받지 않고 상대를 노출시킬 수 있다
```

3. 7 조건으로 검사한다 (정책 §8). **기록은 약함·위반 항목만** — 전부 충족이면
   `전부 충족` 한 줄이다. 약한 칸을 감추지 않는 것이 이 기록의 목적이지,
   일곱 칸을 다시 서술하는 것이 아니다.

```text
1. MISSING 이거나 필요한 수준에 못 미치는 PARTIAL 인가
2. 하나 이상의 상위 Goal/Possibility 를 실제로 전진시키는가
3. Client 에서 직접 플레이하고 결과를 확인할 수 있는가
4. 하나의 Cycle 안에서 의미적으로 폐쇄 가능한가
5. 단순 코드 Task 가 아니라 새로운 World/Game Capability 인가
6. Active Constraint 와 양립하는가
7. 완료 후 공유 World 에 재사용 가능한 Capability 로 누적되는가
```

4. 각 후보를 **세계가 갖게 되는 개념 하나**로 세우고 넷을 함께 적는다.
   이 넷이 없으면 후보는 "여러 구현 중 하나를 임의로 고른 것" 으로 읽힌다.

```text
이것이 무엇인가    세계에 추가되는 개념 한 문장
세계에 생기는 것    그 개념이 요구하는 상태 · 규칙 · 관찰 (구현 이름이 아니라 의미로)
이 기능이 아닌 것    경계 — 이 개념에 속하지 않는 것. 여기가 비면 후보가 아니라 소원이다
이미 있는 것        재사용하는 것. 여기가 크면 그 후보는 작다
```

   `이미 있는 것` 은 근거 문서가 아니라 **코드 대조**로 채운다. 그러지 않으면 이미
   세계에 있는 개념을 없다고 적은 채 Cycle 로 내려간다 (HISTORY — "행동" 정정).

   경계 칸이 핵심이다. 같은 장면을 만드는 방법은 여럿이지만 **개념의 경계**가 정해지면
   그 안에서 어떻게 만들든 같은 것이 된다.

5. 나머지는 후보의 `Trace`(Source Goal / Possibility / Target Capability / 원본 근거) ·
   `Constraints`(Eval 은 형태를 실제로 좁힐 때만) · `결과`(Playable / Observable) ·
   `판정`(한 Cycle 사유 · 7조건 · 의존 · Status) 네 칸에 담는다 —
   형식은 `master/SCHEMA.md` 의 후보 골격이 단일 출처다.
6. 크면 쪼갠다 — 경계 칸이 두 개념을 담고 있으면 그것이 쪼갤 자리다.
   쪼갤 수 없으면 그 사유를 적고 Human 판단으로 넘긴다.
7. 추천 순서는 **한눈에 보기 표 하나**로 제시한다 — 순위 열 + 사유 한 줄.
   별도 다이어그램·후보별 추천 산문을 두지 않으며, **확정하지 않는다.**

## Output

`master/frontier/<트랙>.md` (+ 트랙 간 판단이 바뀌면 `master/frontier/README.md`)

형식은 `master/SCHEMA.md` 가 단일 출처다. 트랙 파일에 담는 것은 **후보 · 추천 순서 ·
SELECTED · 지금 열 수 없는 것** 네 절뿐이다 — 진행 현황(사다리가 어디까지 섰는가)은
`graph/GRAPH.md` 의 척추 절이, 후보를 읽는 법과 작성 규칙은 이 Guide 가,
트랙 목록·병렬 규칙·트랙 밖 결손은 `frontier/README.md` 가 소유한다.
frontier 에 현황 서술·공정 규칙을 다시 쌓지 않는다.

## Handoff — Cycle Layer 로

Human 이 하나를 `SELECTED` 로 정하면 그것이 Cycle Definition 의 입력이 된다 (정책 §12.1).
`01-cycle.md` 의 `MASTER TRACE` 에 다음이 그대로 옮겨진다.

```text
Frontier · Source Goal · Source Possibility · Target Capability(overlay 상태) ·
Active Constraints · Constraint Note
```

Frontier 선택 이후는 **기존 8 Stage Cycle Workflow 를 변경 없이** 사용한다.

## Must

- 후보 하나 = 세계가 갖게 되는 개념 하나. **경계(이 기능이 아닌 것)를 반드시 적는다.**
- Playable Result 를 플레이어 관점 한 문장으로 쓴다.
- 7 조건은 약함·위반 항목만 남긴다 (없으면 `전부 충족`).
- Constraint Eval 은 Constraint 가 후보의 형태를 실제로 좁힐 때만 한 줄로 적는다.
- 상위 Goal / Possibility 로 역추적 가능하게 한다.
- 후보의 키는 FR-ID 다 — 위치 번호를 매기지 않는다.

## Must Not

- `VIOLATED` 후보를 후보 목록에 올리지 않는다 — Design Conflict 로 Human 에게 따로 제시한다.
- 다른 세션이 돌고 있는 트랙의 파일을 고치지 않는다 — 트랙 이동·트랙 간 판단은
  README 인덱스로, 직렬 NEXT 작업에서만.
- `part_of.grounded: false` 인 Capability 를 후보의 Target 으로 세우지 않는다 —
  그 전체의 설계 문서가 먼저다. "지금 열 수 없는 것" 에 그 사유로 적는다.
- 개발 우선순위를 자동 확정하지 않는다.
- Cycle 의 구현 방법·State 이름·수치를 Frontier 에 적지 않는다.
- Graph 의 절대 Leaf 를 찾지 않는다 — 기준은 언제나 **현재 세계**다.

## Done When

- 정책 §15 NEXT Quality Gate 가 후보마다 참이다 —
  상위 Goal/Possibility 전진 / Client 플레이 가능 / 한 Cycle 검증 가능 /
  코드 Task 아님 / Constraint 양립 / 재사용 Capability 로 누적.
- 각 후보 한 문장을 읽고 "이번 Cycle 이 끝나면 무엇을 플레이할 수 있는가"에 답할 수 있다.
- Human 이 근거를 보고 하나를 고를 수 있는 상태다.
