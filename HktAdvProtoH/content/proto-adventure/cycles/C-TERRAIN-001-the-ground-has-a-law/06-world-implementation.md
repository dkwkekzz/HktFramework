# C-TERRAIN-001 — World Implementation

## IMPLEMENTED

    GroundZone · GroundZoneRole · GroundLawId    world/semantic/terrain.ts
    GroundLawDefinition · GROUND_LAWS            world/semantic/terrain.ts
    isInsideGroundZone · activeGroundLaws ·      world/semantic/terrain.ts
      isSheltered · coveringGroundLaws
    World.GroundZones                            world/semantic/world-state.ts
    World.WarmthMax (WARMTH_MAX)                 world/semantic/world-state.ts
    GROUND_ZONES (초기 배치)                      world/semantic/world-state.ts
    Actor.Warmth · Actor.WarmthMax               world/semantic/actor.ts
    RULE-GROUND-LAW-APPLY-001                    world/simulation/ground-law-apply.ts
    Tick 자리 (CP-RUN-DRAIN 뒤 · TARGET-CLEAR 앞) world/index.ts SYSTEMS
    초기 배치 (헤더 상수 → State)                  world/index.ts createWorld

    관찰 계약 (신규 도메인 파일 — 트랙이 자기 파일을 소유한다)
        GroundZoneView · GroundSelfView · GroundView   protocol/gameview-terrain.ts
        RULE_GROUND_LAW_APPLY · INTENT_* 열            protocol/semantic-id-terrain.ts

## REUSED

    Actor.Position                  world/semantic/position.ts       판정의 유일한 입력
    distance                        engine/physics/vec (재수출)      자리 안인가를 재는 것
    Actor.Hp · HpMax                world/semantic/actor.ts          법칙이 마지막에 닿는 것
    RULE-DOWNED-001                 world/rules/strike-damage.ts     **한 글자도 바꾸지 않고 부른다**
    isDowned                        world/semantic/combat.ts         이미 끝에 이른 몸을 거른다
    Tick dt                         engine/world-kernel              흐름 위에 선다

## AFFECTED UPDATED

    world/semantic/spawn.ts         몸이 열을 가득 지니고 태어난다 (WARMTH_MAX).
                                    종류를 가리지 않으므로 카탈로그가 아니라 세계의 값을 쓴다 —
                                    법칙이 몸을 가리지 않으려면 지니는 것도 가리지 않아야 한다
    protocol/gameview.ts            도메인 목록에 gameview-terrain 을 더하고
                                    GameViewSnapshot 에 `ground` 를 더한다 (**필수 필드**)
    protocol/semantic-id.ts         semantic-id-terrain 재수출
    view/tests/fixtures/*.json      30개 — C-TERRAIN-001 이전에 잡힌 스냅샷이므로
                                    `ground: { zones: [], self: { state: 'none' } }` 를 더했다.
                                    C023 이 `equipment` 를 더할 때와 같은 정비다
    view/tests/resolve.spec.ts      인라인 스냅샷 하나 같은 이유

    **기존 Rule 은 하나도 고치지 않았다** (03 SEMANTIC DELTA CHANGED: 없음).
    판정이 `Actor.Position` 과 `World.GroundZones` 만 읽으므로 기존 규칙 어느 것도
    이 규칙을 알 필요가 없다.

## PROJECTION

    ground.zones                    world/projection/observer-view.ts
        State 를 그대로 투영한다. 관찰자에 딸리지 않는다 — 누가 보든 같은 자리가 거기 있다
    ground.self                     world/projection/observer-view.ts#projectGroundSelf
        **규칙이 매 Tick 쓰는 것과 같은 함수로 계산한다** (`activeGroundLaws`).
        그래서 관찰에 실리는 것과 실제로 일어나는 것이 어긋날 자리가 없다.
        `sheltered` 는 `coveringGroundLaws` 가 가른다 — 자리 안인데 멎어 있는 것과
        애초에 자리 밖인 것이 다르다
    hud[self.warmth] · hud[self.warmthMax]
        self.hp / self.hpMax 와 나란한 자리에 둔다 — 둘이 함께 와야 얼마나 남았는지 읽힌다

## TESTS

    world/tests/terrain.spec.ts     21 tests — 전부 통과

        자리 밖에서는 아무 일도 없다                      회귀의 본체다
        해숨구멍이 빙원 안에 온전히 들어 있다              배치로도 참이어야 한다
        1초에 4 가 준다 · 머문 시간에 비례한다             스침과 버팀이 갈린다
        줄어드는 동안 몸이 상하지 않는다                   BT §5.2
        자율 존재도 똑같이 겪는다                         조종 주체가 판정을 가르지 않는다
        해숨구멍에서 멎는다 · 되돌리지는 않는다             승인 ②
        **다른 법칙의 예외는 이 법칙을 멎게 하지 못한다**   "모든 것을 막는 안전지대" 불가
        나오면 다시 겪는다                               기록이 없으므로 규칙도 없다
        열이 다한 뒤에야 생명이 준다 · 끝은 이미 있는 것    승인 ①
        쓰러진 몸에서는 더 거두지 않는다
        zones · self(none/taking/sheltered) · warmth 관찰
        플레이 — 빙원에 서면 계속 줄고 해숨구멍에 들면 멎는다
        원점에서 시작하는 기존 플레이는 땅에 닿지 않는다    회귀

    전체 스위트 78 files · 1350 tests 통과 (기존 1329 + 21).
    회귀 0 — 기존 테스트를 하나도 고치지 않았다 (fixture 의 새 필드 추가는 계약 정비다).

## NOTES

    1. 규칙과 관찰이 **같은 함수**를 쓴다

       `activeGroundLaws` 하나를 RULE-GROUND-LAW-APPLY-001 과 `projectGroundSelf` 가
       함께 부른다. 관찰용 판정을 따로 만들면 두 개의 진실이 생기고, 그것이 어긋나는
       것은 버그가 되기 전까지 보이지 않는다 (DC-WORLD-OWNS-THE-SURFACE-LIST).

    2. `ground` 를 선택 필드가 아니라 **필수 필드**로 두었다

       비면 `{ zones: [], self: { state: 'none' } }` 가 실린다. 선택 필드로 두면
       "자리가 없는 세계" 와 "계약을 아직 안 채운 세계" 가 같은 모양이 되고, View 가
       그 둘을 구분할 수 없다. 그림을 안 그리는 fallback 은 zones 가 **비었을 때**
       성립하는 것이지 필드가 없을 때가 아니다 (design/Design-Terrain-Visualization.md).

    3. 겹친 법칙을 하나로 고르지 않았다

       `activeGroundLaws` 는 목록을 돌려주고 규칙은 각각을 적용한다. 하나를 고르는
       순간 어느 것을 고를지의 판단이 규칙에 들어오고, 그것은 법칙이 아니라 조정이 된다.
       관찰(`ground.self`)은 첫 항목만 싣는다 — 계약이 법칙 하나를 싣는 모양이며,
       여럿이 겹치는 세계가 실제로 생길 때 그 계약이 열린다.

    4. 자율 존재를 빙원에 두지 않았다

       배치의 결과이지 규칙의 예외가 아니다 (world-state.ts#GROUND_ZONES 주석).
       법칙이 몸을 가리지 않는다는 것은 규칙이 신원을 읽지 않는 것으로 이미 참이며,
       테스트가 그것을 직접 검사한다. 빙원 안에 두면 매 세션 구석에서 방랑자 하나가
       천천히 얼어 죽는 세계가 된다.

    5. STATE_VERSION 을 올렸다 — `proto-adventure/1` → `/2`

       이 Cycle 이 State 의 **형태**를 바꿨다 (WorldState 에 groundZones,
       ActorState 에 warmth · warmthMax). 형태를 바꾼 Cycle 이 버전을 올릴 책임을
       진다 — engine/world-kernel/persistence.ts 가 그 규율의 단일 출처다.

       올리지 않으면 옛 스냅샷이 **복구되어** `groundZones` 없이 굴러가고,
       RULE-GROUND-LAW-APPLY-001 이 없는 목록을 훑다 멈춘다. 버전이 다르면 복구를
       포기하고 새 세계로 시작하므로 그 길이 닫힌다. 마이그레이션은 이 세계의
       방식이 아니다.

## GAP

    없음. 03-world-semantic.md 의 ADDED 가 모두 코드에 있고 CHANGED 는 애초에 없다.
