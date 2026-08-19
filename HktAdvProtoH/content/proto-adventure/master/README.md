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
> **2026-08-18 — 이 지시 아래에서 Graph 확장을 한 번 실행했다.** OffenseDefense 트랙 자신의
> 다음 층(Penetration)이 Graph 에 노드가 없어 Frontier 에 나타나지 못하고 있었다.
> 새 영역이 아니라 **진행 중인 트랙의 결손**이므로 위 제한의 취지에 어긋나지 않는다고
> 판단했다 — MC-PENETRATION · MP-PIERCE-THE-HARD-DEFENSE 2종. 이견이 있으면 되돌린다.
>
> **2026-08-19 — Human 지시로 세계관 문서를 주입했다.** `design/Master-World-Beira.md`(BW)
> 의 주입(Inject)은 Agent 주도 확장이 아니라 Human 지목 반영이므로 위 제한에 걸리지
> 않는다. 세계(WORLD) 영역이 열렸다 — 아래 "현재 상태" 참조. 위 제한은 Agent 주도의
> 새 영역 **탐색**(WHY/OPTIONS 확장)에는 계속 적용된다.

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

근거 문서는 영역별로 분리된다 — 근거는 영역을 넘지 않는다 (Q15).

```text
전투   R1  design/Design-Combat-OffenseDefense-R0.md   §14 확장 순서가 Cycle 사다리다
       DT  design/Design-Combat-DamageType-R0.md       §15 가 이후 확장의 경계를 긋는다
성장   GR  design/Master-Intent-Graph-Growth.md        GROWTH scope 한정
세계   BW  design/Master-World-Beira.md                2026-08-19 주입 — 세계압·탐험·자원
```

해당 영역 문서가 이름조차 대지 않는 의미는 Graph·Constraint 에 두지 않는다 — 보류가
아니라 삭제한다. 기준 시점 **BW 주입 (2026-08-19)** — 코드는 C012 닫힘 상태 그대로다.

```text
Constraint   17     Active 17 (APPROVED 16 · REVISED 1 — PLAYER-CAUSALITY, Critical 예외) · DRAFT 0
Candidate     3     APPROVED 1 (→ DC) · PENDING 2
Actor         2     Knowledge 2 · Belief 0 (Belief 는 도입하지 않는다 — Q3 결정)
Goal          5     Possibility 24 (전투 14 · 탐험 10) — §27 기관 대안 4종만 requires 미배선
Capability   42     IMPLEMENTED 7 · PARTIAL 2 · MISSING 33 (베이라 사다리 21 · 자원 2 · Critical 1 포함)
Item Def      2     IP-BOUNDARY-STABLE · IT-BOUNDARY-BLADE (growth/items/)
Frontier      3     PROPOSED — PENETRATION · CRITICAL · OBSERVE (Human 선택 대기)
WorldState   11     상위 인과 2 (PRIMAL-WORLD · WORLD-PRESSURE) · 구조 2
                    (SAFE-FRONTIER · DEPTH-GRADIENT) · 깊이 층 5 (ZONE-FRINGE ~ ZONE-UNKNOWN) ·
                    대표 지역 2 (HYPER-PREDATION · SPATIAL-SHEAR)

Open Question 0   → 지금 Human 을 기다리는 것은 frontier.md 의 선택이다
```

무엇이 언제 왜 바뀌었는지는 `HISTORY.md` 가 소유한다. 살아 있는 문서(`overlay.md` ·
`frontier.md` · `open-questions.md` · `constraints/README.md`)에는 **지금 할 일과 현재
상태만** 남긴다 — 닫힌 것은 그 자리에서 지우고 HISTORY 로 옮긴다.

닫힌 Possibility 3종 — MP-OUTGROW-THE-OPPONENT(C010) · MP-TRADE-BODY-FOR-RESOURCE(C011) ·
MP-MATCH-WEAPON-TO-ARMOR(C012). 요구 Capability 가 하나도 비어 있지 않은 경로들이다.

아직 비어 있는 것 — 지어내지 않고 남긴 자리다:

```text
§27 기관 대안 4종의 requires   BW 는 대안 구조만 공급했다 — 배선은 OPTIONS/NEED 몫
지역이라는 세계 기반           SAFE↔FRINGE 경계·이동이 세계에 없다 — 탐험 Cycle 들의 전제
각 층이 만드는 Local Goal      §16 은 순환(발견 → Local Goal)만 공급했다 — WHY 몫
Growth 획득 경로               CL-* 0 건 · grants 배선 없음 — growth/growth-graph.md
```

닫힌 결정(2026-08-19): Belief 비도입(Q3) · 전투는 전투로(Q8) · Critical 확률 허용(Q11) ·
전투 Goal 의 World Cause 배선(Q2) · BW DC 승인(Q17) · 전투 매핑(Q18) · root 확정(Q19)
— 전부 HISTORY.md.

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
