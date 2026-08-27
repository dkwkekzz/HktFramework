# CYCLE C-COMBAT-001 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable        (실제 브라우저에서 전 경로 왕복 — 아래 PLAYABLE)
[PASS] Regression

STATUS  IN PROGRESS   ← Human Play 확인 전에는 COMPLETE 로 바꾸지 않는다 (CLAUDE.md 원칙 15)

## NEW BEHAVIOR

    고른 배분(balanced)             모든 값에 0 을 보탠다 — 세계가 C023 까지와 같다
    몸에 몰면(reinforce)            물리 공격 40→56 · 물리 방어 50→70 ·
                                    오라 공격 40→28 · 통찰 0 (아래 0 바닥)
    능력에 몰면(hatsu)              오라 공격 40→64 · 물리 공격 40→32 · 물리 방어 50→40
    인지에 몰면(hunter)             통찰 0→40 — **살펴보지 않은 상대의 무른 쪽이 열린다**
                                    대가로 물리 공격 32 · 물리 방어 40
    바꾸는 일                       기력 15 · 잠금 없음 · 같은 배분은 아무 일도 아니다
    바꿀 수 없으면                  사유가 목록에 붙는다 (기력이 모자란다 / 쓰러짐)
    자율 존재                       생명 절반 아래 → 몸에 몬다. 기력이 없으면 못 바꾼다

## WORLD SCENARIO — View 없이 실측

    ── 배분이 유효 값에 들어간다 ──────────────────────────────────
    Before  allocation=balanced · armor(유효)=50 · physicalAttack(유효)=40 · cp=45
    Input   set-allocation(reinforce)
    Rule    RULE-ALLOCATION-SET-001
    After   allocation=reinforce · armor=70 · physicalAttack=56 · cp=30
            (기본값은 그대로 — actor.armor 는 여전히 50)

    ── 같은 기술 한 방이 배분에 따라 갈린다 (기본 기술 · 상대 wanderer) ──
    balanced   offenseStat 40 (배분 몫  0) → rawDamage 26 → finalDamage 20  ← C007 기준값
    reinforce  offenseStat 56 (배분 몫 16) → rawDamage 34 → finalDamage 26
    hatsu      offenseStat 32 (배분 몫 −8) → rawDamage 22 → finalDamage 17
    hunter     offenseStat 32 (배분 몫 −8) → rawDamage 22 → finalDamage 17

    ── 거절은 아무것도 남기지 않는다 ────────────────────────────
    Before  allocation=balanced · cp=10
    Input   set-allocation(reinforce)
    Result  Failure(insufficient-cp) · allocation=balanced · cp=10  (둘 다 그대로)
    같은 사유로 unknown-allocation · downed 도 실측했다

    ── 백 번 바꿔도 표류하지 않는다 ─────────────────────────────
    reinforce→hatsu→hunter→balanced 를 100 회 돈 뒤 balanced 에서
    armor 50 · auraAttack 40 — 처음과 같다 (가감이 아니라 재계산이기 때문이다)

    ── 자율 존재 ────────────────────────────────────────────────
    Before  wanderer 생명 120/120 · 기력 20 · allocation=balanced
            그 몸에 넣는 한 방 20 (상대 방어 30 · 배분 몫 0)
    Input   생명을 50 으로 (절반 아래) · 한 Tick
    Rule    RULE-NPC-ALLOCATION-001 → RULE-ALLOCATION-SET-001
    After   allocation=reinforce · 기력 20→5
            그 몸에 넣는 한 방 17 (상대 방어 50 · 배분 몫 20)
    변형    기력을 5 로 먼저 낮추고 다치게 하면 → allocation=balanced · 기력 5 그대로
            (치를 수 없으면 못 바꾼다 — 자율 존재에게 예외를 두지 않는다)
    되돌림  생명을 120 으로 되돌리면 → allocation=balanced (양방향이다)

    ── 인지 축이 아는 범위를 연다 ───────────────────────────────
    balanced   내 통찰 0  · 상대의 가려진 자리 [combatStats, versusObserver, defenseShape]
    hunter     내 통찰 40 · 상대의 가려진 자리 [combatStats, versusObserver]
               → 살펴보지 않고도 `약점 물리에 약하다` 가 온다 (문턱 30 하나만 열린다)
    되돌리면   내 통찰 0  · 가려진 자리 셋으로 되돌아간다 (연 것을 적어 두지 않는다)

    근거: `world/tests/allocation.spec.ts` 37 항목 — 전부 통과.
    기대값은 공식을 다시 계산하지 않고 숫자로 박았다.

## VIEW FIXTURE — World 미기동, Fixture 만으로

    view/tests/fixtures/allocation.fixture.json → `view/tests/allocation.spec.ts` 17 항목

    몸 위 표시        `[적대] [몸]Wanderer 1 ?` — 살펴보지 않은 상대에게도 배분이 뜬다.
                      고른 배분에는 붙지 않고, 두 축이 나란해도 붙지 않는다
    self 패널 맨 앞    `배분 사냥꾼 (몸 1 · 능력 1 · 인지 4)` · 아랫줄이 `물리 공격 32`
    고를 목록          `몸 1 · 능력 1 · 인지 4 · 지금 여기`
                      `몸 4 · 능력 1 · 인지 1 · 기력 15 · U → 2`
                      `몸 1 · 능력 4 · 인지 1 · 기력이 모자란다`   ← 사라지지 않는다
    모르는 이름        `allocationLabel('zetsu') === 'allocation.zetsu'`
                      — 세계가 배분을 하나 더 지어도 화면이 멈추지 않는다
    조작              U→2 가 `{interactionId:'set-allocation', allocationId:'reinforce'}` 를 낸다.
                      못 가는 자리도 그대로 보낸다 (화면이 판정하지 않는다)

## PLAYABLE — 실제 게임에서 실측

    `npx vite` 로 세계와 클라이언트를 한 프로세스에 띄우고 헤드리스 크로뮴
    (900×600 · `/opt/pw-browsers/chromium`)에서 사람이 하는 조작 그대로 눌렀다.
    페이지 오류 0.

    1. 붙는다        화면 아래 안내에 `배분: U` · self 패널에
                     `배분 균형 (몸 2 · 능력 2 · 인지 2)`
    2. 목록이 있다    균형 `지금 여기` / 강화 `기력 15 · U → 2` /
                     발현 `기력 15 · U → 3` / 사냥꾼 `기력 15 · U → 4`
    3. `U` → `2`     **전선에 실제로 나간 요청** (웹소켓 프레임을 그대로 옮긴다):

                         {"type":"action","action":{"interactionId":"set-allocation",
                          "allocationId":"reinforce","mark":1}}

    4. 세계가 되돌린 관찰이 화면을 바꾼다
                     배분 줄     `배분 균형 (몸 2·능력 2·인지 2)` → `배분 강화 (몸 4·능력 1·인지 1)`
                     self 능력   `물리 공격 40 · 물리 방어 50 (받는 피해 67%)`
                              →  `물리 공격 56 · 물리 방어 70 (받는 피해 59%)`
                     목록 뒤집힘  강화가 `지금 여기` 로, 균형이 `기력 15 · U → 1` 로

    **키 → 요청 → 세계 판정 → 관찰 → 화면**이 실제 앱에서 한 바퀴 돌았다.

### 이 검증에서 겪은 것 — 헤드리스 링크가 자주 끊긴다

    첫 시도에서 `U → 2` 가 아무 일도 하지 않았다. 파고들어 보니 바인딩은 정확히
    동작했고(`armed=set-allocation` → 세계가 준 차례에서 `reinforce` 를 골라 send 호출)
    `link.sendMarked` 가 `null` 을 냈다 — 세계 연결이 그 순간 끊겨 있었다.

    **이 Cycle 의 결함이 아니다.** 같은 조건에서 **기존 키도 똑같이 나가지 않는다** —
    세계 시간이 멈춘 런에서는 `Q`(막기)도 프레임을 하나도 내지 않았고, 세계 시간이
    흐르던 런에서는 `Q` 가 `guard-begin` 을 정상으로 냈다. 소프트웨어 GPU 에서
    한 프레임이 길어 `OBSERVATION_TIMEOUT_MS` 가 자주 걸리는 것이며,
    링크가 살아 있는 순간에 누르면 위 3~4 처럼 왕복한다.

    기록해 두는 이유는 둘이다. ① 다음 Cycle 이 같은 함정에 빠지지 않도록.
    ② **Fixture 검증만으로는 이 자리를 볼 수 없다** — 화면 시험은 `binding.invoke` 를
    직접 부르므로 전선 너머를 지나지 않는다. PLAYABLE 이 별도의 판정인 이유가 이것이다.

## REGRESSION — AFFECTED 재실행

    ① C010 · C012 · C013 · C015 — 고른 배분에서 한 방의 크기
       기본 기술 20 (raw 26 · 방어 30 · 배율 100/130) — C007 이래의 기준값 그대로.
       경위의 `fromAllocation` 이 세 자리 모두 0 이다 (관통은 어느 배분에서나 0).
       근거: `damage` · `damage-type` · `penetration` · `critical` spec 전부 통과

    ② C023 — 걸린 것과 배분이 같은 합에 나란히 선다 (실측)
           맨몸              물리 방어 50
           손방패를 걸면      물리 방어 65   (걸린 것 +15)
           거기에 강화면      물리 방어 85   (+ 배분 20)
           배분만 되돌리면    물리 방어 65   ← 걸린 것은 그대로 남는다
       걸고 푸는 일이 배분과 섞이지 않는다

    ③ C011 — 막기는 배분에 닿지 않는다 (실측)
       균형에서 막기 `guarding=true` · 사냥꾼에서 막기 `guarding=true`.
       배분이 막기를 여닫지 않는다

    ④ C016 — 인지에 몰지 않은 몸의 앎의 경로 (실측)
       살펴보기 전 가려진 자리 셋 → 살펴본 뒤 빈 배열 · `acquainted=true`.
       C016 이 세운 길이 한 톨도 다르지 않다

    ⑤ C002 — 자율 존재의 판단
       기술 고르기(RULE-NPC-DECIDE-001)는 무변경. 배분은 나란한 판정이 정한다.
       `npc.spec.ts` 통과

    ⑥ 전체 — `1383 tests` (79 파일) 통과 · `tsc --noEmit` · `boundary:check` 위반 0 ·
       `catalog:check` 정합 · `lanes:check` 판과 실제가 맞는다

### 회귀 중 **바뀐 것 하나** — 눕히는 대수가 6대에서 7대로

    이것은 결함이 아니라 **이 Cycle 이 의도한 변화**다 (03 BALANCE ⑤ · 05 승인).

        wanderer 120  20 × 3대 (60 까지) → 절반 아래 → 몸에 몬다 → 17 × 4대 = 7대

    관찰자 쪽 기준값은 그대로다 — 사람은 스스로 배분을 바꾸지 않는 한 balanced 이고
    balanced 는 모든 값에 0 을 보탠다. 바뀐 것은 **자율 존재가 스스로 몸에 몬다**는
    새 사실이며, 그것이 이 층이 세우려던 것이다.

    다만 03 의 BALANCE ① 이 "C007 이래의 두 체감 기준이 그대로다" 라고 적은 것은
    **관찰자 쪽에 한정해서만** 참이다. 06 NOTES ① 이 이미 그 정정을 적었고,
    이 문서가 그것을 회귀 판정으로 확정한다.

## MASTER FEEDBACK

    Capability Overlay
        MC-AURA-ALLOCATION    MISSING → **PARTIAL**    (IMPLEMENTED 아님)
            선 것    힘의 배분이 이름 붙은 상태로 있고, 전투 중 하나를 고르는 것으로만
                     바뀌며, 유효 값에 항으로 들어가고, 자기에게도 상대에게도 보인다
                     근거  이 문서의 WORLD SCENARIO · PLAYABLE
            남은 결손 배분이 **값만 바꾸고 무엇을 할 수 있는가의 목록을 바꾸지 않는다.**
                     그 노드의 semantic 절반(UL §15 — "지금 무엇을 할 수 있는가 자체를
                     가른다")이 이 Cycle 의 EXCLUDED 이며, 조건 관문
                     (FR-THE-WORLD-DECIDES-WHAT-IS-POSSIBLE)이 서야 닫힌다
            **예고된 보고다** — 01 의 MASTER TRACE 가 착수 전에 이미 적었다

    Possibility 판정
        MP-EXPLOIT-OPEN-BODY  **닫히지 않았다 — PARTIAL**
            요구 넷 중 셋(MC-COMBAT-STRIKE · MC-COMBAT-CAUSE-READING ·
            MK-OPPONENT-FLOW-PATTERN)이 섰다. 넷째가 MC-AURA-ALLOCATION 이고
            그것이 PARTIAL 이므로 갈래도 PARTIAL 이다.
            **다만 플레이로는 이미 성립한다** — hunter 로 상대가 물리에 무른 것을
            살펴보지 않고 알아내고, reinforce 로 물리 공격을 26 으로 올려 그 무른 쪽을
            친다 (이 문서의 WORLD SCENARIO). 후보가 "이 후보로 그 갈래가 닫힌다" 고
            적은 것은 **플레이의 성립**으로는 맞고 **노드의 완결**로는 이르다.
            어느 쪽으로 판정할지는 Master(Human)의 몫이다
        MP-CONCENTRATE-THE-POWER · MP-HOLD-FORTIFIED   전진 (배분이 섰다)

    Constraint Evaluation
        DC-COMBAT-AURA-IS-A-PROFILE-NOT-A-DIAL  SATISFIED
            전투 중 입력이 배분 하나를 고르는 것뿐이다. 요청에 몫을 실을 자리를 두지
            않아 실시간 조절 UI 의 문이 형(type) 수준에서 닫혀 있다
        DC-COMBAT-ONE-FORMULA                   SATISFIED
            RULE-DAMAGE-CALCULATE-001 의 Step 0~3 에 배분이 한 번도 등장하지 않는다.
            배분은 그 식이 읽는 입력값만 바꾼다
        DC-COMBAT-SHARED-BUDGET                 SATISFIED
            대가가 기존 기력이다. 새 게이지가 없고, 그래서 배분과 기술이 같은 주머니를 다툰다
        DC-COMBAT-PLAYER-CAUSALITY              SATISFIED
            확률이 개입하지 않는다. 같은 배분·같은 타격은 같은 값이고 경위에 몫이 실린다
        DC-COMBAT-ONE-LAYER-AT-A-TIME           SATISFIED
            고른 배분이 모든 값에 0 을 보태므로 아래 층이 이 층 없이 그대로 선다 (산술로)
        DC-WORLD-OWNS-THE-SURFACE-LIST          SATISFIED
            목록·몫·가능 여부·사유·비용을 전부 세계가 싣는다. 화면에 배분 이름으로
            분기하는 코드가 없다 (`allocationLabel('zetsu')` 검증이 그 증거다)

    Constraint Candidate
        **"순서로 짚고 이름을 적어 두지 않는다"** — 화면과 조작이 세계가 준 차례를
        같은 배열에서 읽으면, 세계가 항목을 늘려도 화면·조작 코드가 열리지 않는다.
        C020(소지품) · C023(적용 자리) · 이 Cycle(배분)이 **셋째로 같은 형태를 반복했다.**
        승격 판단은 Human 의 몫이다

    Master Gap
        없음 — 상위 의미와 어긋난 지점이 없다. 위의 두 PARTIAL 은 어긋남이 아니라
        후보가 착수 전에 감수하기로 적은 손해다 (frontier/combat.md 의 "추천 순서")

## FAILURES

    없음 — 6종 검사 전부 통과.

    검증 중 고친 것 둘은 **세계가 아니라 탐침이 틀린 것**이었다.
    ① 한 세계에서 두 번 쳐서 밀려난 몸 때문에 이전 타격이 다시 읽혔다 (C006 의 함정)
    ② 관찰자가 아니라 상대의 통찰을 읽었다
    둘 다 고친 뒤 위 값이 나왔다. 세계 코드는 이 단계에서 한 줄도 바뀌지 않았다.

## STATUS

    IN PROGRESS

    남은 것은 하나다 — **사람이 실제로 플레이해 확인하는 것** (Gate 14항).
    헤드리스로는 왕복까지 닫았으나, 손으로 눌러 봐야 알 수 있는 것이 남는다:
    U 다음에 숫자를 누르는 두 걸음이 전투 중에 실제로 손에 맞는가,
    배분 넷이 세로로 늘어선 목록이 눈에 걸리지 않는가,
    상대의 `[몸]` 표시가 교전 중에 읽히는가.

    재현: `./scripts/run.sh` (또는 `npm run dev`) 후 브라우저에서 `U` → `2`.
