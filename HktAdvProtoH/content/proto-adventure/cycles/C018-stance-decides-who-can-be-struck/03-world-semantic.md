# C018 — World Semantic

> 세계에 더해지는 것은 **개체가 지니는 자리 하나**와 그것에서 읽히는 **파생 판정 하나**뿐이다.
> 태도는 저장되지 않는다 — 쓰러짐(Downed)과 배율(Modifiers)이 그러하듯 지금의 사실에서
> 유도된다. 그래서 "물러나면 풀린다" 를 위해 아무 규칙도 만들 필요가 없다: 자리 밖으로
> 나가는 순간 유도의 결과가 달라지고, 그것이 곧 풀림이다.
> 새 계산도, 새 난수도, 새 요청도, 새 행동도 없다.

## SEMANTIC DELTA

    REUSED
        Actor.Position                       누가 어디 있는가 (C001) — 태도를 정하는 유일한 입력
        Actor.Control = autonomous           자율 존재 (C002)
        Actor.PerceptionRange                인지 거리 (C002) — 거르기 앞에 그대로 선다
        Actor.CurrentAction.StruckActorIds   한 휘두름이 이미 닿은 몸들 (C006) — 뜻이 넓어진다
        Actor.Downed (파생)                   쓰러진 몸 (C007) — 관문과 나란히 서고 대체하지 않는다
        World.StrikeEvents · STRIKE_EVENT_TTL 타격 결과와 그 수명 (C007) — 모양 그대로
        RULE-DAMAGE-CALCULATE-001 외 계산 일체  피해·방어·관통·흔들림·막기 — 한 글자도 닿지 않는다
        RULE-BODY-PUSH-001                   몸끼리 밀어냄 (C006) — 관문 밖이다
        Observer Projection (C004·C014·C016)  관찰자별 투영과 가려짐 관문 — 태도는 그 밖에 실린다

    ADDED
        Actor.GuardedGround                  그 존재가 지키는 자리 (중심 · 반경) — 없을 수 있다
        HOSTILITY_REASONS                    적대를 낳는 사정의 **목록** — 지금 한 항목
        RULE-STANCE-001                      A 가 B 를 어떻게 대하는가 (파생 판정 · 저장하지 않는다)
        RULE-HARM-GATE-001                   이 둘 사이에 해가 성립하는가
        World.UnharmedContacts               닿았으나 성립하지 않은 접촉 (StrikeEvents 와 같은 수명)

    CHANGED
        RULE-SWING-STRIKE-001
            NEW PRECONDITION   대상마다 RULE-HARM-GATE-001 이 허락한다
            NEW TRANSITION     허락되지 않으면 World.UnharmedContacts += { … , 사유 }
            CHANGED MEANING    StruckActorIds 는 "맞은 몸들" 이 아니라 "이 휘두름이 이미
                               닿은 몸들" 이다. 성립하지 않은 접촉도 여기 담긴다 —
                               담지 않으면 한 휘두름이 지나가는 동안 같은 무산이 매 Tick 쌓인다
        RULE-NPC-DECIDE-001
            NEW PRECONDITION   인지 대상 후보는 **RULE-STANCE-001 이 hostile 을 내는** 존재로 한정된다
                               (고르는 방식 — 가장 가까운 것, 같으면 Id 순 — 은 그대로)
        RULE-STRIKE-EVENT-EXPIRE-001
            CHANGED INPUT      World.StrikeEvents 와 World.UnharmedContacts 를 함께 만료시킨다
                               (같은 TTL · 같은 자리 — 수명 규칙을 둘로 나누지 않는다)
        World.DefaultNpcs (초기 배치)
            CHANGED VALUE      자율 존재 둘 중 하나가 지키는 자리를 지니고 그 자리 안을
                               순회한다. 다른 하나는 지키는 자리가 없다 (아래 BALANCE)

    AFFECTED
        RULE-STRIKE-DAMAGE-001      무변경 — 성립한 타격에만 이어진다. 산정은 그대로다
        RULE-HIT-001                무변경 — 타격이 된 뒤의 일은 그대로다. 좁아진 것은 그 앞이다
        RULE-SKILL-BUDGET-001       무변경 — 맞혀야 기력이 돈다. 성립하지 않은 휘두름은
                                    벌지 못하므로 중립을 향해 휘두르면 기력만 치른다 (귀결)
        RULE-CRITICAL-STRIKE-001    무변경 — 성립하지 않은 접촉은 흔들림을 소비하지 않는다.
                                    World.ChanceCursor 가 나아가지 않으므로 뒤의 판정 순서가
                                    흐트러지지 않는다 (결정론 유지 · Regression 기준)
        RULE-GUARD-BLOCK-001        무변경 — 성립하지 않은 타격은 막기를 부르지 않는다
                                    (막지 않았으므로 기력도 치르지 않는다)
        RULE-OBSERVE-*              무변경 — 태도는 가려짐 관문 밖이다
        RULE-MINE-001               무변경 — 광맥은 존재가 아니므로 태도가 없다
        Observer Projection         존재마다 나를 향한 태도가 더해지고, 무산 접촉 목록이
                                    타격 결과 옆에 나란히 실린다
        RULE-OBSERVER-JOIN-001      무변경 — 몸은 지키는 자리 없이 태어난다. 막기를 안 든 채로
                                    태어나는 것(guarding = false)과 같은 **초기값**이지
                                    사람이라서 두는 예외가 아니다

## WORLD STATE

    Actor.GuardedGround                              World Authority
        그 존재가 지키는 자리. 중심(WorldPosition)과 반경(수)을 지니며, **없을 수 있다.**
        없는 존재는 누구도 사냥감으로 대하지 않는다.

        이것은 세계가 나눈 구역이 아니라 **그 존재가 지닌 것**이다 (INTENT-STANCE-FROM-
        GUARDED-GROUND-001). 세계에 지역이라는 개념을 만들지 않는다 — 자리는 그 존재의
        상태일 뿐이며, 무대는 여전히 성질 없는 하나다.

        자리는 **몸을 따라다니지 않는다.** 중심은 고정된 자리이고, 그 존재가 자리를
        벗어나 있어도 자리는 그대로다. 따라다니면 "지킨다" 가 "쫓아다닌다" 가 되어
        사냥터의 뜻이 사라진다.

        개체가 지니는 값이다 — 종류가 정하지 않는다. 같은 종류라도 지킬 것이 있는 개체와
        없는 개체가 있다. 따라서 CharacterKind 카탈로그(kind 정적 데이터 3원소)는
        건드리지 않는다. 세계를 띄우는 쪽의 초기 배치가 정한다.

        **어떤 몸이든 지닐 수 있다.** 자율 존재만의 성질이 아니다 — 보는 이의 몸도
        같은 자리를 지니며, 지금은 값이 없을 뿐이다(RULE-OBSERVER-JOIN-001 무변경).
        Control 이 player 인지 autonomous 인지는 이 값에도 태도 판정에도 들어가지 않는다.

    HOSTILITY_REASONS                                World Authority (목록)
        적대를 낳는 **사정들**. 각 항목은 "이 둘 사이에 적대가 성립하는가" 를 답한다.
        RULE-STANCE-001 은 이 목록을 읽을 뿐이며 사정을 자기 안에 적지 않는다.

        지금 목록에 있는 항목은 하나다.

            지키는 자리에 들었다   A.GuardedGround 가 있고 B 가 그 안에 있다

        이 자리가 이 Cycle 의 **기반**이다 (2026-08-20 Human 지시). NPC · 몬스터 · 진영 ·
        결투 등 무엇이 적대의 이유가 되는지는 이후 Cycle 이 이 목록에 항목을 더하며
        정하고, 그때 RULE-HARM-GATE-001 도 Observable 도 바뀌지 않는다.
        목록의 단일 출처는 세계다 (DC-WORLD-OWNS-THE-SURFACE-LIST).

        **항목은 주체의 종류를 묻지 않는다.** 사람의 몸인지 자율 존재의 몸인지는
        어떤 항목의 입력도 아니다 — 해를 입을 수 있는지는 그 자리와 세계의 규칙이 정한다.

    Stance (파생 — 저장하지 않는다)
        A 가 B 를 어떻게 대하는가. hostile | neutral | friendly 셋 중 하나다.
        **어디에도 저장되지 않는다.** RULE-STANCE-001 이 그때의 사실에서 유도한다 —
        Downed 와 Modifiers 가 그러한 것과 같은 자리다 (semantic/combat.ts 의 선례).

        저장하지 않는 것이 이 Cycle 의 규칙이다. 저장하면 태도가 기록이 되고,
        기록이 되면 "물러나면 풀린다" 를 위해 지우는 규칙이 따로 필요해지며,
        그 순간 원한이라는 개념이 뒷문으로 들어온다 (INTENT-RELATION-STANCE-001).

    World.UnharmedContacts                           World Authority
        닿았으나 해가 성립하지 않은 접촉들. 각 항목은 누가 · 누구에게 · 어떤 스킬로 ·
        어디서 · 언제 · **왜 성립하지 않았는가**를 지닌다.

        World.StrikeEvents 와 나란한 자리이며 같은 수명을 가진다 (STRIKE_EVENT_TTL).
        타격 결과 안에 담지 않는 이유: 타격 결과는 **경위(피해 산정)를 반드시 지닌다.**
        성립하지 않은 접촉에는 산정이 없다 — 담으려면 경위를 없을 수 있는 것으로
        바꿔야 하고, 그러면 이미 있는 모든 타격 결과의 모양이 헐거워진다.
        성립하지 않은 접촉은 타격이 아니다 (INTENT-HIT-REACTION-001 CHANGED).

        지금 사유는 하나다 — `not-hostile`. 목록의 단일 출처는 세계다
        (DC-WORLD-OWNS-THE-SURFACE-LIST).

## WORLD RULE

    RULE-STANCE-001
        Implements     INTENT-RELATION-STANCE-001 · INTENT-STANCE-FROM-GUARDED-GROUND-001 ·
                       INTENT-WITHDRAWAL-ENDS-IT-001
        Input          Actor A (보는 쪽), Actor B (보이는 쪽)
        Preconditions  없음 — 어느 두 존재 사이에도 언제나 답이 있다
        Transition     없음 — 세계 상태를 바꾸지 않는다 (파생 판정)
        Result         hostile    HOSTILITY_REASONS 중 **하나라도** (A, B) 에 적대를 낸다.
                                  지금 목록이 하나이므로 지금의 조건은 하나다 —
                                  A.GuardedGround 가 있고 B.Position 이 그 안에 있다
                       neutral    어느 사정도 닿지 않는 모든 경우
                       friendly   지금 이 세계에서는 나오지 않는다 — 낳는 사정이 없다.
                                  갈래는 서 있고 값이 비어 있다 (없는 사정을 지어내지 않는다)

        **주체의 종류를 묻지 않는다.** A 와 B 가 사람의 몸인지 자율 존재의 몸인지는
        이 판정의 입력이 아니다. 목록에 항목이 늘어도 이 Rule 의 모양은 그대로다 —
        늘어나는 것은 목록이지 판정이 아니다.

        자리 안인가의 판정은 중심으로부터의 거리가 반경 이하인가로 한다 —
        몸의 반경을 더하지 않는다. 몸이 걸치는 것이 아니라 **자리에 들어와 있는가**를
        묻기 때문이다 (경계에 선 몸은 중심이 들어와야 침입이다).

        A 와 B 가 같으면 neutral 이다 — 자기 자리 안의 자기 자신은 침입자가 아니다.

    RULE-HARM-GATE-001
        Implements     INTENT-HARM-GATE-001
        Input          공격자 Actor, 대상 Actor
        Preconditions  RULE-STANCE-001(공격자 → 대상) = hostile
                       또는 RULE-STANCE-001(대상 → 공격자) = hostile
        Transition     없음 — 판정만 한다
        Result         Allowed | Refused(not-hostile)

        **둘 중 어느 쪽에서든 적대이면 둘 사이는 적대다.** 지금 세계에서 적대를 낳는 것은
        지키는 자리 하나이므로, 실제로 성립하는 경우는 "침입자와 지키는 자" 한 짝이다.
        그러나 판정을 양방향으로 두어야 침입자 쪽에서도 되받아칠 수 있다 —
        한 방향만 보면 사냥감은 사냥꾼을 칠 수 없다.

        **양쪽에 똑같이 선다.** 자율 존재의 휘두름도 이 관문을 지난다
        (MA-HOSTILE-COMBATANT — 같은 전투 규칙 아래 있다).

    RULE-SWING-STRIKE-001 (CHANGED)
        Implements     INTENT-SWING-IMPACT-001 (CHANGED) · INTENT-HARM-GATE-001 ·
                       INTENT-UNHARMED-IS-OBSERVABLE-001
        Input          ActionCollider 가 Active 인 Actor 들 (Tick 마다)
        Preconditions  (기존) 대상 ≠ 자신 · 대상이 쓰러지지 않았다 ·
                       칼끝과의 거리가 닿는다 · 이 휘두름에 아직 닿지 않은 몸이다
        Transition     대상마다 StruckActorIds += 대상 (닿았다는 사실은 성립 여부와 무관하다)

                       RULE-HARM-GATE-001 = Allowed
                           (기존 그대로) 밀쳐냄 · RULE-HIT-001 · RULE-STRIKE-DAMAGE-001 ·
                           이 휘두름의 첫 성립이면 RULE-SKILL-BUDGET-001

                       RULE-HARM-GATE-001 = Refused
                           World.UnharmedContacts += { 공격자, 대상, 스킬, 자리, 시각,
                                                       사유 = not-hostile }
                           그 밖에는 아무것도 하지 않는다 —
                           피해도 · 끊김도 · 미는 힘도 · 기력 수지도 없다

        Result         Struck(성립한 수) · Unharmed(성립하지 않은 수)

        "이 휘두름의 첫 성립이면 기력 수지" 의 뜻이 좁아진다 — 중립인 몸에 먼저 닿아도
        그것은 첫 성립이 아니다. 기력을 버는 것은 여전히 **맞힌 것**뿐이다.

    RULE-NPC-DECIDE-001 (CHANGED)
        Implements     INTENT-NPC-AUTONOMY-001 (CHANGED)
        Input          Control = autonomous 인 Actor, 세계의 다른 Actor 들
        Preconditions  (기존 그대로) 현재 행동이 대체 가능하다 · 쓰러지지 않았다
        Transition     인지 대상 = PerceptionRange 안에 있고 **RULE-STANCE-001(자기 → 상대)
                       이 hostile 인** 존재 중 가장 가까운 것 (같은 거리면 Id 사전순)
                         있음 + AttackRange 이내 → 몸을 돌리고 RULE-SKILL-BEGIN-001
                         있음 + AttackRange 밖   → RULE-MOVE-001 (그 자리로)
                         없음                    → WanderPath 순회
        Result         Decided(ActionKind) | Unchanged

        거르기는 **자기 → 상대** 한 방향만 읽는다. 해의 관문(양방향)과 다르다:
        쫓을지 말지는 자기 목적의 문제이므로, 상대가 나를 어떻게 보든 내가 지킬 것이
        없으면 쫓지 않는다.

        지키는 자리를 지니지 않은 자율 존재는 hostile 이 하나도 없으므로 언제나 순회한다.
        쫓다가 침입자가 자리 밖으로 나가면 그 순간 hostile 이 아니게 되어 대상이 사라지고,
        다음 Tick 부터 순회로 돌아간다 — **"나가면 더 쫓지 않는다" 를 위한 규칙이 따로 없다**
        (MG-HOLD-HUNTING-GROUND.world_shape).

    RULE-STRIKE-EVENT-EXPIRE-001 (CHANGED)
        Implements     INTENT-STRIKE-OBSERVE-001 · INTENT-UNHARMED-IS-OBSERVABLE-001
        Input          World.StrikeEvents, World.UnharmedContacts, World.Time
        Preconditions  World.Time - 항목.Time > STRIKE_EVENT_TTL
        Transition     해당 항목을 각자의 목록에서 제거한다
        Result         Expired(count)

        Tick 순서에서 시간 진행 뒤에 놓이는 것도 그대로다 — 방금 일어난 무산도
        최소 한 번은 관찰되어야 한다.

## OBSERVABLE SEMANTIC

    존재마다 — 그가 나를 어떻게 대하는가          RULE-STANCE-001(그 존재 → 내 몸)
    존재마다 — 내가 그를 어떻게 대하는가          RULE-STANCE-001(내 몸 → 그 존재)
        각각 hostile | neutral | friendly 중 하나. **모든 존재에 언제나 둘 다 실린다.**
        가려지지 않는다 — 가려짐의 목록(CONCEALABLE_ATTRIBUTE_KEYS)에 넣지 않는다.
        살펴봄으로 여는 것은 겨루는 힘이고, 태도는 지금 둘 사이에 있는 일이다.
        보는 이가 몸을 지니지 않으면 실리지 않는다 (견줄 대상이 없다).

        **둘 다 싣는 이유**는 태도가 방향값이고 관문이 양방향을 읽기 때문이다.
        한쪽만 실으면 "왜 내가 저것을 칠 수 있는가" 의 답이 절반만 온다.
        지금 배치에서는 내 쪽 값이 대개 neutral 이지만, 내 몸에 지키는 자리가 붙으면
        내 쪽도 적대가 된다 — **언제나 같은 값이라고 가정하고 빼지 않는다.**

    무산된 접촉                                   World.UnharmedContacts
        누가 · 누구에게 · 어떤 스킬로 · 어디서 · 언제 · **왜 성립하지 않았는가**.
        타격 결과와 나란히 실리고 같은 수명을 가진다.
        이것이 없으면 화면에서 무산은 빗나감과 구분되지 않는다.

    지키는 자리 자체는 싣지 않는다                 (판단 — Stage 5 확인 항목)
        어디까지가 그 존재의 자리인가를 세계가 그려 주지 않는다. 경계는 **태도가 바뀌는
        것으로** 드러난다 — 걸어 들어가면 중립이 적대가 되고 나오면 되돌아간다.
        겪으며 알아내는 것이 이 갈래의 값어치이므로(MP-LEARN-TO-HANDLE-THE-LAYER)
        자리를 미리 그려 주면 그 값어치가 사라진다.
        이것은 **가리는 것이 아니다** — 태도는 언제나 실려 있고, 자리는 그 태도의 원인일 뿐이다.

## BALANCE

    지키는 자리의 반경        7.0
        인지 거리(9.0)보다 **작게** 둔다. 그래야 자리에 든 침입자를 대개 곧 알아채고,
        자리 밖으로 나간 것을 계속 쫓는 일이 생기지 않는다. 사거리(2.0)보다 훨씬 커서
        "들어왔다" 와 "닿는다" 가 뚜렷이 나뉜다.

    초기 배치
        지키는 존재 (npc-1)   자리 중심 (-10, -8) · 반경 7.0
                              순회 경로를 그 자리 안으로 좁힌다:
                              (-13,-8) → (-7,-8) → (-10,-12)
                              — 자기 자리를 도는 존재가 되어야 "지킨다" 로 읽힌다
        지키지 않는 존재 (npc-2)  자리 없음. 순회 경로 그대로 (12,8) → (4,12)

        보는 이의 몸에는 지키는 자리를 주지 않는다 — 지금 사람 쪽에 그럴 사정이 없기
        때문이지 사람이라서가 아니다. 그 몸이 놓이는 자리(SPAWN_POINTS)는 모두 자리 밖이다 —
        (0,0) 은 중심에서 12.8, 가장 가까운 (-3,-2) 도 9.2 로 반경 7 밖이다.
        **처음에는 아무도 나를 사냥감으로 보지 않는다.** 다가가는 것이 플레이어의 선택이며,
        그 선택 없이는 이 세계에서 아무 일도 일어나지 않는다
        (DC-WORLD-COMBAT-IS-ONE-POSSIBILITY).

    치고 빠지기에 대하여
        자리 안에서 치고 밖으로 나가면 쫓기지 않는다. 그러나 밖에서는 **칠 수도 없다** —
        얻는 것이 없다. 규칙으로 막지 않는 이유가 이것이다: 막으면 "물러나면 풀린다" 와
        정면으로 부딪힌다 (02 DESIGN TRACE 의 Note).

## SEMANTIC CLOSURE

    "존재 사이에 태도가 있다"              → RULE-STANCE-001 (파생 · hostile|neutral|friendly)
    "태도는 쌍의 값이고 방향을 가진다"      → RULE-STANCE-001 의 입력이 (A, B) 순서쌍이다
    "태도는 기록이 아니다"                 → 저장하는 State 가 없다 (WORLD STATE — Stance 파생)
    "지키는 자리를 지닌 존재가 있다"        → Actor.GuardedGround (없을 수 있다)
    "그 안에 든 것을 사냥감으로 대한다"     → RULE-STANCE-001 Result hostile
    "자리는 몸을 따라다니지 않는다"         → GuardedGround.Center 는 고정값이다
    "적대가 아니면 해가 일어나지 않는다"    → RULE-HARM-GATE-001 + RULE-SWING-STRIKE-001 의
                                            새 Precondition (피해 · 끊김 · 밀림 모두 그 뒤에 있다)
    "몸끼리 밀어냄은 관문 밖"              → RULE-BODY-PUSH-001 무변경 (SEMANTIC DELTA REUSED)
    "관문은 닿는 자리에 선다"              → RULE-SWING-STRIKE-001 이 유일한 성립 지점이다
    "관문은 양쪽에 똑같이 선다"            → RULE-SWING-STRIKE-001 은 공격자를 가리지 않는다
    "물러나면 풀린다"                     → 파생이므로 자리 밖으로 나가면 결과가 바뀐다.
                                            푸는 규칙이 없다는 것이 곧 이 문장의 구현이다
    "밖에서는 칠 수 없다"                  → RULE-HARM-GATE-001 이 양쪽 모두 neutral 로 읽는다
    "자율 존재가 사냥감만 쫓는다"           → RULE-NPC-DECIDE-001 의 새 Precondition
    "나가면 더 쫓지 않는다"                → 같은 Precondition 이 다음 Tick 에 대상을 잃는다
    "둘 사이의 태도가 양쪽 다 보인다"      → Observable — 존재마다 두 방향이 실리고 가려지지 않는다
    "주체의 종류가 규칙을 바꾸지 않는다"    → RULE-STANCE-001 · HOSTILITY_REASONS 의 입력에
                                            Control 도 CharacterKind 도 없다
    "사정이 늘어도 관문은 그대로다"        → RULE-HARM-GATE-001 은 RULE-STANCE-001 의 결과만
                                            읽고, 사정은 HOSTILITY_REASONS 목록이 소유한다
    "닿았는데 아무 일도 없었음이 보인다"    → World.UnharmedContacts + 사유 not-hostile
    "무엇이 왜 안 되는지는 세계가 정한다"   → 사유 코드의 단일 출처가 World 다
                                            (DC-WORLD-OWNS-THE-SURFACE-LIST)
    "우호는 갈래로만 선다"                 → RULE-STANCE-001 Result 에 friendly 가 있고
                                            그것을 내는 조건이 없다 (명시)

    닫히지 않은 문장 없음.
