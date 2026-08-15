# CYCLE C011 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable        (Server + Client 실측 완료 · **Human Play 확인 대기**)
[PASS] Regression
[PASS] Catalog

## NEW BEHAVIOR

    창 안에서 막음                  → 생명도 기력도 잃지 않고 기력을 오히려 얻는다
    창 밖에서 막음                  → C010 그대로 (생명 조금 · 기력 크게)
    완벽하게 막힘                   → 때린 자가 잠시 열린다
    열린 몸을 때림                  → 본래 피해가 커진 채로 계산이 시작된다
    막기를 놓고 곧바로 다시 세움    → 거절된다 (사유: guard-rearming)
    막기를 연타                     → 자세가 서지 않는다 (놓기만 통하므로 스스로 연다)
    세워 둔 자세에 같은 요청        → 아무것도 바뀌지 않는다 (창이 다시 열리지 않는다)
    쓰러짐                          → 열림이 남지 않는다
    열린 채로 막음                  → 막을 수는 있으나 열림은 닫히지 않는다

## WORLD SCENARIO — 실측 (`world/tests/perfect-guard.spec.ts` · 31 통과)

    완벽하게 막아 냄 (INTENT-PERFECT-GUARD-001 · REWARD)
        Before  Stance = open · Hp 200 · Cp 30 · Defense 5
        Input   PLAYER_2 가 휘두르고, **칼이 나오는 것(swing.active)을 보고 나서야**
                PLAYER 가 자세를 세운다 (swingAndReadIt — 사람이 반응하는 것과 같은 순서)
        Rule    RULE-GUARD-SET-001 → RULE-STRIKE-DAMAGE-001 5 · 6-A
                (→ RULE-PERFECT-GUARD-001 · RULE-EXPOSE-001)
        After   Hp 200 (그대로) · Cp 40 (+10) · Stance = guard 유지
                StrikeEvent { base 20, mitigated 15, guarded true, perfectGuard true,
                              guardElapsed <= 0.20, cpPaid 0, cpGained 10, amount 0 }
                PLAYER_2.ExposedUntil = 타격 시각 + 0.8
                CurrentAction ≠ hit — 완벽하게 막아 낸 타격도 자세를 흩뜨리지 않는다

    창이 닫힌 뒤의 막기 (C010 그대로)
        Before  자세를 세우고 PERFECT_GUARD_WINDOW + 4 Tick 을 기다린다
        After   Hp -2.25 · Cp -10.2 · perfectGuard false · guardElapsed > 0.20
                PLAYER_2 는 열리지 않는다
                → **같은 자세, 같은 타격, 다른 결과.** 갈린 것은 두 시각의 차이 하나다

    되받아침 (INTENT-COUNTER-001)
        Before  PLAYER_2 를 exposedFor 로 열어 둔다 (RULE-ATTRIBUTE-SET-001 — 세계 밖의 손)
        Input   PLAYER 의 기본 스킬(본래 20)
        Rule    RULE-STRIKE-DAMAGE-001 단계 2 (RULE-COUNTER-001)
        After   base 25 · counterBonus 5 · counter true
                mitigated = max(2.5, 25 - 5) = 20 — 증폭이 감쇄보다 앞이라는 것이 수치로 보인다
                base - counterBonus = 20 으로 증폭 전 값을 되짚을 수 있다
        고급 스킬(본래 55)도 같은 비율 → base 68.75

    재세움 간격 (INTENT-PERFECT-GUARD-ONCE-001 · 02 R1)
        놓고 곧바로 다시 세움        → Failure(guard-rearming) · 자세가 서지 않는다
        GUARD_REARM_LOCK 뒤          → Success
        세워 둔 자세에 재요청        → Success 이되 GuardStartedAt 이 바뀌지 않는다
                                       (perfectWindow 가 거짓 그대로)
        매 Tick 연타                 → 자세가 서 있지도 않은 채 맞는다
                                       (guarded false · guardElapsed null)

    열림의 성질 (INTENT-EXPOSED-001 · EXPIRES)
        스스로 가신다 (EXPOSED_DURATION 뒤 exposed = false)
        하던 행동이 끊기지 않는다 (state 가 attack/idle/move 로 이어진다)
        쓰러지면 사라진다 (downed → exposed false · until 0)
        열린 몸도 막을 수 있고, 막아도 열림은 닫히지 않는다
        자율 존재도 열린다 (Control 을 보지 않는다)

    한계 (INTENT-PERFECT-GUARD-REWARD-001)
        Cp = CpMax 인 몸이 완벽하게 막으면 cpGained 0 · Cp 는 CpMax 그대로
        → 늘어나는 것은 새 자원이 아니라 지금까지 써 온 그 기력이다

    결정론 (DC-COMBAT-PLAYER-CAUSALITY)
        같은 세계를 두 번 세워 같은 순서로 굴린 StrikeEvent 두 개가 `toEqual` 로 일치한다
        (완벽한 막기 · 되받아침 두 경우 모두)

## VIEW FIXTURE — 실측 (`view/tests/perfect-guard.spec.ts` · 16 통과, World 미기동)

    perfect-guard.fixture.json      창 안의 자세 · 완벽하게 막힌 타격 · 열린 몸 ·
                                    되받아친 타격 · 창 밖의 보통 막기
        표지에 perfectWindow = true 가 실리고, 열린 몸에 exposed = true 가 실린다
        완벽한 타격 한 줄  "완벽하게 막음 (0.15초) · 기력 +10"   (기력 - 가 없다)
        되받아친 타격 한 줄 "되받음 +5 · 25 → 22"                (emphasis 로 크게)
        창 밖 타격 한 줄   "20 → 15 · 막음 (0.94초) · 기력 -10.2"
        → 같은 스킬의 세 줄이 나란히 놓여 무엇이 갈랐는지가 시간으로 설명된다

    guard-rearming.fixture.json     방금 놓아 다시 세울 수 없는 상태 · 내가 열려 있는 상태
        guardUnavailableText "방금 자세를 세웠다 — 다시 세우려면 한 호흡이 필요하다"
        guardRearmIn 0.35 (self.guardRearmAt - world.time — View 가 자기 시계를 만들지 않는다)

    옛 계약 견딤                     timing · exposure 가 없는 관찰 결과도 그려진다
                                    (perfect/counter/exposed 가 모두 false 로 떨어진다)

    기존 Fixture 4종 갱신 후에도 C007·C009·C010 의 검증이 그대로 통과한다

## PLAYABLE — 실측 (Server + Client 전송 경로)

    `npm run build` 통과 후, 실제 World 서버(`tsx server/main.ts`)에 클라이언트와 **같은 경로**
    (WebSocket + `protocol/transport`)로 관찰자 둘을 붙여 한 바퀴를 굴렸다.
    검증용 스크립트는 실측 뒤 지웠다 — 세계와 계약에는 아무것도 남기지 않는다.

        spec                VIEW-PERFECT-GUARD-TURNS-THE-TABLE-001
        막기 전             hp 200 · cp 30
        (상대가 휘두르고, 칼이 나오는 것을 보고 막는다)
        타격 breakdown      { base 20, mitigated 15, guarded true, energyPaid 0,
                              guardBroken false }
        타격 timing         { perfect true, elapsed 0.033, counter false,
                              counterBonus 0, energyGained 10 }
        막은 뒤             hp 200 · cp 40
        상대 열림           { exposed true, until 7.628 }   (타격 시각 + 0.8)
        (자세를 놓고, 밀려난 만큼을 좁혀 되받아친다)
        되받아치기 직전     거리 1.86 · 열림 남음 0.27초
        되받아침 breakdown  { base 25, mitigated 20, guarded false }
        되받아침 timing     { perfect false, counter true, counterBonus 5 }
        되받아친 뒤         cp 52
        연타                RULE-GUARD-SET-001 이 guard-rearming 으로 거절하고
                            interactions.guard.available 이 false 로 내려온다

    → **Cycle Goal 이 실제 전송 경로 위에서 달성된다.**
      읽어서 막으면 아무것도 잃지 않고 기력을 벌며, 상대가 열리고, 그 열림 안에
      되받아쳐 커진 피해를 낸다. 그리고 그 한 바퀴가 끝나면 고급 스킬이 열린다
      (시작 30 + 완벽 10 + 기본 스킬 충전 12 = 52 ≥ 소모 30).

    관찰된 여유 — 되받아치기 직전 열림이 0.27초 남았다.
    밀려난 거리를 좁히는 데 대부분이 쓰인다. 실제 조작에서 이것이 촉박한지는
    Human Play 확인의 판단 대상이며, 고치는 자리는 EXPOSED_DURATION 하나다.

## REGRESSION

    03 AFFECTED 로 표시한 기존 Rule 을 전부 재실행했다.

    RULE-GUARD-BREAK-001         still works  (C010 guard.spec.ts — 무너짐 시나리오 그대로)
    RULE-GUARD-ABSORB-001        still works  (창 밖 막기가 C010 의 값과 소수점까지 같다)
    RULE-ACTION-BEGIN-001        still works  (막는 중 스킬·채굴 불가 · guarding 사유)
    RULE-MOVE-MODE-001           still works  (run 요청이 자세를 놓는다)
    RULE-SKILL-BUDGET-001        still works  (완벽하게 막혀도 때린 자는 정산한다)
    RULE-HIT-001                 still works  (막지 못한 타격은 여전히 피격 반응)
    RULE-SWING-STRIKE-001        still works  (코드 무변경 — 조건의 뜻만 넓어졌다)
    RULE-NPC-DECIDE-001          still works  (자율 존재는 여전히 막지 않는다)
    RULE-BODY-PUSH / MOMENTUM    still works  (완벽하게 막아도 몸은 밀린다)
    RULE-DOWNED-001              still works  (+ 열림도 함께 지운다)
    RULE-ATTRIBUTE-SET-001       still works  (+ stance 가 시각을 함께 찍고 exposedFor 를 받는다)
    RULE-WORLD-TICK-001          still works  (새 Tick 단계 없음)

    과거 Cycle Scenario
        C010 guard.spec.ts               34 통과
        C007 combat.spec.ts              39 통과
        C009 command.spec.ts             24 통과
        C006 collision.spec.ts            8 통과
        C004 observer.spec.ts            26 통과
        C005 observer-mark.spec.ts       14 통과
        그 밖 world/ 전체                227 통과 (기존 196 + 새 31)
        view/ · server/ · tools/ 포함    476 통과 / 1 실패

    실패 1건 — `view/tests/motion-atlas.spec.ts` 의 시트 절단선 검사.
    **이 Cycle 이전부터 실패하고 있었다** — C011 변경을 stash 한 상태에서 같은 실패를 재현했다.
    그림 파일 판독 검사이며 이 Cycle 의 의미와 무관하다. 고치지 않고 사실만 남긴다.

## CATALOG

    `npm run catalog:check` → "카탈로그 3원소가 정합한다."
    이번 Cycle 은 존재 종류를 추가·변경하지 않았다 (새 kind 없음 · 새 정적 값 없음).
    C010 이 더한 Defense 처럼 카탈로그로 가는 값이 이번엔 없다 —
    더해진 다섯 상수는 전부 종류와 무관한 세계의 법칙이므로 `semantic/combat.ts` 에 있다.

## MASTER FEEDBACK

    Capability Overlay
        MC-PERFECT-GUARD   MISSING → IMPLEMENTED
            근거  이 문서의 WORLD SCENARIO "완벽하게 막아 냄" · PLAYABLE 실측.
                  Actor.GuardStartedAt · RULE-GUARD-SET-001(CHANGED) ·
                  RULE-PERFECT-GUARD-001 · PERFECT_GUARD_WINDOW.
                  Capability 의 semantic 이 요구한 "성패는 확률이 아니라 방어를 시작한 시각과
                  공격이 닿은 시각의 관계로 갈린다" 가 guardElapsed 로 관찰된다
        MC-COUNTER         MISSING → IMPLEMENTED
            근거  WORLD SCENARIO "되받아침" · "열림의 성질" · PLAYABLE 실측.
                  Actor.ExposedUntil · RULE-EXPOSE-001 · RULE-COUNTER-001.
                  overlay 가 적어 둔 부족분("노출 상태(Exposed)가 없어 되받아칠 순간이
                  세계에 존재하지 않는다")이 그대로 채워졌다
        MC-CP-ECONOMY      PARTIAL → PARTIAL (전진)
            근거  기력이 처음으로 **방어로 늘어난다** (cpGained 10).
                  C010 이 "방어가 같은 예산을 쓰기 시작한다" 를 채웠고, 이 Cycle 은
                  "그 예산을 방어로 벌 수도 있다" 를 더한다.
                  overlay 의 부족분 중 회피·자세 유지가 아직 남아 있으므로 PARTIAL 유지
        MC-COMBAT-CAUSE-READING  PARTIAL → PARTIAL (전진)
            근거  overlay 가 적어 둔 부족분은 "결과를 만든 배율과 조건이 없다" 였다.
                  이번에 조건(counter)과 그 몫(counterBonus), 그리고 판정을 가른 시간
                  (guardElapsed)이 StrikeEvent 에 실렸다. 배율 일반(Flow·Matchup)은
                  아직 없으므로 PARTIAL 유지
        MC-GUARD           IMPLEMENTED 유지 (C010) — 이 Cycle 이 그 위에 얹혔을 뿐이다

    Possibility
        MP-READ-AND-COUNTER
            요구 Capability 는 MC-GUARD · MC-PERFECT-GUARD · MC-COUNTER · MC-CP-ECONOMY 다.
            앞의 셋이 IMPLEMENTED 가 되었고 MC-CP-ECONOMY 는 PARTIAL 이다.
            요구 Knowledge 인 MK-OPPONENT-FLOW-PATTERN 은 아직 세계에 없다 —
            지금 읽는 것은 "칼이 나왔다" 하나뿐이고, 스킬마다 다른 패턴을 읽는 것은
            FR-FLOW-OPENS-THE-BODY 가 가져온다.
            **판정은 Master 가 한다** — 이 Cycle 은 관찰만 보고한다

    Constraint Evaluation
        DC-COMBAT-PLAYER-CAUSALITY    SATISFIED
            근거  다섯 갈래 어디에도 난수가 없고, 같은 세계를 두 번 굴린 StrikeEvent 가
                  `toEqual` 로 일치한다. 결과를 가른 두 시각의 차(guardElapsed)와
                  되받아침이 키운 몫(counterBonus)이 그대로 관찰된다 —
                  플레이어는 상수를 듣지 않고도 창의 경계를 값의 비교로 알아낸다
        DC-COMBAT-DEFENSE-IS-ACTIVE   SATISFIED (두 requires 모두)
            근거  첫 번째(defense_as_player_action)는 C010 이 닫았다.
                  **두 번째(defense_success_creates_offense_opportunity)를 이 Cycle 이 닫는다** —
                  막아 낸 것이 (1) 때릴 자원(cpGained 10 → 고급 스킬 개방)과
                  (2) 때릴 대상의 틈(ExposedUntil)을 함께 만든다.
                  PLAYABLE 이 그 한 바퀴를 실측했다
        DC-COMBAT-SHARED-BUDGET       SATISFIED
            근거  전용 자원을 신설하지 않았다. 늘어나는 것은 Actor.Cp 하나이며
                  CpMax 를 넘지 않는다. 그 기력은 여전히 고급 스킬·달리기와 경쟁한다

    Constraint Candidate
        관찰된 반복 패턴 하나를 보고한다 (승격 판단은 Human).

        "시간으로 끝나는 상태는 만료 Rule 없이 시각 비교로 산다"
            C010 의 GuardBrokenUntil, C011 의 ExposedUntil 이 같은 형태를 택했다 —
            상태를 세우는 Rule 만 두고 거두는 Rule 을 두지 않으며, 파생 상태로 관찰한다.
            새 Tick 단계가 늘지 않고, 관찰자가 남은 시간을 스스로 잴 수 있다는 점에서
            두 번 다 이득이었다. 세 번째 사례가 나오면 Constraint 후보로 볼 만하다.

        "밖의 손이 세운 상태는 세계의 규칙으로 도달 가능한 상태여야 한다"
            RULE-ATTRIBUTE-SET-001 이 stance = guard 를 넣을 때 GuardStartedAt 을
            함께 찍게 한 판단이다. 찍지 않으면 밖의 손이 "규칙으로는 만들 수 없는 몸" 을
            만들게 되고, 그 몸의 이후 거동이 세계의 설명과 어긋난다.
            C007 R2 가 "바뀐 뒤의 세계는 자기 규칙대로 간다" 고만 말한 자리를
            한 걸음 좁히는 규칙이다.

    Master Gap
        없음.

        다만 인계 하나를 적어 둔다 — MP-READ-AND-COUNTER 가 요구하는 Knowledge
        MK-OPPONENT-FLOW-PATTERN 은 이 Cycle 이 닫지 않는다.
        지금 플레이어가 읽는 것은 "칼이 나왔다" 하나이며, 스킬마다 다른 패턴을 읽는 일은
        FR-FLOW-OPENS-THE-BODY 가 가져온다. 상위 의미와 어긋난 것이 아니라
        같은 Possibility 안의 다음 조각이므로 Gap 이 아니라 인계다
        (C010 이 이 Cycle 에 requires 를 인계한 것과 같은 형태).

## FAILURES

    없음 — 7종 검사 전부 통과.

    통과 밖의 사실 두 가지를 남긴다.
        1. view/tests/motion-atlas.spec.ts 1건이 실패하나 이 Cycle 이전부터 실패했다
           (stash 상태에서 재현 확인). 이 Cycle 과 무관하다.
        2. 되받아치기까지의 여유가 0.27초로 촉박했다. 규칙의 실패가 아니라 수치의 문제이며
           Human Play 확인에서 판단할 대상이다 (EXPOSED_DURATION).

## STATUS
    IN PROGRESS

    Human Play 확인 이전에는 COMPLETE 로 바꾸지 않는다 (Guide Must).
    확인해 볼 것:
        1. 자율 존재의 공격을 보고 막았을 때 완벽 창 0.20초가 잡히는가
           (반응할 수 있는 창인가 — 너무 짧지 않은가)
        2. 되받아침까지 열림 0.8초가 충분한가 (밀려난 거리를 좁히는 데 대부분이 쓰인다)
        3. 재세움 0.6초가 답답하지 않은가
        4. 화면에서 "열린 몸" 과 "무너진 몸" 이 서로 구분되는가
        5. 완벽하게 막았을 때 "아무것도 잃지 않았다" 가 숫자를 읽지 않고도 느껴지는가

    셋 다 고치는 자리는 상수 하나씩이며 다른 의미를 건드리지 않는다 —
    PERFECT_GUARD_WINDOW · EXPOSED_DURATION · GUARD_REARM_LOCK.
