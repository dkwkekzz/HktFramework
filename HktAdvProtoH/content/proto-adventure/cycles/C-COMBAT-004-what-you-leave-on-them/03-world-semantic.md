# C-COMBAT-004 — World Semantic

> Intent 열하나를 State 와 Rule 로 닫는다. 새 상태는 **하나다** — 몸에 남은 표식들.
> 그것은 깃발이 아니라 **시각**이므로 지우는 규칙이 세계에 생기지 않는다
> (`guardBrokenUntil` 이 선 자리, 같은 꼴).

## SEMANTIC DELTA

    REUSED
        ABILITY_CIRCUMSTANCES              C-COMBAT-003 — 사정 목록. 항목이 둘 는다
        RULE-ABILITY-REQUIREMENT-001       C-COMBAT-003 — 요구를 재고 사유를 고른다
        RULE-ABILITY-CONDITION-001         C-COMBAT-003 — 참인 조건이 계수를 움직인다.
                                           **대상마다 따로 도는 성질**을 그대로 쓴다
        DamageBreakdown.conditions         C-COMBAT-003 — 참인 사정이 실리는 경위 자리
        World.TargetSelections             C017 — 관찰자별로 고른 존재 하나. **읽기만 한다**
        World.Time                         C001 — 표식이 지금 붙어 있는가를 재는 기준
        RULE-SWING-STRIKE-001 의 접촉 판정    C006 — 무엇이 맞을지는 접촉이 정한다
        RULE-DAMAGE-CALCULATE-001          **한 글자도 바뀌지 않는다**
        guardBrokenUntil / isGuardBroken   C011 — 시각 하나에서 매번 다시 세는 선례

    ADDED
        Actor.Marks                        이 몸에 남은 표식들 — **새 상태는 이것 하나다**
        MARK_DURATION                      표식이 붙어 있는 동안 (세계 상수)
        isMarkedBy                         지금 붙어 있는가 (파생 — 저장하지 않는다)
        SkillDefinition.LeavesMark         이 기술이 닿은 몸에 표식을 남기는가
        SkillKind `mark-strike`            피해가 0 인 기술 하나
        사정 `bears-my-mark`               그 상대에게 내 표식이 있다
        사정 `no-mark-of-mine-yet`         그 상대에게 내 표식이 아직 없다
        RULE-MARK-LEAVE-001                닿은 몸에 표식을 남긴다

    CHANGED
        CircumstanceNow
            ADDED FIELD    시각 (`time`) — 표식이 지금 붙어 있는가를 재려면 필요하다
        AbilityCircumstance 의 물음
            CHANGED        관문에서도 `other` 가 있을 수 있다. **모양은 그대로다** —
                           바뀐 것은 관문이 그것을 채워 넣는다는 사실뿐이다
        RULE-ABILITY-REQUIREMENT-001
            ADDED INPUT    지금 노리는 상대 (없을 수 있다)
        RULE-SKILL-BEGIN-001
            ADDED INPUT    같음 — 관문에 그대로 넘긴다
        RULE-SWING-STRIKE-001
            CHANGED        그 기술이 표식을 남기는 기술이면 RULE-MARK-LEAVE-001 을 부른다
        `hatsu-burst` 의 AmplifiedBy
            ADDED          `bears-my-mark` (+0.5). **요구가 아니라 조건이다** —
                           요구로 걸면 C-COMBAT-003 의 회귀가 깨진다

    AFFECTED
        RULE-ENGAGEMENT-REACHES-001        기술이 하나 늘면 그 기술의 닿는 길이도 검사된다
        RULE-SKILL-PHASE/SHAPE/BUDGET-001  새 기술이 같은 자리를 그대로 지난다
        RULE-HIT-001                       피해 0 인 타격도 피격을 낳는다 (아래 JUDGEMENT ⑤)
        RULE-DEEDS-ADD-001                 피해 0 인 타격도 "친 것" 으로 쌓인다
                                           (C-GROWTH-001 의 판단 그대로 · JUDGEMENT ⑤)
        Observer Projection                존재마다 표식이 실리고 기술 자리가 넷 → 다섯
        Command Catalog                    기술을 부를 자리가 하나 는다
        Spawn                              새 몸은 표식 없이 태어난다

## WORLD STATE

    Actor.Marks                            World Authority
        이 몸에 남은 표식들 — **남긴 자의 Id → 남긴 시각**.

        `guardBrokenUntil`(C011) 과 같은 꼴이다. 담기는 것은 "붙어 있다" 가 아니라
        **언제 남겼는가** 하나이며, 지금 붙어 있는가는 그 시각과 지금 시각에서 매번
        다시 세어진다 (INTENT-THE-MARK-CLOSES-BY-ITSELF-001).

        그래서 **세우는 규칙만 있고 지우는 규칙이 없다.** 표식이 닫히는 데 드는 것은
        시간뿐이며, "표식이 사라졌다" 를 적는 자리도 그 사실을 만드는 규칙도 없다
        (DC-CONDITION-OPENS-WITHOUT-RECORDING · Q61(a)).

        **걸린 쪽에 산다.** 지목(C017)이 관찰자 장부에, 태도(C018)가 지금의 사실에서
        유도되는 것과 다르다 — 표식은 그 몸에 남은 것이므로 그 몸이 지닌다
        (INTENT-A-MARK-RESTS-ON-THE-OTHER-001).

        **쌍마다 하나다.** 같은 자가 같은 대상에게 남긴 표식은 언제나 하나이며 다시
        남기면 그 자리가 새 시각을 갖는다. 다른 자가 남긴 것은 다른 자리이므로,
        한 몸이 여럿에게 표식을 지닐 수 있고 한 자가 여럿에게 남길 수 있다
        (INTENT-MARKS-DO-NOT-PILE-UP-001 · 01 의 물음 ④).

        자리가 늘기만 하고 줄지 않는다 — 그러나 **몸의 수만큼만 는다.** 세계에서
        존재가 사라지는 경로가 아직 0건이므로(C017 08 주①) 이 자리는 자라지 않는다.
        존재를 없애는 개념이 오는 Cycle 이 함께 볼 자리다.

    SkillDefinition.LeavesMark             World Authority (값 — 기술이 지니는 것)
        닿은 몸에 표식을 남기는가. **이름을 묻는 분기를 만들지 않기 위한 값이다**
        (C-COMBAT-003 이 `isSkillKind` 에서 겪은 것과 같은 자리).

    World.AbilityCircumstances             World Authority — 항목이 셋 → 다섯

            bears-my-mark        그 상대에게 **내가 남긴** 표식이 지금 붙어 있다
                                 UnmetReason  no-mark-on-them
                                 읽는 것      Other.Marks[Self.Id] 와 지금 시각

            no-mark-of-mine-yet  그 상대에게 내 표식이 아직 없다
                                 UnmetReason  already-marked-by-them
                                 읽는 것      같음 (뒤집은 답)

        **둘은 서로의 부정이다.** 그래도 두 항목으로 두는 이유는, 사정이 "지금 참인가"
        하나만 답하는 물음이기 때문이다 — 부정을 다루는 문법을 목록에 들이면 그때부터
        판정이 사정의 내용을 알아야 하고, 그러면 "판정은 목록을 읽을 뿐" 이 깨진다
        (INTENT-CIRCUMSTANCES-ARE-A-LIST-001).

    CircumstanceNow                        (CHANGED — 자리가 하나 는다)
        `time` 이 더해진다. World.StrikeEvents 와 마찬가지로 World.Time 에 이름을 맞춰
        두므로 세계 자체가 이 형에 그대로 들어맞는다.

## WORLD RULE

    RULE-MARK-LEAVE-001                                                   (ADDED)
        Implements     INTENT-A-MARK-RESTS-ON-THE-OTHER-001 ·
                       INTENT-MARKS-DO-NOT-PILE-UP-001 ·
                       INTENT-THE-MARK-DOES-NOT-ASK-WHO-DRIVES-001
        Input          남기는 Actor, 남는 Actor, 지금 시각
        Preconditions  없음 — 부르는 자리(RULE-SWING-STRIKE-001)가 이미 접촉과 적대를 쟀다
        Transition     남는 Actor.Marks[남기는 Actor.Id] = 지금 시각
        Result         Left

        이미 그 자리에 값이 있으면 **덮는다** — 둘이 되지 않는다.
        누가 조종하는 몸인지 묻지 않는다.

    RULE-MARK-BORNE-001                                                   (ADDED · 파생)
        Implements     INTENT-THE-MARK-CLOSES-BY-ITSELF-001
        Input          몸, 남긴 자의 Id, 지금 시각
        Preconditions  없음
        Transition     없음 — 세계 상태를 바꾸지 않는다
        Result         Borne | NotBorne

            Borne  ⟺  지금 시각 < Marks[남긴 자] + MARK_DURATION

        `isGuardBroken`(C011) 과 같은 모양의 판정이다. **이 규칙이 있는 한 표식을
        지우는 규칙이 필요하지 않다.**

    RULE-ABILITY-REQUIREMENT-001                                        (CHANGED)
        Implements     (기존 일곱) + INTENT-THE-GATE-SEES-THE-CHOSEN-ONE-001
        Input          Actor, SkillKind, Now, **지금 노리는 상대 (없을 수 있다)**
        Preconditions  없음
        Transition     없음
        Result         Met | Unmet(UnmetReason)

        **차례대로 묻는 것도, 처음 거짓인 것의 사유를 내는 것도 그대로다.**
        바뀐 것은 `other` 가 `null` 로 고정되지 않는다는 사실 하나다.

        상대가 없으면(아무도 고르지 않았다) 상대를 읽는 사정은 거짓이다 —
        모름을 참으로 두지 않는다.

    RULE-SKILL-BEGIN-001                                                (CHANGED)
        Input          Actor, SkillKind, Now, **지금 노리는 상대**
        Preconditions  (그대로 다섯. 넷째가 관문이며 그 입력이 넓어졌다)
        Result         Success | Failure(… | no-mark-on-them | already-marked-by-them | …)

        **관문이 본 상대와 실제로 닿는 몸은 다를 수 있다.** 관문은 걸 수 있는가만
        답하며, 닿은 몸에 무슨 일이 일어나는지는 닿은 뒤에 정해진다
        (INTENT-THE-GATE-SEES-THE-CHOSEN-ONE-001 의 마지막 문단).

    RULE-SWING-STRIKE-001                                               (CHANGED)
        CHANGED        그 기술이 `LeavesMark` 면, 피해를 적용한 뒤 RULE-MARK-LEAVE-001 을
                       **닿은 몸마다** 부른다. 적대가 성립하지 않은 접촉에는 부르지
                       않는다 — 그 자리는 이미 아무 일도 일어나지 않는 자리다 (C018)
        무변경          접촉 판정 · 적대 관문 · 피격 · 밀쳐냄 · 피해 · 기력 수지 · 순서

    RULE-DAMAGE-CALCULATE-001                                          (무변경)
        위력이 0 이면 값이 0 이다. 식은 그대로다 —
        `raw > 0 이면 최소 1` 이 이미 "낼 피해가 없으면 없는 피해를 만들지 않는다" 를
        지니고 있었고, 이 Cycle 이 그 문장에 처음 도달한다.

## BALANCE — 수치와 그 근거

    ① 새 기술 `mark-strike` (표식 남기기)

        피해        **0** — baseDamage 0 · attackRatio 0.
                    이것이 DC-COMBAT-ABILITY-IS-A-RULE 의 실물이다. 1 이라도 넣으면
                    "아주 약한 공격" 이 되고, 그러면 이 기술은 값이 아니라 손해가 된다
        방식        aura — 표식은 오라의 조작이다 (MS-AURA-NEN / OPERATION).
                    피해가 0 이므로 방식이 결과를 가르지 않지만, 경위에 실릴 이름은
                    있어야 한다
        모양·구간·길이 기본 기술과 **같은 값** (0.6초 · 선딜 0.25 · 훑는 각 150° ·
                    닿는 길이 1.3). 자리를 만드는 한 대이므로 크게 걸 이유가 없고,
                    새 값을 지어내면 결과 차이가 표식 때문인지 모양 때문인지 갈리지
                    않는다 (C012 · C-COMBAT-003 이 따른 판단 그대로)
        기력 소모    10 — 기본 기술이 채우는 12 보다 약간 싸다. **한 대를 버려 자리를
                    사는 것**이 이 기술의 값이며, 그 값이 기본 기술 한 대 언저리다
        기력 충전    0 — 아프게 하지 않았으므로 돌아오는 것도 없다 (C007 의 수지 감각)
        요구        `no-mark-of-mine-yet` — 이미 걸어 둔 상대에게는 나가지 않는다.
                    사유는 아래 ③

    ② 표식이 붙어 있는 동안 — 6.0 초

        표식을 걸고(0.6) 발현 일격을 쓰는 데(0.9) 1.5 초가 든다. 6.0 은 그 넷 배쯤이며,
        한 번 자리를 잡으면 **다가가거나 기력을 모을 틈**이 남는다.
        영구가 아니므로 걸린 쪽에게는 물러날 값이 생기고, 건 쪽에게는 쓸 시한이 생긴다.

    ③ 이미 걸린 상대에게 다시 걸 수 없는 사유

        걸어 두고 또 거는 것은 기력만 버리는 일이다. 세계가 그것을 막고 사유를 말하면
        **표식이 자원처럼 읽힌다** — 걸었으면 써야 한다.
        그리고 이 요구가 **관문이 상대를 보는 첫 실물**이다 (C-COMBAT-003 Master Gap ②).
        막지 않으면 표식은 그냥 다시 거는 것이 되고, 관문이 상대를 볼 이유도 사라진다.

    ④ 표식이 `hatsu-burst` 에 보태는 몫 — 0.5

        다른 두 조건(+0.4)보다 크다. **값을 미리 치렀기 때문이다** —
        맞은 것(`struck-by-them`)은 공짜로 참이 되고 다친 것(`life-below-half`)은
        위기의 결과지만, 표식은 한 행동과 기력 10 을 버려 스스로 만든 사실이다.

        같은 배분(hatsu · AuraAtk 64)에서의 값

            사정 없음                 10 + 64×1.3 = 93.2  → ×0.64 = **60**
            표식만                    10 + 64×1.8 = 125.2 → ×0.64 = **80**
            표식 + 생명 절반           10 + 64×2.3 = 157.2 → ×0.64 = **101**
            셋 다                     10 + 64×2.7 = 182.8 → ×0.64 = **117**

        표식 한 대(0.6초 · 기력 10)를 치르고 20 을 더 얻는다. 상대 생명 120 기준으로
        **여섯 대가 다섯 대가 된다** — 치른 값이 한 대 안에서 돌아온다.

    ⑤ 셋 다 참일 때가 세지만 겹침의 규칙은 없다

        117 은 크다. 그러나 그것은 세 사정을 각자 만든 값의 합이며, 함께 참이라는
        사실이 따로 무엇을 더하지 않는다 (INTENT-EACH-CIRCUMSTANCE-STANDS-ALONE-001).
        겹침을 다루는 규칙은 여전히 세계에 없다.

## JUDGEMENT — 01 이 남긴 물음 넷과 그 밖의 판단

    ① 관문이 보는 대상은 어디서 오는가 — **고른 대상**(C017)

       세계가 이미 지닌 것을 읽는다. 새 개념을 만들지 않고, 고르기의 뜻도 바꾸지
       않는다 (INTENT-TARGET-IS-NOT-AIM-001 그대로).

       읽는 자리는 관문을 **부르는 쪽**이다 — 요청을 받는 자리와 투영하는 자리가
       각자 자기가 아는 관찰자로 고른 대상을 찾아 넘긴다. 관문 자신은 "누가 고르고
       있는가" 를 모른다.

       **대가 하나를 정직하게 적는다.** 고른 대상은 관찰자별 장부이고 자율 존재는
       그 장부를 읽지 않는다 (C017). 그러므로 상대를 읽는 요구는 자율 존재에게
       언제나 거짓이다 — 규칙이 조종 주체를 묻는 것이 아니라, 자율 존재가 아직
       고르지 않기 때문이다. C-COMBAT-003 의 Master Gap ① 과 같은 종류의 자리이며
       Stage 8 이 그것을 보고한다.

    ② 표식은 닿은 몸에 남는다

       고른 몸이 아니다. 휘두름의 규율(무엇이 맞을지는 접촉이 정한다 · C002·C006)을
       따른다. 그래서 관문이 본 몸과 표식이 남는 몸이 갈릴 수 있다 —
       **관문은 예고이지 약속이 아니다** (C-COMBAT-003 이 조건 관찰에서 같은 갈림을
       그렇게 다룬 선례 그대로).

       한 휘두름이 둘에게 닿으면 **둘 다에게** 남는다. 표식은 지목이 아니므로
       "하나만" 이라는 규칙을 두지 않는다.

    ③ 요구를 지는 것은 `mark-strike` 자신이다

       새 기술을 하나 더 세우지 않았다. 사유는 셋이다.

           회귀      `hatsu-burst` 에 표식을 **요구**로 걸면 C-COMBAT-003 이 닫은
                     "배분만 갖추면 나간다" 가 깨진다. 조건으로 걸면 깨지지 않는다
           키 자리   글자 키가 `P` 하나 남았다 (C-COMBAT-003 Master Gap ③).
                     이 Cycle 이 그것을 쓰고, 다음 Cycle 은 자리가 없다
           성립      "표식이 걸린 상대에게만 **되는** 일" 은 이 Cycle 에서 조건으로
                     성립한다 (붙은 몸에만 크게 들어간다). 요구로서의 실물은
                     계약·봉인이 세울 자리다 (FR-A-PROMISE-BINDS-BOTH 이후)

    ④ 표식은 여럿 걸릴 수 있다 — 쌍마다 하나

       한 몸이 여러 자에게 표식을 지닐 수 있고, 한 자가 여러 대상에게 남길 수 있다.
       같은 쌍만 하나다. 여럿을 막으면 표식이 사실상 "지목의 다른 이름" 이 되고,
       그러면 후보가 지목과 표식을 가른 성질("내가 다른 곳을 봐도 남아 있다")이
       세계에서 확인되지 않는다.

    ⑤ 피해 0 인 타격도 타격이다

       피격(RULE-HIT-001)도, 밀려남도, 쌓임(RULE-DEEDS-ADD-001)도 그대로 일어난다.
       C-GROWTH-001 이 이미 그렇게 정했다 — "막혀서 0 이 들어가도 친 것은 친 것이다."
       이 Cycle 은 그 문장을 뒤집지 않는다.

       그러므로 표식 한 대는 상대의 선딜을 끊을 수 있고(C019), 그것이 이 기술의
       숨은 값이다 — **의도한 것이며 지어낸 것이 아니다.** 이미 있는 규칙들이
       피해를 묻지 않기 때문에 따라온 결과다.

## OBSERVABLE SEMANTIC

    존재마다 — 무엇이 붙어 있는가 (INTENT-THE-BORNE-IS-SEEN-BY-BOTH-001)

        Actor.Marks (ADDED)           그 몸에 지금 붙어 있는 표식들 — 남긴 자와 남긴 시각.
                                      **가려지지 않는다.** 살펴봄의 관문 뒤에 두지 않는다 —
                                      겨루는 힘이 아니라 그 몸에 일어난 일이며,
                                      태도(C018)·배분(C-COMBAT-001)이 선 자리와 같다.
                                      **닫힌 표식은 실리지 않는다** — 지금의 사실만 나간다

    기술마다 — 쓰기 전에 안다

        Skill.Requires (기존 · 넓어짐)  요구가 **지금 고른 상대에 대해** 갖춰졌는가.
                                      아무도 고르지 않았으면 갖춰지지 않은 것이다
        Skill.Conditions (기존)        표식이 조건인 기술에 항목이 하나 는다
        Skill.FailureReason (기존)     `no-mark-on-them` · `already-marked-by-them`

    한 방마다 — 왜 이만큼이었는가

        Damage.Breakdown.Conditions   (기존) 표식이 참이었으면 그 몫이 실린다

    남긴 일 자체

        피해가 0 인 타격 결과가 그대로 실린다 (StrikeEvent · amount 0). 그리고 그 다음
        관찰에서 **대상에 표식이 생겨 있다.** 둘로 "닿았고 남겼다" 가 읽힌다 —
        남김 전용 사건 목록을 세우지 않는다 (INTENT-LEAVING-IS-OBSERVED-001).

## SEMANTIC CLOSURE

    "표식을 남길 수 있다"                → RULE-MARK-LEAVE-001
    "남긴 자·남은 자·남긴 시각을 지닌다"  → Actor.Marks (Id → 시각)
    "남긴 자가 무엇을 하든 남아 있다"     → 걸린 쪽이 지니므로 거는 쪽의 어떤 상태와도
                                        무관하다
    "그 자체로 아무 일도 하지 않는다"     → 어떤 규칙도 Marks 를 읽어 값을 바꾸지 않는다.
                                        읽는 것은 사정 둘뿐이다
    "매번 다시 세어진다 · 저절로 닫힌다"  → RULE-MARK-BORNE-001. 지우는 규칙 없음
    "피해를 한 톨도 내지 않는 기술"       → `mark-strike` (baseDamage 0 · attackRatio 0)
    "남긴 일이 관찰된다"                 → StrikeEvent(amount 0) + Actor.Marks
    "관문이 지금 노리는 상대를 본다"      → RULE-ABILITY-REQUIREMENT-001 의 새 입력
    "아무도 고르지 않았으면 거짓이다"     → 상대가 없으면 상대를 읽는 사정이 거짓
    "예고이지 약속이 아니다"             → 관문은 고른 몸을, 표식은 닿은 몸을 본다
    "표식은 사정 하나다"                 → ABILITY_CIRCUMSTANCES 의 항목 둘
    "요구가 될 수도 조건이 될 수도 있다"  → `mark-strike.requires` ·
                                        `hatsu-burst.amplifiedBy`
    "조건으로 읽힐 때 맞은 몸의 것이다"   → RULE-ABILITY-CONDITION-001 이 대상마다 돈다
    "가려지지 않는다"                    → 투영이 살펴봄 관문 밖에 둔다
    "차이가 경위에 남는다"               → DamageBreakdown.conditions
    "쌓이지 않는다"                      → 쌍마다 자리 하나. 다시 남기면 덮는다
    "조종 주체를 묻지 않는다"            → RULE-MARK-LEAVE-001 의 Input 에 없다

    닫히지 않은 문장 없음 — GAP 없음.

## REGRESSION — 무엇이 그대로여야 하는가

    표식을 한 번도 걸지 않은 싸움이 C-COMBAT-003 이 닫은 그대로다
        `hatsu-burst` 는 배분만 갖추면 나간다 — 표식은 **조건**이지 요구가 아니다
        기존 넷의 요구·조건·피해·기력 수지·구간·모양·관찰이 값 하나까지 같다
        근거는 검사가 아니라 산술이다 — 표식이 없으면 `bears-my-mark` 가 거짓이고
        거짓인 조건은 계수에 0 을 더한다

    관문이 상대를 받게 넓혔어도 기존 요구는 그대로다
        `power-in-ability` 는 상대를 읽지 않으므로 넘어온 상대가 무엇이든 같은 답이다

    C007 · C010 · C011 · C012 · C013 · C015 · C019 · C020 · C023 · C025 ·
    C-COMBAT-001 · C-COMBAT-003 · C-GROWTH-001 · C-TERRAIN-001 의 시나리오
        피해 공식 · 터짐 · 막기 · 관통 · 유효 값 · 모양 · 쌓임 · 땅 어느 것도
        이 Cycle 이 건드리지 않는다
