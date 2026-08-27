# Capability Overlay

<!-- 생성물 — 손으로 고치지 않는다. 원본: graph/*.yaml 노드 필드 + graph/overlay-notes.yaml · 재생성: npm run master:graph -->

Master Graph 를 현재 `world/` `view/` 구현과 겹쳐 본 결과다. 기본 절차 **NEED** 단계의
산출물이며, NEXT(Frontier) 는 여기서 나온다.

각 노드의 `world_shape`(그 의미가 세계에 있다는 것을 무엇으로 확인하는가)가 판정 기준이고,
이 문서는 그 칸이 지금 닫혀 있는가만 답한다.

    기준 시점   C024(한 자리에는 하나) 닫힘.
                전투 사다리는 Critical 층까지, 탐험은 FRINGE 의 첫 칸까지 서 있고,
                그 위에 고른 대상(C017) · 둘 사이의 태도(C018) · 행동 안의 시점(C019)이
                얹혔다.
                **세계에 처음으로 가진 것이 사라지는 경로가 생겼고 (C020)**,
                **그것을 담을 곳이 유한해졌으며 (C022)**,
                **지닌 것과 몸에 적용된 것이 갈렸고 (C023)**,
                **걸어 둔 것을 바꾸는 것이 한 동작이 되었다 (C024)** — 물건이 정의소를
                갖고, 써서 상대의 상태를 바꾸며, 쓴 만큼 줄고, 담을 자리가 차면 더 받지
                못하고, 걸어 둔 것만이 몸의 값과 할 수 있는 일을 바꾸며,
                **가방이 가득해도 바꿔 끼는 것은 된다**.
                그 위에 C025(휘두름의 모양이 값이 된다)와 **C026(가진 것을 여는 자리)**
                가 얹혔다 — 뒤의 것은 이 표에 줄도 상태도 더하지 않는다
    근거 문서   전투 R1 · DT · 탐험 BW · 성장 GR · 지목 TG · 아이템 IS · 인벤토리 IE ·
                스킬 SK — 근거는 영역을 넘지 않는다 (HISTORY Q15)

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

SK(스킬) 주입은 이 표에 **줄을 하나도 더하지 않았다.** 그 문서는 효과가 대상에
닿는 방식(실행 형태)만 공급하고 그 형태를 요구하는 Possibility 는 공급하지 않기 때문에,
지금 세우면 required_by 와 demanded_by 가 둘 다 빈 노드가 된다 (SCHEMA — 그런 것은
노드가 아니다). 대신 그 자리들이 `graph/systems.yaml` 의 MS-SKILL-FORM 에 등록되어
있고, 그중 **접촉(CONTACT)** 한 칸만 이미 차 있다 — MC-COMBAT-STRIKE 가 그 칸이다.
C025 로 그 칸의 **모양이 값이 되었다** — 남은 다섯 칸이 서면 그 축을 새로 만들지 않고
재사용한다. 다만 그것이 남은 칸을 여는 것은 아니다: 막는 것은 형상이 아니라
**요구하는 Possibility 가 없다**는 쪽이다 (Q35 의 7 조건 2).
자리의 수는 열넷에서 **여섯**으로 줄었다 — SK 가 투사체 · 장판 · 부착 영역 · 이동 영역 ·
함정 · 자취를 서로 다른 형태가 아니라 **같은 공간 존재의 값 차이**로 되돌렸기 때문이다
(SK §4 · §5). 연쇄 · 이동 결합 · 소환은 아예 이 사다리의 자리가 아니게 되었다 —
앞의 둘은 기존 실행의 반복이고, 소환은 존재를 하나 더 세우는 일이다.
나머지 다섯 칸이 왜 비어 있는지, 무엇이 그것을 요구하게 될지는 open-questions Q35 다.

**UL(전투 상층) 주입은 이 표에 아홉 줄을 더했다.** SK 와 반대인데, 이유는 UL 이
Capability 만이 아니라 그것을 요구하는 갈래까지 함께 공급했기 때문이다 — 힘을
몰아 두는 갈래 · 계약으로 묶는 갈래 · 상대의 규칙을 알아내는 갈래 · 받아낸 것을
저장하는 갈래 넷이 Possibility 표에 함께 섰다.
R1 이 이름만 댔던 위 두 칸이 열리면서 기존 다섯 줄의 성격도 바뀌었다 —
MC-PERFECT-GUARD · MC-COUNTER · MC-EVADE · MC-VOW · MC-DISRUPT-ABILITY 가
`grounded: false`(이름만) 에서 `true`(정의됨)로 올라섰다. 특히 MC-VOW 는 뜻이
달라졌다: 제약이 사는 것이 더 큰 위력이 아니라 **평소에는 허락되지 않는 행동**이다
(UL §20). 자리의 목록은 `graph/systems.yaml` 의 MS-ACTIVE-DEFENSE(셋) ·
MS-AURA-NEN(넷)이 소유한다.
아홉 중 여덟이 MISSING 이고 하나만 PARTIAL 이다 — 못 쓰는 사유를 세계가 골라
하나 내보내는 자리가 이미 있기 때문이다 (`view/skill-presentation.ts`).
**세우지 않은 것이 하나 있다** — 아군에게 가는 공격을 자신이 받는 조작(UL §9 · §27)은
세계에 아군이 없어 요구하는 갈래를 만들 수 없었다 (open-questions Q60).

| Capability | 상태 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-COMBAT-STRIKE | IMPLEMENTED | C007 · C010 이 피해 산정을 하나의 공식으로 교체. C025 가 휘두름의 **모양**(각·길이·굵기)을 전역 상수에서 기술 정의로 내려 이 노드에 걸린 마지막 UNRESOLVED 를 닫았다 | — |
| MC-BODY-FACING | IMPLEMENTED | C006 — 몸이 향한 방향이 막기 판정에 쓰인다 | — |
| MC-CP-ECONOMY | PARTIAL | C007 · C011 — 기력을 쓰는 자리가 셋(고급 스킬·달리기·막기)이라 공격과 방어가 실제로 경쟁한다 | **기력이 스스로 돌아오지 않는다.** 회복 경로는 "타격을 성공시킨다" 하나뿐이라, 빗나가면 아무것도 벌지 못하고 쉬어도 차지 않는다 |
| MC-COMBAT-CAUSE-READING | IMPLEMENTED | 코드 대조 — 모든 타격이 고른 능력치 이름·값, 기본 피해, 공격 기여, 방어 값, 관통, 유효 방어, 감쇄 배율, 최종·적용 피해, 막기 결과까지 관찰에 싣는다 | — (승격 확인 대기 · open-questions.md) |
| MC-ATTACK-POWER | PARTIAL | C010 — 공격력 40→80 변경이 피해 20→35 로 실측. **C023 으로 세계 안의 첫 경로가 생겼다** — 곡괭이를 걸면 물리 공격 40 → 52 가 플레이로 관찰되고, 풀면 정확히 40 으로 돌아온다 (C023 08 PLAYABLE ④·⑧) | **값을 키우는 축이 없다.** 물건으로 값이 *달라지는* 것은 섰으나 그것을 *키우는* 것 — 될 Class 도, 배울 상대도, 자라는 경로도 — 은 여전히 없다. 물건 쪽은 **C024 로 둘이 되었으나**(곡괭이 물리 공격 +12 · 손방패 물리 방어 +15) 그 둘은 서로 바꿔 끼는 관계이지 쌓이는 관계가 아니다 |
| MC-SKILL-SCALING | IMPLEMENTED | C010 — 계수가 큰 스킬이 같은 공격 증가에 더 크게 자라는 것이 실측 | — |
| MC-DEFENSE-MITIGATION | IMPLEMENTED | C010 — 방어 0/100/200/300 에서 피해 26/13/9/7, 감소폭 단조 감소, 극단값에서도 최소 1 | — (이것은 **수동 감쇄**다. 막는 행동은 MC-GUARD 로 별개) |
| MC-ATTACK-ARMOR-MATCHUP | IMPLEMENTED | C012 — 같은 스킬 값이 상대에 따라 20/14 ↔ 17/22 로 갈리는 것이 실측 | — |
| MC-GUARD | IMPLEMENTED | C011 — 막기가 행동으로 존재하고 정면 판정이 방향을 가르며, 막힌 타격이 절반으로 줄고 기력을 치르며, 기력이 마르면 방어가 무너진다 | — |
| MC-PENETRATION | IMPLEMENTED | C013 — 마주한 방어가 90 → 56.25 로 깎이고, 마주하지 않은 방어는 그대로이며(물리 20 유지), 두꺼울수록 걷어내는 양이 커지고(0/7.5/33.75/112.5), 극단값에서도 방어가 남는다 | — (C013 Human Play 대기 · open-questions.md) |
| MC-BREAK | PARTIAL | 코드 대조 — 막는 기력이 모자라면 방어가 풀리고 일정 시간 다시 세우지 못하며 그 타격은 그대로 들어간다 (C011) | 무너뜨리기 위한 **행동**이 없다. 지금은 상대가 자원을 다 쓴 결과로만 일어나므로 플레이어가 만들어 내는 구간이 아니다 |
| MC-CONDITION-STACKING | PARTIAL | 코드 대조 — 조건들을 곱해 합성하고 상·하한으로 묶는 얼개가 있다 | 조건의 출처가 둘(달리는 중·피격 중)뿐이고 둘 다 기력 회복량에만 작용한다. 이름 붙은 조건도, 지속 시간도, 겹침도, 플레이어가 조건을 **만드는** 수단도 없다 |
| MC-CRITICAL-STRIKE | IMPLEMENTED | C015 — 같은 조건 다섯 대에서 [20, 20, 40, 40, 20] 이 실측되고, 성질을 바꾸면 빈도·크기가 각각 달라지며, 발생 여부·확률·배율·증폭 전 값 넷이 모든 타격의 계산 경위에 실린다 | — (성질을 **올릴** 경로는 이 노드가 아니라 MP-BET-ON-THE-CRITICAL-BLOW 의 `requires.resource` 가 진다 — 아래 Possibility 표) |
| MC-PERFECT-GUARD | MISSING | — | 막기는 있으나 **시작 시각**이 판정에 쓰이지 않는다. 막기는 켜 두는 자세이고 결과는 막힘/무너짐 둘뿐이다 (R1 §14 Active Defense 층). 다만 C019 로 **행동 안의 시점을 읽는 규칙**이 세계에 생겨 얹힐 바닥은 섰다 |
| MC-COUNTER | MISSING | — | 취약 상태(Exposed)라는 개념이 없다 (R1 §14 Active Defense 층) |
| MC-EVADE | MISSING | — | 회피 행동이 없다. 다만 공격이 이미 공간 판정이라 얹힐 바닥은 서 있다 (R1 §13 이연). C025 로 그 공간이 **기술마다 달라졌다** — 피할 대상이 하나가 아니므로 회피가 설 때 다룰 것이 늘었다 |
| MC-FORTIFY | MISSING | — | 배분이 없으므로 몸 쪽에 몰아 둔 자세도 없다. 배분(MC-AURA-ALLOCATION)이 먼저 서야 한다 |
| MC-VOW | MISSING | — | 제약·실패 대가가 없다 (R1 §14 Aura/Nen 층). UL §21 이 요구하는 세 부분 중 세계에 있는 것은 **하나도 없다** — 제약을 선언하는 자리도, 그것이 여는 행동도, 위반 판정도 없다 |
| MC-ACTIVE-RESPONSE | MISSING | — | 공격이 닿는 순간에 실행하는 행동이라는 개념이 없다. 막기는 미리 켜 두는 자세이고, 켠 뒤에는 받는 쪽이 개입할 자리가 없다 (`world/semantic/combat.ts` 의 `GuardOutcome`). 얹힐 바닥은 하나 서 있다 — C019 로 행동 안의 시점을 읽는 규칙이 생겼다 |
| MC-PRECISION-RESPONSE | MISSING | — | 대응 자체가 없으므로 그 시점 축도 없다. 다만 C019 가 행동 안의 시점을 읽는 규칙을 세워 두어, 판정에 쓸 시각은 세계에 이미 있다 |
| MC-OPPORTUNITY | MISSING | — | 기회라는 개념이 없고, 같은 자리의 행동이 상황에 따라 다른 것으로 바뀌는 규칙도 없다 |
| MC-ABSORB | MISSING | — | 막힌 피해는 줄어들 뿐 어디에도 남지 않는다 (`world/semantic/combat.ts` — 막힌 타격이 남기는 비율만 있다). 받아낸 것이 값으로 저장되는 자리가 없다 |
| MC-AURA-ALLOCATION | PARTIAL | C-COMBAT-001 08-verification 의 WORLD SCENARIO · PLAYABLE — 배분이 이름 붙은 상태로 있고, 전투 중 하나를 고르는 것으로만 바뀌며, 유효 값에 항으로 들어가고, 자기에게도 상대에게도 보인다 | 배분이 **값만 바꾸고 무엇을 할 수 있는가의 목록을 바꾸지 않는다.** semantic 의 절반(UL §15 — 인지를 일정 이상 몰아야 숨은 것이 보이는 식의 가능 여부 갈림)이 아직 없고, 조건 관문(FR-THE-WORLD-DECIDES-WHAT-IS-POSSIBLE)이 서야 닫힌다 |
| MC-ABILITY-CONDITION | PARTIAL | 코드 대조 — 못 쓰는 사유를 세계가 골라 하나 내보내는 자리가 이미 있다 (`view/skill-presentation.ts` 의 `unavailableReason` · 인벤토리·장비도 같은 칸을 쓴다) | 그 사유의 원천이 전부 자기 조건이다 — 자원이 모자라거나 거리가 멀거나 장착하지 않았거나. 세계의 사실(상대가 나를 먼저 쳤는가 · 표식이 있는가)이 능력의 가능 여부를 여는 자리가 없다 |
| MC-MARK | MISSING | — | 대상에 남는 표식이라는 개념이 없다. 존재 사이에 남는 것은 태도(C018)와 지목(C017)뿐이고, 둘 다 거는 쪽의 상태이지 걸린 쪽에 붙은 것이 아니다 |
| MC-BIND | MISSING | — | 존재 사이를 잇는 실체가 없고, 남의 행동 범위를 줄이는 규칙도 없다. 관계는 태도 하나뿐이고 (C018) 그것은 칠 수 있는가만 가른다 |
| MC-OBSERVE-ABILITY | MISSING | — | 상대가 가진 능력이라는 것이 세계에 없다 — 적대 존재는 하나의 행동만 하고 그것에 규칙도 조건도 없다. 알아낼 대상 자체가 서지 않았다 |
| MC-DRAIN | MISSING | — | 상대가 유한하게 가진 것이 세계에 없다 — 기력은 자기 것만 줄고, 남의 것을 옮기는 규칙이 하나도 없다 |

## Capability — 탐험 영역 (BW)

현재 세계는 무대 하나짜리 전투 프로토타입이다. 지역·이동 범위·생태·환경 위험·자원
순환의 의미가 거의 없어 BW 유래 Capability 는 대부분 MISSING 이다. 다만 이전 판정이
**"전부 MISSING" 이라고 뭉뚱그린 것은 부정확했다** — 아래 네 줄은 코드에 이미 얹힐
바닥이 있어 PARTIAL 로 정정한다.

| Capability | 상태 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-REPOSITION (SAFE §20) | PARTIAL | 코드 대조 — 위치가 판정에 깊이 쓰인다: 휘두른 무기 끝이 훑는 궤적 안의 몸만 맞고, 막기는 정면에서 온 것만 막으며, 채집은 거리 안에서만 된다 | 유리한 자리를 **빠르게·의도적으로** 잡는 전용 수단. 걸어가서 만들 수는 있다 |
| MC-FORCE-MOVEMENT (DANGER §23) | PARTIAL | 코드 대조 — 타격이 상대를 때린 자리 바깥으로 밀어내고 그 힘이 관성·마찰로 이어진다 | **어디로** 보낼지 고르는 수단. 밀림 방향이 언제나 때린 자리의 반대쪽으로 고정이다 |
| MC-INTERRUPT (DANGER §23) | IMPLEMENTED | **C019 — 끊김이 선딜 구간에만 성립한다.** 기술마다 다른 선딜(기본 0.15초 · 큰 기술 0.45초), 세계가 판정해 싣는 구간, 같은 개입이 시점만으로 갈리는 것(0.49 캔슬 ↔ 0.51 그대로)이 실측되었다. 캔슬된 기술은 피해 0 이 아니라 산정 자체가 없다 | — (`part_of.grounded: true` 의 근거였던 C002 의 부수 효과가 이제 **노리는 수단**이 되었다) |
| MC-BREAK (WILD §22) | PARTIAL | 코드 대조 — 막는 기력이 모자라면 방어가 풀리고 일정 시간 다시 세우지 못하며 그 타격은 그대로 들어간다 (C011) | 무너뜨리기 위한 **행동**이 없다. 지금은 상대가 자원을 다 쓴 결과로만 일어나므로 플레이어가 만들어 내는 구간이 아니다 |
| MC-OBSERVE (FRINGE §21) | PARTIAL | **C014 — 살펴봄이 행동으로 서고, 살펴보기 전에는 상대의 겨루는 힘을 모른다.** **C016 — 앎에 이르는 길이 둘(살펴봄 · 기른 통찰)이 되고, 앎이 존재 단위에서 자리 단위로 넓어졌다** | 남은 결손은 **하나**다: **행동·습성** — 자율 존재의 패턴을 읽는 의미가 없다 (MC-PREDICT 자리). 그 하나가 닫히면 IMPLEMENTED. **그 자리는 보류(Human)** — AI 기획서를 기다린다 (frontier "지금 열 수 없는 것") |
| MC-PREDICT (FRINGE §21) | MISSING | 코드 대조 — 예고 구간 자체는 **이미 있다**: 휘두름은 앞 구간을 지나서야 닿고(`world/semantic/collision.ts` SWING_BEGIN), 진행 중인 행동의 종류·진행도·칼끝이 계약에 실린다(`EntityView.state` · `progress` · `swing`) | 없는 것은 **읽을 거리**와 **앎의 관문** 둘이다. ① 자율 존재가 쓰는 스킬이 하나뿐이라(`world/simulation/npc-decide.ts` — 언제나 `attack`) 다음 행동에 고를 갈래가 없다 ② 그 앎이 살펴봄·통찰과 무관하게 누구에게나 그냥 온다. **다만 노드의 semantic 자체가 잠정이다 (`part_of.grounded: false` — BW §21 은 이름만 댄다) — 보류(Human), AI 기획서 대기** |
| MC-USE-TERRAIN (FRINGE §21) | MISSING | — | 지형이 없다 — 무대는 아무 성질도 없는 평평한 사각형 하나다 |
| MC-DISCOVER-WEAKNESS · MC-PRECISE-TARGETING · MC-CONTROL-SPACE (WILD §22) | MISSING | — | 약점 발견·부위 조준·공간 통제의 의미가 없다 |
| MC-READ-ENVIRONMENT · MC-USE-HAZARD (DANGER §23) | MISSING | — | 환경 위험이라는 개념 자체가 없다 — 피해의 출처는 타격 하나뿐이다 |
| MC-DISRUPT-ABILITY · MC-MAINTAIN-PRESSURE · MC-TARGET-SPECIFIC-PART · MC-READ-CREATURE-SYSTEM (DEEP §24) | MISSING | — | 재생·공생·부위라는 개념 자체가 없고, 능력을 봉인한다는 개념도 없다 — 지금 세계에서 못 쓰는 사유는 자원·거리·장착 같은 자기 조건뿐이고 **남이 걸어 둔 것** 때문에 못 쓰는 자리가 없다 |
| MC-PROTECT-PERCEPTION · MC-VERIFY-REALITY · MC-IDENTITY-ANCHOR · MC-RESIST-INFLUENCE · MC-BREAK-BIOLOGICAL-LINK · MC-ESCAPE-ALTERED-SPACE (UNKNOWN §25) | MISSING | — | 지각·정체성·공간 변형이라는 개념 자체가 없다 |
| MC-RESTORE-BIOLOGICAL-STATE (자원 §8) | MISSING | — | 회복이라는 개념이 없다 — 생명은 줄기만 하고 되돌리는 경로는 디버그뿐이다 |
| MC-CUT-ABNORMAL-STRUCTURE (자원 §10 · §17) | MISSING | — | 제작·장착이 없고, 통하지 않는 구조라는 개념도 없다 |

## Capability — 대지형 영역 (BT)

`content/proto-adventure/design/Master-World-Beira-Terrain.md`(BT) 주입으로 섰다. 위의 BW 표가 **얼마나 깊은가**의
층이라면 이쪽은 **어떤 법칙의 땅인가**다 — 여덟 대지형이 각자 자기 법칙이 요구하는
대응을 가진다 (아래 "대지형이 요구하는 것" 표). 둘은 **직교한다** (HISTORY Q47(a)) —
한 지역은 "어느 대지형의 어느 깊이" 를 함께 가지므로, 땅이 들어오는 Cycle 은 두 표의
요구를 함께 본다.

아홉 줄은 여전히 MISSING 이나 **사유가 달라졌다.** C-TERRAIN-001 이 바닥을 깔았다 —
무대가 자리로 나뉘고, 자리가 법칙(무엇을 어떤 조건에서 거두어 가는가)을 지니며,
그 법칙이 멎는 예외 자리가 그 안에 있다. 그래서 위치는 이제 **한 몸 혼자만으로도
결과가 정해지는 물음**이다.

막고 있는 것이 "놓일 바닥이 없다" 에서 **"땅에 시간이 없다"** 로 옮겨갔다. 거둔 것이
어디에도 저장되지 않으므로 땅이 포화되지도 분출하지도 않고, 그래서 셀 주기도
이어 갈 자리도 생기지 않는다 — 아홉 중 주기·경로·고정을 요구하는 것들이 여기 걸린다
(아래 "가장 큰 구멍" 의 넷째 항).

기존 노드 여덟(MC-READ-ENVIRONMENT · MC-OBSERVE · MC-PREDICT · MC-IDENTITY-ANCHOR ·
MC-VERIFY-REALITY · MC-FORCE-MOVEMENT · MC-CRAFT-FROM-MATERIALS · MC-TRANSFER-ITEM)에는
**줄을 더하지 않았다** — 지형을 요구처(demanded_by)로 더했을 뿐 같은 의미를 새 이름으로
복제하지 않았기 때문이다. 그것들의 판정은 원래 자리의 줄이 그대로 소유한다.

**다섯 줄이 Q71(b) 확장으로 늘었다.** BT 가 각 대지형의 주요 경험으로 이미 적어 두었으나
BT 주입이 Capability 로 들어 올리지 않았던 것들이다 — 산맥의 아래쪽 바꾸기 · 낙하 방향
틀기 · 발판 놓기 (§8.7), 무호흡해의 공기 길 잇기 (§7.7), 혈화수해의 개화 전 구조
(§11.7), 걷는 대륙의 진로 바꾸기 (§9.6). 계열별 요정 문서(FC)가 같은 것을 캐릭터 능력으로
요구하면서 그 공백이 드러났고, **요구부터 찾아** 세웠다 (HISTORY Q71(b)).
다섯 다 MISSING 이고 사유가 하나로 모인다 — 무대가 한 평면이라 아래쪽도, 날아가는 중인
것도, 놓을 자리도, 살아 있는 땅도 세계에 없다.

| Capability | 상태 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-CARRY-LIFE-SUPPORT (빙원 §5.7 · 무호흡해 §7.7) | MISSING | — | 몸이 열·공기 같은 것을 요구하지 않는다 — 지금 몸이 지닌 것은 생명과 기력뿐이고, 둘 다 나눠 줄 수 없다 |
| MC-TIME-THE-CYCLE (빙원 · 무호흡해 · 걷는 대륙 · 혈화수해) | MISSING | — | 세계에 주기를 가진 것이 없다 — 시간이 흐르지만 그 흐름으로 달라지는 땅의 조건이 없다 |
| MC-FIND-SAFE-ROUTE (빙원 · 무호흡해 · 산맥 · 걷는 대륙) | MISSING | — | 땅에 안전한 자리와 위험한 자리의 구분이 없다 — 이을 것도 피할 것도 없다 |
| MC-ANCHOR-LOCAL-LAW (산맥 §8.3 · 사막 §10.3 · 혈화수해 §11.3) | MISSING | — | 고정할 흔들림이 없다 — 땅이 아무 법칙도 가지지 않는다 |
| MC-IMPERSONATE-IDENTITY (수해 §6.5) | MISSING | — | 존재의 신원이라는 것이 세계에 없다 — 구분되는 것은 종류와 개체 번호뿐이고 그것을 빌릴 자리가 없다 |
| MC-COORDINATE-WITHOUT-SOUND (무호흡해 §7.6) | MISSING | — | 세계에 소리가 없다 — 없앨 것도 대신할 것도 아직 없다 |
| MC-APPRAISE-UNKNOWN-MATTER (갈비분지 §4.5) | MISSING | — | 물건이 정체를 감추지 않는다 — 정의소에 있는 것은 처음부터 전부 알려져 있다 |
| MC-REALIZE-ONE-POSSIBILITY (사막 §10.5) | MISSING | — | 세계에 가능성이라는 상태가 없다 — 참인 것은 지금의 하나뿐이고 선택되지 않은 것은 남지 않는다 |
| MC-CONCEAL-BIOLOGICAL-SIGNAL (혈화수해 §11.6) | MISSING | — | 몸의 상태를 좇는 것이 없다 — 남은 생명은 관찰에 실리지만 그것을 근거로 삼는 존재가 없다 |
| MC-REDEFINE-DOWN (산맥 §8.7 핵심 경험) | MISSING | — | 세계에 아래쪽이라는 것이 없다 — 떨어지는 일도 오르는 일도 없고, 무대는 한 평면이라 벽도 천장도 자리로 존재하지 않는다 |
| MC-REDIRECT-FALLING-THING (산맥 §8.7) | MISSING | — | 날아가는 중인 것이 세계에 없다 — 공격은 즉시 닿거나 닿지 않고, 진행 중인 것에 개입할 자리가 없다 |
| MC-PLACE-FOOTING (산맥 §8.7 · 무호흡해 §7.7) | MISSING | — | 몸이 아닌 것이 세계에 자리를 갖지 못한다 — MS-SKILL-FORM 의 공간 존재 칸이 통째로 비어 있고, 무대에는 놓을 자리도 없다 |
| MC-HOLD-BIOLOGICAL-STATE (혈화수해 §11.2 · §11.3 · §11.7) | MISSING | — | 존재가 단계적으로 다른 것이 되어 가는 과정이 세계에 없다 — 쓰러지는 것 하나뿐이라 붙들 진행이 없다 |
| MC-LINK-TO-LIVING-WORLD (걷는 대륙 §9.5 · §9.6) | MISSING | — | 땅이 살아 있지 않다 — 무대는 자리와 법칙을 가질 뿐 상태도 의사도 없고, 존재와 이어지는 관계는 태도(적대·중립·우호) 하나뿐이다 |

## Capability — 지목·관계 영역 (TG · BW §21)

앞의 둘은 `content/proto-adventure/design/Design-Targeting-R0.md` 주입으로, 마지막 하나는 Human 지시로 섰다
(HISTORY Q24(b)). 층(BW)에 속하지 않는다 — 어느 층에서든 "지금 누구에게 하는가" 와
"그것이 나를 어떻게 대하는가" 를 세계에 두는 자리다. 판정은 코드 대조로 했다.

| Capability | 상태 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-DESIGNATE-TARGET | IMPLEMENTED | **C017** — 관찰자별로 고른 존재 하나를 세계가 지니고(`World.TargetSelections` · Id 만), 살펴봄·채집이 요청이 아니라 그 관계에서 대상을 읽으며, 성립하지 않게 된 관계를 세계가 스스로 비운다 | — (`RULE-TARGET-CLEAR-STALE-001` 은 **플레이로 도달하지 않는다** — 존재가 세계에서 사라지는 경로가 0건이다. 규칙과 단위 검증은 섰고, 확인은 존재를 없애는 개념이 오는 Cycle 의 몫이다 — C017 08 주①) |
| MC-WATCH-TARGET | IMPLEMENTED | **C017** — 고른 상대의 지금 값과, 그에게 지금 무엇이 되고 무엇이 왜 안 되는지가 한자리에서 계속 갱신된다. 사유가 사라지고 행동만 회색으로 남는 형태가 아니라 문구로 온다 | — |
| MC-RELATION-STANCE | IMPLEMENTED | **C018** — 태도가 방향을 가진 쌍의 값으로 서고(적대·중립·우호), 그 값이 공격 가부를 가르며(중립인 것은 닿아도 상하지 않고 사유가 함께 온다), 두 방향이 모두 관찰에 실린다. 세계 서버 실측: 자리 중심까지 5.70 에서 적대로 갈리고 9.28 에서 풀리며 그 존재가 자기 자리로 돌아간다. **태도를 저장하지 않아** 푸는 규칙이 0줄이다 | — (Human Play 확인 대기 — 기계 검증 6종·794 tests 통과) |

## Capability — 아이템 영역 (IS · IE)

`content/proto-adventure/design/Design-Item-System-R0.md`(IS) 주입으로 섰고, `content/proto-adventure/design/Design-Inventory-Equipment-D1.md`(IE)
주입이 그중 장착과 몸 밖 이동의 운용 형태를 채웠다. 층(BW)에 속하지 않는다 — 어느
층에서든 "무엇을 지니고, 무엇을 적용하고, 무엇을 주고받는가" 를 세계에 두는 자리다.
**넷 중 둘이 섰다 (C020 · C023+C024)** — 그 둘의 판정은 Cycle 실측이고,
나머지 둘은 코드 대조다.

정의(카탈로그)와 소지(관찰)는 이 표에 없다 — 할 수 있는 일을 늘리지 않아 Capability 가
아니고, 넷의 바닥이다 (IS §4 · §6). 소지 한도(IE)도 같은 이유로 여기 오지 않는다:
한도는 할 수 있는 일을 늘리는 것이 아니라 좁히는 것이다. 다만 그 바닥의 지금 형태가
아래 근거 칸에 들어간다.

**그 바닥에 자리가 더해졌다 (C022).** 지닌 것이 유한한 자리에 담기고(`Inventory.UsedSlots`
는 저장하지 않는 파생이다), 다 담기지 못하는 획득은 하나도 담기지 않으며 세계의 것도
축내지 않고, 플레이어가 스스로 줄이는 첫 경로(덜어내기)가 생겼다. 표에 새 줄이 생기지
않는 것이 이 Cycle 의 판정 그대로다 — 늘어난 것은 할 수 있는 일이 아니라 그 경계다.

**그 위에 적용이 섰다 (C023).** 몸이 자리들을 지니고, 자리가 물건을 직접 담으며(걸린
것은 소지품에 없다), **걸린 것만이** 몸의 값과 할 수 있는 일을 바꾼다. 몸의 값은 기본값과
유효 값으로 갈렸고 유효 값은 저장하지 않는다 — `Inventory.UsedSlots` 와 같은 형태다.
이로써 `IM-*` 의 grants 가 **처음으로 몸에 닿았다** — 아래 MC-EQUIP-ITEM 이 그것을
"이것이 없어 grants 가 몸에 닿지 못한다" 로 적어 두던 자리다.

**그리고 그 적용이 닫혔다 (C024).** 이미 찬 자리에 걸면 밀려남과 걸림이 한 단위로
일어나고, 무엇을 밀어낼지는 겪는 사람이 고른다. 담을 곳이 가득한 상태에서 **해제는
막히고 교체는 되는** 비대칭이 실측되었다 — 나가는 하나가 비운 칸에 들어오는 하나가
앉기 때문이며, 그것이 특례가 아니라 "걸 수 있는 것은 겹치지 않는다" 는 정의소 불변
조건에서 나오는 계산의 결과다. 걸 수 있는 종류도 둘이 되어(곡괭이 · 손방패) "무엇을
걸까" 가 처음으로 갈래를 갖는다.

**그리고 그 넷에 닿는 자리가 생겼다 (C026).** 지금까지 이 표의 IMPLEMENTED 는 "세계에
그 의미가 있다" 였고, 그것에 닿는 길은 손가락 자리를 외운 사람에게만 있었다 — 한 물건에
대한 답이 화면 두 곳에 흩어져 있었고 무엇을 고르는 중인지는 어디에도 없었다.
C026 이 그 셋을 한 표면에 세웠다. **이 표는 한 칸도 바뀌지 않는다** — 관찰은 할 수 있는
일을 늘리지 않기 때문이며, 그것이 그 Cycle 이 Capability 노드를 목표로 삼지 않은 사유
그대로다. 바뀐 것은 판정이 아니라 **판정의 값어치**다: 아래 넷의 IMPLEMENTED 가 이제
"코드가 있다" 가 아니라 "겪을 수 있다" 를 뜻한다.

| Capability | 상태 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-USE-ITEM | IMPLEMENTED | **C020** — 세계 프로세스 실측으로 world_shape 세 문장이 모두 닫혔다: 지금 쓸 수 있는 것과 없는 것이 사유와 함께 구분되어 오고(관찰 계약), 고른 상대에게 돌을 던져 상태가 바뀌며 수량이 준다(타격 기록 `["stone", 3]` · 60초 16회 시도 9회 성립), 끊긴 사용은 수량도 상태도 건드리지 않는다. 규칙은 종류 이름을 묻지 않고 정의소에 묻는다 | — |
| MC-EQUIP-ITEM | IMPLEMENTED | **C023 · C024** — 세계 프로세스 실측으로 world_shape 네 문장이 모두 닫혔다. C023: 같은 곡괭이를 가지고만 있으면 캐지지 않고 걸어야 캐지며(사유 `no-mining-tool`), 걸면 물리 공격 40 → 52 · 풀면 **정확히 40** 으로 돌아오고, 걸릴 수 없는 물건은 `not-equippable` 로 거절되며, 담을 곳이 모자라면 풀기가 `no-room` 으로 거절되고 자리도 수량도 건드리지 않는다. C024: 가방 **4/4** 인 그 상태에서 해제는 `no-room` 으로 막히는데 **바꿔 끼기는 성립하고 자리가 4/4 그대로다** — 밀려남과 걸림이 한 단위이고, 물리 공격 52 → **40**(기본값) · 물리 방어 50 → 65 로 헌것의 기여가 정확히 사라지며 채집도 함께 사라진다. 실패한 교체 셋(not-enough · not-equippable · unknown-slot)은 자리 · 수량 · 유효 값 · 용도 넷을 그대로 둔다 | — (**곁가지 하나** — 전용 자리를 선언한 물건이 아직 없어 `slot-not-fit` 이 코드에만 서 있고 플레이에서 겪히지 않는다. 그리고 자리 여섯이 걸 것 둘보다 여전히 넓어, 교체가 *불편을 푸는 일*이지 아직 *고르는 일*은 아니다 — C024 08 Master Gap ②) |
| MC-CRAFT-FROM-MATERIALS | MISSING | 코드 대조 — 재료를 다른 것으로 바꾸는 규칙이 0건이다. 재료를 **줄이는** 통로는 C020 으로 생겼다 | 제작법 데이터 · 가능 여부 판정 · 재료 소모와 결과물 생성의 한 단위 처리 |
| MC-TRANSFER-ITEM | MISSING | 코드 대조 — 물건은 언제나 누군가의 몸 안에 있다. 위치를 가진 아이템 존재가 없다. 몸 **안**에서 사라지는 경로는 C020 으로 생겼다 | 몸 밖의 아이템 · 줍기 · 버리기 · 전리품 보관소 · 획득 권한 · 소멸. 쓰러진 몸에서 아무것도 나오지 않는 것이 이 결손이다. IE 가 더한 것: 적용해 둔 것을 내려놓는 길이 담을 곳을 거치지 않는다는 것 (IE §35) |

## Capability — 성장 영역 (GS)

`content/proto-adventure/design/Master-Fairy-Growth-System.md`(GS) 주입으로 섰다. 이 표는 overlay 의 둘째 구멍
("성장이 세계 밖에 있다")에 **처음으로 이름을 붙인 자리**다 — 지금까지 능력치를 바꾸는
유일한 경로는 디버그 명령이었고, 그것이 결손인 줄은 알았지만 **무엇이 그 자리에
들어와야 하는지**는 어느 문서도 말하지 않았다. GS §5 · §19 가 그 축을 다섯으로
명명한다.

다섯 중 넷이 여기 있고 **다섯째(장비)는 이 표에 없다** — 이미 아이템 영역에서
IMPLEMENTED 로 서 있는 MC-EQUIP-ITEM 이 그 자리이기 때문이다 (같은 의미를 성장
이름으로 복제하지 않는다 — DC-GROWTH-NO-CAPABILITY-DUPLICATION). 그래서 다섯 축 중
**하나는 이미 서 있고 넷이 비어 있다**는 것이 이 절의 그림이며, 서 있는 그 하나조차
성장이 아니라 자원으로 감당하는 갈래에 매달려 있다.

마지막 줄(MC-CHANGE-CLASS)은 나머지 넷과 성격이 다르다 — 축이 아니라 축들이 다 찼을 때
넘는 **문턱**이고, 그것이 넘어가는 형태(CL-*)가 아직 노드로 서지 못했다
(Class Line 의 이름이 문서마다 어긋난다 — open-questions Q55).

| Capability | 상태 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-GAIN-LEVEL | PARTIAL | C-GROWTH-001 — 세계 안의 행위가 몸에 쌓이고 문턱을 넘으면 겨루는 값 넷이 오른다. world_shape 두 문장이 실측으로 닫혔다: 걸어가 살펴보고 쳐서 넘어뜨리니 쌓인 것 0 → 22 · 단계 0 → 1 이 되었고, 그 뒤 같은 기술의 피해가 26 → 28 로 · 한 대가 남기는 값이 20 → 22 로 달라졌다. 디버그 명령을 한 번도 열지 않았다 (08 의 WORLD SCENARIO ①③ · PLAYABLE 5 · shots/) | 쌓이는 원천이 이 노드가 든 넷 중 둘뿐이다 — "탐험하고" 와 "사건을 해결한 것" 이 세계에 없다. 그리고 GS §5 가 든 다섯 중 셋(생명력 · 기력 · 기본 이동)이 자라지 않는다 — 그 셋은 아직 "유효 값" 이라는 자리를 지니지 않아 걸린 것도 배분도 성장도 닿을 곳이 없다 |
| MC-GROW-CLASS-MASTERY · MC-GROW-EXPLORATION-MASTERY (같은 원리의 두 쓰임 — GS §8) | MISSING | — | 형태(Class)라는 것이 세계에 없다 — 몸이 한 종류이고 무엇을 했는지 세는 자리도 없다 |
| MC-MASTER-A-SKILL | MISSING | — | 스킬이 자란다는 개념이 없다 — 기술은 종류가 정한 값 그대로이고 쓴 이력이 어디에도 남지 않는다 |
| MC-CHANGE-CLASS | MISSING | — | 몸이 형태를 갖지 않는다 — 세계의 몸은 종류 하나로 고정이고, 형태를 바꾸는 사건도 그 조건을 세는 자리도 없다. 설계 쪽은 절반이 섰다 (Origin CL-* 6) — 넘어갈 상위 형태의 CL-* 가 아직 0 이다 |

## Capability — 전투 지식 영역 (CK)

`content/proto-adventure/design/Design-Combat-Knowledge-Extension-R0.md`(CK) 주입으로 섰다.
**일곱 줄이 전부 MISSING 이며, 그것이 이 표에서 가장 정직한 그림이다** — 이 층은
세계에 한 조각도 없다.

비어 있는 방식이 다른 표들과 다르다. 전투 영역의 결손은 "판정 하나가 없다" 였고
아이템 영역의 결손은 "상태 하나가 없다" 였는데, 여기는 **판단이라는 것 자체가
세계에 없다.** 사람의 몸은 요청받은 것만 하고, 자율 존재는 고정된 규칙 하나로
움직인다 (RULE-NPC-DECIDE-001 — 기력이 되면 큰 기술, 아니면 기본 기술).
그래서 이 일곱은 하나씩 채워 넣는 목록이 아니라 **한 층을 통째로 세우는 일**이다.

셋째 줄(MC-CONDUCT-BY-KNOWLEDGE)이 이 층의 문이다. 나머지 여섯은 그것에 재료를
대거나(습득 · 선택 · 성장 · 전수) 그것을 읽히게 하거나(설명) 그 위에 얹힌다(조합).
운용이 서지 않으면 나머지는 아무 데도 닿지 않는다.

**철회된 사슬 A 가 돌아올 자리도 여기다.** 다만 그 층이 지워진 것이 아니라
**누가 그것을 수행하는가**가 정해진 것이다 (Q63 — Human). Response 층의 형태는
전투 상층 문서(UL §4.1 · §4.2 · §5 · §6 · §7 · §9)가 그대로 소유하고,
전투 영역 표의 MC-ACTIVE-RESPONSE 계열 넷은 한 글자도 고치지 않았다.
바뀐 것은 그 층을 **플레이어의 손이 아니라 배운 것이 수행한다**는 것이며
(CK §15), 그 선을 재는 자는 UL §32 다 — 기본 형태를 자동 전투가 수행할 수 있으면
지킨 것이다. 그래서 이 표와 전투 영역 표는 경쟁하지 않고 위아래로 선다.

| Capability | 상태 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-LEARN-COMBAT-KNOWLEDGE | MISSING | — | 전투법이라는 것이 세계에 없다 — 배울 대상도 배우는 길도 없다 |
| MC-CARRY-COMBAT-KNOWLEDGE | MISSING | — | 가져갈 것이 없다 — 전투법도, 그것을 담는 자리도 없다 |
| MC-CONDUCT-BY-KNOWLEDGE | MISSING | — | 판단이라는 것이 세계에 없다 — 사람의 몸은 요청받은 것만 하고, 자율 존재는 고정된 규칙 하나로 움직인다 |
| MC-DEEPEN-COMBAT-KNOWLEDGE | MISSING | — | 깊어질 지식이 없다 |
| MC-EXPLAIN-COMBAT-DECISION | MISSING | — | 설명할 판단이 없다. 다만 경위를 세계가 싣고 화면이 옮기는 형태는 이미 섰다 (C010 이래의 breakdown) |
| MC-TEACH-COMBAT-KNOWLEDGE | MISSING | — | 전할 지식도 전할 상대도 없다 — 세계에 다른 플레이어 말고는 말을 주고받는 존재가 없다 |
| MC-COMBINE-KNOWLEDGE | MISSING | — | 맞물릴 지식이 없다 |

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
| MW-MACRO-TERRAIN | PARTIAL | 땅이 자리로 나뉘고 그 자리가 법칙을 지닌다 (C-TERRAIN-001 — World.GroundZones · GroundLawDefinition). 남은 것은 world_shape 의 나머지다: 법칙이 하나뿐이고, 그 법칙이 낳는 자원이 없으며, 어디에 갈 수 있는가가 감당으로 정해지지 않고, 깊이와의 직교도 아직 없다 |
| MW-TERRAIN-CIRCULATION | PRESENT | C-TERRAIN-002 — 자리가 거둔 것을 지니고(kept), 넘치면 뿜고, 그 안의 몸에게 돌려주고, 다 쓰면 닫혀 도로 거둔다. 같은 자리를 다른 시각에 보면 다르고 그 다름이 "그 사이에 누가 거기서 얼마나 빼앗겼는가" 로 설명된다 — 주기는 세계가 정한 것이 아니다 |
| MW-SHAPED-LANDFORM | ABSENT | 무대가 평면 하나다 — 산도 물길도 대기도 없고, 자리의 경계는 원으로 그려진 범위이지 순환이 빚은 생김새가 아니다 |
| MW-SURVIVAL-PRESSURE | PARTIAL | C-TERRAIN-002 로 압력이 순환에서 나온다 — 어디가 거두고 어디가 돌려주는지가 내가 한 일의 결과이므로 읽어서 이용할 거리가 생겼다. 남은 절반은 world_shape 의 "읽은 사람과 읽지 못한 사람이 다른 결과를 낸다" 다: **지금 상태는 읽히나 앞으로 일어날 일은 읽히지 않는다** (MW-CIRCULATION-EVIDENCE 가 그 자리다) |
| MW-ADAPTED-LIFE | ABSENT | 세계에 있는 것은 좌표로 놓인 방랑자 둘과 광맥 하나뿐이고 셋 다 땅의 법칙과 무관한 자리에 있다. 놓는 것 말고 다른 길이 세계에 없다 |
| MW-TERRAIN-RESOURCE | ABSENT | 캘 수 있는 것은 광맥의 돌 하나뿐이고, 그것은 어떤 법칙이 낳은 것이 아니라 좌표에 놓인 것이다. 캐어도 세계에 아무 되돌림이 없다 |
| MW-NATURAL-REFUGE | PRESENT | C-TERRAIN-002 — 예외를 놓을 형이 사라졌다(GroundZone.role 삭제). 법칙이 멎는 자리는 넘쳐서 뿜는 중인 맥뿐이므로 "왜 하필 거기가 안전한가" 에 세계가 답한다 — 거기에 열이 모였기 때문이고, 모인 것은 누군가 거기서 빼앗겼기 때문이다. 그리고 생겨나고 사라진다 |
| MW-NATURAL-SETTLEMENT | ABSENT | 사람도 문화도 없다 — 세계에 있는 존재는 순회하는 방랑자 둘뿐이고 어디에도 정착하지 않는다 |
| MW-CIRCULATION-EVIDENCE | ABSENT | 자리의 범위가 화면에 보이지만 그것은 법칙의 경계이지 순환이 남긴 증거가 아니다 — 아직 일어나지 않은 것을 가리키는 것이 세계에 하나도 없다. TERRAIN 트랙의 다음 후보(FR-THE-LAND-SHOWS-BEFORE-IT-TAKES)가 이 노드를 연다 |
| MW-TERRAIN-* 8종 (BT §4~§11) | ABSENT | 머물 곳과 나갈 곳의 구분이 없다 — 무대가 하나다 |
| MA-PLAYER | PARTIAL | 몸이 한 종류로 고정이라 고를 갈래 자체가 없다 — 요정 계열 여덟(MS-FAIRY-LINEAGE)이 그 자리이고 아직 비어 있다 |
| MA-HOSTILE-COMBATANT | PRESENT | **C018 로 마지막 칸이 닫혔다** — 스스로 순찰·추격·공격하고, 플레이어와 **같은 관문**을 지나며(몬스터 전용 규칙 없음), 이제 지킬 자리를 지녀 그 행동이 자기 영역을 지키는 것으로 읽힌다. 같은 종류 두 개체가 하나는 적대하고 하나는 하지 않는다 — 적대가 종류가 아니라 사정의 결과다 |
| MK-LOCAL-WORLDSTATE | ABSENT | 지역이 없다. 다만 "모르는 상태" 라는 것 자체는 C014 로 세계에 생겼다 (살펴봄 이전) — 얹힐 바닥은 섰다 |
| MK-OPPONENT-DEFENSE-SHAPE | PARTIAL | 방어 형태와 관통 반영값이 관찰에 실리고 (C012 · C013), 그것을 **알게 되는 과정**이 생겼다 — 살펴보기 전에는 가려져 있고 (C014), 통찰을 기르면 자리별로 열린다 (C016) |
| MK-OPPONENT-FLOW-PATTERN | ABSENT | 힘을 배분하는 상태가 없다 |
| MK-WITNESSED-WORLD-PHENOMENON | ABSENT | 드물게 일어나는 세계 현상이 없다 — 세계에서 일어나는 일은 존재들의 행동뿐이고 그 자리에 있었다는 사실도 남지 않는다 |

## Possibility 별로 본 상태

어느 경로가 지금 얼마나 닫혀 있는가 — Frontier 는 이 표에서 고른다.

### MG-OVERCOME-SUPERIOR-OPPONENT (15 갈래)

| Possibility | 요구 중 없는 것 | 비고 |
|---|---|---|
| MP-MATCH-WEAPON-TO-ARMOR | **없음** | **C012 로 닫혔다** — 지금 플레이 가능하다 |
| MP-PIERCE-THE-HARD-DEFENSE | **없음** | **C013 로 닫혔다** — 지금 플레이 가능하다. 다만 아직 좁다: 플레이어가 관통을 **얻는** 경로가 세계에 없다 (종류가 정한 값과 디버그뿐 — growth/growth-graph.md) |
| MP-OUTGROW-THE-OPPONENT | MC-ATTACK-POWER(PARTIAL) + 전투 밖의 원천 | **C-GROWTH-001 로 자라는 축이 섰다** — 세계 안에서 한 일이 몸에 쌓이고 문턱을 넘으면 겨루는 값이 오르며, 같은 상대·같은 기술의 결과가 실제로 달라진다. world_shape 의 마지막 문장("세계 안의 행위로 올릴 수 있어야 한다")이 닫혔다. 그러나 이 갈래가 말하는 것은 **전투 밖에서 기른 값으로 정면 교환을 이기는 것**인데, 선 원천 넷 중 전투 밖의 것은 캐는 일 하나뿐이고(4/회 · 첫 문턱까지 다섯 번) 한 단계의 폭이 작아(한 대에 2) 그것만으로 판이 뒤집히지 않는다. 없는 것은 이제 축이 아니라 **전투 밖의 원천**이다 |
| MP-BET-ON-THE-CRITICAL-BLOW | 요구 Capability 는 **없음** · `requires.resource` 미충족 | **C015 로 절반 닫혔다** — 증폭이 터지는 것과 그 경위가 다 보인다. 그러나 "준비로 기대값을 올린다" 는 나머지 절반이 남았다: Critical 성질을 올릴 성장·장비가 세계에 없어 경로가 종류 초기값과 디버그뿐이다 |
| MP-INTERRUPT | **없음** | **C019 로 닫혔다** — 지금 플레이 가능하다. 상대의 선딜을 노려 끊고, 늦으면 이미 나간 칼을 무르지 못한다. 요구는 MC-INTERRUPT 하나뿐이었고 그것이 섰다 |
| MP-BREAK-THE-GUARD | MC-BREAK(PARTIAL) | 무너지는 상태는 있고 무너뜨리는 행동만 없다 (R1 §14 Active Defense 층) |
| MP-READ-AND-COUNTER | MC-ACTIVE-RESPONSE · MC-PRECISION-RESPONSE · MC-PERFECT-GUARD · MC-OPPORTUNITY · MC-COUNTER | UL 이 그 층의 설계 문서다 — 이 갈래는 이제 두 조각이 아니라 다섯 조각으로 갈린다. 완벽한 막기는 정밀 응답을 막기에 적용한 결과이고 되받아치기는 기회를 통해 온다 (UL §6 · §7). 순서는 UL §42 F1 → F2 → F3 다 |
| MP-EXPLOIT-OPEN-BODY | MC-AURA-ALLOCATION (PARTIAL) | 요구 넷 중 셋이 섰고 넷째(MC-AURA-ALLOCATION)가 PARTIAL 이라 갈래도 PARTIAL 이다. 다만 **플레이로는 이미 성립한다** — 상대가 물리에 무른 것을 알아내고 배분으로 그 무른 쪽을 친다 (C-COMBAT-001 WORLD SCENARIO). 노드의 완결과 플레이의 성립이 갈리는 자리이며, 어느 쪽으로 판정할지는 Q66 다 |
| MP-CONTROL-MOVEMENT | MC-CONTROL-SPACE + MC-FORCE-MOVEMENT·MC-REPOSITION(둘 다 PARTIAL) | 셋 중 둘이 절반 서 있다 |
| MP-STAKE-EVERYTHING-ON-ONE-BLOW | MC-VOW · MC-AURA-ALLOCATION + MC-CONDITION-STACKING(PARTIAL) | Aura/Nen 층 — 가장 멀다. UL §20 이 계약의 대가를 바꾼 뒤로 이 갈래는 "제약으로 위력을 산다" 쪽 반쪽만 쓴다 — 허락을 사는 반쪽은 MP-BIND-BY-CONTRACT 다 |
| MP-WEAPONIZE-ENVIRONMENT | MC-READ-ENVIRONMENT · MC-USE-HAZARD + MW-ZONE-DANGER | 환경 위험 개념 자체가 없다 |
| MP-CONCENTRATE-THE-POWER | MC-AURA-ALLOCATION (PARTIAL) | UL §42 F4 — 상층 넷 중 첫 칸. 아래 세 칸(응답 · 정밀 · 기회)이 먼저 서야 한다는 순서가 문서에 있다 |
| MP-BIND-BY-CONTRACT | MC-VOW · MC-BIND · MC-MARK · MC-ABILITY-CONDITION | UL §42 F5~F7 — 상층의 마지막 세 칸이 전부 걸린다. 이 세계에서 가장 먼 갈래이고, 동시에 UL 이 §23 에서 대표 실물로 든 갈래다 |
| MP-KNOW-THE-OPPONENT-RULE | MC-OBSERVE-ABILITY · MC-AURA-ALLOCATION · MC-ABILITY-CONDITION · MC-DISRUPT-ABILITY | 알아낼 대상 자체가 없다 — 적대 존재에게 규칙 있는 능력이 없다. 이 갈래는 상대 쪽에 상층이 서야 성립한다 |
| MP-TAKE-WHAT-MAKES-IT-STRONG | MC-DRAIN | 상대가 유한하게 가진 것이 세계에 없다 — 옮길 것이 없다 |

### MG-SURVIVE-ENEMY-OFFENSIVE (4 갈래)

| Possibility | 요구 중 없는 것 | 비고 |
|---|---|---|
| MP-TRADE-BODY-FOR-RESOURCE | **없음** | **C011 로 닫혔다** — 지금 플레이 가능하다 |
| MP-EVADE-BY-MOVING-THE-BODY | MC-EVADE · MC-ACTIVE-RESPONSE | R1 §13 이 이후 확장으로만 지정했고 UL §8 이 그 형태를 확정했다 — 짧은 이동에 짧은 판정 무효 구간을 얹는다. 회피는 응답 자리에 끼우는 것 중 하나다 |
| MP-HOLD-FORTIFIED | MC-FORTIFY · MC-AURA-ALLOCATION (PARTIAL) | Q59(a) 로 몸·능력·인지 세 축 위에 선다 — 대가가 "공격이 약해진다" 에서 "능력과 인지가 얇아진다" 로 바뀌었다 |
| MP-STORE-AND-RELEASE | MC-ABSORB · MC-ACTIVE-RESPONSE · MC-PRECISION-RESPONSE | UL §28 (축적자) — 응답 자리(F1)와 정밀 구간(F2) 위에 얹힌다. 막기는 이미 섰다 (C011) |

### MG-EXPLORE-BEIRA (4 갈래)

층 진입은 더 이상 Possibility 가 아니다 — 층은 세계 상태이고 그 요구는 `demands` 가
소유한다 (HISTORY Q21). 여기 넷은 **어떻게 감당하는가**다.

**넷째가 GS 주입으로 들어왔다.** 앞의 셋이 감당할 것을 바깥에서 구해 오는 갈래라면
(겪어서 익힌다 · 자원이 대신한다 · 문명권에서 사서 준비한다) 넷째는 **몸 자체가
상위 형태가 되어** 감당한다 — 잃을 수 없고 되돌아가지도 않는 대신 문턱이 넷이다.

| Possibility | 요구 중 없는 것 | 비고 |
|---|---|---|
| MP-LEARN-TO-HANDLE-THE-LAYER | **MC-PREDICT 하나** (+ MC-OBSERVE 는 PARTIAL — 같은 자리다) | **네 칸 중 셋이 닫혔다.** C014·C016 이 살펴봄과 그것에 이르는 두 길을, C017 이 지목 둘(MC-DESIGNATE-TARGET · MC-WATCH-TARGET)을, C018 이 관계(MC-RELATION-STANCE)를 세웠다. 남은 것은 **예측 하나**이며 그것이 MC-OBSERVE 의 마지막 결손과 같은 자리다 — 닫히면 이 갈래가 통째로 선다 — 다만 **보류(Human)** (AI 기획서 대기 · frontier "지금 열 수 없는 것"). 탐험의 기본 갈래이자 다른 둘의 앞이다 (먼저 겪은 사람이 없으면 살 정보도 가져올 자원도 없다) |
| MP-ADAPT-BY-RESOURCE | MC-RESTORE-BIOLOGICAL-STATE · MC-CUT-ABNORMAL-STRUCTURE + **MC-EQUIP-ITEM(IMPLEMENTED)** + **MC-CRAFT-FROM-MATERIALS** + MK-LOCAL-WORLDSTATE + 자원 | **이 갈래의 문장이 세계에서 통째로 참이 되었다** — "물건이 대신해 주고, **물건을 잃으면 도로 못 하게 된다**"(BW §17). 앞 절반은 C020(쓰면 없어진다)이, 뒤 절반은 **C023**(풀면 캘 수 없게 된다)이 세웠고, **C024** 가 그 둘 사이를 오가는 길(교체)을 냈다. 걸 물건이 둘이 되어 **갈래가 처음으로 둘**이다 — 공격을 얹을지 방어를 얹을지. 다만 자리가 여섯이라 아직 둘 다 걸 수 있으므로 그것이 진짜 선택이 되려면 자리가 걸 것보다 좁아져야 한다. 쓸 물건은 여전히 한 종류뿐이고, 남은 것은 제작이며 그것이 회복·절단 앞을 막고 있다 |
| MP-PREPARE-IN-CIVILIZATION | **MC-CRAFT-FROM-MATERIALS** + MK-LOCAL-WORLDSTATE + MW-SAFE-FRONTIER + 관계·대가 | BW §14 가 열거한 활동 중 제작만 근거 문서를 얻어 배선되었다 (IS §4). 나머지(정보·교역·훈련)는 여전히 이름을 댄 문서가 없다. 막는 것은 능력만이 아니라 문명권·거래라는 세계 기반이다 |
| MP-BECOME-A-HIGHER-FORM | 다섯 축 전부 (MC-GAIN-LEVEL · MC-GROW-CLASS-MASTERY · MC-MASTER-A-SKILL · MC-GROW-EXPLORATION-MASTERY · MC-CHANGE-CLASS) + MK-WITNESSED-WORLD-PHENOMENON + Catalyst 자원 | **한 칸도 서 있지 않다.** 다만 이 갈래가 서면 overlay 의 둘째 구멍("성장이 세계 밖에 있다")이 통째로 닫힌다 — 지금 능력치를 바꾸는 유일한 경로는 디버그 명령이고, GS 주입이 처음으로 그 값이 **어디에서** 올라오는지를 명명했다. 다섯 축 중 **장비 하나만 이미 서 있고** (MC-EQUIP-ITEM — C023 · C024), 그것도 이 갈래가 아니라 자원으로 감당하는 갈래에 매달려 있다 |

### 층이 요구하는 것 — MW-ZONE-* 의 demands

각 층을 감당하려면 무엇이 있어야 하는가. 위 세 방법 중 무엇으로 채우든 상관없다.

| 층 | demands | 지금 채워진 것 |
|---|---|---|
| MW-SAFE-FRONTIER (§20) | MC-COMBAT-STRIKE · MC-GUARD · MC-EVADE · MC-REPOSITION | 2 / 4 (없음: EVADE / 절반: REPOSITION) |
| MW-ZONE-FRINGE (§21) | MC-OBSERVE · MC-PREDICT · MC-USE-TERRAIN | 0 / 3 (없음: PREDICT · USE-TERRAIN / 절반: OBSERVE) |
| MW-ZONE-WILD (§22) | MC-BREAK · MC-DISCOVER-WEAKNESS · MC-PRECISE-TARGETING · MC-CONTROL-SPACE | 0 / 4 (없음: DISCOVER-WEAKNESS · PRECISE-TARGETING · CONTROL-SPACE / 절반: BREAK) |
| MW-ZONE-DANGER (§23) | MC-READ-ENVIRONMENT · MC-FORCE-MOVEMENT · MC-USE-HAZARD · MC-INTERRUPT | 1 / 4 (없음: READ-ENVIRONMENT · USE-HAZARD / 절반: FORCE-MOVEMENT) |
| MW-ZONE-DEEP (§24) | MC-DISCOVER-WEAKNESS · MC-DISRUPT-ABILITY · MC-MAINTAIN-PRESSURE · MC-TARGET-SPECIFIC-PART · MC-READ-CREATURE-SYSTEM | 0 / 5 (없음: DISCOVER-WEAKNESS · DISRUPT-ABILITY · MAINTAIN-PRESSURE · TARGET-SPECIFIC-PART · READ-CREATURE-SYSTEM) |
| MW-ZONE-UNKNOWN (§25) | MC-PROTECT-PERCEPTION · MC-VERIFY-REALITY · MC-IDENTITY-ANCHOR · MC-RESIST-INFLUENCE · MC-BREAK-BIOLOGICAL-LINK · MC-ESCAPE-ALTERED-SPACE | 0 / 6 (없음: PROTECT-PERCEPTION · VERIFY-REALITY · IDENTITY-ANCHOR · RESIST-INFLUENCE · BREAK-BIOLOGICAL-LINK · ESCAPE-ALTERED-SPACE) |

### 대지형이 요구하는 것 — MW-TERRAIN-* 의 demands

각 땅을 감당하려면 무엇이 있어야 하는가. 층 표와 축이 다르다 — 이쪽은 깊이가 아니라
법칙이며, 여덟에 순서가 없다 (BT §16). 여덟 중 채워진 칸이 하나도 없다. 절반으로
서 있는 둘(살펴봄 · 밀어내기)도 이 지형들 때문에 선 것이 아니라 다른 자리에서
이미 서 있던 것을 지형이 함께 요구하는 것이다.

| 층 | demands | 지금 채워진 것 |
|---|---|---|
| 백왕의 갈비분지 (§4) | MC-APPRAISE-UNKNOWN-MATTER · MC-CRAFT-FROM-MATERIALS · MC-TRANSFER-ITEM | 0 / 3 (없음: APPRAISE-UNKNOWN-MATTER · CRAFT-FROM-MATERIALS · TRANSFER-ITEM) |
| 해를 삼킨 빙원 (§5) | MC-READ-ENVIRONMENT · MC-CARRY-LIFE-SUPPORT · MC-TIME-THE-CYCLE · MC-FIND-SAFE-ROUTE | 0 / 4 (없음: READ-ENVIRONMENT · CARRY-LIFE-SUPPORT · TIME-THE-CYCLE · FIND-SAFE-ROUTE) |
| 이름을 먹는 수해 (§6) | MC-IDENTITY-ANCHOR · MC-IMPERSONATE-IDENTITY · MC-OBSERVE | 0 / 3 (없음: IDENTITY-ANCHOR · IMPERSONATE-IDENTITY / 절반: OBSERVE) |
| 무호흡해 (§7) | MC-CARRY-LIFE-SUPPORT · MC-TIME-THE-CYCLE · MC-FIND-SAFE-ROUTE · MC-COORDINATE-WITHOUT-SOUND · MC-PLACE-FOOTING | 0 / 5 (없음: CARRY-LIFE-SUPPORT · TIME-THE-CYCLE · FIND-SAFE-ROUTE · COORDINATE-WITHOUT-SOUND · PLACE-FOOTING) |
| 하늘로 떨어지는 산맥 (§8) | MC-READ-ENVIRONMENT · MC-ANCHOR-LOCAL-LAW · MC-FIND-SAFE-ROUTE · MC-FORCE-MOVEMENT · MC-REDEFINE-DOWN · MC-REDIRECT-FALLING-THING · MC-PLACE-FOOTING | 0 / 7 (없음: READ-ENVIRONMENT · ANCHOR-LOCAL-LAW · FIND-SAFE-ROUTE · REDEFINE-DOWN · REDIRECT-FALLING-THING · PLACE-FOOTING / 절반: FORCE-MOVEMENT) |
| 걷는 대륙의 무리 (§9) | MC-PREDICT · MC-TIME-THE-CYCLE · MC-FIND-SAFE-ROUTE · MC-LINK-TO-LIVING-WORLD | 0 / 4 (없음: PREDICT · TIME-THE-CYCLE · FIND-SAFE-ROUTE · LINK-TO-LIVING-WORLD) |
| 아직 일어나지 않은 사막 (§10) | MC-VERIFY-REALITY · MC-ANCHOR-LOCAL-LAW · MC-REALIZE-ONE-POSSIBILITY | 0 / 3 (없음: VERIFY-REALITY · ANCHOR-LOCAL-LAW · REALIZE-ONE-POSSIBILITY) |
| 사람을 꽃피우는 혈화수해 (§11) | MC-CONCEAL-BIOLOGICAL-SIGNAL · MC-TIME-THE-CYCLE · MC-ANCHOR-LOCAL-LAW | 0 / 3 (없음: CONCEAL-BIOLOGICAL-SIGNAL · TIME-THE-CYCLE · ANCHOR-LOCAL-LAW) |

### MG-RESCUE-THE-TAKEN (3 갈래)

**이 Goal 은 갈래가 하나도 없는 채로 서 있었다.** BT 주입이 네 대지형에서 같은 행동을
발견해 Goal 을 세웠으나, 그 문서가 구출이 일어난다는 사실만 적고 어떻게 하는지를
말하지 않아 Possibility 를 만들지 않았기 때문이다. Q71(b) 확장이 그 셋을 열었다
(HISTORY Q71(b)).

셋은 무엇을 다루느냐가 서로 다르다 — 옮겨 가는 **과정**을 붙들거나, 법칙이 걸어 둔
**것**을 끊거나, 사람이 갈 수 없는 **자리**에 도달하거나. 그래서 배타적이지 않고
앞뒤로 붙는다: 시간을 벌어 두고 끊는 것도, 도달해서 붙드는 것도 한 판 안에서 성립한다.

**둘째는 새 Capability 를 하나도 요구하지 않는다** — 이미 선 둘로 성립한다. 그런데도
셋 다 열리지 않는 이유는 그 둘 역시 MISSING 이기 때문이고, 더 근본적으로는 이 Goal 이
기대는 것이 세계에 없어서다: **존재가 단계적으로 다른 것이 되어 가는 과정**이 없다.
지금 세계에서 존재는 멀쩡하거나 쓰러지거나 둘뿐이라 되돌릴 자리가 생기지 않는다.

| Possibility | 요구 중 없는 것 | 비고 |
|---|---|---|
| MP-STOP-THE-TRANSFER | MC-HOLD-BIOLOGICAL-STATE · MC-OBSERVE | 진행이라는 것이 세계에 없어 붙들 대상이 없다 — 존재는 멀쩡하거나 쓰러지거나 둘뿐이다 |
| MP-CUT-WHAT-HOLDS-THEM | MC-BREAK-BIOLOGICAL-LINK · MC-DISCOVER-WEAKNESS | **셋 중 유일하게 새 Capability 를 요구하지 않는다** — 이미 선 둘로 성립한다. 다만 그 둘이 모두 MISSING 이다 |
| MP-REACH-THE-UNREACHABLE | MC-REDEFINE-DOWN · MC-PLACE-FOOTING · MC-REDIRECT-FALLING-THING · MC-CARRY-LIFE-SUPPORT | 넷 다 MISSING 이다. 무대가 한 평면이라 닿을 수 없는 자리라는 것 자체가 세계에 없다 |

### MG-ACQUIRE-RARE-ORGAN (5 갈래)

| Possibility | 요구 중 없는 것 | 비고 |
|---|---|---|
| MP-KILL-CREATURE | **MC-TRANSFER-ITEM** | 쓰러뜨리는 것까지는 된다. **쓰러진 몸에서 아무것도 나오지 않고** 그 몸은 치워지지도 않아 영구 장애물로 남는다 — IS 주입으로 그 결손이 이름을 얻었다 |
| MP-TAKE-SHED-ORGAN · MP-TRADE-WITH-ACTOR | **MC-TRANSFER-ITEM** + 각자의 세계 기반 (탈락을 만드는 자율 행동 · 거래 상대) | IS §4 로 공통 앞칸 하나가 배선되었다. 몸 밖에 물건이 놓이지 않는 한 셋 다 열리지 않는다 |
| MP-FIND-DEAD-SPECIMEN · MP-FORCE-CREATURE-TO-RELEASE | **판정 불가 — requires 미배선** | BW §27 은 대안 구조만 공급했다. IS §4 가 이름을 댄 셋에 이 둘은 포함되지 않아 배선하지 않았다 — 요구 배선(OPTIONS/NEED)이 끝나야 판정된다 |

## 지금 세계에서 가장 큰 구멍

표 전체를 관통하는 것이 넷 있다. 개별 Capability 결손이 아니라 구조적 공백이다.

```text
1. 자원이 하는 일이 하나뿐이다  (넷 중 하나가 섰다)
   C020 으로 캔 것이 처음으로 무언가를 한다 — 던지면 상대가 상하고 그만큼 준다.
   그러나 만들 것도, 장착할 것도, 팔 것도 여전히 없다. IS 가 나눈 네 조각 중
   **쓴다만 서고 적용한다 · 만든다 · 주고받는다 셋이 MISSING** 이다.
   Q22 로 광물 계통과 grants 3건이 그래프에 섰으므로 BW §17 순환은 **설계에서는**
   닫혔지만 (growth/growth-graph.md), 그 grants 가 몸에 닿으려면 적용이 서야 한다.
   그리고 쓸 물건의 **종류**가 좁다 — 소비재 계통이 아직 세계에도 그래프에도 없다.

2. 성장이 세계 밖에 있다  (GS 주입으로 **그 자리의 이름**이 생겼다)
   능력치가 결과를 바꾸는 것은 닫혔지만 그 값을 올리는 유일한 경로가 디버그 명령이다.
   MP-OUTGROW-THE-OPPONENT 가 "닫힌 경로" 로 보였던 것은 이 구분을 놓쳤기 때문이다.
   GS §5 · §19 가 그 값이 어디에서 올라오는지를 다섯 축으로 명명했고 (Level · Class
   Mastery · Skill Mastery · Exploration Mastery · Equipment), 그중 넷이 노드로 섰다 —
   다섯째는 이미 선 MC-EQUIP-ITEM 이다. 그래서 이 구멍은 **크기가 그대로이되 모양이
   달라졌다**: 무엇을 만들어야 하는지 모르는 공백이 아니라, 무엇을 만들어야 하는지
   아는 결손이다. 그리고 그 넷 위에 형태(Class)를 넘는 문턱이 하나 더 있는데
   (MC-CHANGE-CLASS), 그것이 넘어갈 CL-* 는 이름이 문서마다 어긋나 아직 서지 못했다.

3. 앞날을 읽을 것이 없다  (C014·C016 으로 "지금" 은 읽히게 되었다)
   C014 가 "살펴보기 전에는 겨루는 힘을 모른다" 를 세우고 C016 이 거기 이르는 두 번째
   길(통찰)과 자리별 부분 공개를 세웠다 — BW §32 사슬의 첫 칸이 섰다.
   남은 것은 둘째 칸이다. 자율 존재의 다음 행동이 언제나 같은 한 가지라 읽을 거리가
   없고, 행동의 앞 구간이 앎의 관문과 무관하게 누구에게나 그냥 온다.
   발견·검증은 그 뒤에 얹힌다.

4. 땅이 무엇을 할지 미리 말해 주지 않는다  (C-TERRAIN-002 로 **땅이 돌기 시작했다**)
   "땅이 없다" 는 닫혔다. 무대가 자리로 나뉘고 자리가 법칙을 지니며 그 법칙이 멎는
   예외 자리가 그 안에 있다 (MW-MACRO-TERRAIN · MW-TERRAIN-SUNEATER-ICEFIELD 둘 다
   ABSENT → PARTIAL). 앞의 셋이 놓일 바닥은 이제 있다.

   **BT §15 의 셋째 항(대지 순환)이 닫혔다.** C-TERRAIN-002 로 거둔 것이 그 자리에
   쌓이고, 넘치면 뿜고, 뿜는 것을 몸이 받고, 다 쓰면 닫혀 도로 거둔다. 예외 자리는
   이제 놓이는 것이 아니라 넘침의 한 국면이며 옮겨 다닌다. BT §5.7 이 못 박은
   "대지가 열을 어디에서 빼앗고 **어디에 저장하는지**" 의 뒤 절이 섰다.

   **남은 것은 그것을 미리 읽는 일이다.** 지금 세계는 안전한 자리가 옮겨 다니는데
   그 움직임을 앞질러 읽을 방법이 없다 — 그것은 깊이가 아니라 불공정이다.
   BT §15.8 의 여덟째 항(관찰 — "설명 없이 볼 수 있는 증거")이 그 자리이고
   `MW-CIRCULATION-EVIDENCE` 가 ABSENT 다. 셀 주기는 생겼으나 언제 창이 열리는지를
   읽을 증거가 없어 여전히 겪어 봐야만 안다(MC-TIME-THE-CYCLE), 이을 자리는 여럿이
   되었으나 어느 것이 곧 닫히는지 모른다(MC-FIND-SAFE-ROUTE).

   그리고 순환이 서면서 **그 아래가 열렸다** — `MW-ADAPTED-LIFE`(무엇이 어디 사는가) ·
   `MW-TERRAIN-RESOURCE`(그 법칙이 낳는 자원) · `MW-NATURAL-SETTLEMENT`(정착) 셋이
   매달릴 자리를 지녔고 셋 다 ABSENT 다. 그 셋은 각각 기획서 승인을 기다린다
   (Design-Creature-Behavior-R0 · Design-Resource-Catalog-R0 — HUMAN 대기).

   **그리고 이것은 대지형 하나의 결손이 아니다.** BT §16 의 세계 골격에서 순환은
   지형과 생존 압력 사이의 고리이고, 그 아래에 생명과 물질의 적응 · 위험과 자원 ·
   자연적 피난처 · 사람과 문화가 전부 매달려 있다. 순환이 없는 동안 그 아래의 모든
   것은 **놓는 수밖에 없다** — 무엇이 어디에 사는지도, 어디가 안전한지도, 무엇이
   어디서 나는지도 세계가 답하지 못하고 세계를 적는 사람이 좌표에 찍는다. 지금
   세계가 정확히 그렇다: 해숨구멍은 손으로 놓인 예외 자리이고 광맥은 좌표에 찍혀
   있으며, `Design-Resource-Catalog-R0.md` §4 가 모든 자원에 요구하는 질문
   ("그 상태가 오랜 시간 반복되면 무엇이 만들어지는가")에 답할 수 있는 자원이
   세계에 하나도 없다. 이 사슬은 이제 그래프에 서 있다 — `MW-TERRAIN-CIRCULATION`
   아래로 지형(`MW-SHAPED-LANDFORM`) · 생존 압력(`MW-SURVIVAL-PRESSURE`) · 적응
   (`MW-ADAPTED-LIFE`) · 자원(`MW-TERRAIN-RESOURCE`) · 피난처(`MW-NATURAL-REFUGE`) ·
   정착(`MW-NATURAL-SETTLEMENT`) · 증거(`MW-CIRCULATION-EVIDENCE`) 일곱이며,
   `world-state.yaml` 머리의 §16 대조표가 열한 고리와 노드의 대응을 갖는다.
   그리고 순환은 이제 Goal 을 낳는다 (`MG-EXPLORE-BEIRA` — Q69(b) Human 결정) —
   그래서 다음 후보는 자기 이유를 Constraint 부기가 아니라 Goal 경로로 적을 수 있다.

   **일곱 중 여섯이 ABSENT 다.** 선 것은 생존 압력과 피난처의 절반뿐이며(C-TERRAIN-001),
   그 절반마저 순환에서 나오지 않고 상수로 놓여 있다. 이 층이 이 세계에서 가장 큰
   구멍인 이유가 그 수다.
```

## 갱신 경로

이 파일은 생성물이다 — Feedback 이 고치는 것은 노드 필드다.

```text
cycles/<CycleId>/08-verification.md 의 MASTER FEEDBACK
        ↓
guides/master-feedback.md (Feedback — 위쪽 접합점 반영)
        ↓
graph/*.yaml 노드의 overlay · overlay_evidence · overlay_gap ·
overlay_missing · overlay_note · implemented · implemented_note
(+ 섹션 구성이 바뀌면 graph/overlay-notes.yaml)
        ↓
npm run master:graph  →  이 파일 재생성 (경위는 feedback/<CycleId>.md 소유)
```

Cycle Agent 가 이 파일을 직접 편집하지 않는다.
