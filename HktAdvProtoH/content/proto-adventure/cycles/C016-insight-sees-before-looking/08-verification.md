# CYCLE C016 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable        (기계 실측 완료 — Human Play 확인 대기)
[PASS] Regression
[PASS] Catalog         (존재 종류를 추가하지 않았고, 세 등록에 통찰 0 만 더했다 —
                        catalog:check 정합 확인)

## NEW BEHAVIOR

    통찰 0 인 채 마주함        → 겨루는 힘 세 자리가 모두 가려진다. C015 와 한 톨도 다르지 않다
    통찰을 30 으로 올림        → 살펴보지 않았는데 `약점 물리에 약하다` 가 나온다.
                               수치와 관계는 여전히 가려져 있다
    통찰을 60 으로 올림        → `나에게 읽히는 오라 방어 56.25` 까지 나온다.
                               가려진 것은 `겨루는 힘` 하나뿐이다
    통찰을 90 으로 올림        → 다가가지 않고도 전부 안다. 살펴봄이 **거절된다**
                               (`이미 알고 있다` — 더 열 자리가 없다)
    통찰을 다시 0 으로 내림     → 열려 있던 자리가 전부 다시 가려진다.
                               통찰은 지나간 기록이 아니라 지금의 조건이다
    통찰 0 으로 살펴봄         → 통찰 90 인 몸과 **똑같은 것을 본다.** 값까지 같다
    통찰 60 에서 살펴본 뒤 되돌림 → 셋이 아니라 `겨루는 힘` 하나만 다시 가려진다 —
                               남은 둘이 통찰의 몫이다
    두 사람이 같은 상대 앞에    → 내 몸의 통찰만 올리면 둘째 관찰자는 여전히 셋 다 모른다
    통찰을 100 으로 두고 침     → 피해도 경위도 통찰 0 일 때와 완전히 같다
    관계값만 열린 상대의 화면    → `나에게 읽히는 오라 방어 56.25 (받는 피해 64%)` 는 있고
                               `오라 공격 15 · 오라 방어 90` 은 없다 — 원래 값을 되짚지 않는다

## WORLD SCENARIO

    실측 경로 — `npx vitest run content/proto-adventure/world` (18 파일 338+27 = 365 tests 통과)

    RULE-INSIGHT-REVEAL-001 (ADDED) — 한 축을 올리며 네 국면을 모두 본다
        Before  관찰자 rabbit-swordsman (통찰 0) · 대상 wanderer (Armor 30 · Resist 90)
                살펴본 적 없음. 관찰자의 오라 관통 60
        Input   AttributeSet(내 몸, insight, 0 → 30 → 60 → 90)
        Rule    RULE-ATTRIBUTE-SET-001 → RULE-INSIGHT-REVEAL-001
        After   실측값 (world/tests/insight.spec.ts · 같은 배치를 네 번 세워 찍었다)

            insight=0   concealed=[combatStats, versusObserver, defenseShape]
                        acquainted=false · 세 자리 모두 없음 · observe available=true
            insight=30  concealed=[combatStats, versusObserver]
                        defenseShape=aura-tougher · observe available=true
            insight=60  concealed=[combatStats]
                        defenseShape=aura-tougher · versusObserver.resistance=56.25
                        observe available=true
            insight=90  concealed=[]
                        acquainted=true · combatStats.armor=30 ·
                        observe available=false reason=already-known

        열린 값이 C012·C013 이 계산한 그 값 그대로다 — 56.25 는 오라 방어 90 에서
        관통 60 이 걷힌 값이고(C013 실측 그대로), aura-tougher 는 30 과 90 을 견준
        C012 의 판정이다. 통찰은 **언제 실리는가**만 정하고 값을 만들지 않는다.

    문턱의 경계
        Before  같은 배치
        Input   insight = 29 · 59 · 89 · 100
        After   29 → 셋 다 가려짐 · 59 → 둘 가려짐 · 89 → 하나 가려짐 · 100 → 없음
                (문턱은 `≥` 다 — 미치지 못하면 열리지 않는다)

    RULE-OBSERVE-FORGET-001 — 규칙을 고치지 않고 두 길이 갈린다
        Before  insight = 60 · wanderer 를 살펴봐서 장부에 담김 → concealed = []
        Input   ForgetAcquaintance(관찰자, wanderer)
        Rule    RULE-OBSERVE-FORGET-001 (무변경) → RULE-INSIGHT-REVEAL-001
        After   concealed = ["combatStats"] · defenseShape = aura-tougher
                **셋이 아니다.** 살펴봄으로 얻은 것만 사라지고 통찰이 연 둘은 남는다

    INTENT-INSIGHT-NOT-A-GATE-001 — 통찰은 계산에 닿지 않는다
        Before  같은 배치를 둘 세우고 한쪽만 두 몸 모두 insight = 100
        Input   기본 스킬로 한 번씩
        After   amount 가 같고 breakdown 이 **객체 단위로 같다.**
                경위 어디에도 `insight` 라는 이름이 없다

    관찰자별 사실
        Before  관찰자 둘. 내 몸만 insight = 60
        After   나 concealed=[combatStats] · 둘째 관찰자 concealed=셋 전부
                (앎은 사람에게, 통찰은 그가 지금 지닌 몸에 매달린다)

    문턱은 대상을 읽지 않는다
        Before  insight = 60 · 두 존재 중 하나의 Armor 를 100000 으로
        After   둘 다 concealed=[combatStats] — 어느 존재가 더 읽기 어렵지 않다

## VIEW FIXTURE

    실측 경로 — `npx vitest run content/proto-adventure/view` (14 파일 215 tests 통과)
    fixture — `view/tests/fixtures/insight.fixture.json` (관찰자 통찰 60 인 순간)

    일부만 아는 존재의 화면 (npc-2 — 살펴본 적 없고 통찰이 둘을 열었다)
        통찰 0
        나에게 읽히는 물리 방어 30 (받는 피해 77%)
        나에게 읽히는 오라 방어 56.25 (받는 피해 64%)
        약점 물리에 약하다
        겨루는 힘 — 아직 살펴보지 않았다

        → 열린 자리와 가려진 자리가 **한 화면에 함께** 있다. 오지 않은 수치
          (`오라 공격 15`)는 어디에도 없고, 관계값에서 원래 방어를 되짚지도 않는다.

    전부 아는 존재의 화면 (npc-1) — C015 까지와 글자 하나 다르지 않다
        오라 공격 15 · 오라 방어 90 (받는 피해 53%) → 나에게 56.25 (64%)
        관통 물리 0 · 오라 0 · 약점 물리에 약하다 · 치명타 터뜨리지 못함
        가려짐 줄이 없다

    자리를 지운 판 (세계가 그렇게 보냈다고 가정)
        관계만 지움     → 수치 줄은 그대로 서고 `→ 나에게` 꼬리만 사라진다
        관계·형태 지움   → C014 의 화면과 같다 (`겨루는 힘 · 나에게 읽히는 방어 · 약점 —
                        아직 살펴보지 않았다`)
        없는 이름 보냄   → `somethingNew — 아직 살펴보지 않았다` 가 그대로 나온다.
                        View 가 목록을 자기 코드에 적지 않는다는 증거다

    내 자리 — `통찰 60` 한 줄. 값을 바꾸면 이 줄과 남의 가려짐이 같은 화면에서 함께 움직인다

## PLAYABLE

    기계 실측으로 확인한 것
        전체 43 파일 717 tests 통과 (`npm test` — boundary:check 포함)
        `npx tsc --noEmit` 오류 0 · `npm run build` 성공 (Client 번들 생성)
        `npm run catalog:check` 3원소 정합
        조작 경로가 세계에서 발견된다 — `set-attribute` 의 속성 목록에 `insight` 가
        실려 나가므로(commandCatalog) 플레이어가 명령 한 줄로 통찰을 바꿀 수 있다

    사람이 할 절차 (Human Play 확인 대기)
        1. `scripts/run-split` 으로 World 와 Client 를 띄우고 자율 존재 앞에 선다
        2. 속성 관찰을 켜고 그 존재의 줄을 본다 — `겨루는 힘 · 나에게 읽히는 방어 ·
           약점 — 아직 살펴보지 않았다`
        3. `set-attribute insight 30` → 같은 존재에 `약점 물리에 약하다` 가 나타난다
        4. `60` → `나에게 읽히는 오라 방어 56.25` 가 더해지고 가려짐이 한 줄로 줄어든다
        5. `90` → 전부 열리고, 그 존재를 살펴보려 하면 `이미 알고 있다` 로 막힌다
        6. `0` 으로 되돌리면 전부 다시 가려진다
        7. `60` 에서 다가가 살펴본 뒤 `forget-acquaintance` → `겨루는 힘` 하나만
           다시 가려지는 것을 본다

    확인해야 할 것은 숫자가 아니라 **감각**이다 — 통찰을 올렸을 때 늘어나는 것이
    "세기" 가 아니라 "고를 근거" 로 느껴지는가. 그것이 이 Cycle 의 판정이다.

## REGRESSION

    03 의 AFFECTED 전 항목 + 과거 Cycle Scenario 재실행 — 전부 통과

    RULE-OBSERVE-COMPLETE-001 (C014)      살펴봄이 여전히 전부 연다. 통찰 0 으로 살펴본
                                          결과가 통찰 90 인 몸이 보는 것과 값까지 같다
    RULE-OBSERVE-BEGIN-001 (C014)         거리·자기 몸·행동 중 거절이 그대로다
                                          (통찰이 높아도 멀면 out-of-range)
    RULE-OBSERVE-FORGET-001 (C014)        통찰 0 이면 되돌림이 C014 와 똑같이 셋을 가린다
    RULE-DAMAGE-CALCULATE-001 (C010·C012) damage-type 26 tests · damage 19 tests 그대로
    RULE-PENETRATION (C013)               penetration 25 tests 그대로 — 56.25 가 그대로 나온다
    RULE-CRITICAL-STRIKE-001 (C015)       critical 38 tests 그대로 — 흔들림의 뿌리 무변경
    RULE-GUARD-* (C011)                   guard 34 tests 그대로
    RULE-NPC-DECIDE-001 (C007)            npc 5 tests 그대로 — 자율 존재는 통찰을 쓰지 않는다
    RULE-ATTRIBUTE-SET-001 (C007 R2·C009) 목록이 16 → 17 로 늘어난 것 외에 무변경
    observe.spec.ts (C014 33 tests)       한 줄도 고치지 않았다 — 통찰 0 인 세계에서
                                          C014 의 모든 검증이 그대로 성립한다

    고친 기존 검증 5건 (전부 목록·줄 번호이며 의미 변경이 아니다)
        world/tests/combat.spec.ts        투영 속성 목록 2건 + 바꿀 수 있는 성질 목록 1건
        world/tests/command.spec.ts       바꿀 수 있는 성질 목록 1건
        view/tests/penetration.spec.ts    inspect 줄 번호 4개 (통찰 줄이 위에 생겼다)
        view/tests/fixtures/*.json        9개 fixture 에 `insight: 0` 추가 (필수 항목)

## MASTER FEEDBACK

    Capability Overlay
        MC-OBSERVE    PARTIAL → PARTIAL (결손 하나 닫힘)
            근거    이 문서의 WORLD SCENARIO — 앎에 이르는 길이 둘이 되었고
                    (살펴봄 · 기른 통찰), 앎이 존재 단위에서 자리 단위로 넓어졌다.
                    overlay 가 적은 결손 둘 중 **경로 쪽**이 닫혔다:
                    "앎에 이르는 길이 살펴봄뿐이고 앎이 존재 단위여서 부분 공개가 없다"
            남는 결손 **행동·습성** 하나뿐이다 (MC-PREDICT 자리 — 자율 존재의 패턴을
                    읽는 의미가 아직 없다). MC-OBSERVE 는 그 하나가 닫히면 IMPLEMENTED 다

        MC-INSIGHT (신규 후보)
            이 Cycle 이 세운 "아는 힘" 은 MC-OBSERVE 안에 담기지만, 성장 축으로 보면
            독립한 노드일 수 있다. 노드 신설 여부는 Master 의 판단이다 — 여기서는
            세계에 그런 성질이 생겼다는 사실만 보고한다

    Constraint Evaluation
        DC-WORLD-PROGRESSION-IS-REACH    SATISFIED (requires 를 세계에서 처음 만족)
            `progression_expands_reachable_world` — 능력이 오를 때 커지는 것이 수치가
            아니라 **아는 상대의 범위**다. 통찰 0→90 에서 달라지는 것은 피해도 생존도
            아니고 "다가가지 않고 고를 수 있는 상대" 다 (WORLD SCENARIO 의 네 국면)
            `resource_can_open_capability_route` — **아직 아니다.** 통찰을 여는 것이
            자원이 아니라 디버그 명령이다. 이 Cycle 이 만든 것은 **형태의 선례**이며
            (능력치가 Capability 의 문을 연다), 그 문을 자원·성장에 잇는 것은 다음 Cycle 이다
        DC-COMBAT-MATCHUP-SOFT           SATISFIED
            통찰이 유일한 문이 아니다 — 통찰 0 으로 살펴본 결과가 통찰 90 과 값까지
            같다는 것이 실측되었다. 그리고 통찰은 계산에 한 글자도 더하지 않는다
            (피해·경위가 객체 단위로 같다)
        DC-WORLD-OWNS-THE-SURFACE-LIST   SATISFIED
            문턱도 목록도 세계가 소유한다. View 에 문턱 수(30·60·90)가 한 번도 나오지
            않으며, 세계가 없는 이름을 보내도 화면이 그대로 나른다 (VIEW FIXTURE)
        DC-WORLD-PLAYER-UNFIXED-PATH     SATISFIED
            통찰 0 으로도 세 스킬과 막기가 그대로 가용하고, 살펴봄으로 같은 곳에 이른다
        DC-COMBAT-ONE-LAYER-AT-A-TIME · DC-COMBAT-PLAYER-CAUSALITY ·
        DC-COMBAT-SHARED-BUDGET · DC-COMBAT-ONE-FORMULA
            해당 없음 — 전투 층을 올리지 않았고 난수도 기력도 공식도 건드리지 않았다

    Constraint Candidate
        **"새 앎의 경로를 열 때는 그 경로가 관문이 아님을 함께 세운다"**
        C014 는 `POSSIBILITY-STILL-FIGHT-BLIND` 로, C016 은
        `INTENT-INSIGHT-NOT-A-GATE-001` 로 같은 문장을 세웠다. 두 번 반복된 패턴이며
        DC-WORLD-PLAYER-UNFIXED-PATH 의 정보판으로 읽힌다. 승격 판단은 Human 의 몫이다.

        **"지금의 조건으로 여는 것은 어디에도 적어 두지 않는다"**
        통찰이 연 자리를 기록하지 않았기 때문에 되돌림 규칙이 한 줄도 바뀌지 않았고,
        값을 내리면 저절로 닫힌다. C015 가 "확률의 양 끝에서 커서를 소비하지 않는다" 로
        얻은 것과 같은 종류의 값어치다 — 상태를 늘리지 않으면 규칙이 늘지 않는다.

    Master Gap
        없음 — 상위 의미와 어긋난 지점이 없다.

        다만 위층이 판단할 것이 하나 있다. frontier.md 의 `SELECTED` 항목은
        "다음 단계 cycles/C015-<name>" 이라고 적고 있으나 C015 는 Human 이 따로 고른
        Critical 층이 가져갔고, 이 Frontier 를 받은 것은 **C016** 이다.
        Cycle 쪽에서 고칠 수 없는 자리이므로 (master/ 편집 금지) 보고만 한다.

## FAILURES

    없음 — 7항 전부 통과. GAP 도 MASTER GAP 도 없다.

## STATUS

    COMPLETE       (기계 검증 7항 통과 · 전체 717 tests ·
                    2026-08-20 Human Play 확인 — 이 Cycle 은 닫혔다)
