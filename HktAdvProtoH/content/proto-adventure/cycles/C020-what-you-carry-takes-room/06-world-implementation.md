# C020 — World Implementation

> 이 Cycle 은 **하나의 구조를 갈아 끼웠다.** 지닌 것을 세는 방식(Map → 자리 목록)과
> 물건을 묻는 문장(종류 이름 → 카탈로그의 용도)이 바뀌었고, 늘리기만 하던 통로가
> 받기·덜어내기 둘로 갈렸다. 새 계산도 새 난수도 없다.
>
> 갈아 끼운 곳이 좁았다는 것이 실측으로 확인됐다 — 옛 인벤토리 API 를 쓰던 곳은
> 세계 전체에 다섯 자리(`mine.ts` · `observer-view.ts` · `spawn.ts` · `observer-body.ts` ·
> View 의 HUD 표 하나)뿐이었다.

## IMPLEMENTED

    world/semantic/item.ts (CHANGED — 사실상 신규)
        ItemKind          `'stone' | 'pickaxe'` 합집합 → `string` (카탈로그 열쇠)
        ItemUse           `'mining'` — 물건이 선언하는 용도
        ItemCategory      `tool | material` — 표시용 의미 코드. 규칙이 이 값으로 갈리지 않는다
        ItemDefinition    id · category · stackable · stackLimit · uses · itemType
        ITEM_CATALOG      단일 정의소 (stone · pickaxe)
        itemDefinition() · stackLimitOf() · usesOf()
        `MINING_CAPABLE` 집합과 `hasMiningCapability()` 가 **사라졌다**

    world/semantic/inventory.ts (CHANGED — 사실상 신규)
        CARRY_CAPACITY_DEFAULT = 3
        InventorySlot     { kind · count } — count 는 1 이상, stackLimit 이하
        Inventory         { capacity · slots: (InventorySlot | null)[] }
        usedSlots() · itemCount() · slotAt() · roomFor() · canAccept()
        carriedUses()     Actor.CarriedUses (파생) — **장착이 오면 고칠 곳은 여기 한 자리다**
        lastWayUses()     Inventory.LastWayUses (파생) — 자리 하나뿐인 용도들
        fillSlots() · clearSlot()  — 담고 비우는 일. **판정하지 않는다**
        `hasMiningTool()` 이 **사라졌다** — 그 물음은 carriedUses 가 받는다

    world/rules/carry.ts (ADDED)
        RULE-CARRY-ADD-001      evaluateCarryAdd() + ruleCarryAdd()
        RULE-CARRY-LET-GO-001   evaluateCarryLetGo() + ruleCarryLetGo()
        사유 코드 5종 — unknown-item · invalid-quantity · carry-full ·
                       carried-not-found · last-way-locked

        판정과 실행을 가른 것이 이 파일의 형태다. `evaluate*` 는 관찰(projection)과
        Rule 이 **함께 부른다** — 표시용 판정과 실행 판정이 갈리면 화면이 허락한 것을
        세계가 거절한다.

    world/actions/interactions.ts (ADDED 항목 하나)
        `let-go` — `withActor` 로 주체를 해석하고 `action.carriedSlot` 을 넘긴다.
        수용층은 검증하고 rules 를 부를 뿐 상태를 직접 바꾸지 않는다.

    protocol/gameview.ts (ADDED — 팩 소유분)
        CarriedItemView   slot · kind · category · quantity · stackLimit · uses · actions
        CarriedActionView interactionId · slot · effect · available · reason?
        CarriedRoomView   used · total
        GameViewSnapshot 에 `carried` · `carriedRoom` 두 자리

    protocol/actions.ts (ADDED — 팩 소유분)
        `carriedSlot?: number` — 아래 SPEC AMENDMENT 참조

    protocol/semantic-id.ts (ADDED)
        RULE_CARRY_ADD · RULE_CARRY_LET_GO + 이 Cycle 의 Intent ID 7종

## REUSED

    ActionRequest 봉투 · dispatch          engine/world-kernel — 한 글자도 닿지 않았다
    InteractionView.available / reason     C009 · C010 의 사유 계약 그대로
    RULE-ACTION-BEGIN-001 · PROGRESS-001   채굴이 그 위에 그대로 선다
    World.TargetSelections                 C017 — 채굴 대상을 읽는 관계 무변경
    INTERACTION_RANGE · MINE_DURATION      한 글자도 닿지 않았다
    spawnActor()                           createInventory 의 기본 인자로 그대로 돈다

## CHANGED

    world/rules/mine.ts
        RULE-MINE-001
            P3  `hasMiningTool(inventory)` → `carriedUses(inventory).has('mining')`
                이 한 줄이 DC-ITEM-CAPABILITY-COMES-FROM-GRANTS 의 구현이다
            P6  `evaluateCarryAdd(inventory, deposit.resourceKind, 1) === 'carry-full'`
                → 자리가 없으면 **캐기 시작하지도 않는다**. 고갈 판정 뒤에 온다
            MineFailureReason 에 `carry-full` 추가
        RULE-MINE-COMPLETE-001
            받기가 먼저, 광맥 감소가 나중이다. 받지 못하면 **광맥도 줄지 않는다**
            시작 판정과 **같은 함수**(evaluateCarryAdd)를 쓴다 — 두 곳이 각자 세지 않는다

    world/rules/observer-body.ts
        BodyDefaults.items 의 형이 `Partial<Record<'stone'|'pickaxe', number>>` →
        `Record<string, number>` 로 넓어졌다 (종류 이름이 형을 좁히지 않는다)
        BodyDefaults.carryCapacity 추가

    world/index.ts
        `setup.carryCapacity ?? CARRY_CAPACITY_DEFAULT` — depositAmount · debugAuthority 와
        같은 자리다. 세계를 띄우는 쪽이 정한다
        `setup.actorItems` 의 형도 함께 넓어졌다

## AFFECTED UPDATED

    world/projection/observer-view.ts
        REMOVED  `inventory.stone` counter · `tool.hasMiningTool` flag
        ADDED    `carried` (projectCarried) · `carriedRoom`
        projectCarried 는 **빈 자리를 싣지 않는다.** 카탈로그에 없는 종류도 기본값으로
        그려진다 — 등록 누락이 관찰을 멈추지 않는다

    world/tests/mine.spec.ts · world/tests/observer.spec.ts · server/tests/world-host.spec.ts
        `hud['inventory.stone']` 를 읽던 헬퍼 셋이 `carried` 목록의 합으로 바뀌었다.
        **검증의 의미는 바뀌지 않았다** — "남의 소지품은 실리지 않는다" 도 그대로 통과한다

    view/tests/fixtures/*.fixture.json (19개) · view/tests/resolve.spec.ts
        계약이 늘었으므로 Fixture 도 늘었다 (`carried: []` · `carriedRoom`).
        Fixture 는 실제 Snapshot 을 대신하므로 계약과 함께 자란다

## PROJECTION

    04-gameview.spec.yaml 의 계약을 그대로 산출한다.

    carried[]        slot · kind · category · quantity · stackLimit · uses · actions
    carriedRoom      { used, total }
    interactions.mine.reason 에 `carry-full` 이 실린다

    `actions[].available` 은 `evaluateCarryLetGo` 를 부른다 — RULE-CARRY-LET-GO-001 이
    부르는 바로 그 함수다. 이것이 "표시와 실행이 같은 판정을 쓴다" 의 구현이며,
    테스트가 그 동일성을 실측한다 (carry.spec.ts — 관찰의 reason 과 요청의 reason 이
    같은 코드로 나온다).

## SPEC AMENDMENT — 04-gameview.spec.yaml 정정 1건

    04 는 "새 요청 파라미터는 없다 — 자리마다 다른 interactionId 를 실어 보낸다" 고
    적었다. 구현에서 **사실이 아님이 드러났다.**

        engine/world-kernel/dispatch.ts:26   handlers.get(action.interactionId)

    요청 dispatch 는 핸들러 id 를 **정확히 맞춰** 찾는다. 자리마다 다른 id 를 만들면
    그 요청은 어디에도 도달하지 못한다. Map 조회를 접두사 매칭으로 바꾸는 것은
    engine 편집이고 컨텐츠 작업에서 금지되어 있다.

    그래서 자리 번호는 **팩이 소유하는 요청 파라미터**로 간다 —
    `protocol/actions.ts` 의 `carriedSlot`. `mode`(C007) · `attribute`(C007 R2) 와
    같은 자리이며 선례가 있다.

    게임 의미는 하나도 바뀌지 않았다. 무엇을 보내는가가 아니라 **어떻게 싣는가**의
    정정이므로 Stage 5 의 APPROVED 를 다시 받지 않았다 — 04 에 AMENDMENT 로 표기하고
    그 사유를 남겼다. 이 판단이 과했다면 08 의 FAILURES 로 되돌린다.

    `targetEntityId` 로 자리를 싣는 길은 택하지 않았다. 그 자리는 세계의 존재 Id 를
    위한 것이고, 03 이 "자리 번호는 세계의 존재 Id 가 아니다" 를 명시했다.

## TESTS

    world/tests/carry.spec.ts (신규 · 27건) — 전부 통과

        INTENT-ITEM-CATALOG-001                3건  정의 소유 · IT-* 유래 · 미등록 종류 폴백
        INTENT-USE-COMES-FROM-DECLARATION-001  3건  용도로 묻는다 · 없으면 거절 · 재료만으론 안 된다
        INTENT-CARRY-ROOM-001                  3건  곡괭이가 자리를 쓴다 · 쌓임과 새 자리 · 자리 수는 설정값
        INTENT-ACQUIRE-IS-ALL-OR-NOTHING-001   5건  가득해도 받음 · carry-full · 광맥이 남음 ·
                                                   부분 수용 없음 · 사유의 순서
        INTENT-CARRIED-IS-OBSERVABLE-001       4건  전용 칸 제거 · 가능/사유 동반 · 용도 노출 · 빈 자리 미노출
        INTENT-LET-GO-001                      5건  자리가 빔 · 세계에 안 나타남 · 없는 자리 ·
                                                   자리 미기재 · 채굴 중에도 됨
        INTENT-NO-DEAD-END-001                 3건  마지막 길 잠금 · 둘이면 하나는 풀림 · 용도 없으면 무관
        C020 BALANCE                           1건  여섯 판정이 한 시나리오에서 순서대로 도달

    전체 회귀

        npm test           52 files · 889 tests 통과 (C020 이전 862 → 27 증가)
        npx tsc --noEmit   오류 0
        npm run boundary:check   경계 위반 0 (engine→content · 팩 간 격리)

## NOTES

    ① 갈아 끼운 자리가 다섯뿐이었다

        옛 인벤토리 API(`createInventory` · `hasMiningTool` · `itemCount` · `ItemKind`)를
        쓰던 곳을 전부 세었더니 다섯이었다. 종류→개수 Map 이 세계에 깊이 퍼지지 않았던
        것은 C001 이 그것을 `semantic/` 안에 가둬 둔 덕이다 — 구조를 갈아 끼우는 Cycle 이
        이렇게 작을 수 있는 이유가 그것이다.

    ② `carriedUses` 가 장착 Cycle 의 접합점이다

        지금 이 함수는 slots 를 읽는다. 장착이 오면 **입력만** 적용된 것들로 바뀐다.
        채굴 규칙도, 관찰도, 테스트도 고칠 필요가 없다 — 그것이 이 Cycle 이 "묻는
        문장만 바꾼다" 고 한 이유다 (02 INTENT-USE-COMES-FROM-DECLARATION-001).

    ③ 초기 소지품은 전량 원자성의 예외다

        `createInventory` 는 초기값이 자리에 다 들어가지 않으면 들어가는 만큼만 담는다.
        규칙 경로의 전량 원자성과 다른 자리다 — 여기는 세계가 시작되기 **전**이고,
        세계를 띄우는 쪽의 설정 오류가 세계를 못 뜨게 만들어서는 안 된다.
        주석으로 그 경계를 밝혀 두었다.

    ④ 세계 개체화가 오면 고칠 곳은 한 줄이다

        `ruleCarryLetGo` 의 Transition 은 지금 `clearSlot` 하나다. Cycle 4 가 오면
        그 앞에 "세계에 놓는다" 가 더해지고 나머지는 그대로다 — 행동도, 사유 코드도,
        관찰 계약도 바뀌지 않는다.
