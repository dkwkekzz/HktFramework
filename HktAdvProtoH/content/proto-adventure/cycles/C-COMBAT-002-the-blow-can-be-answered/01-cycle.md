# CYCLE C-COMBAT-002 — 닿는 순간에 대답할 수 있다

[PASS] Cycle Definition
[PASS] Intent
[PASS] World Semantic
[    ] GameView Specification
[    ] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

## MASTER TRACE

    Frontier            FR-THE-BLOW-CAN-BE-ANSWERED (master/frontier/combat.md)
    Source Goal         MG-SURVIVE-ENEMY-OFFENSIVE
    Source Possibility  MP-READ-AND-COUNTER · MP-EVADE-BY-MOVING-THE-BODY ·
                        MP-STORE-AND-RELEASE
                        셋 다 **전진할 뿐 닫히지 않는다** — 셋 모두 시점 판정이나
                        기회를 더 요구하며 그것은 다음 후보들의 몫이다
    Target Capability   MC-ACTIVE-RESPONSE        (overlay: MISSING)
    Active Constraints  DC-COMBAT-ONE-RESPONSE-INPUT ·
                        DC-COMBAT-RESPONSE-IS-OPTIONAL-MASTERY ·
                        DC-COMBAT-SHARED-BUDGET · DC-COMBAT-ONE-LAYER-AT-A-TIME ·
                        DC-COMBAT-PLAYER-CAUSALITY · DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Note     여섯 다 SATISFIED 로 착수한다. 이 Cycle 이 무너뜨리기 가장 쉬운
                        것은 둘째다 — **대답하지 않는 것이 정상 경로로 남아야 한다.**
                        대답이 사실상 필수가 되는 순간(안 하면 못 버티는 수치) 이 층은
                        선택적 숙련이 아니라 새 세금이 된다. 판정에서 건드릴 곳은
                        정밀 쪽의 상한이 아니라 **무대응 쪽의 하한**이며, 이 Cycle 은
                        무대응 쪽 수치를 한 톨도 바꾸지 않는 것으로 그것을 지킨다.

                        첫째도 나란히 본다 — 자리가 하나이므로 **키도 하나**여야 하고,
                        대답의 종류를 여럿 만들지 않는다. 배분(C-COMBAT-001)이 두 걸음을
                        쓴 것과 다르다: 대답은 닿기 전에 눌러야 하므로 한 걸음이어야 한다.

## MASTER TRACE — 앞 Cycle 과의 순서

    C-COMBAT-001 이 STATUS IN PROGRESS 로 남아 있다 (Human Play 대기).
    **트랙은 직렬이나 이 둘은 세계에서 겹치지 않는다** — 배분은 `effectiveStat` 이
    읽는 값의 항이고, 대답은 타격이 닿는 순간의 판정이다.

    다만 Stage 8 은 C-COMBAT-001 이 COMPLETE 로 닫혀 그 Feedback 이 overlay 를 고친
    뒤 최신 main 위에서 도는 것이 옳다 — 그 전에는 이 Cycle 의 Overlay 판정이 무엇
    위에 얹히는지가 정해지지 않는다.

## TYPE

    New Capability

    새 개념 하나를 세운다 — **대답이 들어가는 자리**. 대응의 종류(막기 · 피하기 ·
    받아넘기기)를 늘리는 것이 아니라, 그 종류들이 들어갈 자리가 세계에 있다는 것 자체다.
    기존 막기(C011)는 그 자리에 끼우는 것이 아니라 **그대로 남는다** — 아래 EXCLUDED.

## TARGET CAPABILITY

    Combat — Active Response

## GOAL

    Player 가 적의 타격이 자신에게 닿기 전의 짧은 구간에 대답 하나를 실행해
    그 타격의 결과를 바꿀 수 있고, 대답하지 않으면 지금까지와 똑같이 맞는다.

## INCLUDED

    대답 자리        몸마다 대답 자리가 하나 있고, 지금 무엇이 들어 있는지가 상태다
    대답 구간        나에게 다가오는 타격마다 대답할 수 있는 구간이 열리고 닫힌다
    대답의 효과      그 구간 안에 실행한 대답이 그 타격의 결과를 바꾼다
    무대답의 정상성   대답하지 않으면 기존 피해 계산이 그대로 지난다 — 예외가 아니다
    관찰            지금 대답할 수 있는가 · 자리에 무엇이 있는가 · 안 되면 왜 안 되는가
    대가            기존 기력을 쓴다 (DC-COMBAT-SHARED-BUDGET — 새 게이지를 만들지 않는다)

## EXCLUDED

    정밀 구간        언제 눌렀는가로 결과가 갈리는 것. 구간 안이면 전부 같은 결과다
                    → FR-WHEN-YOU-ANSWER-DECIDES (다음 후보)
    기회            잘 된 대답이 다음 수를 여는 것 → FR-A-GOOD-ANSWER-OPENS-A-DOOR
    저장            받아낸 것이 내 힘이 되는 것 → FR-WHAT-YOU-BLOCK-BECOMES-YOURS
    대답의 종류      **자리 하나와 그 자리에 들어갈 한 종류로 닫는다.** 캐릭터마다 다른
                    대답을 끼우는 일은 그 자리가 선 뒤의 이야기다
    새 입력          키가 늘지 않는다 (DC-COMBAT-ONE-RESPONSE-INPUT)
    무적 구간        대답이 그 구간 동안 모든 것을 무효로 만들지 않는다
    확률 회피        확률이 개입하지 않는다 (DC-COMBAT-PLAYER-CAUSALITY)
    기존 막기의 대체  C011 의 `guarding` 은 그대로 남는다 — 켜 두는 자세이고, 대답은
                    닿는 순간의 한 번이다. 둘을 합치지 않는다
    무대응 수치 조정  무대응으로 맞는 피해를 이 Cycle 에서 올리지도 내리지도 않는다
                    (DC-COMBAT-RESPONSE-IS-OPTIONAL-MASTERY 의 하한)
    자동 대답        세계에 자동 전투가 없다 (UL §32 — 그것이 생기는 날의 일이다)

## RELATED EXISTING CAPABILITY

    재사용

        SkillPhase (startup · active · recovery)     world/semantic/combat.ts:159
            **언제 닿는가가 이미 세계에 있다.** `swingBegin` 앞이 startup 이고 그것이
            곧 "아직 닿지 않았다" 다. 경계를 전역 상수가 아니라 기술이 지니므로
            (C019 · C025) 대답 구간도 기술마다 다를 수 있다
        skillDefinition · swingBegin · swingEnd      world/semantic/combat.ts:62 · 101
        ActionCollider 와 같은 경계                    world/semantic/collision.ts
            칼끝이 활성인 구간이 곧 active — 대답 구간은 그 앞이다
        guarding · guardBrokenUntil                  world/semantic/actor.ts:98–99 (C011)
            막기가 행동과 나란한 몸의 상태로 이미 있다. 정면 판정이 방향을 가른다
        기력 (`cp`)                                   world/semantic/actor.ts:46
            대가를 낼 주머니 — 새 게이지를 만들지 않는다. 스킬 수지와 달리기만이
            이 값을 바꾼다는 규율(C007)에 대답이 셋째로 든다
        못 쓰는 사유를 하나 골라 내보내는 자리           view/skill-presentation.ts
            `unavailableReason` — 세계가 고르고 화면은 옮긴다
        상대의 선딜이 이미 관찰된다                      view/phase-presentation.ts (C019)
            `startupMark` — "준비!" 가 이름 앞에 뜬다. 대답할 순간이 눈에 이미 있다
        고른 대상                                      world/rules/target.ts (C017)
            누구의 타격에 대답하는가를 물을 때 볼 자리 — 필요 여부는 Stage 3 이 정한다

    영향 가능

        RULE-STRIKE-DAMAGE-001                       world/rules/strike-damage.ts
            대답이 결과를 바꾸는 자리가 여기다. 무대답 경로는 한 톨도 바뀌지 않아야 한다
        RULE-DAMAGE-CALCULATE-001                    world/rules/damage-calculate.ts
            **한 공식은 그대로다** (DC-COMBAT-ONE-FORMULA). 대답은 그 식을 바꾸지 않고
            그 결과나 입력에 건다 — 어느 쪽인지는 Stage 3 이 정한다
        RULE-GUARD-*                                 world/rules/guard.ts (C011)
            같은 순간을 다루므로 둘이 겹칠 때의 뜻을 Stage 3 이 정해야 한다
        RULE-SWING-STRIKE-001                        world/simulation/swing-strike.ts
            **판정이 실제로 일어나는 자리다.** C006 이래 판정은 행동 완료 순간의 일괄이
            아니라 휘두름 구간의 **접촉 시점마다** 한다 — 그래서 "닿기 전" 이 세계에
            실재하는 시간이다. 대답 구간의 끝이 여기와 어긋나면 안 된다
        RULE-SKILL-BEGIN-001 · RULE-HIT-001          world/rules/skill.ts · attack.ts
            치는 쪽에서 보는 구간이 받는 쪽의 구간과 같은 값이어야 한다.
            (C002 의 RULE-ATTACK-001 은 C007 에서 RULE-SKILL-BEGIN-001 로 일반화됐다)
        경위(breakdown)                               대답한 타격과 대답하지 않은 타격이
                                                     경위에서 갈려야 한다 (C010 이래의 형식)
        C-COMBAT-001 의 배분                           effectiveStat 에 항을 더하지 않는다 —
                                                     이 Cycle 은 그 함수를 건드리지 않는다

## NOTE — 이 Cycle 이 정하지 않은 것

    "대답 한 종류" 가 무엇인가는 Stage 2 가 정한다. 후보는 기존 막기의 순간판
    (닿는 순간에 눌러 그 한 방을 줄이는 것)이 가장 작지만, 그것이 C011 과 어떻게
    갈리는지가 Intent 의 몫이다. 여기서 미리 고르면 구현 방법을 Cycle Definition 에
    박는 것이 된다 (MUST NOT).
