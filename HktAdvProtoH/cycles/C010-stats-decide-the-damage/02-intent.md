# C010 — Intent

> 이번 Cycle 은 새 행동도 새 자원도 만들지 않는다. 이미 일어나고 있는 한 가지 일 —
> "휘두름에 닿은 몸이 생명을 잃는다" — 의 **값이 어디서 오는가**만 바꾼다.
> 지금은 스킬이 정한 고정값 하나이고, 이후로는 공격자와 대상 양쪽이 함께 정한다.

## GOAL / POSSIBILITY

    GOAL-COMBAT-POWER-DIFFERS       같은 스킬도 휘두르는 자와 맞는 자가 누구냐에 따라
                                    다른 크기로 생명을 덜어낸다
        └── POSSIBILITY-ATTACK-AMPLIFY   공격 능력이 높은 존재가 같은 스킬로 더 깊게 벤다
        └── POSSIBILITY-DEFENSE-ABSORB   방어 능력이 높은 존재가 같은 공격을 덜 아프게 받는다
        └── POSSIBILITY-SKILL-DIFFER     스킬마다 그 능력을 피해로 바꾸는 정도가 다르다

    GOAL-DAMAGE-EXPLAINABLE         한 방의 크기는 우연이 아니라 설명되는 결과다
        └── POSSIBILITY-BREAKDOWN-OBSERVE  피해가 어떤 값들에서 어떻게 나왔는지 읽힌다
        └── POSSIBILITY-STAT-TUNE          그 값을 바꿔 보고 달라진 결과를 직접 확인한다

## INTENT SET

    ── 두 능력 ───────────────────────────────────────────────────────

    INTENT-ATTACK-POWER-001 (ADDED)

        세계의 모든 Actor 는
        자기 공격을 얼마나 강하게 만들어 내는지를 나타내는 공격 능력을 지닌다.
        존재의 종류가 그 값을 정한다.
        공격 능력이 높은 존재는 같은 스킬로 더 큰 피해를 만든다.
        공격 능력은 그 자체로 아무것도 일으키지 않는다 —
        스킬을 통해서만 피해에 기여한다.

    INTENT-DEFENSE-001 (ADDED)

        세계의 모든 Actor 는
        들어오는 공격 피해를 얼마나 줄여 받는지를 나타내는 방어 능력을 지닌다.
        존재의 종류가 그 값을 정한다.
        방어 능력은 피해를 줄일 뿐 없애지 못한다 —
        아무리 높아도 들어온 공격의 피해가 0 이 되지는 않는다.
        그리고 값이 높아질수록 같은 만큼 더 올렸을 때 줄어드는 피해의 폭은 점점 작아진다.

    ── 스킬이 능력을 피해로 바꾼다 ───────────────────────────────────

    INTENT-SKILL-SCALING-001 (ADDED)

        스킬은 두 가지를 가진다 —
        스킬 자체의 강함인 기본 피해량과,
        휘두르는 자의 공격 능력을 얼마나 피해로 바꾸는지를 나타내는 공격 계수다.
        둘 다 스킬마다 다르다.
        따라서 같은 존재가 휘둘러도 스킬에 따라 피해가 다르고,
        같은 스킬이라도 공격 능력이 다른 존재가 휘두르면 피해가 다르다.
        공격 계수가 큰 스킬일수록 공격 능력이 오를 때 더 크게 자란다.

    ── 하나의 계산 ───────────────────────────────────────────────────

    INTENT-DAMAGE-CALCULATE-001 (ADDED)

        타격이 일어나면 세계는 두 단계로 그 크기를 정한다.
        먼저 그 스킬의 기본 피해량에 휘두른 자의 공격 능력이 그 스킬의 공격 계수만큼
        더해져 공격 피해가 나온다.
        그 다음 맞는 자의 방어 능력이 그 공격 피해를 줄여 최종 피해가 나온다.
        세계에는 이 계산 하나만 있다 — 어떤 타격도 다른 방식으로 크기가 정해지지 않는다.
        계산에는 우연이 개입하지 않는다.
        같은 공격자와 같은 스킬과 같은 대상이면 언제나 같은 최종 피해가 나온다.

    INTENT-STRIKE-DAMAGE-001 (CHANGED — 고정값을 계산이 대신한다)

        스킬은 더 이상 자기 혼자 피해량을 정하지 않는다.
        휘두름에 닿은 몸이 잃는 생명은 공격자의 능력과 스킬의 성격과
        맞는 자의 방어 능력이 함께 정한 최종 피해다.
        맞고 안 맞고를 가르는 겨룸도, 값이 흔들리는 폭도 여전히 없다 —
        정해지는 방식이 바뀌었을 뿐 결과는 여전히 언제나 똑같다.
        고급 스킬이 기본 스킬보다 크게 깎는다는 관계는 유지된다.

    ── 설명되는 한 방 ────────────────────────────────────────────────

    INTENT-DAMAGE-BREAKDOWN-001 (ADDED)

        한 번의 타격은 자기가 어떻게 그 크기가 되었는지를 함께 남긴다 —
        스킬의 기본 피해량, 공격 능력이 더한 몫, 방어가 줄인 정도, 그리고 최종 피해다.
        보는 이는 숫자 하나가 아니라 그 숫자가 나온 경위를 읽는다.
        그래서 값을 바꾸고 다시 때렸을 때 무엇 때문에 결과가 달라졌는지 알 수 있다.

## DESIGN TRACE

    INTENT-ATTACK-POWER-001
        Source Goal         GOAL-COMBAT-POWER-DIFFERS
        Source Possibility  POSSIBILITY-ATTACK-AMPLIFY
        Master Trace        MG-OVERCOME-SUPERIOR-OPPONENT / MP-OUTGROW-THE-OPPONENT
                            → MC-ATTACK-POWER
    INTENT-DEFENSE-001
        Source Goal         GOAL-COMBAT-POWER-DIFFERS
        Source Possibility  POSSIBILITY-DEFENSE-ABSORB
        Master Trace        MG-OVERCOME-SUPERIOR-OPPONENT / MP-OUTGROW-THE-OPPONENT
                            → MC-DEFENSE-MITIGATION
    INTENT-SKILL-SCALING-001
        Source Goal         GOAL-COMBAT-POWER-DIFFERS
        Source Possibility  POSSIBILITY-SKILL-DIFFER
        Master Trace        MG-OVERCOME-SUPERIOR-OPPONENT / MP-OUTGROW-THE-OPPONENT
                            → MC-SKILL-SCALING
    INTENT-DAMAGE-CALCULATE-001
        Source Goal         GOAL-COMBAT-POWER-DIFFERS
        Source Possibility  POSSIBILITY-ATTACK-AMPLIFY · POSSIBILITY-DEFENSE-ABSORB
        Constraint          DC-COMBAT-ONE-FORMULA (계산은 하나다) ·
                            DC-COMBAT-PLAYER-CAUSALITY (우연이 없다)
    INTENT-STRIKE-DAMAGE-001 (CHANGED)
        Source Goal         GOAL-COMBAT-POWER-DIFFERS
        Source Possibility  POSSIBILITY-ATTACK-AMPLIFY · POSSIBILITY-DEFENSE-ABSORB
    INTENT-DAMAGE-BREAKDOWN-001
        Source Goal         GOAL-DAMAGE-EXPLAINABLE
        Source Possibility  POSSIBILITY-BREAKDOWN-OBSERVE
        Constraint          DC-COMBAT-PLAYER-CAUSALITY (결과의 원인이 관찰된다)

    POSSIBILITY-STAT-TUNE 은 새 Intent 를 낳지 않는다 —
    기존 INTENT-ATTRIBUTE-MUTATE-001 이 "어떤 존재의 어떤 속성이든" 을 이미 담고 있고,
    새로 생긴 두 능력이 그 대상에 자동으로 포함되기 때문이다 (AFFECTED 참조).

## EXISTING INTENT DELTA

    REUSED
        INTENT-VITALITY-001          생명·기력 두 자원 구조는 그대로다. 새 자원은 없다
        INTENT-SKILL-BUDGET-001      기력 수지는 이 Cycle 이 건드리지 않는다 —
                                     충전·소모는 피해와 무관하게 지금 그대로 돈다
        INTENT-SKILL-COST-GATE-001   기력이 모자라면 시작되지 않는다, 그대로다
        INTENT-DOWNED-001            생명이 0 이면 쓰러진다, 그대로다.
                                     쓰러진 몸이 대상이 되지 않는다는 것도 그대로다
        INTENT-ACTION-STATE-001      휘두름은 여전히 하나의 행동이다
        INTENT-ACTION-COLLIDER-001   충돌체 구조 그대로 — 누가 맞았는지 정하는 방식은 불변이다
        INTENT-BODY-OCCUPY-001       타격 대상 판정은 기존 몸 그대로다
        INTENT-TEMPO-MOVE-001        템포 능력치는 이번 계산 밖에 있다
        INTENT-TEMPO-ACTION-001      위와 같음 — 얼마나 자주 치는가는 이번 Cycle 의 주제가 아니다
        INTENT-MODIFIER-COMPOSE-001  배율 합성은 지금의 네 값(충전률·소비율·이동·공격 속도)
                                     그대로다. 공격·방어 능력에 배율이 걸리는 것은
                                     이후 층이다 — 이번엔 그 자리를 열지 않는다
        INTENT-ATTRIBUTE-OBSERVE-001 세계가 속성을 숨기지 않는다는 원칙 그대로다
        INTENT-ATTRIBUTE-MUTATE-001  값을 바꾸는 것은 여전히 세계다.
                                     요청 경로도 판정 방식도 새로 만들지 않는다

    CHANGED
        INTENT-STRIKE-DAMAGE-001
            기존  스킬은 저마다 정해진 피해량을 가지고,
                  닿은 몸은 그 값만큼 언제나 똑같이 생명을 잃는다
            변경  스킬은 기본 피해량과 공격 계수를 가지고,
                  닿은 몸이 잃는 값은 공격자의 공격 능력과 자신의 방어 능력까지
                  함께 정한 최종 피해다. 흔들림이 없다는 성질은 유지된다

        INTENT-DAMAGE-APPLY-001
            기존  타격은 맞은 자의 생명을 그 스킬의 피해량만큼 덜어낸다
            변경  덜어내는 값이 그 타격의 최종 피해다.
                  생명이 0 아래로 내려가지 않는 것과,
                  기존 피격 반응(행동 중단·밀려남)과 함께 일어나는 것은 그대로다

        INTENT-SWING-IMPACT-001
            기존  닿은 몸은 밀쳐지는 것에 더해 그 스킬의 고정 피해를 받는다
            변경  닿은 몸이 받는 것은 계산된 최종 피해다.
                  밀어냄(충격량)은 이 계산의 영향을 받지 않는다 —
                  얼마나 아픈지와 얼마나 밀리는지는 서로 다른 일이다

        INTENT-STRIKE-OBSERVE-001
            기존  누가 누구를 어느 스킬로 얼마나 깎았는지가 맞은 자리에 드러난다
            변경  그 자리에 최종 피해뿐 아니라 그것이 나온 경위까지 함께 드러난다
                  (INTENT-DAMAGE-BREAKDOWN-001)

    AFFECTED
        INTENT-ATTRIBUTE-OBSERVE-001 관찰되는 속성 목록에 공격 능력과 방어 능력이 더해진다.
                                     새 관찰 경로를 만드는 것이 아니라 실리는 것이 늘어난다
        INTENT-ATTRIBUTE-MUTATE-001  바꿀 수 있는 속성 목록에 두 능력이 더해진다.
                                     플레이어가 값을 바꿔 차이를 직접 만드는 것은 이 경로다
        INTENT-SELF-OBSERVE-001      자기 정보에 두 능력이 더해지고,
                                     스킬 정보의 "얼마나 깎는가" 가
                                     기본 피해량 + 공격 계수로 나뉘어 보인다
        INTENT-NPC-AUTONOMY-001      자율 존재도 같은 계산 아래에 있다 —
                                     자기 공격 능력으로 때리고 자기 방어 능력으로 받는다.
                                     결정 방식 자체는 바뀌지 않는다
        INTENT-WORLD-OBSERVATION-001 관찰되는 세계에 두 능력과 계산 내역이 더해진다
