# Master Feedback Guide

## Role

닫힌 Cycle 의 결과를 Master Layer 에 되돌린다 — 두 층의 위쪽 접합점이다 (정책 §12.2).
Cycle 은 **보고**까지 하고, 반영은 이 작업이 한다.
기본 절차(WHY → OPTIONS → NEED → NEXT)의 단계가 아니며, 처리되지 않은
`MASTER FEEDBACK` 이 있으면 다른 Master 작업보다 먼저 돌린다.

## Input

- `cycles/<CycleId>/08-verification.md` 의 `MASTER FEEDBACK`
- `master/overlay.md` · `graph/capabilities.yaml`
- `master/frontier.md`
- `master/constraints/` · `master/candidates/`

## Do

1. **Overlay 갱신** — 이번 Cycle 이 닫은 Capability 의 상태를 바꾼다.
   근거는 그 Cycle 의 `08-verification.md` 다. 실측 없이 승격하지 않는다.

```text
MC-PERFECT-GUARD   MISSING → IMPLEMENTED   근거 C010 08-verification
```

2. **Frontier 정리** — 소진된 후보를 `frontier.md` 에서 **지우고**, 그 결과(어느 Cycle 로
   닫혔는가 · 배운 것)를 `HISTORY.md` 에 적는다. Cycle 결과로 새로 열린 후보를 반영한다.
3. **Constraint Evaluation 기록** — Constraint 가 실제 구현 형태에 영향을 주었다면
   해당 Capability/Possibility 의 `constraint_evaluation` 을 판정 결과로 갱신한다.
   영향이 없었다면 남기지 않는다 (무차별 Edge 금지).
4. **Constraint Candidate 접수** — Cycle 이 보고한 반복 패턴을 `candidates/CC-*.md` 로 만든다.
   승격 조건 4항을 검사하고 `HUMAN DECISION: PENDING` 으로 둔다.
   `무엇을 말하는가 (예시)` 절은 **필수**다 — `master/SCHEMA.md` 의 "읽히게 쓴다"
   규칙 5항을 따른다. Human 이 승격 여부를 판단하려면 원칙 문장이 아니라
   **그 원칙을 어겼을 때 무슨 일이 나는지**를 읽어야 한다.
5. **Master Gap 처리** — Cycle 이 `MASTER GAP` 을 보고했다면 Graph 를 임의로 고치지 않고
   Conflict · Affected Nodes · Trade-off · Expected Consequences 로 Human 에게 제시한다.
6. Cycle 이 Graph 에 없던 Capability 를 만들었다면 `capabilities.yaml` 에 추가하고,
   그것을 요구하는 Possibility 와 연결한다. `part_of`(grounded + memberships —
   `graph/systems.yaml` 참조)도 함께 세운다. 연결할 Possibility 가 없으면 그 사실을 남긴다 —
   **어떤 Possibility 도 요구하지 않는 Capability 는 설계 신호다.**

## Output

- `master/overlay.md` (현재 상태 갱신)
- `master/graph/capabilities.yaml` 의 `overlay` · `constraint_evaluation` (갱신)
- `master/frontier.md` (닫힌 후보 제거 · 새 후보 반영)
- `master/HISTORY.md` (이번에 무엇이 왜 바뀌었는지 · 닫힌 후보의 결과)
- `master/candidates/CC-*.md` (있으면 신규)

## Must

- Overlay 승격 근거는 Cycle 의 **실측 기록**이다.
- Cycle 이 닫히면 다음 Cycle 을 시작하기 전에 Feedback 을 돌린다. 밀리면 Overlay 가
  이미 채워진 Capability 를 결손으로 표시하고, 그 상태의 Frontier 는 "다음에 할 것이 없다"
  로 읽힌다 (C011·C012 에서 실제로 일어났다).
- 무엇이 이번에 왜 바뀌었는지 `HISTORY.md` 에 남긴다 — `overlay.md` 에는 결과만 반영한다.
- 살아 있는 문서(`overlay.md` · `frontier.md` · `open-questions.md`)에 닫힌 것을 쌓지 않는다.
- Candidate 는 `PENDING` 으로 둔다.

## Must Not

- graph 노드에 근거·정정 경위·날짜 주석을 쌓지 않는다 — 노드에는 **값만** 둔다.
  근거는 `overlay.md`, 경위는 `HISTORY.md` 소유다 (SCHEMA · CLAUDE.md 원칙 20).
- Cycle Artifact 를 수정하지 않는다 — History 다.
- Constraint 를 자동 승격하지 않는다.
- Constraint 충돌·Master Gap 을 임의로 해결하지 않는다.
- Cycle 이 보고하지 않은 것을 코드를 뒤져 추측으로 반영하지 않는다.
  근거가 필요하면 NEED 단계(Overlay 재판정)로 정식 재판정한다.

## Done When

- 이번 Cycle 이 바꾼 Capability 상태가 Overlay 에 반영되어 있다.
- Frontier 의 소진/신규가 정리되어 있다.
- 제출된 Candidate 와 Gap 이 Human 결정 대기 상태로 노출되어 있다.
- 다음 WHY → OPTIONS → NEED → NEXT 실행이 이 상태만 보고 이어질 수 있다.
