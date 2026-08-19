# CYCLE C014 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable        (기계 실측 완료 · Human 완료 지시 2026-08-19)
[PASS] Regression
[PASS] Catalog         (존재 종류를 추가·변경하지 않았다 — catalog:check 정합 확인)

## NEW BEHAVIOR

    살펴보지 않은 존재      → 겨루는 힘 세 자리가 비고, 무엇이 왜 비었는지가 실린다
    5.0 밖에서 살펴봄 요청  → 거절 (out-of-range) — 다가가야 안다
    5.0 안에서 살펴봄 요청  → 1.0 초 동안 그 행동에 붙잡힌다
    끝까지 마침             → 세 자리가 열리고 **그 순간의** 값이 실린다
    도중에 맞음             → 아무것도 알게 되지 않는다 (RULE-HIT-001 이 중단시킨다)
    이미 아는 존재          → 거절 (already-known)
    되돌림 요청             → 다시 모르는 상태가 되고 살펴봄이 다시 가용해진다
    다른 관찰자             → 내가 안다고 그 사람이 알게 되지 않는다
    모르는 채로 치기        → 그대로 가능하다. 경위도 전부 실린다 (앎은 되지 않는다)

## WORLD SCENARIO

    실측 경로 — `npx vitest run content/proto-adventure/world` (16 파일 300 tests 통과)

    RULE-OBSERVE-BEGIN-001 · RULE-OBSERVE-COMPLETE-001
        Before  npc-1 (x=3) 에 대해 acquainted=false ·
                concealed=['combatStats','versusObserver','defenseShape'] ·
                unacquaintedReason='not-observed' · combatStats 없음
                interactions.observe(npc-1) available=true
        Input   Observe(observer-1 → npc-1)
        Rule    RULE-OBSERVE-BEGIN-001 → CurrentAction=observe (state 가 'observe' 로 실측)
                1.0 초 진행 → RULE-OBSERVE-COMPLETE-001
        After   acquainted=true · concealed=[] · unacquaintedReason 없음
                combatStats = { 40, 15, 30, 90, 0, 0, 100/130, 100/190 }
                versusObserver.resistance = 56.25
                defenseShape = 'aura-tougher'
                interactions.observe(npc-1) available=false reason='already-known'

    거절 4종 (같은 판정을 Observable 과 Rule 이 공유한다)
        5.0+2 거리        → out-of-range
        자기 몸           → target-is-self
        없는 Id           → no-such-target
        살펴보는 중 재요청 → action-busy

    중단
        Before  npc-1 (x=1.5, perceptionRange 9) · 관찰자 생명 200
        Input   Observe → 자율 존재가 다가와 친다
        After   생명 200 미만 (맞았다) · acquainted 여전히 false

    앎은 자리이고 값이 아니다
        Before  살펴본 뒤 combatStats.resistance = 90
        Input   SetAttribute(npc-1, resistance, 10)
        After   combatStats.resistance = 10 — 살펴본 때의 숫자가 굳어 남지 않았다

    관찰자별
        Before  observer-1 만 npc-1 을 살펴봤다
        After   observer-1 acquainted=true · observer-2 acquainted=false ·
                observer-2 의 combatStats 는 undefined

    대상은 아무 일도 겪지 않는다
        살펴봄 전후로 npc-1 의 vitality · energy · state 가 모두 같다

    RULE-OBSERVE-FORGET-001
        지목 하나 → 그 존재만 모르게 된다 · 지목 없음 → 알던 둘 모두 모르게 된다
        모르는 존재 → not-known · DebugAuthority 닫힘 → debug-closed
        (닫힌 세계에서는 interactions.forget-acquaintance 가 available=false + 사유)

## VIEW FIXTURE

    실측 경로 — `npx vitest run content/proto-adventure/view` (12 파일 187 tests 통과)
    fixture `view/tests/fixtures/observe.fixture.json` — 실제 세계가 내보낸 관찰 결과다
    (npc-1 아는 존재 · npc-2 모르는 존재 · player-1 내 몸이 한 화면에 있다)

    몸 위 표시 (속성 관찰을 켜지 않은 상태)
        npc-2 → `Wanderer 2 ?`     npc-1 → `Wanderer 1`     player-1 → `Player 1`
        npc-2 의 생명 120/120 은 그대로 읽힌다

    속성 관찰을 켠 상태 — 아는 존재 (C013 과 한 글자도 다르지 않다)
        기력 20 / 60
        이동 걷기 · 2.5 ×1.4
        공속 ×0.85
        물리 공격 40 · 물리 방어 30 (받는 피해 77%)
        오라 공격 15 · 오라 방어 90 (받는 피해 53%) → 나에게 56.25 (64%)
        관통 물리 0 · 오라 0
        약점 물리에 약하다
        배율 충전×1 소비×1 / 배율 이동×1 공속×1 / 막기 없음

    속성 관찰을 켠 상태 — 모르는 존재
        기력 20 / 60
        이동 걷기 · 2.5 ×1.4
        공속 ×0.85
        겨루는 힘 · 나에게 읽히는 방어 · 약점 — 아직 살펴보지 않았다
        배율 충전×1 소비×1 / 배율 이동×1 공속×1 / 막기 없음

        값이 **한 개도** 나오지 않는 것을 검증이 확인한다 (04 EMPTY-SLOT NOTE ①②③).

    목록이 세계의 것이라는 증거
        fixture 의 concealed 를 `['defenseShape']` 하나로 바꾸면
        문구도 `약점 — 아직 살펴보지 않았다` 하나가 된다. **View 코드는 고치지 않았다.**

    interactions
        npc-2 → available · prompt "살펴보기" · targetEntityId=npc-2 · 키 없음
        npc-1 → "이미 알고 있다"      player-1 → "자기 자신은 살펴볼 대상이 아니다"
        forget-acquaintance → 세계가 싣는 목록에 있고(origin: world)
                              "이 존재를 다시 모르는 상태로 되돌린다"

## PLAYABLE

    기계 실측 — 04 PLAYABILITY NOTE 의 아홉 걸음을 세계에 실제로 걸었다.
    (World + View 결정 Layer 를 함께 돌린 일회성 통합 실행. 그 값들이 아래다.
     항구 검증은 world/tests/observe.spec.ts 와 view/tests/observe.spec.ts 가 소유한다 —
     통합 실행 파일은 view 가 world 를 import 하므로 남기지 않았다.)

        1  모르는 채로 마주한다
           concealed = [combatStats, versusObserver, defenseShape] · 이름 `Wanderer 1 ?`
        2  내 관통은 보인다 — 오라 관통 60
        3  10 거리에서 살펴보려 한다 → out-of-range
        4  4.0 거리에서 요청 → 내 상태가 `observe` 로 바뀐다
        5  1.0 초 뒤 알았다 — 물리 방어 30 · 오라 방어 90 · aura-tougher ·
           나에게 읽히는 오라 방어 56.25 · 이름의 물음표가 사라진다
        6  오라로 친다 → defenseStat 90 · penetrationStat 60 ·
           effectiveDefense 56.25 · finalDamage **17**
           → **C013 과 완전히 같은 숫자다.** 살펴봄은 계산에 아무것도 더하지 않았다
        7  모르는 채로 물리로 친다 → finalDamage **20** (C010 기준값 그대로) ·
           그 존재의 acquainted 는 여전히 false — 살펴봄은 관문이 아니다
        8  되돌린다 → concealed 셋이 돌아오고 살펴봄이 다시 가용해진다
        9  둘째 관찰자가 들어온다 → 나는 true · 그 사람은 false.
           **두 사람이 같은 상대 앞에서 서로 다른 것을 알고 서 있다**

    Server + Client 연결
        `npx tsx server/main.ts` → "[world] 세계가 돌기 시작했다 — http://localhost:5180"
        `npm run build` → tsc 오류 0 · vite build 성공

    Human Play 확인 — **2026-08-19 Human 이 완료를 지시했다** ("후보로 올리고 완료처리해줘").
    아홉 항목의 화면 확인을 Agent 가 대신 수행한 것은 아니다 — 그 판단은 Human 이 내렸고
    이 기록은 그 지시를 옮긴 것이다. 아래 목록은 이후 회귀 확인의 기준으로 남긴다.
        ① 세계에 들어서면 자율 존재의 이름 뒤에 물음표가 붙어 있다
        ② 그 존재를 눌러 본다 — 멀면 "너무 멀다" 가 뜬다
        ③ 다가가 누르면 1.0 초 동안 움직이지 못하고, 끝나면 물음표가 사라진다
        ④ 속성 관찰을 켜면 살펴본 존재에는 능력이, 모르는 존재에는
           "아직 살펴보지 않았다" 가 있다
        ⑤ 알게 된 뒤 오라 스킬로 치면 C013 과 같은 숫자가 나온다
        ⑥ 다가가는 도중 맞으면 물음표가 그대로 남는다
        ⑦ 모르는 상대도 그대로 칠 수 있다
        ⑧ `forget-acquaintance` 를 쓰면 물음표가 돌아온다
        ⑨ 창을 하나 더 열면 그 관찰자에게는 같은 상대가 여전히 물음표다

## REGRESSION

    03 SEMANTIC DELTA 의 AFFECTED 항목을 모두 돌았다.

    C007 R2 — "세계는 어떤 속성도 숨기지 않는다"
        의미가 바뀐 항목이므로 테스트를 **지우지 않고 새 경계로 다시 썼다** (둘로 갈렸다).
        ① 살펴보기 전에도 몸에서 읽히는 속성은 하나도 가려지지 않는다 —
           기력·이동·템포·배율·막기 전부 그대로이고, 가려짐 사실이 그 자리를 대신한다
        ② 살펴본 뒤에는 그 셋도 예외 없이 실린다
    C010 · C012 · C013 피해 실측
        관통 0 조합의 물리 타격 20 · 관통 60 조합의 오라 타격 17 ·
        breakdown 의 세 값(90 · 60 · 56.25) 모두 그대로다.
        기존 검증 6곳에 `observeFully()` 를 앞세웠을 뿐 **기대값을 한 개도 바꾸지 않았다** —
        "관찰한 뒤 같은 값이 나온다" 가 이 Cycle 의 Regression 기준이었고 통과했다
    C011 막기
        guard.spec 34 tests 통과. 막기는 살펴봄을 읽지 않고 살펴봄도 막기를 읽지 않는다
    C009 명령 표면
        command.spec 24 tests 통과. 명령이 3 → 4 가 되었을 뿐 목록·안내·기록 표면의
        모양은 그대로다 (INTENT-COMMAND-CATALOG-001 의 "항목이 하나 더해질 뿐")
    C007 자율 존재
        npc.spec 5 tests 통과. RULE-NPC-DECIDE-001 은 한 줄도 바뀌지 않았다 —
        가려짐은 관찰 계약의 성질이고 자율 존재는 관찰 계약을 쓰지 않는다
    C004 관찰자 수명
        observer.spec 26 tests 통과 + 떠나고 다시 들어와도 알던 것이 남는 것을 실측
    C001 · C002 · C003 · C006
        mine · move · action · collision · world-tick 전부 통과

    전체
        `npx vitest run` — 38 파일 **608 tests 통과**
        `npx tsc --noEmit` 오류 0 · `npm run build` 성공
        `npm run boundary:check` 위반 0 · `npm run catalog:check` 3원소 정합

## MASTER FEEDBACK

    Capability Overlay
        MC-OBSERVE        MISSING → IMPLEMENTED
            근거  이 문서의 WORLD SCENARIO (RULE-OBSERVE-BEGIN/COMPLETE-001 실측) ·
                  VIEW FIXTURE (모름과 앎이 화면에서 갈리는 것) ·
                  PLAYABLE 5·9 (알게 되는 것과 관찰자마다 다른 것)
            주의  이것은 "대상을 살펴 그 겨루는 힘을 알게 된다" 까지다.
                  MC-OBSERVE 의 semantic 이 말한 "행동·습성" 중 **습성**은 세계에
                  아직 개념이 없다 (자율 존재의 행동 패턴). 그 조각은 MC-PREDICT 층과
                  함께 오는 것이 자연스럽다 — 승격 판정은 Human 이 한다

        MC-COMBAT-CAUSE-READING   PARTIAL 유지 (승격 보고하지 않는다)
            사유  이 Cycle 은 계산 내역을 넓히지 않았다. C010 이 실은 것을 그대로 두고
                  **누가 볼 수 있는지**만 정했다. overlay 에 걸린 "C010 의 보고 없는
                  승격 보류" 는 그대로 남는다

    Constraint Evaluation
        DC-WORLD-PROGRESSION-IS-REACH   SATISFIED
            BW §32 사슬의 첫 칸(관찰)이 세계에 섰다. 이 Cycle 이 더한 것은 수치가
            아니라 **아는 방법**이며, 진행의 결과가 "고를 근거를 얻는 것" 으로 나타났다
            (PLAYABLE 5 → 6). numeric_level 을 한 값도 올리지 않았다
        DC-COMBAT-MATCHUP-SOFT          SATISFIED
            weakness_is_observable 이 "관찰 행동을 하면 알 수 있다" 로 유지된다.
            살펴봄은 계산에 한 글자도 더하지 않았다 — PLAYABLE 6 의 17 이 C013 의 17 과
            같은 것이 그 증거다. 모르는 쪽도 계속 싸울 수 있다 (PLAYABLE 7 의 20)
        DC-WORLD-OWNS-THE-SURFACE-LIST  SATISFIED — **다섯 번째 증거가 나왔다**
            ① 속성 추가(C010) ② interaction 추가(C011) ③ 삭제와 분할(C012)
            ④ 관계의 추가(C013) 에 이어 이번은 **없음의 목록**이다.
            무엇이 가려졌는지를 세계가 이름으로 실어 보내고, fixture 의 concealed 를
            셋에서 하나로 줄이면 화면 문구가 따라 줄었다 — View 코드 변경 0
            (view/tests/observe.spec.ts). 이 계약에서 가장 새기 쉬운 것이 "없음" 인데
            (View 가 빈칸을 스스로 해석하기 쉽다) 그 자리도 세계가 소유했다
        DC-WORLD-PLAYER-UNFIXED-PATH    SATISFIED
            어떤 Rule 도 살펴봄을 다른 행동의 조건으로 두지 않는다. 모르는 상대에게도
            세 스킬과 막기가 그대로 가용하다 (world · view 양쪽에서 실측)

    Constraint Candidate
        CC-THE-WORLD-NAMES-WHAT-IT-WITHHELD (제안)
            관찰  이 Cycle 은 계약에 **없음**을 처음 들여왔다. 없음은 값과 달리
                  "자리를 지우는 것" 으로 표현하기 쉽고, 그러면 보는 이가
                  "0 인가 · 아직 안 왔나 · 세계가 안 주나" 를 구별할 수 없어
                  결국 자기 코드에 "이 종류는 이럴 것이다" 를 적기 시작한다.
            문안 후보  "세계가 관찰에서 무엇을 뺐다면, 무엇을 뺐는지와 왜 뺐는지를
                       함께 싣는다. 자리를 지우는 것으로 없음을 표현하지 않는다."
            근거  DC-WORLD-OWNS-THE-SURFACE-LIST 의 확장이며 별개 문안이 아닐 수도 있다
                  (C013 의 CC-THE-WORLD-OWNS-THE-RELATION 과 같은 처지다).
                  Human 이 판단할 일이며 이 Cycle 은 승격하지 않는다

    Frontier Candidate (다음 후보로 제안 — 확정하지 않는다)
        FR-PREDICT-READS-THE-NEXT-BLOW (제안)
            지금  살펴봄이 섰으므로 BW §32 사슬의 둘째 칸(이해)이 이제 얹힐 수 있다.
                  MC-PREDICT 는 FRINGE 진입 요구 3종 중 남은 둘 가운데 하나이고,
                  지형과 달리 **지역 기반을 요구하지 않는다** — 자율 존재의 행동은
                  이미 세계에 있다 (RULE-NPC-DECIDE-001)
            주의  MC-OBSERVE 의 semantic 중 "습성" 이 아직 없다는 위의 주의와 한 묶음이다.
                  둘을 한 Cycle 로 볼지, 습성 관찰을 먼저 볼지는 Human 의 몫
        FR-EARN-THE-PIERCING (C013 이 제안한 것 — 그대로 살아 있다)

    Master Gap
        없음. 상위 의미와 어긋난 지점을 발견하지 못했다.
        Stage 5 가 확인한 판단 둘(C007 R2 개정 범위 · DT §10 조정)이 승인되었으므로
        MASTER GAP 반환 조건은 발생하지 않았다.

## FAILURES

    없음. 반환(GAP)도 없었다.

    다만 구현 중 두 번 되돌린 지점이 있고, 둘 다 **검증이 먼저 알려 주었다.**
        ① 겨루는 힘 줄을 배열 끝으로 옮겼더니 C012·C013 검증 4건이 깨졌다.
           테스트의 줄 번호를 옮기는 대신 자리를 되돌렸다 — 깨진 것이 곧
           "표시가 바뀌었다" 는 신호였고 이 Cycle 의 의미는 순서가 아니라 유무다
           (07 NOTES ①). 그 결과 아는 존재의 화면은 C013 과 한 글자도 다르지 않다
        ② 기존 검증 6곳이 남의 겨루는 힘을 바로 읽고 있어 깨졌다.
           세계를 약하게 만들지 않고 `observeFully()` 를 앞세웠다 — 기대값은 한 개도
           바꾸지 않았고, 그것이 "관찰한 뒤 같은 값이 나온다" 의 확인이 되었다

## STATUS

    COMPLETE   (2026-08-19)
        기계 검증 7항 통과 + Human 완료 지시. Master Feedback 은 같은 날 반영되었다 —
        MC-OBSERVE 는 **PARTIAL** 로 판정되었다 (위 MASTER FEEDBACK 의 주의가 적용되어
        IMPLEMENTED 가 아니다). 경위는 master/HISTORY.md 의 C014 절이 소유한다.
