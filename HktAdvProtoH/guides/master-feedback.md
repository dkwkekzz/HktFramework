# Master Feedback Stage Guide  (MF)

## Role

닫힌 Cycle 의 결과를 Master Layer 에 되돌린다.
Cycle 은 **보고**까지 하고, 반영은 이 단계가 한다.

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

2. **Frontier 정리** — 소진된 후보를 닫고, Cycle 결과로 새로 열린/닫힌 후보를 반영한다.
   선택 기록 표에 Cycle ID 를 남긴다.
3. **Constraint Evaluation 기록** — Constraint 가 실제 구현 형태에 영향을 주었다면
   해당 Capability/Possibility 의 `constraint_evaluation` 을 판정 결과로 갱신한다.
   영향이 없었다면 남기지 않는다 (무차별 Edge 금지).
4. **Constraint Candidate 접수** — Cycle 이 보고한 반복 패턴을 `candidates/CC-*.md` 로 만든다.
   승격 조건 4항을 검사하고 `HUMAN DECISION: PENDING` 으로 둔다.
5. **Master Gap 처리** — Cycle 이 `MASTER GAP` 을 보고했다면 Graph 를 임의로 고치지 않고
   Conflict · Affected Nodes · Trade-off · Expected Consequences 로 Human 에게 제시한다.
6. Cycle 이 Graph 에 없던 Capability 를 만들었다면 `capabilities.yaml` 에 추가하고,
   그것을 요구하는 Possibility 와 연결한다. 연결할 Possibility 가 없으면 그 사실을 남긴다 —
   **어떤 Possibility 도 요구하지 않는 Capability 는 설계 신호다.**

## Output

- `master/overlay.md` (갱신)
- `master/graph/capabilities.yaml` 의 `overlay` · `constraint_evaluation` (갱신)
- `master/frontier.md` (갱신)
- `master/candidates/CC-*.md` (있으면 신규)

## Must

- Overlay 승격 근거는 Cycle 의 **실측 기록**이다.
- 무엇이 이번에 바뀌었는지 `overlay.md` 의 `이번 갱신` 에 남긴다.
- Candidate 는 `PENDING` 으로 둔다.

## Must Not

- Cycle Artifact 를 수정하지 않는다 — History 다.
- Constraint 를 자동 승격하지 않는다.
- Constraint 충돌·Master Gap 을 임의로 해결하지 않는다.
- Cycle 이 보고하지 않은 것을 코드를 뒤져 추측으로 반영하지 않는다.
  근거가 필요하면 Overlay 단계(M3)로 정식 재판정한다.

## Done When

- 이번 Cycle 이 바꾼 Capability 상태가 Overlay 에 반영되어 있다.
- Frontier 의 소진/신규가 정리되어 있다.
- 제출된 Candidate 와 Gap 이 Human 결정 대기 상태로 노출되어 있다.
- 다음 M2/M4 실행이 이 상태만 보고 이어질 수 있다.
