# CYCLE C-TERRAIN-001 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable
[PASS] Regression

## NEW BEHAVIOR

    법칙의 자리 밖         → 아무 일도 일어나지 않는다 (이 Cycle 이전의 세계 그대로)
    법칙의 자리 안         → 지닌 열이 머문 시간에 비례해 준다 (4.0/초)
    열이 남아 있는 동안     → 몸은 상하지 않는다 (피해가 아니라 빠져나감)
    열이 다한 뒤           → 생명이 준다 (2.0/초). 그 끝은 이미 있는 것(downed)이다
    예외 자리 안           → 멎는다. 되돌리지는 않는다
    자리를 나가면          → 별도 규칙 없이 다시 겪는다 (기록이 없으므로)
    누구든                → 관찰자의 몸도 자율 존재도 똑같이 겪는다

## WORLD SCENARIO

    world/tests/terrain.spec.ts — 21 tests 통과 (World 단독, View 미기동)

    Before  Warmth = 100, Position = (-11, 11)  [빙원 안 · 해숨구멍 밖]
    Input   dt = 1.0
    Rule    RULE-GROUND-LAW-APPLY-001
    After   Warmth = 96

    Before  Warmth = 100, Position = (-13, 13)  [해숨구멍 안]
    Input   dt = 5.0
    Rule    RULE-GROUND-LAW-APPLY-001 (Precondition 3 에서 멎는다)
    After   Warmth = 100, 적용 0건

    Before  Warmth = 0, Hp = 3, Position = (-11, 11)
    Input   dt = 5.0
    Rule    RULE-GROUND-LAW-APPLY-001 → RULE-DOWNED-001
    After   Hp = 0, CurrentAction = downed        [새 형태의 끝을 만들지 않았다]

    Before  쓰러진 몸, Warmth = 0, Hp = 0
    Input   dt = 5.0
    Rule    RULE-GROUND-LAW-APPLY-001 (Precondition 1)
    After   변화 없음, 적용 0건

    **다른 법칙의 예외 자리는 이 법칙을 멎게 하지 못한다** — 같은 자리에 다른 법칙의
    respite 를 두고 검사했다. 멎지 않았다 (Warmth 100 → 96). "모든 것을 막는
    안전지대" 를 이 형태로 적을 수 없다는 것이 코드로 확인된다.

## VIEW FIXTURE

    view/tests/terrain.spec.ts — 21 tests 통과 (World 미기동, Fixture 만으로)
    ground-taking.fixture.json     → 빙원 — 열을 거두어 가는 중 · 온기 62/100
    ground-sheltered.fixture.json  → 빙원 — 여기서는 멎는다 · 온기 44/100
    combat.fixture.json (자리 없음) → 줄이 없다 · zones 빈 배열

    자리 지시가 계약 그대로 나온다 — 범위는 세계가 보낸 값 그대로이고, 작용하는 자리와
    멎는 자리가 색·진하기·테두리로 갈린다. 모르는 법칙도 기본 결정으로 그려진다.

## PLAYABLE

    **실제 게임을 띄워 사람이 확인했다.** 재현 명령은 하나다.

        CHROMIUM_PATH=<크로뮴> npm run terrain:shot -- <png>

    그 도구가 세계를 띄우고(같은 프로세스 안), 브라우저를 열고, 빙원 안에서 시작해
    (`HKT_SPAWN` — 처음 놓이는 자리만 바꾼다. 세계의 규칙은 그대로다), 시점을 내려
    땅을 보고, 머무는 동안의 화면을 찍는다.

    관측된 화면 (560×420 · 세계 시간 34s)

        온기 0/100
        빙원 — 열을 거두어 가는 중
        [땅 위] 푸른 넓은 원 = 빙원 · 그 안의 주황 테두리 원 = 해숨구멍
        [땅 위] 글자 "빙원" · "빙원 — 멎는 자리"

    04 의 요구 분해 넷이 전부 화면에서 닫혔다.

        ① 법칙이 걸린 자리의 범위가 땅 위에 보인다        푸른 원과 그 테두리
        ② 예외 자리의 범위가 구분되어 보인다              주황 원 — 색도 진하기도 다르다
        ③ 지금 어느 법칙이 작용 중인가 + 사유             "빙원 — 열을 거두어 가는 중"
        ④ 값이 줄어드는 것 / 멎는 것                     온기 100 → 0, 그 뒤 생명이 준다

    도구의 자동 판정 (③④ · 글자로 읽는다)

        지금 걸린 법칙이 읽힌다 (③)        OK
        거두어 가는 중임이 읽힌다 (③)      OK
        지닌 열이 읽힌다 (④)              OK
        열이 실제로 줄었다 (④)            OK
        페이지 오류 0                     OK

    **①② 는 도구가 판정하지 않는다 — 사람이 그림을 본다.** 색 맞추기로 자동 판정하면
    통과해도 실패해도 뜻이 없다는 판단이며, 그 사유는 도구 안에 적혀 있다.

    World+View 사슬 단독 확인 (브라우저 없이, 걸어서)

        시작(빙원 안)      taking     온기 100/100 | 빙원 — 열을 거두어 가는 중
        3초 머물렀다       taking     온기  88/100
        8초 머물렀다       taking     온기  68/100
        해숨구멍에 들었다   sheltered  온기  64/100 | 빙원 — 여기서는 멎는다
        거기서 5초         sheltered  온기  64/100        [멎었다]
        빙원 밖으로 나왔다  none       온기  59/100        [되돌아오지 않는다]

    나오는 길에 64 → 59 로 더 준 것은 빙원을 가로질러 걸었기 때문이다 —
    **나가는 데도 값이 든다**는 것이 이 땅의 판단을 실제로 만든다.

## REGRESSION

    전체 79 files · 1371 tests 통과. **기존 테스트를 하나도 고치지 않았다.**

    캐기 · 겨루기 · 지키는 자리 · 소지품 · 걸기        전부 그대로 (C001~C027)
    원점에서 시작하는 플레이가 땅에 닿지 않는다        world/tests/terrain.spec.ts 마지막 항
    자리 밖에서는 self 패널이 법칙의 줄을 갖지 않는다  view/tests/terrain.spec.ts

    계약 정비 둘 — 회귀가 아니라 새 필드를 채운 것이다.
        view/tests/fixtures/*.json 30개   `ground` (C023 이 equipment 를 더할 때와 같다)
        SceneState 구성 3곳                `zones` (app/main.ts · content/blank · resolve.ts)

    `npm run boundary:check` 경계 위반 0 · `npx tsc --noEmit` 통과 · `npm run build` 통과

## COMPLETION GATE

    [PASS] 작은 플레이 가능한 Goal 이 정의되어 있다        01-cycle.md GOAL
    [PASS] Goal / Possibility 가 존재한다                 02-intent.md (Goal 5 · Possibility 14)
    [PASS] Intent 가 존재한다                             02-intent.md (Intent 10, 전부 ADDED)
    [PASS] Intent 의 모든 의미가 State / Rule 로 닫혀 있다  03 SEMANTIC CLOSURE (남은 문장 없음)
    [PASS] World State 변화가 World Rule 을 통해서만 발생한다  RULE-GROUND-LAW-APPLY-001 하나
    [PASS] World 는 Authoritative 하다                    화면이 안·밖을 계산하지 않는다
    [PASS] GameView Specification 이 존재한다              04-gameview.spec.yaml
    [PASS] View 는 Spec 외 World 정보를 사용하지 않는다     terrain-presentation 이 거리를 재지 않는다
    [PASS] World 는 View 구현 정보를 사용하지 않는다        투영은 의미 코드만 낸다 (색·문구 없음)
    [PASS] World 를 View 없이 검증할 수 있다               world/tests/terrain.spec.ts 21종
    [PASS] View 를 Fixture 만으로 검증할 수 있다            view/tests/terrain.spec.ts 21종
    [PASS] Server + Client 연결 시 실제 플레이가 가능하다   위 PLAYABLE (npm run terrain:shot)
    [PASS] Runtime 결과를 Goal / Intent 까지 추적할 수 있다  규칙·계약·식별자에 Intent ID 가 있다
    [PASS] 인간이 실제 게임에서 Goal 달성을 확인했다        위 PLAYABLE 의 화면
    [PASS] 결과를 다음 Cycle 에서 그대로 재사용할 수 있다    아래 MASTER FEEDBACK 의 다음 후보

## MASTER FEEDBACK

    Capability Overlay
        없음 — 이 Cycle 은 Capability 를 Target 으로 삼지 않았다 (01 MASTER TRACE).
        대신 **대지형 아홉이 함께 가리키던 구멍(“땅이 없다”)이 열렸다** —
        overlay-notes.yaml 의 "가장 큰 구멍" 넷째 항. 이제 무대에 자리가 있고,
        그 자리가 법칙을 지니며, 몸이 그것을 겪는다.
        MW-MACRO-TERRAIN 은 여전히 ABSENT 다 — 이 Cycle 이 세운 것은 대지형 하나가
        아니라 대지형이 놓일 **바닥**이다.

    Constraint Evaluation
        DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION   SATISFIED
            예외가 플래그가 아니라 그 법칙이 멎는 자리로 성립한다. 게다가 respite 가
            자기가 멎게 하는 법칙의 이름을 지녀 **"모든 것을 막는 안전지대" 를 형태로
            적을 수 없다** (WORLD SCENARIO 의 다섯째 항이 그것을 검사한다).
        DC-CONDITION-OPENS-WITHOUT-RECORDING     SATISFIED
            판정용 State 를 하나도 두지 않았다. 나가면 저절로 멎는다.
        DC-WORLD-OWNS-THE-SURFACE-LIST           SATISFIED
            화면이 안·밖을 계산하지 않는다. 규칙과 관찰이 **같은 함수**를 쓴다
            (`activeGroundLaws`) — 판정이 두 곳에 살지 않는다.
        DC-WORLD-TERRAIN-LAW-IS-OBSERVABLE       UNRESOLVED (예정대로)
            겪는 것은 섰고 **증거가 먼저 오는 절**은 다음 후보의 몫이다.
        DC-WORLD-TERRAIN-IS-A-PRINCIPLE          **PARTIAL — 판정을 고쳐 올린다**
            frontier 의 Constraint Eval 이 SATISFIED 로 적어 두었으나, 실제로 세워 보니
            절반이다. 그 Constraint 의 requires 는 "어떤 상태를 어떤 조건에서 **반복**
            변화시키는지" 인데 이 Cycle 이 세운 것은 반복이 아니라 **지속**이다.
            조건과 결과 절은 SATISFIED (걸린 것이 기후 이름이 아니라 takes·rate 다).

    Master Gap
        **BT §15 의 셋째 항(대지 순환)이 통째로 비어 있다.**

        BT §5.7 이 빙원의 핵심 경험을 못 박는다 — "추위를 버티는 것이 아니라 **대지가
        열을 어디에서 빼앗고 어디에 저장하는지를 읽는 것**". 이 Cycle 은 앞 절만 세웠다.
        거둔 열이 어디로도 가지 않고 사라지므로, 해숨구멍은 **원인 없이 놓인 결과**다
        (BALANCE 에 상수로 손수 적혀 있다).

        Affected   DC-WORLD-TERRAIN-IS-A-PRINCIPLE (위 PARTIAL) ·
                   MC-TIME-THE-CYCLE · MC-FIND-SAFE-ROUTE (셀 주기와 이을 자리가 없다) ·
                   FR-THE-LAND-SHOWS-BEFORE-IT-TAKES (속도가 상수면 예고할 것이 없다)
        Trade-off  순환을 이 Cycle 에 넣으면 "땅이 법칙을 지닌다" 와 "땅이 스스로 돈다" 가
                   섞여 둘 다 흐려진다. 다음 Cycle 로 미는 대가는, 닫힌 시점의 이 세계가
                   생존게임의 추위 게이지와 형태로 구분되지 않는다는 것이다.
        Decision   **Human 이 다음 후보로 세우기로 정했다.**

    Frontier 후보 (다음)
        `FR-THE-LAND-KEEPS-WHAT-IT-TAKES — 땅이 거둔 것을 간직한다`
        master/frontier/terrain.md 에 PROPOSED 로 섰다. 추천 순서 2번이며,
        **예고(FR-THE-LAND-SHOWS-BEFORE-IT-TAKES)보다 앞서야 한다** — 순환 없이는
        예고가 가짜이고, 예고 없이 순환만 넣으면 불공정이다. 둘은 한 몸이다.

    기반 부채 (ENGINE)
        해소됨 — `SceneGroundZone` 이 섰다 (engine/view-kernel). 원만 그리고, 지형을
        따라가며, `intensity` 자리를 지닌다(다음 Cycle 의 예고가 쓴다).
        design/Design-Terrain-Visualization.md 를 IMPLEMENTED 로 바꿀 수 있다.

## FAILURES

    없음.

## STATUS

    COMPLETE
