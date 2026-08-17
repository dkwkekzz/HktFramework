# C012 — Intent

> 이번 Cycle 은 새 피해 공식을 만들지 않는다. C010 이 세운 하나의 계산은 그대로 두고,
> 그 계산에 **무엇을 넣을지 고르는 단계**를 앞에 세운다.
> 지금은 누구에게나 공격 능력 하나·방어 능력 하나뿐이라 고를 것이 없다.
> 이후로는 스킬이 자기 피해 방식을 가지고, 그 방식이 양쪽에서 읽을 능력을 정한다.
> 그래서 처음으로 **때리기 전에 무엇으로 때릴지가 결과를 가른다.**

## GOAL / POSSIBILITY

    GOAL-ATTACK-FORM-MATTERS        같은 세기로 때려도 무엇으로 때렸는지에 따라
                                    상대가 받는 피해가 달라진다
        └── POSSIBILITY-TWO-DAMAGE-FORMS   피해를 만드는 방식이 두 갈래로 갈린다
        └── POSSIBILITY-CHOOSE-THE-FORM    치는 자가 그중 하나를 골라 친다

    GOAL-DEFENSE-IS-NOT-ONE-WALL    방어는 모든 것을 똑같이 막는 하나의 벽이 아니다
        └── POSSIBILITY-TYPED-ABSORB       각 방어 능력은 자기 몫의 피해만 줄인다
        └── POSSIBILITY-UNEVEN-DEFENSE     존재마다 두 방어가 고르지 않게 자란다

    GOAL-WEAKNESS-IS-READABLE       어느 쪽으로 때려야 유리한지가 짐작이 아니라 관찰이다
        └── POSSIBILITY-READ-DEFENSE-SHAPE 상대의 두 방어를 견주어 볼 수 있다
        └── POSSIBILITY-TRACE-THE-CHOICE   한 방이 어느 능력과 어느 방어로 계산되었는지 읽힌다

## INTENT SET

    ── 피해에 방식이 생긴다 ──────────────────────────────────────────

    INTENT-DAMAGE-TYPE-001 (ADDED)

        피해를 만드는 모든 스킬은 자기가 어떤 방식으로 피해를 만드는지를 지닌다.
        방식은 둘뿐이다 — 몸과 무기가 부딪쳐 만드는 물리와,
        비물질적인 힘이 만드는 오라다.
        한 번의 타격은 정확히 하나의 방식만 가진다 —
        절반은 물리이고 절반은 오라인 타격은 세계에 없다.
        방식은 스킬이 지닌 성질이다.
        치는 자의 상태도 맞는 자의 상태도 타격의 순간에 그 방식을 바꾸지 못한다.

    INTENT-AURA-SKILL-001 (ADDED)

        세계에는 오라 방식으로 피해를 만드는 스킬이 적어도 하나 존재한다.
        그것이 없으면 방식이 둘이라는 말은 세계에 실재하지 않는다 —
        고를 수 있는 것이 하나뿐이면 고르는 일이 일어나지 않기 때문이다.
        그 스킬은 기존 스킬과 같은 구조를 지닌다 —
        시작 조건도, 기력 수지도, 휘두름이 몸에 닿는 방식도 다르지 않다.
        다른 것은 그것이 만드는 피해의 방식뿐이다.

    ── 능력이 둘로 갈린다 ────────────────────────────────────────────

    INTENT-TYPED-OFFENSE-001 (ADDED — INTENT-ATTACK-POWER-001 을 대신한다)

        세계의 모든 Actor 는 두 가지 공격 능력을 지닌다 —
        물리 방식의 피해를 키우는 능력과 오라 방식의 피해를 키우는 능력이다.
        존재의 종류가 그 두 값을 정하며, 둘이 같을 이유는 없다.
        각 능력은 자기 방식의 스킬에만 기여한다 —
        오라 공격 능력이 아무리 높아도 물리 스킬의 피해는 한 톨도 커지지 않는다.
        능력은 여전히 그 자체로 아무것도 일으키지 않는다. 스킬을 통해서만 피해가 된다.

    INTENT-TYPED-DEFENSE-001 (ADDED — INTENT-DEFENSE-001 을 대신한다)

        세계의 모든 Actor 는 두 가지 방어 능력을 지닌다 —
        물리 방식의 피해를 줄이는 능력과 오라 방식의 피해를 줄이는 능력이다.
        존재의 종류가 그 두 값을 정하며, 둘이 같을 이유는 없다.
        각 방어는 자기 방식의 피해만 줄인다 —
        물리 방어가 아무리 높아도 오라로 온 피해는 한 톨도 줄지 않는다.
        두 방어 모두 피해를 줄일 뿐 없애지 못한다.
        그리고 값이 높아질수록 같은 만큼 더 올렸을 때 줄어드는 폭은 점점 작아진다 —
        이 성질은 두 방어에서 똑같다.

    ── 하나의 계산, 달라진 입력 ──────────────────────────────────────

    INTENT-DAMAGE-CALCULATE-001 (CHANGED — 계산 앞에 고르는 단계가 선다)

        타격이 일어나면 세계는 먼저 그 스킬의 피해 방식을 읽고,
        그 방식에 대응하는 치는 자의 공격 능력과 맞는 자의 방어 능력을 고른다.
        고른 두 값을 C010 이 세운 그 계산에 넣는다 —
        스킬의 기본 피해량에 고른 공격 능력이 공격 계수만큼 더해져 공격 피해가 나오고,
        고른 방어 능력이 그것을 줄여 최종 피해가 나온다.
        세계에는 여전히 이 계산 하나뿐이다.
        방식마다 다른 계산이 있는 것이 아니라, 하나의 계산이 방식에 따라 다른 값을 받는다.
        방식이 피해에 별도의 배율을 더하거나 빼지 않는다 —
        차이는 오직 고른 두 능력의 값에서만 나온다.
        계산에는 우연이 개입하지 않는다.
        오라 방어는 피해를 막아낼 확률이 아니라 언제나 같은 정도로 줄이는 값이다.

    ── 고른 것이 보인다 ──────────────────────────────────────────────

    INTENT-DAMAGE-BREAKDOWN-001 (CHANGED — 무엇을 골랐는지가 경위에 실린다)

        한 번의 타격이 남기는 경위에 그 타격의 피해 방식이 함께 실린다.
        그리고 그 방식이 고른 것이 무엇이었는지도 실린다 —
        어느 공격 능력을 얼마의 값으로 읽었고, 어느 방어 능력을 얼마의 값으로 읽었는지다.
        보는 이는 숫자가 왜 그만큼인지를 넘어
        **왜 저쪽이 아니라 이쪽 능력으로 계산되었는지**까지 읽는다.

    INTENT-DAMAGE-TYPE-OBSERVE-001 (ADDED)

        세계는 각 존재의 두 공격 능력과 두 방어 능력을 숨기지 않는다.
        상대의 두 방어는 견주어 볼 수 있어야 한다 —
        어느 쪽이 더 단단한지를 세계가 밝힌다.
        보는 이가 존재의 이름이나 생김새로 약점을 짐작하지 않는다.
        각 스킬이 어떤 방식인지도 세계가 밝힌다.
        고르는 일이 가능하려면 고를 것들의 성질이 먼저 보여야 한다.

## DESIGN TRACE

    INTENT-DAMAGE-TYPE-001
        Source Goal         GOAL-ATTACK-FORM-MATTERS
        Source Possibility  POSSIBILITY-TWO-DAMAGE-FORMS
        Constraint          DC-COMBAT-ONE-LAYER-AT-A-TIME (방식은 둘뿐 · 혼합 없음)
        원본                Design-Combat-DamageType-R0 §1 · §3 · §11

    INTENT-AURA-SKILL-001
        Source Goal         GOAL-ATTACK-FORM-MATTERS
        Source Possibility  POSSIBILITY-CHOOSE-THE-FORM
        근거                01-cycle.md SCOPE NOTE — 이행만으로는 고를 것이 하나뿐이다
        원본                Design-Combat-DamageType-R0 §9 (오라 초기값은 새 오라 콘텐츠와 함께)

    INTENT-TYPED-OFFENSE-001
        Source Goal         GOAL-ATTACK-FORM-MATTERS
        Source Possibility  POSSIBILITY-TWO-DAMAGE-FORMS
        원본                Design-Combat-DamageType-R0 §2 · §11

    INTENT-TYPED-DEFENSE-001
        Source Goal         GOAL-DEFENSE-IS-NOT-ONE-WALL
        Source Possibility  POSSIBILITY-TYPED-ABSORB · POSSIBILITY-UNEVEN-DEFENSE
        원본                Design-Combat-DamageType-R0 §2 · §11

    INTENT-DAMAGE-CALCULATE-001 (CHANGED)
        Source Goal         GOAL-ATTACK-FORM-MATTERS · GOAL-DEFENSE-IS-NOT-ONE-WALL
        Source Possibility  POSSIBILITY-TYPED-ABSORB
        Constraint          DC-COMBAT-ONE-FORMULA (계산은 여전히 하나다 — 입력만 고른다) ·
                            DC-COMBAT-PLAYER-CAUSALITY (우연 없음 · 저항은 확률이 아니다) ·
                            DC-COMBAT-MATCHUP-SOFT (DRAFT — 상성은 배율이 아니라 값의 차이다)
        원본                Design-Combat-DamageType-R0 §4 · §5 · §7 · §8

    INTENT-DAMAGE-BREAKDOWN-001 (CHANGED)
        Source Goal         GOAL-WEAKNESS-IS-READABLE
        Source Possibility  POSSIBILITY-TRACE-THE-CHOICE
        Constraint          DC-COMBAT-PLAYER-CAUSALITY (결과의 원인이 관찰된다)
        원본                Design-Combat-DamageType-R0 §10

    INTENT-DAMAGE-TYPE-OBSERVE-001
        Source Goal         GOAL-WEAKNESS-IS-READABLE
        Source Possibility  POSSIBILITY-READ-DEFENSE-SHAPE
        Constraint          DC-WORLD-OWNS-THE-SURFACE-LIST (약점을 밝히는 것은 세계다)
        원본                Design-Combat-DamageType-R0 §10 · §16.3-1 · §16.3-6

    POSSIBILITY-UNEVEN-DEFENSE 는 새 Intent 를 낳지 않는다 —
    INTENT-TYPED-DEFENSE-001 의 "둘이 같을 이유는 없다" 와 종류별 값 분포가 그것이며,
    실제 값은 World Semantic 단계의 Balance 가 소유한다.

## EXISTING INTENT DELTA

    REUSED
        INTENT-VITALITY-001          생명·기력 두 자원 구조 그대로. 새 자원은 없다
        INTENT-SKILL-BUDGET-001      기력 수지는 피해 방식과 무관하게 지금 그대로 돈다
        INTENT-SKILL-COST-GATE-001   기력이 모자라면 시작되지 않는다, 그대로다
        INTENT-SKILL-SCALING-001     스킬이 기본 피해량과 공격 계수를 가진다는 것 그대로다.
                                     이번에 더해지는 것은 그 계수가 **어느** 공격 능력에
                                     걸리는가이며, 계수 구조 자체는 바뀌지 않는다
        INTENT-ACTION-STATE-001      휘두름은 여전히 하나의 행동이다
        INTENT-ACTION-COLLIDER-001   충돌체 구조 그대로 — 새 명중 판정을 만들지 않는다
        INTENT-BODY-OCCUPY-001       타격 대상 판정 그대로
        INTENT-DOWNED-001            생명이 0 이면 쓰러진다, 그대로다
        INTENT-GUARD-*               막기는 여전히 최종 피해에 걸린다.
                                     막기가 피해 방식을 읽지 않는다 —
                                     그 효율은 이 층이 정하지 않는다 (01 EXCLUDED)
        INTENT-MODIFIER-COMPOSE-001  배율 합성 그대로. 네 능력에 배율이 걸리는 자리는
                                     아직 열지 않는다
        INTENT-ATTRIBUTE-MUTATE-001  값을 바꾸는 것은 여전히 세계다. 경로도 판정도 그대로다

    CHANGED
        INTENT-ATTACK-POWER-001
            기존  Actor 는 자기 공격을 얼마나 강하게 만드는지를 나타내는
                  공격 능력 하나를 지닌다
            변경  **대체된다** — INTENT-TYPED-OFFENSE-001 이 그 자리를 가진다.
                  하나였던 공격 능력은 물리 쪽 공격 능력이 되고, 오라 쪽이 새로 선다.
                  "능력은 스킬을 통해서만 피해가 된다" 는 성질은 그대로 이어진다.
                  두 이름을 함께 남기지 않는다 — 어느 값이 계산의 권위인지
                  모호해지기 때문이다 (설계 §9)

        INTENT-DEFENSE-001
            기존  Actor 는 들어오는 피해를 얼마나 줄여 받는지를 나타내는
                  방어 능력 하나를 지닌다
            변경  **대체된다** — INTENT-TYPED-DEFENSE-001 이 그 자리를 가진다.
                  하나였던 방어 능력은 물리 방어가 되고, 오라 방어가 새로 선다.
                  "줄일 뿐 없애지 못한다" 와 "높아질수록 효율이 완만해진다" 는
                  두 성질은 두 방어 모두에서 그대로다

        INTENT-DAMAGE-CALCULATE-001
            기존  타격이 일어나면 세계는 치는 자의 공격 능력과 맞는 자의 방어 능력으로
                  두 단계를 거쳐 최종 피해를 정한다
            변경  그 앞에 고르는 단계가 선다. 스킬의 피해 방식이 어느 공격 능력과
                  어느 방어 능력을 읽을지 정하고, 그 뒤는 기존과 완전히 같다.
                  계산식은 한 줄도 바뀌지 않는다

        INTENT-DAMAGE-BREAKDOWN-001
            기존  타격은 기본 피해량·공격 능력이 더한 몫·방어가 줄인 정도·최종 피해를 남긴다
            변경  거기에 피해 방식과, 그 방식이 고른 두 능력의 이름과 값이 더해진다

        INTENT-STRIKE-DAMAGE-001
            기존  닿은 몸이 잃는 생명은 공격자의 능력과 스킬의 성격과 맞는 자의 방어가
                  함께 정한 최종 피해다
            변경  "공격자의 능력" 과 "맞는 자의 방어" 가 그 타격의 방식이 고른 것으로 좁혀진다.
                  결과가 흔들리지 않는다는 성질은 그대로다

    AFFECTED
        INTENT-ATTRIBUTE-OBSERVE-001 관찰되는 속성 목록에서 두 능력이 네 능력으로 바뀐다
        INTENT-ATTRIBUTE-MUTATE-001  바꿀 수 있는 속성 목록도 같이 바뀐다.
                                     플레이어가 상대의 방어를 한쪽으로 치우치게 만들어
                                     차이를 직접 확인하는 것이 이 경로다
        INTENT-SELF-OBSERVE-001      자기 정보에 네 능력이 실리고,
                                     스킬 정보에 그 스킬의 피해 방식이 실린다
        INTENT-STRIKE-OBSERVE-001    맞은 자리에 드러나는 경위에 방식과 고른 능력이 더해진다
        INTENT-NPC-AUTONOMY-001      자율 존재도 같은 계약 아래에 있다 —
                                     자기 네 능력으로 때리고 받는다.
                                     플레이어와 자율 존재에 서로 다른 피해 규칙을 두지 않는다.
                                     결정 방식 자체는 바뀌지 않는다
        INTENT-WORLD-OBSERVATION-001 관찰되는 세계에 네 능력과 방식이 더해진다
