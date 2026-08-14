# C007 — Intent

## GOAL / POSSIBILITY
    GOAL-COMBAT-VITALITY            존재는 소진될 수 있는 생명과 기력을 지닌 채 싸운다
        └── POSSIBILITY-STRIKE-DEPLETE  주고받는 타격이 상대의 생명을 덜어낸다
        └── POSSIBILITY-COLLAPSE        생명이 다한 존재는 더 이상 싸우지 못한다

    GOAL-ENERGY-ECONOMY             기력은 모으는 흐름과 쏟는 흐름이 맞물려 순환한다
        └── POSSIBILITY-BASIC-CHARGE    값싼 기본 스킬을 휘둘러 기력을 모은다
        └── POSSIBILITY-ADVANCED-SPEND  모은 기력을 고급 스킬 한 방에 쏟는다
        └── POSSIBILITY-RUN-DRAIN       달려서 거리를 벌거나 좁히는 대가로 기력을 흘린다

    GOAL-STRIKE-BY-CAPABILITY       한 번의 타격이 남기는 값은 두 존재의 능력치가 정한다
        └── POSSIBILITY-EVADE           날랜 존재는 날아온 타격을 흘려보낸다
        └── POSSIBILITY-CRITICAL        어떤 타격은 급소에 들어가 몇 배로 들어간다
        └── POSSIBILITY-MITIGATE        단단한 존재는 들어온 타격을 깎아낸다

    GOAL-TEMPO-BY-CAPABILITY        세계의 속도 — 붙는 속도와 치는 간격 — 도 능력치가 정한다
        └── POSSIBILITY-SPEED-DIFFER    존재마다 걷고 달리고 휘두르는 빠르기가 다르다
        └── POSSIBILITY-SPEED-MODIFIED  외부 요소가 그 빠르기와 기력 수지를 배율로 바꾼다

    GOAL-COMBAT-OBSERVABLE          싸움의 상태와 결과는 싸우는 사람 눈앞에 드러난다
        └── POSSIBILITY-ENTITY-HUD      모든 존재의 이름과 생명이 그 몸 위에 보인다
        └── POSSIBILITY-SELF-DETAIL     자기 자신은 자원과 능력치와 배율까지 속속들이 본다
        └── POSSIBILITY-STRIKE-FEEDBACK 한 방의 결과(빗나감·치명·피해)가 맞은 자리에 드러난다

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
        스킬을 성공적으로 휘두른 Actor 는
        그 스킬의 충전량만큼 기력을 얻고 소모량만큼 기력을 잃는다.
        두 흐름은 한 번의 휘두름에서 동시에 일어나며 서로를 상쇄하지 않는다 —
        충전은 충전대로, 소모는 소모대로 각자의 배율을 받는다.
        기본 스킬은 소모 없이 충전하고,
        고급 스킬은 충전하면서 더 크게 소모하여 결과적으로 기력을 잃는다.

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

    INTENT-WORLD-CHANCE-001

        확률로 갈리는 판정 — 명중과 치명과 피해의 흔들림 — 은
        세계가 소유한 하나의 우연에서 나온다.
        같은 세계 상태에서 같은 일이 일어나면 같은 결과가 나온다 —
        우연은 세계 밖에서 들어오지 않으며, 세계의 진행에 종속된다.

    INTENT-STRIKE-ACCURACY-001

        타격이 몸에 닿았다고 해서 곧바로 들어가는 것은 아니다.
        치는 자의 명중과 맞는 자의 회피가 겨루어 그 한 방이 들어갈 확률이 정해지고,
        세계의 우연이 그 확률로 명중 여부를 가른다.
        빗나간 타격은 생명을 덜어내지 않고, 기력 수지도 남기지 않으며,
        빗나갔다는 사실만을 남긴다.

    INTENT-STRIKE-MAGNITUDE-001

        명중한 타격의 크기는
        치는 자의 공격력에 그 스킬 고유의 계수를 곱한 값을 중심으로,
        최소와 최대 사이에서 세계의 우연이 뽑는다.
        치는 자의 숙련도가 높을수록 그 최소값이 최대값에 가까워진다 —
        숙련된 자의 타격은 흔들리지 않는다.

    INTENT-STRIKE-CRITICAL-001

        치는 자의 치명타 확률로 세계의 우연이 급소 여부를 가르고,
        급소에 들어간 타격은 자신의 치명타 배율만큼 커진다.
        급소였다는 사실은 결과에 남는다.

    INTENT-STRIKE-MITIGATION-001

        맞는 자의 방어력은 들어온 타격을 깎아낸다.
        단, 치는 자의 방어 관통 비율만큼은 그 방어가 없는 것처럼 통과한다.
        모두 깎이고도 명중한 타격은 최소한의 값을 남긴다 —
        들어간 타격이 아무것도 아닌 것이 되지는 않는다.

    INTENT-DAMAGE-APPLY-001

        판정을 마친 타격은 맞은 자의 생명을 그 값만큼 덜어낸다.
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
        생명과 기력의 현재/최대, 전투·템포 능력치 전부,
        그리고 지금 자기에게 걸려 있는 배율들을 관찰할 수 있다.
        스킬을 지금 쓸 수 있는지와 쓸 수 없다면 그 이유도 함께 안다.

    INTENT-STRIKE-OBSERVE-001

        한 번의 타격이 낳은 결과 — 빗나감인지, 급소였는지, 얼마를 덜어냈는지 — 는
        맞은 자리에서 잠시 드러났다가 사라진다.
        누가 누구를 쳤는지도 그 결과에 함께 실린다.

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
    INTENT-WORLD-CHANCE-001
        Source Goal         GOAL-STRIKE-BY-CAPABILITY
        Source Possibility  POSSIBILITY-EVADE · POSSIBILITY-CRITICAL
    INTENT-STRIKE-ACCURACY-001
        Source Goal         GOAL-STRIKE-BY-CAPABILITY
        Source Possibility  POSSIBILITY-EVADE
    INTENT-STRIKE-MAGNITUDE-001
        Source Goal         GOAL-STRIKE-BY-CAPABILITY
        Source Possibility  POSSIBILITY-STRIKE-DEPLETE
    INTENT-STRIKE-CRITICAL-001
        Source Goal         GOAL-STRIKE-BY-CAPABILITY
        Source Possibility  POSSIBILITY-CRITICAL
    INTENT-STRIKE-MITIGATION-001
        Source Goal         GOAL-STRIKE-BY-CAPABILITY
        Source Possibility  POSSIBILITY-MITIGATE
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
                  각 스킬은 자기 기력 수지와 피해 계수와 행동 길이를 가진다.
                  기력이 모자라면 시작되지 않는다 (INTENT-SKILL-COST-GATE-001)
        INTENT-SWING-IMPACT-001
            기존  닿은 몸은 행동이 중단되고 충격량을 받아 밀쳐진다
            변경  닿은 몸은 그에 더해 능력치 판정을 거친 피해를 받는다 —
                  빗나가면 밀려남만 남는지 아무 일도 없는지가 정해져야 한다.
                  이번 Cycle 의 결정: 빗나간 타격은 밀려남도 남기지 않는다 (닿지 않은 것으로 본다)
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
            변경  자율 존재도 같은 자원·판정 규칙 아래 있다 —
                  기력이 모자라면 그 스킬을 못 쓰고, 쓰러지면 아무것도 결정하지 않으며,
                  쓰러진 존재를 대상으로 삼지 않는다

    AFFECTED
        INTENT-MINING-001            쓰러진 존재는 채굴도 시작하지 못한다 (행동 시작 자체가 막힌다)
        INTENT-WORLD-OBSERVATION-001 관찰되는 세계에 자원·능력치·타격 결과가 더해진다
        INTENT-MOTION-OBSERVE-001    스킬이 둘로 갈리면서 관찰되는 행동 종류가 늘어난다
        INTENT-COLLISION-OBSERVE-001 스킬별 충돌체도 같은 디버그 관찰 대상이다
