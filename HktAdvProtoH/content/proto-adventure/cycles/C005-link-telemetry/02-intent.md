# CYCLE C005 — Intent

## GOAL / POSSIBILITY
    GOAL-OBSERVER-KNOWS-LINK-QUALITY
        관찰자는 자신과 세계 사이가 얼마나 잘 통하고 있는지 안다.
        이어져 있다 / 끊겼다 두 가지가 아니라, 그 사이의 정도를 안다.
        ├── POSSIBILITY-MARK-AND-ACKNOWLEDGE
        │     관찰자가 보내는 것에 표식을 붙이고, 세계가 어디까지 받아들였는지 알린다.
        ├── POSSIBILITY-MEASURE-ROUNDTRIP
        │     내 표식이 돌아온 시점으로 왕복에 걸린 시간을 잰다.
        ├── POSSIBILITY-MEASURE-ARRIVAL
        │     세계에서 오는 것이 얼마나 자주 오는지, 마지막이 언제였는지를 잰다.
        └── POSSIBILITY-COUNT-OWN-EFFORT
              내가 얼마나 보내고 있는지, 몇 번이나 다시 이었는지를 센다.

    GOAL-OBSERVER-SEES-ITS-BINDING
        관찰자는 자신이 무엇에 이어져 있는지 화면에서 본다 —
        누구로서, 어느 몸으로, 어느 세계에.
        └── POSSIBILITY-SHOW-BINDING
              이어짐의 신원이 화면에 늘 떠 있다.

## INTENT SET
    INTENT-OBSERVER-MARK-001

        관찰자는 세계로 보내는 것에 표식을 붙일 수 있다.
        표식은 관찰자가 매기는 것이며 뒤로 가지 않는다 — 보낼수록 커진다.

        세계는 그 관찰자로부터 받아들인 마지막 표식을 기억하고,
        그 관찰자의 관찰 결과에 실어 되돌린다.

        표식은 게임에서 아무것도 바꾸지 않는다.
        세계의 물건도, 몸도, 시간도 표식 때문에 달라지지 않는다.
        표식이 말하는 것은 하나뿐이다 — "너에게서 여기까지 받았다".

        늦게 도착한 옛 표식은 받아들인 자리를 뒤로 되돌리지 않는다.
        세계가 아는 것은 언제나 "지금까지 받은 것 중 가장 나중의 것"이다.

    INTENT-LINK-ROUNDTRIP-001

        관찰자는 자신이 표식을 보낸 시각을 알고 있고,
        그 표식이 받아들여진 관찰 결과가 도착한 시각도 안다.

        따라서 관찰자는 자기 것이 세계에 닿아 판정되고 자신에게 돌아오기까지
        걸린 시간을 알 수 있다.

        이 시간은 선의 왕복이 아니라 **인과의 왕복**이다 —
        내 조작이 세계에 반영되어 내 화면에 나타나기까지의 시간이며,
        관찰자가 "느리다"고 느끼는 것의 정체다.

        아무것도 보내지 않는 동안에는 잴 것이 없다.
        관찰자는 게임 요청이 없어도 표식만 따로 보낼 수 있어야 한다.

    INTENT-LINK-FLOW-001

        관찰자는 세계에서 오는 것이 제때 오고 있는지 안다 —
        얼마나 자주 오고 있는지, 마지막으로 온 지 얼마나 되었는지.

        세계는 자기 시계로 꾸준히 내보내므로(INTENT-WORLD-CLOCK-001),
        도착이 드물어지거나 끊기는 것은 세계가 아니라 사이의 일이다.
        관찰자는 그것을 자기 쪽에서 재고 자기 쪽에서 안다.

    INTENT-LINK-EFFORT-001

        관찰자는 자신이 세계로 얼마나 보내고 있는지,
        그리고 이어짐이 몇 번이나 끊겼다 다시 붙었는지 안다.

        이것은 세계의 상태가 아니라 관찰자 자신의 이력이다.
        다시 이을 때마다 늘어나며, 관찰자가 살아 있는 동안 이어진다.

    INTENT-LINK-BINDING-VISIBLE-001

        관찰자는 자신이 누구로서, 어느 몸으로, 어느 세계에 이어져 있는지를
        화면에서 볼 수 있다.

        이 셋은 이미 정해져 있는 것이다 —
        누구인지는 자신이 밝힌 것이고(INTENT-OBSERVER-IDENTITY-001),
        어느 몸인지는 세계가 정한 것이며(INTENT-OBSERVER-JOIN-001),
        어느 세계인지는 자신이 붙은 곳이다.
        이번 Cycle 은 그것을 새로 만들지 않고 보이게 한다.

    INTENT-LINK-ALWAYS-SHOWN-001

        이어짐에 대해 아는 것은 문제가 생겼을 때만이 아니라 언제나 보인다.

        정상일 때 아무것도 보이지 않으면
        관찰자는 "지금 좋은 것"과 "나빠지는 중인 것"을 구분할 수 없다.
        좋을 때의 값을 알아야 나빠진 것을 알아볼 수 있다.

## DESIGN TRACE
    INTENT-OBSERVER-MARK-001
        Source Goal         GOAL-OBSERVER-KNOWS-LINK-QUALITY
        Source Possibility  POSSIBILITY-MARK-AND-ACKNOWLEDGE
    INTENT-LINK-ROUNDTRIP-001
        Source Goal         GOAL-OBSERVER-KNOWS-LINK-QUALITY
        Source Possibility  POSSIBILITY-MEASURE-ROUNDTRIP
    INTENT-LINK-FLOW-001
        Source Goal         GOAL-OBSERVER-KNOWS-LINK-QUALITY
        Source Possibility  POSSIBILITY-MEASURE-ARRIVAL
    INTENT-LINK-EFFORT-001
        Source Goal         GOAL-OBSERVER-KNOWS-LINK-QUALITY
        Source Possibility  POSSIBILITY-COUNT-OWN-EFFORT
    INTENT-LINK-BINDING-VISIBLE-001
        Source Goal         GOAL-OBSERVER-SEES-ITS-BINDING
        Source Possibility  POSSIBILITY-SHOW-BINDING
    INTENT-LINK-ALWAYS-SHOWN-001
        Source Goal         GOAL-OBSERVER-SEES-ITS-BINDING · GOAL-OBSERVER-KNOWS-LINK-QUALITY
        Source Possibility  POSSIBILITY-SHOW-BINDING

## EXISTING INTENT DELTA
    REUSED
        INTENT-MINING-001 (C001)
        INTENT-ACTION-* · INTENT-ATTACK-* · INTENT-HIT-REACTION-001 ·
        INTENT-CHARACTER-KIND-001 · INTENT-MOTION-OBSERVE-001 · INTENT-NPC-AUTONOMY-001 (C002)
        INTENT-WORLD-CLOCK-001 · INTENT-REMOTE-REQUEST-001 (C003)
        INTENT-OBSERVER-IDENTITY-001 · INTENT-OBSERVER-JOIN-001 ·
        INTENT-OBSERVER-REJOIN-001 · INTENT-OBSERVER-LEAVE-001 ·
        INTENT-REQUEST-ATTRIBUTION-001 (C004)
        — 게임의 의미는 하나도 바뀌지 않는다. 이번 Cycle 은 세계에서 벌어지는 일이 아니라
          관찰자와 세계 사이에 대해 아는 것을 늘린다.

    CHANGED
        INTENT-OBSERVER-LINK-001 (C003 → C004 에서 한 번 확장됨)
            BEFORE  관찰자는 이어짐 상태를 안다 — 이어짐 · 잇는 중 · 끊김.
                    (C004) 그리고 자신이 누구로 이어졌는지도 안다.
            AFTER   위에 더해, 이어짐이 **얼마나 잘 통하는지**를 수치로 안다
                    (INTENT-LINK-ROUNDTRIP-001 · INTENT-LINK-FLOW-001 ·
                     INTENT-LINK-EFFORT-001) 그리고 그것이 언제나 보인다
                    (INTENT-LINK-ALWAYS-SHOWN-001).
            Reason  GOAL-OBSERVER-KNOWS-LINK-QUALITY — 두 상태만으로는
                    나빠지는 중인 이어짐을 알아볼 수 없다.
            Note    "이 상태는 관찰자 쪽이 소유한다" 는 성질은 그대로다.
                    세계가 보태는 것은 "너에게서 여기까지 받았다" 하나뿐이며,
                    그것도 그 관찰자의 관찰 결과에만 실린다.

        INTENT-PER-OBSERVER-PROJECTION-001 (C004)
            BEFORE  관찰 결과에서 자신의 몸과 나만의 것이 관찰자마다 다르다.
            AFTER   위에 더해, 세계가 그 관찰자에게서 받아들인 마지막 표식도
                    그 관찰자의 관찰 결과에만 실린다 —
                    다른 관찰자의 표식은 내 관찰 결과에 오지 않는다.
            Reason  INTENT-OBSERVER-MARK-001 — 표식은 그 관찰자와 세계 사이의 일이다.

        INTENT-REMOTE-REQUEST-001 (C003)
            BEFORE  요청은 보내는 즉시 세계가 되지 않는다. 판정 결과는 반환값이 아니라
                    그 뒤에 오는 관찰 결과에서 드러난다.
            AFTER   그대로다. 다만 관찰자는 이제 "그 뒤"가 얼마나 뒤인지 잴 수 있다.
                    판정 결과가 돌아오는 것이 아니라, 받아들인 자리가 돌아온다.
            Reason  INTENT-LINK-ROUNDTRIP-001

    NOT INTRODUCED (01-cycle.md EXCLUDED — Intent 로 끌어들이지 않았다)
        요청을 미리 반영하는 것 · 되감기 · 측정값을 저장하는 것 ·
        주고받은 양(바이트) · 세계 내부의 성능 · 남의 이어짐 상태 ·
        지나간 값의 기록 · 느릴 때 알아서 무언가를 줄이는 것
