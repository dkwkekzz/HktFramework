# Cycle Definition Stage Guide

## Role

이번 Cycle 에서 **새롭게 가능해질 플레이 경험**을 하나로 고정한다.

## Input

- **선택된 Frontier** (`master/frontier/<트랙>.md` 의 `SELECTED` 항목) — 있으면 이것이 Goal 의 출처다
- Human Cycle Goal
- 관련 Existing Capability (있으면 — 기존 `cycles/`, `world/`, `view/`)

## Do

1. Cycle ID 와 이름을 정한다 — `C-<TRACK>-NNN-<이름>` (`C-ITEM-001-one-slot-one-item`).
   **트랙은 선택된 Frontier 가 사는 파일이 정한다** (`frontier/item.md` → `ITEM`).
   번호는 `cycles/` 에서 자기 트랙 접두사의 최대 +1 — 한 트랙은 동시에 한 세션만
   돌므로(frontier/README.md 병렬 규칙) 이 번호는 충돌할 수 없다. 다른 트랙의 번호를
   보지 않는다. Frontier 없이 시작한 Cycle 은 도메인에 맞는 트랙 이름을 쓰고 사유를 적는다.
   `C001`~`C023` 은 트랙 도입 전의 옛 번호공간이다 — 세지 않는다.
2. **MASTER TRACE 를 옮긴다** — 선택된 Frontier 의 Source Goal / Possibility /
   Target Capability / Active Constraints 를 그대로 기록한다.
   Frontier 에서 출발하지 않았다면 `없음` + 사유를 적는다.
3. Cycle Type 을 판정한다 — `New Capability` / `Existing Capability Enhancement`.
4. Goal 을 **플레이어가 게임 안에서 할 수 있는 한 문장**으로 쓴다.
   Frontier 가 있으면 그 Playable Result 가 Goal 의 기준이다.
5. Included / Excluded 를 나눈다. Excluded 는 "이번엔 안 한다"를 명시적으로 박는다.
6. 관련 Existing Capability 를 나열한다 (재사용 대상 · 영향 가능 대상).

## Output

`cycles/<CycleId>/01-cycle.md`

항목: `CYCLE` · `MASTER TRACE` · `TYPE` · `TARGET CAPABILITY` · `GOAL` · `INCLUDED` ·
`EXCLUDED` · `RELATED EXISTING CAPABILITY` + 최상단 Stage 상태 블록

형식과 작성 예시는 `advprotoh-cycle` 스킬의 `references/artifact-format.md` 가 단일 출처다.

## Must

- Goal 은 Cycle 종료 시 실제 Client 에서 **플레이로 확인 가능**해야 한다.
- Goal 은 작아야 한다. 한 Cycle = 하나의 플레이 가능한 Delta.
- 기존 Capability 를 다시 만들지 않고 재사용/확장으로 기술한다.
- MASTER TRACE 를 비워 두지 않는다 — 없으면 `없음` + 사유다.

## Must Not

- 클래스·모듈·파일·라이브러리·화면 구성 등 구현 방법을 정하지 않는다.
- "시스템을 만든다" 같은 기능 나열로 Goal 을 쓰지 않는다.
- 여러 개의 독립된 플레이 경험을 한 Cycle 에 묶지 않는다.
- 상위 Goal / Possibility / Capability / Constraint 의 의미를 여기서 바꾸지 않는다 —
  어긋나면 `MASTER GAP` 으로 Master Layer(Human)에 반환한다.
- Master Graph 를 이 단계에서 확장하지 않는다.

## Done When

- Goal 한 문장을 읽고 "이번 Cycle 이 끝나면 무엇을 플레이할 수 있는가"에 답할 수 있다.
- Included / Excluded 경계가 모호하지 않다.
- 이 Cycle 이 기존 것을 재사용하는지 변경하는지가 드러나 있다.
- 이 Cycle Goal 이 왜 지금 필요한지가 MASTER TRACE 로 역추적된다 (또는 사유가 적혀 있다).
