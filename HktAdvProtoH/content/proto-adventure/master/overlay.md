# Capability Overlay

Master Graph 를 현재 `world/` `view/` 구현과 겹쳐 본 결과다. 기본 절차 **NEED** 단계의
산출물이며, NEXT(Frontier) 는 여기서 나온다.

각 노드의 `world_shape`(그 의미가 세계에 있다는 것을 무엇으로 확인하는가)가 판정 기준이고,
이 문서는 그 칸이 지금 닫혀 있는가만 답한다.

    기준 시점   C015(증폭) · C016(통찰) 완료 — 전투 사다리는 Critical 층까지,
                탐험은 FRINGE 의 첫 칸(살펴봄 + 그것에 이르는 두 경로)까지 서 있다
    근거 문서   전투 R1 · DT · 탐험 BW · 성장 GR · 지목 TG — 근거는 영역을 넘지 않는다 (HISTORY Q15)

해당 영역 문서가 이름조차 대지 않는 Capability 는 "없는 것" 이 아니라 **노드가 아니다** —
표에서 삭제한다.

## 판정 기준

```text
IMPLEMENTED   그 의미를 닫은 Cycle 이 있고 08-verification 이 실측으로 통과했다
PARTIAL       일부만 닫혔거나, 닫혔지만 이번 Possibility 가 요구하는 형태에 못 미친다
MISSING       세계에 그 의미가 없다
```

근거 칸에는 Cycle ID 또는 코드 실측을 적는다. **주장만 적지 않는다.**
Constraint Violation 과 혼동하지 않는다 — 여기는 **있는가/없는가**이지 **허용되는가**가 아니다.

## Capability — 전투 영역

| Capability | 상태 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-COMBAT-STRIKE | IMPLEMENTED | C007 · C010 이 피해 산정을 하나의 공식으로 교체 | — |
| MC-BODY-FACING | IMPLEMENTED | C006 — 몸이 향한 방향이 막기 판정에 쓰인다 | — |
| MC-CP-ECONOMY | PARTIAL | C007 · C011 — 기력을 쓰는 자리가 셋(고급 스킬·달리기·막기)이라 공격과 방어가 실제로 경쟁한다 | **기력이 스스로 돌아오지 않는다.** 회복 경로는 "타격을 성공시킨다" 하나뿐이라, 빗나가면 아무것도 벌지 못하고 쉬어도 차지 않는다 |
| MC-COMBAT-CAUSE-READING | IMPLEMENTED | 코드 대조 — 모든 타격이 고른 능력치 이름·값, 기본 피해, 공격 기여, 방어 값, 관통, 유효 방어, 감쇄 배율, 최종·적용 피해, 막기 결과까지 관찰에 싣는다 | — (승격 확인 대기 · open-questions.md) |
| MC-ATTACK-POWER | PARTIAL | C010 — 공격력 40→80 변경이 피해 20→35 로 실측 | **세계 안에서 이 값을 올릴 방법이 없다.** 장착할 장비도, 될 Class 도, 배울 상대도 없고 디버그 명령이 유일한 경로다 |
| MC-SKILL-SCALING | IMPLEMENTED | C010 — 계수가 큰 스킬이 같은 공격 증가에 더 크게 자라는 것이 실측 | — |
| MC-DEFENSE-MITIGATION | IMPLEMENTED | C010 — 방어 0/100/200/300 에서 피해 26/13/9/7, 감소폭 단조 감소, 극단값에서도 최소 1 | — (이것은 **수동 감쇄**다. 막는 행동은 MC-GUARD 로 별개) |
| MC-ATTACK-ARMOR-MATCHUP | IMPLEMENTED | C012 — 같은 스킬 값이 상대에 따라 20/14 ↔ 17/22 로 갈리는 것이 실측 | — |
| MC-GUARD | IMPLEMENTED | C011 — 막기가 행동으로 존재하고 정면 판정이 방향을 가르며, 막힌 타격이 절반으로 줄고 기력을 치르며, 기력이 마르면 방어가 무너진다 | — |
| MC-PENETRATION | IMPLEMENTED | C013 — 마주한 방어가 90 → 56.25 로 깎이고, 마주하지 않은 방어는 그대로이며(물리 20 유지), 두꺼울수록 걷어내는 양이 커지고(0/7.5/33.75/112.5), 극단값에서도 방어가 남는다 | — (C013 Human Play 대기 · open-questions.md) |
| MC-BREAK | PARTIAL | 코드 대조 — 막는 기력이 모자라면 방어가 풀리고 일정 시간 다시 세우지 못하며 그 타격은 그대로 들어간다 (C011) | 무너뜨리기 위한 **행동**이 없다. 지금은 상대가 자원을 다 쓴 결과로만 일어나므로 플레이어가 만들어 내는 구간이 아니다 |
| MC-CONDITION-STACKING | PARTIAL | 코드 대조 — 조건들을 곱해 합성하고 상·하한으로 묶는 얼개가 있다 | 조건의 출처가 둘(달리는 중·피격 중)뿐이고 둘 다 기력 회복량에만 작용한다. 이름 붙은 조건도, 지속 시간도, 겹침도, 플레이어가 조건을 **만드는** 수단도 없다 |
| MC-CRITICAL-STRIKE | IMPLEMENTED | C015 — 같은 조건 다섯 대에서 [20, 20, 40, 40, 20] 이 실측되고, 성질을 바꾸면 빈도·크기가 각각 달라지며, 발생 여부·확률·배율·증폭 전 값 넷이 모든 타격의 계산 경위에 실린다 | — (성질을 **올릴** 경로는 이 노드가 아니라 MP-BET-ON-THE-CRITICAL-BLOW 의 `requires.resource` 가 진다 — 아래 Possibility 표) |
| MC-PERFECT-GUARD | MISSING | — | 막기는 있으나 **시작 시각**이 판정에 쓰이지 않는다. 막기는 켜 두는 자세이고 결과는 막힘/무너짐 둘뿐이다 (R1 §14 Active Defense 층) |
| MC-COUNTER | MISSING | — | 취약 상태(Exposed)라는 개념이 없다 (R1 §14 Active Defense 층) |
| MC-EVADE | MISSING | — | 회피 행동이 없다. 다만 공격이 이미 공간 판정이라 얹힐 바닥은 서 있다 (R1 §13 이연) |
| MC-COMBAT-FLOW | MISSING | — | 공격/방어에 힘을 배분하는 상태가 없다 (R1 §14 Aura/Nen 층) |
| MC-FORTIFY | MISSING | — | 배분이 없으므로 방어 쪽에 몰아 둔 자세도 없다 (R1 §14 Aura/Nen 층) |
| MC-VOW | MISSING | — | 제약·실패 대가가 없다 (R1 §14 Aura/Nen 층) |

## Capability — 탐험 영역 (BW)

현재 세계는 무대 하나짜리 전투 프로토타입이다. 지역·이동 범위·생태·환경 위험·자원
순환의 의미가 거의 없어 BW 유래 Capability 는 대부분 MISSING 이다. 다만 이전 판정이
**"전부 MISSING" 이라고 뭉뚱그린 것은 부정확했다** — 아래 네 줄은 코드에 이미 얹힐
바닥이 있어 PARTIAL 로 정정한다.

| Capability (층) | 상태 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-REPOSITION (SAFE §20) | PARTIAL | 코드 대조 — 위치가 판정에 깊이 쓰인다: 휘두른 무기 끝이 훑는 궤적 안의 몸만 맞고, 막기는 정면에서 온 것만 막으며, 채집은 거리 안에서만 된다 | 유리한 자리를 **빠르게·의도적으로** 잡는 전용 수단. 걸어가서 만들 수는 있다 |
| MC-FORCE-MOVEMENT (DANGER §23) | PARTIAL | 코드 대조 — 타격이 상대를 때린 자리 바깥으로 밀어내고 그 힘이 관성·마찰로 이어진다 | **어디로** 보낼지 고르는 수단. 밀림 방향이 언제나 때린 자리의 반대쪽으로 고정이다 |
| MC-INTERRUPT (DANGER §23) | PARTIAL | 코드 대조 — 타격을 받으면 하던 행동이 끊기고 피격 동작으로 대체된다 | 끊는 것을 **노리는** 수단. 지금은 아무 타격에나 따라오는 부수 효과라 "언제 끊을까" 라는 판단이 없다 |
| MC-BREAK (WILD §22) | PARTIAL | 전투 표에서 판정 (같은 노드 재사용) | 위와 같음 |
| MC-OBSERVE (FRINGE §21) | PARTIAL | **C014 — 살펴봄이 행동으로 서고, 살펴보기 전에는 상대의 겨루는 힘을 모른다.** **C016 — 앎에 이르는 길이 둘(살펴봄 · 기른 통찰)이 되고, 앎이 존재 단위에서 자리 단위로 넓어졌다** | 남은 결손은 **하나**다: **행동·습성** — 자율 존재의 패턴을 읽는 의미가 없다 (MC-PREDICT 자리). 그 하나가 닫히면 IMPLEMENTED |
| MC-PREDICT (FRINGE §21) | MISSING | 코드 대조 — 예고 구간 자체는 **이미 있다**: 휘두름은 앞 구간을 지나서야 닿고(`world/semantic/collision.ts` SWING_BEGIN), 진행 중인 행동의 종류·진행도·칼끝이 계약에 실린다(`EntityView.state` · `progress` · `swing`) | 없는 것은 **읽을 거리**와 **앎의 관문** 둘이다. ① 자율 존재가 쓰는 스킬이 하나뿐이라(`world/simulation/npc-decide.ts` — 언제나 `attack`) 다음 행동에 고를 갈래가 없다 ② 그 앎이 살펴봄·통찰과 무관하게 누구에게나 그냥 온다 |
| MC-USE-TERRAIN (FRINGE §21) | MISSING | — | 지형이 없다 — 무대는 아무 성질도 없는 평평한 사각형 하나다 |
| MC-DISCOVER-WEAKNESS · MC-PRECISE-TARGETING · MC-CONTROL-SPACE (WILD §22) | MISSING | — | 약점 발견·부위 조준·공간 통제의 의미가 없다 |
| MC-READ-ENVIRONMENT · MC-USE-HAZARD (DANGER §23) | MISSING | — | 환경 위험이라는 개념 자체가 없다 — 피해의 출처는 타격 하나뿐이다 |
| MC-DISRUPT-ABILITY · MC-MAINTAIN-PRESSURE · MC-TARGET-SPECIFIC-PART · MC-READ-CREATURE-SYSTEM (DEEP §24) | MISSING | — | 재생·공생·부위라는 개념 자체가 없다 |
| MC-PROTECT-PERCEPTION · MC-VERIFY-REALITY · MC-IDENTITY-ANCHOR · MC-RESIST-INFLUENCE · MC-BREAK-BIOLOGICAL-LINK · MC-ESCAPE-ALTERED-SPACE (UNKNOWN §25) | MISSING | — | 지각·정체성·공간 변형이라는 개념 자체가 없다 |
| MC-RESTORE-BIOLOGICAL-STATE (자원 §8) | MISSING | — | 회복이라는 개념이 없다 — 생명은 줄기만 하고 되돌리는 경로는 디버그뿐이다 |
| MC-CUT-ABNORMAL-STRUCTURE (자원 §10 · §17) | MISSING | — | 제작·장착이 없고, 통하지 않는 구조라는 개념도 없다 |

## Capability — 지목·관계 영역 (TG · BW §21)

앞의 둘은 `design/Design-Targeting-R0.md` 주입으로, 마지막 하나는 Human 지시로 섰다
(HISTORY Q24(b)). 층(BW)에 속하지 않는다 — 어느 층에서든 "지금 누구에게 하는가" 와
"그것이 나를 어떻게 대하는가" 를 세계에 두는 자리다. 판정은 코드 대조로 했다.

| Capability | 상태 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-DESIGNATE-TARGET | MISSING | 코드 대조 — 요청마다 대상 Id 를 실어 보낼 수는 있으나(`protocol-core/actions.ts` targetEntityId) 세계가 "지금 이 관찰자가 누구를 고르고 있는가" 를 지니는 자리가 없다. 공격은 대상을 아예 받지 않고(`world/actions/interactions.ts`) 휘두른 자리에 닿은 몸이 맞는다 | 고른 관계 그 자체 · 그 관계를 살펴봄/채집/공격이 함께 쓰는 것 · 대상이 사라졌을 때의 정리 |
| MC-WATCH-TARGET | PARTIAL | 코드 대조 — 존재마다 살펴봄·채집의 가용 여부와 불가 사유가 이미 관찰에 실리고(`world/projection/observer-view.ts`), 이름·생명은 몸 위에 늘 보이며, 가려진 항목의 목록도 함께 온다 (C014 · C016) | 그 조각들이 **고른 대상 하나로 모이는 자리.** 지금은 대상별 사유가 흩어져 있어 "왜 지금 저것을 못 치는가" 를 한자리에서 읽을 수 없다 |
| MC-RELATION-STANCE | MISSING | 코드 대조 — 적대·중립·우호라는 개념이 하나도 없다. 휘두른 자리에 닿은 것은 무엇이든 맞고, 자율 존재는 인지 범위에 든 대상을 가리지 않고 쫓는다 (`world/simulation/npc-decide.ts`) | 존재 사이의 태도 그 자체 · 그 태도가 가르는 공격 가부 · 어느 쪽에서 본 태도인지 |

## World / Actor / Knowledge — 세계 자체는 얼마나 서 있는가

Capability 만 보면 전투가 꽤 찬 것처럼 보이지만, 그 전투가 놓일 **세계**가 거의 없다.
이 표가 그것을 드러낸다 (각 노드의 `implemented` 필드와 같은 값이다).

| Node | 상태 | 지금 세계에 있는 것 / 없는 것 |
|---|---|---|
| MW-PRIMAL-WORLD | PRESENT | 전제이므로 어긋나는 규칙이 없으면 성립 |
| MW-WORLD-PRESSURE · MW-FREE-PRESSURE · MW-BOUND-PRESSURE | ABSENT | 지역이라는 개념이 없어 "여기는 얼마나 변할 수 있는 곳인가" 가 표현될 자리가 없다 |
| MW-SAFE-FRONTIER | ABSENT | 안전한 곳과 위험한 곳의 구분이 없다 — 무대가 하나다 |
| MW-DEPTH-GRADIENT · MW-ZONE-WILD/DANGER/DEEP/UNKNOWN | ABSENT | 깊이도 층도 없다 |
| MW-ZONE-FRINGE | PARTIAL | 정면 전투력이 우위인 적대 존재는 있다. 그것이 사는 **층**이 없고, 우위를 힘 아닌 것으로 뒤집을 수단도 없다 |
| MW-HYPER-PREDATION · MW-SPATIAL-SHEAR | ABSENT | 대표 지역 둘 다 없다 |
| MA-PLAYER | PARTIAL | 몸이 한 종류로 고정이라 고를 갈래 자체가 없다 |
| MA-HOSTILE-COMBATANT | PARTIAL | 스스로 순찰·추격·공격하고 플레이어와 같은 전투 규칙을 쓴다. 지킬 영역 개념이 없어 순찰 경로가 곧 영역이다 |
| MK-LOCAL-WORLDSTATE | ABSENT | 지역이 없다. 다만 "모르는 상태" 라는 것 자체는 C014 로 세계에 생겼다 (살펴봄 이전) — 얹힐 바닥은 섰다 |
| MK-OPPONENT-DEFENSE-SHAPE | PRESENT | 방어 형태와 관통 반영값이 관찰에 실리고 (C012 · C013), 그것을 **알게 되는 과정**이 생겼다 — 살펴보기 전에는 가려져 있고 (C014), 통찰을 기르면 자리별로 열린다 (C016) |
| MK-OPPONENT-FLOW-PATTERN | ABSENT | 힘을 배분하는 상태가 없다 |

## Possibility 별로 본 상태

어느 경로가 지금 얼마나 닫혀 있는가 — Frontier 는 이 표에서 고른다.

### MG-OVERCOME-SUPERIOR-OPPONENT (10 갈래)

| Possibility | 요구 중 없는 것 | 비고 |
|---|---|---|
| MP-MATCH-WEAPON-TO-ARMOR | **없음** | **C012 로 닫혔다** — 지금 플레이 가능하다 |
| MP-PIERCE-THE-HARD-DEFENSE | **없음** | **C013 로 닫혔다** — 지금 플레이 가능하다. 다만 아직 좁다: 플레이어가 관통을 **얻는** 경로가 세계에 없다 (종류가 정한 값과 디버그뿐 — growth/growth-graph.md) |
| MP-OUTGROW-THE-OPPONENT | MC-ATTACK-POWER(PARTIAL) + 성장의 원천 | 능력치가 결과를 바꾸는 것은 닫혔으나 **그 값을 플레이로 올릴 수 없다.** 이전 판정 "닫혔다" 는 이 결손을 빠뜨렸다 |
| MP-BET-ON-THE-CRITICAL-BLOW | 요구 Capability 는 **없음** · `requires.resource` 미충족 | **C015 로 절반 닫혔다** — 증폭이 터지는 것과 그 경위가 다 보인다. 그러나 "준비로 기대값을 올린다" 는 나머지 절반이 남았다: Critical 성질을 올릴 성장·장비가 세계에 없어 경로가 종류 초기값과 디버그뿐이다 |
| MP-INTERRUPT | MC-INTERRUPT(PARTIAL) | **하나만 없고 그마저 절반 서 있다** — 끊김 규칙은 있고 노리는 수단만 없다. 현재 전투 세계 안에서 닫을 수 있다 |
| MP-BREAK-THE-GUARD | MC-BREAK(PARTIAL) | 무너지는 상태는 있고 무너뜨리는 행동만 없다 (R1 §14 Active Defense 층) |
| MP-READ-AND-COUNTER | MC-PERFECT-GUARD · MC-COUNTER | R1 §15 층 그림에서 Active Defense 는 Penetration 위이고 그 아래층은 C013 으로 섰다 — 이제 그 층의 설계 문서만 없다 |
| MP-EXPLOIT-OPEN-BODY | MC-COMBAT-FLOW | R1 §14 Aura/Nen 층 |
| MP-CONTROL-MOVEMENT | MC-CONTROL-SPACE + MC-FORCE-MOVEMENT·MC-REPOSITION(둘 다 PARTIAL) | 셋 중 둘이 절반 서 있다 |
| MP-STAKE-EVERYTHING-ON-ONE-BLOW | MC-VOW · MC-COMBAT-FLOW + MC-CONDITION-STACKING(PARTIAL) | Aura/Nen 층 — 가장 멀다 |
| MP-WEAPONIZE-ENVIRONMENT | MC-READ-ENVIRONMENT · MC-USE-HAZARD + MW-ZONE-DANGER | 환경 위험 개념 자체가 없다 |

### MG-SURVIVE-ENEMY-OFFENSIVE (3 갈래)

| Possibility | 요구 중 없는 것 | 비고 |
|---|---|---|
| MP-TRADE-BODY-FOR-RESOURCE | **없음** | **C011 로 닫혔다** — 지금 플레이 가능하다 |
| MP-EVADE-BY-MOVING-THE-BODY | MC-EVADE | R1 §13 이 이후 확장으로만 지정 |
| MP-HOLD-FORTIFIED | MC-FORTIFY · MC-COMBAT-FLOW | Aura/Nen 층 |

### MG-EXPLORE-BEIRA (3 갈래)

층 진입은 더 이상 Possibility 가 아니다 — 층은 세계 상태이고 그 요구는 `demands` 가
소유한다 (HISTORY Q21). 여기 셋은 **어떻게 감당하는가**다.

| Possibility | 요구 중 없는 것 | 비고 |
|---|---|---|
| MP-LEARN-TO-HANDLE-THE-LAYER | MC-PREDICT · MC-DESIGNATE-TARGET · MC-RELATION-STANCE (+ MC-OBSERVE · MC-WATCH-TARGET 는 PARTIAL) | **C014·C016 이 첫 칸을 세웠다** — 살펴봄이 서고 거기에 이르는 길이 둘이 되었다. 남은 것은 둘째 칸(예측) 하나이며 그것이 MC-OBSERVE 의 마지막 결손과 같은 자리다. 탐험의 기본 갈래이자 다른 둘의 앞이다 (먼저 겪은 사람이 없으면 살 정보도 가져올 자원도 없다). TG 주입으로 지목 둘이, Human 지시로 관계 하나가 더해졌다 (HISTORY Q24 · Q27) |
| MP-ADAPT-BY-RESOURCE | MC-RESTORE-BIOLOGICAL-STATE · MC-CUT-ABNORMAL-STRUCTURE + MK-LOCAL-WORLDSTATE + 자원 | **설계상 획득 경로는 Q22 로 섰다** (경계결정 → IM-BOUNDARY-EDGED). 세계에 제작·장착이 없다 |
| MP-PREPARE-IN-CIVILIZATION | MK-LOCAL-WORLDSTATE + MW-SAFE-FRONTIER + 관계·대가 | 요구 Capability 가 없다 (BW §14 는 활동만 열거) — 막는 것은 능력이 아니라 문명권·거래라는 세계 기반이다 |

### 층이 요구하는 것 — MW-ZONE-* 의 demands

각 층을 감당하려면 무엇이 있어야 하는가. 위 세 방법 중 무엇으로 채우든 상관없다.

| 층 | demands | 지금 채워진 것 |
|---|---|---|
| MW-SAFE-FRONTIER (§20) | MC-COMBAT-STRIKE · MC-GUARD · MC-EVADE · MC-REPOSITION | 2 / 4 (EVADE 없음 · REPOSITION 절반) |
| MW-ZONE-FRINGE (§21) | MC-OBSERVE · MC-PREDICT · MC-USE-TERRAIN | 1 / 3 (OBSERVE 절반) |
| MW-ZONE-WILD (§22) | MC-BREAK · MC-DISCOVER-WEAKNESS · MC-PRECISE-TARGETING · MC-CONTROL-SPACE | 0 / 4 (BREAK 절반) |
| MW-ZONE-DANGER (§23) | MC-READ-ENVIRONMENT · MC-FORCE-MOVEMENT · MC-USE-HAZARD · MC-INTERRUPT | 0 / 4 (FORCE-MOVEMENT · INTERRUPT 절반) |
| MW-ZONE-DEEP (§24) | MC-DISCOVER-WEAKNESS · MC-DISRUPT-ABILITY · MC-MAINTAIN-PRESSURE · MC-TARGET-SPECIFIC-PART · MC-READ-CREATURE-SYSTEM | 0 / 5 |
| MW-ZONE-UNKNOWN (§25) | MC-PROTECT-PERCEPTION · MC-VERIFY-REALITY · MC-IDENTITY-ANCHOR · MC-RESIST-INFLUENCE · MC-BREAK-BIOLOGICAL-LINK · MC-ESCAPE-ALTERED-SPACE | 0 / 6 |

### MG-ACQUIRE-RARE-ORGAN (5 갈래)

| Possibility | 요구 중 없는 것 | 비고 |
|---|---|---|
| MP-KILL-CREATURE | 상위 Goal 은 열려 있음 | 쓰러뜨리는 것까지는 된다. **쓰러진 몸에서 아무것도 나오지 않고** 그 몸은 치워지지도 않아 영구 장애물로 남는다 |
| MP-TAKE-SHED-ORGAN · MP-TRADE-WITH-ACTOR · MP-FIND-DEAD-SPECIMEN · MP-FORCE-CREATURE-TO-RELEASE | **판정 불가 — requires 미배선** | BW §27 은 대안 구조만 공급했다. 요구 배선(OPTIONS/NEED)이 끝나야 판정된다 |

## 지금 세계에서 가장 큰 구멍

표 전체를 관통하는 것이 셋 있다. 개별 Capability 결손이 아니라 구조적 공백이다.

```text
1. 자원이 아무 일도 하지 않는다  (설계는 섰고 구현이 비었다)
   광석 하나를 캘 수 있고 세어진다. 그것으로 만들 것도, 장착할 것도, 팔 것도 없다.
   Q22 로 광물 계통과 grants 3건이 그래프에 섰으므로 BW §17 순환은 **설계에서는**
   닫혔다 (growth/growth-graph.md). 세계에는 제작·장착·거래 규칙이 하나도 없다.

2. 성장이 세계 밖에 있다
   능력치가 결과를 바꾸는 것은 닫혔지만 그 값을 올리는 유일한 경로가 디버그 명령이다.
   MP-OUTGROW-THE-OPPONENT 가 "닫힌 경로" 로 보였던 것은 이 구분을 놓쳤기 때문이다.

3. 앞날을 읽을 것이 없다  (C014·C016 으로 "지금" 은 읽히게 되었다)
   C014 가 "살펴보기 전에는 겨루는 힘을 모른다" 를 세우고 C016 이 거기 이르는 두 번째
   길(통찰)과 자리별 부분 공개를 세웠다 — BW §32 사슬의 첫 칸이 섰다.
   남은 것은 둘째 칸이다. 자율 존재의 다음 행동이 언제나 같은 한 가지라 읽을 거리가
   없고, 행동의 앞 구간이 앎의 관문과 무관하게 누구에게나 그냥 온다.
   발견·검증은 그 뒤에 얹힌다.
```

## 갱신 경로

```text
cycles/<CycleId>/08-verification.md 의 MASTER FEEDBACK
        ↓
guides/master-feedback.md (Feedback — 위쪽 접합점 반영)
        ↓
이 파일 + graph/ 각 노드의 overlay / implemented 필드
        ↓
갱신 내역은 HISTORY.md 로 (이 파일에는 현재 상태만 남긴다)
```

Cycle Agent 가 이 파일을 직접 편집하지 않는다.
