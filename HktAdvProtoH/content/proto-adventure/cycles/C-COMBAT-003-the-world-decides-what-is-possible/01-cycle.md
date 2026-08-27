# CYCLE C-COMBAT-003 — The World Decides What Is Possible

[PASS] Cycle Definition           (사정 목록 하나 · 읽는 자리 둘 · 새 상태 0 · 새 기술 하나)
[    ] Intent
[    ] World Semantic
[    ] GameView Specification
[    ] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

> **트랙 번호공간.** `C-COMBAT-` 접두사의 셋째 번호다. `cycles/` 에 있는 것은
> `C-COMBAT-001` 하나뿐이지만 **002 는 재사용하지 않는다** — 그 번호는 철회된 사슬 A 의
> 첫 Cycle 이 이미 썼고 (`master/HISTORY.md` "사슬 A 철회"), 되쓰면 그 이력이 두 뜻을
> 가진다. `C001`~`C026` 은 트랙 도입 전의 옛 번호공간이라 세지 않는다.

## MASTER TRACE

    Frontier            FR-THE-WORLD-DECIDES-WHAT-IS-POSSIBLE — 세계가 무엇이 가능한지를 정한다
                        (`master/frontier/combat.md` 의 SELECTED · Human 위임 2026-08-27)

    Source Goal         MG-OVERCOME-SUPERIOR-OPPONENT

    Source Possibility  MP-BIND-BY-CONTRACT           (전진 — 사슬 B 의 바닥을 놓는다)
                        MP-KNOW-THE-OPPONENT-RULE     (전진 — 규칙의 형태를 세운다)

    Target Capability   MC-ABILITY-CONDITION          (overlay: PARTIAL)
                        MC-AURA-ALLOCATION            (overlay: PARTIAL — 남은 절반을 겨눈다)

    Active Constraints  DC-COMBAT-PLAYER-CAUSALITY
                        DC-COMBAT-UNAVAILABLE-HAS-A-REASON
                        DC-CONDITION-OPENS-WITHOUT-RECORDING
                        DC-COMBAT-ABILITY-IS-A-RULE
                        함께 걸리는 것 — DC-COMBAT-ONE-FORMULA · DC-COMBAT-ONE-LAYER-AT-A-TIME ·
                        DC-WORLD-OWNS-THE-SURFACE-LIST

    Constraint Note     이 Cycle 이 실제로 지켜야 하는 형태로 풀면 이렇다.

                        PLAYER-CAUSALITY — 가능 여부에 확률이 한 톨도 들어가지 않는다.
                          같은 세계 상태에서 같은 기술은 언제나 되거나 언제나 안 된다.
                          "조건이 참이면 확률이 오른다" 는 이 층이 아니다
                        UNAVAILABLE-HAS-A-REASON — 못 쓰는 사유가 **세계가 고른 하나**로
                          관찰에 실린다. 지금 그 자리는 이미 서 있고 (`unavailableReason`),
                          이 Cycle 은 그 자리에 **처음으로 세계의 사실에서 온 사유**를
                          싣는다. 지금까지의 사유 넷은 전부 자기 조건이다
                          (downed · guarding · action-busy · insufficient-cp)
                        CONDITION-OPENS-WITHOUT-RECORDING — 조건이 연 것을 어디에도
                          적지 않는다. 조건이 거짓이 되면 별도 규칙 없이 닫혀야 한다.
                          과거 사건을 보는 조건도 이 DC 의 경계 안이다 (Q61(a)) — 다만
                          **그 사건을 이 Cycle 이 새로 적어 두지는 않는다.** 읽을 사실은
                          이미 세계에 있고 스스로 수명을 다한다 (World.StrikeEvents ·
                          STRIKE_EVENT_TTL · RULE-STRIKE-EVENT-EXPIRE-001)
                        ABILITY-IS-A-RULE — 능력이 처음으로 **규칙의 칸을 갖는다.**
                          UL §16 의 아홉 칸 중 이 Cycle 이 세우는 것은 둘이다 —
                          Requirement(무엇이 갖춰져야 하는가)와 Condition(무엇이 참일 때
                          강해지는가). 나머지 일곱은 뒤의 후보들이 채운다
                        ONE-FORMULA — 강화된 결과가 **새 공식이 아니다.** 조건이 참일 때
                          달라지는 것은 그 한 방이 지닌 위력 정의뿐이고, 피해는 지금의
                          한 공식(C010 · C012 · C020)을 그대로 지난다. 조건 전용 피해식은
                          이 Cycle 의 실패다
                        ONE-LAYER-AT-A-TIME — 사정을 지니지 않는 기술은 지금까지와 한 톨도
                          다르지 않아야 한다. 기존 셋(attack · heavy-attack · aura-strike)의
                          사정 목록이 비어 있고, 빈 목록이 언제나 참이라는 것이 회귀의 근거다
                        WORLD-OWNS-THE-SURFACE-LIST — 어느 기술이 어떤 사정을 요구하는지,
                          지금 그것이 참인지, 아니면 왜 아닌지를 **세계가** 싣는다.
                          화면이 기술 이름을 보고 조건을 판단하지 않는다

    Master Feedback     닫힐 때 `08-verification.md` 가 위층에 보고할 것 중 **미리 아는
                        것 둘**을 여기 박아 둔다.

                        ① MC-ABILITY-CONDITION 은 `PARTIAL → IMPLEMENTED` 를 겨눈다.
                        그 노드의 world_shape 이 요구하는 것은 셋이다 — 가능 여부가 세계
                        상태에서 계산될 것 · 불가능하면 사유가 하나 드러날 것 · 조건이 참인
                        동안에만 강화된 결과가 나올 것. 셋 다 이 Cycle 의 INCLUDED 다.
                        그래서 넷째(④ 사정이 목록이라는 것)까지 포함해 넷을 함께 세운다 —
                        셋 중 하나라도 빼면 노드가 또 PARTIAL 로 남는다. 판정은 Stage 8 이
                        실측으로 한다.

                        ② MC-AURA-ALLOCATION 의 남은 절반. C-COMBAT-001 이 스스로
                        `MISSING → PARTIAL` 로 보고하며 남긴 결손은 "배분이 값만 바꾸고
                        **무엇을 할 수 있는가의 목록**을 바꾸지 않는다" 였다 (UL §15 —
                        "능력을 일정 이상 몰아야만 …"). 이 Cycle 의 사정 목록에 배분을
                        보는 항목이 하나 서면 그 결손이 닫힌다. **그래서 그것을 첫 사정으로
                        고른다** (아래 INCLUDED).

                        둘 다 상위 의미와 어긋나지 않는다 — 후보가 적은 것을 그대로 한다.
                        MASTER GAP 이 아니라 예고된 보고다.

## TYPE

    New Capability — 능력의 성립 사정 (MS-AURA-NEN / CONDITION)

    동시에 **기존 Capability 의 확장**이다. 기술이 나갈 수 있는지를 재는 자리
    (`world/rules/skill.ts` 의 `evaluateSkillPreconditions`)는 C007 이래 서 있고,
    그것이 답하는 사유는 지금 넷이다. 이 Cycle 은 그 자리에 관문을 하나 더하고, 그 관문이
    읽는 목록을 새로 세운다. 피해 계산 쪽도 같다 — 위력 정의로 피해를 세는 자리
    (`forceOfSkill` · C020)는 그대로이고, 조건이 그 정의를 고르는 자리가 하나 는다.

## TARGET CAPABILITY

    Combat — 기술의 성립 판정 (`world/rules/skill.ts` · `evaluateSkillPreconditions`)
    Combat — 한 방의 위력 정의 (`world/semantic/combat.ts` · `forceOfSkill`)
    World  — 사정 목록 (새로 선다 — `HOSTILITY_REASONS` 와 같은 꼴)

## GOAL

    플레이어가 어떤 기술을 **세계의 사실 때문에** 쓰지 못한다. 자원이 모자라서도,
    막고 있어서도, 다른 행동 중이어서도 아니다 — 지금 힘을 그쪽에 몰아 두지 않았기
    때문이고, 세계가 그 사유를 그대로 말한다. 배분을 바꿔 그 사실을 참으로 만들면
    같은 기술이 같은 자원으로 나간다. 그리고 그 기술은 **다른 사실이 참인 동안**
    — 방금 그 상대에게 맞았거나, 자기 생명이 절반 아래일 때 — 더 크게 들어가고,
    한 방의 경위가 어느 사정이 그것을 키웠는지를 말한다.

    지금은 그럴 수 없다. 기술이 나가지 못하는 사유는 넷뿐이고 (쓰러짐 · 막는 중 ·
    행동 중 · 기력 부족) 그 넷은 전부 **자기 몸의 사정**이다. 세계가 어떤 상태이든,
    상대가 무엇을 했든, 내가 힘을 어디에 몰아 두었든 쓸 수 있는 기술의 목록은 같다.
    그래서 지금의 기술 고르기는 "무엇이 지금 상황에 맞는가" 가 아니라 "기력이 되는가"
    하나로 끝난다.

    이 Cycle 이 끝나면 **같은 몸이 같은 자원을 지니고도 국면마다 다른 목록을 지닌다.**
    그리고 그 목록이 달라지는 이유는 숨은 것이 아니라 세계가 말해 주는 것이라,
    닫힌 기술을 열러 가는 수가 성립한다.

## INCLUDED

    사정 목록                     능력이 읽는 세계의 사실들. **목록이며 판정은 읽기만
                                  한다** — `HOSTILITY_REASONS` (C018)와 같은 꼴이고 같은
                                  이유다. 항목을 더해도 관문도 관찰도 시험도 열리지 않는다
                                  (DC-WORLD-OWNS-THE-SURFACE-LIST)
    사정을 읽는 자리 둘            같은 목록을 두 자리가 읽는다. **쪼갤 수 없다** — 아래
                                  "왜 한 Cycle 인가" 가 사유를 지닌다
                                    ① 관문 (UL §18 Requirement) — 갖춰지지 않으면 나가지
                                       않는다. 기술의 가능 여부가 세계 상태에서 갈린다
                                    ② 강화 (UL §19 Condition) — 참인 동안에만 더 크게
                                       들어간다. 참이 아니어도 기술은 나간다
    못 쓰는 사유가 세계에서 온다    사유 코드가 하나 실린다 — 지금 넷이 자기 조건인 자리에
                                  **세계의 사실에서 온 사유**가 처음 선다
                                  (DC-COMBAT-UNAVAILABLE-HAS-A-REASON)
    첫 관문 사정 — 지금의 배분      "능력을 일정 이상 몰아 두었는가" (UL §15 · §18 의
                                  `Aura Ability ≥ 3`). **이것이 첫째로 고른 사정이다** —
                                  C-COMBAT-001 이 남긴 결손(배분이 목록을 바꾸지 않는다)을
                                  이 항목 하나가 닫는다. 문턱 값은 Stage 3 이 정한다
    강화 사정 둘                   ① 그 상대가 나를 먼저 쳤다 (UL §19 첫 예) — 이미 있는
                                     세계의 사실(World.StrikeEvents)에서 읽는다. 새로
                                     적어 두지 않고, 그 사실이 스스로 수명을 다하면 조건도
                                     닫힌다 (DC-CONDITION-OPENS-WITHOUT-RECORDING)
                                  ② 내 생명이 절반 아래다 (UL §19 넷째 예) — 지금의 값에서
                                     매번 다시 센다. `isDowned` 와 같은 자리, 같은 꼴이다
    사정을 지닌 기술 하나           위 셋을 실제로 지는 기술이 세계에 하나 선다. 기존 셋의
                                  사정 목록은 **비어 있고**, 빈 목록은 언제나 참이다 —
                                  그것이 회귀의 근거다 (DC-COMBAT-ONE-LAYER-AT-A-TIME)
    강화가 경위에 실린다            한 방의 계산 경위에 어느 사정이 참이어서 무엇이 얼마나
                                  커졌는지가 읽힌다 (MC-COMBAT-CAUSE-READING 의 자리를
                                  그대로 쓴다 · DC-COMBAT-PLAYER-CAUSALITY 의 설명 가능성)
    사정이 관찰에 실린다            어느 기술이 무엇을 요구하는지 · 지금 그것이 참인지 ·
                                  아니면 왜 아닌지가 세계에서 온다. 화면이 스스로 세지 않는다
    자율 존재도 같은 관문을 지난다   규칙은 조종 주체를 묻지 않는다. 상대의 기술도 같은
                                  사정을 지고, 상대가 힘을 옮기면 상대의 목록도 달라진다 —
                                  이것이 뒤 후보(FR-KNOW-WHAT-THEY-CAN-DO)가 읽을 규칙의
                                  첫 실물이다

## EXCLUDED

    조건이 겹칠수록 커지는 것       두 사정이 함께 참일 때 결과가 합성되는 규칙
                                  (MC-CONDITION-STACKING). **크기의 문제이지 가능의 문제가
                                  아니다** — 후보 자신이 그렇게 갈랐다. 이 Cycle 의 강화는
                                  사정마다 독립이며, 겹침의 합성 규칙을 세우지 않는다
    표식 · 계약 · 봉인              사슬 B 의 나머지 넷. 전부 이 관문 **위에** 선다
                                  (frontier 의 Depends on). 여기서는 관문만 세운다
    상대의 규칙을 알아내는 것       상대가 어떤 사정을 지는지가 가려져 있고 겪어야 드러나는
                                  것 (FR-KNOW-WHAT-THEY-CAN-DO). 이 Cycle 에서 사정은
                                  양쪽 모두에게 그냥 보인다 — 가리는 층은 그 후보의 몫이다
    시작 계기 (UL §17 Trigger)     `On Hit` · `On Damaged` · `On Contract Violation` 처럼
                                  능력이 **스스로 시작되는** 계기. 이 Cycle 의 기술은
                                  여전히 사람이 (혹은 자율 존재가) 고를 때 시작된다.
                                  아홉 칸 중 이 칸은 열지 않는다
    실패의 뒷일 (UL §16 Failure)   조건을 못 갖춘 채 나가서 실패하는 일. 여기서는 **나가지
                                  않는다** — 관문이 앞에 서므로 실패라는 상태가 없다
    새 자원 · 새 게이지             사정은 값이 아니라 사실이다. 조건을 여는 대가로 무는
                                  자원을 만들지 않는다
    새 피해 공식                   조건이 여는 것은 위력 정의이지 계산 경로가 아니다
                                  (DC-COMBAT-ONE-FORMULA)
    조건을 기록하는 것              "한 번 참이었으니 이번 싸움 동안 열어 둔다" 는 이 층이
                                  아니다 (DC-CONDITION-OPENS-WITHOUT-RECORDING)
    전투 밖에서 사정을 만드는 화면   사정을 짓고 기술에 붙이는 자리. 세계가 정해 두고
                                  기술이 지닐 뿐이다
    확률                          가능 여부에도 강화에도 난수가 없다. Critical 은 이 Cycle 이
                                  건드리지 않는 별개의 예외다 (C015)
    대답 · 정밀 구간 · 기회         사슬 A 전부 — 이 트랙에 없다 (HISTORY "사슬 A 철회")

## 왜 한 Cycle 인가 — 관문과 강화를 쪼개지 않은 사유

    후보는 "새 상태가 없다 — 느는 것은 사정 목록의 항목과 그것을 읽는 관문 하나다" 라고
    적었다. 이 Cycle 은 그 목록을 읽는 자리를 **둘** 둔다. 그래서 사유를 남긴다.

    쪼개면 어느 쪽도 자기 노드를 닫지 못한다. `MC-ABILITY-CONDITION` 의 world_shape 은
    세 문장이며 그 셋째가 "조건이 참인 동안에만 강화된 결과가 나와야 한다" 다. 관문만
    세우면 그 노드가 또 PARTIAL 로 남고, 강화만 세우면 첫 두 문장이 남는다. 노드를 반씩
    두 번 미는 것은 이 트랙이 직전 Cycle 에서 이미 치른 값이다.

    그리고 **둘은 같은 것의 두 세기다.** 세우는 것은 사정 목록 하나이고, 관문은 그것이
    거짓일 때 나가지 못하게 하며 강화는 그것이 참일 때 더 들어가게 한다. 나뉜 것은
    읽는 자리이지 세우는 것이 아니다 — 새 상태는 여전히 0 이고, 두 자리 모두 목록에서
    한 줄도 자기 안에 적지 않는다.

    쪼갤 수 있었던 것은 이미 쪼갰다 — 표식 · 계약 · 봉인은 전부 EXCLUDED 다.

## RELATED EXISTING CAPABILITY

    재사용 — 이 Cycle 이 얹히는 자리 (형태를 바꾸지 않기를 기대한다)
        evaluateSkillPreconditions     C007 · C011 · C019 — 기술이 나갈 수 있는가를 재고
                                       사유를 하나 고르는 자리. **판정이 한 곳에만 있어야
                                       "왜 안 되는가" 와 실제 거절이 어긋나지 않는다**
                                       (그 파일의 주석이 이미 그렇게 적었다). 관문이
                                       이 함수 안에 선다
        HOSTILITY_REASONS              C018 · `world/semantic/relation.ts` — 사정을 목록으로
                                       두고 판정이 읽기만 하는 선례. 저장하지 않고 지금의
                                       사실에서 유도한다는 성질까지 같다. **사정 목록의
                                       모양이 이것을 따른다**
        SKILL_DEFINITIONS              C007 · C012 · C019 · C025 — 기술이 자기 값을 지니는
                                       표. 사정도 기술이 지니는 값이 된다
        forceOfSkill / Force           C020 — 피해 공식의 입력이 SkillKind 에서 **위력
                                       정의**로 넓어진 자리. 조건이 고르는 것이 이 정의다
        allocationContribution         C-COMBAT-001 · `world/semantic/allocation.ts` —
                                       지금의 배분과 그 몫. 첫 관문 사정이 이 몫을 읽는다
        World.StrikeEvents             C007 · STRIKE_EVENT_TTL · RULE-STRIKE-EVENT-EXPIRE-001
                                       — "그 상대가 나를 먼저 쳤다" 가 읽을 사실.
                                       **이미 스스로 수명을 다한다**
        hp / hpMax · isDowned          C007 · C010 — "생명이 절반 아래다" 가 읽을 값과,
                                       지금의 값에서 매번 다시 세는 판정의 선례
        계산 경위                       MC-COMBAT-CAUSE-READING (IMPLEMENTED) — 강화가
                                       얼마를 보탰는지가 여기 실린다
        unavailableReason              C007 이래의 사유 칸 · `view/skill-presentation.ts` —
                                       세계가 고른 하나가 실리는 자리. 이 Cycle 은 이
                                       자리에 새 코드를 하나 싣는다
        npc 판단                        C002 · `world/simulation/npc-decide.ts` —
                                       자율 존재가 관문을 지나는 자리

    영향 가능 (AFFECTED — Stage 3 이 확정한다)
        기술 관찰 표면                  `world/projection/observer-view.ts` 의 interactions —
                                       기술마다 available 과 사유가 실리는 자리가 셋이다.
                                       기술이 하나 늘면 그 자리가 넷이 되고, 사정이 실릴
                                       칸도 요구된다. C007 · C012 · C019 의 관찰이 전부
                                       이 자리를 지나므로 회귀 범위가 넓다
        기술 조작 표면                  `view/skill-presentation.ts` · `view/bindings.ts` ·
                                       `view/key-registry.ts` — 기술이 하나 늘면 그것을
                                       고를 자리가 필요하다. **세계가 목록을 싣고 화면이
                                       그것을 그리는 형태를 지킨다**
        전투 HUD                        `view/hud-presentation.ts` · `view/combat-presentation.ts`
                                       — **VIEW 레인과 같은 파일이다.** 자기 영역 끝에
                                       추가만 하고 기존 줄을 옮기지 않는다 (LANES 충돌 칸)
        engagementReachViolations       `world/semantic/combat.ts` — 기술 목록을 도는 검사.
                                       기술이 하나 늘면 그 기술의 닿는 거리도 여기 걸린다
        모션                            `motions/` — 새 기술이 무엇으로 보이는가.
                                       기존 시트를 재사용할지는 Stage 7 이 정한다

    건드리지 않는다
        engine/                        기반이다. 컨텐츠 Cycle 이 편집하지 않는다
                                       (`npm run boundary:check`)
        피해 계산 자체                   `damage-calculate.ts` · `strike-damage.ts` 의 공식.
                                       조건은 그 공식이 읽는 위력 정의를 고를 뿐이다
        ALLOCATION_CATALOG 의 값들      배분의 몫과 항목은 C-COMBAT-001 의 것이다.
                                       이 Cycle 은 그 몫을 **읽기만** 한다

## 이 Cycle 이 답해야 하는 것 — Stage 2·3 으로 넘긴다

    아래 넷은 여기서 정하지 않는다. 세계 의미이고 근거를 Stage 3 이 세운다. 다만
    **Stage 3 이 이것을 지나쳤다면 그 단계가 덜 닫힌 것**이므로 여기 남긴다.

    ① 사정은 무엇을 입력으로 받는가
       `HOSTILITY_REASONS` 의 항목은 `(a, b)` 두 몸을 받는다. 이 Cycle 의 사정은
       관문일 때 대상이 없고 (쓰기 전에 재므로) 강화일 때 대상이 있다. 같은 목록을
       두 자리가 읽으려면 이 입력의 모양이 하나여야 한다 — 아니면 목록이 둘로 갈리고,
       그러면 "사정은 목록이다" 가 두 목록이 된다.

    ② 강화는 위력 정의의 무엇을 바꾸는가
       `Force` 는 `baseDamage` 와 `attackRatio` 를 지닌다. 어느 쪽을 조건이 움직이는가에
       따라 강화의 성질이 갈린다 — 기본값을 올리면 약한 몸에게도 같은 크기로 실리고,
       계수를 올리면 몰아 둔 몸일수록 크게 실린다. **DC-COMBAT-ONE-FORMULA 가 이 선택의
       심판이다** — 어느 쪽이든 공식은 그대로여야 한다.

    ③ 관문 사정이 거짓일 때, 그 기술이 관찰에서 어떻게 보이는가
       "있는데 못 쓴다" 인가 "없다" 인가. 전자면 사유가 실려야 하고
       (DC-COMBAT-UNAVAILABLE-HAS-A-REASON), 후자면 목록에서 사라지므로 사유를 실을
       자리가 없다. **전자가 이 Cycle 의 뜻이지만**, 그렇게 정한 사유를 Stage 3 이
       적는다 — UL §33 이 `ability.available` 과 `ability.unavailableReason` 을 나란히
       둔 것이 근거다.

    ④ 강화 사정이 참인 것이 **쓰기 전에** 보이는가
       보이면 플레이어가 그 순간을 노려 쓸 수 있고, 안 보이면 맞은 뒤에야 안다.
       전자가 "세계를 만들어 놓고 쓴다" (MC-ABILITY-CONDITION 의 detail)에 맞지만,
       그러면 관문 사정과 강화 사정이 관찰에서 같은 칸을 쓰는지 다른 칸을 쓰는지를
       Stage 4 가 갈라야 한다 — 하나는 못 쓰는 사유이고 하나는 더 잘 쓰는 사유다.
