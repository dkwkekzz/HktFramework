# Master Feedback Guide

## Role

닫힌 Cycle 의 결과를 Master Layer 에 되돌린다 — 두 층의 위쪽 접합점이다 (정책 §12.2).
Cycle 은 **보고**까지 하고, 반영은 이 작업이 한다.
기본 절차(WHY → OPTIONS → NEED → NEXT)의 단계가 아니며, 처리되지 않은
`MASTER FEEDBACK` 이 있으면 다른 Master 작업보다 먼저 돌린다.

## Where — 병합 뒤, 최신 main 위에서

이 작업은 공유 파일(`overlay.md` · `graph/capabilities.yaml`)을 고치므로 실행 위치가
정해져 있다. 트랙 브랜치 위에서 돌리면 병렬 갈래의 Feedback 끼리 병합이 사실을 고르는
일이 된다 (HISTORY — 한쪽 Overlay 통째 누락 사고).

```text
1. 그 Cycle 의 브랜치가 main 에 병합된 뒤에 시작한다.
2. 최신 main 을 가져온 위에서 돌리고, 끝나면 바로 push 한다.
3. 반영 안 된 닫힌 Cycle 이 여럿 밀려 있으면 한 실행이 배치로 처리해도 된다 —
   단 feedback/<CycleId>.md 는 Cycle 마다 따로 만든다.
```

시작 전에 `npm run feedback:gate` 를 돌린다 — ① 최신 main 위인가 ② 미처리
MASTER FEEDBACK 이 무엇인가를 기계적으로 검사한다 (`--pending` 은 목록만).

## Input

- `cycles/<CycleId>/08-verification.md` 의 `MASTER FEEDBACK`
- `master/overlay.md` · `graph/capabilities.yaml`
- `master/frontier/<트랙>.md` — 그 Cycle 이 속한 트랙 파일 (트랙은 Cycle ID 가 말한다)
- `master/constraints/` · `master/candidates/`

## Do

1. **Overlay 갱신** — 이번 Cycle 이 닫은 Capability 의 **노드 필드**를 바꾼다:
   `capabilities.yaml` 의 `overlay` · `overlay_evidence` · `overlay_gap`, 경로 요약이
   바뀌면 `possibilities.yaml` 의 `overlay_missing` · `overlay_note`, 세계 표가 바뀌면
   해당 노드의 `implemented` · `implemented_note`. 그리고 `npm run master:graph` 로
   `overlay.md` 를 재생성해 같은 커밋에 넣는다 — **overlay.md 는 생성물이다.**
   근거는 그 Cycle 의 `08-verification.md` 다. 실측 없이 승격하지 않는다.

```text
MC-PERFECT-GUARD   overlay: MISSING → IMPLEMENTED   overlay_evidence: C010 08-verification …
```

2. **Frontier 정리** — 소진된 후보를 **자기 트랙 파일**(`frontier/<트랙>.md`)에서 지우고,
   그 결과(어느 Cycle 로 닫혔는가 · 배운 것)를 `feedback/<CycleId>.md` 에 적는다.
   Cycle 결과로 새로 열린 후보를 같은 트랙 파일에 반영한다.
   다른 트랙 파일은 고치지 않는다 — 상대 트랙에 영향이 있으면 FR-ID 참조로
   `frontier/README.md` (트랙 간 판단)에만 남긴다.
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
7. **경위를 `feedback/<CycleId>.md` 로** — 무엇이 이번에 왜 바뀌었는지를 이 파일이
   소유한다 (형식은 `master/SCHEMA.md`). `HISTORY.md` 에는 쌓지 않는다 — 그쪽은
   Master 층 자체의 결정(닫힌 Q · Constraint 경위) 전용이다.

## Output

- `master/feedback/<CycleId>.md` (신규 — 이번 반영의 경위 전부)
- `master/graph/capabilities.yaml` 등 노드의 `overlay*` · `implemented*` ·
  `constraint_evaluation` (갱신) → 재생성된 `master/overlay.md` (같은 커밋)
- `master/frontier/<트랙>.md` (닫힌 후보 제거 · 새 후보 반영)
- `master/candidates/CC-*.md` (있으면 신규)

## Must

- Overlay 승격 근거는 Cycle 의 **실측 기록**이다.
- Cycle 이 닫히면 다음 Cycle 을 시작하기 전에 Feedback 을 돌린다. 밀리면 Overlay 가
  이미 채워진 Capability 를 결손으로 표시하고, 그 상태의 Frontier 는 "다음에 할 것이 없다"
  로 읽힌다 (C011·C012 에서 실제로 일어났다).
- 병합 뒤 최신 main 위에서 돌린다 (위 Where).
- 살아 있는 문서(`overlay.md` · `frontier/` · `open-questions.md`)에 닫힌 것을 쌓지 않는다.
- Frontier 후보의 키는 FR-ID 다 — 위치 번호를 매기지 않고, 후보가 줄어도
  남은 후보를 다시 매기지 않는다.
- Candidate 는 `PENDING` 으로 둔다.

## Must Not

- graph 노드에 근거·정정 경위·날짜 주석을 쌓지 않는다 — 노드에는 **값만** 둔다.
  근거는 `overlay.md`, 경위는 `feedback/<CycleId>.md` 소유다 (SCHEMA · CLAUDE.md 원칙 20).
- 자기 Cycle 의 트랙 밖 `frontier/` 파일을 수정하지 않는다.
- `feedback/` 의 기존 파일을 수정하지 않는다 — 보관소다.
- Cycle Artifact 를 수정하지 않는다 — History 다.
- Constraint 를 자동 승격하지 않는다.
- Constraint 충돌·Master Gap 을 임의로 해결하지 않는다.
- Cycle 이 보고하지 않은 것을 코드를 뒤져 추측으로 반영하지 않는다.
  근거가 필요하면 NEED 단계(Overlay 재판정)로 정식 재판정한다.

## Done When

- 이번 Cycle 이 바꾼 Capability 상태가 Overlay 에 반영되어 있다.
- 자기 트랙 Frontier 의 소진/신규가 정리되어 있다.
- `feedback/<CycleId>.md` 가 이번 반영의 경위를 담고 있다.
- 제출된 Candidate 와 Gap 이 Human 결정 대기 상태로 노출되어 있다.
- 다음 WHY → OPTIONS → NEED → NEXT 실행이 이 상태만 보고 이어질 수 있다.
