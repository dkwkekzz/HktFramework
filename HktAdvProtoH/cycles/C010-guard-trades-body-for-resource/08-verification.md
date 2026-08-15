# CYCLE C010 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable        (Server + Client 실측 완료 · **Human Play 확인 대기**)
[PASS] Regression
[PASS] Catalog

## NEW BEHAVIOR

    막지 않음                        → 방어력이 걷어낸 뒤 남은 피해가 생명에서 나간다
    막고 정면에서 맞음               → 생명은 조금, 기력이 대신 크게 나간다
    막고 있으나 치를 기력이 모자람   → 방어가 무너지고 본래 피해를 그대로 받는다
    막고 있으나 옆·뒤에서 맞음       → 막지 않은 것과 같다
    무너진 직후                      → 1.5초 동안 다시 막지 못한다 (사유가 관찰된다)
    막는 동안                        → 스킬·채굴을 시작할 수 없다. 걸음은 된다
    달리기로 전환                    → 막기를 놓는다
    쓰러짐                           → 자세가 남지 않는다

## WORLD SCENARIO — 실측 (`world/tests/guard.spec.ts` · 34 통과)

    막아 냄 (INTENT-GUARD-ABSORB-001)
        Before  Stance = guard · Facing = 공격자 쪽 · Hp 200 · Cp 30 · Defense 5
        Input   PLAYER_2 의 기본 스킬(본래 피해 20)이 정면에서 닿는다
        Rule    RULE-STRIKE-DAMAGE-001 4-A (→ RULE-GUARD-ABSORB-001)
        After   Hp 197.75 (-2.25) · Cp 19.8 (-10.2) · Stance = guard 유지
                StrikeEvent { base 20, mitigated 15, guarded true, cpPaid 10.2,
                              amount 2.25, guardBroken false }
                CurrentAction ≠ hit — 막아 낸 타격은 자세를 흩뜨리지 않는다

    무너짐 (INTENT-GUARD-BREAK-001)
        Before  Stance = guard · Cp 10.19 (한 번 치르기에 0.01 모자람)
        Input   같은 타격
        Rule    RULE-STRIKE-DAMAGE-001 4-B → RULE-GUARD-BREAK-001
        After   Hp -15 (본래대로) · Cp 0 · Stance = open ·
                GuardBrokenUntil = World.Time + 1.5 · CurrentAction = hit
                StrikeEvent { guarded false, guardBroken true }

    방어력의 바닥 (INTENT-DEFENSE-MITIGATION-001)
        Before  Defense 를 9999 로 올린다 (C007 R2 경로)
        Input   기본 스킬(본래 20), 막지 않음
        After   Hp -2 = 20 × MIN_DAMAGE_RATIO — 0 이 되지 않는다

    방향 (INTENT-GUARD-DIRECTION-001)
        같은 자세로 정면에서 맞으면 guarded = true,
        등을 돌린 채 맞으면 guarded = false 이고 amount 가 mitigated 전부다

    결정론 (DC-COMBAT-PLAYER-CAUSALITY)
        같은 세계를 두 번 세워 같은 순서로 굴린 StrikeEvent 두 개가 `toEqual` 로 일치한다

    공유 예산 (DC-COMBAT-SHARED-BUDGET)
        고급 스킬 한 번 분량(30)만 쥔 채 한 번 막으면
        interactions[skill-heavy].reason 이 insufficient-cp 가 된다

## VIEW FIXTURE — 실측 (`view/tests/guard.spec.ts` · 19 통과, World 미기동)

    guard.fixture.json          막는 중 · 타격 3종
        표지에 guarding = true 가 실린다
        막아 낸 타격     "-2.3"  detail "20 → 15 · 막음 · 기력 -10.2"
        무너뜨린 타격    "-50"   detail "20 → 15 · 방어 무너짐"  guarded = false
        막지 않은 타격   "-17"   detail "20 → 17"
        self.stance = 막기 · lines 에 "방어력 5"
        attack.unavailableText = "막는 중에는 할 수 없다"
        move 는 여전히 available — 걸음은 자세에 막히지 않는다

    guard-broken.fixture.json   무너진 여파 안
        self.guardBroken = true
        guard.unavailableText = "방어가 무너져 아직 다시 막을 수 없다"

    자세를 싣지 않는 대상(광맥)에서 표지가 만들어지지 않는다 — 터지지 않는다

## PLAYABLE — Server + Client 실측

### ① 별도 프로세스 연결 (`npm run build` → `npm run world` → WebSocket 접속)

    빌드    dist/index.html 16.04 kB · index-*.js 547.82 kB — 성공
    기동    [world] 세계가 돌기 시작했다 — http://localhost:5180 (ws /world)

    관찰자가 붙어 받은 첫 관찰 결과 (실제 소켓 수신값 그대로):

        specId              VIEW-GUARD-TRADES-BODY-FOR-RESOURCE-001
        내 몸               Player 1  HP 200  CP 30
        stance 계약         {"guarding":false,"broken":false,"brokenUntil":0,
                             "facing":{"x":0,"z":1}}
        defense 계약        5
        guard interaction   {"id":"guard","role":"set-guard-stance","available":true}
        hud self.stance     {"id":"self.stance","kind":"label","value":"open"}
        hud self.defense    {"id":"self.defense","kind":"counter","value":5}
        mutable 목록        hp hpMax cp cpMax moveSpeed runSpeedMultiplier
                            actionSpeed moveMode defense stance

        >>> SetStance(guard) 요청 전송
        <<< 다음 관찰에 자세가 반영됨   stance.guarding = true
            attack 가용성   {"available":false,"reason":"guarding", …}
            hud self.stance {"value":"guard"}

    Client 는 상태를 바꾸지 않았다 — 요청을 보냈고, 세계가 판정했고,
    바뀐 결과가 다음 관찰로 돌아왔다 (World Authority 유지).

### ② 화면에 실제로 그려지는 것 (World 구동 + Render Plan 통과, 9장면)

    ── 1. 마주 섰다 ─────────────────────────────────────────────
      몸 위      Player 1  HP 200/200
      내 정보    HP 200/200  CP 30/100  자세 평상  (방어력 5)
      [Q] 막기 → 가능        [F] 기본 스킬 → 가능

    ── 2. 막지 않고 맞았다 ──────────────────────────────────────
      몸 위      Player 1  HP 185/200
      타격       -15   20 → 15

    ── 3. 막는 자세를 세웠다 ────────────────────────────────────
      몸 위      Player 1  HP 185/200  [⛊ 막는 중]
      내 정보    자세 막기
      [F] 기본 스킬 → 불가: 막는 중에는 할 수 없다
      >>> [F] 요청 → {"status":"failure","rule":"RULE-SKILL-BEGIN-001","reason":"guarding"}

    ── 4. 막아 냈다 ─────────────────────────────────────────────
      몸 위      Player 1  HP 183/200  [⛊ 막는 중]
      내 정보    HP 183/200  CP 20/100  자세 막기
      타격       -2.3   20 → 15 · 막음 · 기력 -10.2
      >>> [WASD] 막은 채로 걷기 → success
          걸으며 자세 유지 = true  (행동 = move)

    ── 5. 두 번째를 막아 냈다 ───────────────────────────────────
      HP 181/200  CP 10/100  [⛊ 막는 중]
      타격       -2.3   20 → 15 · 막음 · 기력 -10.2

    ── 6. 세 번째 — 무너졌다 ────────────────────────────────────
      몸 위      Player 1  HP 166/200  [✕ 방어 무너짐]
      내 정보    CP 0/100  자세 평상 — 방어가 무너져 아직 다시 막을 수 없다
      타격       -15   20 → 15 · 방어 무너짐

    ── 7. 여파 안 ───────────────────────────────────────────────
      >>> [Q] 요청 → {"status":"failure","rule":"RULE-GUARD-SET-001","reason":"guard-broken"}

    ── 8. 여파가 스스로 가셨다 ──────────────────────────────────
      몸 위      Player 1  HP 166/200          (✕ 표시가 사라졌다)
      [Q] 막기 → 불가: 기력이 모자란다          (이제 막지 못하는 이유가 바뀌었다)

    ── 9. 막고 있었지만 등 뒤에서 맞았다 ────────────────────────
      타격       -15   20 → 15                 (막음 표기가 없다 — 막히지 않았다)

    Cycle Goal 의 한 문장이 이 아홉 장면에 그대로 들어 있다 —
    앞을 향해 막아 생명 대신 기력으로 받아냈고(3~5), 기력이 다하자 무너져 그대로 맞았다(6).

### ③ 남은 것 — Human Play

    사람이 브라우저에서 직접 Q 를 눌러 위 흐름을 확인하는 것은 아직 남아 있다.
    STATUS 를 COMPLETE 로 올리지 않는 이유가 이것이다 (Guide MUST).
    확인 절차:  `npm run build` → `npm run world` → http://localhost:5180
                자율 존재에게 다가가 맞아 보고, Q 로 막고, 기력이 마를 때까지 버틴다.

## REGRESSION

    전체 실행   28 파일 430 테스트 → **429 통과 · 1 실패**
                world 12 파일 196 통과 (기존 162 + 신규 34)
                view  16 파일 234 중 233 통과

    실패 1건    view/tests/motion-atlas.spec.ts
                "move 는 1·2행이 맞닿아 있어 완전히 나눌 수 없다 — 경고로 고정한다"
                → `git stash` 로 C010 변경을 걷어내고 재실행해 **base 에서도 같은 실패**를
                  확인했다. 그림 시트 자산의 문제이며 C010 과 무관하다.

    03 AFFECTED 항목별 확인
        RULE-SKILL-BEGIN-001    막는 중 guarding 으로 거절 · 그 외에는 C007 그대로 (attack.spec 통과)
        RULE-MINE-001           막는 중 guarding · 평상시 채굴 정상 (mine.spec 7 통과)
        RULE-MOVE-001           막은 채로 걷기 성공 · 기존 이동 그대로 (move.spec 5 통과)
        RULE-HIT-001            막으면 hit 아님 · 못 막으면 hit · **쓰러진 몸은 hit 로 덮이지 않음**
                                (이 세 번째가 실제로 기존 테스트 3개를 깨뜨렸고, 조건을 명시해 고쳤다)
        RULE-SKILL-BUDGET-001   막혔어도 때린 자는 정산한다 (combat.spec 통과)
        RULE-CP-RUN-DRAIN-001   변경 없음 (combat.spec 통과)
        RULE-NPC-DECIDE-001     자율 존재는 막지 않는다 (npc.spec 5 통과)
        RULE-BODY-PUSH/MOMENTUM 막아도 밀린다 — 실측으로 확인 (collision.spec 8 통과)
        RULE-STRIKE-EVENT-EXPIRE 내용만 커졌다 (combat.spec 통과)
        RULE-WORLD-TICK-001     새 단계 없음 (world-tick.spec 9 통과)
        RULE-ATTRIBUTE-SET-001  목록에 defense·stance 추가 · 기존 8종 그대로 (command.spec 통과)

    과거 Cycle Scenario
        C001 채굴 · C002 행동/공격 · C004 다중 관찰자 · C005 표식 ·
        C006 충돌/방향 · C008 시점 · C009 명령 — 전부 통과

    C007 기대값 갱신 (의미 변경에 따른 정당한 갱신, 은폐 아님)
        피해 기대값을 본래 피해에서 mitigated(base) 로 바꿨다 —
        C010 이 "스킬이 정한 값이 그대로 나간다" 를 "방어력이 걷어낸 뒤가 나간다" 로
        바꿨기 때문이다 (03 SEMANTIC DELTA CHANGED). 테스트가 새 의미를 검증한다.

## CATALOG

    npm run catalog:check → "카탈로그 3원소가 정합한다."
    npm run catalog       → 두 종류 모두 방어력이 함께 관찰된다
        rabbit-swordsman  HP 200 · CP 100 시작 30 · 방어 5
        wanderer          HP 120 · CP 60 시작 20 · 방어 3
    존재 종류를 추가하지 않았고, 종류가 정하는 값 하나(defense)를 카탈로그에만 더했다.

## MASTER FEEDBACK

    Capability Overlay
        MC-GUARD               MISSING → IMPLEMENTED
            근거  이 문서 WORLD SCENARIO(막아 냄 · 무너짐) · PLAYABLE ② 3~7 장면.
                  Actor.Stance + RULE-GUARD-SET/ABSORB/BREAK-001 이 실행으로 닫혔다
        MC-DEFENSE-MITIGATION  MISSING → IMPLEMENTED
            근거  WORLD SCENARIO "방어력의 바닥" — 걷어내되 0 이 되지 않음을 실측했다.
                  단 지금 방어력의 원천은 존재 종류 하나뿐이다 (장비·자세는 이후 Cycle)
        MC-CP-ECONOMY          PARTIAL → PARTIAL (전진)
            근거  overlay 가 지목한 공백("방어·회피·자세가 같은 예산을 나눠 쓰지 않는다")
                  중 **방어**가 닫혔다 — 막기가 Cp 를 치르고, 막느라 쓴 기력을 고급 스킬에
                  쓸 수 없음을 실측했다 (DC-COMBAT-SHARED-BUDGET 항).
                  남은 공백은 회피(MC-EVADE)와 자세 유지(MC-FORTIFY)다.
        MC-COMBAT-CAUSE-READING PARTIAL → PARTIAL (전진)
            근거  overlay 가 지목한 공백("최종 수치 하나만 보이므로 왜 커졌는가를
                  재구성할 수 없다")이 타격 쪽에서 열렸다 — StrikeEvent 가 이제
                  base → mitigated → guarded/cpPaid → amount 를 모두 싣는다.
                  다만 이것은 방어 쪽 내역이다. 공격 쪽 배율·조건은 아직 없다
        MC-BODY-FACING         IMPLEMENTED 유지 — 새 방향 개념 없이 그대로 재사용했다

    Constraint Evaluation
        DC-COMBAT-SHARED-BUDGET      SATISFIED
            전용 게이지를 만들지 않았다. `MUTABLE_ATTRIBUTES` 에도 방어 게이지가 없고,
            막기는 기존 Cp 만 소모한다. 실측: 막은 뒤 고급 스킬이 insufficient-cp 로 막힌다
        DC-COMBAT-PLAYER-CAUSALITY   SATISFIED
            네 갈래 어디에도 난수가 없다. 같은 상태 두 번 → 같은 StrikeEvent (toEqual).
            결과를 만든 원인이 내역 6종으로 관찰된다 (explainable_result)
        DC-COMBAT-DEFENSE-IS-ACTIVE  PARTIALLY SATISFIED
            requires[defense_as_player_action]              충족 — 막기는 고르는 행동이고
                                                            고르는 대가(스킬 봉쇄·기력)가 있다
            requires[defense_success_creates_offense_opportunity]  이 Cycle 은 닫지 않았다.
            01 MASTER TRACE 의 Constraint Note 대로 MP-READ-AND-COUNTER 가 이어받는 몫이며
            MASTER GAP 이 아니다. **다만 Human 이 한 번 볼 값어치가 있는 관찰**이 나왔다 —
            PLAYABLE ② 에서 막기는 "덜 아프게 맞는 것" 으로만 읽힌다.
            공격권을 되찾는 수단이 아직 없으므로, 다음 Cycle 이
            FR-PERFECT-GUARD-TURNS-THE-TABLE 이 아니면 이 Constraint 는 계속 반쪽이다

    Constraint Candidate
        관찰된 반복 패턴 2건 — 승격 판단은 Human 소유다.

        ① "몸의 태세는 행동 칸을 쓰지 않는다"
           C010 이 자세를 도입하며 세운 형태다. 앞으로 올 Flow(MC-COMBAT-FLOW) ·
           Fortify(MC-FORTIFY) 도 같은 물음을 만난다 —
           행동으로 두면 "그 자세로 무엇을 하는가" 를 표현할 수 없다.
           지금 한 번 나온 판단이므로 Constraint 로 올리기에는 이르다 (2회 관찰 권장).

        ② "강한 결과에는 그 값을 만든 내역이 함께 실린다"
           C007 이 StrikeEvent 를 만들고 C010 이 그것을 내역으로 넓혔다 —
           같은 판단이 두 번 나왔다. MC-COMBAT-CAUSE-READING 이 요구하는 것과 겹치며,
           DC-COMBAT-PLAYER-CAUSALITY 의 requires[explainable_result] 를
           "관찰 계약에 내역을 싣는다" 로 구체화하는 후보가 될 수 있다.

    Master Gap
        없음. 상위 의미와 어긋난 지점은 발견되지 않았다.

## FAILURES

    없음 — 6종 검사 + Catalog 전부 통과.

    다만 다음 두 가지를 Human 판단으로 넘긴다 (검사 실패가 아니다).

    ① 수치 회전 — 03 의 설명에 대수 오류가 있어 R1 로 정정했다.
       Human Review 는 "시작 기력 30 으로 3대를 막고 4대째 무너진다" 를 보고 승인했으나
       실제는 **2대를 막고 3대째**다 (한 대당 기력 10.2 · PLAYABLE ② 4~6 장면).
       상수는 바꾸지 않았다 — 틀린 것은 설명이었다.
       짧다고 판단되면 고칠 자리는 GUARD_CP_PER_DAMAGE 하나이며 다른 의미는 건드리지 않는다.

    ② 무너진 뒤의 회복 경로 — 기력을 되찾는 길이 "때리는 것" 뿐인데(C007)
       무너진 직후에는 대개 얻어맞고 있다. PLAYABLE ② 8장면에서 여파가 가신 뒤에도
       기력이 0 이라 여전히 막지 못했다. 의도한 대가이지만
       (막기만 하는 선택은 반드시 끝난다), 실제로 회복할 창이 있는지는 Human Play 의 판단이다.

## STATUS

    IN PROGRESS — Human Play 확인 대기

    Cycle Completion Gate 15항 중 14항 충족.
    남은 1항: "인간이 실제 게임에서 Cycle Goal 달성을 확인했다".
    그 확인 이후 이 문서와 01-cycle.md 의 STATUS 를 COMPLETE 로 올린다.
