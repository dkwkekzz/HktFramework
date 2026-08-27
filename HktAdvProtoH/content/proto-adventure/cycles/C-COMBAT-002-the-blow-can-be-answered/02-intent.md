# CYCLE C-COMBAT-002 — Intent

## GOAL / POSSIBILITY

    GOAL-SURVIVE-THE-INCOMING-BLOW
        다가오는 한 타격을 받는 쪽이, 그 타격이 닿기 전에 자기 몫의 수를 두어
        그 한 방의 결과를 바꿀 수 있다.

        └── POSSIBILITY-ANSWER-THE-BLOW-AS-IT-ARRIVES
                몸에 끼워 둔 대답 하나를, 타격이 닿기 전의 구간에 실행한다.

    이 Goal 이 지금 없는 이유는 하나다 — **지금 세계에서 타격이 오는 순간은
    선택의 자리가 아니다.** 받는 쪽이 할 수 있는 일은 미리 막기를 켜 두는 것뿐이고,
    켜 둔 뒤의 그 순간은 결과를 받아 적는 시간일 뿐이다 (MC-ACTIVE-RESPONSE detail).

    갈라지는 다른 경로 — 세우지 않는다

        POSSIBILITY-TIME-THE-ANSWER-EXACTLY   언제 눌렀는가로 결과를 가른다
                                              → 01 EXCLUDED · 다음 후보
        POSSIBILITY-TURN-THE-ANSWER-INTO-A-TURN  대답이 다음 수를 연다
                                              → 01 EXCLUDED
        POSSIBILITY-HOLD-A-BETTER-STANCE      막기를 더 좋게 만든다 — 자세를 고치는
                                              것은 이 Goal 이 아니다. 이 Cycle 은
                                              C011 의 막기를 한 톨도 바꾸지 않는다

## INTENT SET

### INTENT-RESPONSE-SLOT-001 — 대답이 들어가는 자리

    모든 몸은 대답 자리를 **하나** 가진다.

    그 자리에 지금 무엇이 들어 있는가가 그 몸의 상태이며,
    같은 자리에서 나온 대답이라도 무엇이 들어 있었는가에 따라 다른 일이 일어난다.

    자리는 하나뿐이므로 대답을 부르는 길도 하나다.
    대답의 종류가 늘어도 그 길은 늘지 않는다.

    이 Cycle 에서 그 자리에 들어가는 것은 **한 종류**다 (INTENT-RESPONSE-DEFLECT-001).
    자리가 하나라는 것과 그 자리에 무엇이 들어갈 수 있는가는 다른 질문이며,
    후자는 이 Cycle 의 몫이 아니다.

### INTENT-RESPONSE-WINDOW-001 — 대답할 수 있는 시간

    자기에게 닿을 수 있는 타격이 다가오는 동안, 그 타격에 대답할 수 있는 구간이
    열려 있다. 타격이 닿는 순간 그 구간은 닫힌다.

    구간은 **타격마다** 열린다 — 몸의 상태가 아니라 다가오는 그 한 방의 성질이다.
    둘이 동시에 다가오면 구간도 둘이다.

    구간의 경계는 치는 쪽이 지닌 값에서 나온다. 받는 쪽이 보는 시간과 치는 쪽이
    사는 시간은 같은 값이어야 한다 — 어긋나면 "닿았는데 아직 대답할 수 있다" 가 된다.

    **구간 안이면 언제 실행했든 결과가 같다.** 언제 눌렀는가로 결과가 갈리는 것은
    이 Cycle 이 세우지 않는다 (01 EXCLUDED).

### INTENT-RESPONSE-DEFLECT-001 — 쳐낸다 (이 Cycle 의 한 종류)

    대답 자리에 쳐내기를 둔 몸은, 다가오는 타격의 구간 안에 대답을 실행하여
    **그 한 타격의 최종 피해를 정해진 몫만큼 덜어낼 수 있다.**

    쳐낸 것은 그 한 타격뿐이다 — 다음 타격에는 다시 대답해야 한다.
    덜어낸 뒤에도 남는 것이 있다. 없던 일이 되지 않는다.

    쳐내기는 **방향을 묻지 않는다.** 막기가 정면에서 오는 것에만 서는 자세라면,
    쳐내기는 다가오는 그 한 타격을 지목해 치르는 한 번이다.
    막기가 시간을 묻지 않고 쳐내기가 방향을 묻지 않는 것이 둘이 갈리는 자리다.

### INTENT-RESPONSE-COST-001 — 대답의 대가

    대답을 실행하는 순간 그 몸의 기력이 정해진 만큼 줄어든다.
    치를 것이 모자라면 대답은 실행되지 않는다.

    대가는 **실행하는 순간에 정해져 있다** — 얼마나 큰 타격이었는지를 뒤에 세어
    치르지 않는다. 막기가 맞은 만큼 치르는 것과 갈리는 자리다.

    새로 만드는 주머니가 없다. 기술과 달리기와 대답이 같은 기력을 다툰다.

### INTENT-RESPONSE-NONE-IS-NORMAL-001 — 대답하지 않는 것이 정상이다

    대답하지 않은 타격은 지금까지와 **한 톨도 다르지 않게** 지난다.

    이것은 예외 처리가 아니라 기본 경로다. 대답은 살아남기 위한 요구가 아니라
    했을 때 달라지는 것이며, 하지 않는 몸도 방어 능력 · 걸어 둔 것 · 자리 ·
    막기로 그대로 살아간다.

    그러므로 이 Cycle 은 **대답하지 않은 쪽의 수치를 올리지도 내리지도 않는다.**

### INTENT-RESPONSE-OBSERVABLE-001 — 대답에 대해 보이는 것

    다음 넷이 보는 이에게 드러난다.

        지금 대답할 수 있는가        구간이 열려 있고 치를 것이 있는가
        자리에 무엇이 있는가         이 몸의 대답이 무엇인지
        안 되면 왜 안 되는가         거절 사유 하나 — 세계가 고른다
        그 타격이 대답을 받았는가     대답한 타격과 대답하지 않은 타격의 셈이 갈려 실린다

    되는지 안 되는지도, 왜 안 되는지도 세계가 정하고 보내는 값이다.
    보는 쪽이 기력과 비용을 스스로 견주어 만들어내지 않는다.

    남의 몸의 대답 자리도 가려지지 않는다 — 상대가 무엇으로 대답하는 몸인지를
    알아야 그 앞에서 무엇을 칠지 고를 수 있다.

## DESIGN TRACE

    INTENT-RESPONSE-SLOT-001
        Source Goal         GOAL-SURVIVE-THE-INCOMING-BLOW
        Source Possibility  POSSIBILITY-ANSWER-THE-BLOW-AS-IT-ARRIVES
        Master              MG-SURVIVE-ENEMY-OFFENSIVE · MC-ACTIVE-RESPONSE
        Constraint          DC-COMBAT-ONE-RESPONSE-INPUT (자리가 하나 · 길도 하나)

    INTENT-RESPONSE-WINDOW-001
        Source Goal         GOAL-SURVIVE-THE-INCOMING-BLOW
        Source Possibility  POSSIBILITY-ANSWER-THE-BLOW-AS-IT-ARRIVES
        Master              MC-ACTIVE-RESPONSE (world_shape — "닿기 전에 대응할 수 있는 시간")
        Constraint          DC-COMBAT-PLAYER-CAUSALITY (확률이 개입하지 않는다)

    INTENT-RESPONSE-DEFLECT-001
        Source Goal         GOAL-SURVIVE-THE-INCOMING-BLOW
        Source Possibility  POSSIBILITY-ANSWER-THE-BLOW-AS-IT-ARRIVES
        Master              MP-READ-AND-COUNTER (전진 — 읽고 대답하는 첫 걸음)
        Constraint          DC-COMBAT-ONE-FORMULA (한 공식을 바꾸지 않고 그 결과에 건다)

    INTENT-RESPONSE-COST-001
        Source Goal         GOAL-SURVIVE-THE-INCOMING-BLOW
        Source Possibility  POSSIBILITY-ANSWER-THE-BLOW-AS-IT-ARRIVES
        Master              MP-STORE-AND-RELEASE (전진 — 치르는 것이 있어야 저장이 뜻을 갖는다)
        Constraint          DC-COMBAT-SHARED-BUDGET (새 게이지 없음)

    INTENT-RESPONSE-NONE-IS-NORMAL-001
        Source Goal         GOAL-SURVIVE-THE-INCOMING-BLOW
        Source Possibility  POSSIBILITY-ANSWER-THE-BLOW-AS-IT-ARRIVES
        Master              MC-ACTIVE-RESPONSE (world_shape 마지막 줄)
        Constraint          DC-COMBAT-RESPONSE-IS-OPTIONAL-MASTERY ·
                            DC-COMBAT-ONE-LAYER-AT-A-TIME

    INTENT-RESPONSE-OBSERVABLE-001
        Source Goal         GOAL-SURVIVE-THE-INCOMING-BLOW
        Source Possibility  POSSIBILITY-ANSWER-THE-BLOW-AS-IT-ARRIVES
        Master              MC-ACTIVE-RESPONSE (world_shape — "관찰 가능해야 한다")
        Constraint          DC-WORLD-OWNS-THE-SURFACE-LIST ·
                            DC-COMBAT-UNAVAILABLE-HAS-A-REASON

## EXISTING INTENT DELTA

    REUSED

        INTENT-SKILL-PHASE-001 (C019)
            행동 안에 시점이 있고 그 경계를 기술이 지닌다.
            **대답 구간은 이 시점을 받는 쪽에서 읽은 것이다** — 새 시간축을 만들지 않는다
        INTENT-SKILL-SHAPE-001 (C025)
            휘두름이 닿는 모양을 기술이 지닌다.
            "이 타격이 나에게 닿을 수 있는가" 의 재료가 여기 있다
        INTENT-DAMAGE-CALCULATE-001 (C010)
            한 공식이 최종 피해를 낸다. **대답은 이 식을 바꾸지 않는다**
        INTENT-STRIKE-DAMAGE-001 (C006 · C010)
            접촉 시점마다 판정한다 — 그래서 "닿기 전" 이 실재하는 시간이다
        INTENT-GUARD-* (C011)
            자세로서의 막기. **한 문장도 바뀌지 않는다**

    ADDED

        INTENT-RESPONSE-SLOT-001 · INTENT-RESPONSE-WINDOW-001 ·
        INTENT-RESPONSE-DEFLECT-001 · INTENT-RESPONSE-COST-001 ·
        INTENT-RESPONSE-NONE-IS-NORMAL-001 · INTENT-RESPONSE-OBSERVABLE-001

    CHANGED

        없음.

        **최종 피해에 무언가가 더 걸린다는 사실은 새것이 아니다** — C011 의 막기가
        이미 그 자리에 있다 (RULE-GUARD-BLOCK-001 이 FinalDamage 뒤에 붙는다).
        대답은 같은 자리에 나란히 서는 둘째이며, 기존 문장을 고쳐 쓰지 않는다.
        둘이 함께 성립할 때의 뜻(어느 순서로 걸리는가)은 World Semantic 이 정한다.

    AFFECTED

        INTENT-GUARD-MITIGATE-001 (C011)
            같은 타격에 막기와 대답이 함께 걸릴 수 있다. 서로를 무효로 만들지 않는다
        INTENT-HIT-REACTION-001 (C002)
            대답한 타격도 여전히 타격이다 — 맞은 반응이 사라지지 않는다
        INTENT-NPC-AUTONOMY-001 (C002)
            자율 존재도 대답 자리를 가진다. 그 몸이 대답을 쓰는가는 그 판단의 몫이며,
            **쓰지 않아도 이 Cycle 은 성립한다** (INTENT-RESPONSE-NONE-IS-NORMAL-001)
        INTENT-SKILL-BUDGET-001 · INTENT-SKILL-COST-GATE-001 (C007)
            기력을 다투는 것이 하나 늘었다 — 기술 · 달리기 · 막기에 대답이 넷째다.
            치를 것이 모자라 거절하는 관문의 형태도 이미 여기 있다

## NOTE — 세계에 재료가 있는지 미리 대조한 것

    Intent 는 구현을 정하지 않으나, **없는 의미를 만들어내지 않았음**은 밝혀 둔다.
    아래 넷이 이미 세계에 있어 이 Intent 들이 지어낸 것이 아니다.

        "아직 닿지 않았다"      `skillPhase` 의 startup (world/semantic/combat.ts)
        "언제 닿는가"           `swingBegin` — 기술이 지닌 값
        "닿을 수 있는 거리인가"   `skillShape` 의 arc · reach · tipRadius (C025)
        "치를 것"               `cp` (world/semantic/actor.ts)

    확정하지 않은 것은 Stage 3 의 몫이다 — 대답 자리를 어떤 상태로 두는가,
    구간을 저장하는가 매번 세는가, 쳐낸 몫이 막기와 어느 순서로 걸리는가.
