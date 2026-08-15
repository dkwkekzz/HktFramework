# Overlay & Frontier Stage Guide (M2)

## Role

Master Graph 와 **현재 실제 구현** 을 겹쳐, 지금 무엇이 되고 무엇이 막혀 있는지를 판정하고,
Human 이 다음 Cycle Goal 을 고를 수 있는 Frontier 후보를 만든다.

**Agent 는 후보를 만들 뿐 개발 우선순위를 확정하지 않는다** (Policy §25 · §28 Step 10).

## Input

- `master/graph/` 전체
- 현재 구현 — `world/` `view/` `protocol/`
- 완료된 Cycle 의 `01-cycle.md` GOAL 과 `08-verification.md` STATUS
- 직전 `master/frontier.md` (있으면 — 무엇이 이미 후보였는지)

## Do

Policy §28 의 Step 8~9 다.

1. **Overlay 판정** — `capabilities.yaml` 의 각 Capability 가 지금 어느 상태인지 실제 코드로 확인한다.

   ```text
   IMPLEMENTED  플레이로 확인된다        근거 Cycle + 구현 위치를 인용한다
   PARTIAL      일부만 된다              무엇이 아직 아닌지를 note 에 적는다
   MISSING      세계에 없다              cycles / where 를 비운다
   ```

   상태가 실제와 다르면 여기서 고친다. **근거 없는 IMPLEMENTED 는 검사 실패다.**

2. `npm run master` 로 Overlay · 막힌 Possibility · Frontier 재료를 관찰한다.
3. **Frontier 후보 생성** — 아직 없는 Capability 중 Policy §26 다섯 조건을 만족하는 것을 고른다.

   ```text
   1. 지금 세계에서 완전히 제공되지 않는다
   2. 하나 이상의 상위 Goal / Possibility 를 실제로 전진시킨다
   3. Client 에서 직접 플레이해 결과를 확인할 수 있다
   4. 한 Cycle 안에서 의미적으로 닫을 수 있는 크기다
   5. 단순 구현 Task 가 아니라 새로운 World / Game Capability 다
   ```

4. 각 후보를 **플레이어가 할 수 있는 한 문장** 으로 쓴다 — 시스템 이름으로 쓰지 않는다.
5. 후보마다 무엇이 열리는지(Serves) · 크기 판단 · 선행 조건 · 주의를 적는다.
6. 열린 GAP 이 있으면 끝에 기록한다.

## Output

`master/frontier.md`

항목: `지금 세계가 할 수 있는 것` · `지금 막혀 있는 것` · `F-0xx 후보들` ·
`Agent 의견(참고)` · `열린 MASTER GAP`

## Must

- Overlay 판정은 **실제 코드를 보고** 한다 — 그래프에 적힌 값을 그대로 믿지 않는다.
- 후보 Goal 은 플레이 문장으로 쓴다.

  ```text
  BAD   Knowledge System 구현
  GOOD  Player 가 어떤 사실을 알기 전에는 걸 수 없던 행동을 알고 난 뒤 걸 수 있다
  ```

- 후보마다 어떤 상위 Possibility 를 여는지 그래프 Id 로 추적 가능하게 적는다.
- 선행 관계가 있으면 명시한다 (`F-002 는 F-001 이 먼저다`).
- 우선순위 의견을 낼 때는 그것이 **의견이며 결정이 아님** 을 표시한다.

## Must Not

- Cycle Goal 을 스스로 확정하지 않는다.
- 후보를 구현 계획(파일 · 클래스 · 함수)으로 적지 않는다.
- 한 후보에 여러 개의 독립된 플레이 경험을 묶지 않는다.
- Overlay 상태를 근거 없이 올리지 않는다 — "될 것 같다" 는 IMPLEMENTED 가 아니다.

## Done When

- 모든 Capability 의 상태가 실제 구현과 일치한다.
- `npm run master:check` 가 PASS 다.
- 후보마다 §26 다섯 조건에 답할 수 있다.
- Human 이 `frontier.md` 만 읽고 다음 Cycle 을 고를 수 있다.

## 이후

Human 이 후보 하나를 고르면 Master 층의 역할은 끝난다.
그 문장을 Cycle Goal 로 `advprotoh-cycle` 스킬의 Stage 1 이 받는다.
`01-cycle.md` 에 `MASTER TRACE` 를 남길 수 있으나 **선택 항목** 이다 (Policy §48.1).
