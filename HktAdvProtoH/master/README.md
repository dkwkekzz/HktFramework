# master/ — Master Intent Graph

> ## 진행 순서 — 2026-08-17 Human 지시 (2026-08-18 갱신)
>
> 전투 기본 규칙(OffenseDefense) 트랙을 마무리하는 것이 먼저다. 그 전에는 이 디렉터리를
> **새 영역으로** 넓히는 작업(다른 주제의 WHY/OPTIONS/NEED Graph 확장 · Constraint 신설)을
> 시작하지 않는다. 닫힌 Cycle 을 반영하는 Feedback 은 그 제한에 걸리지 않는다 — 그것을 미루면
> `frontier.md` 와 `overlay.md` 가 현재 세계와 어긋나 다음 선택을 흐린다.
>
> Human 이 직접 세운 것은 `constraints/` 뿐이다. `graph/` `overlay.md` `frontier.md` 는
> R1 개정 때 설계 문서의 의미를 옮겨 둔 것이며 Master 를 처음부터 세운 결과가 아니다.
>
> **이 지시와 성장(GROWTH) 영역의 관계가 아직 정리되지 않았다.** Human 이 GR 을 직접
> 주입해(Q13) 성장 영역이 열렸고, 전투 트랙은 다음 층(Active Defense)의 설계 문서가 없어
> 멈춰 있다. 지금 유일한 Frontier 후보가 성장 쪽이므로 이 지시를 그대로 둘지 갱신할지는
> Human 결정이다 → [open-questions.md](open-questions.md) Q17.

이 디렉터리는 **Master Layer** 의 산출물이다.

```text
MASTER LAYER   WHY → OPTIONS → NEED → NEXT — 무엇을 왜 만들지 결정한다
CYCLE LAYER    선택된 하나의 플레이 결과를 World Semantic 과 Rule 로 폐쇄한다  → cycles/
```

정책 원본은 [../design/Master-Intent-Graph-Policy.md](../design/Master-Intent-Graph-Policy.md),
파일 형식의 단일 출처는 [SCHEMA.md](SCHEMA.md) 다.
절차(4단계 · Feedback · Inject)는 `advprotoh-master` 스킬과 `../guides/master-*.md` 가
소유한다 — 여기에 중복해 두지 않는다. 아래 "현재 상태"의 전투 영역은
주입(Inject — `../guides/master-inject.md`)으로 들어온 것이다.

## 현재 상태

주입된 영역은 둘이며 **근거는 영역을 넘지 않는다** (2026-08-18 Q12 · Q15 결정).

```text
전투   R1   design/Design-Combat-OffenseDefense-R0.md   §14 확장 순서가 Cycle 사다리다
       DT   design/Design-Combat-DamageType-R0.md       §15 가 이후 확장의 경계를 긋는다
성장   GR   design/Master-Intent-Graph-Growth.md        획득 경로(Class · Item)의 형태
```

해당 영역의 문서가 이름조차 대지 않는 의미는 Graph·Constraint 에 두지 않는다 — 보류가
아니라 삭제한다. 기준 시점 **C013 닫힘 (2026-08-18)**.

```text
Constraint   12     APPROVED 12 (COMBAT 5 · GROWTH 6 · GLOBAL 1) · DRAFT 0
Candidate     4     APPROVED 1 (→ DC) · PENDING 3
Actor         2     Knowledge 2 · Belief 0
Goal          2     Possibility 10
Capability   18     IMPLEMENTED 9 · PARTIAL 1 · MISSING 8
획득 경로     0     CL-* 0 · IT-* 0 — 능력치를 세계 안에서 얻는 길이 없다 (growth/growth-graph.md)
Frontier      1     PROPOSED — FR-WHAT-I-HOLD-CHANGES-MY-BLOW (Human 선택 대기)
WorldState    0     비어 있다 (아래)

Open Question 5   → open-questions.md (Q2 · Q3 · Q8 · Q11 · Q17)
```

무엇이 언제 왜 바뀌었는지는 `HISTORY.md` 가 소유한다. 살아 있는 문서(`overlay.md` ·
`frontier.md` · `open-questions.md` · `constraints/README.md`)에는 **지금 할 일과 현재
상태만** 남긴다 — 닫힌 것은 그 자리에서 지우고 HISTORY 로 옮긴다.

요구 Capability 가 하나도 비어 있지 않은 경로 4종 — MP-OUTGROW-THE-OPPONENT(C010) ·
MP-TRADE-BODY-FOR-RESOURCE(C011) · MP-MATCH-WEAPON-TO-ARMOR(C012) ·
MP-PIERCE-THE-HARD-DEFENSE(C013). 다만 앞뒤 둘은 그 능력치를 세계 안에서 **얻는 경로**가
없어 플레이어가 고를 수 없다 — 두 축의 차이는 [overlay.md](overlay.md) 와
[growth/growth-graph.md](growth/growth-graph.md) 가 나눠 가진다.

아직 비어 있는 것 — 지어내지 않고 남긴 자리다:

```text
root.md                  Root Game Goal · World Premise — Human 소유. 비어 있다
graph/world-state.yaml   World Cause 가 없다. 주입된 문서가 전투 규칙 문서이기 때문이다.
                         그래서 Goal 의 caused_by / motivation 도 비어 있다  → Q2
Belief                   오독의 여지를 어디까지 둘지가 미정이다              → Q3
전투 밖 경로             같은 상대를 싸움 밖으로 넘어서는 길이 없다          → Q8
```

## 수명

```text
cycles/     History     한번 닫히면 수정하지 않는다
master/     현재 상태    world/ view/ 처럼 계속 갱신된다
```

과거 판정을 남기려면 파일을 복제하지 말고 Node 의 `status` 와 근거 Cycle 참조로 남긴다.

## 파일

| 경로 | 내용 | 소유 |
|---|---|---|
| [root.md](root.md) | Root Game Goal · World Premise | **Human** |
| [constraints/](constraints/) | `DC-*.yaml` — 승인된 Design Constraint | **Human** 승인 |
| [graph/](graph/) | MW · MA · MK · MB · MG · MP · MC · edges | Master Design Agent |
| [growth/](growth/) | CL · IT · IP · IM 정의 + 획득 경로 Overlay | Master Design Agent |
| [overlay.md](overlay.md) | Capability × 현재 구현 상태 (IMPLEMENTED/PARTIAL/MISSING) | Master Design Agent |
| [frontier.md](frontier.md) | `FR-*` 후보 + Human 선택 기록 | Agent 제안 / **Human** 선택 |
| [candidates/](candidates/) | `CC-*.md` — 미승인 Constraint Candidate | Agent 제안 / **Human** 승인 |
| [open-questions.md](open-questions.md) | 승인 대기 · Constraint 충돌 · 설계 공백 · Trade-off | Agent 제기 / **Human** 결정 |
| [HISTORY.md](HISTORY.md) | 닫힌 것들의 보관소 — 평소에 읽지 않는다 | Master Design Agent |

위 문서들은 **지금 할 일과 현재 상태만** 담는다. 닫힌 항목은 그 자리에서 지우고
`HISTORY.md` 로 옮긴다 — 그래야 매번 읽는 문서가 가볍게 유지된다.

## 두 층의 접합점

접합점은 둘뿐이다. 그 외 경로로 두 층이 서로를 건드리지 않는다.

```text
아래로   frontier.md 의 선택된 FR-*   →  cycles/<CycleId>/01-cycle.md 의 MASTER TRACE
위로     08-verification.md 의 MASTER FEEDBACK  →  overlay.md 갱신 · candidates/ 제출
```

Cycle Agent 는 `master/` 를 **직접 편집하지 않는다**. 보고까지가 Cycle 의 책임이고,
반영은 Master Feedback 작업이 한다.

## 절대 규칙

```text
Constraint 는 시스템 목록을 만들지 않는다 — Goal/Possibility 의 형태를 제한할 뿐이다.
Capability 의 필요성은 Possibility 에서 나온다 — Constraint 에서 나오지 않는다.
수치·공식·판정 상수는 여기 두지 않는다 — Cycle 의 03-world-semantic.md 가 소유한다.
Agent 는 Constraint 를 자동 승격하지 않는다 — Human 이 승인한다.
Agent 는 Constraint 충돌을 임의로 해결하지 않는다 — Trade-off 로 노출한다.
```
