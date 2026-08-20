# C018 — World Implementation

> 세계에 더해진 코드는 파일 둘(`semantic/relation.ts` · `rules/relation.ts`)과 그것을 읽는
> 세 자리(휘두름 · 자율 판단 · 투영)뿐이다. 계산은 한 줄도 건드리지 않았다.
> 가장 큰 일은 새 코드가 아니라 **기존 시나리오의 정정**이었다 — 지금까지 말하지 않고
> 전제해 온 것("칠 수 있는 사이다")을 각 시나리오가 드러내 적게 했다.

## IMPLEMENTED

    world/semantic/relation.ts                      ADDED
        Stance                       hostile | neutral | friendly
        GuardedGround                지키는 자리 (중심 · 반경) · isInsideGuardedGround
        HostilityReason              적대를 낳는 사정 하나의 모양 — holds(a, b)
        HOSTILITY_REASONS            그 사정들의 **목록**. 지금 한 항목
                                     (`guarded-ground-intruded`)
        UnharmedContact              닿았으나 성립하지 않은 접촉 · UnharmedReason

    world/rules/relation.ts                         ADDED
        ruleStance(a, b)             RULE-STANCE-001 — 목록을 읽어 태도를 낸다.
                                     저장하지 않는다. Control 도 CharacterKind 도 읽지 않는다
        ruleHarmGate(attacker, target)
                                     RULE-HARM-GATE-001 — 양방향. 어느 한쪽이라도 적대면 허락

    world/semantic/actor.ts                         CHANGED
        Actor.GuardedGround          어떤 몸이든 지닐 수 있다. 초기값 없음

    world/semantic/spawn.ts                         CHANGED
        ActorSpawn.guardedGround     밝히지 않으면 없다 — guarding = false 와 같은 초기값

    world/semantic/world-state.ts                   CHANGED
        World.UnharmedContacts       StrikeEvents 와 나란한 자리

    world/rules/observer-body.ts                    CHANGED
        BodyDefaults.guardedGround   **관찰자의 몸에도 이 자리가 있다.** 사람이라서 태도의
                                     규칙 밖인 것이 아니라 지금 그럴 사정을 주지 않았을 뿐이다

    world/index.ts                                  CHANGED
        WorldSetup.actorGuardedGround   세계를 띄우는 쪽이 관찰자 몸의 자리를 정한다
        NpcSetup.guardedGround          자율 존재의 자리
        DEFAULT_NPCS                    npc-1 이 (-10,-8) 반경 7 의 자리를 지니고 그 안을
                                        순회한다 · npc-2 는 지킬 것이 없다

## REUSED

    RULE-DAMAGE-CALCULATE-001 · RULE-CRITICAL-STRIKE-001 · RULE-GUARD-BLOCK-001 ·
    RULE-STRIKE-DAMAGE-001 · RULE-HIT-001            한 글자도 바뀌지 않았다.
                                                     관문은 이들 **앞**에 선다
    RULE-BODY-PUSH-001                               관문 밖이다 — 중립인 둘도 서로 비켜선다
    STRIKE_EVENT_TTL                                 무산도 같은 수명을 산다
    engine/physics/sweep                             접촉 판정은 그대로 엔진 솔버의 것이다

## AFFECTED UPDATED

    world/simulation/swing-strike.ts    RULE-SWING-STRIKE-001
        닿은 몸은 성립 여부와 무관하게 StruckActorIds 에 담긴다 (뜻이 넓어졌다 —
        담지 않으면 한 휘두름 동안 같은 무산이 매 Tick 쌓인다).
        관문이 거절하면 UnharmedContacts 에 한 줄을 남기고 `continue` 한다 —
        피격도 · 피해도 · 밀침도 · 기력 수지도 그 뒤에 있다.

    world/simulation/npc-decide.ts      RULE-NPC-DECIDE-001
        perceivedTarget 의 후보에 거르기 한 겹 — `ruleStance(actor, other) === 'hostile'`.
        고르는 방식(가장 가까운 것 · 같으면 Id 순)은 그대로다.
        "나가면 더 쫓지 않는다" 를 위한 코드는 **한 줄도 없다** — 침입자가 자리를 벗어나면
        다음 Tick 에 후보에서 빠지고 순회로 돌아간다.

    world/simulation/strike-event-expire.ts
        두 목록을 같은 TTL 로 함께 만료시킨다.

    world/projection/observer-view.ts
        존재마다 stanceTowardObserver · stanceFromObserver 를 싣는다 (가려짐 밖).
        snapshot 에 contacts 를 싣는다.

    protocol/gameview.ts
        AttributesView 에 태도 둘 · UnharmedContactView · GameViewSnapshot.contacts.

## PROJECTION

    04-gameview.spec.yaml 대조

        entities.character.attributes.stanceTowardObserver   ✔ 모든 존재에 언제나
        entities.character.attributes.stanceFromObserver     ✔ 모든 존재에 언제나
        unharmedContacts (attackerId · targetId · skill · at · since · reason)
                                                             ✔ contacts 로 실린다
        strikeEvents                                         ✔ 무변경
        interactions                                         ✔ 무변경 (가용성이 바뀌지 않는다)
        hud · commandCatalog                                 ✔ 무변경
        투영하지 않기로 한 넷                                  ✔ GuardedGround ·
                                                             HOSTILITY_REASONS · 왜 hostile 인가 ·
                                                             다른 관찰자를 향한 태도 — 모두 없다

## TESTS

    world/tests/relation.spec.ts                    20 tests · ADDED
        태도가 자리에서 나온다 · 지킬 것 없는 존재는 누구도 사냥감으로 대하지 않는다 ·
        방향값이다 · **주체의 종류가 판정을 바꾸지 않는다**(사람의 몸이 지키면 사람도
        적대의 한쪽) · 몸은 지킬 것 없이 태어난다(초기값) · 자기 몸은 중립 ·
        태도는 가려지지 않는다 · 중립은 닿아도 상하지 않는다 · 무산이 사유와 함께 온다 ·
        무산은 한 휘두름에 한 번 · 빗나감과 무산은 다르다 · 적대는 그대로 맞는다 ·
        밖에서는 칠 수 없다 · 걸어 나가면 풀리고 다시 들어가면 다시 선다 ·
        때린 뒤 나가도 원한이 남지 않는다 · 사냥감만 쫓는다 · 지킬 것 없는 존재는 안 쫓는다 ·
        나가면 더 쫓지 않는다 · 무산도 같은 시간을 산다 ·
        **무산은 흔들림을 쓰지 않는다**(같은 뿌리의 두 세계에서 Critical 판정이 같다)

    전체 46 files · 781 tests 통과 (`npm test` — boundary:check 포함)

    REGRESSION — 고친 기존 시나리오
        전투를 보는 시나리오의 상대에게 `guardedGround` 를 준다 (`WHOLE_STAGE`).
        9개 spec 의 `dummyAt` 과 인라인 npc 배치 · guard.spec 의 사람 둘 대결
        (`actorGuardedGround`) · npc.spec 의 추격 배치 · observe.spec 의 중단 배치.
        **세계를 약하게 만든 것이 아니다** — 지금까지 말하지 않고 전제해 온 것을
        시나리오가 드러내 적게 한 것이다. 값·판정·경위는 하나도 바뀌지 않았고
        (C007~C017 의 실측값 그대로), 바뀐 것은 "그 타격이 왜 성립하는가" 가
        시나리오에 적히게 된 것뿐이다.

        combat.spec 의 attributes 전량 대조 둘에 태도 두 줄이 더해졌다 —
        계약이 늘었으므로 대조도 늘어야 한다.

## NOTES

    ① 태도를 저장하지 않은 것이 가장 큰 이득이었다
       "물러나면 풀린다" · "나가면 더 쫓지 않는다" 두 문장을 위해 쓴 코드가 없다.
       파생 판정이므로 자리가 달라지면 결과가 달라질 뿐이다. 저장했다면 푸는 규칙과
       그것을 부르는 자리를 세 곳에 심어야 했고, 그 순간 원한이 뒷문으로 들어왔을 것이다.

    ② 예외를 없앤 결과가 코드에 보인다
       `ruleStance` 는 `Control` 도 `CharacterKind` 도 읽지 않는다. 관찰자의 몸도
       자율 존재와 **같은 spawnActor 를 지나** 같은 자리를 얻는다. 사람끼리 싸우는
       시나리오(guard.spec)가 특별한 우회 없이 `actorGuardedGround` 하나로 성립한다는
       것이 그 증거다.

    ③ 사정을 목록으로 둔 값어치는 다음 Cycle 이 확인한다
       지금은 항목이 하나뿐이라 배열이 과해 보인다. 그러나 `ruleHarmGate` 도
       투영도 목록의 길이를 모른다 — 항목이 늘 때 고칠 자리는
       `HOSTILITY_REASONS` 하나다.

    ④ 무산을 별도 목록으로 둔 판단은 구현에서도 옳았다
       `StrikeEvent.breakdown` 은 필수 필드다. 무산을 그 안에 담았다면 계약의
       모든 소비자가 "경위가 없을 수 있다" 를 알아야 했다.

    ⑤ 기반(engine) 을 한 줄도 건드리지 않았다
       태도가 실리는 자리는 팩이 소유한 `AttributesView` 이고, 새 목록도 팩의
       `GameViewSnapshot` 확장이다. `npm run boundary:check` 통과.
