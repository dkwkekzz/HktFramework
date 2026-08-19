# C015 — Intent

> 이번 Cycle 은 새 피해 공식을 만들지 않는다. 계산 안의 어느 단계도 건드리지 않는다.
> C012 의 대응도, C013 의 걷어내기도, C010 의 감쇄식도 그대로다 —
> 이번에 더해지는 것은 그 계산이 **다 끝나고 내놓은 값**에 얹히는 의미 하나다.
>
> 그리고 그 의미는 지금까지 이 세계에 한 번도 없던 것을 데려온다. **흔들림**이다.
> 지금까지 같은 조건은 언제나 같은 결과였다. 그것이 이 세계의 성질이었고,
> 그래서 플레이어는 자기가 무엇을 받을지 언제나 미리 알 수 있었다.
> 이후로는 한 자리에서만 그것이 깨진다 — 대부분은 여전히 아는 값이 나오고,
> 이따금 아는 값보다 큰 것이 터진다.
>
> 흔들림을 들이는 대가는 셋이다.
> 그 흔들림의 원천이 **세계의 것**이어야 하고, 확률의 양 끝에서는 세계가 **다시
> 결정론으로 돌아와야** 하며, 터진 한 방은 왜 그만큼인지가 **끝까지 읽혀야** 한다.
> 읽히지 않는 흔들림은 우연이 아니라 그냥 설명되지 않는 숫자다.

## GOAL / POSSIBILITY

    GOAL-THE-SAME-BLOW-CAN-BURST    같은 한 방이 언제나 같은 크기는 아니다
        └── POSSIBILITY-CHANCE-DECIDES-THE-BURST    터지는가를 확률이 정한다
        └── POSSIBILITY-BODY-DECIDES-THE-SIZE       얼마나 크게 터지는가는 치는 몸이 정한다

    GOAL-THE-CHANCE-IS-THE-WORLDS   흔들림은 세계의 것이지 밖에서 들어온 것이 아니다
        └── POSSIBILITY-WORLD-OWNS-THE-CHANCE       우연의 원천을 세계가 지닌다
        └── POSSIBILITY-ONE-ROLL-PER-BLOW           한 타격에 판정은 정확히 하나다
        └── POSSIBILITY-DETERMINISM-AT-THE-EDGES    확률의 양 끝에서 세계는 다시 결정론이다

    GOAL-THE-BURST-IS-READABLE      터진 것이 짐작이 아니라 관찰이다
        └── POSSIBILITY-TRACE-THE-BURST             터졌는가·얼마의 확률로·몇 배로·
                                                    커지기 전과 커진 뒤가 경위에 함께 실린다
        └── POSSIBILITY-KNOW-WHO-CAN-BURST          누가 터뜨릴 수 있는 몸인지 살펴보면 안다

    GOAL-THE-BET-CAN-BE-PREPARED    기대값은 준비로 올라간다
        └── POSSIBILITY-RAISE-THE-PROPERTIES        두 성질을 올리면 빈도와 크기가 실제로 달라진다

## INTENT SET

    ── 터뜨릴 수 있는 몸이 생긴다 ────────────────────────────────────

    INTENT-CRITICAL-001 (ADDED)

        세계의 모든 Actor 는 두 가지 Critical 성질을 지닌다 —
        자기 타격이 크게 터질 **가능성의 크기**와, 터졌을 때 얼마나 **커지는가** 다.
        존재의 종류가 그 두 값을 정하며, 둘이 같이 자랄 이유는 없다.

        두 성질은 그 자체로 아무것도 일으키지 않는다.
        누구의 생명도 줄이지 않고, 평소의 피해를 한 톨도 키우지 않으며,
        기력을 쓰지도 벌지도 않는다 — 타격이 일어날 때에만 작용한다.
        터뜨릴 수 없다는 것은 세계에 별도의 상태가 아니라 그 가능성이 0 이라는 것이다.

        두 성질은 치는 자의 것이다.
        맞는 자에게는 이 판정에 관여할 어떤 값도 없다 —
        터지는 것을 줄이거나 막는 성질을 이 층은 세우지 않는다.

    ── 세계가 흔들림을 지닌다 ────────────────────────────────────────

    INTENT-WORLD-CHANCE-001 (ADDED)

        세계는 갈림을 정할 때 쓰는 **자기 몫의 흔들림**을 지닌다.
        그것은 세계 밖에서 매번 새로 들어오는 것이 아니라 세계가 가지고 있는 상태이며,
        쓰일 때마다 나아간다.

        따라서 같은 세계를 같은 순서로 굴리면 언제나 같은 이야기가 나온다.
        흔들림이 생겼다고 해서 세계가 되짚을 수 없는 것이 되지는 않는다 —
        되짚을 수 있으면서도 미리 알 수는 없는 것, 그것이 이 세계가 들이는 우연이다.

        이 흔들림은 세계의 것이다.
        보는 이는 그것을 읽지도, 소비하지도, 되돌리지도 못한다.
        요청으로 흔들림을 다시 굴리는 길은 없다.

        흔들림이 쓰이는 자리는 이번 Cycle 에서 **정확히 하나**다 — Critical 판정이다.
        다른 어떤 판정도 이것을 소비하지 않는다.

    INTENT-CRITICAL-ROLL-001 (ADDED)

        타격이 실제로 대상에게 들어갈 때, 세계는 그 한 방이 크게 터지는지를 한 번 정한다.

        판정은 한 타격에 정확히 한 번이다.
        한 번의 휘두름이 여럿에게 닿으면 맞은 몸마다 따로 정해진다 —
        한 사람에게 터졌다고 옆 사람에게도 터지지 않는다.
        같은 사람에게 두 번 정하지도 않는다.

        판정에 들어가는 것은 치는 자의 그 가능성 하나뿐이다.
        맞는 자의 방어도, 타격의 방식도, 상대와의 거리도, 지금이 몇 시인지도
        이 판정을 바꾸지 않는다.

        가능성이 없으면(0) 결코 터지지 않고, 가능성이 가득하면 언제나 터진다.
        그 두 끝에서 세계는 흔들림을 쓰지 않으며 다시 완전히 결정론적이다 —
        같은 조건이면 언제나 같은 결과가 나온다.

        "몇 번 안 터졌으니 이번엔 터진다" 같은 보정은 없다.
        판정은 지난 타격을 기억하지 않는다.

    ── 터진 한 방이 커진다 ──────────────────────────────────────────

    INTENT-CRITICAL-AMPLIFY-001 (ADDED)

        터진 타격은 그 계산이 내놓은 최종 피해가 치는 자의 증폭 성질만큼 커진다.

        커지는 것은 **계산이 끝난 뒤의 값**이다.
        공격 능력도, 고른 방어도, 걷힌 방어도, 감쇄율도 이 판정에 흔들리지 않는다 —
        같은 두 존재 사이의 계산은 터지든 안 터지든 똑같이 진행되고,
        마지막에 그 결과가 커지거나 커지지 않을 뿐이다.
        터지지 않은 타격은 이 층이 생기기 전과 값이 완전히 같다.

        증폭은 언제나 키우는 쪽이다.
        터진 한 방이 안 터진 한 방보다 작아지는 일은 세계에 없으며,
        양의 피해가 최소한만큼은 들어간다는 성질도 그대로 유지된다.

        커진 값은 **막기가 마주하는 값**이기도 하다.
        크게 터진 한 방은 막아도 더 아프고, 막는 데 더 많은 기력이 든다 —
        막기는 여전히 들어온 것의 같은 몫을 덜어낼 뿐이고 (그 비율은 흔들리지 않는다),
        그 대가는 여전히 덜어내기 전의 크기로 매겨진다.
        그래서 크게 터진 한 방 앞에서는 방어가 더 쉽게 무너진다.
        막기의 규칙은 한 줄도 바뀌지 않았다 — 마주하는 크기가 달라졌을 뿐이다.

    ── 터진 것이 보인다 ─────────────────────────────────────────────

    INTENT-DAMAGE-BREAKDOWN-001 (CHANGED — 터졌는가와 얼마나 커졌는가가 함께 실린다)

        한 번의 타격이 남기는 경위에 네 가지가 더해진다 —
        **터졌는가**, 그때 쓰인 **가능성의 크기**, 적용된 **증폭**,
        그리고 **커지기 전의 값**이다. 커진 뒤의 값은 이미 실려 있다.

        터지지 않은 타격에서도 이 항목들은 사라지지 않는다.
        터지지 않았다는 사실 역시 관찰이어야 하며,
        보는 이가 커지기 전과 뒤가 같은 것을 보고 "이번엔 안 터졌다" 를 읽을 수 있어야 한다.
        가능성이 0 인 자의 타격에서도 그 0 이 실린다 —
        "터질 리 없는 몸" 과 "이번엔 운이 없었다" 는 다른 일이고,
        경위를 읽어 그 둘을 갈라낼 수 있어야 한다.

        보는 이는 숫자가 왜 그만큼인지를 넘어
        **그 숫자가 흔들린 것인지 아닌지**까지 읽는다.

    INTENT-CRITICAL-OBSERVE-001 (ADDED)

        세계는 각 존재의 두 Critical 성질을 밝힌다.
        자기 것은 언제나 보인다 — 성질을 바꾼 직후 그 변화가 즉시 읽혀야
        빈도와 크기가 달라지는 것을 자기 눈으로 확인할 수 있다.

        남의 것은 겨루는 힘이므로 살펴본 뒤에 보인다.
        살펴봄이 여는 자리가 넓어질 뿐, 가리는 관문이 새로 생기지 않는다 —
        상대의 공격력·방어·관통을 여는 그 한 번이 Critical 성질도 함께 연다.
        모르는 상대가 얼마나 자주 크게 터뜨리는 몸인지는 알 수 없고,
        그것을 아는 것은 내가 얼마나 위험한지를 아는 일이다.

        다만 **이미 벌어진 타격의 결과**는 그 관문 뒤가 아니다.
        타격의 경위는 세계가 판정을 마치고 내놓은 사실이며 지금까지대로 드러난다 —
        모르는 상대에게 크게 터졌다는 것은 보인다.
        보는 이가 피해 숫자가 튄 것을 보고 Critical 을 역산하지 않아도 되며,
        얼마의 가능성으로 그랬는지는 여전히 살펴봐야 안다.

    INTENT-ATTRIBUTE-MUTATE-001 (CHANGED — 바꿀 수 있는 성질에 Critical 둘이 더해진다)

        세계가 허용할 때 바꿀 수 있는 성질의 목록에 Critical 두 성질이 더해진다.
        가능성은 없음과 가득함 사이의 값이고, 증폭은 키우는 쪽으로만 열린다 —
        둘 다 세계가 그 허용 범위를 함께 밝힌다.

        이것이 이번 Cycle 에서 기대값을 준비로 올리는 경로다.
        가능성을 가득하게 두면 매번 터지고, 없음으로 두면 한 번도 터지지 않으며,
        그 두 끝을 직접 만들어 보는 것이 "이 세계에 흔들림이 정확히 한 자리에만
        있다" 를 눈으로 확인하는 길이다.

## DESIGN TRACE

    INTENT-CRITICAL-001
        Source Goal         GOAL-THE-SAME-BLOW-CAN-BURST
        Source Possibility  POSSIBILITY-BODY-DECIDES-THE-SIZE
        Master Trace        MG-OVERCOME-SUPERIOR-OPPONENT / MP-BET-ON-THE-CRITICAL-BLOW
                            → MC-CRITICAL-STRIKE — "발생 확률과 증폭 크기는 Actor 의 성질"
        Constraint          DC-COMBAT-ONE-LAYER-AT-A-TIME (성질 한 쌍으로 끝난다 —
                            스킬별·장비별·조건부 Critical 을 열지 않는다)
        원본                Design-Combat-OffenseDefense-R0 §14 C011
                            (Critical Chance · Critical Damage)

    INTENT-WORLD-CHANCE-001
        Source Goal         GOAL-THE-CHANCE-IS-THE-WORLDS
        Source Possibility  POSSIBILITY-WORLD-OWNS-THE-CHANCE
        Constraint          DC-COMBAT-PLAYER-CAUSALITY (REVISED — 예외는 Critical 하나뿐이고,
                            그 예외조차 세계가 소유한 상태에서 나온다) ·
                            DC-WORLD-OWNS-THE-SURFACE-LIST (흔들림도 세계의 것이다)
        원본                Q11(b) Human 결정 2026-08-19 ("확률 Critical 허용 —
                            그 경우에도 발생 확률과 증폭 결과는 관찰로 읽을 수 있어야 한다")
        Note                흔들림의 구체적 형태(무엇이 상태이고 어떻게 나아가는가)는
                            World Semantic 단계가 소유한다. 이 Intent 가 요구하는 것은
                            성질뿐이다 — 세계의 것일 것 · 나아갈 것 · 되짚을 수 있을 것 ·
                            밖에서 건드릴 수 없을 것 · 한 자리에서만 쓰일 것

    INTENT-CRITICAL-ROLL-001
        Source Goal         GOAL-THE-SAME-BLOW-CAN-BURST · GOAL-THE-CHANCE-IS-THE-WORLDS
        Source Possibility  POSSIBILITY-CHANCE-DECIDES-THE-BURST ·
                            POSSIBILITY-ONE-ROLL-PER-BLOW ·
                            POSSIBILITY-DETERMINISM-AT-THE-EDGES
        Master Trace        MC-CRITICAL-STRIKE — "공격이 확률적으로 더 크게 증폭되어 터진다"
        Constraint          DC-COMBAT-PLAYER-CAUSALITY (REVISED — random_hit · random_evade ·
                            random_damage 는 여전히 금지다. 흔들리는 것은 "터졌는가" 하나다.
                            deterministic_resolution_under_same_state 는 확률의 양 끝에서
                            그대로 성립한다)
        원본                Design-Combat-OffenseDefense-R0 §6 (RNG 없음 — 이 층이 여는
                            단일 예외의 경계를 정하는 문장이다) · §14 C011

    INTENT-CRITICAL-AMPLIFY-001
        Source Goal         GOAL-THE-SAME-BLOW-CAN-BURST
        Source Possibility  POSSIBILITY-BODY-DECIDES-THE-SIZE
        Master Trace        MP-BET-ON-THE-CRITICAL-BLOW — "같은 교환에서 이따금 상한을 넘는
                            결과가 터진다"
        Constraint          DC-COMBAT-ONE-FORMULA (`Critical → Final Damage 를 증폭한다` —
                            새 공식도, 계산 안의 새 단계도 만들지 않는다) ·
                            DC-COMBAT-ONE-LAYER-AT-A-TIME (막기의 규칙을 바꾸지 않는다 —
                            마주하는 크기만 달라진다)
        원본                Design-Combat-OffenseDefense-R0 핵심 원칙
                            (`Critical → Final Damage 를 증폭한다` ·
                             `Guard → Final Damage 를 감소시킨다`)
        Note                증폭의 구체적 형태와 값, 그리고 증폭과 막기의 순서가 낳는
                            수치는 World Semantic 단계가 소유한다. 이 Intent 가 요구하는
                            것은 성질뿐이다 — 계산 뒤에 올 것 · 언제나 키울 것 ·
                            막기가 그 커진 값을 마주할 것 · 막기의 비율과 대가 규칙 자체는
                            건드리지 않을 것

    INTENT-DAMAGE-BREAKDOWN-001 (CHANGED)
        Source Goal         GOAL-THE-BURST-IS-READABLE
        Source Possibility  POSSIBILITY-TRACE-THE-BURST
        Constraint          DC-COMBAT-PLAYER-CAUSALITY (explainable_result — REVISED 가
                            Critical 발생 여부·증폭까지 포함하도록 강화했다) ·
                            DC-WORLD-OWNS-THE-SURFACE-LIST (터졌음을 밝히는 것은 세계다)
        원본                Design-Combat-DamageType-R0 §10 (계산 경위 관찰) ·
                            Frontier Observable Result ("그 타격의 계산 내역에
                            Critical 여부·배율이 찍히며")

    INTENT-CRITICAL-OBSERVE-001
        Source Goal         GOAL-THE-BURST-IS-READABLE
        Source Possibility  POSSIBILITY-KNOW-WHO-CAN-BURST
        Master Trace        MC-CRITICAL-STRIKE — "Critical 발생 여부와 그 증폭은 계산 경위에
                            그대로 드러난다" · Frontier Constraint Eval — "Critical 성질
                            (확률·증폭)을 세계가 관찰에 싣는다 (SURFACE-LIST)"
        Constraint          DC-WORLD-OWNS-THE-SURFACE-LIST ·
                            DC-COMBAT-PLAYER-CAUSALITY (observable_cause)
        원본                Design-Combat-DamageType-R0 §7-4 · §10
        Note                남의 것이 살펴봄 뒤에 놓이는 것은 C014 가 세운 규칙을 그대로
                            따르는 것이다 (01 SCOPE NOTE 3). 새 관문을 만들지 않는다

    INTENT-ATTRIBUTE-MUTATE-001 (CHANGED)
        Source Goal         GOAL-THE-BET-CAN-BE-PREPARED
        Source Possibility  POSSIBILITY-RAISE-THE-PROPERTIES
        Master Trace        MP-BET-ON-THE-CRITICAL-BLOW — "준비로 기대값을 올리되 개별 결과는
                            확률이 정한다". 그 준비의 원천(성장·장비)은 이번 Cycle 의 결손이
                            아니다 (01 SCOPE NOTE 4)
        Constraint          DC-WORLD-OWNS-THE-SURFACE-LIST (목록과 허용 범위는 세계의 것)
        원본                Frontier Observable Result ("Critical 성질을 올리면 빈도·크기가
                            달라지는 것이 보인다")

    POSSIBILITY-DETERMINISM-AT-THE-EDGES 는 별도 Intent 를 낳지 않는다 —
    INTENT-CRITICAL-ROLL-001 의 네 번째 문단이 그것이며,
    "두 끝에서는 흔들림을 쓰지 않는다" 가 그 전부다.
    확률을 우회하는 별도의 결정론 모드를 세우는 것이 아니다.

## EXISTING INTENT DELTA

    REUSED
        INTENT-DAMAGE-TYPE-001       스킬이 자기 방식을 지닌다는 것 그대로. Critical 은
                                     방식을 읽지 않으며 방식마다 다르게 터지지도 않는다
        INTENT-TYPED-OFFENSE-001     두 공격 능력 그대로. 증폭은 공격 능력을 키우지 않는다
        INTENT-TYPED-DEFENSE-001     두 방어 그대로. 증폭은 방어를 깎지 않는다 —
                                     그것은 아래층(관통)의 의미다
        INTENT-PENETRATION-001       관통 그대로. 걷어내기는 계산 안이고 증폭은 계산 밖이다
        INTENT-PENETRATION-MATCH-001 관통 대응 그대로
        INTENT-EFFECTIVE-DEFENSE-001 걷힌 방어 그대로 — 증폭이 이 값에 닿지 않는다
        INTENT-SKILL-SCALING-001     기본 피해량과 공격 계수 구조 그대로
        INTENT-AURA-SKILL-001        오라 스킬 그대로. 새 스킬을 만들지 않는다
        INTENT-VITALITY-001          생명·기력 두 자원 구조 그대로. Critical 은 자원을 쓰지 않는다
        INTENT-SKILL-BUDGET-001      기력 수지 그대로
        INTENT-SKILL-COST-GATE-001   기력이 모자라면 시작되지 않는다, 그대로다
        INTENT-ACTION-STATE-001      휘두름은 여전히 하나의 행동이다 — Critical 에 새 행동이 없다
        INTENT-ACTION-COLLIDER-001   충돌체 구조 그대로 — 닿았으면 맞는다는 규칙은 그대로다
                                     (명중·회피에 흔들림을 들이지 않는다)
        INTENT-BODY-OCCUPY-001       타격 대상 판정 그대로
        INTENT-HIT-REACTION-001      피격 반응 그대로 — 크게 터졌다고 다른 반응이 나오지 않는다
        INTENT-DOWNED-001            생명이 0 이면 쓰러진다, 그대로다
        INTENT-GUARD-STANCE-001      막기를 드는 일 그대로
        INTENT-GUARD-DIRECTION-001   막히는 방향 그대로 — Critical 이 방향을 무시하지 않는다
        INTENT-GUARD-MITIGATE-001    막기가 남기는 **비율**은 흔들리지 않는다.
                                     달라지는 것은 그 비율이 걸리는 크기뿐이다
        INTENT-GUARD-COST-001        대가를 덜어내기 전 값으로 매긴다는 규칙 그대로.
                                     그 값이 커질 수 있게 되었을 뿐이다
        INTENT-OBSERVE-001           살펴봄이라는 행동 그대로 — 새 행동을 만들지 않는다
        INTENT-OBSERVE-KNOWLEDGE-001 앎의 장부 그대로. 담는 것은 여전히 Id 뿐이다
        INTENT-UNSEEN-IS-OBSERVABLE-001
                                     가려진 항목의 이름 목록 그대로 (셋에서 늘지 않는다)
        INTENT-MODIFIER-COMPOSE-001  배율 합성 그대로. Critical 에 배율이 걸리는 자리는 열지 않는다
        INTENT-NPC-AUTONOMY-001      자율 존재의 판단 그대로 — Critical 을 노리고 고르지 않는다
        INTENT-WORLD-CLOCK-001       세계 시각 그대로. 판정의 입력에 시각이 들어가지 않는다

    CHANGED
        INTENT-DAMAGE-CALCULATE-001
            기존  방식이 고른 공격 능력과, 관통이 걷어내고 남은 방어를 C010 의 계산에 넣는다.
                  계산에는 우연이 개입하지 않는다
            변경  **계산 자체는 한 줄도 바뀌지 않는다.** 이 계산은 여전히 흔들림을 모르고,
                  같은 두 존재·같은 스킬이면 언제나 같은 값을 내놓는다.
                  달라지는 것은 그 값이 최종이 아니게 된다는 것뿐이다 —
                  이 계산이 내놓은 값 위에 판정 하나가 더 있다

        INTENT-STRIKE-DAMAGE-001
            기존  닿은 몸이 잃는 생명은 계산이 낸 최종 피해에 막기를 거친 값이다
            변경  계산과 막기 사이에 판정 하나가 놓인다 —
                  터진 타격은 계산이 낸 값이 커진 채로 막기를 마주한다.
                  터지지 않은 타격의 값은 이 층이 생기기 전과 완전히 같다

        INTENT-DAMAGE-BREAKDOWN-001
            기존  방식·고른 두 능력·걷히기 전과 뒤의 방어·감쇄율·최종 피해가 실린다
            변경  터졌는가 · 쓰인 가능성 · 적용된 증폭 · 커지기 전의 값 넷이 더해진다.
                  기존 항목의 의미는 하나도 바뀌지 않는다 —
                  최종 피해는 여전히 "막지 않았다면 들어왔을 값" 이고, 이제 그것이
                  커진 값이다

        INTENT-ATTRIBUTE-MUTATE-001
            기존  바꿀 수 있는 성질의 목록과 각자의 허용 범위를 세계가 밝힌다
            변경  목록에 Critical 두 성질이 더해진다. 규칙도 경로도 그대로다

        INTENT-UNSEEN-CAPABILITY-001
            기존  남의 겨루는 힘은 살펴본 뒤에만 관찰에 실린다
            변경  그 "겨루는 힘" 이 덮는 값에 Critical 두 성질이 들어온다.
                  관문도, 여는 행동도, 가려진 항목의 이름도 그대로다 —
                  한 번의 살펴봄이 여는 자리가 넓어질 뿐이다

    AFFECTED
        INTENT-ATTRIBUTE-OBSERVE-001 관찰되는 속성 목록에 Critical 두 성질이 더해진다
                                     (여섯 값 → 여덟 값)
        INTENT-SELF-OBSERVE-001      자기 정보에 Critical 두 값이 실린다.
                                     바꾼 직후 즉시 확인되어야 한다
        INTENT-STRIKE-OBSERVE-001    맞은 자리에 드러나는 경위에 터졌는가와 증폭이 더해진다.
                                     이것은 살펴봄 관문 뒤가 아니다 — 이미 벌어진 사실이다
        INTENT-DAMAGE-TYPE-OBSERVE-001
                                     어느 쪽이 더 단단한가의 판정은 그대로다.
                                     Critical 은 방어를 읽지 않으므로 이 판정을 흔들지 않는다
        INTENT-GUARD-BREAKDOWN-001   막기가 한 일의 경위에 실리는 값들이 커진 값 기준이 된다.
                                     막아서 덜 들어간 값도, 치른 기력도 그 크기를 따라간다
        INTENT-GUARD-COLLAPSE-001    크게 터진 한 방 앞에서 방어가 더 쉽게 무너진다.
                                     무너지는 조건(기력이 모자란다)은 한 줄도 바뀌지 않았다 —
                                     마주하는 크기가 달라졌을 뿐이다
        INTENT-GUARD-IMPACT-KEPT-001 막기가 지켜 낸 것의 의미 그대로. 크기만 커질 수 있다
        INTENT-NPC-AUTONOMY-001      자율 존재도 같은 규칙 아래에 있다 —
                                     자기 성질로 터뜨리고, 자기가 맞을 때도 같은 판정이 돈다.
                                     플레이어와 자율 존재에 서로 다른 Critical 규칙을 두지 않는다
        INTENT-WORLD-OBSERVATION-001 관찰되는 세계에 Critical 두 값이 더해진다.
                                     세계가 지닌 흔들림 자체는 관찰에 실리지 않는다 —
                                     그것을 실으면 다음에 터질지가 미리 읽힌다
        INTENT-COMMAND-CATALOG-001   명령 카탈로그가 세계의 목록을 그대로 따르므로
                                     Critical 두 성질이 자동으로 명령의 대상이 된다
