# C013 — Intent

> 이번 Cycle 은 새 피해 공식을 만들지 않는다. 계산 앞에 고르는 단계를 하나 더 세우지도 않는다.
> C012 가 세운 대응 단계는 그대로다 — 방식이 공격 능력 하나와 방어 능력 하나를 고른다.
> 이번에 더해지는 것은 **고른 그 방어가 온전히 버티지 못할 수 있다**는 의미 하나다.
> 지금까지 방어는 값이 곧 버팀이었다. 100 을 올렸으면 언제나 100 만큼 버텼다.
> 이후로는 마주한 자가 무엇을 지녔느냐에 따라 그 100 이 70 으로도 읽힌다.
> 그래서 처음으로 **방어를 올리는 것만으로는 안전이 보장되지 않는다.**

## GOAL / POSSIBILITY

    GOAL-THE-WALL-CAN-BE-DEVALUED   두껍게 굳힌 방어가 언제나 그 값어치대로 지켜주지는 않는다
        └── POSSIBILITY-WEAR-THE-FACING-DEFENSE     마주한 방어만 얼마간 통하지 않게 만든다
        └── POSSIBILITY-SHARE-SCALES-WITH-THICKNESS 걷어내는 몫이 그 방어의 두께를 따라 커진다

    GOAL-DEFENSE-STILL-STANDS       그럼에도 방어는 사라지지 않는다
        └── POSSIBILITY-BOUNDED-WEARING             걷어낼 수 있는 몫에는 끝이 있다
        └── POSSIBILITY-ONLY-FOR-THIS-BLOW          걷힘은 그 한 번의 타격에서만 일어난다

    GOAL-PENETRATION-IS-READABLE    관통이 한 일이 짐작이 아니라 관찰이다
        └── POSSIBILITY-TRACE-THE-WEARING           걷히기 전과 걷힌 뒤가 경위에 함께 실린다
        └── POSSIBILITY-READ-BEFORE-CHOOSING        고르기 전에 내 관통이 이 상대에게 무엇을
                                                    할 수 있는지 보인다

## INTENT SET

    ── 통하지 않게 만드는 능력이 생긴다 ──────────────────────────────

    INTENT-PENETRATION-001 (ADDED)

        세계의 모든 Actor 는 두 가지 관통 능력을 지닌다 —
        상대의 물리 방어를 통하지 않게 만드는 능력과
        상대의 오라 방어를 통하지 않게 만드는 능력이다.
        존재의 종류가 그 두 값을 정하며, 둘이 같을 이유는 없다.
        관통은 그 자체로 아무것도 일으키지 않는다.
        누구의 생명도 줄이지 않고, 자기 피해를 키우지도 않는다 —
        타격이 일어나 방어를 마주할 때에만 작용한다.
        관통이 없다는 것은 세계에 별도의 상태가 아니라 그 값이 0 이라는 것이다.

    INTENT-PENETRATION-MATCH-001 (ADDED)

        한 타격에서 작용하는 관통은 그 타격의 방식이 고른 쪽 하나뿐이다.
        물리로 친 타격은 물리 쪽 관통만 쓰고, 오라로 친 타격은 오라 쪽 관통만 쓴다.
        오라 관통이 아무리 높아도 물리로 친 타격에서는 한 톨도 쓰이지 않으며,
        마주하지 않은 방어에는 닿지 않는다.
        관통은 그 타격의 방식을 바꾸지 못한다 —
        어느 능력과 어느 방어를 읽을지는 여전히 스킬의 방식이 정하고,
        관통은 그 대응이 끝난 뒤에 온다.

    ── 방어가 온전히 버티지 못한다 ────────────────────────────────────

    INTENT-EFFECTIVE-DEFENSE-001 (ADDED)

        타격이 방어를 마주하면, 그 방어 중 관통이 통하지 않게 만든 몫이 걷힌다.
        피해를 줄이는 것은 원래의 방어가 아니라 걷히고 남은 방어다.

        걷히는 것은 정해진 양이 아니라 **몫**이다 —
        같은 관통이라도 두껍게 굳힌 방어에서는 많이 걷히고,
        얇은 방어에서는 적게 걷히며,
        방어가 없는 상대에게서는 걷어낼 것이 없어 아무 일도 일어나지 않는다.
        그래서 관통은 상대에 따라 값이 달라지는 능력이다.

        걷어낼 수 있는 몫에는 끝이 있다.
        관통이 아무리 높아도 방어 전체가 걷히지는 않으며,
        남은 방어는 결코 음수가 되지 않는다 — 방어가 피해를 키우는 일은 세계에 없다.
        그리고 양의 공격 피해는 방어가 아무리 높아도 최소한만큼은 들어간다는 성질이
        관통이 생긴 뒤에도 그대로 유지된다.

        걷힘은 그 한 번의 타격 안에서만 일어난다.
        맞은 자의 방어 능력 자체는 줄어들지 않는다 —
        다음 타격은 다시 온전한 방어를 마주하며, 관통이 없는 자에게는 여전히 그 값 그대로다.

    INTENT-DAMAGE-CALCULATE-001 (CHANGED — 고른 방어가 걷힌 뒤에 계산에 들어간다)

        타격이 일어나면 세계는 지금까지처럼 그 스킬의 방식을 읽고,
        방식에 대응하는 치는 자의 공격 능력과 맞는 자의 방어 능력을 고른다.
        고른 뒤 한 가지가 더해진다 —
        치는 자의 그 방식 관통이 고른 방어에서 자기 몫을 걷어낸다.
        걷히고 남은 방어가 C010 이 세운 그 계산에 들어간다.

        계산은 여전히 하나뿐이다.
        방식마다도, 관통을 지녔는지에 따라서도 다른 계산이 있는 것이 아니다.
        관통이 피해에 별도의 배율을 더하거나 빼지 않는다 —
        차이는 오직 계산에 들어간 방어 값에서만 나온다.
        공격 피해는 관통과 무관하다 — 관통은 때리는 힘이 아니라 상대 방어의 값어치를 떨어뜨린다.
        계산에는 여전히 우연이 개입하지 않는다.
        관통은 방어를 무시할 확률이 아니라 언제나 같은 몫을 걷어내는 값이다.

    ── 걷힌 것이 보인다 ──────────────────────────────────────────────

    INTENT-DAMAGE-BREAKDOWN-001 (CHANGED — 걷히기 전과 걷힌 뒤가 함께 실린다)

        한 번의 타격이 남기는 경위에, 그 방식이 고른 방어가
        **걷히기 전의 값과 걷힌 뒤의 값 둘 다** 실린다.
        그리고 무엇이 그 둘을 갈랐는지 — 작용한 관통이 무엇이고 얼마였는지도 함께 실린다.
        관통이 0 인 타격에서도 이 항목들은 사라지지 않는다.
        걷힌 것이 없다는 사실 역시 관찰이어야 하며,
        보는 이가 두 값이 같은 것을 보고 "이 상대에게는 통하지 않았다" 를 읽을 수 있어야 한다.
        보는 이는 숫자가 왜 그만큼인지를 넘어
        **상대의 방어가 얼마나 통하지 않았는지**까지 읽는다.

    INTENT-PENETRATION-OBSERVE-001 (ADDED)

        세계는 각 존재의 두 관통 능력을 숨기지 않는다.
        나아가 세계는 지금 마주한 상대에 대해 내 관통이 무엇을 할 수 있는지를 밝힌다 —
        C012 가 상대의 두 방어를 견주어 보게 한 그 자리에서,
        그 방어들이 나에게 얼마로 읽히는지가 함께 보인다.
        보는 이가 존재의 이름이나 생김새로, 혹은 피해 숫자의 차이로 관통을 역산하지 않는다.
        치기 전에 무엇이 통할지를 알 수 있어야 고르는 일이 판단이 된다.

## DESIGN TRACE

    INTENT-PENETRATION-001
        Source Goal         GOAL-THE-WALL-CAN-BE-DEVALUED
        Source Possibility  POSSIBILITY-WEAR-THE-FACING-DEFENSE
        Master Trace        MG-OVERCOME-SUPERIOR-OPPONENT / MP-PIERCE-THE-HARD-DEFENSE
                            → MC-PENETRATION
        Constraint          DC-COMBAT-ONE-LAYER-AT-A-TIME (능력 한 쌍으로 끝난다 —
                            스킬별·장비별·조건부 관통을 열지 않는다)
        원본                Design-Combat-OffenseDefense-R0 §14 Penetration
                            (Armor Penetration · Resistance Penetration)

    INTENT-PENETRATION-MATCH-001
        Source Goal         GOAL-THE-WALL-CAN-BE-DEVALUED
        Source Possibility  POSSIBILITY-WEAR-THE-FACING-DEFENSE
        Master Trace        MC-PENETRATION — "마주하지 않은 다른 방어에는 닿지 않는다"
        Constraint          DC-COMBAT-ONE-LAYER-AT-A-TIME (아래 층인 Damage Type 을 침범하지 않는다)
        원본                Design-Combat-DamageType-R0 §15 Penetration
                            ("타입 대응이 끝난 뒤 선택된 방어 능력에만 작용한다 ·
                              관통이 Damage Type 을 바꾸거나 대응하지 않는 방어 능력을
                              읽어서는 안 된다")

    INTENT-EFFECTIVE-DEFENSE-001
        Source Goal         GOAL-THE-WALL-CAN-BE-DEVALUED · GOAL-DEFENSE-STILL-STANDS
        Source Possibility  POSSIBILITY-SHARE-SCALES-WITH-THICKNESS ·
                            POSSIBILITY-BOUNDED-WEARING · POSSIBILITY-ONLY-FOR-THIS-BLOW
        Master Trace        MC-PENETRATION — "방어를 없애지는 못하고, 두껍게 굳힌 상대일수록
                            무력화의 몫이 커진다" · MP-PIERCE-THE-HARD-DEFENSE — "두껍게 굳힌
                            상대일수록 이득이 커지고 무른 상대에게는 거의 의미가 없다"
        Constraint          DC-COMBAT-MATCHUP-SOFT (배율표 없음 · 양의 피해는 최소한만큼 들어간다) ·
                            DC-COMBAT-PLAYER-CAUSALITY (확률이 아니다)
        원본                Design-Combat-OffenseDefense-R0 핵심 원칙
                            (`Penetration → Defense 를 감소시킨다`) ·
                            Design-Combat-DamageType-R0 §15 (Effective Armor / Effective Resistance)
        Note                걷히는 몫의 구체적 형태와 상한 값은 World Semantic 단계가 소유한다.
                            이 Intent 가 요구하는 것은 성질뿐이다 —
                            비례할 것 · 끝이 있을 것 · 음수가 없을 것 · 영구적이지 않을 것

    INTENT-DAMAGE-CALCULATE-001 (CHANGED)
        Source Goal         GOAL-THE-WALL-CAN-BE-DEVALUED
        Source Possibility  POSSIBILITY-WEAR-THE-FACING-DEFENSE
        Constraint          DC-COMBAT-ONE-FORMULA (계산은 여전히 하나다 — 방어 값 하나가 바뀔 뿐) ·
                            DC-COMBAT-PLAYER-CAUSALITY (우연 없음 · 관통은 확률이 아니다) ·
                            DC-COMBAT-MATCHUP-SOFT (관통이 별도 배율이 되지 않는다)
        원본                Design-Combat-OffenseDefense-R0 핵심 원칙 ·
                            Design-Combat-DamageType-R0 §15

    INTENT-DAMAGE-BREAKDOWN-001 (CHANGED)
        Source Goal         GOAL-PENETRATION-IS-READABLE
        Source Possibility  POSSIBILITY-TRACE-THE-WEARING
        Constraint          DC-WORLD-OWNS-THE-SURFACE-LIST (걷힌 값을 밝히는 것은 세계다) ·
                            DC-COMBAT-PLAYER-CAUSALITY (결과의 원인이 관찰된다)
        원본                Design-Combat-DamageType-R0 §10 (계산 경위 관찰) ·
                            Frontier Observable Result ("그 차이가 상대 방어가 얼마나 통하지
                            않았는가로 계산 내역에 설명된다")

    INTENT-PENETRATION-OBSERVE-001
        Source Goal         GOAL-PENETRATION-IS-READABLE
        Source Possibility  POSSIBILITY-READ-BEFORE-CHOOSING
        Master Trace        MK-OPPONENT-DEFENSE-SHAPE — C012 가 세운 이 지식 위에 얹힌다
        Constraint          DC-COMBAT-MATCHUP-SOFT (weakness_is_observable) ·
                            DC-WORLD-OWNS-THE-SURFACE-LIST
        원본                Design-Combat-DamageType-R0 §7-4 · §10

    POSSIBILITY-ONLY-FOR-THIS-BLOW 은 별도 Intent 를 낳지 않는다 —
    INTENT-EFFECTIVE-DEFENSE-001 의 마지막 문단이 그것이며,
    "방어 능력 자체는 줄어들지 않는다" 가 그 전부다.
    지속되는 약화(디버프)는 이 층의 의미가 아니다.

## EXISTING INTENT DELTA

    REUSED
        INTENT-DAMAGE-TYPE-001       스킬이 자기 방식을 지닌다는 것 그대로. 방식은 여전히 둘이고
                                     한 타격은 정확히 하나를 가진다. 관통이 이것을 건드리지 않는다
        INTENT-AURA-SKILL-001        오라 스킬 그대로. 새 스킬을 만들지 않는다
        INTENT-TYPED-OFFENSE-001     두 공격 능력 그대로. 관통은 공격 피해에 관여하지 않는다
        INTENT-VITALITY-001          생명·기력 두 자원 구조 그대로. 관통은 자원을 쓰지 않는다
        INTENT-SKILL-BUDGET-001      기력 수지 그대로
        INTENT-SKILL-COST-GATE-001   기력이 모자라면 시작되지 않는다, 그대로다
        INTENT-SKILL-SCALING-001     기본 피해량과 공격 계수 구조 그대로
        INTENT-ACTION-STATE-001      휘두름은 여전히 하나의 행동이다 — 관통에 새 행동이 없다
        INTENT-ACTION-COLLIDER-001   충돌체 구조 그대로 — 새 명중 판정을 만들지 않는다
        INTENT-BODY-OCCUPY-001       타격 대상 판정 그대로
        INTENT-DOWNED-001            생명이 0 이면 쓰러진다, 그대로다
        INTENT-GUARD-*               막기는 여전히 최종 피해에 걸린다.
                                     막기가 관통을 읽지 않고, 관통이 막기를 뚫지도 않는다 —
                                     두 의미는 계산의 서로 다른 지점에 있다 (01 EXCLUDED)
        INTENT-MODIFIER-COMPOSE-001  배율 합성 그대로. 관통에 배율이 걸리는 자리는 열지 않는다
        INTENT-ATTRIBUTE-MUTATE-001  값을 바꾸는 것은 여전히 세계다. 경로도 판정도 그대로다

    CHANGED
        INTENT-TYPED-DEFENSE-001
            기존  각 방어는 자기 방식의 피해만 줄인다. 방어가 높을수록 같은 만큼 더 올렸을 때
                  줄어드는 폭은 점점 작아진다
            변경  두 성질 모두 그대로다. 좁아지는 것은 하나다 —
                  **피해를 줄이는 것이 그 방어 값 자체가 아니라, 그 타격의 관통이
                  걷어내고 남은 값**이 된다. 관통이 0 인 타격에서는 둘이 완전히 같다.
                  "자기 방식의 피해만 줄인다" 는 대응은 관통 뒤에도 흔들리지 않는다

        INTENT-DAMAGE-CALCULATE-001
            기존  방식이 고른 공격 능력과 방어 능력을 C010 의 계산에 넣는다
            변경  고르는 것과 넣는 것 사이에 걷어내는 일이 하나 놓인다.
                  계산식은 한 줄도 바뀌지 않는다 — 들어가는 방어 값만 달라진다

        INTENT-DAMAGE-BREAKDOWN-001
            기존  방식과, 그 방식이 고른 두 능력의 이름과 값이 실린다
            변경  고른 방어 쪽이 한 값이 아니라 **걷히기 전 · 작용한 관통 · 걷힌 뒤**
                  셋으로 실린다. 공격 쪽은 그대로다

        INTENT-STRIKE-DAMAGE-001
            기존  닿은 몸이 잃는 생명은 그 타격의 방식이 고른 공격 능력과 방어가 정한 최종 피해다
            변경  "방어" 가 "관통이 걷어내고 남은 방어" 로 좁혀진다.
                  결과가 흔들리지 않는다는 성질은 그대로다

    AFFECTED
        INTENT-ATTRIBUTE-OBSERVE-001 관찰되는 속성 목록에 관통 두 종이 더해진다 (네 값 → 여섯 값)
        INTENT-ATTRIBUTE-MUTATE-001  바꿀 수 있는 속성 목록도 같이 늘어난다.
                                     플레이어가 상대의 두 방어를 모두 두껍게 만들어
                                     "피할 무른 쪽이 없는" 상황을 직접 만들고,
                                     자기 관통을 올려 그 벽의 값어치를 떨어뜨려 보는 것이 이 경로다
        INTENT-SELF-OBSERVE-001      자기 정보에 관통 두 값이 실린다
        INTENT-STRIKE-OBSERVE-001    맞은 자리에 드러나는 경위에 걷히기 전·뒤 방어가 더해진다
        INTENT-DAMAGE-TYPE-OBSERVE-001
                                     상대의 두 방어를 견주어 보는 그 자리에,
                                     그 방어가 나에게 얼마로 읽히는지가 함께 보인다.
                                     어느 쪽이 더 단단한가의 판정 자체는 상대의 원래 방어로 하며
                                     관통이 그 판정을 흔들지 않는다 — 그것은 상대의 성질이고,
                                     걷힌 값은 나와 상대 사이의 관계다
        INTENT-NPC-AUTONOMY-001      자율 존재도 같은 계약 아래에 있다 —
                                     자기 관통으로 걷어내고, 자기 방어가 걷힌다.
                                     플레이어와 자율 존재에 서로 다른 관통 규칙을 두지 않는다.
                                     결정 방식 자체는 바뀌지 않는다
        INTENT-WORLD-OBSERVATION-001 관찰되는 세계에 관통 두 값이 더해진다
