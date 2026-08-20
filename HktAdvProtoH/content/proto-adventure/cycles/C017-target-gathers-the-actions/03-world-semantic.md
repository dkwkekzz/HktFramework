# C017 — World Semantic

> 이 Cycle 이 세계에 더하는 상태는 **하나**다 — 관찰자 하나가 고른 존재 하나.
> 그 위에 규칙 셋(고르기 · 풀기 · 정리)이 서고, 이미 있던 두 행동이 대상을 요청이 아니라
> 그 상태에서 읽도록 바뀐다. 계산은 한 자리도 늘지 않는다.

## SEMANTIC DELTA

    REUSED
        Actor                        존재 · 자리 · 이름 · 생명 · 현재 행동
        Deposit                      광맥 · 남은 양
        Observer                     관찰자 장부 (Id · ActorId · Present)
        World.Acquaintances          앎의 장부 — 담는 모양의 선례이자 수명의 선례
        Actor.CurrentAction          행동의 자리 — 고르기는 여기에 들어오지 않는다
        InteractionView              가용 여부와 불가 사유의 계약 (available · reason)
        RULE-OBSERVE-COMPLETE-001    살펴봄의 완료 효과 — 무변경
        RULE-MINE-COMPLETE-001       채집의 완료 효과 — 무변경
        RULE-ACTION-BEGIN-001        행동 시작 관문 (action-busy) — 무변경
        RULE-SWING-STRIKE-001        휘두름이 닿은 것이 맞는다 — 무변경
        RULE-NPC-DECIDE-001          자율 존재의 판단 — 무변경

    ADDED
        World.TargetSelections               관찰자별로 고른 존재 하나
        TargetSelection.ObserverId           누가 골랐는가
        TargetSelection.TargetEntityId       무엇을 골랐는가
        RULE-TARGET-SELECT-001               고른다
        RULE-TARGET-CLEAR-001                푼다
        RULE-TARGET-CLEAR-STALE-001          성립하지 않게 된 관계를 세계가 비운다
        TargetSelect.Availability / FailureReason      존재마다 — 고를 수 있는가
        CurrentTarget.Observable                       지금 무엇을 고르고 있는가

    CHANGED
        RULE-OBSERVE-BEGIN-001
            OLD INPUT       ObserverId, 요청이 실어 온 대상 ActorId
            NEW INPUT       ObserverId  (대상은 World.TargetSelections 에서 읽는다)
            NEW PRECONDITION  고른 것이 있다              (no-target-selected)
            NEW PRECONDITION  고른 것이 존재다             (target-kind-mismatch)
            REMOVED           no-such-target · target-is-self
                              — 고르기 관문이 앞서 막는다 (RULE-TARGET-SELECT-001 P2 · P3)
            거리 · 남은 자리 · 행동 관문은 무변경. 완료 효과도 무변경

        RULE-MINE-001
            OLD INPUT       Actor, 요청이 실어 온 대상 DepositId
            NEW INPUT       Actor, ObserverId  (대상은 World.TargetSelections 에서 읽는다)
            NEW PRECONDITION  고른 것이 있다              (no-target-selected)
            NEW PRECONDITION  고른 것이 광맥이다           (target-kind-mismatch)
            REMOVED           unknown-deposit
                              — 고르기 관문이 앞서 막는다 (RULE-TARGET-SELECT-001 P2)
            도구 · 거리 · 남은 양 · 행동 관문은 무변경. 완료 효과도 무변경

        Observable — interactions[]
            OLD  observe 가 Actor 마다 하나씩 · mine 이 Deposit 마다 하나씩 실렸다
                 (대상마다 available 과 reason 이 흩어져 있었다)
            NEW  observe · mine 이 **각각 하나씩** 실리고 고른 대상에 대해 판정된다.
                 대신 select-target 이 **존재마다** 실린다 (고를 수 있는가와 그 사유)
            항목 수는 늘지 않는다 — 자리를 옮긴다

    AFFECTED
        RULE-OBSERVER-JOIN-001       재참여 갈래 무변경 — 고른 것도 몸·앎처럼 이어진다
        RULE-OBSERVER-LEAVE-001      무변경 — 몸이 남으므로 고른 것도 비우지 않는다
        RULE-WORLD-TICK-001          RULE-TARGET-CLEAR-STALE-001 이 매 Tick 도는 자리가 된다
        RULE-ATTRIBUTE-SET-001       무변경 — 세계 밖에서 들어오는 손은 자기 대상을 따로
                                     지목한다 (02 EXISTING INTENT DELTA)
        RULE-OBSERVE-FORGET-001      무변경 — 되돌려도 고른 것은 풀리지 않는다
        RULE-DOWNED-001              무변경 — 쓰러진 존재도 고른 채로 남는다
        Command Catalog              고르기·풀기가 요청 목록에 실린다

## WORLD STATE

    World.TargetSelections                          World Authority
        관찰자 하나당 최대 하나. 항목이 없는 관찰자는 아무것도 고르지 않은 것이다 —
        "없음" 을 따로 저장하지 않는다 (World.Acquaintances 의 선례 그대로).

        TargetSelection
            ObserverId       World Authority   누가 골랐는가
            TargetEntityId   World Authority   무엇을 골랐는가 (Actor 든 Deposit 이든
                                               관찰에 실리는 존재의 Id 하나)

    담는 것은 **Id 뿐**이다. 대상의 이름도 값도 베껴 담지 않는다 —
    베끼면 대상이 달라져도 고른 자리에는 옛 값이 남는다 (C014 가 앎에 대해 세운 성질 그대로).

    Actor 와 Deposit 은 서로 다른 목록이지만 관찰에서는 같은 계약(entities[])으로 실린다.
    고른 것은 그 계약의 Id 하나이므로 종류를 가리지 않는다 — 무엇이 될 수 있는지는
    고르는 자리가 아니라 **행동이** 정한다 (target-kind-mismatch).

    대상 쪽에는 아무것도 더하지 않는다. 존재는 자기가 골라졌는지 알 수 없다 —
    이 State 를 읽는 규칙은 아래 셋과 두 행동 관문뿐이며, RULE-NPC-DECIDE-001 은 읽지 않는다.

## WORLD RULE

    RULE-TARGET-SELECT-001
        Implements     INTENT-TARGET-SELECT-001 · INTENT-TARGET-ELIGIBLE-001 ·
                       INTENT-TARGET-PER-OBSERVER-001
        Input          ObserverId, TargetEntityId
        Preconditions  1. 세계가 그 관찰자를 안다                    (unknown-observer)
                       2. 그 Id 의 존재가 그 관찰자의 관찰에 실린다    (no-such-target)
                       3. 그 존재가 그 관찰자의 몸이 아니다           (target-is-self)
        Transition     그 관찰자의 TargetSelection.TargetEntityId = TargetEntityId
                       (항목이 없으면 만든다. 있으면 앞의 것을 대신한다)
        Result         Success | Failure(reason)

        시간이 들지 않고 Actor.CurrentAction 을 건드리지 않는다 —
        RULE-ACTION-BEGIN-001 을 지나지 않으므로 다른 행동 중에도 고를 수 있고
        하던 행동이 끊기지 않는다 (INTENT-TARGET-SELECT-001).

        같은 대상을 다시 골라도 결과가 같다 (덮어쓰기다 — 토글이 아니다).

        Precondition 2 는 "세계에 있는가" 가 아니라 **"그 관찰자의 관찰에 실리는가"** 다.
        지금 이 세계에는 관찰 범위 제한이 없어 둘이 같은 값이지만, 판정의 근거를
        관찰 쪽에 두어야 나중에 범위가 생겨도 이 규칙이 바뀌지 않는다 (TG §4.1).

    RULE-TARGET-CLEAR-001
        Implements     INTENT-TARGET-RELEASE-001
        Input          ObserverId
        Preconditions  1. 세계가 그 관찰자를 안다                    (unknown-observer)
        Transition     그 관찰자의 TargetSelection 을 없앤다
        Result         Success

        조건이 없다 — 이미 고른 것이 없어도 성공이다 (RULE-GUARD-RELEASE-001 의 선례:
        놓는 데에는 조건을 두지 않는다). 같은 요청이 두 번 와도 결과가 같다.

    RULE-TARGET-CLEAR-STALE-001
        Implements     INTENT-TARGET-RELEASE-001
        Input          World (매 Tick)
        Preconditions  없음 — 훑는 규칙이다
        Transition     TargetEntityId 가 그 관찰자의 관찰에 더 이상 실리지 않는
                       TargetSelection 을 없앤다
        Result         Cleared(관찰자 Id 들) | NoChange

        RULE-TARGET-SELECT-001 의 Precondition 2 와 **같은 판정**을 쓴다 —
        고를 수 없게 된 것은 고른 채로 둘 수 없다. 판정이 두 곳에 적히면 어긋난다.

        REACHABILITY  **지금 세계에서 이 규칙은 플레이로 도달하지 않는다.**
                      코드 대조 — 존재가 세계에서 사라지는 경로가 0건이다
                      (Actor 는 쓰러져도 목록에 남고, Deposit 은 바닥나도 남으며,
                      관찰자가 떠나도 몸은 그대로다). 관찰에 범위 제한도 없다.
                      그래도 규칙으로 세운다: 관계를 지니기로 한 이상 성립하지 않게
                      되었을 때의 처리는 그 관계의 일부이며, 존재를 없애는 첫 Cycle 이
                      이 자리를 새로 발명하지 않아야 한다.
                      검증은 세계 단위 시험으로 한다 — 존재를 지운 세계를 한 Tick
                      굴려 고른 것이 비워지는지 본다. Stage 8 은 이것이 플레이 검증이
                      아니라는 사실을 그대로 적는다.

    RULE-OBSERVE-BEGIN-001 (CHANGED)
        Implements     INTENT-OBSERVE-001 · INTENT-TARGET-DIRECTS-THE-ACT-001 ·
                       INTENT-ACTION-STATE-001
        Input          ObserverId
        Preconditions  1. 그 관찰자의 몸이 세계에 있다               (no-body)
                       2. 그 관찰자가 고른 것이 있다                 (no-target-selected)
                       3. 고른 것이 존재다 (광맥이 아니다)            (target-kind-mismatch)
                       4. 두 몸 중심 거리 ≤ OBSERVE_RANGE            (out-of-range)
                       5. 아직 열 자리가 남아 있다                   (already-known)
                       6. 현재 행동이 대체 가능하다                  (action-busy)
        Transition     CurrentAction = observe(고른 존재)
        Result         Success | Failure(reason)

        2 와 3 이 앞의 자리(옛 no-such-target · target-is-self)를 대신한다.
        자기 몸은 고를 수 없으므로 살펴봄이 자기를 대상으로 오는 일이 없다.
        4 · 5 · 6 은 한 글자도 바뀌지 않는다 — 이 Cycle 은 살펴봄을 쉽게 만들지 않는다.

        Transition 은 고른 것의 Id 를 CurrentAction 에 적는다. 시작한 뒤에 고른 것을
        바꾸어도 **진행 중인 살펴봄의 대상은 바뀌지 않는다** — 행동은 시작할 때
        대상을 정하고, 그 뒤로는 자기 대상을 지닌다 (RULE-OBSERVE-COMPLETE-001 무변경).
        지목이 진행 중인 행동을 따라다니면 그것은 자동 추적이다
        (DC-TARGET-IS-INTENT-NOT-AIM).

    RULE-MINE-001 (CHANGED)
        Implements     INTENT-MINING-001 · INTENT-TARGET-DIRECTS-THE-ACT-001 ·
                       INTENT-ACTION-STATE-001
        Input          Actor, ObserverId
        Preconditions  1. 그 관찰자가 고른 것이 있다                 (no-target-selected)
                       2. 고른 것이 광맥이다                        (target-kind-mismatch)
                       3. 채집 도구를 지녔다                        (no-mining-tool)
                       4. 거리 ≤ INTERACTION_RANGE                  (out-of-range)
                       5. 남은 양 > 0                               (deposit-depleted)
                       6. 현재 행동이 대체 가능하다                  (action-busy)
        Transition     CurrentAction = mine(고른 광맥)
        Result         Success | Failure(reason)

        1 과 2 가 앞의 unknown-deposit 을 대신한다. 3~6 은 무변경이며 순서도 그대로다.
        살펴봄과 같은 이유로, 시작한 뒤 고른 것을 바꾸어도 진행 중인 채집은 그대로다.

## OBSERVABLE SEMANTIC

    ── 지금 무엇을 고르고 있는가 ────────────────────────────────────

    CurrentTarget                                  관찰자마다 따로
        고른 존재의 Id 하나, 또는 아무것도 고르지 않았다는 사실.
        **늘 실린다** — 고른 것이 없다는 것도 관찰이다 (C011 · C014 가 세운 원칙:
        "지금은 없다" 와 "세계가 안 알려준다" 를 가른다).

        고른 존재의 값(이름 · 자리 · 생명 · 지금 행동 · 가려짐)은 여기에 베껴 싣지 않는다.
        그것들은 이미 entities[] 에 그 존재의 자리로 실려 있고, 두 곳에 실으면
        같은 값이 두 출처를 갖는다. 관찰자는 Id 로 그 자리를 짚는다.
        **모으는 것은 값이 아니라 판정이다** — 아래 두 줄이 그 모음이다.

    ── 고를 수 있는가 (존재마다) ────────────────────────────────────

    TargetSelect.Availability / FailureReason      존재마다 · 관찰자마다
        entities[] 에 실리는 모든 존재에 하나씩. 자기 몸에도 실린다 —
        available 이 거짓이고 사유가 target-is-self 다. 왜 자기는 못 고르는지도
        세계가 말한다 (INTENT-UNSEEN-IS-OBSERVABLE-001 이 세운 태도 그대로).

        RULE-TARGET-SELECT-001 의 Precondition 과 **같은 판정**을 쓴다.
        사유 순서도 Precondition 순서 그대로다.

    TargetClear.Availability                       관찰자마다
        언제나 참이다 (RULE-TARGET-CLEAR-001 에 조건이 없다).
        늘 실려 있어야 무엇을 고른 적 없는 사람도 푸는 길이 있음을 안다.

    ── 고른 상대에게 지금 무엇이 되는가 ────────────────────────────

    Observe.Availability / FailureReason           관찰자마다 (하나)
    Mine.Availability / FailureReason              관찰자마다 (하나)
        존재마다 흩어져 있던 이 둘이 **각각 하나로 줄고** 고른 대상에 대해 판정된다.
        아무것도 고르지 않았으면 available 이 거짓이고 사유가 no-target-selected 다 —
        목록에서 사라지지 않는다. 걸 수 있는 일은 언제나 먼저 밝혀져 있어야 한다
        (INTENT-COMMAND-CATALOG-001).

        멀어지면 out-of-range 로, 다가가면 다시 가용으로 바뀐다. 고른 것은 그동안
        풀리지 않는다 — 이것이 MC-WATCH-TARGET 이 요구하는 "사유가 갱신된다" 다.

    ── 무엇이 관찰에 실리지 않는가 ─────────────────────────────────

    누가 나를 고르고 있는가는 실리지 않는다 — 세계 어디에도 그런 상태가 없다.
    실으면 지목이 대상에게 무언가를 하는 일이 되고, 위협도의 첫 칸이 된다
    (INTENT-TARGET-PER-OBSERVER-001 · 01 EXCLUDED).

    다른 관찰자가 무엇을 고르고 있는지도 실리지 않는다 — 고른 것은 보는 이의 것이다.

## SEMANTIC CLOSURE

    "존재 하나를 고른다"                → World.TargetSelections + RULE-TARGET-SELECT-001
    "보는 이마다 정확히 하나"            → TargetSelection 이 ObserverId 당 하나
    "아무것도 안 고른 상태도 정상"        → 항목 없음 = 안 고름 (없음을 저장하지 않는다)
    "시간이 들지 않는다 · 행동이 아니다"   → Transition 에 CurrentAction 이 없다 ·
                                          RULE-ACTION-BEGIN-001 을 지나지 않는다
    "새로 고르면 앞의 것을 대신한다"      → Transition 이 덮어쓴다
    "다시 골라도 유지된다"               → 같은 값 덮어쓰기 = 같은 결과
    "무엇을 고를 수 있는가를 세계가 정한다" → RULE-TARGET-SELECT-001 P2 · P3
    "관찰에 실린 존재만"                 → P2 (판정 근거가 관찰이다)
    "자기 몸은 아니다"                   → P3
    "왜 못 고르는지가 사유로 온다"        → TargetSelect.FailureReason
    "고른 것은 보는 이의 것이다"          → State 의 열이 ObserverId 다
    "대상은 골라졌다는 이유로 달라지지 않는다" → Transition 에 대상 State 가 없다 ·
                                          누가 나를 고르는가가 관찰에 없다
    "수명은 앎과 같다"                   → RULE-OBSERVER-LEAVE/JOIN-001 무변경 (AFFECTED)
    "스스로 풀리지 않는다"               → 비우는 규칙은 CLEAR-001 · CLEAR-STALE-001 둘뿐
    "멀어져도 · 쓰러져도 유지된다"        → 거리와 쓰러짐이 CLEAR-STALE-001 의 판정에 없다
    "달라지는 것은 사유다"               → Observe/Mine.FailureReason 이 매 Tick 다시 판정된다
    "명시적으로 푼다"                    → RULE-TARGET-CLEAR-001
    "성립하지 않게 되면 세계가 비운다"     → RULE-TARGET-CLEAR-STALE-001
    "고른다고 명중·피해·앎이 달라지지 않는다"
                                        → 위 세 규칙 어디에도 전투 State 도 앎의 장부도
                                          Transition 에 없다. 피해·흔들림·통찰 규칙 무변경
    "세계가 대신 다가가지 않는다"         → Transition 에 Position 도 Facing 도 없다
    "대상 지정 행동이 고른 것으로 나간다"  → RULE-OBSERVE-BEGIN-001 · RULE-MINE-001 의
                                          NEW INPUT (요청이 대상을 싣지 않는다)
    "안 골랐으면 사유와 함께 거절"        → 두 규칙의 no-target-selected
    "판정 자체는 안 바뀐다"              → 두 규칙의 나머지 Precondition 과 완료 효과 무변경
    "지금 무엇을 고르고 있는가가 실린다"   → CurrentTarget.Observable
    "무엇이 되고 무엇이 왜 안 되는가가 모인다"
                                        → Observe/Mine 이 각각 하나로 줄어 고른 대상에
                                          대해 판정된다 + TargetSelect 가 존재마다 실린다
    "값은 사본이 아니라 지금의 값"        → State 가 Id 만 담는다 (값은 entities[] 에서 읽는다)
    "가려진 것은 가려진 채"              → C014 · C016 의 투영 관문 무변경

## BALANCE

    이 Cycle 에는 조정할 수 있는 값이 **하나도 없다.**
    거리도 시간도 문턱도 확률도 더하지 않는다 — 관계 하나와 판정 다섯 줄이 전부다.
    OBSERVE_RANGE · INTERACTION_RANGE 는 그대로 두며 이 Cycle 이 근거 없이 만지지 않는다.

## NOTE

    ① 왜 고르기가 행동이 아닌가
       고르기를 Actor.CurrentAction 에 넣으면 RULE-ACTION-BEGIN-001 의 action-busy 에
       걸려 싸우는 중에 대상을 바꿀 수 없게 된다. 그러면 지목은 의도를 밝히는 일이
       아니라 대가를 치르는 수가 된다 — TG §2.1 은 지목을 관계로만 정의하며 대가를
       말하지 않는다 (02 DESIGN TRACE).

    ② 왜 고른 대상의 값을 한자리에 베끼지 않는가
       베끼면 같은 값이 entities[] 와 고른 자리 두 곳에서 오고, 둘이 어긋나는 순간
       어느 쪽이 세계인지 알 수 없다. C014 가 앎에 대해 내린 판단과 같다 —
       담는 것은 Id 뿐이고 값은 언제나 그 순간의 존재에서 읽는다.
       "한자리에서 읽힌다" 는 화면의 일이고, 세계가 할 일은 그것을 짐작 없이
       조립할 수 있게 하는 것이다 (Stage 4 가 그 계약을 적는다).

    ③ 왜 select-target 이 존재마다 실리는가
       무엇을 고를 수 있는지를 화면이 스스로 판정하면 (예: "광맥은 고를 수 없다")
       세계가 그 판정을 바꿔도 화면이 따라오지 않는다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
       그리고 이 자리가 곧 **지목의 뜻**이다 — 화면에서 존재를 짚었을 때 무슨 요청이
       되는가가 여기서 정해진다. 기반이 열어 줄 결정 자리가 읽는 것이 이 목록이다
       (01 PREREQUISITE ①).

    ④ 행동이 시작된 뒤의 대상
       살펴봄과 채집은 시작할 때 고른 것의 Id 를 자기 행동에 적는다. 그 뒤에 다른 것을
       고르면 새 고른 것은 다음 행동의 대상이 되고 진행 중인 행동은 원래 대상을
       끝까지 지닌다. 진행 중인 행동이 지목을 따라다니면 그것은 추적이며
       DC-TARGET-IS-INTENT-NOT-AIM 이 금지하는 것이다.

    ⑤ 공격은 이 자리를 지나지 않는다
       RULE-SKILL-BEGIN-001 과 RULE-SWING-STRIKE-001 은 한 글자도 바뀌지 않는다.
       고른 것이 있든 없든 휘두름은 나가고, 맞는 것은 닿은 몸이다 (01 EXCLUDED).
