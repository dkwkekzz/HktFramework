# candidates/ — 미승인 Constraint Candidate

파일 하나 = 후보 하나. 이름은 `CC-<NAME>.md`. 형식은 [../SCHEMA.md](../SCHEMA.md).

현재: **4건 · 전부 `PENDING`** (MF C010 · C011 접수, 2026-08-16)

| Candidate | 관찰 | 4항 | 한 줄 |
|---|---|---|---|
| [CC-RESULT-CARRIES-ITS-BREAKDOWN](CC-RESULT-CARRIES-ITS-BREAKDOWN.md) | C007 · C010 · C011 | 4/4 | 결과에는 그 값을 만든 내역이 같은 자리에 함께 실린다 |
| [CC-TIMED-STATE-EXPIRES-BY-CLOCK](CC-TIMED-STATE-EXPIRES-BY-CLOCK.md) | C010 · C011 | 3.5/4 | 시간으로 끝나는 상태는 만료 Rule 없이 시각 비교로 산다 |
| [CC-STANCE-IS-NOT-AN-ACTION](CC-STANCE-IS-NOT-AN-ACTION.md) | C010 (+C011 재사용) | 3/4 | 태세는 행동 칸을 쓰지 않는다 |
| [CC-OUTSIDE-HAND-STAYS-REACHABLE](CC-OUTSIDE-HAND-STAYS-REACHABLE.md) | C011 | 1.5/4 | 밖의 손이 세운 상태도 규칙으로 도달 가능해야 한다 |

앞의 하나만 4항을 다 채운다. 나머지 셋은 **아직 이르다는 판단까지 함께 적어 두었다** —
지금 결정하지 않아도 되고, 두 번째 관찰이 왔을 때 이미 판단된 것임을 알 수 있게 하는 것이 목적이다.

전투 Graph 에서 발견해 올렸던 CC 3종은 Human 지시로 제거했다 (위 4건과 무관하다).

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
