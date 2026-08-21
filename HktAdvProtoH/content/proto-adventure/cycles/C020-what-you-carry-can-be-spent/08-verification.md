# CYCLE C020 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable          — 사거리 정정(2.0 → 5.0, Human 결정) 뒤 성립한다 (아래 PLAYABLE)
[PASS] Regression
[해당 없음] Catalog       — 존재 종류를 추가·변경하지 않았다 (`CharacterKind` 무변경)

## NEW BEHAVIOR

    지닌 것이 목록으로 보인다        → 종류·수량·분류·가능 행동·불가 사유가 한자리에
    곡괭이를 쓰면 캔다               → 채집이 시작되고 곡괭이는 줄지 않는다
    돌을 던지면 위력이 전해진다        → 적대면 생명이 줄고, 아니면 무산 접촉이 남는다
    쓰면 줄어든다                   → 세계 최초로 가진 것이 사라진다
    되지 않은 시도는 흔적이 없다       → 끊긴 사용은 수량도 상태도 그대로다
    채집 판정이 용도에서 나온다        → 돌을 99개 지녀도 채집 용도가 생기지 않는다

## WORLD SCENARIO — 실측 (`world/tests/drive` 로 세계만 굴렸다)

    ① 던져서 상하게 한다
        Before  소지품 stone×3(no-target-selected) pickaxe×1(no-target-selected) · 상대 120/120
        고른 뒤  stone×3(**쓸 수 있다**) pickaxe×1(target-kind-mismatch)
        Input   use-item(stone) → {"status":"success","rule":"RULE-ITEM-USE-001"}
        시작 직후 내 행동 use-item · **stone×3 그대로** (시작만으로는 줄지 않는다)
        After   stone×2 · 상대 **117**/120 · 내 행동 idle
        타격     stone → npc-1 피해 3 (base 4 + 능력몫 **0** = raw 4, 방어 30)

        능력몫 0 — 전해진 것은 물건의 위력이지 던진 이의 힘이 아니다.

    ② 적대가 아니면 상하지 않는다. 그래도 돌은 준다
        Before  stone×2 · 상대 120/120
        After   stone×**1** · 상대 **120**/120 · 타격 수 0
        접촉     {"skill":"stone","reason":"not-hostile"}

    ③ 끊긴 사용은 흔적을 남기지 않는다
        Input   use-item(stone) 뒤 0.17초만 굴린다 (0.5초에 못 미친다)
        After   내 행동 use-item · **stone×3 그대로** · 타격 수 0

    ④ 곡괭이를 쓰면 캔다. 곡괭이는 줄지 않는다
        Input   use-item(pickaxe) → {"status":"success","rule":"**RULE-MINE-001**"}
        After   stone×1 pickaxe×**1** · 광맥 5 → **4**

    ⑤ 두 입구, 하나의 판정
        mine        → failure / RULE-MINE-001 / no-target-selected
        use(곡괭이)  → failure / RULE-MINE-001 / no-target-selected
        관찰 interactions.mine.reason        = no-target-selected
        관찰 inventory[pickaxe].use.reason   = no-target-selected

    ⑥ 채집 판정이 용도에서 나온다
        돌 99개로 캐기 → failure / RULE-MINE-001 / **no-mining-tool**

## PROJECTION — 실측 (세계 프로세스에 실제 이어짐으로 붙었다)

    `npx tsx server/main.ts` → ws://localhost:5180/world · join(observerId) → observation

    첫 관찰   observer = e2e-1 / 내 몸 = player-1
    소지품    [{"kind":"pickaxe","count":1,"category":"tool","stackable":true,
               "actions":[{"id":"use-item","role":"use-item","available":false,
                           "unavailableReason":"no-target-selected"}]}]
    고른 뒤   [["pickaxe",1,false,"target-kind-mismatch"]]

    계약이 요구한 모든 자리가 전송 경계를 넘어 그대로 온다. `hud` 에
    `inventory.stone` 도 `tool.hasMiningTool` 도 없다.

## VIEW FIXTURE — 실측 (World 미기동, Fixture 만)

    view/tests/inventory.spec.ts     17개 전부 통과
        mining-available.fixture     stone×2 "먼저 대상을 고르자" / pickaxe×1 "가능"
        deposit-depleted.fixture     pickaxe 의 쓰기 줄이 "광맥이 고갈되었다"
        모르는 종류(boundary-crystal) 정의만 있어도 줄이 뜨고 이름은 코드 그대로
        모르는 사유(ritual-forbidden) 코드 그대로 — **View 가 사유를 만들지 않는다**

## PLAYABLE — 실측

    세계 프로세스(`npx tsx server/main.ts`)에 실제 이어짐으로 붙어 플레이 순서를 밟았다.
    화면이 보여 주는 것만 읽고, 세계가 "쓸 수 있다" 고 할 때만 썼다.

        [42]  광맥 앞      소지품 pickaxe×1(쓸 수 있다)
              ③ 곡괭이를 쓴다 → 채집이 시작된다
        [78]  캐고 나서    소지품 stone×1 pickaxe×1 | 광맥 남은 양 4
              … 노리는 중 (거리:out-of-range 상대:move)
        [160] 닿는 자리    소지품 stone×1(쓸 수 있다) | 상대 태도 hostile
              ⑤ 돌을 던진다
        [176] 던진 뒤      소지품 pickaxe×1   ← **돌이 다 없어졌다**
              타격 [["attack",17],["stone",**3**]]
              상대 생명 **117**/120

    캐서 얻은 돌을 써서 자기를 사냥감으로 보는 것에게 실제로 해를 입혔고, 쓴 만큼
    소지품이 줄었다. Cycle Goal 의 문장이 세계에서 그대로 일어난다.

    ### 처음에는 성립하지 않았다 — 무엇이 문제였고 무엇을 고쳤는가

    첫 실측에서 아홉 번 던져 아홉 번 다 끊겼다. 원인을 쟀다.

        30초 · 900 프레임 (적대 자율 존재가 실제로 덤벼오는 상태)

                                        사거리 2.0        사거리 5.0
            밀려난 최대 거리               3.22            3.22
            사거리 안에 있던 프레임          35 (3.9%)      194 (21.6%)
            그중 상대가 안 휘두르던 것      **4 (0.4%)**   **89 (9.9%)**
            던지기에 필요한 연속 프레임      15 (0.5초)      15 (0.5초)

        2.0 은 상대의 휘두름 **안쪽**이었다. 그 자리에서는 던질 수 있는 자리가 곧 맞는
        자리이고, 맞으면 행동이 끊길 뿐 아니라 3.22 까지 밀려나 던질 수 있는 자리에서
        벗어난다. 조건이 맞는 프레임이 흩어져 있어 **어떤 길이의 사용도 들어가지 않았다** —
        사용 시간을 0.8 → 0.5 로 줄여 다시 재도 잘 노리는 전략으로 60초 11회 시도
        **성립 0회**, 그 사이 내 생명 120 → 0.

        고칠 수 있는 자리가 셋이었고 셋 다 Stage 1 이 Human 승인으로 못 박은 경계라
        Cycle Definition (Human) 으로 반환했다. **Human 결정: 사거리를 늘린다.**

        정정 뒤 같은 전략으로 60초 16회 시도 **9회 성립**, 상대 생명 120 → 93,
        돌 9개를 다 썼다. 위 실제 플레이도 그 뒤의 것이다.

    ### 고친 방식 — 수가 아니라 자리를 세웠다

        사거리를 상수로 박지 않고 **정의가 지니는 값**으로 만들었다 (`ItemUse.Range`).
        밝히지 않으면 손이 닿는 거리를 쓴다. 규칙은 그 값을 읽을 뿐 종류를 묻지 않으므로,
        닿는 거리가 다른 물건이 생겨도 판정은 바뀌지 않는다 — 이 Cycle 이 세운 형태
        그대로다 (DC-ITEM-KIND-IS-DATA-NOT-BRANCH).

        손이 닿는 거리(2.0)는 **그대로다.** 채집은 영향받지 않는다 (회귀 항목).

    ### 5.0 이 여는 것과 열지 않는 것

        여는 것      "붙기 전에 한 발." 던지면 상대가 온다 — 자율 존재의 인지 범위(12)
                    안쪽이기 때문이다. 값을 치르는 방식이 "맞으면서 던진다" 에서
                    **"다가오는 시간을 쓴다"** 로 바뀐다
        열지 않는 것  닿지 않는 곳에서 일방적으로 때리는 수. 투사체의 비행 · 빗나감 ·
                    엄폐도 이 Cycle 이 만들지 않는다 (01-cycle.md EXCLUDED)

        그리고 돌만으로는 이기지 못한다 — 9회 성립으로 상대 생명이 120 → 93 이었고
        그 사이 던진 쪽이 쓰러졌다. `IT-COMMON-STONE` 의 "기적은 없고 양이 있다" 가
        그대로 플레이가 된다.

## REGRESSION — 실측

    손이 닿는 거리 (C001)
        사거리를 정의가 지니게 한 뒤에도 `INTERACTION_RANGE`(2.0)는 그대로다.
        실측: 광맥에서 4 떨어진 자리(돌의 사거리 안, 채집의 거리 밖)에서 채집을 요청하면
        `out-of-range` 가 나온다 — 물건의 거리가 행동의 거리를 밀어내지 않았다.

    캐기 (C001 · C002 · C017)
        world/tests/mine.spec.ts 7개 전부 통과. **기대값을 한 줄도 고치지 않았다** —
        읽는 자리만 hud 에서 소지품 목록으로 옮겼다.
        대상 · 거리 · 남은 양 · 시간 · 얻는 양 · 실패 사유가 모두 그대로다.

    휘두름의 피해 (C007 · C010 · C012 · C013 · C015)
        damage · critical · penetration · guard · damage-type 테스트 전부 통과.
        `ruleDamageCalculate` 의 입력만 넓어졌고 식은 무변경이므로 **기대값이 하나도
        바뀌지 않았다**. 실측: 기본 스킬 base 6 + 능력몫 > 0 (item-use.spec 회귀 항목).

    태도 관문 (C018)
        relation · unharmed-contact 테스트 통과. 아이템으로 닿은 무산도 같은 자리에
        같은 사유(not-hostile)로 실린다 — 실측 ②.

    참여 (C004 · C005)
        observer.spec · world-host.spec 통과. 새 몸이 곡괭이 하나를 지니고 시작하고,
        끊겼다 돌아오면 가진 것이 이어진다. 남의 소지품은 오지 않는다.

    막기 · 살펴봄 · 지목 · 명령 · 시점 · 충돌
        전부 통과. 전체 **880 passed (50 files)** · `boundary:check` 경계 위반 0.

## MASTER FEEDBACK

    Capability Overlay
        MC-USE-ITEM   MISSING → **IMPLEMENTED**
            근거 이 문서의 WORLD SCENARIO ①~⑥ · PROJECTION · VIEW FIXTURE · PLAYABLE.
            world_shape 의 세 문장이 모두 실측으로 확인된다 —
                "지금 쓸 수 있는 것과 없는 것이 사유와 함께 구분되어 보인다"  PROJECTION
                "쓰면 대상의 상태가 실제로 달라지며 그만큼 수량이 준다"        PLAYABLE
                "실패한 시도 뒤에는 상태도 수량도 그대로다"                   SCENARIO ③
            코드가 있다는 사실이 아니라 세계 프로세스 실측이 근거다.

        MC-RESTORE-BIOLOGICAL-STATE · MC-CUT-ABNORMAL-STRUCTURE   MISSING 유지
            이 Cycle 은 그 어느 것도 닫지 않았다 (Q31 의 결정 그대로).

        MC-EQUIP-ITEM · MC-CRAFT-FROM-MATERIALS · MC-TRANSFER-ITEM   MISSING 유지
            **공통 앞칸의 대부분이 섰다.** 정의소 · 변경 단일 통로 · 소모 · 원자성 ·
            용도 사슬의 몸에 닿는 절반이 이 Cycle 로 생겼다.

    Constraint Evaluation
        DC-ITEM-KIND-IS-DATA-NOT-BRANCH        SATISFIED
            `MINING_CAPABLE` 집합 · 종류 이름 고정형 · 돌 전용 화면 칸 셋이 모두 사라졌다.
            근거 — 정의만 더한 아이템(boundary-crystal)이 규칙·화면·시험을 열지 않고
            소지품에 나타나는 것을 View 테스트가 재현한다.
        DC-ITEM-CAPABILITY-COMES-FROM-GRANTS   SATISFIED
            채굴 판정이 RULE-BODY-USES-001 을 지난다. 돌 99개는 용도를 주지 않는다 (실측 ⑥).
            **절반만 섰다** — `IM-*` 의 grants 가 몸에 닿는 것은 장착의 몫이다.
        DC-ITEM-CHANGE-IS-ONE-UNIT             SATISFIED
            시작은 확인만, 완료가 재검증 → 효과 → 소모. 끊긴 사용이 수량을 축내지 않는
            것을 실측 ③ 이 보인다.
        DC-WORLD-OWNS-THE-SURFACE-LIST         SATISFIED
            가능/사유의 단일 출처가 세계다. 화면에 불가로 보이는 것을 억지로 요청해도
            같은 사유로 거절된다 (item-use.spec). View 는 모르는 사유를 코드 그대로 옮긴다.
        DC-WORLD-RESOURCE-ADAPTATION-TRACE     SATISFIED (부분)
            돌은 `IT-COMMON-STONE` 을 밝힌다. 곡괭이는 상위 노드가 없다 — 지닌 것이
            성질이 아니라 용도이기 때문이며, 세울지는 Master 판단이다 (아래 Master Gap).
        DC-COMBAT-ONE-FORMULA                  SATISFIED
            `ruleDamageCalculate` 본문 무변경. 기존 피해 테스트가 기대값 수정 없이 통과.
        DC-COMBAT-ONE-LAYER-AT-A-TIME          SATISFIED (다만 판정의 근거가 바뀌었다)
            Stage 1 은 "사거리·공식·관문 셋을 그대로 두므로 층이 올라가지 않는다" 로
            SATISFIED 를 주장했다. 실측이 그 주장 하나를 깨뜨렸다 — **사거리를 그대로
            두면 그 효과가 성립하지 않는다.** 사거리는 정정되었고(2.0 → 5.0),
            공식과 관문 둘은 손대지 않았다. 전투 사다리의 층은 여전히 하나도 올라가지
            않았다 — 새 능력치도 새 감쇄식도 새 판정도 없고, 이미 있는 층에 **입구가
            하나 더 생겼을 뿐**이며 그 입구는 소지품이다.

            남는 교훈 — **"손대지 않는다" 가 곧 "값싸다" 는 아니다.** 무엇을 안 건드릴지는
            그 결정이 플레이를 성립시키는지 재 본 뒤에야 값을 매길 수 있다.

    ── Human 이 위층으로 전달을 지시한 것 (2026-08-21) ────────────────

    **여러 가지 공격 방식을 이후 구현해야 한다**

        Human 지시 원문 — "추천대로 하고 여러가지 공격방식을 이후 구현해야 함 master로 전달"

        이 Cycle 이 그 자리를 열어 두었다. 지금 세계의 공격은 **휘두름 하나의 모양**뿐이고
        (칼끝이 호를 그리며 쓸고 지나가 닿는 것을 친다 — C006), 이번에 그 옆에
        **다른 모양 하나**가 처음 섰다: 고른 것에게 거리를 두고 위력을 전한다.

        무엇이 이미 데이터가 되었나 (새 갈래를 더할 때 규칙이 열리지 않는 자리)
            위력          BaseDamage · AttackRatio · DamageType  — 정의가 지닌다
            닿는 거리      ItemUse.Range                          — 정의가 지닌다
            쓰는 시간      ItemUse.Duration                       — 정의가 지닌다
            대상 요구      ItemUse.Targeting                      — 정의가 지닌다
            치르는 것      ItemUse.Consumes                       — 정의가 지닌다
            효과 갈래      ItemEffect                             — 목록이다

        무엇이 아직 없나 (다음 갈래들이 요구할 것으로 보이는 것)
            휘두름의 모양   지금 하나뿐이다 — 범위 · 방향 · 여럿을 함께 치는가가
                          스킬 코드에 박혀 있고 정의로 나와 있지 않다 (C006 의 collider)
            투사체         날아가는 것 · 비행 시간 · 도중의 차단. 이번 던지기는 즉시
                          닿는다 — 날아가는 것을 만들지 않았다
            지속 효과      쓰는 동안 이어지는 것 · 시간이 지나 사라지는 것.
                          배율 합성 얼개(MC-CONDITION-STACKING)의 자리가 비어 있다
            여러 상대       한 번에 여럿에게 작용하는 형태
            빗나감 · 엄폐   맞고 안 맞고가 갈리는 자리 (R1 §13 이 이후 확장으로 지정)

        위층에 남기는 물음
            (a) "공격 방식" 이 전투 사다리의 **층**인가, 아니면 이 Cycle 이 세운 것처럼
                **정의가 고르는 갈래**인가. 후자면 스킬도 같은 자리로 내려와야 한다 —
                지금 스킬은 `SKILL_DEFINITIONS` 라는 별도 표를 쓴다
            (b) 어느 Possibility 가 그것을 요구하는가 (7 조건 2). 지금 Frontier 에는
                그 요구가 적혀 있지 않다 — MP-ADAPT-BY-RESOURCE 인지, 전투 갈래인지,
                아니면 새 Possibility 인지
            (c) DC-COMBAT-ONE-LAYER-AT-A-TIME 과 어떻게 만나는가. 방식이 갈래라면
                갈래를 늘리는 것은 층을 올리는 것이 아니다 — 그 구분을 위층이 정해야
                Cycle 이 한 번에 얼마를 열지 판단할 수 있다

        Decision By  Human (Master 세션)

    Constraint Candidate
        **CC-A-COST-MUST-LEAVE-A-WINDOW** (관찰된 반복 패턴 — 승격 판단은 Human)
            시간이 드는 행동에 "그동안 무방비" 라는 대가를 붙일 때, 그 시간이 상대의
            개입 주기보다 길면 대가가 아니라 **불가능**이 된다. 이 Cycle 이 그것을
            수치로 만났다 (필요 15프레임 · 조건 충족 4프레임/900).
            C019(행동 구간)가 취소 판정을 세우면 같은 자리를 다시 만난다 — 그쪽에서도
            "끊을 수 있다" 와 "언제나 끊긴다" 가 갈려야 한다.
            같은 형태를 두 번째로 만나면 승격을 제안한다.

            **이 Cycle 에서 실제로 값을 치렀다** — 사거리 2.0 에서 조건 충족 프레임이
            0.4% 였고, 그것이 "대가" 가 아니라 "불가능" 이었다. 5.0 으로 정정한 뒤
            9.9% 가 되어 비로소 대가가 되었다. 승격 여부와 무관하게 이 숫자가 근거다.

    Master Gap
        **곡괭이에 상위 정의(`IT-*`)가 없다**
            Conflict     DC-WORLD-RESOURCE-ADAPTATION-TRACE 는 성질의 세계 유래를
                         요구하고, 곡괭이가 지닌 것은 성질이 아니라 용도다 (IS §3.3).
                         그래서 어긴 것은 아니지만, 세계의 아이템 중 유래를 답하지
                         못하는 것이 하나 생겼다.
            Affected     IT-COMMON-STONE 과 나란히 설 노드의 부재 · 이후 제작이
                         "무엇으로 만든 도구인가" 를 물을 때 답할 자리
            Options      (a) 문명권 유래의 평범한 도구 노드를 세운다
                         (b) 용도만 지닌 아이템은 유래를 요구하지 않는다고 명시한다
            Decision By  Human

        **[해소됨] 첫 효과 항목이 세계에서 성립하지 않는다**
            Human 이 (a) 를 골랐다 — 던지기의 사거리를 휘두름 밖으로 둔다.
            반영과 재측정은 PLAYABLE 이 지닌다. MP-ADAPT-BY-RESOURCE 의 첫 칸이
            세계에서 실제로 굴러간다.

## FAILURES

    없음 — 반환 1건은 해소되었다.

    [해소됨] Playable
    무엇이었나  던지기 사거리 2.0 에서는 적대 상대에게 위력을 전하는 사용이 성립하는
               창이 없었다 (조건 충족 4프레임/900, 필요한 것은 연속 15)
    반환처      Cycle Definition (Human)
    결정        사거리를 늘린다 (Human · 2026-08-21)
    반영        `ItemUse.Range` 를 세우고 돌에 5.0 을 주었다. 01-cycle.md SCOPE NOTE ③
               과 EXCLUDED 의 해당 칸을 정정했다 (승인된 경계를 Agent 가 옮긴 것이
               아니라 Human 결정을 옮겨 적은 것이다)
    재측정      조건 충족 4 → 89 프레임/900 · 60초 16회 시도 9회 성립 ·
               세계 프로세스 실측 타격 기록 `["stone", 3]`

## STATUS

    IN PROGRESS

    검사 6종 전부 통과. 880개 자동 검증과 세계 프로세스 실측이 근거다.
    **Human Play 확인만 남았다** — 그 확인 뒤에 COMPLETE 로 바꾼다.
