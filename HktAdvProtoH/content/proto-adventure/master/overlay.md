# Capability Overlay

Master Capability(`graph/capabilities.yaml`) 를 현재 `world/` `view/` 구현 상태와 겹쳐 본 결과다.
기본 절차 **NEED** 단계의 산출물이며, NEXT(Frontier) 는 여기서 나온다.

기준 시점: **BW(베이라 세계관) 주입 (2026-08-19)** — 코드는 C012 완료 시점 상태 그대로다
(주입은 Graph 만 넓혔고 세계 구현은 바뀌지 않았다).

근거 문서는 영역별로 분리된다 (근거는 영역을 넘지 않는다 — HISTORY Q15).

```text
전투   R1  design/Design-Combat-OffenseDefense-R0.md · DT  design/Design-Combat-DamageType-R0.md
탐험   BW  design/Master-World-Beira.md  (2026-08-19 Human 지시로 주입)
성장   GR  design/Master-Intent-Graph-Growth.md
```

해당 영역 문서가 이름조차 대지 않는 Capability 는 "없는 것"이 아니라 **노드가 아니다** —
표에서 삭제한다.

## 상태 — 전투 영역

| Capability | 상태 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-COMBAT-STRIKE | IMPLEMENTED | C007 `RULE-STRIKE-DAMAGE-001` · C010 이 그 피해 산정을 하나의 공식으로 교체 (R1 §9 CHANGED 완료) | — |
| MC-BODY-FACING | IMPLEMENTED | C006 `RULE-BODY-FACING-001` · `ActorState.facing` (`world/semantic/actor.ts`) | — |
| MC-CP-ECONOMY | PARTIAL | C007 `hp/cp` · `SkillDefinition.cpCharge/cpCost` · `RUN_CP_DRAIN` · **C011 막기가 같은 예산을 쓴다** | 기력을 쓰는 자리가 셋(고급 스킬·달리기·막기)이 되어 공격과 방어가 경쟁하기 시작했다. 그러나 기력이 스스로 돌아오지 않는 결손은 그대로다 (C007 EXCLUDED) — C011 이 승격을 보고하지 않았다 |
| MC-COMBAT-CAUSE-READING | PARTIAL | C007 `World.StrikeEvents` · C007 R2 속성 전체 관찰 · C009 명령 대답 | **NEED(Overlay) 재판정 필요** — C010 이 계산 내역(기본 피해 · Attack 기여 · Defense 배율)을 관찰 계약에 실었으나 C010 의 MASTER FEEDBACK 이 이 Capability 를 보고하지 않았다. 보고 없는 승격은 하지 않는다 (Feedback Guide) |
| MC-ATTACK-POWER | IMPLEMENTED | C010 08-verification — 공격력 40→80 변경이 피해 20→35 로 실측 | — |
| MC-SKILL-SCALING | IMPLEMENTED | C010 08-verification — 계수가 큰 스킬이 같은 공격 증가에 더 크게 자라는 것이 실측 | — |
| MC-DEFENSE-MITIGATION | IMPLEMENTED | C010 08-verification — 방어 0/100/200/300 에서 피해 26/13/9/7, 감소폭 단조 감소, 방어 100000 에서도 최소 1 | — (단 이것은 **수동 감쇄**다. 막는 행동은 MC-GUARD 이며 별개다) |
| MC-GUARD | IMPLEMENTED | C011 08-verification — 막기가 행동으로 존재하고(`RULE-GUARD-BEGIN-001`) 정면 판정이 방향을 가르며, 막힌 타격이 절반으로 줄고 기력을 치르며, 기력이 마르면 방어가 무너지는 것이 실측 | — |
| MC-PERFECT-GUARD | MISSING | — | 막기는 C011 로 생겼으나 그 **시작 시각**을 판정하는 의미가 없다 (R1 §14 Active Defense 층 — 구 C011 로 닫혔다가 2026-08-17 롤백, 산출물은 git history) |
| MC-COUNTER | MISSING | — | 노출 상태(Exposed)가 없다 (R1 §14 Active Defense 층 — 구 C011 로 닫혔다가 2026-08-17 롤백, 산출물은 git history) |
| MC-EVADE | MISSING | — | 회피 행동이 없다 (R1 §13 이연) |
| MC-BREAK | MISSING | — | 방어를 무너뜨리는 의미가 없다 (R1 §14 Active Defense 층이 이름만 예고 — Guard Break) |
| MC-COMBAT-FLOW | MISSING | — | 공격/방어 배분 상태가 없다 (R1 §14 Aura/Nen 층으로 재설계 예정) |
| MC-FORTIFY | MISSING | — | Flow 가 없으므로 방어 쪽에 몰아 둔 자세도 없다 (R1 §14 Aura/Nen 층) |
| MC-ATTACK-ARMOR-MATCHUP | IMPLEMENTED | C012 08-verification — 공격 형태 둘·방어 형태 둘이 존재하고 타입 대응이 계산의 입력을 고른다. 같은 스킬 값이 상대에 따라 20/14 ↔ 17/22 로 갈리는 것이 실측 | — |
| MC-PENETRATION | MISSING | — | 마주한 방어를 깎는 의미가 없다. 작용 대상인 두 방어는 C012 로 생겼으므로 이제 이것 하나만 없다 (R1 §14 Penetration 층 · 작용 지점은 DamageType R0 §15) |
| MC-CONDITION-STACKING | MISSING | — | 조건이라는 개념 자체가 없다 (R1 §14 Aura/Nen 층) |
| MC-VOW | MISSING | — | 제약·실패 대가가 없다 (R1 §14 Aura/Nen 층) |

## 상태 — 탐험 영역 (BW 주입 2026-08-19)

현재 세계(`world/` `view/`)는 전투 프로토타입이다 — 지역·이동·생태·자원·채집·거래의
의미가 하나도 없다. 따라서 BW 유래 Capability 는 **전부 MISSING** 이며, 개별 근거
실측이 아직 존재할 수 없으므로 행마다 같은 근거를 반복하지 않고 층으로 묶어 판정한다.
개별 행 분리는 첫 관련 Cycle 이 닫힐 때 한다.

| Capability (층) | 상태 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-REPOSITION (SAFE §20) | MISSING | — | 위치를 잡는 이동 의미가 없다 (걷기·달리기는 있으나 위치의 유불리가 판정에 쓰이지 않는다) |
| MC-OBSERVE · MC-PREDICT · MC-USE-TERRAIN (FRINGE §21) | MISSING | — | 관찰·예측이 행동으로 존재하지 않고, 지형이 판정에 쓰이지 않는다 |
| MC-DISCOVER-WEAKNESS · MC-PRECISE-TARGETING · MC-CONTROL-SPACE (WILD §22) | MISSING | — | 약점 발견·부위 조준·공간 통제의 의미가 없다 (MC-BREAK 는 전투 표에서 판정) |
| MC-READ-ENVIRONMENT · MC-FORCE-MOVEMENT · MC-USE-HAZARD · MC-INTERRUPT (DANGER §23) | MISSING | — | 환경 Hazard 라는 개념 자체가 세계에 없다 |
| MC-DISRUPT-ABILITY · MC-MAINTAIN-PRESSURE · MC-TARGET-SPECIFIC-PART · MC-READ-CREATURE-SYSTEM (DEEP §24) | MISSING | — | 재생·공생·부위라는 개념 자체가 없다 |
| MC-PROTECT-PERCEPTION · MC-VERIFY-REALITY · MC-IDENTITY-ANCHOR · MC-RESIST-INFLUENCE · MC-BREAK-BIOLOGICAL-LINK · MC-ESCAPE-ALTERED-SPACE (UNKNOWN §25) | MISSING | — | 지각·Identity·공간 변형이라는 개념 자체가 없다 |
| MC-RESTORE-BIOLOGICAL-STATE (자원 §8) | MISSING | — | 회귀초도, 생체 상태의 보존·복원 의미도 없다 |
| MC-CUT-ABNORMAL-STRUCTURE (자원 §10 · §17) | MISSING | — | 경계결정·제작·구조 절단 의미가 없다 (획득 경로 현황은 growth/growth-graph.md) |

## 판정 기준

```text
IMPLEMENTED   그 의미를 닫은 Cycle 이 있고 08-verification 이 실측으로 통과했다
PARTIAL       일부만 닫혔거나, 닫혔지만 이번 Possibility 가 요구하는 형태에 못 미친다
MISSING       세계에 그 의미가 없다
```

근거 칸에는 Cycle ID 또는 실측을 적는다. 주장만 적지 않는다.
Constraint Violation 과 혼동하지 않는다 — 여기는 **있는가/없는가**이지 **허용되는가**가 아니다.

## Possibility 별로 본 상태

어느 경로가 지금 얼마나 닫혀 있는가 — Frontier 는 이 표에서 고른다.

| Possibility | 요구 Capability 중 없는 것 | 비고 |
|---|---|---|
| MP-OUTGROW-THE-OPPONENT | **없음** | **C010 으로 닫혔다** — 요구 Capability 3종이 모두 IMPLEMENTED. 이 경로는 지금 플레이 가능하다 |
| MP-TRADE-BODY-FOR-RESOURCE | **없음** | **C011 로 닫혔다** — 요구 Capability 4종이 모두 IMPLEMENTED. 이 경로는 지금 플레이 가능하다 |
| MP-READ-AND-COUNTER | MC-PERFECT-GUARD · MC-COUNTER | C011 이 MC-GUARD 를 채워 셋에서 둘로 줄었다. R1 §15 층 그림에서 Active Defense 는 Penetration 위다 |
| MP-EVADE-BY-MOVING-THE-BODY | MC-EVADE | R1 §13 이 Dodge 를 이후 확장으로만 지정 — §14 순서에 자리가 없다 |
| MP-BREAK-THE-GUARD | MC-BREAK | R1 §14 Active Defense 층 — 그 층의 설계 문서 대기 |
| MP-EXPLOIT-OPEN-BODY | MC-COMBAT-FLOW | R1 §14 Aura/Nen 층으로 이연 |
| MP-MATCH-WEAPON-TO-ARMOR | **없음** | **C012 로 닫혔다** — 요구 Capability 2종과 지식 1종이 모두 섰다. 이 경로는 지금 플레이 가능하다 |
| MP-PIERCE-THE-HARD-DEFENSE | MC-PENETRATION | **하나만 남았다** — C012 가 관통이 작용할 두 방어를 세웠다. R1 §14 Penetration 층이며 지금 가장 가까운 경로다 |
| MP-HOLD-FORTIFIED | MC-FORTIFY · MC-COMBAT-FLOW | R1 §14 Aura/Nen 층으로 이연 (MC-DEFENSE-MITIGATION 은 C010 으로 채워졌다) |
| MP-STAKE-EVERYTHING-ON-ONE-BLOW | MC-VOW · MC-CONDITION-STACKING · MC-COMBAT-FLOW | R1 §14 Aura/Nen 층 — 가장 멀다 |

탐험 영역 (BW §27 — MG-ACQUIRE-RARE-ORGAN 의 대안 5종):

| Possibility | 요구 Capability 중 없는 것 | 비고 |
|---|---|---|
| MP-KILL-CREATURE · MP-TAKE-SHED-ORGAN · MP-TRADE-WITH-ACTOR · MP-FIND-DEAD-SPECIMEN · MP-FORCE-CREATURE-TO-RELEASE | **판정 불가 — requires 미배선** | BW 는 대안 구조만 공급했다. 요구 Capability 배선(OPTIONS/NEED)이 끝나야 이 표에 오른다. Frontier 후보로 세우지 않는다 |

## 갱신 경로

```text
cycles/<CycleId>/08-verification.md 의 MASTER FEEDBACK
        ↓
guides/master-feedback.md (Feedback — 위쪽 접합점 반영)
        ↓
이 파일 + graph/capabilities.yaml 의 overlay 필드
        ↓
갱신 내역은 HISTORY.md 로 (이 파일에는 현재 상태만 남긴다)
```

이 파일은 **지금 무엇이 있고 무엇이 없는가**만 담는다. 무엇이 언제 어떻게 바뀌었는지는
[HISTORY.md](HISTORY.md) 가 소유한다 — 갱신 내역을 여기 쌓으면 표를 보러 온 사람이
매번 이력을 지나쳐야 한다.

Cycle Agent 가 이 파일을 직접 편집하지 않는다.
