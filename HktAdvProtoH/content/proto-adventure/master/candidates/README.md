# candidates/ — 미승인 Constraint Candidate

파일 하나 = 후보 하나. 이름은 `CC-<NAME>.md`. 형식은 [../SCHEMA.md](../SCHEMA.md).

현재: **PENDING 19종** — 수와 상태의 단일 출처는 파일이다 (표는 색인 · 뒤에 선
후보 넷이 아직 무리 배정 전이다)

| 후보 | 출처 | 관찰 | 상태 |
|---|---|---|---|
| CC-THE-LIST-IS-THE-JUDGE-TOO | C-COMBAT-003 | 2회 (C018 선례 · C-COMBAT-003 위반 실측) | PENDING |
| CC-A-REASON-MUST-BE-TRUE | C-COMBAT-004 | 4회 판단 (C011 · C017 · C024 소급) · 위반 실측 1회 | PENDING |
| CC-RESOURCE-GATE-IS-ALL-OR-NOTHING | C011 | 2회 (C007 · C011) | PENDING |
| CC-THE-WORLD-NAMES-WHAT-IT-READ | C012 | 1회 (C012 · C010 은 전조) | PENDING |
| CC-THE-WORLD-OWNS-THE-RELATION | C013 | 1회 (C013 — 관계 형태는 처음) | PENDING |
| CC-THE-WORLD-NAMES-WHAT-IT-WITHHELD | C014 | 1회 (C014 · C011 은 전조) | PENDING |
| CC-A-NEW-WAY-OF-KNOWING-IS-NOT-A-GATE | C016 | **2회** (C014 · C016) | PENDING |
| CC-THE-CHOICE-IS-THE-OBSERVERS-OWN | C017 | **3회** (C004 · C014 · C017) | PENDING |
| CC-A-GATE-MOVES-WITH-ITS-MEANING | C017 | 1회 (C017 · C014 는 전조) | PENDING |
| CC-REASONS-ARE-A-LIST-NOT-A-BRANCH | C018 | 1회 (C018 — Cycle 이 보류를 권했다) | PENDING |
| CC-THE-WORLD-JUDGES-THE-MOMENT | C019 | **2회** (C012 · C019) | PENDING |
| CC-A-COST-MUST-LEAVE-A-WINDOW | C020 | **2회** (C019 · C020) | PENDING |
| CC-NO-SELF-INFLICTED-DEAD-END | C022 | **3회** (C011 · C019 · C022 — 앞의 둘은 값으로, C022 가 처음 규칙으로) | PENDING |
| CC-THE-EFFECTIVE-IS-DERIVED-NOT-STORED | C023 | **2회** (C022 자리 · C023 유효 값 — 둘째가 이유를 하나 더 댄다: 가역성) | PENDING |
| CC-THE-SURFACE-MUST-NOT-PROMISE-WHAT-THE-INPUT-CANNOT-DO | C023 | 2회 (C022 잘린 띠 · C023 거짓 키 안내 — 성격이 갈린다) | PENDING · **Constraint 가 아닐 수 있다** |

여섯 무리로 읽는다.

**파생 무리 (1종 — C023 이 새로 열었다)** — THE-EFFECTIVE-IS-DERIVED-NOT-STORED 는
"합쳐 나오는 값을 저장하지 않는다" 이며, 앞의 어느 무리와도 다르다. 다른 후보들이
**세계와 화면 사이**의 경계를 말한다면 이것은 **세계 안의 값이 어떤 형태로 있는가**를
말한다. 승격 전에 정할 것은 "합성된 값" 과 "누적이 곧 진실인 값"(HP · 기력 · 수량)을
가르는 선이다.

**공정 무리 (1종 — 후보가 아닐 수 있다)** — SURFACE-MUST-NOT-PROMISE 는 Cycle Agent
자신이 "Master 노드가 아니라 공정의 문제일 수 있다" 고 보고했다. 키 충돌은 판단이
아니라 조회이므로 도구(`catalog:check` 같은 자리)가 더 맞을 수 있다. 닫든 세우든
**도구 작업을 어딘가에 적어 두는 것**이 이 후보의 실제 결론이다.

**표면 무리 (4종 — C019 로 하나 늘었다)** — 새로 든 THE-WORLD-JUDGES-THE-MOMENT 는
"판정을 세계가 소유한다" 이고, 아래 셋은 "값·목록을 세계가 소유한다" 다. 넷 다
`DC-WORLD-OWNS-THE-SURFACE-LIST` 와의 경계 판단을 기다리므로 한자리에서 본다.

**표면 무리 (3종)** — NAMES-WHAT-IT-READ(무엇을 읽었는가) · OWNS-THE-RELATION(두 존재
사이의 값) · NAMES-WHAT-IT-WITHHELD(무엇을 가렸는가)는 모두
`DC-WORLD-OWNS-THE-SURFACE-LIST` 와의 경계를 Human 판단으로 남겨 둔 상태이며,
셋 다 "View 가 스스로 만들어내지 않는다" 는 한 문장의 다른 얼굴이다.
넷째(SURFACE-LIST)와 한 자리에서 보라는 뜻으로 나란히 둔다.

**대가 무리 (2종 — C022 가 새로 들었다)** — A-COST-MUST-LEAVE-A-WINDOW 는
"대가는 치를 수 있어야 대가다" 이며, 앞의 무리들과 성격이 다르다. 표면·길·구조 무리가
**무엇을 어디에 두는가**를 말한다면 이것은 **정한 값이 세계에서 성립하는지를 재는가**를
말한다. 2회 관찰이고, 한 번은 실패로 치렀다 (C020 이 Stage 8 에서 Stage 1 로 반환됐다).

둘째 NO-SELF-INFLICTED-DEAD-END 는 그 물음을 **시간 축으로 넓힌 것**이다.
앞의 것이 "지금 이 대가를 치를 수 있는가" 라면 이것은 "치르고 나서도 길이 남는가" 다.
셋 다 관찰되었으나 앞의 둘은 값으로 지켰고 C022 가 처음 규칙으로 세웠다 — 그래서
승격 여부보다 **Scope** 가 먼저다. GLOBAL 로 올리면 되돌릴 수 없는 선택의 무게 자체를
세계에서 없애게 되어 북극성과 부딪힌다 (후보 파일의 POTENTIAL CONFLICTS).

**길 무리 (1종)** — A-NEW-WAY-OF-KNOWING-IS-NOT-A-GATE 는 2회 관찰된 후보다. `DC-WORLD-PLAYER-UNFIXED-PATH` 의 정보판이며, 승격하면 다음 Cycle 이 바로
그 제약을 받는다.

**상태 무리 (2종 — 둘 다 승격 완료)** — WORLD-OWNS-THE-CHANCE 와
CONDITION-OPENS-WITHOUT-RECORDING 은 뿌리가 같지만(안 써도 되는 상태는 쓰지 않는다)
적용 대상이 달라 합치지 않고 둘로 세웠다 (우연 ↔ 조건).
**C018 이 이 무리의 값어치를 확인했다** — 태도를 저장하지 않아 "물러나면 풀린다" 의
구현이 0줄이었다. C018 은 그것을 새 후보로 제안했으나 이미 승인된 DC 였다 (HISTORY 참조).

**구조 무리 (3종 — C017·C018)** — THE-CHOICE-IS-THE-OBSERVERS-OWN(관찰자에게 매달리는
사실의 모양) · A-GATE-MOVES-WITH-ITS-MEANING(관문이 옮겨갈 때 사유를 잃지 않는다) ·
REASONS-ARE-A-LIST-NOT-A-BRANCH(사정은 목록, 판정은 그것을 읽는다).
셋 중 첫째만 3회 관찰이고 나머지 둘은 1회다 — 뒤의 둘은 두 번째 사례를 기다린다.

승격된 것 3종 — 파일은 전부 기록으로 남긴다.

| 후보 | 승격 | 근거 |
|---|---|---|
| CC-WORLD-OWNS-THE-SURFACE-LIST | 2026-08-17 | 관찰 3회 (C007 → C009 → C010) |
| CC-WORLD-OWNS-THE-CHANCE | 2026-08-19 | 관찰 1회 — **비가역성**으로 첫 항 면제 |
| CC-CONDITION-OPENS-WITHOUT-RECORDING | 2026-08-19 | 관찰 1회 — 같은 사유 |

뒤의 둘은 승격 조건 첫 항(반복)을 면제한 사례다. 나중에 세우면 이미 쌓인 것을 깨야
하기 때문이며, 같은 예외를 다시 쓸 때는 그 비가역성을 먼저 보인다.

전투 Graph 에서 발견해 올렸던 CC 3종은 Human 지시로 제거했다.

## 이것이 무엇인가

Constraint 를 Human 이 처음부터 다 쓸 필요는 없다. Graph 를 확장하거나 Cycle 을 돌면서
반복되는 설계 패턴이 발견되면 Agent 가 여기에 후보를 제출한다.

```text
Recurring Design Pattern → candidates/CC-*.md → Human Review
    → APPROVED / REJECTED / REVISED → constraints/DC-*.yaml
```

## 승격 조건

```text
여러 Goal/Possibility/Capability 에서 반복된다
설계 선택을 실제로 제한한다
게임의 정체성 또는 World Premise 와 관련 있다
앞으로도 반복 적용할 가치가 있다
```

## 규칙

```text
Agent 는 후보를 자동 승인하지 않는다 — 승격은 Design 의미 변경이므로 Human 승인이 필요하다.
승인되면 DC-*.yaml 로 옮기고 provenance 에 CANDIDATE:CC-* 를 남긴다.
후보 파일은 지우지 않는다 — 그 원칙이 어디서 왔는지의 기록이다.
REJECTED 도 남긴다 — 같은 패턴이 다시 올라올 때 이미 판단된 것임을 알 수 있다.
```
