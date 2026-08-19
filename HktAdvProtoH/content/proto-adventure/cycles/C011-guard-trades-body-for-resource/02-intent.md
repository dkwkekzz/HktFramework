# C011 — Intent

> 이번 Cycle 은 세계에 **처음으로 방어라는 선택**을 넣는다.
> 지금까지 맞는 일은 맞는 자가 아무것도 할 수 없는 일이었다 — 값이 정해져 있고 그대로 들어왔다.
> 이후로는 맞는 자도 개입할 수 있다. 다만 공짜가 아니라 같은 기력을 치르고서다.
>
> 한 가지를 먼저 정한다. **막기는 행동이 아니라 자세다.**
> 막으면서 걸을 수 있어야 하는데, 세계의 모든 캐릭터는 "언제나 정확히 하나의 현재 행동
> 안에 있다"(INTENT-ACTION-STATE-001). 막기를 행동으로 두면 걷기와 자리를 다투게 되어
> 그 원칙을 깨야 한다. 막기를 행동과 나란한 몸의 상태로 두면 기존 행동 구조를 그대로 두고도
> "막으면서 걷는다" 가 성립한다.

## GOAL / POSSIBILITY

    GOAL-DEFENSE-IS-A-CHOICE        맞는 일이 정해진 결과가 아니라 맞는 자가 개입할 수 있는
                                    자리가 된다
        └── POSSIBILITY-GUARD-HOLD       앞을 향해 버티는 자세를 유지해 들어온 타격을
                                         덜 아프게 받는다
        └── POSSIBILITY-GUARD-DIRECTION  막히는 것은 앞쪽뿐이다 — 어디를 향할지가 선택이 된다

    GOAL-SAFETY-COSTS-RESOURCE      안전은 공짜가 아니라 이미 쓰이고 있는 같은 예산에서
                                    치러진다
        └── POSSIBILITY-BLOCK-PAYS-CP    막힌 타격마다 생명 대신 기력을 치른다
        └── POSSIBILITY-GUARD-COLLAPSE   치를 기력이 다하면 방어 자체가 무너진다

    GOAL-BLOCK-EXPLAINABLE          막아서 덜 아팠다는 것이 느낌이 아니라 읽히는 사실이다
        └── POSSIBILITY-BLOCK-BREAKDOWN  막지 않았다면 얼마였는지까지 함께 드러난다

## INTENT SET

    ── 버티는 자세 ───────────────────────────────────────────────────

    INTENT-GUARD-STANCE-001 (ADDED)

        Actor 는 현재 행동과 나란히 "막고 있음" 이라는 몸의 상태를 가질 수 있다.
        이 상태는 스스로 끝나지 않는다 —
        시작을 요청한 순간부터 놓기를 요청하거나 세계가 풀 때까지 유지된다.
        세계의 어떤 상태도 지금까지는 스스로 끝나거나 시간이 정했다.
        막고 있음은 그 주체가 놓을 때까지 계속되는 첫 상태다.
        막고 있는 동안에도 Actor 는 여전히 정확히 하나의 현재 행동 안에 있다 —
        막기는 그 행동을 대신하지 않는다.

    INTENT-GUARD-GATE-001 (ADDED)

        막기는 아무 때나 시작되지 않는다.
        쓰러진 몸은 막을 수 없고,
        치를 기력이 남아 있지 않으면 시작할 수 없으며,
        방어가 무너진 직후 잠시 동안은 다시 시작할 수 없다.
        시작되지 못하면 그 사유를 알 수 있다 —
        무엇 때문에 막지 못했는지가 요청한 자에게 돌아간다.

    INTENT-GUARD-RESTRICT-001 (ADDED)

        막고 있는 동안 할 수 있는 것과 할 수 없는 것이 갈린다.
        스킬은 시작되지 않는다 — 버티는 몸으로는 휘두르지 못한다.
        걷는 것은 된다. 막으면서 걷는 빠르기는 평소와 같다.
        달리는 것은 되지 않는다 — 달리기를 시작하면 막기가 풀린다.
        같은 기력을 두 곳에 동시에 걸 수는 없기 때문이다.
        시작되지 않은 스킬 요청은 그 사유를 남긴다.

    INTENT-GUARD-DIRECTION-001 (ADDED)

        막기는 앞쪽만 막는다.
        몸이 향한 방향을 기준으로 정면 범위 안에서 들어온 타격만 막힌 것이 되고,
        옆이나 뒤에서 들어온 타격은 막고 있어도 막지 않은 것과 같다.
        따라서 막는 자는 어디를 향할지를 함께 골라야 한다 —
        막기는 모든 방향을 지켜 주는 상태가 아니다.

    ── 막힌 타격 ─────────────────────────────────────────────────────

    INTENT-GUARD-MITIGATE-001 (ADDED)

        막힌 타격은 맞는 자의 생명을 덜 덜어낸다.
        세계가 이미 정한 최종 피해에 막기가 한 단계 더 작용하여
        실제로 들어가는 값이 정해진다.
        새로운 계산이 생기는 것이 아니다 —
        기존 계산이 내놓은 값 뒤에 막기의 몫이 붙는 것이다.
        여기에도 우연은 없다.
        같은 타격을 같은 방향에서 같은 상태로 막으면 언제나 같은 값이 들어간다.
        막기는 아프지 않게 할 뿐 공격을 없던 일로 만들지 못한다 —
        아무리 잘 막아도 최소한의 피해는 통과한다.

    INTENT-GUARD-COST-001 (ADDED)

        막힌 타격 한 번마다 막은 자는 기력을 치른다.
        치르는 양은 그 타격이 얼마나 큰 것이었는지에 따라 정해진다 —
        크게 들어온 것을 막을수록 크게 치른다.
        이것이 "생명 대신 기력" 의 실체다.
        치르는 기력은 새로 만든 자원이 아니라
        고급 스킬과 달리기가 이미 쓰고 있는 그 기력이다.
        따라서 막는 데 쓴 만큼 휘두를 여력과 달릴 여력이 줄어든다.

    INTENT-GUARD-IMPACT-KEPT-001 (ADDED)

        막아도 몸은 밀린다.
        막기는 얼마나 아픈지와 기력을 얼마나 치르는지에만 작용하고,
        타격이 몸을 밀어내는 것에는 작용하지 않는다.
        얼마나 아픈지와 얼마나 밀리는지는 서로 다른 일이다.

    ── 무너짐 ────────────────────────────────────────────────────────

    INTENT-GUARD-COLLAPSE-001 (ADDED)

        치를 기력이 모자란 채로 막힌 타격을 받으면 방어가 무너진다.
        무너지면 막고 있음이 풀리고,
        그 타격은 막지 못한 것으로 처리되어 온전히 들어간다.
        기력을 조금 남긴 채 큰 것을 막으려 해도 마찬가지다 —
        모자라면 부분적으로 막아 주지 않는다. 막았거나 무너졌거나 둘 중 하나다.
        무너진 직후 잠시 동안은 다시 막을 수 없다.
        기력이 마르면 대가가 따른다는 것이 이 상태의 의미다.

    ── 읽히는 방어 ───────────────────────────────────────────────────

    INTENT-GUARD-OBSERVE-001 (ADDED)

        누가 지금 막고 있는지는 세계의 모든 존재에 대해 관찰된다.
        세계는 자기가 아는 이 사실을 숨기지 않는다.
        방어가 무너지는 순간도 그 자리에서 드러난다 —
        무너짐은 조용히 일어나지 않는다.

    INTENT-GUARD-BREAKDOWN-001 (ADDED)

        막힌 타격은 자기가 어떻게 그 값이 되었는지에
        막기의 몫을 함께 남긴다 —
        막지 않았다면 얼마였는지, 막아서 얼마가 되었는지,
        그리고 그 대가로 기력을 얼마나 치렀는지다.
        무너진 타격은 무너졌다는 사실을 남긴다.
        보는 이는 "덜 아팠다" 를 느낌이 아니라 값으로 확인한다.

    INTENT-GUARD-COMMANDABLE-001 (ADDED)

        막기를 시작하고 놓을 수 있다는 사실은 세계가 밝힌다.
        무엇을 걸 수 있는지의 목록에 막기가 오르고,
        지금 그것을 걸 수 있는지와 걸 수 없다면 왜인지도 함께 실린다.
        보는 쪽이 "막기라는 것이 있다" 를 스스로 알고 있을 필요가 없다.

## DESIGN TRACE

    INTENT-GUARD-STANCE-001
        Source Goal         GOAL-DEFENSE-IS-A-CHOICE
        Source Possibility  POSSIBILITY-GUARD-HOLD
        Master Trace        MG-SURVIVE-ENEMY-OFFENSIVE / MP-TRADE-BODY-FOR-RESOURCE
                            → MC-GUARD
    INTENT-GUARD-GATE-001
        Source Goal         GOAL-DEFENSE-IS-A-CHOICE
        Source Possibility  POSSIBILITY-GUARD-HOLD
        Constraint          DC-COMBAT-PLAYER-CAUSALITY (막지 못한 이유가 드러난다)
    INTENT-GUARD-RESTRICT-001
        Source Goal         GOAL-SAFETY-COSTS-RESOURCE
        Source Possibility  POSSIBILITY-BLOCK-PAYS-CP
        Constraint          DC-COMBAT-SHARED-BUDGET (같은 기력을 두 곳에 걸 수 없다)
    INTENT-GUARD-DIRECTION-001
        Source Goal         GOAL-DEFENSE-IS-A-CHOICE
        Source Possibility  POSSIBILITY-GUARD-DIRECTION
        Master Trace        MC-BODY-FACING 재사용 — 방향의 의미를 새로 만들지 않는다
    INTENT-GUARD-MITIGATE-001
        Source Goal         GOAL-DEFENSE-IS-A-CHOICE
        Source Possibility  POSSIBILITY-GUARD-HOLD
        Constraint          DC-COMBAT-ONE-FORMULA (새 계산을 만들지 않는다) ·
                            DC-COMBAT-PLAYER-CAUSALITY (우연이 없다)
    INTENT-GUARD-COST-001
        Source Goal         GOAL-SAFETY-COSTS-RESOURCE
        Source Possibility  POSSIBILITY-BLOCK-PAYS-CP
        Constraint          DC-COMBAT-SHARED-BUDGET (전용 게이지를 만들지 않는다)
        Master Trace        MC-CP-ECONOMY 확장 — 기력을 쓰는 세 번째 자리다
    INTENT-GUARD-IMPACT-KEPT-001
        Source Goal         GOAL-DEFENSE-IS-A-CHOICE
        Source Possibility  POSSIBILITY-GUARD-HOLD
    INTENT-GUARD-COLLAPSE-001
        Source Goal         GOAL-SAFETY-COSTS-RESOURCE
        Source Possibility  POSSIBILITY-GUARD-COLLAPSE
    INTENT-GUARD-OBSERVE-001
        Source Goal         GOAL-BLOCK-EXPLAINABLE
        Source Possibility  POSSIBILITY-BLOCK-BREAKDOWN
    INTENT-GUARD-BREAKDOWN-001
        Source Goal         GOAL-BLOCK-EXPLAINABLE
        Source Possibility  POSSIBILITY-BLOCK-BREAKDOWN
        Constraint          DC-COMBAT-PLAYER-CAUSALITY (결과의 원인이 관찰된다)
    INTENT-GUARD-COMMANDABLE-001
        Source Goal         GOAL-DEFENSE-IS-A-CHOICE
        Source Possibility  POSSIBILITY-GUARD-HOLD
        Constraint          DC-WORLD-OWNS-THE-SURFACE-LIST (목록은 세계가 소유한다)

## EXISTING INTENT DELTA

    REUSED
        INTENT-ACTION-STATE-001      언제나 정확히 하나의 현재 행동 안에 있다 — 그대로다.
                                     막기는 행동 자리를 차지하지 않는 나란한 상태다
        INTENT-VITALITY-001          자원은 생명·기력 둘 그대로다. 새 자원은 없다
        INTENT-BODY-FACING-001       몸이 향한 방향의 의미를 그대로 쓴다.
                                     막기 때문에 방향이 정해지는 방식이 바뀌지는 않는다
        INTENT-ACTION-COLLIDER-001   누가 맞았는지 정하는 방식은 그대로다.
                                     막기는 맞은 뒤에 작용하며 맞고 안 맞고를 가르지 않는다
        INTENT-BODY-OCCUPY-001       타격 대상 판정 그대로
        INTENT-SKILL-BUDGET-001      휘두른 자의 기력 수지는 그대로다 —
                                     막힌 타격이라고 때린 쪽의 충전·소모가 달라지지 않는다
        INTENT-DOWNED-001            생명이 0 이면 쓰러진다, 그대로다
        INTENT-DAMAGE-CALCULATE-001  공격 능력 → 스킬 → 방어 능력의 계산 자체는 손대지 않는다.
                                     막기는 그 계산이 끝난 뒤의 한 단계다
        INTENT-WORLD-CHANCE-001      우연 없음 그대로 — 막기에도 난수는 없다
        INTENT-TEMPO-MOVE-001        막으면서 걷는 빠르기는 평소와 같다.
                                     템포 능력치를 건드리지 않는다
        INTENT-ATTRIBUTE-MUTATE-001  값을 바꾸는 경로는 그대로다. 새 경로를 만들지 않는다

    CHANGED
        INTENT-DAMAGE-APPLY-001
            기존  타격은 맞은 자의 생명을 그 타격의 최종 피해만큼 덜어낸다
            변경  막힌 타격이면 그 최종 피해에 막기의 몫이 작용한 값을 덜어내고,
                  같은 순간 막은 자의 기력을 치르게 한다.
                  막지 않은 타격은 지금까지와 똑같다

        INTENT-DAMAGE-BREAKDOWN-001
            기존  한 번의 타격은 기본 피해량·공격 능력의 몫·방어가 줄인 정도·최종 피해를 남긴다
            변경  거기에 막기 단계가 더해진다 — 막혔는지, 막아서 얼마가 되었는지,
                  치른 기력이 얼마인지, 무너졌다면 무너졌다는 사실이다.
                  막지 않은 타격의 내역은 지금까지와 똑같다

        INTENT-STRIKE-OBSERVE-001
            기존  누가 누구를 어느 스킬로 얼마나 깎았는지가 맞은 자리에 드러난다
            변경  그 자리에 막혔는지 여부와 방어가 무너졌는지도 함께 드러난다

        INTENT-RUN-001
            기존  Actor 는 이동을 보통 걸음과 달리기 중 하나로 두고 움직인다
            변경  막고 있는 동안에는 달릴 수 없다.
                  달리기를 시작하면 막기가 풀린다.
                  기력을 흘리는 방식 자체는 그대로다

    AFFECTED
        INTENT-ACTION-EXCLUSIVE-001  막고 있는 동안 스킬 요청이 수행되지 않는다는 사유가
                                     새로 생긴다. 대체 가능·불가능의 기존 구분은 그대로이고,
                                     거절 사유의 출처가 하나 늘어날 뿐이다
        INTENT-SKILL-COST-GATE-001   기력이 모자라면 시작되지 않는다는 규칙 그대로다.
                                     다만 막는 데 기력을 쓴 뒤에는 그 문턱에 더 자주 걸린다 —
                                     규칙이 아니라 플레이가 달라진다
        INTENT-HIT-REACTION-001      막아도 피격 반응(밀려남)은 그대로 일어난다
                                     (INTENT-GUARD-IMPACT-KEPT-001)
        INTENT-COMMAND-CATALOG-001   세계가 밝히는 명령 목록에 막기 시작·해제가 더해진다.
                                     새 목록 구조를 만드는 것이 아니라 실리는 것이 늘어난다
        INTENT-ATTRIBUTE-OBSERVE-001 관찰되는 것에 막고 있음이 더해진다
        INTENT-SELF-OBSERVE-001      자기 정보에 지금 막고 있는지와 막을 수 있는지가 더해진다
        INTENT-WORLD-OBSERVATION-001 관찰되는 세계에 막는 상태와 막힌 경위가 더해진다
        INTENT-NPC-AUTONOMY-001      자율 존재의 결정 방식은 바뀌지 않는다.
                                     자율 존재는 막지 않는다 — 막기는 이번에도 플레이어의
                                     선택으로만 존재한다. 다만 자율 존재의 타격이
                                     막히는 쪽이 되는 것은 새로 일어나는 일이다
