# Master Frontier Guide (NEXT)

## Role

NEED 가 판정한 Missing / Partial Capability 중 **한 Cycle 안에서 닫히는 플레이 가능한
단위**를 Frontier(FR-*) 후보로 만든다. 이것이 다음 Cycle Goal 의 후보다.
선택은 Human 이 한다 (Human Select → 기존 8 Stage Cycle).

## Input

- `master/overlay.md`
- `master/graph/possibilities.yaml` · `capabilities.yaml`
- `master/constraints/` — Active Constraint (Filter)
- `master/frontier.md` — 기존 후보와 선택 기록

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

4. 각 후보에 Source Goal / Possibility / Missing Capability / Active Constraints /
   Constraint Evaluation / Observable Result / Why one Cycle 을 적는다.
5. 크면 쪼갠다. 쪼갤 수 없으면 그 사유를 적고 Human 판단으로 넘긴다.
6. 추천 순서와 근거를 제시한다 — **확정하지 않는다.**

## Output

`master/frontier.md`

형식은 `master/SCHEMA.md` 가 단일 출처다.

## Handoff — Cycle Layer 로

Human 이 하나를 `SELECTED` 로 정하면 그것이 Cycle Definition 의 입력이 된다 (정책 §12.1).
`01-cycle.md` 의 `MASTER TRACE` 에 다음이 그대로 옮겨진다.

```text
Frontier · Source Goal · Source Possibility · Target Capability(overlay 상태) ·
Active Constraints · Constraint Note
```

Frontier 선택 이후는 **기존 8 Stage Cycle Workflow 를 변경 없이** 사용한다.

## Must

- Playable Result 를 플레이어 관점 한 문장으로 쓴다.
- 7 조건 판정 결과를 남긴다.
- Constraint Evaluation 을 명시한다.
- 상위 Goal / Possibility 로 역추적 가능하게 한다.

## Must Not

- `VIOLATED` 후보를 후보 목록에 올리지 않는다 — Design Conflict 로 Human 에게 따로 제시한다.
- 개발 우선순위를 자동 확정하지 않는다.
- Cycle 의 구현 방법·State 이름·수치를 Frontier 에 적지 않는다.
- Graph 의 절대 Leaf 를 찾지 않는다 — 기준은 언제나 **현재 세계**다.

## Done When

- 정책 §15 NEXT Quality Gate 가 후보마다 참이다 —
  상위 Goal/Possibility 전진 / Client 플레이 가능 / 한 Cycle 검증 가능 /
  코드 Task 아님 / Constraint 양립 / 재사용 Capability 로 누적.
- 각 후보 한 문장을 읽고 "이번 Cycle 이 끝나면 무엇을 플레이할 수 있는가"에 답할 수 있다.
- Human 이 근거를 보고 하나를 고를 수 있는 상태다.
