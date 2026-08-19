# Capability Overlay

Master Capability(`graph/capabilities.yaml`) 를 현재 `world/` `view/` 구현 상태와 겹쳐 본 결과다.
기본 절차 **NEED** 단계의 산출물이며, NEXT(Frontier) 는 여기서 나온다.

기준 시점: **C013 · C014 완료** — 전투 사다리는 Penetration 층까지,
탐험 사다리는 FRINGE 의 첫 칸(살펴봄)까지 세계에 서 있다.
Graph 범위는 BW(베이라 세계관) 주입 상태 그대로다 (주입은 Graph 만 넓혔다).

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
| MC-PENETRATION | IMPLEMENTED | C013 08-verification — 마주한 방어가 결정적으로 깎이고(resistance 90 → 56.25), 마주하지 않은 방어에는 닿지 않으며(물리 타격의 C010 값 20 이 그대로), 두껍게 굳힐수록 걷히는 몫이 커진다(0/7.5/33.75/112.5). 방어를 없애지는 못한다(관통 100000 에서도 남는다) | — |
| MC-CONDITION-STACKING | MISSING | — | 조건이라는 개념 자체가 없다 (R1 §14 Aura/Nen 층) |
| MC-VOW | MISSING | — | 제약·실패 대가가 없다 (R1 §14 Aura/Nen 층) |
| MC-CRITICAL-STRIKE | MISSING | — | Critical 이라는 개념이 없다 (R1 §14 C011 층 — Q11(b) 로 열렸다) |

## 상태 — 탐험 영역 (BW 주입 2026-08-19)

현재 세계(`world/` `view/`)는 전투 프로토타입이다 — 지역·이동·생태·자원·채집·거래의
의미가 하나도 없다. 따라서 BW 유래 Capability 는 **전부 MISSING** 이며, 개별 근거
실측이 아직 존재할 수 없으므로 행마다 같은 근거를 반복하지 않고 층으로 묶어 판정한다.
개별 행 분리는 첫 관련 Cycle 이 닫힐 때 한다.

| Capability (층) | 상태 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-REPOSITION (SAFE §20) | MISSING | — | 위치를 잡는 이동 의미가 없다 (걷기·달리기는 있으나 위치의 유불리가 판정에 쓰이지 않는다) |
| MC-OBSERVE (FRINGE §21) | PARTIAL | C014 08-verification — 살펴봄이 행동으로 존재하고(`RULE-OBSERVE-BEGIN/COMPLETE-001`), 살펴본 뒤에만 상대의 겨루는 힘이 관찰에 실리며, 무엇을 아는가가 관찰자마다 다른 것이 실측 | semantic 이 말한 셋 중 **상태**만 닫혔다. ① **행동·습성** — 자율 존재의 행동 패턴을 읽는 의미가 없다 (MC-PREDICT 와 같은 자리) ② **경로가 하나** — 앎에 이르는 길이 살펴봄뿐이고, 앎이 존재 단위여서 부분 공개가 없다 |
| MC-PREDICT · MC-USE-TERRAIN (FRINGE §21) | MISSING | — | 예측이 행동으로 존재하지 않고, 지형이 판정에 쓰이지 않는다 |
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
| MP-READ-AND-COUNTER | MC-PERFECT-GUARD · MC-COUNTER | C011 이 MC-GUARD 를 채워 셋에서 둘로 줄었다. R1 §15 층 그림에서 Active Defense 는 Penetration 위이고, 그 아래층은 C013 으로 섰다 — 이제 그 층의 설계 문서만 없다 |
| MP-EVADE-BY-MOVING-THE-BODY | MC-EVADE | R1 §13 이 Dodge 를 이후 확장으로만 지정 — §14 순서에 자리가 없다 |
| MP-BREAK-THE-GUARD | MC-BREAK | R1 §14 Active Defense 층 — 그 층의 설계 문서 대기 |
| MP-EXPLOIT-OPEN-BODY | MC-COMBAT-FLOW | R1 §14 Aura/Nen 층으로 이연 |
| MP-MATCH-WEAPON-TO-ARMOR | **없음** | **C012 로 닫혔다** — 요구 Capability 2종과 지식 1종이 모두 섰다. 이 경로는 지금 플레이 가능하다 |
| MP-PIERCE-THE-HARD-DEFENSE | **없음** | **C013 으로 닫혔다** — 요구 Capability 4종이 모두 IMPLEMENTED. 이 경로는 지금 플레이 가능하다. 다만 아직 좁다 — 플레이어가 관통을 **얻는** 경로가 세계에 없다 (종류가 정한 값과 디버그 명령뿐) |
| MP-HOLD-FORTIFIED | MC-FORTIFY · MC-COMBAT-FLOW | R1 §14 Aura/Nen 층으로 이연 (MC-DEFENSE-MITIGATION 은 C010 으로 채워졌다) |
| MP-STAKE-EVERYTHING-ON-ONE-BLOW | MC-VOW · MC-CONDITION-STACKING · MC-COMBAT-FLOW | R1 §14 Aura/Nen 층 — 가장 멀다 |
| MP-BET-ON-THE-CRITICAL-BLOW | MC-CRITICAL-STRIKE | **하나만 없다** — Q11(b) 로 열린 R1 §14 C011 층. 나머지 2종은 IMPLEMENTED |

탐험 영역 (BW — MG-EXPLORE-BEIRA 깊이 진입 5종 + MG-ACQUIRE-RARE-ORGAN 대안 5종):

| Possibility | 요구 Capability 중 없는 것 | 비고 |
|---|---|---|
| MP-VENTURE-INTO-FRINGE | MC-PREDICT · MC-USE-TERRAIN (+ MC-OBSERVE 는 PARTIAL) | **C014 가 첫 칸을 세웠다** — 셋에서 둘로 줄었다. MC-OBSERVE 는 상태를 아는 일까지 닫혔고 습성·경로가 남는다. 지역·이동이라는 세계 기반은 여전히 없다 |
| MP-VENTURE-INTO-WILD | MC-BREAK · MC-DISCOVER-WEAKNESS · MC-PRECISE-TARGETING · MC-CONTROL-SPACE | 4종 전부 없다 (BW §22) |
| MP-VENTURE-INTO-DANGER | MC-READ-ENVIRONMENT · MC-FORCE-MOVEMENT · MC-USE-HAZARD · MC-INTERRUPT | 4종 전부 없다 (BW §23) |
| MP-VENTURE-INTO-DEEP | MC-DISCOVER-WEAKNESS · MC-DISRUPT-ABILITY · MC-MAINTAIN-PRESSURE · MC-TARGET-SPECIFIC-PART · MC-READ-CREATURE-SYSTEM | 5종 전부 없다 (BW §24) |
| MP-VENTURE-INTO-UNKNOWN | 6종 전부 (MC-PROTECT-PERCEPTION 외) | 사다리의 끝 — 가장 멀다 (BW §25) |
| MP-KILL-CREATURE | (requires.goals: MG-OVERCOME-SUPERIOR-OPPONENT — 전투 서브트리로 연결, Q18(a)) | 전투 서브트리 중 열린 경로 3종이 있으므로 세계 구현 기준으로는 성립한다. 단 상위 Goal 의 원인(MW-ZONE-WILD 지역)이 세계에 없다 |
| MP-TAKE-SHED-ORGAN · MP-TRADE-WITH-ACTOR · MP-FIND-DEAD-SPECIMEN · MP-FORCE-CREATURE-TO-RELEASE | **판정 불가 — requires 미배선** | BW §27 은 대안 구조만 공급했다. 요구 Capability 배선(OPTIONS/NEED)이 끝나야 판정된다 |

Q18(a) OPTIONS 산출 (전투 — MG-OVERCOME-SUPERIOR-OPPONENT 의 추가 경로):

| Possibility | 요구 Capability 중 없는 것 | 비고 |
|---|---|---|
| MP-CONTROL-MOVEMENT | MC-FORCE-MOVEMENT · MC-CONTROL-SPACE · MC-REPOSITION | 3종 전부 없다 |
| MP-INTERRUPT | MC-INTERRUPT | **하나만 없다** — 시점 판단 기반이라 현재 전투 세계 안에서 닫을 수 있다 |
| MP-WEAPONIZE-ENVIRONMENT | MC-READ-ENVIRONMENT · MC-USE-HAZARD (+ MW-ZONE-DANGER 라는 세계 기반) | 환경 Hazard 개념 자체가 없다 — 가장 멀다 |

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
