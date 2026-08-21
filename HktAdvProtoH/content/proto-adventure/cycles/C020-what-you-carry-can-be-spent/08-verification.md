# CYCLE C020 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[FAIL] Playable          — 적대 상대에게 던지는 것이 세계에서 성립하지 않는다 (아래 PLAYABLE)
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

## PLAYABLE — [FAIL] 적대 상대에게 던지는 것이 성립하지 않는다

    성립한 것 (세계 프로세스 + 이어짐으로 실제 플레이 순서를 밟았다)

        ① 광맥으로 이동 → ② 광맥을 고른다 → ③ **곡괭이를 쓴다** → 채집이 시작된다
        [43] 광맥 앞   소지품 pickaxe×1(쓸 수 있다)
        [80] 캐고 나서 소지품 stone×1 pickaxe×1 | 광맥 남은 양 4

        곡괭이를 쓰는 것으로 캐는 일이 화면을 거쳐 실제로 이루어졌고, 캔 돌이
        소지품 목록에 나타났으며, 곡괭이는 줄지 않았다.

    성립하지 않은 것

        ④ 자율 존재를 고른다 → ⑤ 돌을 던진다 → **매번 끊긴다**
        [148] 닿는 자리 stone×1(쓸 수 있다) | 상대 태도 hostile
              ⑤ 돌을 던진다
        [155] **끊겼다** — 던지는 중에 맞았다. stone×1(out-of-range) (줄지 않았다)
        … 아홉 번 되풀이. 성립 0회.

    ### 왜 성립하지 않는가 — 잰 값

        30초 · 900 프레임 (적대 자율 존재가 실제로 덤벼오는 상태)

            맞은 횟수                     5
            밀려난 최대 거리               **3.22**   (던지기 사거리 2.00)
            사거리 안에 있던 프레임          35 (3.9%)
            그중 상대가 안 휘두르던 것       **4 (0.4%)**
            던지기에 필요한 연속 프레임      15 (0.5초)

        **필요한 창이 15프레임인데 조건이 맞는 프레임이 30초에 4개뿐이고, 그 넷도
        이어져 있지 않다.** 원인은 튜닝이 아니라 구조다.

            던지기의 사거리는 상호작용 거리(2.0)다 — 그 거리는 상대의 휘두름 **안쪽**이다.
            휘두름은 두 가지를 한다: 내 행동을 끊고(RULE-HIT-001), 나를 **3.22 까지
            밀어낸다**(SWING_IMPULSE). 그래서 던질 수 있는 자리는 곧 맞는 자리이고,
            맞으면 던지지 못할 뿐 아니라 던질 수 있는 자리에서 벗어난다.

        수치를 고쳐 넘을 수 있는지 확인했다 — 넘지 못한다.

            0.8초 → 0.5초로 줄여 다시 쟀다 (BALANCE 정정, 03-world-semantic.md).
            잘 노리는 전략(사거리 밖이면 다가가고, 상대가 안 휘두를 때만 던진다)으로
            **60초 동안 11번 시도, 성립 0회, 그 사이 내 생명 120 → 0.**

        더 줄여도 같다. 0.4%의 프레임이 흩어져 있는 한 어떤 길이도 들어가지 않는다.

    ### 이 실패가 건드리는 것

        Cycle Goal 의 앞부분 — "캐 둔 돌을 써서 **자기를 사냥감으로 보는 것에게 실제로
        해를 입히고**" 가 세계에서 이루어지지 않는다.

        Goal 의 나머지는 이루어진다 — 쓴 만큼 소지품이 줄고(②), 쓸 수 없을 때 무엇이 왜
        안 되는지가 소지품에 함께 오며(PROJECTION · VIEW FIXTURE), 가진 것이
        치를 수 있는 것이 되었다(④·②).

    ### 이것을 여기서 고치지 않는 이유

        고칠 수 있는 자리가 셋인데 **셋 다 Stage 1 이 Human 승인으로 못 박은 자리**다.

            사거리를 늘린다        01-cycle.md EXCLUDED "원거리 경로" 를 여는 일이다
            첫 효과 항목을 바꾼다   01-cycle.md SCOPE NOTE ② 의 버려진 대안으로 돌아가는 일이다
            밀침·끊김을 손댄다     전투 층이며 C019 의 영역이다 (SCOPE NOTE ①·③)

        검증이 통과하도록 승인된 경계를 Agent 가 옮기지 않는다 (guides/verification.md
        MUST NOT). Cycle Definition (Human) 으로 반환한다.

## REGRESSION — 실측

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
        전부 통과. 전체 **877 passed (50 files)** · `boundary:check` 경계 위반 0.

## MASTER FEEDBACK

    Capability Overlay
        MC-USE-ITEM   MISSING → **PARTIAL**
            근거 이 문서의 WORLD SCENARIO ①~⑥ · PROJECTION · VIEW FIXTURE.
            선 것 — 정의소 · 소지 관찰 계약 · 쓰는 행동 · 소모 · 원자성 ·
                   효과가 정의에서 오는 자리(갈래 둘) · 용도로 하는 능력 판정.
            서지 않은 것 — world_shape 의 "쓰면 몸이나 대상의 상태가 실제로 달라지며"
                   가 **적대 상대에게는 이루어지지 않는다** (PLAYABLE).
                   IMPLEMENTED 로 올리지 않는다 — 코드가 있다는 사실이 아니라
                   실측이 근거다.

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
        DC-COMBAT-ONE-LAYER-AT-A-TIME          **재판정 필요**
            Stage 1 은 "사거리·공식·관문 셋을 그대로 두므로 층이 올라가지 않는다" 로
            SATISFIED 를 주장했다. 실측이 그 주장의 대가를 드러냈다 — 층을 올리지 않은
            것은 맞지만, **올리지 않았기 때문에 그 효과가 성립하지 않는다.**
            판정 자체는 유효하나 "층을 안 올리면 값싸다" 는 읽기는 이 Cycle 에서 깨졌다.

    Constraint Candidate
        **CC-A-COST-MUST-LEAVE-A-WINDOW** (관찰된 반복 패턴 — 승격 판단은 Human)
            시간이 드는 행동에 "그동안 무방비" 라는 대가를 붙일 때, 그 시간이 상대의
            개입 주기보다 길면 대가가 아니라 **불가능**이 된다. 이 Cycle 이 그것을
            수치로 만났다 (필요 15프레임 · 조건 충족 4프레임/900).
            C019(행동 구간)가 취소 판정을 세우면 같은 자리를 다시 만난다 — 그쪽에서도
            "끊을 수 있다" 와 "언제나 끊긴다" 가 갈려야 한다.
            같은 형태를 두 번째로 만나면 승격을 제안한다.

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

        **첫 효과 항목이 세계에서 성립하지 않는다** (PLAYABLE 의 반환과 같은 사안)
            Conflict     MP-ADAPT-BY-RESOURCE 의 첫 칸은 "가진 것이 대신해 준다" 인데,
                         지금 세계에서 가진 것이 대신해 주는 순간이 오지 않는다
            Affected     MC-USE-ITEM 의 world_shape 마지막 줄 · Cycle Goal 앞부분
            Options      (a) 던지기의 사거리를 휘두름 밖으로 둔다 (EXCLUDED 를 연다)
                         (b) 첫 효과 항목을 바꾼다 (SCOPE NOTE ② 의 대안)
                         (c) 지금대로 두고 다음 Cycle 이 원천과 함께 효과를 가져온다 —
                             이 Cycle 은 **바닥만** 세운 것으로 닫는다
            Decision By  Human

## FAILURES

    [FAIL] Playable
    Missing    적대 상대에게 위력을 전하는 사용이 성립하는 창
    Reason     던지기의 사거리(2.0)가 상대의 휘두름 안쪽이고, 그 휘두름이 행동을 끊으며
               나를 3.22 까지 밀어낸다. 필요한 연속 15프레임에 대해 조건이 맞는
               프레임이 30초에 4개뿐이고 이어져 있지 않다. 사용 시간을 0.8 → 0.5 로
               줄여도 60초 11회 시도 성립 0회
    Return To  Cycle Definition (Human) — 고칠 수 있는 세 자리가 모두 Stage 1 의
               승인된 경계다 (사거리 · 첫 효과 항목 · 전투 층)

## STATUS

    IN PROGRESS

    Human Play 확인 전이며, 그 이전에 위 반환에 대한 Human 결정이 먼저다.
    나머지 검사 다섯은 통과했고 877개 자동 검증과 세계 프로세스 실측이 그 근거다.
