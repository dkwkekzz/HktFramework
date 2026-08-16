# C011 — Intent

> R1 개정 (Human Review 이전, World Semantic 착수 중 발견) — 자세를 놓았다 세우는 데
> 아무 대가가 없으면 INTENT-PERFECT-GUARD-ONCE-001 의 "되풀이되지 않는다" 가
> 세계에서 성립하지 않는다. 여닫기를 반복하면 창이 매번 새로 열리기 때문이다.
> **자세를 다시 세우기까지 한 호흡이 든다** 를 같은 Intent 안에 명시한다.
> 다른 Intent 의 의미는 바뀌지 않는다.
> 영향: INTENT-PERFECT-GUARD-ONCE-001 문안 · EXISTING INTENT DELTA 의
> INTENT-GUARD-BEGIN-GATE-001 항목(REUSED → CHANGED).

> 입력: `01-cycle.md` (Frontier FR-PERFECT-GUARD-TURNS-THE-TABLE · R1)
> 아래 Goal / Possibility 는 **Cycle-local** 의미다. 지속적인 상위 Goal / Possibility 는
> `master/graph/` 가 소유하며, 이 Cycle 의 상위 출처는 01-cycle.md 의 MASTER TRACE 에 있다.
>
> C010 은 막기를 **자세(Stance)** 로 세웠다 — 행동 칸을 쓰지 않고 행동과 나란히 유지되며
> 무엇을 시작할 수 있는지를 좁히는 몸의 태세. 이 Cycle 은 그 자세에 **언제 세웠는가** 를
> 더한다. 새 자세도 새 행동도 만들지 않는다.

## GOAL / POSSIBILITY

    GOAL-DEFENSE-EARNS-THE-TURN     막아 낸 것이 그 자리에서 때릴 기회가 된다
        └── POSSIBILITY-READ-THE-TIMING       읽어서 세운 막기는 버티는 막기와 다른 결과를 낸다
        └── POSSIBILITY-DEFENDER-GAINS-CP     읽어 낸 방어는 자원을 치르지 않고 오히려 번다

    GOAL-TIMING-NOT-CHANCE          무엇이 갈렸는지를 우연이 아니라 시각이 설명한다
        └── POSSIBILITY-TWO-CLOCKS            막기를 세운 시각과 타격이 닿은 시각, 그 차이 하나가 가른다
        └── POSSIBILITY-WINDOW-OPENS-ONCE     그 창은 자세를 세우는 순간에만 열리고 곧 닫힌다

    GOAL-OPENING-IS-A-PLACE         "틈" 이 비유가 아니라 세계 안에 실재하는 구간이다
        └── POSSIBILITY-EXPOSED-STATE         완벽하게 막힌 자는 잠시 열린 상태가 된다
        └── POSSIBILITY-EXPOSED-EXPIRES       그 구간은 시간으로 끝나며 되돌릴 일이 없다

    GOAL-COUNTER-REWARDS-THE-READ   읽어 낸 뒤에 들어간 한 방이 평소보다 크다
        └── POSSIBILITY-COUNTER-AMPLIFIES     열린 상대를 때린 타격은 본래 피해부터 커진다
        └── POSSIBILITY-OPENING-IS-FOR-ANYONE 열린 몸은 누구에게든 열려 있다

    GOAL-TIMING-OBSERVABLE          왜 완벽했고 왜 아니었는지가 그 자리에서 읽힌다
        └── POSSIBILITY-TIMING-BREAKDOWN      타격 내역에 시간 차와 완벽 여부가 함께 실린다
        └── POSSIBILITY-OPENING-VISIBLE       누가 지금 열려 있고 언제까지인지 보인다

## INTENT SET

    ── 시점이 가르는 막기 ────────────────────────────────────────────

    INTENT-GUARD-ONSET-001

        막는 자세를 세운 몸은 **언제 세웠는가** 를 함께 지닌다.
        C010 의 자세는 "지금 막고 있는가" 만을 알았다 — 그것만으로는
        읽어서 세운 막기와 세워 두고 기다린 막기를 구별할 수 없다.
        세운 시각은 자세를 세우는 그 순간에 정해지고, 자세가 이어지는 동안 바뀌지 않는다.
        자세를 놓았다가 다시 세우면 새 시각이 된다 — 그것이 다시 읽었다는 뜻이다.

    INTENT-PERFECT-GUARD-001

        막는 자세로 정면에서 타격을 받은 Actor 는,
        그 타격이 닿은 시각이 자세를 세운 시각으로부터 아주 짧은 창 안에 있으면
        **완벽하게 막아 낸 것**이다.
        창을 벗어난 뒤에 닿은 타격은 C010 의 보통 막기 그대로 받아낸다 —
        같은 자세, 같은 방향, 같은 타격인데 결과가 갈린다.
        갈리는 것은 오직 두 시각의 관계이며 그 밖의 어떤 것도 개입하지 않는다.
        방향 조건은 보통 막기와 똑같다 — 시점이 맞아도 옆이나 뒤에서 들어온 타격은
        애초에 막힌 것이 아니므로 완벽할 수도 없다.

    INTENT-PERFECT-GUARD-ONCE-001 (R1)

        하나의 자세에서 완벽한 막기는 되풀이되지 않는다.
        창은 자세를 세우는 순간에 열려 짧은 시간 뒤 닫히며,
        닫힌 창은 그 자세가 이어지는 동안 다시 열리지 않는다.
        세워 두고 버티는 것으로 계속 완벽할 수는 없다 —
        다시 완벽하려면 자세를 놓고 다시 세워야 하고, 그 사이의 몸은 열려 있다.
        이것이 읽는 일과 버티는 일을 갈라 놓는 자리다.

        그리고 자세를 다시 세우는 일에는 한 호흡이 든다 (R1).
        방금 세운 자세를 놓고 곧바로 다시 세울 수는 없다 —
        놓는 것은 언제나 되지만, 세우는 것은 직전에 세운 뒤 얼마간이 지나야 된다.
        이것이 없으면 자세를 여닫는 것만으로 창이 끊임없이 새로 열려
        "되풀이되지 않는다" 가 말뿐인 문장이 된다.
        읽는다는 것은 한 번의 결정이지 계속 누르고 있는 일이 아니다.
        세우지 못한 요청은 세계를 바꾸지 않으며, 요청한 자는 그 이유를 안다.

    INTENT-PERFECT-GUARD-REWARD-001

        완벽하게 막아 낸 타격은 생명을 전혀 덜어내지 않는다.
        치르는 기력도 없다 — 읽어 낸 방어는 공짜다.
        그뿐 아니라 막아 낸 자는 정해진 만큼의 기력을 **얻는다**.
        지금까지 이 세계에서 기력이 도는 길은 때려서 맞히는 것 하나뿐이었다 (C007).
        여기서 두 번째 길이 열린다 — 읽어서 막아 내는 것.
        얻은 기력이 그 몸이 지닐 수 있는 한계를 넘지는 않는다.
        늘어나는 것은 새 자원이 아니라 지금까지 써 온 그 기력이다.

    ── 열림 ──────────────────────────────────────────────────────────

    INTENT-EXPOSED-001

        완벽하게 막힌 타격을 낸 Actor 는 그 순간 **열린 상태**가 된다.
        열림은 정해진 세계 시각까지 이어지는, 그 몸이 지니는 상태다.
        열려 있다는 것 자체는 아프지도 않고 몸을 굳히지도 않는다 —
        하던 일은 하던 대로 이어지고, 움직임도 그대로다.
        달라지는 것은 그동안 받는 타격의 결과뿐이다.
        열림은 완벽하게 막아 낸 자가 가지는 것이 아니라 막힌 자가 지불하는 것이다.

    INTENT-EXPOSED-EXPIRES-001

        열림은 시간이 흐르면 스스로 가신다. 닫기 위해 해야 할 일은 없다.
        열려 있는 동안 다시 완벽하게 막히면 열림이 깊어지거나 겹쳐 쌓이지 않는다 —
        끝나는 시각이 뒤로 밀릴 뿐이다.
        열린 몸도 스스로 막을 수 있다. 막는다고 열림이 닫히지는 않는다 —
        막으면서도 크게 맞을 수 있다는 것이 읽힌 자의 처지다.
        쓰러진 몸에는 열림이 남지 않는다.

    ── 되받아침 ──────────────────────────────────────────────────────

    INTENT-COUNTER-001

        열려 있는 Actor 에게 닿은 타격은 **되받아침**이 된다.
        되받아침은 그 타격의 본래 피해를 정해진 만큼 키운다 —
        방어력이 걷어내기 전, 막기가 나누기 전, 가장 앞에서 커진다.
        따라서 열린 상대가 막고 있어도 커진 몫이 그대로 그 계산에 실린다.
        되받아침의 조건은 "맞은 자가 열려 있는가" 하나다.
        때린 자가 누구인지, 어떤 스킬인지, 앞인지 뒤인지는 따지지 않는다.
        열림을 만든 자만이 되받아칠 수 있는 것도 아니다 —
        열린 몸은 그 자리의 누구에게든 열려 있다.

    ── 관찰 ──────────────────────────────────────────────────────────

    INTENT-PERFECT-GUARD-OBSERVE-001

        누가 지금 열려 있고 그 열림이 언제 가시는지는 그 몸을 보는 누구에게나 드러난다.
        막고 있는 몸을 조종하는 이는 자기 자세가 아직 완벽한 창 안에 있는지를 안다 —
        읽어야 할 것은 상대의 공격이지 자기 세계의 규칙이 아니기 때문이다.

    INTENT-TIMING-BREAKDOWN-001

        한 번의 타격이 낳은 내역에는 시점이 무엇을 했는지가 함께 실린다 —
        완벽하게 막혔는지, 자세를 세운 뒤 얼마 만에 닿았는지,
        되받아침이었는지, 되받아침이 본래 피해를 얼마나 키웠는지,
        그리고 막아 낸 자가 기력을 얼마나 얻었는지.
        보는 이는 결과 하나가 아니라 그 결과를 만든 시각의 관계를 읽는다.
        같은 두 시각이면 언제나 같은 내역이 나온다.

## DESIGN TRACE

    INTENT-GUARD-ONSET-001
        Source Goal         GOAL-TIMING-NOT-CHANCE
        Source Possibility  POSSIBILITY-TWO-CLOCKS
        Master              MC-PERFECT-GUARD · DC-COMBAT-PLAYER-CAUSALITY (observable_cause)
    INTENT-PERFECT-GUARD-001
        Source Goal         GOAL-TIMING-NOT-CHANCE · GOAL-DEFENSE-EARNS-THE-TURN
        Source Possibility  POSSIBILITY-TWO-CLOCKS · POSSIBILITY-READ-THE-TIMING
        Master              MC-PERFECT-GUARD · DC-COMBAT-PLAYER-CAUSALITY
    INTENT-PERFECT-GUARD-ONCE-001
        Source Goal         GOAL-TIMING-NOT-CHANCE
        Source Possibility  POSSIBILITY-WINDOW-OPENS-ONCE
        Master              MC-PERFECT-GUARD (버티기와 읽기를 가르는 조건)
    INTENT-PERFECT-GUARD-REWARD-001
        Source Goal         GOAL-DEFENSE-EARNS-THE-TURN
        Source Possibility  POSSIBILITY-DEFENDER-GAINS-CP
        Master              MC-PERFECT-GUARD · MC-CP-ECONOMY (PARTIAL 을 획득 쪽에서 민다) ·
                            DC-COMBAT-SHARED-BUDGET (새 자원이 아니라 같은 기력)
    INTENT-EXPOSED-001
        Source Goal         GOAL-OPENING-IS-A-PLACE
        Source Possibility  POSSIBILITY-EXPOSED-STATE
        Master              MC-COUNTER · DC-COMBAT-DEFENSE-IS-ACTIVE
                            (defense_success_creates_offense_opportunity — C010 이 인계한 requires)
    INTENT-EXPOSED-EXPIRES-001
        Source Goal         GOAL-OPENING-IS-A-PLACE
        Source Possibility  POSSIBILITY-EXPOSED-EXPIRES
        Master              MC-COUNTER
    INTENT-COUNTER-001
        Source Goal         GOAL-COUNTER-REWARDS-THE-READ
        Source Possibility  POSSIBILITY-COUNTER-AMPLIFIES · POSSIBILITY-OPENING-IS-FOR-ANYONE
        Master              MC-COUNTER · DC-COMBAT-PLAYER-CAUSALITY
                            (명시된 노출 조건이 성립할 때만 커진다)
    INTENT-PERFECT-GUARD-OBSERVE-001
        Source Goal         GOAL-TIMING-OBSERVABLE
        Source Possibility  POSSIBILITY-OPENING-VISIBLE
        Master              DC-COMBAT-PLAYER-CAUSALITY (observable_cause)
    INTENT-TIMING-BREAKDOWN-001
        Source Goal         GOAL-TIMING-OBSERVABLE
        Source Possibility  POSSIBILITY-TIMING-BREAKDOWN
        Master              DC-COMBAT-PLAYER-CAUSALITY (explainable_result) ·
                            MC-COMBAT-CAUSE-READING (PARTIAL 을 시점 쪽에서 밀어 준다)

## EXISTING INTENT DELTA

    REUSED
        INTENT-GUARD-STANCE-001         (C010) 자세 구조를 그대로 쓴다 —
                                        새 자세도, 완벽 전용 자세도 만들지 않는다
        INTENT-GUARD-DIRECTION-001      (C010) 완벽 판정도 같은 정면 조건 위에서만 성립한다
        INTENT-GUARD-EXCLUSIVE-001      (C010) 막는 동안 스킬을 못 여는 것도 그대로다.
                                        완벽하게 막은 뒤 되받아치려면 자세를 놓아야 하며,
                                        놓는 것에는 조건이 없으므로 새 규칙이 필요 없다
        INTENT-GUARD-BREAK-001          (C010) 무너짐은 그대로다 — 완벽한 막기는 기력을
                                        치르지 않으므로 무너뜨릴 수 없다. 새 갈래가 없다
        INTENT-DEFENSE-MITIGATION-001   (C010) 방어력 감쇄는 그대로 작동한다.
                                        완벽한 막기에서는 그 결과가 생명에 닿지 않을 뿐이다
        INTENT-VITALITY-001             (C007) 자원은 여전히 생명과 기력 둘뿐이다
        INTENT-WORLD-CLOCK-001          (C003) 두 시각의 비교도, 열림이 가시는 것도
                                        기존 세계 시간 위에서 일어난다
        INTENT-BODY-FACING-001          (C006) 새 방향 개념 없음
        INTENT-ATTRIBUTE-OBSERVE-001    (C007 R2) 열림도 숨기지 않는다
        INTENT-ATTRIBUTE-MUTATE-001     (C007 R2) 열림을 세계 밖의 손으로 세워 볼 수 있다 —
                                        혼자서도 되받아침을 확인할 수 있어야 한다
        INTENT-PER-OBSERVER-PROJECTION-001  (C004) 완벽 창이 남았는지는 자기 투영에 얹힌다

    CHANGED
        INTENT-GUARD-BEGIN-GATE-001     (C010) — R1 (REUSED 에서 옮겨 옴)
            기존  쓰러지지 않았고, 하던 일을 그만둘 수 있고, 치를 기력이 남아 있고,
                  무너진 여파가 가신 몸만이 막기를 시작할 수 있다
            변경  여기에 하나가 더해진다 — 직전에 자세를 세운 뒤 한 호흡이 지나야 한다.
                  놓는 것은 여전히 언제나 된다. 시작하지 못한 이유는 그대로 관찰된다
                  (INTENT-PERFECT-GUARD-ONCE-001 을 세계에서 성립시키는 조건)
        INTENT-GUARD-ABSORB-001         (C010)
            기존  막는 자세로 정면에서 받은 타격은 언제나 생명 대신 기력으로 치러진다
            변경  그것은 이제 **창이 닫힌 뒤** 의 막기다.
                  창 안에서 받은 타격은 기력을 치르지 않고 오히려 벌어들인다
                  (INTENT-PERFECT-GUARD-REWARD-001).
                  받아내는 것 자체의 의미와 비율은 그대로다
        INTENT-GUARD-KEEPS-THE-STANCE-001  (C010)
            기존  막아 낸 타격은 자세를 흩뜨리지 않는다
            변경  완벽하게 막아 낸 타격도 마찬가지다 — 오히려 더욱 그렇다.
                  같은 이유로 완벽하게 막은 몸은 피격 상태로 넘어가지 않는다
        INTENT-STRIKE-DAMAGE-001        (C007·C010)
            기존  본래 피해에 방어력과 막는 자세가 작용해 남은 몫이 생명에서 나간다
            변경  그 앞에 한 단계가 더 붙는다 — 맞은 자가 열려 있으면 본래 피해가 먼저 커진다.
                  그리고 막힘의 갈래가 하나 늘어난다 — 시점이 맞으면 아무것도 잃지 않고 번다.
                  우연은 여전히 없다
        INTENT-DAMAGE-APPLY-001         (C007·C010)
            기존  덜어냄이 생명과 기력 두 자원으로 갈린다
            변경  덜어내지 않고 **더하는** 경우가 생긴다 —
                  완벽하게 막아 낸 자의 기력은 이 타격으로 늘어난다
        INTENT-SKILL-BUDGET-001         (C007)
            기존  기력은 때려서 맞혀야 돈다
            변경  읽어서 막아 내도 돈다. 두 길 모두 상대의 행동을 필요로 한다는 점은 같다 —
                  혼자서 기력을 불릴 수 있게 된 것은 아니다
        INTENT-STRIKE-OBSERVE-001       (C007·C010)
            기존  한 타격의 결과에 그 값을 만든 내역이 함께 실린다
            변경  그 내역에 시점이 무엇을 했는지가 더해진다
                  (INTENT-TIMING-BREAKDOWN-001)
        INTENT-ENTITY-OBSERVE-001       (C007 R2·C010)
            기존  모든 Actor 의 이름·생명·자세·무너짐이 몸에서 읽힌다
            변경  지금 열려 있는지와 그 열림이 언제 가시는지도 함께 읽힌다

    AFFECTED
        INTENT-NPC-AUTONOMY-001         자율 존재는 여전히 막지 않으므로 완벽하게 막지도 않는다.
                                        그러나 **열리고 되받아침을 당한다** —
                                        결정 규칙은 그대로인 채 결과만 달라진다 (01 EXCLUDED 유지)
        INTENT-SKILL-COST-GATE-001      완벽하게 막아 얻은 기력이 곧바로 스킬을 열 수 있다.
                                        Gate 자체는 그대로다
        INTENT-DOWNED-001               쓰러지면 열림도 남지 않는다
        INTENT-GUARD-OBSERVE-001        (C010) 관찰 목록에 열림과 완벽 창이 더해진다
        INTENT-MOTION-OBSERVE-001       완벽하게 막은 몸은 피격 동작으로 넘어가지 않는다 —
                                        관찰되는 동작이 달라진다
        INTENT-WORLD-OBSERVATION-001    관찰되는 세계에 열림과 시점 내역이 더해진다
