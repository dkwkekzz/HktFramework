# candidates/ — 미승인 Constraint Candidate

파일 하나 = 후보 하나. 이름은 `CC-<NAME>.md`. 형식은 [../SCHEMA.md](../SCHEMA.md).

현재: **PENDING 4종**

| 후보 | 출처 | 관찰 | 상태 |
|---|---|---|---|
| CC-RESOURCE-GATE-IS-ALL-OR-NOTHING | C011 | 2회 (C007 · C011) | PENDING |
| CC-THE-WORLD-NAMES-WHAT-IT-READ | C012 | 1회 (C012 · C010 은 전조) | PENDING |
| CC-THE-WORLD-OWNS-THE-RELATION | C013 | 1회 (C013 · C012 는 전조) | PENDING |
| CC-THE-WORLD-NAMES-WHAT-IT-WITHHELD | C014 | 1회 (C014 · C011 은 전조) | PENDING |

**PENDING 넷 중 셋이 같은 뿌리다** — NAMES-WHAT-IT-READ(무엇을 읽었는가) ·
OWNS-THE-RELATION(두 존재 사이의 값) · NAMES-WHAT-IT-WITHHELD(무엇을 가렸는가)는
모두 `DC-WORLD-OWNS-THE-SURFACE-LIST` 의 확장 후보이며, 셋 다 "View 가 스스로
만들어내지 않는다" 는 한 문장의 다른 얼굴이다. 한 문안으로 합칠지 따로 세울지는
Human 판단이다 — 넷을 한 자리에서 보라는 뜻으로 여기 나란히 둔다.

승격된 것 1종 — CC-WORLD-OWNS-THE-SURFACE-LIST (2026-08-17 APPROVED →
`../constraints/DC-WORLD-OWNS-THE-SURFACE-LIST.yaml`). 파일은 기록으로 남긴다.

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
