# C010 — Intent

> R1 개정 (Human Review 이전, World Semantic 착수 중 발견) — 막기를 "하나뿐인 행동 칸을
> 차지하는 행동" 으로 쓰면 01-cycle.md 의 "막기를 유지한 채 걸을 수는 있다" 와 모순된다
> (한 번에 하나의 행동 — INTENT-ACTION-EXCLUSIVE-001). 막기를 **몸이 취하는 자세**로
> 고쳐 쓴다 — 자세는 지금 무엇을 하고 있는가와 별개로 유지되며, 무엇을 시작할 수 있는지를
> 제한한다. 의미(선택하는 능동 방어 · 유지되는 것 · 놓기 전까지 이어짐)는 그대로다.
> 영향: INTENT-GUARD-STANCE-001 · INTENT-GUARD-EXCLUSIVE-001 문안,
> EXISTING INTENT DELTA 의 INTENT-ACTION-PROGRESS-001 항목(철회) · INTENT-MINING-001 사유.

> 입력: `01-cycle.md` (Frontier FR-GUARD-TRADES-BODY-FOR-RESOURCE)
> 아래 Goal / Possibility 는 **Cycle-local** 의미다. 지속적인 상위 Goal / Possibility 는
> `master/graph/` 가 소유하며, 이 Cycle 의 상위 출처는 01-cycle.md 의 MASTER TRACE 에 있다.

## GOAL / POSSIBILITY

    GOAL-DEFENSE-BY-CHOICE          들어오는 타격을 그냥 받을지 막을지를 존재가 고른다
        └── POSSIBILITY-GUARD-STANCE      앞을 향해 버티는 자세를 유지하여 정면 타격을 받아낸다
        └── POSSIBILITY-GUARD-IS-A-COST   막는 자세는 다른 행동을 포기하는 것으로만 유지된다

    GOAL-BODY-FOR-RESOURCE          생명을 지키는 일은 공짜가 아니라 같은 기력 예산에서 나온다
        └── POSSIBILITY-GUARD-PAYS-CP     막힌 타격마다 그 크기에 비례한 기력을 치른다
        └── POSSIBILITY-BUDGET-COMPETES   막느라 쓴 기력은 고급 스킬과 달리기에 쓸 수 없다

    GOAL-DEFENSE-HAS-A-FLOOR        아무리 두껍게 막아도 완전히 무해해지지 않는다
        └── POSSIBILITY-MITIGATE-NOT-NULLIFY   방어는 피해를 줄일 뿐 0 으로 만들지 못한다

    GOAL-DEFENSE-CAN-COLLAPSE       버티기만 하는 선택은 스스로 끝을 부른다
        └── POSSIBILITY-GUARD-BREAK       치를 기력이 없으면 방어가 무너지고 그대로 얻어맞는다
        └── POSSIBILITY-BREAK-HAS-AFTERMATH   무너진 직후에는 곧바로 다시 막지 못한다

    GOAL-DEFENSE-OBSERVABLE         막은 결과가 왜 그 값이 되었는지 그 자리에서 읽힌다
        └── POSSIBILITY-GUARD-VISIBLE     누가 지금 어느 쪽을 막고 있는지 보인다
        └── POSSIBILITY-STRIKE-BREAKDOWN  한 타격의 결과에 그 값을 만든 내역이 함께 실린다

## INTENT SET

    ── 막는 행동 ─────────────────────────────────────────────────────

    INTENT-GUARD-STANCE-001 (R1)

        Actor 는 앞을 향해 몸을 세워 막는 자세를 취할 수 있다.
        자세는 지금 무엇을 하고 있는가와 별개로 몸이 지니는 태세다 —
        하던 일을 밀어내지 않고, 하던 일에 얹혀 유지된다.
        막는 자세는 스스로 끝나지 않는다 — 취한 자가 놓기를 요청할 때까지,
        또는 세계가 그것을 풀어야 할 사유를 만들 때까지 이어진다.
        이것이 이 세계에서 처음으로 등장하는, 행동과 나란히 존재하는 몸의 태세다.

    INTENT-GUARD-BEGIN-GATE-001

        쓰러지지 않았고, 지금 하고 있는 일을 그만둘 수 있으며,
        아직 치를 기력이 남아 있는 Actor 만이 막기를 시작할 수 있다.
        방금 방어가 무너진 Actor 는 그 여파가 가시기 전까지 다시 막지 못한다.
        시작되지 않은 요청은 세계를 바꾸지 않으며, 요청한 자는 그 이유를 알 수 있다.

    INTENT-GUARD-EXCLUSIVE-001 (R1)

        막는 자세는 그 몸이 무엇을 시작할 수 있는지를 좁힌다.
        막는 동안 시작할 수 있는 것은 걸음과 멈춤뿐이다 —
        어떤 스킬도, 캐는 일도 시작되지 않는다. 막는 몸은 다른 것을 겨눌 수 없다.
        걷는 것은 막힌 채로도 된다. 자세와 걸음은 서로를 밀어내지 않는다.
        달리기는 다르다 — 달리기로 옮겨 가는 것은 막기를 놓는 것이다.
        쓰러진 몸에는 막는 자세가 남지 않는다.
        세계가 몸에 강제하는 것 — 얻어맞음과 쓰러짐 — 은 이 좁힘의 대상이 아니다.

    INTENT-GUARD-DIRECTION-001

        막기는 앞쪽만 막는다.
        몸이 향한 방향을 기준으로 정면에 해당하는 범위 안에서 들어온 타격만 막히며,
        옆이나 뒤에서 들어온 타격에는 막는 자세가 아무 소용이 없다 —
        막지 않은 것과 똑같이 들어온다.
        어느 쪽을 향하고 서 있는가가 막기의 유일한 정확성이다.

    ── 받아내기 ──────────────────────────────────────────────────────

    INTENT-DEFENSE-MITIGATION-001

        존재는 맞은 피해를 줄이는 방어력을 지닌다.
        방어력은 타격을 빗나가게 하지 않는다 — 맞은 뒤에 그 값을 줄일 뿐이다.
        방어력이 아무리 커도 피해가 0 이 되지는 않는다.
        모든 타격은 반드시 최소한의 몫을 생명에서 가져간다.
        방어력은 존재의 종류가 정하는 값이며, 막고 있든 아니든 언제나 작동한다.

    INTENT-GUARD-ABSORB-001

        막는 자세로 정면에서 타격을 받은 Actor 는
        그 타격이 본래 덜어낼 생명의 대부분을 자기 기력으로 대신 치른다.
        치르는 기력은 그 타격이 컸을수록 크다 — 큰 것을 막는 일은 더 비싸다.
        생명은 여전히 줄지만, 막지 않았을 때보다 훨씬 적게 줄어든다.
        이것이 "생명 대신 기력" 이다 — 피해가 사라지는 것이 아니라
        어느 자원으로 받을지가 바뀐다.

    INTENT-GUARD-KEEPS-THE-STANCE-001

        막아 낸 타격은 막는 자세를 흩뜨리지 않는다.
        타격당한 몸이 하던 일을 놓치는 기존의 피격 반응은 막고 있는 동안 일어나지 않는다 —
        막았는데 자세가 풀려 버린다면 그것은 막은 것이 아니기 때문이다.
        다만 몸이 뒤로 밀려나는 것은 그대로다. 막아도 힘은 몸에 전해진다.

    ── 무너짐 ────────────────────────────────────────────────────────

    INTENT-GUARD-BREAK-001

        막는 자세로 타격을 받았으나 그 대가를 치를 기력이 남지 않은 Actor 는
        방어가 무너진다.
        무너진 순간 막는 자세는 풀리고, 그 타격은 막지 못한 것으로 처리되어
        본래의 피해가 그대로 생명에서 나간다.
        남아 있던 기력은 그 마지막 대가로 모두 소진된다 —
        무너짐은 기력이 모자랐다는 사실 그 자체다.

    INTENT-GUARD-BREAK-AFTERMATH-001

        방어가 무너진 Actor 는 그 여파가 가시는 동안 다시 막지 못한다.
        이 동안 그 몸은 들어오는 타격을 그대로 받는다.
        여파는 시간이 흐르면 스스로 가신다 — 되돌리기 위해 해야 할 일은 없다.
        이것이 계속 막기만 하는 선택이 결국 스스로를 끝내는 자리다.

    ── 관찰 ──────────────────────────────────────────────────────────

    INTENT-GUARD-OBSERVE-001

        누가 지금 막고 있는지, 어느 쪽을 향해 막고 있는지,
        그리고 방금 방어가 무너졌는지는 그 몸을 보는 누구에게나 드러난다.
        막기를 지금 시작할 수 있는지와 시작할 수 없다면 그 이유는
        그 몸을 조종하는 이가 안다.

    INTENT-STRIKE-BREAKDOWN-001

        한 번의 타격이 낳은 결과에는 그 값을 만든 내역이 함께 실린다 —
        본래 얼마짜리 타격이었는지, 막혔는지, 방어력이 얼마를 걷어냈는지,
        막느라 기력을 얼마나 치렀는지, 그래서 생명에서 얼마가 나갔는지.
        보는 이는 최종 숫자 하나가 아니라 그 숫자가 나온 경로를 읽는다.
        같은 상태에서 같은 타격이면 언제나 같은 내역이 나온다.

## DESIGN TRACE

    INTENT-GUARD-STANCE-001
        Source Goal         GOAL-DEFENSE-BY-CHOICE
        Source Possibility  POSSIBILITY-GUARD-STANCE
        Master              MC-GUARD · DC-COMBAT-DEFENSE-IS-ACTIVE (defense_as_player_action)
    INTENT-GUARD-BEGIN-GATE-001
        Source Goal         GOAL-DEFENSE-BY-CHOICE · GOAL-DEFENSE-CAN-COLLAPSE
        Source Possibility  POSSIBILITY-GUARD-STANCE · POSSIBILITY-BREAK-HAS-AFTERMATH
        Master              MC-GUARD
    INTENT-GUARD-EXCLUSIVE-001
        Source Goal         GOAL-DEFENSE-BY-CHOICE
        Source Possibility  POSSIBILITY-GUARD-IS-A-COST
        Master              MC-CP-ECONOMY (기력만이 아니라 행동 자체가 경쟁한다)
    INTENT-GUARD-DIRECTION-001
        Source Goal         GOAL-DEFENSE-BY-CHOICE
        Source Possibility  POSSIBILITY-GUARD-STANCE
        Master              MC-BODY-FACING (재사용) · DC-COMBAT-PLAYER-CAUSALITY
    INTENT-DEFENSE-MITIGATION-001
        Source Goal         GOAL-DEFENSE-HAS-A-FLOOR
        Source Possibility  POSSIBILITY-MITIGATE-NOT-NULLIFY
        Master              MC-DEFENSE-MITIGATION
    INTENT-GUARD-ABSORB-001
        Source Goal         GOAL-BODY-FOR-RESOURCE
        Source Possibility  POSSIBILITY-GUARD-PAYS-CP · POSSIBILITY-BUDGET-COMPETES
        Master              MC-GUARD · MC-CP-ECONOMY · DC-COMBAT-SHARED-BUDGET
    INTENT-GUARD-KEEPS-THE-STANCE-001
        Source Goal         GOAL-DEFENSE-BY-CHOICE
        Source Possibility  POSSIBILITY-GUARD-STANCE
        Master              MC-GUARD
    INTENT-GUARD-BREAK-001
        Source Goal         GOAL-DEFENSE-CAN-COLLAPSE
        Source Possibility  POSSIBILITY-GUARD-BREAK
        Master              MC-GUARD · DC-COMBAT-SHARED-BUDGET (마르면 무너진다)
    INTENT-GUARD-BREAK-AFTERMATH-001
        Source Goal         GOAL-DEFENSE-CAN-COLLAPSE
        Source Possibility  POSSIBILITY-BREAK-HAS-AFTERMATH
        Master              MC-GUARD
    INTENT-GUARD-OBSERVE-001
        Source Goal         GOAL-DEFENSE-OBSERVABLE
        Source Possibility  POSSIBILITY-GUARD-VISIBLE
        Master              DC-COMBAT-PLAYER-CAUSALITY (observable_cause)
    INTENT-STRIKE-BREAKDOWN-001
        Source Goal         GOAL-DEFENSE-OBSERVABLE
        Source Possibility  POSSIBILITY-STRIKE-BREAKDOWN
        Master              DC-COMBAT-PLAYER-CAUSALITY (explainable_result) ·
                            MC-COMBAT-CAUSE-READING (PARTIAL 을 방어 쪽에서 밀어 준다)

## EXISTING INTENT DELTA

    REUSED
        INTENT-ACTION-EXCLUSIVE-001     (C002) 한 번에 하나의 행동이라는 제약은 그대로다 —
                                        자세는 그 칸을 쓰지 않으므로 이 제약을 건드리지 않는다
        INTENT-BODY-FACING-001          (C006) 막는 방향은 기존 몸의 방향 그대로다 — 새 방향 개념 없음
        INTENT-BODY-OCCUPY-001          (C006) 타격 대상 판정은 기존 몸으로 한다
        INTENT-VITALITY-001             (C007) 자원은 여전히 생명과 기력 둘뿐이다
        INTENT-SKILL-BUDGET-001         (C007) 기력이 도는 방식(맞혀야 돈다)은 그대로다
        INTENT-MODIFIER-COMPOSE-001     (C007) 배율 합성 구조를 그대로 쓴다 — 새 원천도 이 규칙 아래
        INTENT-WORLD-CLOCK-001          (C003) 무너짐의 여파도 기존 세계 시간 위에서 가신다
        INTENT-ATTRIBUTE-OBSERVE-001    (C007 R2) 방어력도 숨기지 않는다 — 예외를 다시 만들지 않는다
        INTENT-ATTRIBUTE-MUTATE-001     (C007 R2) 방어력도 같은 경로로 바꿔 볼 수 있다
        INTENT-PER-OBSERVER-PROJECTION-001  (C004) 막기 가능 여부는 기존 자기 투영 위에 얹힌다

    CHANGED
        INTENT-STRIKE-DAMAGE-001        (C007)
            기존  휘두름에 닿은 몸은 스킬이 정한 값만큼 언제나 똑같이 생명을 잃는다
            변경  스킬이 정한 값은 이제 **본래 피해**이며, 맞은 자의 방어력과 막는 자세가
                  그 값을 줄인 뒤 남은 몫이 생명에서 나간다.
                  우연은 여전히 없다 — 같은 상태·같은 방향·같은 기력이면 같은 값이다
        INTENT-DAMAGE-APPLY-001         (C007)
            기존  타격은 맞은 자의 생명을 피해량만큼 덜어낸다
            변경  덜어냄이 두 자원으로 갈린다 — 막았으면 대부분이 기력에서,
                  나머지가 생명에서 나간다. 막지 못했으면 지금까지대로 생명에서만 나간다
        INTENT-SWING-IMPACT-001         (C006·C007)
            기존  닿은 몸은 행동이 중단되고 충격량을 받아 밀쳐지며 피해를 받는다
            변경  막아 낸 몸은 밀쳐지되 행동은 중단되지 않는다
                  (INTENT-GUARD-KEEPS-THE-STANCE-001)
        INTENT-HIT-REACTION-001         (C002·C007)
            기존  타격당한 몸은 하던 행동을 중단하고 피격 상태가 된다
            변경  막고 있는 동안에는 피격 상태로 넘어가지 않는다.
                  따라서 막는 중에는 피격이 기력 충전을 억누르는 원천으로도 걸리지 않는다
        INTENT-ACTION-STATE-001         (C002) — R1 CHANGED (REUSED 에서 옮겨 옴)
            기존  모든 Actor 는 언제나 정확히 하나의 행동 안에 있다.
                  그 몸에 대해 알아야 할 "지금" 은 그 행동 하나다
            변경  몸은 행동에 더해 자세를 함께 지닌다. 자세는 행동 칸을 차지하지 않으며,
                  행동이 바뀌어도 남아 있고, 무엇을 시작할 수 있는지를 좁힌다.
                  "한 번에 하나의 행동" 은 그대로다 — 자세는 행동이 아니다
        INTENT-RUN-001                  (C007)
            기존  Actor 는 걷기와 달리기 중 하나를 골라 움직인다
            변경  달리기로 옮겨 가는 것은 막기를 놓는 것이다 —
                  두 자세를 동시에 가질 수 없다
        INTENT-STRIKE-OBSERVE-001       (C007)
            기존  누가 누구를 어느 스킬로 얼마나 깎았는지가 맞은 자리에 잠시 드러난다
            변경  그 값을 만든 내역까지 함께 실린다
                  (INTENT-STRIKE-BREAKDOWN-001)
        INTENT-ENTITY-OBSERVE-001       (C007 R2)
            기존  모든 Actor 의 이름·생명·쓰러짐이 몸에서 읽힌다
            변경  막고 있는지와 방금 무너졌는지도 함께 읽힌다

    AFFECTED
        INTENT-SKILL-COST-GATE-001      기력이 방어에도 나가기 시작하므로 스킬이 실제로
                                        시작되지 못하는 일이 잦아진다. Gate 자체는 그대로다
        INTENT-DOWNED-001               쓰러지면 막는 자세도 남지 않는다.
                                        쓰러진 몸이 타격 대상이 아니라는 것도 그대로다
        INTENT-NPC-AUTONOMY-001         자율 존재는 이번 Cycle 에서 막지 않는다 —
                                        결정 목록에 막기가 들어가지 않는다 (01 EXCLUDED)
        INTENT-MINING-001               막는 중에는 채굴도 시작되지 않는다 (R1 — 사유 정정:
                                        기존 관문이 자동으로 막는 것이 아니라, 자세가 시작할 수
                                        있는 것을 걸음과 멈춤으로 좁히기 때문이다)
        INTENT-MOTION-OBSERVE-001       관찰되는 행동 종류에 막기가 더해진다
        INTENT-WORLD-OBSERVATION-001    관찰되는 세계에 방어력·막는 상태·타격 내역이 더해진다
