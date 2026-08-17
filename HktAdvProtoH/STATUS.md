# STATUS — 지금 무엇을 먼저 하는가

> 이 파일은 **현재 상태**다. History 가 아니다. 상황이 바뀌면 덮어쓴다.
> `CLAUDE.md` 는 원칙과 인덱스만 담으므로, 그때그때의 우선순위와 사다리 위치는 여기 있다.
>
> 최종 갱신 2026-08-17

## 우선순위 (2026-08-17 Human 지시)

지금은 **전투 기본 규칙(OffenseDefense) 트랙을 마무리하는 중**이다.
그것이 끝나기 전에는 Master Layer 를 세우는 작업을 시작하지 않는다.

## 확장 사다리 — 현재 위치

기준 문서는 [design/Design-Combat-OffenseDefense-R0.md](design/Design-Combat-OffenseDefense-R0.md) (R1) 이고,
§14 확장 사다리를 **아래에서부터 한 층씩** 올린다.

```text
닫힘   Basic Damage 층      cycles/C010-stats-decide-the-damage           COMPLETE
       Defense Action 층    cycles/C011-guard-trades-body-for-resource    COMPLETE
보류   Critical 층          DC-COMBAT-PLAYER-CAUSALITY 의 random_critical 금지와 충돌.
                            R1 자신이 "결정론을 중요하게 여긴다면 넣을지 다시 판단한다" 고
                            열어 두었고 결정은 아직 미기록 — master/open-questions.md Q11
진행   Damage Type 층       cycles/C012-damage-type-chooses-the-defense   IN PROGRESS
                            세부 설계 원본은 design/Design-Combat-DamageType-R0.md 다
                            (2026-08-17 도착 — 이 층이 막혀 있던 이유가 풀렸다)
그 위  Penetration → Active Defense(완벽한 막기·되받아치기) → Aura/Nen
```

각 층은 **자기 설계 원본이 도착한 뒤에** 연다. 원본이 네 단어뿐이면 Cycle 을 열지 않는다 —
Agent 가 없는 설계를 지어내 채우는 것은 금지다.

## Master Layer 는 아직 시작 전이다

Human 이 직접 세운 것은 `master/constraints/` 뿐이다. `master/graph/` `master/overlay.md`
`master/frontier.md` 는 R1 개정 때 설계 문서의 의미를 옮겨 둔 것이며 **Master Layer 를 실제로
세운 결과가 아니다** (2026-08-17 Human 확인). 따라서 지금은:

```text
다음 Cycle 을 frontier.md 만 보고 고르지 않는다.
```

`frontier.md` 는 Capability 의존성만 본다 — **층 높이를 보지 않는다.** 실제로 그 목록은 Guard 가
닫히자 Active Defense(완벽한 막기)를 다음으로 올리는데, 그 사이의 Damage Type · Penetration
두 층을 건너뛴다. 구 C010·C011 이 롤백된 원인이 바로 그 종류의 층 건너뛰기였다.
**층 순서의 기준은 `frontier.md` 가 아니라 R1 §14 와 §15 층 그림이다.**

`master/` 의 상태 표기가 현재 세계와 어긋나 있는 것도 같은 이유다 (예: MC-GUARD 가 아직
MISSING, `frontier.md` 의 SELECTED 가 이미 닫힌 Cycle 을 가리킨다). 갱신(MF Stage)은
OffenseDefense 트랙을 닫고 Master 를 제대로 세울 때 함께 한다.

## 열려 있는 Human 결정

| 건 | 무엇을 정해야 하는가 | 어디 |
|---|---|---|
| Q11 Critical 층 | 확률 Critical 을 버릴지, DC-COMBAT-PLAYER-CAUSALITY 를 고칠지 | `master/open-questions.md` |
| DC-COMBAT-DEFENSE-IS-ACTIVE | DRAFT 재승인 — 근거 층(C011 막기)이 세계에 실재하게 되었다 | `master/constraints/` |
| DC-COMBAT-MATCHUP-SOFT | DRAFT 재승인 — 근거 층이 진행 중인 C012 다 | `master/constraints/` |
| CC-RESOURCE-GATE-IS-ALL-OR-NOTHING | Constraint 승격 여부 (C007·C011 두 사례 관찰) | `cycles/C011-.../08-verification.md` |

## 알려진 미해결 결함

```text
view/tests/motion-atlas.spec.ts   sprite 여백(bleed) 검출 1건 실패 (전체 452/453)
                                  C011 이전부터 있었고 전투 트랙과 무관하다.
                                  별도 정비 Cycle 의 몫으로 남아 있다
```

## 이 파일을 걷는 시점

OffenseDefense 트랙이 닫히고 Master Layer 를 제대로 세운 뒤, Human 이 우선순위 절과
Master HOLD 절을 걷는다. 사다리 위치는 그 뒤에도 계속 갱신한다.
