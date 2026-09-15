# C021 — Intent

> 지금 이 세계에서 **가지는 것과 쓰는 것 사이에 자리가 없다.** 곡괭이를 배낭 깊숙이
> 넣어 두었든 손에 쥐었든 세계는 구분하지 않는다 — 지녔으면 캘 수 있다. 그래서
> 소지품은 아직 선택지가 아니다. 다 넣고 다니면 되기 때문이다.
> 이번에 더해지는 것은 새 능력도 새 물건도 아니라 **자리 하나**다. 몸에 자리가 생기고,
> 자리에 놓인 것만이 몸을 바꾸며, 빼면 정확히 원래의 몸으로 돌아온다. 그 자리가 서는
> 순간 "무엇을 들고 나갈까" 가 세계 안의 물음이 되고, 물건을 잃으면 도로 못 하게 된다.

## GOAL / POSSIBILITY

    GOAL-HOLDING-IS-NOT-APPLYING            가지고 있는 것과 지금 적용된 것이 갈린다
        └── POSSIBILITY-THE-BODY-HAS-PLACES
                                            몸에는 물건이 적용되는 자리가 있다. 자리는
                                            목록이며, 자리가 늘어도 규칙의 형태는 같다
        └── POSSIBILITY-A-PLACE-TAKES-ONLY-WHAT-FITS
                                            무엇이 어느 자리에 들어갈 수 있는지는 정의가
                                            밝힌다. 맞지 않으면 사유와 함께 거절된다
        └── POSSIBILITY-APPLYING-IS-AN-ACT
                                            적용과 해제는 다른 행동과 같은 얼개를 진다 —
                                            시간을 쓰고, 끊기면 아무 일도 일어나지 않는다
        └── POSSIBILITY-EXCHANGE-IS-ONE-UNIT
                                            찬 자리를 바꾸는 것은 하나의 성공 단위다.
                                            자리가 빈 채로 실패하는 상태가 없다
        └── POSSIBILITY-APPLIED-IS-STILL-CARRIED
                                            자리에 놓아도 그것은 여전히 가진 것이다.
                                            적용은 소모가 아니다

    GOAL-WHAT-IS-APPLIED-MAKES-THE-BODY     지금 몸이 어떤가는 적용된 것들이 정한다
        └── POSSIBILITY-EVERY-JUDGEMENT-READS-THE-EFFECTIVE-VALUE
                                            능력치를 읽는 모든 판정은 유효값을 읽는다.
                                            읽는 자리가 여럿이어도 값의 출처는 하나다
        └── POSSIBILITY-THE-BASE-IS-NEVER-TOUCHED
                                            적용은 기본값을 고치지 않는다. 기여는 얹히는
                                            것이지 덮어쓰는 것이 아니다
        └── POSSIBILITY-RELEASING-RESTORES-EXACTLY
                                            풀면 근사치가 아니라 **같은 값**이 된다.
                                            끼웠다 뺐다를 되풀이해도 값이 자라지 않는다
        └── POSSIBILITY-A-USE-COMES-FROM-WHAT-IS-APPLIED
                                            할 수 있는 일은 지닌 것이 아니라 적용된 것에서
                                            온다. 지니기만 한 것은 몸에 아무것도 주지 않는다

    GOAL-THE-WORLD-SHOWS-WHAT-IS-ON-THE-BODY    무엇이 몸에 놓여 있고 무엇을 지금
                                                놓을 수 있는지가 보인다
        └── POSSIBILITY-EACH-PLACE-SHOWS-WHAT-IT-HOLDS
                                            자리마다 지금 무엇이 놓여 있는지가 관찰된다.
                                            빈 자리는 비어 있다고 관찰된다
        └── POSSIBILITY-EACH-ITEM-CARRIES-ITS-EQUIP-VERDICT
                                            소지품 항목마다 지금 찰 수 있는가 · 왜 못 차는가 ·
                                            지금 차고 있는가가 함께 온다. 화면이 판단하지 않는다

## INTENT SET

    ── 지니는 것만으로는 아무 일도 없다 ────────────────────────────────

    INTENT-HOLDING-CHANGES-NOTHING-001 (ADDED)

        어떤 물건을 **지니고 있다는 사실만으로는** 몸의 능력치도 할 수 있는 일도 달라지지
        않는다. 소지품에 무엇이 얼마나 있든, 그것을 훑어 몸의 값을 정하는 판정은 없다.

        이 문장이 이 Cycle 의 중심이며, 나머지 Intent 는 그 대신 무엇이 몸을 정하는가를
        말한다. 이것이 서면 소지품은 처음으로 **선택지**가 된다 — 다 넣고 다니는 것으로는
        아무것도 얻지 못하기 때문이다.

        예외는 하나도 없다. 자율 존재도 같은 규칙을 진다.

    INTENT-BODY-HAS-PLACES-001 (ADDED)

        몸은 물건이 적용되는 **자리**를 지닌다. 자리마다 지금 무엇이 놓여 있거나 비어 있다.

        자리는 **목록**이다. 자리가 하나에서 여럿으로 늘어나는 일은 목록에 항목이 늘어나는
        일이며, 적용 · 해제 · 교체 · 유효값 · 관찰 어느 것도 열리지 않는다.

        이 Cycle 이 세우는 자리는 **하나** — 손이다. 몇 개의 자리를 어떤 이름으로 둘
        것인가는 이 Cycle 이 정하지 않는다 (01-cycle.md SCOPE NOTE ①).

    INTENT-PLACE-FIT-001 (ADDED)

        무엇이 어느 자리에 들어갈 수 있는지는 **정의가 밝힌다.** 어느 자리도 밝히지 않은
        정의는 어느 자리에도 들어가지 않는다.

        규칙은 종류 이름을 묻지 않는다 — 정의에게 묻고, 정의가 답한 것으로 판정한다.
        그러므로 장착할 수 있는 물건이 새로 생기는 일은 정의에 자리 선언이 하나 붙는
        일이며, 자리 규칙도 관찰도 시험도 열리지 않는다.

        지금 손 자리에 들어가는 것은 곡괭이다. 돌은 어느 자리도 밝히지 않으므로
        **맞지 않는 자리라는 사유와 함께** 거절된다.

    ── 적용과 해제는 행동이다 ──────────────────────────────────────────

    INTENT-APPLY-ACT-001 (ADDED)

        지닌 것을 자리에 놓는 **적용 행동**과 자리에서 빼는 **해제 행동**이 있다.
        둘은 이 세계의 다른 행동과 같은 얼개를 진다 — 시작하려면 지금 하던 행동이 대체
        가능해야 하고, 시간을 쓰며, 그 시간 동안 다른 행동을 하지 않는다.

        효과는 **행동이 끝나는 시점에** 일어난다. 그러므로 끝나기 전에 끊긴 적용은
        아무 일도 일어나지 않은 것과 같다 — 자리도 값도 그대로다.

        적용에 드는 것은 **시간뿐**이다. 기력을 쓰지 않고 물건을 축내지 않는다.

    INTENT-APPLY-EXCHANGE-001 (ADDED)

        이미 찬 자리에 다른 것을 놓으면 **해제와 적용이 하나의 성공 단위로** 일어난다.
        둘은 함께 일어나거나 함께 일어나지 않으며, 자리가 빈 채로 남는 중간 상태는 없다.

        교체가 끝난 뒤 그 자리에 있는 것은 새것 하나뿐이고, 옛것은 그대로 소지품에 남는다.

    INTENT-APPLY-CHANGE-IS-ONE-UNIT-001 (ADDED)

        적용 · 해제 · 교체는 각각 하나의 성공 단위다. 되지 않은 시도는 세계에 **아무 흔적도
        남기지 않는다** — 자리도, 유효값도, 소지품의 수량도 시도 전과 같다.

        가능 여부를 판정하는 곳은 하나뿐이다. 관찰에 실리는 판정과 실제로 실행될 때의
        판정이 같은 것이므로, 화면에서 불가로 보이는 것을 억지로 요청해도 **같은 사유로**
        거절된다.

    INTENT-APPLIED-IS-STILL-CARRIED-001 (ADDED)

        자리에 놓인 것도 **여전히 가진 것**이다. 적용은 소지품의 수량을 줄이지 않는다.

        적용은 소모가 아니다. 소모는 쓴 것이 세계에서 사라지는 일이고(C020), 적용은
        가진 것 중 하나가 지금 몸에 닿아 있다는 상태다. 해제하면 닿아 있지 않을 뿐이며,
        물건은 처음부터 끝까지 그 몸의 것이다.

    ── 적용된 것이 몸을 정한다 ─────────────────────────────────────────

    INTENT-EFFECTIVE-ATTRIBUTE-001 (ADDED)

        몸의 능력치를 읽는 **모든 판정은 유효값을 읽는다.**

            유효값 = 기본값 + 지금 적용된 것들의 기여

        기본값은 적용이 바꾸지 않는다. 적용은 얹히는 것이지 덮어쓰는 것이 아니며,
        그래서 무엇을 빼야 무엇이 돌아오는지가 언제나 계산이 아니라 사실이다.

        기여를 밝히는 것은 **정의**다. 어떤 능력치에 얼마를 더하는지가 정의에 적히고,
        규칙은 그 목록을 합칠 뿐 종류를 묻지 않는다. 지금 기여를 지닌 것은 곡괭이 하나이며,
        그 기여는 물리 공격력이다 — 무거운 쇠도구를 들면 맨손보다 세게 친다.

        **새 능력치를 만들지 않는다.** 피해 공식도 관문도 그대로이며, 바뀌는 것은
        이미 있는 값이 어디서 오는가 하나다 (01-cycle.md SCOPE NOTE ③).

    INTENT-RELEASE-RESTORES-EXACTLY-001 (ADDED)

        해제하면 그 물건이 주던 것이 **정확히** 사라진다. 근사치가 아니라 같은 값이며,
        적용과 해제를 몇 번을 되풀이해도 값이 자라거나 줄지 않는다.

        이것이 이 Cycle 의 신뢰를 만드는 문장이다. 값이 새는 구멍은 대개 이 자리에서
        생기고, 새기 시작하면 지금 이 몸이 왜 이만큼 강한지를 세계가 설명할 수 없게 된다.

    INTENT-CAPABILITY-FROM-APPLIED-USE-001 (CHANGED — C020 의 INTENT-CAPABILITY-FROM-DECLARED-USE-001)

        "이 몸에 그 용도가 지금 있는가" 를 묻는 것은 그대로다. 바뀌는 것은 **그 답을
        어디서 모으는가** 하나다.

            지금까지    지닌 것들이 선언한 용도를 모두 모은다
            이제부터    **적용된 것들**이 선언한 용도를 모은다

        그러므로 곡괭이를 손에 차면 채굴 용도가 생기고, 풀면 사라진다. 캐고 싶으면
        차야 한다.

        이것은 새 능력을 만드는 것이 아니다 — 채굴은 여전히 세계의 채굴 하나이고,
        장착이 그것을 얻는 길 하나를 더할 뿐이다. 장착 전용 채굴 같은 것은 없다.

    INTENT-USE-DOES-NOT-REQUIRE-APPLYING-001 (ADDED)

        물건을 **쓰는 것**(C020)은 적용을 요구하지 않는다. 소모품을 쓰는 일은 적용이
        아니라 사건이며, 손에 든 것만 쓸 수 있다고 하면 쓰는 행동이 자리 수에 매이게 된다.

        다만 **쓴 결과가 요구하는 것은 그대로 요구된다.** 곡괭이를 쓰면 채굴이 시작되는데,
        채굴은 채굴 용도를 요구한다 — 차지 않은 곡괭이는 쓸 수 있는 것으로 관찰되지 않고,
        그 사유는 "채굴 용도가 지금 이 몸에 없다" 이다. 돌을 던지는 것은 아무 자리도
        요구하지 않으므로 지금까지 그대로다.

    ── 무엇이 몸에 있는지가 보인다 ─────────────────────────────────────

    INTENT-PLACE-OBSERVE-001 (ADDED)

        자리마다 지금 무엇이 놓여 있는지가 관찰된다. 빈 자리는 **비어 있다고** 관찰된다 —
        없는 것으로 관찰되지 않는다.

        관찰되는 것은 자기 몸의 자리다 (C004 의 관찰자별 투영을 그대로 따른다).

    INTENT-EQUIP-AVAILABILITY-001 (ADDED)

        소지품의 항목마다 **지금 찰 수 있는가**와, 못 찬다면 **왜 못 차는가**, 그리고
        **지금 차고 있는가**가 함께 관찰된다.

        사유의 목록을 세계가 소유한다. 화면은 사유를 만들지 않고 받은 것을 옮긴다.
        C020 이 항목마다 세운 사용 가능/사유 자리는 그대로 남고, 그 옆에 장착의 것이
        나란히 선다 — 하나의 항목이 두 물음에 답한다.

## DESIGN TRACE

    INTENT-HOLDING-CHANGES-NOTHING-001
        Source Goal         GOAL-HOLDING-IS-NOT-APPLYING
        Source Possibility  POSSIBILITY-A-USE-COMES-FROM-WHAT-IS-APPLIED
        Master              MC-EQUIP-ITEM · DC-ITEM-HOLDING-IS-NOT-APPLYING (IS §7 P3)

    INTENT-BODY-HAS-PLACES-001
        Source Goal         GOAL-HOLDING-IS-NOT-APPLYING
        Source Possibility  POSSIBILITY-THE-BODY-HAS-PLACES
        Master              IS §5.4 "장착 자리"

    INTENT-PLACE-FIT-001
        Source Goal         GOAL-HOLDING-IS-NOT-APPLYING
        Source Possibility  POSSIBILITY-A-PLACE-TAKES-ONLY-WHAT-FITS
        Master              IS §5.4 "자리 적합성" · DC-ITEM-KIND-IS-DATA-NOT-BRANCH

    INTENT-APPLY-ACT-001
        Source Goal         GOAL-HOLDING-IS-NOT-APPLYING
        Source Possibility  POSSIBILITY-APPLYING-IS-AN-ACT
        Master              IS §5.4 "장착 / 해제" · C020 INTENT-USE-ITEM-001 의 같은 얼개

    INTENT-APPLY-EXCHANGE-001
        Source Goal         GOAL-HOLDING-IS-NOT-APPLYING
        Source Possibility  POSSIBILITY-EXCHANGE-IS-ONE-UNIT
        Master              IS §5.4 "교체" · DC-ITEM-CHANGE-IS-ONE-UNIT

    INTENT-APPLY-CHANGE-IS-ONE-UNIT-001
        Source Goal         GOAL-HOLDING-IS-NOT-APPLYING
        Source Possibility  POSSIBILITY-EXCHANGE-IS-ONE-UNIT
        Master              DC-ITEM-CHANGE-IS-ONE-UNIT (IS §7 P4) ·
                            DC-WORLD-OWNS-THE-SURFACE-LIST

    INTENT-APPLIED-IS-STILL-CARRIED-001
        Source Goal         GOAL-HOLDING-IS-NOT-APPLYING
        Source Possibility  POSSIBILITY-APPLIED-IS-STILL-CARRIED
        Master              IS §5.4 (적용은 소모가 아니다) · C020 INTENT-ITEM-CONSUME-001 과의 경계

    INTENT-EFFECTIVE-ATTRIBUTE-001
        Source Goal         GOAL-WHAT-IS-APPLIED-MAKES-THE-BODY
        Source Possibility  POSSIBILITY-EVERY-JUDGEMENT-READS-THE-EFFECTIVE-VALUE ·
                            POSSIBILITY-THE-BASE-IS-NEVER-TOUCHED
        Master              IS §5.4 "능력치 변경" · MC-ATTACK-POWER 의 결손 ·
                            DC-COMBAT-ONE-FORMULA

    INTENT-RELEASE-RESTORES-EXACTLY-001
        Source Goal         GOAL-WHAT-IS-APPLIED-MAKES-THE-BODY
        Source Possibility  POSSIBILITY-RELEASING-RESTORES-EXACTLY
        Master              DC-ITEM-HOLDING-IS-NOT-APPLYING (IS §8 장착 층 완료 기준)

    INTENT-CAPABILITY-FROM-APPLIED-USE-001
        Source Goal         GOAL-WHAT-IS-APPLIED-MAKES-THE-BODY
        Source Possibility  POSSIBILITY-A-USE-COMES-FROM-WHAT-IS-APPLIED
        Master              DC-ITEM-CAPABILITY-COMES-FROM-GRANTS ·
                            DC-GROWTH-NO-CAPABILITY-DUPLICATION · IS §5.4 "능력 부여"

    INTENT-USE-DOES-NOT-REQUIRE-APPLYING-001
        Source Goal         GOAL-WHAT-IS-APPLIED-MAKES-THE-BODY
        Source Possibility  POSSIBILITY-A-USE-COMES-FROM-WHAT-IS-APPLIED
        Master              DC-ITEM-HOLDING-IS-NOT-APPLYING 의 경계 문장
                            ("소모품을 쓴 결과는 이 원칙의 대상이 아니다")

    INTENT-PLACE-OBSERVE-001
        Source Goal         GOAL-THE-WORLD-SHOWS-WHAT-IS-ON-THE-BODY
        Source Possibility  POSSIBILITY-EACH-PLACE-SHOWS-WHAT-IT-HOLDS
        Master              DC-WORLD-OWNS-THE-SURFACE-LIST · C004 관찰자별 투영

    INTENT-EQUIP-AVAILABILITY-001
        Source Goal         GOAL-THE-WORLD-SHOWS-WHAT-IS-ON-THE-BODY
        Source Possibility  POSSIBILITY-EACH-ITEM-CARRIES-ITS-EQUIP-VERDICT
        Master              DC-WORLD-OWNS-THE-SURFACE-LIST · C020 INTENT-USE-AVAILABILITY-001

## EXISTING INTENT DELTA

    REUSED (그대로 쓴다 — 이 Cycle 이 다시 만들지 않는다)

        INTENT-ITEM-DEFINITION-001          정의가 답한다. 규칙은 종류 이름을 묻지 않는다 (C020)
        INTENT-ITEM-STACKING-001            겹치는 종류는 수량으로 모인다 (C020)
        INTENT-INVENTORY-IS-ONE-CONTRACT-001  가진 것 전부가 하나의 목록이다 (C020)
        INTENT-INVENTORY-SINGLE-CHANNEL-001   수량을 바꾸는 통로는 하나뿐이다 (C020)
        INTENT-USE-ITEM-001                 쓰는 행동의 얼개 (C020)
        INTENT-ITEM-CONSUME-001             소모 여부는 정의가 정한다 (C020)
        INTENT-ITEM-ATOMIC-CHANGE-001       아이템의 변화는 하나의 성공 단위다 (C020)
        INTENT-ACTION-STATE-001             언제나 정확히 하나의 행동 안에 있다 (C002)
        INTENT-ACTION-EXCLUSIVE-001         시작하려면 지금 행동이 대체 가능해야 한다
        INTENT-ACTION-PROGRESS-001          소요 시간을 채우면 완료 효과가 일어난다
        INTENT-HIT-REACTION-001             맞으면 하던 행동이 끊긴다 — 적용도 예외가 아니다
        INTENT-DAMAGE-CALCULATE-001         하나의 피해 공식 (C010)
        INTENT-TYPED-OFFENSE-001            방식이 능력을 고른다 (C012)
        INTENT-PER-OBSERVER-PROJECTION-001  내 몸의 것만 나에게 실린다 (C004)

    CHANGED (의미가 바뀐다)

        INTENT-CAPABILITY-FROM-DECLARED-USE-001 (C020)
            → INTENT-CAPABILITY-FROM-APPLIED-USE-001
            용도를 모으는 출처가 **지닌 것 전부**에서 **적용된 것들**로 좁아진다.
            묻는 말("이 몸에 그 용도가 지금 있는가")은 한 글자도 바뀌지 않는다.

        능력치를 읽는 모든 판정 (C010 · C012 · C013 · C015)
            → 기본값이 아니라 **유효값**을 읽는다 (INTENT-EFFECTIVE-ATTRIBUTE-001).
            공식은 열리지 않는다. 아무것도 적용되지 않은 몸에서는 유효값이 기본값과
            같으므로 기존의 모든 기대값이 그대로 유지되어야 한다.

    AFFECTED (이 변경으로 영향을 받는다 — 함께 검증한다)

        채굴 (C001)                 곡괭이를 지니기만 해서는 캘 수 없게 된다.
                                   기존 플레이가 바뀌는 유일한 지점이다
        INTENT-USE-AVAILABILITY-001 (C020)
                                   곡괭이의 사용 가능 판정이 이제 용도 관문을 만난다 —
                                   차지 않은 곡괭이는 쓸 수 있는 것으로 관찰되지 않는다.
                                   판정의 자리는 그대로이고 답이 달라진다
        INTENT-EFFECT-DELIVER-FORCE-001 (C020)
                                   던지는 돌은 아무 자리도 요구하지 않는다. 그대로 굴러가는지
                                   확인한다 (아이템의 위력은 몸의 능력치를 타지 않으므로
                                   유효값 변경의 영향을 받지 않아야 한다)
        디버그 명령의 능력치 설정 (C009)
                                   기본값을 세우는 길로 남는다. 설정한 뒤 장착하면
                                   그 위에 기여가 얹히고, 풀면 설정한 값으로 돌아온다
