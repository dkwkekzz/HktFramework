# CYCLE C-GROWTH-001 — What You Did Makes You

[PASS] Cycle Definition           (쌓이는 자리 하나 · 기본값이 오른다 · 여는 것은 EXCLUDED)
[    ] Intent
[    ] World Semantic
[    ] GameView Specification
[    ] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

> **트랙 번호공간.** `C-GROWTH-` 접두사의 첫 Cycle 이다 (`guides/cycle-definition.md` Do 1).
> `C001`~`C026` 은 트랙 도입 전의 옛 번호공간이라 세지 않는다. 다른 트랙의 번호도 보지 않는다.

## MASTER TRACE

    Frontier            FR-WHAT-YOU-DID-MAKES-YOU — 한 일이 몸을 키운다
                        (`master/frontier/growth.md` 의 SELECTED · Human 위임 2026-08-26)

    Source Goal         MG-OVERCOME-SUPERIOR-OPPONENT

    Source Possibility  MP-OUTGROW-THE-OPPONENT       (전투 밖에서 기른 값으로 정면 교환을 이긴다)

    Target Capability   MC-GAIN-LEVEL                 (overlay: MISSING · `grounded: true`)

    Active Constraints  DC-WORLD-PROGRESSION-IS-REACH
                        DC-GROWTH-GOAL-FIRST
                        DC-COMBAT-PLAYER-CAUSALITY
                        DC-WORLD-OWNS-THE-SURFACE-LIST
                        DC-GROWTH-POWER-PAYS-IN-REACH-OR-CONSTRAINT
                        DC-GROWTH-REWARD-IS-NEW-REACH
                        DC-GROWTH-CAPABILITY-DECLARES-ITS-LIMITS

    Constraint Note     이 Cycle 이 실제로 지켜야 하는 형태로 풀면 이렇다.

                        PROGRESSION-IS-REACH — **이 Cycle 의 경계다.** 오른 값으로
                          어디에 갈 수 있는가를 정하지 않는다 (HISTORY Q53(a)).
                          문턱·관문·땅의 법칙 어디에도 이 값을 걸지 않는다. 갈 수 있는
                          곳은 여전히 감당 여부가 정한다. Balance Contract 의
                          `exploration_gate: none` 이 같은 말이다
                        GOAL-FIRST — 오르는 것 자체가 Goal 이 아니다. 오르는 이유는
                          MP-OUTGROW-THE-OPPONENT 하나이며, 이 Cycle 의 플레이는
                          "더 큰 수를 본다" 가 아니라 **못 넘던 상대를 넘는다** 여야 한다
                        PLAYER-CAUSALITY — 확률이 개입하지 않는다. 같은 행위는 같은 양을
                          쌓고, 오른 순간의 사유(무엇 때문에 올랐는가)가 관찰에 실린다.
                          "어느새 올라 있었다" 는 이 Constraint 의 실패다
                        OWNS-THE-SURFACE-LIST — 얼마나 쌓였고 · 다음 문턱이 어디이며 ·
                          방금 무엇이 왜 올랐는가를 **세계가** 싣는다. 화면이 쌓인 값을
                          보고 문턱을 나누어 단계를 계산하지 않는다
                        POWER-PAYS-IN-REACH-OR-CONSTRAINT — **가장 큰 제약이다.**
                          이 축은 적용(applicability 5) · 발동(reliability 5) ·
                          지속(permanence 5)이 전부 최대치다. 그러므로 **한 단계의 폭이
                          작아야 한다** (GB §20). 그 폭의 실제 수치는 03 이 정하고,
                          선언은 이미 서 있다 — `growth/balance/GBC-GAIN-LEVEL.yaml` 의
                          `power_envelope.general_combat: small_change_per_step`
                        REWARD-IS-NEW-REACH — 값이 일곱 축으로 이미 밝혀져 있고
                          `capability_access: 1`(새로 할 수 있게 되는 것이 없다)을 숨기지
                          않는다. 이 Cycle 은 그 선언을 **바꾸지 않는다** — 여는 것을
                          더하고 싶어지면 그것이 EXCLUDED 다
                        CAPABILITY-DECLARES-ITS-LIMITS — 통함/부분/안 통함이 Contract 의
                          `capability_reach` 에 이미 적혀 있다. 08 은 그 세 칸을 실측과
                          대조한다 (DC-GROWTH-INTENT-IS-MEASURED)

    Master Feedback     닫힐 때 `08-verification.md` 가 위층에 보고할 것 중 **미리 아는
                        것 하나**를 여기 박아 둔다. 이 Cycle 은 MC-GAIN-LEVEL 을
                        `MISSING → IMPLEMENTED` 로 올릴 수 있다고 미리 적지 않는다.

                        그 노드의 `world_shape` 는 "세계 안에서 한 일이 몸의 기본값을
                        바꾸고, 그 값이 오른 뒤 같은 상대·같은 행동의 결과가 실제로
                        달라져야 한다" 이며, 그 문장은 이 Cycle 의 INCLUDED 로 전부 덮인다.
                        그러나 노드의 `semantic` 이 든 원천 넷 중 **둘이 세계에 없다** —
                        "탐험하고" 와 "사건을 해결한 것" 이다. 땅이 이제 막 법칙을 지녔고
                        (C-TERRAIN-001) 세계에 사건이라 부를 것이 아직 없다. 그러므로
                        정직한 판정은 실측 뒤의 `MISSING → PARTIAL` 이 될 가능성이 높고,
                        남는 결손의 이름은 **"쌓이는 원천이 넷 중 둘뿐이다"** 다.
                        판정은 08 이 실행 결과로 한다 — 여기서 미리 닫지 않는다.

                        같은 이유로 **MP-OUTGROW-THE-OPPONENT 가 이 Cycle 로 닫히는지도
                        08 이 실측으로 판정한다.** 그 갈래가 요구하는 것은 "전투 밖에서
                        기른 값으로 정면 교환을 이긴다" 이고, 이 Cycle 이 세우는 원천 중
                        전투 밖의 것은 캐는 일 하나다. 그 하나로 갈래가 성립하는지는
                        플레이가 답한다.

                        이 둘은 상위 의미와 **어긋나지 않는다** — 후보 자신이
                        "지금 열 수 없는 것" 표에서 탐험 숙련이 땅을 기다린다고 적었고,
                        Contract 가 `validation.static: PENDING` 으로 비교 집합이 하나뿐임을
                        이미 밝혔다. 그러므로 MASTER GAP 이 아니라 예고된 보고다.

## TYPE

    New Capability — 성장의 바닥 축 (MS-GROWTH-SOURCE / LEVEL)

    다만 **키울 자리를 새로 세우는 것이 아니다.** 키울 값 여덟은 C010 · C012 · C013 ·
    C015 가 세웠고, 그 값을 매번 다시 세는 얼개(`effectiveStat` ·
    RULE-EFFECTIVE-STATS-001)는 C023 이, 거기 항을 더하는 형태는 C-COMBAT-001 이 이미
    보여 주었다. 이 Cycle 이 새로 세우는 것은 **그 값을 세계 안의 행위로 키우는 경로**
    하나다.

    그래서 이 Cycle 은 새 Capability 를 세우면서 동시에 **기존 Capability 의 변경**이다 —
    지금 세계에서 능력치를 바꾸는 길은 세계 **밖**의 명령 하나뿐이며
    (RULE-ATTRIBUTE-SET-001 · `MUTABLE_ATTRIBUTES`), 이 Cycle 이 그 옆에 세계 **안**의
    길을 처음으로 낸다. 밖의 길을 없애지는 않는다 — 그것은 디버그의 자리이고
    이 Cycle 의 EXCLUDED 다.

## TARGET CAPABILITY

    Actor  — 몸이 지니는 상태 둘 (쌓인 것 · 지금의 단계)
    Combat — 유효 값 (`world/semantic/combat.ts` 의 `effectiveStat` 와 그 독자들)

## GOAL

    플레이어가 자율 존재를 쓰러뜨리고 광맥을 캐면 **그 일이 몸에 쌓이는 것이 보이고**,
    쌓인 것이 문턱을 넘는 순간 무엇 때문에 올랐는지가 사유와 함께 실리며, 그 뒤부터
    **같은 종류의 상대에게 같은 기술을 쓰면 더 큰 피해가 들어간다** — 디버그 명령을
    한 번도 열지 않고, 처음으로.

    지금은 그럴 수 없다. 능력치가 결과를 바꾸는 규칙은 여덟 값에 걸쳐 이미 서 있지만
    (C010 · C012 · C013 · C015 · C016 · C023 · C-COMBAT-001), 그 값을 바꾸는 경로는
    `RULE-ATTRIBUTE-SET-001` 하나이고 그것은 `World.DebugAuthority.Open` 을 요구한다 —
    즉 세계 밖의 손이다. 그래서 지금의 세계에서 플레이어는 **자기가 한 일로는 아무것도
    되지 않는다.** 백 마리를 쓰러뜨리든 한 마리도 쓰러뜨리지 않든 몸은 같다.

    이 Cycle 이 끝나면 **한 일이 몸에 남는다.** 그리고 그 남은 것이 다음 한 방의 크기를
    바꾸므로, "지금 못 넘는 상대를 나중에 넘는다" 가 처음으로 세계 안의 문장이 된다.

    **"같은 상대" 를 어떻게 고정하는가** — 쓰러뜨린 몸은 다시 싸우지 않으므로, 08 이
    재는 상대는 *같은 종류의 다른 개체*다. 세계가 이미 그렇게 배치한다
    (`world/index.ts` 의 자율 존재들 · `spawnActor` 가 종류의 값으로 몸을 만든다).
    같은 종류의 새 몸은 언제나 같은 기본값에서 시작하므로 이 비교는 성립한다.

## INCLUDED

    쌓이는 것                    몸이 "지금까지 한 일" 을 값으로 지닌다. 하나이며
                                 갈래로 나뉘지 않는다 — 무엇을 했든 같은 곳에 쌓인다
                                 (갈래로 나누는 것은 FR-THE-BODY-REMEMBERS-ITS-WAY)
    지금의 단계                  쌓인 것이 문턱을 넘은 횟수. 파생이 아니라 **상태**인지
                                 파생인지는 03 이 정한다 (아래 물음 ②)
    세계 안의 행위가 쌓는다       세계 밖 명령이 아니라 규칙이 쌓는다. 어느 행위가 쌓게
                                 하는지는 03 이 정하되, **후보가 든 넷 중 지금 세계에
                                 실재하는 것만** 쓴다 — 치는 것(RULE-STRIKE-DAMAGE-001) ·
                                 쓰러뜨리는 것(RULE-DOWNED-001) ·
                                 캐는 것(RULE-MINE-COMPLETE-001) ·
                                 살펴보는 것(RULE-OBSERVE-COMPLETE-001).
                                 없는 원천(탐험 · 사건 해결)을 지어내지 않는다
    문턱을 넘으면 기본값이 오른다  단계가 오르면 몸의 기본값 중 정해진 것이 오른다.
                                 무엇이 오르는지는 GS §5 가 이름을 댔다 —
                                 생명력 · 공격력 · 방어력 · 기력 · 기본 이동 능력.
                                 그중 무엇을 이 Cycle 이 실제로 올리는지는 03 이 정한다
    오른 값이 판정에 들어간다      새 공식을 세우지 않는다. 오른 값은 이미 있는 유효 값
                                 경로를 그대로 지나 지금의 한 공식에 들어간다
                                 (`effectiveStat` → `rawDamage` → 감쇄 → 최종 피해)
    쌓임의 관찰                   얼마나 쌓였는가 · 다음 문턱이 어디인가 ·
                                 방금 무엇 때문에 올랐는가가 관찰에 실린다
                                 (DC-WORLD-OWNS-THE-SURFACE-LIST · 후보의 ④)
    오름의 사유                   단계가 오른 순간, 그 오름이 어느 행위에서 왔고 무엇이
                                 얼마나 올랐는지가 사유와 함께 읽힌다. 이 항목이 빠지면
                                 DC-COMBAT-PLAYER-CAUSALITY 가 깨진다
    자리는 모든 몸에 선다          쌓인 것과 단계를 **어떤 몸이든 지닌다** — 조종 주체를
                                 가리지 않는다 (equipment · allocation · warmth 가 세운
                                 선례 그대로). 쌓는 규칙이 자율 존재에게도 도는가는
                                 03 이 정한다 (아래 물음 ③)

## EXCLUDED

    갈래로 나누어 쌓는 것          "버텨 냈다 · 정면으로 받았다 · 깨뜨렸다" 를 따로 세는 것.
                                 **FR-THE-BODY-REMEMBERS-ITS-WAY 의 몫이다.** 여기서는
                                 무엇을 했든 같은 곳에 쌓인다
    형태(Class)                   CL-* 는 계열별 설계 문서의 주입을 기다린다.
                                 이 Cycle 은 형태를 세우지도 바꾸지도 않는다
    스킬이 자라는 것              기술의 값이 몸마다 달라지는 것 —
                                 FR-THE-SKILL-LEARNS-A-NEW-MOVE 의 몫이다
    **새로 할 수 있게 되는 것**    올라도 못 하던 일은 못 한다 (Contract 의
                                 `capability_access: 1` · `capability_reach.ineffective`).
                                 행동이 늘거나 조건이 성립하게 되는 것은 이 축이 아니다
    **땅의 문턱 · 관문**          이 값으로 어디에 갈 수 있는가를 정하지 않는다
                                 (DC-WORLD-PROGRESSION-IS-REACH · HISTORY Q53(a) ·
                                 `exploration_gate: none`). 땅이 거두는 열은 값이 높아도
                                 그대로 거둔다
    쌓인 것이 줄어드는 것          죽음의 대가로 잃는 것 · 시간이 지나 바래는 것.
                                 한 번 오르면 내려가지 않는다 (`permanence: 5`).
                                 잃는 것을 더하면 상태가 하나 더 늘고 이 Cycle 이 더하는
                                 것은 위의 둘뿐이다
    세계 밖 명령을 없애는 것       `RULE-ATTRIBUTE-SET-001` 은 그대로 남는다. 그것은 디버그의
                                 자리이지 성장의 자리가 아니며, 이 Cycle 이 대신하는 것은
                                 **성장의 자리** 하나다. 다만 밖에서 손댄 기본값과 안에서
                                 자란 몫이 서로를 지우면 안 된다 (아래 물음 ②)
    자원을 써서 오르는 것          `resource: 1` · `economic_utility: 1` 이 그 선언이다.
                                 무엇을 바쳐서 오르는 형태는 이 축이 아니다
    경험치 표시 전용 화면          쌓임은 관찰에 실리지만, 그것만을 위한 새 표면(성장 창 ·
                                 레벨업 연출)을 세우는 것은 이 Cycle 이 아니다.
                                 화면 몫이 남으면 `works/BACKLOG.md` 로 넘긴다
    상대의 쌓임이 보이는 것        남의 단계가 관찰에 실리는가는 C016 의 가려짐 관문이
                                 소유하는 물음이다. 이 Cycle 의 Goal 이 요구하지 않는다 —
                                 요구되면 그때 후보로 승격한다

## RELATED EXISTING CAPABILITY

    재사용 — 이 Cycle 이 얹히는 자리 (형태를 바꾸지 않기를 기대한다)
        effectiveStat                  C023 · C-COMBAT-001 · RULE-EFFECTIVE-STATS-001 —
                                       지금 세 항이다 (기본값 + 걸린 것 + 배분) 그리고
                                       0 바닥이 있다. **저장하지 않고 매번 다시 센다**
        ActorState 의 여덟 능력치        C010 · C012 · C013 · C015 — "기본값" 이라는 뜻을
                                       가진 값들. 이 Cycle 이 그 뜻을 유지한다
        hp / hpMax · cp / cpMax        C007 — GS §5 가 이름을 댄 생명력·기력의 자리
        moveSpeed                      C007 — GS §5 의 "기본 이동 능력" 이 걸릴 자리
        rawDamage / offenseStatValue   C010 · C012 — 유효 값을 읽는 자리. **읽는 방법은
                                       그대로다**
        DamageBreakdown                MC-COMBAT-CAUSE-READING (IMPLEMENTED) — 한 방의
                                       경위를 싣는 자리. 배분이 `fromAllocation` 으로
                                       자기 몫을 실은 것과 같은 꼴을 성장도 쓸 수 있다
        RULE-DOWNED-001                C007 · `world/rules/strike-damage.ts` —
                                       "쓰러뜨렸다" 가 세계에 성립하는 유일한 자리
        RULE-MINE-COMPLETE-001         C001 · C022 — "캤다" 가 성립하는 자리
        RULE-OBSERVE-COMPLETE-001      C014 — "살펴봤다" 가 성립하는 자리
        acquaintance.ts                C014 — 겪은 것이 관찰자별 장부로 남는 선례.
                                       쌓인 것이 어디에 사는가의 참고형
        insight                        C016 — 몸이 **겨루지 않는 값**을 지니는 선례.
                                       쌓인 것이 그와 같은 성질이다
        spawnActor / character-catalog C007~ — 새 몸이 언제나 종류의 값에서 시작한다.
                                       08 의 "같은 종류의 다른 개체" 비교가 이것에 기댄다

    영향 가능 (AFFECTED — Stage 3 이 확정한다)
        RULE-ATTRIBUTE-SET-001         `world/rules/attribute-set.ts` — 밖에서 기본값을
                                       덮어쓴다. 자란 몫이 기본값 **자체**에 들어가면
                                       이 규칙이 성장을 지우거나 성장이 이 규칙을 지운다.
                                       03 이 그 관계를 명시해야 한다 (물음 ②)
        MUTABLE_ATTRIBUTES             `world/semantic/combat.ts` — 새로 생기는 값이
                                       이 목록에 드는가. 들면 디버그로 단계를 올려 볼 수
                                       있고, 들지 않으면 플레이로만 오른다.
                                       **어느 쪽이든 사유를 적는다**
        관찰 표면 (self)                `world/projection/observer-view.ts` 의 능력치 줄들 —
                                       C010 · C012 · C013 · C015 · C016 · C023 ·
                                       C-COMBAT-001 의 관찰이 전부 이 값을 지난다.
                                       값이 국면이 아니라 **이력**으로 움직이므로 회귀 범위가 넓다
        HUD                            `view/hud-presentation.ts` — 쌓인 양과 다음 문턱이
                                       자리를 요구한다. **VIEW 레인·COMBAT 트랙과 같은
                                       파일이다** — 자기 영역 끝에 추가만 하고 기존 줄을
                                       옮기지 않는다 (LANES 충돌 칸)
        gameview-combat.ts             관찰 계약이 넓어진다 — 자기 도메인 파일에만 더한다
        npc-decide.ts                  자율 존재도 쌓는다면 그 값이 판단에 드는가.
                                       기본은 "들지 않는다" 이며, 바꾸려면 사유가 필요하다

    건드리지 않는다
        engine/                        기반이다. 컨텐츠 Cycle 이 편집하지 않는다
                                       (`npm run boundary:check`)
        allocation.ts 의 세 축과 몫      배분은 그대로다. 성장은 그 옆에 서는 **다른 항**이지
                                       같은 항의 확장이 아니다
        equipment.ts 의 기여 계산        걸린 것의 기여도 그대로다
        terrain / ground-law           땅의 법칙에 이 값을 걸지 않는다
                                       (DC-WORLD-PROGRESSION-IS-REACH)

## 이 Cycle 이 답해야 하는 것 — Stage 2·3 으로 넘긴다

    아래 넷은 여기서 정하지 않는다. 정할 자리가 아니고(구현 방법이 아니라 세계 의미),
    정할 근거도 Stage 3 이 세운다. 다만 **Stage 3 이 이것을 지나쳤다면 그 단계가 덜
    닫힌 것**이므로 여기 남긴다.

    ① 어느 행위가 얼마를 쌓는가 — 그리고 왜 그 크기인가
       후보가 든 넷 중 세계에 실재하는 것은 치고 · 쓰러뜨리고 · 캐고 · 살펴보는 것이다.
       넷이 다 쌓아야 하는지, 어느 하나만으로 문턱을 넘을 수 있는지, 반복이 무한한 원천
       (`repeatability: 1` — 같은 방법을 무한히 반복할 수 있어서 비용이 낮다)에서
       한 단계의 폭이 왜 작아야 하는지가 같은 물음이다.
       **DC-GROWTH-POWER-PAYS-IN-REACH-OR-CONSTRAINT 가 이 선택의 심판이다.**

    ② 자란 몫이 기본값 **자체**를 덮는가, 유효 값의 **넷째 항**이 되는가
       두 갈래가 서로 다른 세계를 만든다.

           덮는다      `actor.physicalAttack` 이 실제로 커진다. 후보의 문장
                       ("기본값 여덟 중 정해진 것이 오른다")에 글자 그대로 가깝다.
                       그러나 `RULE-ATTRIBUTE-SET-001` 이 같은 자리를 덮어쓰므로
                       밖의 손과 안의 성장이 서로를 지운다
           넷째 항     단계는 상태로 남고, 그 단계가 낳는 기여를 `effectiveStat` 이
                       매번 다시 센다. C023 이 세운 원칙("가감이 아니라 재계산 —
                       저장하면 두 개의 진실이 생긴다")과 C-COMBAT-001 이 셋째 항으로
                       보여 준 형태를 그대로 잇는다. 밖의 손은 기본값을,
                       성장은 자기 항을 건드리므로 둘이 갈라진다

       배차판(LANES.md 충돌 칸)은 넷째 항을 예상하고 적혀 있다. 그러나 그것은 파일
       겹침의 판단이지 세계 의미의 판정이 아니다 — **03 이 사유를 적고 정한다.**
       어느 쪽이든 플레이어가 보는 문장은 같아야 한다: "한 일이 몸을 키웠다."

    ③ 자율 존재도 쌓는가
       쌓는 자리는 모든 몸에 서지만(위 INCLUDED), 쌓는 **규칙**이 자율 존재에게도 도는가는
       다른 물음이다.

           돈다        플레이어 전용 장치가 아니다 — C-COMBAT-001 이 배분에 대해
                       내린 판단과 같은 방향이다. 다만 상대가 함께 자라면 08 의
                       "같은 종류의 다른 개체" 비교가 흔들릴 수 있다
           돌지 않는다  자율 존재의 값은 종류가 정한 채로 멈춰 있다. 걸린 것이 비어 있는
                       것과 같은 꼴(C023)이며, 08 의 비교가 흔들리지 않는다.
                       대신 "왜 저 몸은 자라지 않는가" 에 세계가 답해야 한다

       **어느 쪽이든 사유를 적는다** — 말없이 비켜 가지 않는다.

    ④ 쌓인 것이 `MUTABLE_ATTRIBUTES` 에 드는가
       들면 디버그로 단계를 밀어 올려 층을 확인할 수 있다 — C013 · C015 · C016 이
       그렇게 자기 층을 플레이로 확인했다. 들지 않으면 오직 플레이로만 오르며,
       그것은 이 Cycle 의 Goal("디버그 명령 없이 처음으로")과 더 가깝지만 검증이 느려진다.
       **둘은 배타적이지 않다** — 08 이 어느 경로로 무엇을 쟀는지 적으면 된다.
