# Master Graph Guide (WHY · OPTIONS · NEED)

## Role

기본 4단계 중 Graph 를 만드는 부분을 담당한다.
NEXT 는 `master-frontier.md` 가 잇는다. Overlay 판정은 단계가 아니라 Feedback·Inject 의
절차다 — 기준은 `master/SCHEMA.md` "모든 Node 공통".

```text
WHY       누가 무엇을 왜 원하는가            → MW / MA / (필요시 MK·MB) / MG
OPTIONS   같은 Goal 의 의미 있게 다른 방법    → MP (OR)
NEED      각 Possibility 에 필요한 것        → Requirement (AND) · MC
```

## Input

`root.md` · `constraints/`(Active DC — Filter) · 기존 `graph/`(중복 검사) · 확장 대상

## Do

1. **WHY** — Goal Owner(MA)·왜(motivation / caused_by)·무엇이 달라지기를(desired_state).
   Knowledge / Belief 는 실제로 필요할 때만 만든다 (정책 §5).
2. **OPTIONS** — 같은 Goal 을 다르게 달성하는 Possibility 를 폭으로 탐색한다.
   Gameplay / Cost / Risk / Relationship / Consequence 중 하나 이상이 실질적으로 달라야
   대안이다 — 동의어는 대안이 아니다. Active DC 로 걸러 명백한 `VIOLATED` 는
   정상 경로에서 제거한다 (정책 §6).
3. **NEED** — 각 Possibility 의 Requirement 를 필요한 것만 기록한다.
   재사용 가능한 플레이 의미는 MC-* 로 세운다. `semantic` 에 이유를 쓰지 않는다 —
   상위 Goal/Possibility 경로가 설명한다 (정책 §7).
   각 MC-* 에 `part_of`(grounded + memberships)를 적는다 — 노드가 목록으로
   뽑혀도 어느 시스템의 조각인지 보이게 한다. 시스템·자리의 단일 출처는
   `graph/systems.yaml` 이며 새 시스템 등록은 근거 문서가 이미 가진 구조만 (SCHEMA).
4. 새 Node 전에 기존 Registry 를 검색한다. 보조 규칙(Conflict / Consequence /
   Reveal / Reframe / CC)은 실제 결정에 영향을 줄 때만 쓴다 (정책 §11).

## Output

`master/graph/*.yaml` (+ `edges.yaml` · 발견 시 `candidates/CC-*.md`) — 형식은 `master/SCHEMA.md`

## Must

- 근거 문서가 다음 층으로 **예고한 것**은 그 층이 열리기 전에 노드로 세워 둔다.
  Graph 에 노드가 없으면 Overlay 의 결손 목록에도, Frontier 후보에도 나타나지 못한다
  (Penetration 이 그랬다 — 설계가 지정한 다음 층인데 후보가 될 길이 없었다).
- 노드의 의미는 근거 문서의 문장에서만 가져온다. 문서가 이름만 댄 층은 이름과 작용
  지점까지만 적고 `part_of.grounded: false` 로 표시한다 — 그 노드의 semantic 은
  잠정이며, 그 전체의 설계 문서가 서면 개정한다. 세부를 지어 채우지 않는다.

## Must Not

- 숫자를 맞추려 억지 Possibility 를 만들지 않는다.
- `UNRESOLVED` 를 `SATISFIED` 로 간주하지 않는다.
- 수치·공식·구현 모듈명을 Graph 에 쓰지 않는다.
- Constraint 에서 Capability 목록을 도출하지 않는다 — 필요성은 Possibility 에서 온다.
- 같은 Goal/Capability 를 이름만 바꿔 복제하지 않는다.

## Done When

- 정책 §15 의 WHY · OPTIONS · NEED Quality Gate 가 참이다.
- 각 Capability 가 왜 필요한지 Goal/Possibility 경로로 역추적된다.
- Constraint 가 어떤 후보를 걸러냈는지 기록에서 보인다.
