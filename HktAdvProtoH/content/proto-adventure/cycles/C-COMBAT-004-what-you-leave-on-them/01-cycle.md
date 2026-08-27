# CYCLE C-COMBAT-004 — What You Leave On Them

[PASS] Cycle Definition           (새 상태 하나 · 표식이 요구도 조건도 된다 · 관문이 대상을 받는다)
[    ] Intent
[    ] World Semantic
[    ] GameView Specification
[    ] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

## MASTER TRACE

    Frontier            FR-WHAT-YOU-LEAVE-ON-THEM — 상대에게 남긴 것이 다음을 바꾼다
                        (`master/frontier/combat.md` 의 SELECTED · Human 위임 2026-08-27)

    Source Goal         MG-OVERCOME-SUPERIOR-OPPONENT

    Source Possibility  MP-BIND-BY-CONTRACT           (전진 — 사슬 B 의 둘째 칸)

    Target Capability   MC-MARK                       (overlay: MISSING)

    Active Constraints  DC-COMBAT-ABILITY-IS-A-RULE
                        DC-COMBAT-UNAVAILABLE-HAS-A-REASON
                        DC-CONDITION-OPENS-WITHOUT-RECORDING
                        DC-COMBAT-ONE-FORMULA
                        함께 걸리는 것 — DC-COMBAT-PLAYER-CAUSALITY ·
                        DC-COMBAT-ONE-LAYER-AT-A-TIME · DC-WORLD-OWNS-THE-SURFACE-LIST

    Constraint Note     이 Cycle 이 실제로 지켜야 하는 형태로 풀면 이렇다.

                        ABILITY-IS-A-RULE — 가장 주의할 하나다. **표식을 남기는 일은
                          피해가 0 이어도 성립해야 한다.** 그 제약의 rationale 이 든
                          실물이 바로 이것이다 ("피해 한 줄 없이도 강한 능력이
                          성립한다" · UL §23). 표식 기술에 피해를 얹어 "조금 약한
                          공격" 으로 만드는 순간 이 Cycle 은 실패다
                        UNAVAILABLE-HAS-A-REASON — 표식 때문에 못 쓰는 일이 생기면 그
                          사유가 하나 실린다. **그리고 걸린 쪽도 안다** — 자기에게
                          무엇이 붙었는지 보이지 않으면 대비할 수가 없다 (UL §30 · §40)
                        CONDITION-OPENS-WITHOUT-RECORDING — 표식은 **건 시각에서 계산되고
                          저절로 닫힌다** (Q61(a) 가 표식을 이름 들어 그렇게 정했다).
                          "표식이 사라졌다" 를 세우는 규칙이 생기면 이 Cycle 의 실패다.
                          `guardBrokenUntil`(C011)과 같은 꼴이다 — 상태가 아니라 시각이다
                        ONE-FORMULA — 표식은 새 피해식을 만들지 않는다. 표식이 판정을
                          바꾸는 길은 **직전 Cycle 이 세운 사정**뿐이다 — 요구로 걸리거나
                          조건으로 계수를 움직이거나
                        PLAYER-CAUSALITY — 표식의 유무에 확률이 없다. 걸었으면 걸린 것이고,
                          그것이 만든 차이가 경위에서 되짚어진다
                        ONE-LAYER-AT-A-TIME — 표식이 없는 세계는 지금까지와 한 톨도
                          다르지 않아야 한다. **표식을 한 번도 걸지 않은 싸움은
                          C-COMBAT-003 이 닫은 그대로다**
                        WORLD-OWNS-THE-SURFACE-LIST — 누구에게 표식이 붙었는지 · 그래서
                          무엇이 되고 안 되는지를 세계가 싣는다. 화면이 표식의 규칙을
                          자기 안에 적지 않는다

    Master Feedback     미리 아는 것 둘을 여기 박아 둔다.

                        ① **이 Cycle 은 직전 Cycle 의 Master Gap ② 를 정면으로 받는다.**
                        C-COMBAT-003 이 세운 관문은 상대를 읽지 못한다 — 쓰기 전이라
                        대상이 정해지지 않았기 때문이다. 그래서 "그 대상에 표식이 있는가"
                        를 요구로 걸 수 없다. 그 Cycle 이 "풀리는 자리는 정해져 있다 —
                        관문이 고른 대상을 받는 날이며, 그것은 표식이 요구가 되는
                        Cycle 이다" 라고 적었고, 그날이 지금이다.

                        그러므로 이 Cycle 은 MC-MARK 뿐 아니라 **MC-ABILITY-CONDITION 의
                        형태도 넓힌다.** 그 노드는 이미 IMPLEMENTED 로 보고되었으므로
                        Overlay 등급이 오르지는 않는다 — 근거가 두꺼워질 뿐이다.
                        Stage 8 이 그것을 적는다.

                        ② **MP-BIND-BY-CONTRACT 는 닫히지 않는다.** 요구 넷 중
                        MC-ABILITY-CONDITION 이 섰고 이 Cycle 이 MC-MARK 를 세워도
                        MC-VOW · MC-BIND 둘이 남는다. 그 둘은 다음 후보의 몫이며
                        후보 자신이 그렇게 적었다 (FR-A-PROMISE-BINDS-BOTH).

                        **이 Cycle 은 아직 Feedback 이 미처리인 위층 위에 선다.**
                        C-COMBAT-003 의 MASTER FEEDBACK 이 반영되기 전이므로
                        `overlay.md` 의 MC-ABILITY-CONDITION 은 아직 PARTIAL 로 적혀
                        있다. 위 TARGET CAPABILITY 의 등급(MC-MARK MISSING)은 영향받지
                        않으며, 반영은 병합 뒤 FEEDBACK 레인이 한다 (`feedback:gate`).

## TYPE

    New Capability — 대상에 남는 것 (MS-AURA-NEN / OPERATION)

    동시에 **직전 Cycle 이 세운 것의 확장**이다. 사정 목록(`ABILITY_CIRCUMSTANCES`)에
    항목이 늘고, 그 목록을 읽는 관문이 **상대를 볼 수 있게** 넓어진다. 새 판정 얼개를
    세우는 것이 아니라 이미 선 얼개에 첫 "대상 쪽 사실" 을 넣는 것이다.

    지금 사정 셋 중 둘은 자기 쪽을 보고(배분 · 생명) 하나만 상대를 본다(맞음).
    **표식은 대상에 남는 첫 사실이다** — 지금까지 존재 사이에 있던 것은 태도(C018)와
    지목(C017)뿐이고 둘 다 **거는 쪽**의 상태였다.

## TARGET CAPABILITY

    Combat — 사정 목록 (`world/semantic/circumstance.ts` · C-COMBAT-003)
    Combat — 기술의 성립 판정과 위력 선택 (같은 Cycle 의 두 규칙)
    World  — 표식 (새로 선다 — 누가 누구에게 언제 남겼는가)

## GOAL

    플레이어가 **피해를 한 톨도 넣지 않는 한 대**로 상대에게 표식을 남긴다. 그 표식은
    양쪽 모두에게 보이고, 붙어 있는 동안 이후의 한 방이 다르게 들어가며, 표식이 걸린
    상대에게만 되는 일이 하나 생긴다. 그리고 시간이 지나면 **아무도 지우지 않았는데**
    저절로 사라진다.

    지금은 그럴 수 없다. 존재 사이에 있는 것은 태도(C018)와 지목(C017)뿐이고 둘 다
    **거는 쪽**의 상태다 — 내가 다른 곳을 보면 사라진다. 상대에게 **남는** 것이 없으므로,
    "저 몸에 무언가 걸어 두었다" 가 세계에서 성립하지 않는다. 그래서 지금의 전투는
    한 대 한 대가 서로 독립이고, **앞의 한 수가 뒤의 한 수를 위해 자리를 만드는 일**이
    일어나지 않는다.

    이 Cycle 이 끝나면 **한 대가 다음 한 대를 위해 쓰인다.** 그리고 그 준비는 숨은 것이
    아니라 걸린 쪽에게도 보이는 것이라, 물러날지 밀어붙일지 고르는 수가 성립한다.

## INCLUDED

    표식                          누가 누구에게 언제 남겼는가. **새 상태는 이것 하나다**
    저절로 닫힌다                 건 시각에서 계산한다 — 지우는 규칙이 세계에 생기지
                                  않는다 (`guardBrokenUntil` 과 같은 꼴 · Q61(a))
    표식을 남기는 기술 하나        **피해가 0 이어도 성립한다.** 이것이
                                  DC-COMBAT-ABILITY-IS-A-RULE 의 실물이며, 피해를 얹으면
                                  이 Cycle 이 실패한 것이다
    관문이 대상을 받는다           사정이 **상대를 물을 수 있게** 된다. 직전 Cycle 의
                                  Master Gap ② 가 이것으로 닫힌다. 관문이 보는 대상이
                                  무엇인지는 아래 물음 ①
    표식이 요구가 된다             표식이 걸린 상대에게만 되는 일이 하나 생긴다.
                                  못 될 때 그 사유가 하나 실린다
    표식이 조건이 된다             표식이 붙은 몸에 들어가는 한 방이 달라진다.
                                  **직전 Cycle 이 세운 계수 자리를 그대로 쓴다** —
                                  새 피해식도 새 판정도 세우지 않는다
    양쪽 모두에게 보인다           건 쪽도 걸린 쪽도 안다. **걸린 쪽이 모르면 대비가
                                  성립하지 않는다** (UL §30 · §40)
    표식이 경위에 실린다           표식이 만든 차이가 한 방의 경위에서 되짚어진다
                                  (C-COMBAT-003 이 연 `conditions` 자리를 그대로 쓴다)
    자율 존재에게도 붙는다         규칙은 조종 주체를 묻지 않는다. 그리고 자율 존재가
                                  건 표식도 사람에게 붙는다 — 한쪽만 되는 장치가 되면
                                  읽고 대비하는 수가 반쪽이 된다

## EXCLUDED

    표식이 스스로 하는 일          지속 피해 · 이동 방해 · 값 깎기. **표식 자체는
                                  아무것도 하지 않는다** — 다음에 올 것의 자리를
                                  만들 뿐이다 (후보 자신이 그렇게 적었다)
    쌓이는 표식                    겹칠수록 커지는 것. 그것은 크기의 합성이며
                                  MC-CONDITION-STACKING 의 자리다 (직전 Cycle 이
                                  같은 이유로 EXCLUDED 했다)
    표식의 종류가 여럿             지금은 하나다. 종류를 가르는 일은 그것을 요구하는
                                  갈래가 생길 때 온다
    표식을 지우는 조작             푸는 기술 · 떼는 기술. **시간이 닫는다** —
                                  지우는 규칙을 세우면 DC-CONDITION-OPENS-WITHOUT-RECORDING
                                  이 막는 바로 그 형태가 된다
    계약 · 묶음                    스스로 거는 제약과 그 대가, 그리고 상대를 묶는 것.
                                  다음 후보(FR-A-PROMISE-BINDS-BOTH)의 몫이며 **이 Cycle
                                  보다 크다** — 후보 자신이 그렇게 적었다
    상대의 규칙을 알아내는 것       표식이 무엇을 여는지가 가려져 있고 겪어야 드러나는 것.
                                  FR-KNOW-WHAT-THEY-CAN-DO 의 몫이다
    봉인                          남이 걸어 둔 것 때문에 못 쓰게 만드는 것.
                                  이 Cycle 의 요구는 **표식이 있어야 된다**이지
                                  **표식 때문에 안 된다**가 아니다
    표식에 따라 겉모습이 달라짐     UL §40 의 시각 표현 중 몸의 생김새를 바꾸는 일.
                                  관찰에는 실리되 몸을 다시 그리지 않는다
    새 자원 · 새 게이지            표식은 게이지가 아니라 사실이다

## RELATED EXISTING CAPABILITY

    재사용 — 이 Cycle 이 얹히는 자리 (형태를 바꾸지 않기를 기대한다)
        ABILITY_CIRCUMSTANCES          C-COMBAT-003 · `world/semantic/circumstance.ts` —
                                       사정 목록. 표식을 보는 항목이 하나 는다.
                                       **항목을 더해도 관문도 관찰도 열리지 않는다**
        RULE-ABILITY-REQUIREMENT-001   C-COMBAT-003 — 요구를 재고 사유를 하나 고르는 자리.
                                       이 Cycle 이 그 자리의 **입력**을 넓힌다
        RULE-ABILITY-CONDITION-001     C-COMBAT-003 — 참인 조건이 계수를 움직이는 자리.
                                       표식이 그 목록의 항목이 된다. **대상마다 따로
                                       도는 성질**이 이 Cycle 에 그대로 필요하다
        DamageBreakdown.conditions     C-COMBAT-003 — 참인 사정이 실리는 경위 자리
        SkillDefinition                C007~C-COMBAT-003 — 기술이 자기 값과 사정을 지니는 표
        guardBrokenUntil / isGuardBroken
                                       C011 — **시각 하나에서 매번 다시 세는 선례.**
                                       세우는 규칙도 지우는 규칙도 없다 (Q61(a) 의 근거)
        World.TargetSelections         C017 · `world/semantic/target-selection.ts` —
                                       관찰자별로 고른 존재 하나. 관문이 대상을 받는다면
                                       그 대상이 어디서 오는지의 후보다 (아래 물음 ①)
        World.StrikeEvents             C007 — 표식을 남긴 일이 관찰되는 자리의 선례
        HOSTILITY_REASONS · relation.ts C018 — 존재 사이의 값을 지금의 사실에서 유도하고
                                       저장하지 않는 얼개. **다만 그것은 거는 쪽의
                                       상태다** — 걸린 쪽에 붙는 것은 이 Cycle 이 세운다
        acquaintance.ts                C014 · C016 — 관찰자별로 무엇이 보이는지를 가르는
                                       얼개. **표식은 이 관문을 지나지 않기를 겨눈다**
                                       (양쪽 모두에게 보여야 한다) — 판단은 Stage 3

    영향 가능 (AFFECTED — Stage 3 이 확정한다)
        evaluateSkillPreconditions     `world/rules/skill.ts` — 관문이 대상을 받으면
                                       이 함수의 입력이 하나 는다. **네 자리가 이것을
                                       부른다** (요청 셋 · 투영 하나)
        Observer Projection            `world/projection/observer-view.ts` — 존재마다
                                       표식이 실리는 자리와, 기술마다 요구가 실리는 자리
        skillProfile · requires        같은 파일 (C-COMBAT-003) — 요구가 대상을 보게 되면
                                       그 관찰의 뜻이 넓어진다
        전투 HUD · 존재 표시            `view/combat-presentation.ts` ·
                                       `view/hud-presentation.ts` — **VIEW 레인과 같은
                                       파일이다.** 자기 영역 끝에 추가만 한다 (LANES)
        engagementReachViolations      기술이 하나 늘면 그 기술의 닿는 거리도 검사된다
        키 자리                        **남은 글자가 `P` 하나다** (C-COMBAT-003 Master
                                       Gap ③ · `works/BACKLOG.md` 의
                                       `skill-slot-crowds-the-keyboard`). 이 Cycle 이
                                       그것을 쓰면 다음 Cycle 에는 자리가 없다

    건드리지 않는다
        engine/                        기반이다 (`npm run boundary:check`)
        RULE-DAMAGE-CALCULATE-001      피해를 세는 식. 표식은 그 식이 받는 값에만 닿는다
        allocation.ts                  배분의 몫과 항목 — 읽지도 않는다
        target-selection 의 규칙        고르기의 의미는 C017 의 것이다. 이 Cycle 은
                                       그것을 **읽기만** 할 수 있다

## 이 Cycle 이 답해야 하는 것 — Stage 2·3 으로 넘긴다

    아래 넷은 여기서 정하지 않는다. 세계 의미이고 근거를 Stage 3 이 세운다. 다만
    **Stage 3 이 이것을 지나쳤다면 그 단계가 덜 닫힌 것**이므로 여기 남긴다.

    ① 관문이 보는 대상은 어디서 오는가
       쓰기 전에는 무엇이 맞을지 세계도 모른다 (C002 이래의 규율 — "대상을 담지 않는다").
       그러나 **고른 대상**은 있다 (C017 · `World.TargetSelections`). 관문이 그것을
       읽으면 "지금 노리는 자에게 표식이 있는가" 를 물을 수 있다.
       **그러면 요구가 보는 몸과 실제로 맞는 몸이 갈릴 수 있다.** 그 갈림을 세계가
       어떻게 다루는지를 Stage 3 이 적는다 — 직전 Cycle 이 조건 관찰에서 같은 갈림을
       "예고이지 약속이 아니다" 로 다룬 선례가 있다 (C-COMBAT-003 04).

    ② 표식은 닿은 몸에 남는가, 고른 몸에 남는가
       ① 과 짝이다. 닿은 몸에 남으면 휘두름의 규율(접촉이 정한다)과 맞고, 고른 몸에
       남으면 요구가 보는 몸과 언제나 같아진다. **어느 쪽이든 사유를 적는다** —
       C002·C017 이 세운 두 규율 중 어느 것을 따르는지가 드러나야 한다.

    ③ 요구를 어느 기술이 지는가
       새 기술을 하나 더 세우면 키 자리가 **바닥난다** (위 AFFECTED). 남기는 기술
       자신이 요구를 지는 길이 있다 — 이미 표식이 걸린 상대에게는 다시 걸지 않는다.
       기존 기술(`hatsu-burst`)에 얹는 길도 있으나 **그것은 직전 Cycle 의 회귀를 깬다.**
       심판은 셋이다: 회귀 · 키 자리 · "표식이 걸린 상대에게만 되는 일" 이 실제로
       플레이에서 성립하는가.

    ④ 표식이 여럿 걸릴 수 있는가
       같은 대상에 두 몸이 각자 표식을 걸 수 있는가, 한 몸이 두 대상에게 걸 수 있는가.
       **쌓임은 EXCLUDED 지만 여럿은 다른 문제다** — 여럿을 막으면 표식이 사실상
       "지목의 다른 이름" 이 되고, 열면 표식이 (거는 자, 걸린 자) 쌍의 사실이 된다.
       후보의 "표식은 그 대상에 남은 것이고 내가 다른 곳을 봐도 남아 있다" 가 이 선택의
       심판이다.
