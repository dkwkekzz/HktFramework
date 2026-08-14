# C007 — Intent

> R1 축소 개정 — 판정 능력치와 세계 난수원을 뺐다. 피해는 스킬이 정한 고정값이다.
> (INTENT-WORLD-CHANCE-001 · STRIKE-ACCURACY · STRIKE-MAGNITUDE · STRIKE-CRITICAL ·
>  STRIKE-MITIGATION 폐기 → INTENT-STRIKE-DAMAGE-001 하나로 대체)

## GOAL / POSSIBILITY
    GOAL-COMBAT-VITALITY            존재는 소진될 수 있는 생명과 기력을 지닌 채 싸운다
        └── POSSIBILITY-STRIKE-DEPLETE  주고받는 타격이 상대의 생명을 덜어낸다
        └── POSSIBILITY-COLLAPSE        생명이 다한 존재는 더 이상 싸우지 못한다

    GOAL-ENERGY-ECONOMY             기력은 모으는 흐름과 쏟는 흐름이 맞물려 순환한다
        └── POSSIBILITY-BASIC-CHARGE    값싼 기본 스킬을 휘둘러 기력을 모은다
        └── POSSIBILITY-ADVANCED-SPEND  모은 기력을 고급 스킬 한 방에 쏟는다
        └── POSSIBILITY-RUN-DRAIN       달려서 거리를 벌거나 좁히는 대가로 기력을 흘린다

    GOAL-TEMPO-BY-CAPABILITY        세계의 속도 — 붙는 속도와 치는 간격 — 은 능력치가 정한다
        └── POSSIBILITY-SPEED-DIFFER    존재마다 걷고 달리고 휘두르는 빠르기가 다르다
        └── POSSIBILITY-SPEED-MODIFIED  외부 요소가 그 빠르기와 기력 수지를 배율로 바꾼다

    GOAL-COMBAT-OBSERVABLE          싸움의 상태와 결과는 싸우는 사람 눈앞에 드러난다
        └── POSSIBILITY-ENTITY-HUD      모든 존재의 이름과 생명이 그 몸 위에 보인다
        └── POSSIBILITY-SELF-DETAIL     자기 자신은 자원과 능력치와 배율까지 속속들이 본다
        └── POSSIBILITY-STRIKE-FEEDBACK 한 방의 결과가 맞은 자리에 드러난다

## INTENT SET

    ── 자원 ──────────────────────────────────────────────────────────

    INTENT-VITALITY-001

        세계의 모든 Actor 는
        생명(hp)과 기력(cp)이라는 두 자원을 지닌 채 존재한다.
        두 자원 모두 각자의 최대치를 가지며 그 사이에서만 값을 가진다.
        생명은 타격으로만 줄고, 기력은 자신의 행동과 몸 상태로 늘고 준다.
        존재의 종류가 두 자원의 최대치와 시작값을 정한다.

    INTENT-SKILL-BUDGET-001

        스킬은 저마다 고유한 기력 수지 — 충전량과 소모량 — 를 가진다.
        스킬을 휘둘러 상대를 맞힌 Actor 는
        그 스킬의 충전량만큼 기력을 얻고 소모량만큼 기력을 잃는다.
        두 흐름은 같은 순간에 함께 일어나며 서로를 상쇄하지 않는다 —
        충전은 충전대로, 소모는 소모대로 각자의 배율을 받는다.
        기본 스킬은 소모 없이 충전하고,
        고급 스킬은 충전하면서 더 크게 소모하여 결과적으로 기력을 잃는다.
        아무도 맞히지 못한 휘두름은 기력을 움직이지 않는다 — 맞아야 기력이 돈다.

    INTENT-SKILL-COST-GATE-001

        지금 가진 기력이 스킬의 소모량에 못 미치는 Actor 는
        그 스킬을 시작할 수 없다.
        시작되지 않은 요청은 세계를 바꾸지 않으며,
        요청한 자는 왜 시작되지 못했는지를 알 수 있다.

    INTENT-RUN-001

        Actor 는 이동을 보통 걸음과 달리기 중 하나로 두고 움직인다.
        달리는 동안 그 몸은 자기 이동 속도에 달리기 배율이 곱해진 빠르기로 나아가며,
        시간이 흐르는 내내 기력을 조금씩 흘린다.
        기력이 바닥나면 더 이상 달릴 수 없고 보통 걸음으로 돌아온다.
        멈춰 있거나 걷는 동안에는 흘러나가지 않는다.

    ── 배율 ──────────────────────────────────────────────────────────

    INTENT-MODIFIER-COMPOSE-001

        기력 충전률·기력 소비율·이동 속도·공격 속도 네 값은
        각자 자기에게 걸린 배율 원천들을 모두 곱한 값으로 결정되며,
        그 결과는 세계가 정한 상·하한을 넘지 않는다.
        원천은 세계의 상태에서 유래하며 늘어날 수 있다 —
        이번 Cycle 의 원천은 둘이다.
            달리는 중이면        기력이 모이는 속도가 억눌린다
            타격당한 직후 잠시    기력이 모이는 속도가 더 크게 억눌린다
        배율이 하나도 걸리지 않은 값은 자기 본래 값 그대로다.

    ── 한 번의 타격 ──────────────────────────────────────────────────

    INTENT-STRIKE-DAMAGE-001 (R1 — 판정 4종을 대체한다)

        스킬은 저마다 정해진 피해량을 가진다.
        휘두름에 닿은 몸은 그 값만큼, 언제나 똑같이 생명을 잃는다 —
        맞고 안 맞고를 가르는 겨룸도, 값이 흔들리는 폭도 없다.
        고급 스킬의 피해량은 기본 스킬보다 크다.

    INTENT-DAMAGE-APPLY-001

        타격은 맞은 자의 생명을 그 스킬의 피해량만큼 덜어낸다.
        생명은 0 아래로 내려가지 않는다.
        이 덜어냄은 기존의 피격 반응 — 하던 행동의 중단과 밀려남 — 과 함께 일어난다.

    INTENT-DOWNED-001

        생명이 0 이 된 Actor 는 쓰러진다.
        쓰러진 존재는 스스로 어떤 행동도 시작하지 못하고,
        스스로 무엇을 결정하지도 않으며,
        더 이상 타격의 대상이 되지 않는다.
        쓰러짐은 이번 Cycle 에서 되돌아오지 않는 상태다.

    ── 템포 ──────────────────────────────────────────────────────────

    INTENT-TEMPO-MOVE-001

        존재의 이동 속도는 종류마다 다른 능력치이며,
        배율이 걸릴 수 있는 값이다.
        움직이는 몸이 한 순간에 나아가는 거리는 그 결과값이 정한다.

    INTENT-TEMPO-ACTION-001

        존재의 공격 속도는 스킬 행동이 얼마나 오래 걸리는지를 정한다.
        공격 속도가 빠를수록 같은 스킬이 더 짧게 끝나고,
        따라서 같은 시간 안에 더 자주 휘두르며 기력 수지도 더 빨리 돈다.
        행동의 진행 정도와 충돌체가 활성화되는 구간은 줄어든 길이를 기준으로 함께 줄어든다.

    ── 관찰 ──────────────────────────────────────────────────────────

    INTENT-ENTITY-IDENTITY-001

        세계의 모든 Actor 는 불러 줄 이름을 가진다.
        이름은 그 존재가 무엇인지를 사람에게 알려 주기 위한 것이며 변하지 않는다.

    INTENT-ENTITY-OBSERVE-001

        관찰자는 자기가 보는 세계의 모든 Actor 에 대해
        그 이름과 생명의 현재/최대, 그리고 쓰러졌는지 여부를 관찰할 수 있다.
        남의 기력과 능력치는 관찰되지 않는다.

    INTENT-SELF-OBSERVE-001

        관찰자는 자신이 조종하는 존재에 한해
        생명과 기력의 현재/최대, 템포 능력치 전부,
        그리고 지금 자기에게 걸려 있는 배율들을 관찰할 수 있다.
        스킬을 지금 쓸 수 있는지와 쓸 수 없다면 그 이유,
        그리고 그 스킬이 기력을 얼마나 채우고 얼마나 쓰는지도 함께 안다.

    INTENT-STRIKE-OBSERVE-001

        한 번의 타격이 낳은 결과 — 누가 누구를 어느 스킬로 얼마나 깎았는지 — 는
        맞은 자리에서 잠시 드러났다가 사라진다.

## DESIGN TRACE
    INTENT-VITALITY-001
        Source Goal         GOAL-COMBAT-VITALITY
        Source Possibility  POSSIBILITY-STRIKE-DEPLETE
    INTENT-SKILL-BUDGET-001
        Source Goal         GOAL-ENERGY-ECONOMY
        Source Possibility  POSSIBILITY-BASIC-CHARGE · POSSIBILITY-ADVANCED-SPEND
    INTENT-SKILL-COST-GATE-001
        Source Goal         GOAL-ENERGY-ECONOMY
        Source Possibility  POSSIBILITY-ADVANCED-SPEND
    INTENT-RUN-001
        Source Goal         GOAL-ENERGY-ECONOMY · GOAL-TEMPO-BY-CAPABILITY
        Source Possibility  POSSIBILITY-RUN-DRAIN
    INTENT-MODIFIER-COMPOSE-001
        Source Goal         GOAL-TEMPO-BY-CAPABILITY · GOAL-ENERGY-ECONOMY
        Source Possibility  POSSIBILITY-SPEED-MODIFIED
    INTENT-STRIKE-DAMAGE-001
        Source Goal         GOAL-COMBAT-VITALITY
        Source Possibility  POSSIBILITY-STRIKE-DEPLETE
    INTENT-DAMAGE-APPLY-001
        Source Goal         GOAL-COMBAT-VITALITY
        Source Possibility  POSSIBILITY-STRIKE-DEPLETE
    INTENT-DOWNED-001
        Source Goal         GOAL-COMBAT-VITALITY
        Source Possibility  POSSIBILITY-COLLAPSE
    INTENT-TEMPO-MOVE-001
        Source Goal         GOAL-TEMPO-BY-CAPABILITY
        Source Possibility  POSSIBILITY-SPEED-DIFFER
    INTENT-TEMPO-ACTION-001
        Source Goal         GOAL-TEMPO-BY-CAPABILITY
        Source Possibility  POSSIBILITY-SPEED-DIFFER
    INTENT-ENTITY-IDENTITY-001
        Source Goal         GOAL-COMBAT-OBSERVABLE
        Source Possibility  POSSIBILITY-ENTITY-HUD
    INTENT-ENTITY-OBSERVE-001
        Source Goal         GOAL-COMBAT-OBSERVABLE
        Source Possibility  POSSIBILITY-ENTITY-HUD
    INTENT-SELF-OBSERVE-001
        Source Goal         GOAL-COMBAT-OBSERVABLE
        Source Possibility  POSSIBILITY-SELF-DETAIL
    INTENT-STRIKE-OBSERVE-001
        Source Goal         GOAL-COMBAT-OBSERVABLE
        Source Possibility  POSSIBILITY-STRIKE-FEEDBACK

## EXISTING INTENT DELTA
    REUSED
        INTENT-ACTION-STATE-001      스킬도 하나의 행동이다 — 행동 구조를 새로 만들지 않는다
        INTENT-ACTION-EXCLUSIVE-001  한 번에 하나의 행동이라는 제약은 그대로다
        INTENT-ACTION-COLLIDER-001   스킬의 충돌체는 기존 휘두름 충돌체 구조 그대로다
        INTENT-BODY-OCCUPY-001       타격 대상 판정은 기존 몸으로 한다
        INTENT-BODY-FACING-001       휘두르는 방향 의미는 그대로다
        INTENT-WORLD-CLOCK-001       기력의 흐름과 배율은 기존 세계 진행 위에서만 일어난다
        INTENT-PER-OBSERVER-PROJECTION-001  자기 정보는 기존 관찰자별 투영 위에 얹힌다

    CHANGED
        INTENT-ATTACK-001
            기존  Actor 는 대상 없이 세계에 대고 휘두른다 (한 종류)
            변경  휘두름은 스킬이며 종류가 둘이다 —
                  각 스킬은 자기 기력 수지와 고정 피해량과 행동 길이를 가진다.
                  기력이 모자라면 시작되지 않는다 (INTENT-SKILL-COST-GATE-001)
        INTENT-SWING-IMPACT-001
            기존  닿은 몸은 행동이 중단되고 충격량을 받아 밀쳐진다
            변경  닿은 몸은 그에 더해 그 스킬의 고정 피해를 받는다.
                  쓰러진 몸에는 닿아도 아무 일도 일어나지 않는다
        INTENT-HIT-REACTION-001
            기존  타격당한 몸은 하던 행동을 중단하고 피격 상태가 된다
            변경  피격은 그 직후 잠시 기력 충전을 억누르는 배율 원천이 된다
        INTENT-MOVE-001
            기존  Actor 는 목적지를 향해 고정된 빠르기로 나아간다
            변경  빠르기는 이동 속도 능력치와 배율의 결과이며, 걷기/달리기 중 하나로 나아간다
        INTENT-ACTION-PROGRESS-001
            기존  행동은 자기 종류가 정한 길이만큼 진행된다
            변경  스킬 행동의 길이는 공격 속도에 따라 줄거나 늘어난다
        INTENT-NPC-AUTONOMY-001
            기존  자율 존재는 지각 범위 안의 대상에게 다가가 휘두르고, 없으면 배회한다
            변경  자율 존재도 같은 자원 규칙 아래 있다 —
                  쓰러지면 아무것도 결정하지 않고, 쓰러진 존재를 대상으로 삼지 않는다

    AFFECTED
        INTENT-MINING-001            쓰러진 존재는 채굴도 시작하지 못한다 (행동 시작 자체가 막힌다)
        INTENT-WORLD-OBSERVATION-001 관찰되는 세계에 자원·능력치·타격 결과가 더해진다
        INTENT-MOTION-OBSERVE-001    스킬이 둘로 갈리면서 관찰되는 행동 종류가 늘어난다
        INTENT-COLLISION-OBSERVE-001 스킬별 충돌체도 같은 디버그 관찰 대상이다
