# C011 — World Implementation

> 입력: `03-world-semantic.md` · 현재 `world/` (C001~C010) · `protocol/`
> 03 의 이름과 의미를 그대로 따른다. 새 파일을 만들지 않았다 —
> 이 Cycle 이 더한 것은 자세가 지니는 시각 하나와 몸이 지니는 열림 하나뿐이므로
> 그것을 소유하는 기존 자리(`semantic/combat.ts` · `rules/guard.ts`)가 그대로 소유한다.

## IMPLEMENTED

    ── ADDED State ──────────────────────────────────────────────────
    Actor.GuardStartedAt                world/semantic/actor.ts
    Actor.ExposedUntil                  world/semantic/actor.ts
    Actor.Exposed (파생)                world/semantic/combat.ts  isExposed()
    Self.PerfectWindowOpen (파생)       world/semantic/combat.ts  isPerfectWindowOpen()
    Self.GuardRearmAt (파생)            world/semantic/combat.ts  guardRearmAt()
    StrikeEvent 5종 확장                world/semantic/combat.ts  StrikeEvent
        counterBonus · counter · perfectGuard · guardElapsed · cpGained
    MutableAttribute 'exposedFor'       world/semantic/combat.ts  MUTABLE_ATTRIBUTES
        → command catalog 은 이 목록을 단일 출처로 쓰므로 저절로 따라온다 (C009 구조)

    ── ADDED 상수 5종 ───────────────────────────────────────────────
    PERFECT_GUARD_WINDOW   0.20   world/semantic/combat.ts   (원본 §8.2)
    PERFECT_GUARD_CP_GAIN  10                                (원본 §8.2)
    EXPOSED_DURATION       0.8                               (원본 §8.2)
    COUNTER_DAMAGE_BONUS   0.25                              (원본 §8.4)
    GUARD_REARM_LOCK       0.6                               (C011 소유 — 02 R1)

    ── ADDED Rule ───────────────────────────────────────────────────
    RULE-PERFECT-GUARD-001              world/rules/guard.ts
        isPerfectGuard() · guardElapsed() · perfectGuardGain()
        C010 의 RULE-GUARD-ABSORB-001 과 같은 형태다 — 실행 순서를 따로 갖지 않고
        RULE-STRIKE-DAMAGE-001 이 이 판정과 계산을 불러 쓴다.
        독립 이름을 두는 이유는 "읽어 낸 방어는 자원을 번다" 가 이 Cycle 의 중심이기 때문이다
    RULE-EXPOSE-001                     world/rules/guard.ts  ruleExpose()
        max() 로 세운다 — 겹쳐도 깊어지지 않고 끝나는 시각만 뒤로 밀린다
    RULE-COUNTER-001                    world/rules/strike-damage.ts 단계 2
        상태를 바꾸지 않고 값만 정하므로 별도 함수로 떼지 않았다 —
        떼면 인자 셋을 넘겨 값 셋을 돌려받는 형태가 되어 읽기가 더 나빠진다.
        03 이 "RULE-STRIKE-DAMAGE-001 Transition 2 가 이 Rule 의 본문이다" 라고
        이미 그렇게 정의해 두었다

    ── CHANGED Rule ─────────────────────────────────────────────────
    RULE-GUARD-SET-001                  world/rules/guard.ts
        Precondition 5 (GUARD_REARM_LOCK) 추가 · Failure(guard-rearming) 추가
        Transition 에 GuardStartedAt = time 추가
        **멱등 분기를 Precondition 앞으로 올렸다** — 이미 guard 인 몸에 오는 guard 요청은
        아무것도 바꾸지 않고 success 로 끝난다. 그래서 세워 둔 자세를 두드려도
        시각이 다시 찍히지 않는다 (창의 재발행 금지 — 이것이 R1 의 절반이다).
        같은 이유로 evaluateGuardSet 의 재세움 검사는 stance ≠ guard 일 때만 건다 —
        아무것도 바꾸지 않는 요청을 거절할 이유가 없고, 막고 있는 동안 계속
        "막을 수 없다" 로 보이면 관찰이 거짓이 된다
    RULE-STRIKE-DAMAGE-001              world/rules/strike-damage.ts
        단계 2(되받아침 증폭) 추가 — 감쇄·막힘 판정보다 앞이다
        단계 5·6-A(완벽 판정과 그 결과) 추가 — 보통 막기(6-B) 앞에 선다
        StrikeEvent 에 5종을 더 싣는다
    RULE-DOWNED-001                     world/rules/strike-damage.ts
        ExposedUntil = 0 추가
    RULE-ATTRIBUTE-SET-001              world/rules/attribute-set.ts
        stance = guard 를 넣으면 GuardStartedAt = World.Time 도 함께 찍는다
        exposedFor 를 넣으면 ExposedUntil = World.Time + 값 (0 이면 그 자리에서 닫힌다)
        applyNumeric 이 World.Time 을 받도록 인자가 하나 늘었다
    Spawn                               world/semantic/spawn.ts
        guardStartedAt = -GUARD_REARM_LOCK · exposedUntil = 0
        음수 초기값은 세계가 시작하자마자도 막을 수 있게 하기 위한 것이다

## REUSED

    Actor.Stance · GuardBrokenUntil          world/semantic/actor.ts        (C010) 그대로
    isGuardBlocking · guardCost              world/rules/guard.ts           (C010) 그대로
    ruleGuardBreak                           world/rules/guard.ts           (C010) 그대로
    RULE-SWING-STRIKE-001                    world/simulation/swing-strike.ts
        **코드를 한 줄도 바꾸지 않았다.** `!outcome?.guarded` 라는 기존 조건이
        완벽한 막기(guarded = true)에도 그대로 맞기 때문이다 —
        완벽하게 막은 몸도 피격 반응으로 넘어가지 않는다.
        03 이 이것을 CHANGED 에 둔 이유는 코드가 아니라 그 조건의 **뜻**이 넓어졌기 때문이다
    RULE-ACTION-BEGIN-001 · RULE-MOVE-MODE-001 · RULE-SKILL-BUDGET-001 · RULE-HIT-001
        변경 없음 (03 AFFECTED 그대로)
    clamp · cpMax                            world/semantic/combat.ts       (C007) 그대로
    World.Time · Tick                        world/clock.ts · simulation/   (C003) 그대로
    Command Catalog                          world/semantic/command-catalog.ts
        MUTABLE_ATTRIBUTES 를 단일 출처로 읽으므로 코드 변경이 없다 (C009 가 의도한 대로)

## AFFECTED UPDATED

    world/tests/combat.spec.ts       MutableAttribute 목록 기대값에 exposedFor 추가
    world/tests/command.spec.ts      같은 목록 (두 곳에 적힌 것이 아니라 두 관점의 검증이다)
    그 밖의 기존 테스트는 손대지 않았다 — 196개가 그대로 통과한다

## PROJECTION

    entities.character.stance.startedAt        world/projection/observer-view.ts
    entities.character.stance.perfectWindow    같은 파일
    entities.character.exposure                같은 파일 (exposed · until)
    strikes[].timing                           같은 파일 (perfect · elapsed · counter ·
                                               counterBonus · energyGained)
    hud self.guardStartedAt · self.perfectWindow · self.guardRearmAt ·
        self.exposed · self.exposedUntil       같은 파일
    interactions.guard.reason(+guard-rearming) 같은 파일 (evaluateGuardSet 이 단일 출처)
    SPEC_ID                                    VIEW-PERFECT-GUARD-TURNS-THE-TABLE-001

    protocol/gameview.ts
        StanceView + startedAt · perfectWindow
        ExposureView (신설)
        StrikeTimingView (신설) · StrikeEventView.timing
        EntityView.exposure

    04 계약의 모든 항목이 투영된다. 판정과 관찰이 같은 함수를 쓴다 —
    evaluateGuardSet 하나가 거절 사유와 "왜 안 되는가" 를 동시에 낸다 (C010 원칙 그대로).

## TESTS

    world/tests/perfect-guard.spec.ts   31개 — 전부 통과

        INTENT-GUARD-ONSET-001 (4)
            세우는 순간의 시각이 찍힌다 / 재요청은 시각을 바꾸지 않는다 /
            놓아도 시각은 남는다 / 놓았다 세우면 새 시각이 된다
        INTENT-PERFECT-GUARD-001 (5)
            창 안 → 생명·기력 그대로에 +10 / 창 밖 → C010 그대로 /
            자세를 잃지 않는다 / CpMax 를 넘지 않는다 / 뒤에서는 완벽할 수 없다
        INTENT-PERFECT-GUARD-ONCE-001 (3)
            곧바로 다시 못 세운다(guard-rearming) / 한 호흡 뒤엔 된다 / 연타가 통하지 않는다
        INTENT-EXPOSED-001 · EXPIRES (6)
            막힌 자가 열린다 / 스스로 가신다 / 하던 일이 끊기지 않는다 /
            보통 막기는 열지 않는다 / 쓰러지면 사라진다 / 열린 몸도 막을 수 있다
        INTENT-COUNTER-001 (6)
            본래 피해부터 커진다 / 안 열렸으면 그대로 / 감쇄보다 앞이다 /
            고급 스킬도 같다 / 막고 있어도 실린다 / 자율 존재도 열린다
        INTENT-TIMING-BREAKDOWN-001 · OBSERVE (3)
            자기 창·재세움 시각이 눈앞에 있다 / 남의 것도 보인다 / 한 줄로 재구성된다
        DC-COMBAT-PLAYER-CAUSALITY (2)
            같은 세계를 두 번 굴리면 같은 StrikeEvent (toEqual)
        CYCLE GOAL (2)
            읽어 낸 한 바퀴가 실제로 돈다 / 읽지 못하면 그대로 C010 이다

    world/tests (전체)                  227개 통과 (기존 196 + 새 31)
    npm run catalog:check               카탈로그 3원소 정합

## NOTES

    ── 읽는 막기를 세계 안에서 재현하는 방법 (테스트 설계) ─────────────

    완벽한 막기는 "고정된 시간을 기다린 뒤 세우기" 로는 재현되지 않는다 —
    휘두름이 호를 그리며 쓸고 지나가므로(C006 R1) 언제 닿는지가 자리에 따라 다르기 때문이다.
    그래서 테스트는 사람이 하는 것과 같은 순서를 쓴다:

        swingAndReadIt()   상대가 휘두르기 시작한 뒤, **칼이 실제로 나오는 것**
                           (swing.active)을 보고 나서야 자세를 세운다
        guardAndWait()     자세를 먼저 세우고 창이 닫힐 때까지 기다린다

    두 함수가 같은 무대에서 다른 결과를 내는 것이 이 Cycle 의 전부다.
    스킬 길이나 거리가 달라져도 그대로 성립한다 — 고정 시간을 쓰지 않기 때문이다.

    ── 연타가 통하지 않는 것을 넘어 손해가 되는 것 (발견) ──────────────

    03 은 재세움 간격이 "창의 재발행을 막는다" 까지만 정했다.
    실제로 굴려 보니 그보다 강한 결과가 나온다 — 놓는 것은 언제나 되고 세우는 것만
    간격이 들므로, 연타하면 **첫 요청으로 선 자세를 스스로 풀어 버린 뒤 다시 서지 못한 채**
    맞는다. 창을 되풀이 열려는 시도가 막히는 데 그치지 않고 손해가 된다.
    의미를 더한 것이 아니라 정해진 규칙에서 따라 나온 결과이므로 03 을 고치지 않고
    테스트("막기를 연타해도 창이 계속 열리지는 않는다")로 남긴다.

    ── 밀려남과 열림의 관계 (Human Play 확인 대상) ──────────────────────

    완벽하게 막아도 몸은 밀린다 (C006·C010 그대로 — 03 REUSED).
    그래서 되받아치려면 밀려난 만큼을 한 걸음 좁혀야 하고, 그 한 걸음까지 열림
    0.8초 안에 들어가야 한다. CYCLE GOAL 테스트가 이것을 실측한다 —
    한 걸음(4 Tick ≈ 0.13초) + 휘두름이 닿기까지가 0.8초 안에 들어간다.

    여유가 크지 않다. 실제 조작에서 이것이 답답한지는 Human Play 확인의 판단 대상이며,
    고치는 자리는 EXPOSED_DURATION 하나다 (다른 의미를 건드리지 않는다).

    ── 무너짐과의 관계 ──────────────────────────────────────────────────

    완벽한 막기는 기력을 치르지 않으므로 무너짐 조건(Cp < CpPaid)에 닿지 않는다.
    코드에서도 6-A 가 6-B/6-C 보다 앞에 서므로 완벽하게 막는 몸은 무너뜨릴 수 없다.
    C010 의 무너짐 규칙에 갈래를 더하지 않았다 (03 AFFECTED 그대로).
