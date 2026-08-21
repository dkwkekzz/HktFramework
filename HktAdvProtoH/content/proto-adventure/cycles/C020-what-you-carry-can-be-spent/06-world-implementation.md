# C020 — World Implementation

> 세계 코드에서 **종류 이름으로 판정하는 자리가 하나도 남지 않았다.**
> `MINING_CAPABLE = new Set(['pickaxe'])` 도, `Partial<Record<'stone' | 'pickaxe', number>>` 도,
> `inventory.stone` 도 사라졌다. 그 자리를 정의소 하나 · 통로 하나 · 행동 하나가 대신한다.

## IMPLEMENTED

    World.ItemCatalog · ItemDefinition       world/semantic/item.ts        (전면 교체)
        ItemUse · ItemEffect · ItemTargeting · Force · ItemUseTag · DeclaredAct
        정의 두 벌 (stone · pickaxe) — 수치는 03 의 BALANCE 그대로
    Inventory 조회                            world/semantic/inventory.ts   (판정 제거)
        inventoryEntries — 지닌 것만, 세계가 아는 종류의 순서로
    CurrentAction.kind = use-item             world/semantic/action.ts
        usedItemKind · usedItemTargetId · ACTION_DEFINITIONS['use-item']
    RULE-INVENTORY-ADD-001                    world/rules/inventory.ts
    RULE-INVENTORY-REMOVE-001                 world/rules/inventory.ts
    RULE-BODY-USES-001                        world/rules/body-uses.ts
    RULE-ITEM-USE-001                         world/rules/item-use.ts
    RULE-ITEM-USE-COMPLETE-001                world/rules/item-use.ts
    RULE-ITEM-EFFECT-DELIVER-FORCE-001        world/rules/item-use.ts
    선언된 행동의 표 (DECLARED_ACTS)           world/rules/item-use.ts
    interaction `use-item`                    world/actions/interactions.ts
    ActionRequest.itemKind                    protocol/actions.ts
    InventoryItemView · ItemActionView        protocol/gameview.ts
    소지품 투영 (projectInventory)             world/projection/observer-view.ts
    Rule 식별자 6종                            protocol/semantic-id.ts

## REUSED — 한 줄도 고치지 않고 그대로 쓴 것

    RULE-ACTION-BEGIN-001                     world/rules/action-begin.ts
        `evaluateActionBegin` · `beginAction` 그대로. 사용도 같은 관문을 지난다
    RULE-ACTION-PROGRESS-001                  world/simulation/action-progress.ts
        완료 효과 표에 줄 하나가 늘었을 뿐이다 (판정은 그대로)
    RULE-HARM-GATE-001                        world/rules/relation.ts
    RULE-STRIKE-DAMAGE-001 의 판정 순서         world/rules/strike-damage.ts
        계산 → 치명 → 막기 → 적용 → 사건 기록 → 쓰러짐
    RULE-CRITICAL-STRIKE-001 · RULE-GUARD-BLOCK-001 · RULE-DOWNED-001
    World.TargetSelections                    world/semantic/target-selection.ts
    INTERACTION_RANGE (2.0)                   world/semantic/world-state.ts

## CHANGED

    world/semantic/item.ts
        `MINING_CAPABLE` 집합 **삭제**. 채집 용도는 정의의 `uses` 가 소유한다.
        이 파일이 정의소가 되었다 — 규칙은 이 표에만 묻는다

    world/semantic/inventory.ts
        `hasMiningTool` **삭제**. 소지품 파일이 판정을 지니지 않는다.
        무엇을 할 수 있는지는 정의가 답하고 그 답을 모으는 것은 RULE-BODY-USES-001 이다

    world/rules/mine.ts
        `hasMiningTool(actor.inventory)` → `bodyHasUse(actor, 'mine')`
        `inventory.items.set('stone', …)` → `ruleInventoryAdd(actor, 'stone', 1)`
        **사유 코드 `no-mining-tool` 은 그대로 두었다** — 사람이 겪는 일이 달라지지
        않았고, 문구를 바꾸면 회귀 판정이 흐려진다

    world/rules/damage-calculate.ts
        입력이 `SkillKind` → `Force`. 함수 안의 계산은 **한 줄도 바뀌지 않았다**
        (Step 0~3 · 하한 1 · 반환 형태 전부 동일)

    world/rules/strike-damage.ts
        입력이 `SkillKind` → `Force` + 이름표. 사건에 실리는 `skill` 이 이름표가 된다

    world/semantic/combat.ts
        `forceOfSkill(kind)` 추가 — 스킬이 자기 위력을 넘기는 자리
        `StrikeEvent.skill: SkillKind` → `string` (이름표)

    world/semantic/relation.ts
        `UnharmedContact.skill: SkillKind` → `string` (같은 이유)

    world/simulation/swing-strike.ts
        `ruleStrikeDamage(…, skill)` → `ruleStrikeDamage(…, forceOfSkill(skill), skill)`
        그 외 한 줄도 바뀌지 않았다

    world/rules/observer-body.ts · world/index.ts
        `Partial<Record<'stone' | 'pickaxe', number>>` → `Partial<Record<ItemKind, number>>`

    world/rules/action-begin.ts
        `ActionTarget` 에 `usedItemKind` · `usedItemTargetId` 두 이름이 늘었다 (판정 무변경)

    world/projection/observer-view.ts
        hud 에서 `inventory.stone` · `tool.hasMiningTool` 두 줄 **삭제**
        `inventory: projectInventory(...)` 추가

## AFFECTED UPDATED

    world/tests/mine.spec.ts        `stoneCount` 가 hud 대신 소지품 목록을 읽는다
                                    — **기대값은 한 줄도 바뀌지 않았다**
    world/tests/observer.spec.ts    같은 이유. `stoneOf` 헬퍼를 더했다
    server/tests/world-host.spec.ts 같은 이유
    world/tests/critical.spec.ts    `ruleStrikeDamage` 호출이 위력을 넘긴다
    world/tests/penetration.spec.ts `ruleDamageCalculate` 호출이 위력을 넘긴다
    view/tests/fixtures/*.json      스냅샷마다 `inventory` 자리가 생겼다 (18개, 전부 `[]`)
    view/tests/resolve.spec.ts      미래 스냅샷 픽스처에 같은 자리를 더했다

## PROJECTION

    inventory[]                     world/projection/observer-view.ts (projectInventory)
        kind · count · category · origin · stackable · actions[]
        actions[].available / unavailableReason 는 `evaluateItemUse` 가 낸다 —
        **실행이 쓰는 것과 같은 판정이다**

    이 함수에 종류 이름이 한 번도 나오지 않는다. 종류가 늘어도 이 함수는 바뀌지 않는다.

## 구현이 지킨 것 — 왜 이렇게 두었는가

    효과의 자리가 분기가 아니다
        `ItemEffect` 는 갈래의 합집합이고, 사용 규칙은 `use.effect.kind` 로 갈라진 뒤
        각 갈래의 자기 규칙을 부른다. **아이템 종류를 묻는 자리가 없다.**
        `DECLARED_ACTS` 는 표다 — 새 행동이 선언 가능해지면 항목이 하나 는다

    위임은 진짜 위임이다
        begin-declared-act 는 `ruleMine` 을 그대로 부르고 그 Result 를 그대로 돌려준다.
        판정을 복제하지도, 앞질러 검사하지도 않는다 — 그래서 두 입구의 사유가 언제나 같다
        (테스트: "입구가 둘이어도 판정은 하나다")

    원자성이 코드의 순서로 강제된다
        시작(RULE-ITEM-USE-001)은 수량을 **확인만** 한다. 완료(COMPLETE)는 재검증을
        모두 마친 뒤에야 효과를 넣고, 그 다음 줄에서 수량을 줄인다. 재검증이 수량을
        이미 확인했으므로 마지막 호출은 실패할 수 없다 — 반쪽 상태가 생길 자리가 없다

    공식이 실제로 안 바뀌었다
        `ruleDamageCalculate` 본문은 diff 에서 시그니처 두 줄과 `const skill = …` 한 줄
        삭제뿐이다. 그래서 기존 피해 테스트(critical · penetration · damage · guard)가
        **기대값을 하나도 고치지 않고** 통과한다

## TESTS

    world/tests/item-use.spec.ts    32개 — 신규
        정의소 (4)        무엇인지·용도·겹침을 답한다 · 모르는 종류는 사유가 된다 · 유래
        한 계약 (4)       지닌 것만 · 두 종류면 두 항목 · 전용 칸 소멸 · 순서 결정성
        던진 돌 (5)       시작에는 줄지 않는다 · 끝나면 생명이 줄고 돌이 준다 ·
                         이름표 · 위력은 물건의 것(attackContribution 0) · 기력 무소모
        원자성 (3)        끊긴 사용은 흔적 없음 · 없으면 못 씀 · 마지막 하나 → 항목 소멸
        대상 정책 (4)     미지목 · 종류 불일치 · 거리 밖 · 처음 고른 것을 끝까지 지님
        관문 (2)          적대가 아니면 상하지 않는다 · 그래도 돌은 준다
        둘째 갈래 (4)     곡괭이 → 채집 시작 · 두 입구 같은 사유 · 무소모 · 갈래 둘의 차이
        용도 판정 (2)     용도 없으면 no-mining-tool · 돌 99개도 용도를 주지 않는다
        관찰=실행 (2)     억지 요청도 같은 사유 · 조건이 갖춰지면 가능으로 바뀐다
        회귀 (2)          참여한 몸의 곡괭이 · 휘두름 피해의 길이 그대로

    전체                            860 passed (49 files) · 경계 위반 0
    이 Cycle 전                     828 passed (48 files)

## NOTES

    engine/ 은 한 줄도 건드리지 않았다 (`npm run boundary:check` — 경계 위반 0).
    이 Cycle 이 더한 것은 전부 팩 안이다: `world/` · `protocol/` · 그 테스트.

    View 는 아직 이 목록을 읽지 않는다 — Stage 7 의 몫이다. 지금은 세계가 실을 뿐이며,
    화면에서 돌 칸이 사라진 자리를 목록이 채우는 것은 다음 단계에서 확인한다.
