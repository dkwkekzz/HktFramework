# Capability Overlay

Master Capability(`graph/capabilities.yaml`) 를 현재 `world/` `view/` 구현 상태와 겹쳐 본 결과다.
기본 절차 **NEED** 단계의 산출물이며, NEXT(Frontier) 는 여기서 나온다.

기준 시점: **C013-penetration-devalues-the-wall 닫힘 (2026-08-18)** — 코드는 그 Cycle 완료 시점 상태다.
(C013 은 기계 검증 7항 통과 · Human Play 9항 확인 대기 상태다 — 승격 근거는 그 실측이다.)

이 표(전투 Capability)의 근거 문서는 둘뿐이다 (2026-08-18 Q12) — `design/Design-Combat-OffenseDefense-R0.md`(R1) ·
`design/Design-Combat-DamageType-R0.md`. 두 문서가 이름조차 대지 않는 Capability 는
"없는 것"이 아니라 **노드가 아니다** — 표에서 삭제한다.
성장(GROWTH) 영역의 근거는 `design/Master-Intent-Graph-Growth.md`(GR) 이며 **근거는 영역을 넘지 않는다**
(2026-08-18 Q15) — 전투 노드에 GR 을, 성장 노드에 R1/DT 를 인용하지 않는다.

## 상태

| Capability | 상태 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-COMBAT-STRIKE | IMPLEMENTED | C007 `RULE-STRIKE-DAMAGE-001` · C010 이 그 피해 산정을 하나의 공식으로 교체 (R1 §9 CHANGED 완료) | — |
| MC-BODY-FACING | IMPLEMENTED | C006 `RULE-BODY-FACING-001` · `ActorState.facing` (`world/semantic/actor.ts`) | — |
| MC-CP-ECONOMY | PARTIAL | C007 `hp/cp` · `SkillDefinition.cpCharge/cpCost` · `RUN_CP_DRAIN` · **C011 막기가 같은 예산을 쓴다** | 기력을 쓰는 자리가 셋(고급 스킬·달리기·막기)이 되어 공격과 방어가 경쟁하기 시작했다. 그러나 기력이 스스로 돌아오지 않는 결손은 그대로다 (C007 EXCLUDED) — C011 이 승격을 보고하지 않았다 |
| MC-COMBAT-CAUSE-READING | IMPLEMENTED | NEED 재판정 (2026-08-18) — C010 08-verification 6항 `breakdown = {baseDamage, attackContribution, rawDamage, defenseMultiplier, finalDamage}` 과 화면 경위 `6+20=26 ×77%(방어 30) = 20` · C012 가 `damageType · offenseStat · defenseStat` 을 이름과 함께 실은 실측 · C013 이 `penetrationStat · effectiveDefense` 와 걷히기 전/뒤 두 값을 실은 실측. 공식에 들어간 모든 값이 이름과 함께 관찰된다 | — |
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
| MC-PENETRATION | IMPLEMENTED | C013 08-verification — 마주한 방어가 결정적으로 깎이고(Resistance 90 → 56.25 · 피해 14 대 17), 마주하지 않은 방어에는 닿지 않으며(물리 타격의 C010 값 20 무변경), 두꺼울수록 걷어내는 양이 커지고(0/7.5/33.75/112.5 단조), 방어를 없애지는 못한다(관통 100000 에서도 남는다) | — (**획득 경로는 없다** — growth/growth-graph.md 참조. 관통은 종류가 정한 값이거나 디버그 명령으로만 바뀐다) |
| MC-CONDITION-STACKING | MISSING | — | 조건이라는 개념 자체가 없다 (R1 §14 Aura/Nen 층) |
| MC-VOW | MISSING | — | 제약·실패 대가가 없다 (R1 §14 Aura/Nen 층) |

## 판정 기준

```text
IMPLEMENTED   그 의미를 닫은 Cycle 이 있고 08-verification 이 실측으로 통과했다
PARTIAL       일부만 닫혔거나, 닫혔지만 이번 Possibility 가 요구하는 형태에 못 미친다
MISSING       세계에 그 의미가 없다
```

근거 칸에는 Cycle ID 또는 실측을 적는다. 주장만 적지 않는다.
이 표는 **그 의미가 세계에 구현되어 있는가**만 본다 — 그것을 세계 안에서 **얻을 수 있는가**는
[growth/growth-graph.md](growth/growth-graph.md) 가 소유하는 다른 축이다 (GR §22.1 · §39).
Constraint Violation 과 혼동하지 않는다 — 여기는 **있는가/없는가**이지 **허용되는가**가 아니다.

## Possibility 별로 본 상태

어느 경로가 지금 얼마나 닫혀 있는가 — Frontier 는 이 표에서 고른다.

| Possibility | 요구 Capability 중 없는 것 | 비고 |
|---|---|---|
| MP-OUTGROW-THE-OPPONENT | **없음** (Capability 기준) | 요구 Capability 5종은 C010 으로 모두 섰다. 그러나 이 노드는 `resource: [능력치를 올릴 장비·성장의 원천]` 도 요구하며 **그것이 세계에 없다** — 능력치를 올리는 세계 내 행위가 0 이다 (growth/growth-graph.md 실측). 성장 전후를 볼 수는 있으나 **성장할 수는 없다** |
| MP-TRADE-BODY-FOR-RESOURCE | **없음** | **C011 로 닫혔다** — 요구 Capability 4종이 모두 IMPLEMENTED. 이 경로는 지금 플레이 가능하다 |
| MP-READ-AND-COUNTER | MC-PERFECT-GUARD · MC-COUNTER | C011 이 MC-GUARD 를 채워 셋에서 둘로 줄었다. R1 §15 층 그림에서 Active Defense 는 Penetration 위다 |
| MP-EVADE-BY-MOVING-THE-BODY | MC-EVADE | R1 §13 이 Dodge 를 이후 확장으로만 지정 — §14 순서에 자리가 없다 |
| MP-BREAK-THE-GUARD | MC-BREAK | R1 §14 Active Defense 층 — 그 층의 설계 문서 대기 |
| MP-EXPLOIT-OPEN-BODY | MC-COMBAT-FLOW | R1 §14 Aura/Nen 층으로 이연 |
| MP-MATCH-WEAPON-TO-ARMOR | **없음** | **C012 로 닫혔다** — 요구 Capability 2종과 지식 1종이 모두 섰다. 이 경로는 지금 플레이 가능하다 |
| MP-PIERCE-THE-HARD-DEFENSE | **없음** (Capability 기준) | **C013 으로 닫혔다** — 요구 Capability 4종과 지식 1종이 모두 섰다. 다만 관통을 **얻는** 경로가 세계에 없어 플레이어가 이 경로를 고를 수는 없다 (MP-OUTGROW 와 같은 결손) |
| MP-HOLD-FORTIFIED | MC-FORTIFY · MC-COMBAT-FLOW | R1 §14 Aura/Nen 층으로 이연 (MC-DEFENSE-MITIGATION 은 C010 으로 채워졌다) |
| MP-STAKE-EVERYTHING-ON-ONE-BLOW | MC-VOW · MC-CONDITION-STACKING · MC-COMBAT-FLOW | R1 §14 Aura/Nen 층 — 가장 멀다 |

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
