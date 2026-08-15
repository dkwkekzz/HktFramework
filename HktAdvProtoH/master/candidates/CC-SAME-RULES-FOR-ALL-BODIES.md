# CC-SAME-RULES-FOR-ALL-BODIES

## CANDIDATE STATEMENT

    세계의 모든 몸은 같은 전투 규칙 아래 있다. 특정 존재만 규칙의 예외를 갖지 않는다.

## OBSERVED REPEATING PATTERN

    원본 문서의 데이터 형태가 이것을 전제한다 (§16.1) —
    hp / cp / defense / armorType / flow / break 는 "Actor" 의 속성이지
    "Player" 의 속성이 아니다. 상대도 Break 되고, 상대도 힘을 몰면 몸이 열린다.

    이 저장소도 이미 같은 형태다.

        C007   hp · cp · moveSpeed · actionSpeed 는 모든 Actor 의 속성이다
               (control 이 player 인지 autonomous 인지와 무관)
        C007   존재 종류(CharacterKind)가 값을 다르게 줄 뿐 규칙은 하나다

    그리고 Possibility 의 대칭성이 여기서 나온다 — 내가 상대의 열린 몸을 때릴 수 있다면
    상대도 내 열린 몸을 때릴 수 있어야 MP-STAKE-EVERYTHING-ON-ONE-BLOW 의 위험이 진짜가 된다.

## AFFECTED NODES

    MA-PLAYER · MA-HOSTILE-COMBATANT
    MC-COMBAT-FLOW · MC-BREAK · MC-GUARD · MC-VOW
    MP-EXPLOIT-OPEN-BODY · MP-STAKE-EVERYTHING-ON-ONE-BLOW

## EXPECTED SCOPE

    COMBAT

## REQUIRES

    same_rules_for_player_and_others    판정 규칙이 존재의 종류로 갈리지 않는다
    values_differ_rules_do_not          종류가 다르면 값이 다를 뿐 규칙은 같다

## PROHIBITS

    actor_specific_rule_exemption       특정 존재만 규칙에서 면제되는 것
    one_sided_vulnerability             한쪽만 열리고 다른 쪽은 열리지 않는 것

## PREFERS

    encounter_difficulty_by_values      난이도를 예외가 아니라 값과 행동으로 만든다

## POTENTIAL CONFLICTS

    **원본 §22 와 정면으로 긴장한다.** 그 절은 Boss Super Armor / Threat 를
    "PvE encounter layer 에서 별도 설계" 로 미뤄 두었다. Super Armor 는 정의상
    "이 존재는 Break 되지 않는다" 이므로 이 후보의 `actor_specific_rule_exemption` 에 걸린다.

    지금은 범위 밖이라 충돌이 드러나지 않지만, 보스를 만드는 순간 둘 중 하나를 골라야 한다.

        (a) 이 후보를 승격한다 → 보스의 강함을 값과 행동으로만 만든다
                                 (Break 가 더 많이 필요하다 / 회복이 빠르다)
        (b) 승격하지 않는다     → 보스가 규칙의 예외를 가질 수 있다

    **지금 정하는 편이 싸다.** 보스를 만든 뒤에 정하면 이미 만든 것을 되돌려야 한다.

## WHY THIS SHOULD BECOME A CONSTRAINT

    MP-STAKE-EVERYTHING-ON-ONE-BLOW 의 위험은 "내가 연 몸을 상대가 실제로 때린다" 는
    보장 위에서만 성립한다. 규칙이 존재마다 다르면 DC-COMBAT-RISK-BUYS-POWER 의
    `risk_is_readable_by_opponent` 가 상대에 따라 참이 되기도 거짓이 되기도 한다.

    즉 이 후보는 이미 승인된 것의 전제를 고정하는 일이다.

## HUMAN DECISION

    PENDING
    Reason
