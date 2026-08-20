# Master Frontier Guide (NEXT)

## Role

NEED 가 판정한 Missing / Partial Capability 중 **한 Cycle 안에서 닫히는 플레이 가능한
단위**를 Frontier(FR-*) 후보로 만든다. 이것이 다음 Cycle Goal 의 후보다.
선택은 Human 이 한다 (Human Select → 기존 8 Stage Cycle).

## Input

- `master/overlay.md`
- `master/graph/possibilities.yaml` · `capabilities.yaml`
- `master/constraints/` — Active Constraint (Filter)
- `master/frontier.md` — 기존 후보 (닫힌 Cycle 의 선택 기록은 `master/HISTORY.md`)

## Do

1. `overlay.md` 의 MISSING / PARTIAL 항목에서 시작한다.
2. 각 후보를 **플레이 결과 한 문장**으로 쓴다 — 기능 이름이 아니다.

```text
BAD    Perfect Guard 시스템 구현
GOOD   Player 가 적의 공격 직전에 Guard 하여 피해를 받지 않고 상대를 노출시킬 수 있다
```

3. 7 조건으로 검사한다 (정책 §8).

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

5. 각 후보에 Source Goal / Possibility / Missing Capability / Active Constraints /
   Constraint Evaluation / Observable Result / Why one Cycle 을 적는다.
6. 크면 쪼갠다 — 경계 칸이 두 개념을 담고 있으면 그것이 쪼갤 자리다.
   쪼갤 수 없으면 그 사유를 적고 Human 판단으로 넘긴다.
7. 후보 사이의 의존(A 없이 B 를 하면 무엇이 되는가)을 적는다.
8. 추천 순서와 근거를 제시한다 — **확정하지 않는다.**

## Output

`master/frontier.md`

형식은 `master/SCHEMA.md` 가 단일 출처다. 이 파일에 담는 것은 **후보 · 추천 순서 ·
SELECTED · 지금 열 수 없는 것** 네 절뿐이다 — 진행 현황(사다리가 어디까지 섰는가)은
`graph/GRAPH.md` 의 척추 절이, 후보를 읽는 법과 작성 규칙은 이 Guide 가 소유한다.
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
- 7 조건 판정 결과를 남긴다.
- Constraint Evaluation 을 명시한다.
- 상위 Goal / Possibility 로 역추적 가능하게 한다.

## Must Not

- `VIOLATED` 후보를 후보 목록에 올리지 않는다 — Design Conflict 로 Human 에게 따로 제시한다.
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
