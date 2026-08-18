# C013 — World Implementation

> 감쇄식과 상수 100 은 한 글자도 바뀌지 않았다. 바뀐 것은 그 식에 들어가는 값 하나다.
> 걷는 데 쓴 곡선도 새로 만들지 않았다 — `100/(100+x)` 를 방어 값에 적용했을 뿐이다.

## IMPLEMENTED

    PenetrationStatName               world/semantic/combat.ts
                                      'armorPenetration' | 'resistancePenetration'
    DAMAGE_TYPE_STATS.penetration     world/semantic/combat.ts
                                      대응표에 한 칸이 더해진다. 관통도 같은 대응을 따르므로
                                      대응의 **단일 출처**는 여전히 이 표 하나다
    PENETRATION_CONSTANT = 100        world/semantic/combat.ts
                                      DefenseConstant 와 값은 같고 이름은 다르다 —
                                      한쪽을 조정할 때 다른 쪽이 따라 움직이면 안 된다
    penetrationRemainingRatio(pen)    world/semantic/combat.ts
                                      방어가 남기는 비율. 관통 0 이면 1, 아무리 커도 0 이 아니다
    effectiveDefense(def, pen)        world/semantic/combat.ts
                                      걷히고 남은 방어. 반올림하지 않는다 —
                                      보이는 값과 계산에 쓰인 값이 어긋나면 안 된다
    penetrationStatValue(actor, type) world/semantic/combat.ts — 방식이 고르는 관통
    Actor.ArmorPenetration            world/semantic/actor.ts
    Actor.ResistancePenetration       world/semantic/actor.ts
    DamageBreakdown.penetrationStat   world/semantic/combat.ts — 0 이어도 실린다
    DamageBreakdown.effectiveDefense  world/semantic/combat.ts — 감쇄식이 실제로 읽은 값
    RULE-DAMAGE-CALCULATE-001 Step 1  world/rules/damage-calculate.ts

## REUSED

    RULE-DAMAGE-CALCULATE-001 Step 0     world/rules/damage-calculate.ts — 타입 대응 무변경
    RULE-DAMAGE-CALCULATE-001 Step 2~3   식이 한 줄도 바뀌지 않았다. defenseMultiplier 가
                                         받는 인자만 defenseValue → effective 로 바뀐다
    defenseMultiplier(value)             world/semantic/combat.ts — 그대로다.
                                         C012 가 인자를 Actor 에서 값으로 바꿔 둔 덕에
                                         이번 층은 그 함수를 건드리지 않아도 되었다
    DEFENSE_CONSTANT = 100               world/semantic/combat.ts
    하한 1 (raw > 0)                      world/rules/damage-calculate.ts
    defenseShape()                       world/semantic/combat.ts — 걷히기 전 값으로 판정한다
    RULE-SKILL-BEGIN-001 · BUDGET-001    world/rules/skill.ts — 손대지 않았다
    RULE-SWING-STRIKE-001                world/rules/attack.ts — 새 명중 판정 없음
    RULE-GUARD-BLOCK-001                 world/rules/guard.ts — 손대지 않았다.
                                         막기는 관통을 읽지 않고 관통은 막기를 뚫지 않는다
    RULE-NPC-DECIDE-001                  world/rules/npc — 손대지 않았다
    ActionKind · SkillDefinition         새 행동도 새 스킬도 없다

## AFFECTED UPDATED

    CombatSpec 네 값 → 여섯 값            world/semantic/character-catalog.ts
    CHARACTER_CATALOG                    rabbit-swordsman 0/0 · wanderer 60/0 ·
                                         DEFAULT_CHARACTER 는 wanderer 와 같다 (03 BALANCE)
    spawnActor                           world/semantic/spawn.ts — 종류가 정하는 관통 둘
    MUTABLE_ATTRIBUTES                   world/semantic/combat.ts — 12개 → 14개
    MutableAttributeId                   world/semantic/combat.ts
    RULE-ATTRIBUTE-SET-001               world/rules/attribute-set.ts — case 2개.
                                         판정 방식 · 거절 사유 4종 무변경
    protocol/gameview.ts                 AttributesView.combatStats(여섯 값 + 두 배율) ·
                                         AttributesView.versusObserver(신설) ·
                                         DamageBreakdownView.penetrationStat · effectiveDefense ·
                                         TypedStatView 주석(관통 이름 두 개가 더해진다)

## PROJECTION

    entities[].attributes.combatStats    world/projection/observer-view.ts
                                         armorPenetration · resistancePenetration 이 더해진다.
                                         상대의 관통도 실린다 — 내가 얼마나 위험한지를 아는 일이다
    entities[].attributes.versusObserver world/projection/observer-view.ts
                                         effectiveDefense(actor.armor, self.armorPenetration) 과
                                         그 감쇄율. **세계가 계산해 내놓는다** —
                                         View 가 두 수를 곱하지 않는다
                                         (DC-WORLD-OWNS-THE-SURFACE-LIST).
                                         모든 존재에 실린다. 자기 몸에도 실린다
    hud self.combat.armorPenetration     world/projection/observer-view.ts
    hud self.combat.resistancePenetration
    strikes[].breakdown.penetrationStat  StrikeEvent 그대로 통과
    strikes[].breakdown.effectiveDefense StrikeEvent 그대로 통과
    commandCatalog                       world/semantic/command-catalog.ts 무변경 —
                                         MUTABLE_ATTRIBUTES 를 그대로 읽으므로 관통 둘이
                                         코드 수정 없이 목록에 나타난다 (04 COMMAND NOTE 확인)

    04-gameview.spec.yaml 의 delta 항목과 1:1 대응한다. 계약에 새 표면(interaction)은 없다.

## TESTS

    world/tests/penetration.spec.ts  23 tests (신설)
        INTENT-PENETRATION-001          종류가 정하는 관통 둘 · 공격 피해 불변 · 없음 = 값 0
        INTENT-PENETRATION-MATCH-001    물리는 물리 관통만 · 오라는 오라 관통만 ·
                                        관통이 방식을 바꾸지 못한다
        INTENT-EFFECTIVE-DEFENSE-001    몫이다(비율 실측) · 방어 0 이면 아무 일 없음 ·
                                        끝이 있다(관통 100000 에서도 남는다) · 최소 1 ·
                                        계산이 상태를 바꾸지 않는다(두 번째 타격이 첫 번째와 같다)
        INTENT-DAMAGE-CALCULATE-001     같은 raw·같은 상대에서 17 vs 20 (관통만 다르다) ·
                                        두께별 이득 0/2/3 · 걷힌 양 0/11.25/18.75/112.5 ·
                                        5회 반복 동일값(결정론) · 감쇄율이 걷힌 값으로 계산됨
        INTENT-DAMAGE-BREAKDOWN-001     관통 60 타격의 경위 전체 · 관통 0 에서도 두 항목이 실림
        INTENT-PENETRATION-OBSERVE-001  versusObserver 실측 · 관통 0 이면 원래 값과 같음 ·
                                        DefenseShape 가 흔들리지 않음 · hud 에 실림
        REGRESSION                      rabbit-swordsman 의 5개 조합이 C012 값 그대로
                                        (20 · 55 · 14 · 17 · 22) · wanderer 오라 11

    기존 테스트 갱신 (형상 단언 4곳 — 값이 아니라 항목이 늘어난 것이다)
        world/tests/damage.spec.ts       combatStats 두 존재 · breakdown 형상
        world/tests/damage-type.spec.ts  breakdown 물리/오라 · combatStats
        world/tests/combat.spec.ts       attributes 전체 형상(versusObserver 포함) ·
                                         MUTABLE 목록 12 → 14
        world/tests/command.spec.ts      commandCatalog 목록 12 → 14

    world 전체    17 files · 304 tests 통과
    npm run catalog:check    카탈로그 3원소 정합
    npx tsc --noEmit         world/ · protocol/ · server/ 오류 0
                             (view/tests 5건은 View 쪽 fixture 다 — Stage 7 이 닫는다)

## NOTES

    ① 왜 반올림하지 않는가
       effectiveDefense 는 31.25 처럼 정수가 아닌 값이 된다. 반올림하면 관찰에 실리는 수는
       예뻐지지만 계산에 쓰인 값과 어긋나거나(관찰이 거짓이 된다), 방어 1 에 관통이 크면
       0 으로 내려앉아 "방어가 사라졌다" 가 된다. C010 의 defenseMultiplier 도 이미
       정수가 아닌 채 관찰에 실리고 있으므로 선례를 따랐다. 자릿수 정리는 View 의 일이다.

    ② 왜 PENETRATION_CONSTANT 를 따로 두는가
       값은 DEFENSE_CONSTANT 와 같은 100 이다. 그러나 상수를 공유하면 방어 곡선을
       조정할 때 관통 곡선이 조용히 따라 움직인다. 두 곡선은 같은 형태를 쓸 뿐
       같은 손잡이가 아니다.

    ③ 대응표에 관통 칸을 더한 이유
       `if (type === 'physical')` 를 규칙에 하나 더 두는 대신 DAMAGE_TYPE_STATS 를 넓혔다.
       대응의 단일 출처가 둘로 갈라지면, 다음 층이 대응을 또 하나 추가할 때
       두 곳을 고쳐야 한다는 것을 아무도 알려주지 않는다.

    ④ versusObserver 를 모든 존재에 싣는 이유
       자기 몸에 실린 값은 자기 관통으로 자기 방어를 본 것이라 쓸 데가 없다.
       그래도 뺐다면 View 가 "이 존재에는 있고 저 존재에는 없다" 를 다뤄야 하고,
       그 분기는 세계의 의미가 아니라 투영의 사정이 된다 (C011 의 guard 와 같은 판단).

    ⑤ Semantic 에 없는 것을 만들지 않았다
       걷힌 몫(50 - 31.25 = 18.75)을 계산해 싣지 않았다. 두 값이 함께 실리므로
       보는 이가 뺄 수 있고, 세계가 정하는 것은 남는 값이다 (04 OBSERVABLE PROJECTION NOTE).

    GAP 없음.
