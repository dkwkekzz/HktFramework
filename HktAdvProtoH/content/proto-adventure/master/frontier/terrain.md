# Frontier — TERRAIN 트랙

## 후보

### FR-THE-GROUND-HAS-A-LAW — 땅이 법칙을 지닌다
    이것이 무엇인가      무대의 자리마다 법칙이 걸려 있고, 그 자리에 있는 몸이 그것을
                         겪는다. 그리고 그 법칙이 멎는 자연적 예외 자리가 그 안에 있다
    세계에 생기는 것      ① 땅이 자리(범위)로 나뉘고 각 자리가 자기 법칙을 지닌다 —
                            이름이 아니라 "무엇을 어떤 조건에서 거두어 가는가" 의 정의다
                         ② 그 법칙이 그 안에 있는 몸에서 무언가를 지속적으로 거두어 간다
                            (BT §5 — 대지가 살아 있는 모든 것으로부터 열을 거둔다)
                         ③ 법칙이 닿지 않는 예외 자리가 있고 그 안에서는 멎는다
                            (BT §5.3 해숨구멍 · §13)
                         ④ 관찰: 지금 이 몸이 어떤 법칙 위에 있고 무엇이 일어나는 중인지가
                            사유와 함께 실린다
    이 기능이 아닌 것     여덟 대지형 전부가 아니다 — 법칙 하나 · 예외 하나로 축이 서는지를
                         본다 · 지역 간 이동도 경계 넘기도 로딩도 아니다 (무대는 여전히 하나) ·
                         지형이 낳는 자원이 아니다 · 지니고 나르는 것이 아니다
                         (FR-WHAT-KEEPS-YOU-ALIVE-IS-CARRIED) · 작용 전의 예고가 아니다
                         (FR-THE-LAND-SHOWS-BEFORE-IT-TAKES) · 새로운 죽음의 형태가 아니다
    이미 있는 것         **코드 대조.** 자리를 가진 범위와 "그 안인가" 판정 —
                         `world/semantic/relation.ts#GuardedGround` · `isInsideGuardedGround`
                         (C018). 지금은 존재에 붙어 있고 땅에는 붙어 있지 않다 ·
                         상태가 이어지는 동안 무언가가 계속 줄어드는 형태 —
                         `world/simulation/cp-run-drain.ts` (dt 기반) ·
                         자리를 가진 것이 세계에 있는 선례 — `world/semantic/deposit.ts#DepositState` ·
                         무대의 경계와 그 밖을 막는 판정 — `WORLD_BOUNDS` · `inBounds`
                         (RULE-MOVE-001 `out-of-bounds`) · 사유 코드를 실어 보내는 관찰 계약
    Playable Result      Player 가 열을 거두는 땅 위에 서 있으면 몸의 무언가가 계속 줄고,
                         따뜻한 자리로 걸어 들어가면 멎는다 — **어디에 서 있는가가 처음으로
                         결과를 바꾼다**
    Source Goal          MG-EXPLORE-BEIRA
    Source Possibility   MP-LEARN-TO-HANDLE-THE-LAYER (들어가서 겪으며 알아낸다)
    Missing / Partial    Capability 를 Target 으로 삼지 않는다 — 이 Cycle 이 세우는 것은
                         능력이 아니라 그 능력들이 놓일 **땅**이다 (MW-MACRO-TERRAIN ABSENT ·
                         MW-TERRAIN-* 여덟 ABSENT). C022(담을 자리가 유한하다)가 같은 형태의
                         선례이며, 대지형 MC 아홉의 `overlay_gap` 이 전부 이 하나를 가리킨다
    Active Constraints   DC-WORLD-TERRAIN-IS-A-PRINCIPLE · DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION ·
                         DC-WORLD-TERRAIN-LAW-IS-OBSERVABLE · DC-WORLD-OWNS-THE-SURFACE-LIST ·
                         DC-CONDITION-OPENS-WITHOUT-RECORDING
    Constraint Eval      IS-A-PRINCIPLE: SATISFIED — 자리에 붙는 것이 기후 이름이 아니라
                         조건과 결과다
                         SAFETY-IS-A-NATURAL-EXCEPTION: SATISFIED — 안전한 자리가 플래그가
                         아니라 그 법칙이 멎는 자리로 성립한다
                         LAW-IS-OBSERVABLE: UNRESOLVED — 겪는 것은 이 후보가 세우고 **예고**는
                         다음 후보가 세운다. 둘이 함께 서야 SATISFIED 다
                         OWNS-THE-SURFACE-LIST: UNRESOLVED — 무엇을 관찰에 싣는지는 04 가 정한다
                         CONDITION-OPENS-WITHOUT-RECORDING: SATISFIED — 그 자리에 있는 동안만
                         겪고 나가면 별도 규칙 없이 멎는다 (조건에서 매번 계산)
    Observable Result    몸의 값이 줄어드는 것과 멎는 것, 그리고 그 사유(어느 법칙이 지금
                         작용하는가)가 화면에서 읽힌다
    Why one Cycle        자리 판정과 지속 변화 둘 다 세계에 이미 형태가 있다
                         (GuardedGround · cp-run-drain). 새로 서는 것은 **그 둘을 땅에 붙이는
                         것** 하나다
    Status               SELECTED

### FR-THE-LAND-SHOWS-BEFORE-IT-TAKES — 땅이 거두기 전에 보인다
    이것이 무엇인가      법칙이 작용하기 전에 그 자리에 증거가 먼저 드러나고, 그것을 읽은
                         사람은 겪지 않는다
    세계에 생기는 것      ① 법칙마다 작용 전에 관찰되는 증거가 세계에 있다
                         ② 증거와 작용 사이에 시간이 있다 — 읽고 움직일 수 있는 만큼
                         ③ 같은 증거에서 서로 다른 대응이 성립한다 (피한다 · 지나간 뒤 들어간다)
    이 기능이 아닌 것     경고 표시가 아니다 — 세계의 사실이지 화면의 친절이 아니다 ·
                         지도·미니맵이 아니다 · 다음 수를 읽는 것(MC-PREDICT)이 아니다 —
                         그쪽은 존재의 다음 행동이고 이쪽은 땅의 다음 작용이다 ·
                         주기를 세우는 것이 아니다 (MC-TIME-THE-CYCLE 은 아직 Target 이 아니다)
    이미 있는 것         **코드 대조.** 아직 일어나지 않은 것이 관찰에 실리는 형태 —
                         행동의 앞 구간과 그 진행도(C019 · `world/semantic/collision.ts`
                         SWING_BEGIN · 계약의 `state` · `progress`) · 살펴보기 전에는 모르는
                         것이 있다는 형태 (C014 · `world/semantic/acquaintance.ts`)
    Playable Result      Player 가 땅에 퍼지는 무늬를 보고 자리를 옮겨, 거두어 가는 순간을
                         겪지 않는다
    Source Goal          MG-EXPLORE-BEIRA
    Source Possibility   MP-LEARN-TO-HANDLE-THE-LAYER
    Missing / Partial    Capability 를 Target 으로 삼지 않는다 — 이 후보가 닫는 것은
                         DC-WORLD-TERRAIN-LAW-IS-OBSERVABLE 의 `증거가 먼저` 절이다.
                         MC-READ-ENVIRONMENT 가 같은 자리를 보지만 `grounded: false` 라
                         Target 이 되지 않는다 (guides/master-frontier.md)
    Active Constraints   DC-WORLD-TERRAIN-LAW-IS-OBSERVABLE · DC-COMBAT-PLAYER-CAUSALITY ·
                         DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Eval      LAW-IS-OBSERVABLE: SATISFIED — 이 후보가 그 원칙을 세계에서 닫는다
                         PLAYER-CAUSALITY: SATISFIED — 겪은 결과의 원인이 관찰 가능한 증거와
                         그것을 보고 한 선택이다
                         OWNS-THE-SURFACE-LIST: UNRESOLVED — 04 가 정한다
    Observable Result    증거가 보인 뒤 작용이 오고, 증거를 보고 움직인 쪽과 그러지 않은 쪽의
                         결과가 다르다
    Why one Cycle        예고와 그 관찰은 이미 행동 쪽에 서 있다 (C019). 새로 서는 것은
                         그것을 땅에 붙이는 것이다
    의존                 FR-THE-GROUND-HAS-A-LAW 없이 하면 **아무 일도 일어나지 않는 것의
                         예고**가 된다
    Status               PROPOSED

### FR-WHAT-KEEPS-YOU-ALIVE-IS-CARRIED — 살아 있게 하는 것을 지니고 나른다
    이것이 무엇인가      그 땅에 없는 것을 몸 밖에서 얻어 지니고, 나누고, 필요한 자리로 옮긴다
    세계에 생기는 것      ① 몸이 그 땅이 요구하는 것을 유한하게 지닌다
                         ② 자연적 예외 자리에서 그것을 채운다
                         ③ 다른 몸에게 나눌 수 있고, 나눈 만큼 자기 몫이 준다
                         ④ 떨어지면 몸에 결과가 온다
    이 기능이 아닌 것     회복 아이템이 아니다 — 잃은 것을 되돌리는 것이 아니라 없는 것을
                         가져가는 것이다 · 담을 자리를 늘리는 것이 아니다 · 두 번째 대지형이
                         아니다 · 길을 잇는 것이 아니다 (MC-FIND-SAFE-ROUTE 는 아직 Target 이
                         아니다)
    이미 있는 것         **코드 대조.** 물건을 써서 상태를 바꾸고 쓴 만큼 준다
                         (C020 · MC-USE-ITEM IMPLEMENTED) · 담을 자리가 유한하다 (C022 ·
                         `world/semantic/inventory.ts`) · 걸어 둔 것이 몸의 값과 할 수 있는
                         일을 바꾼다 (C023 · C024 · `world/semantic/equipment.ts`)
    Playable Result      Player 가 따뜻한 자리에서 온기를 채워 거두어 가는 땅을 건너고,
                         동료에게 나눠 준 만큼 자기 몫이 줄어 어디까지 갈지를 고른다
    Source Goal          MG-EXPLORE-BEIRA
    Source Possibility   MP-ADAPT-BY-RESOURCE (세계가 만든 것을 가져와 감당한다)
    Missing / Partial    MC-CARRY-LIFE-SUPPORT (MISSING · `grounded: true`)
    Active Constraints   DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION · DC-ITEM-CAPACITY-IS-FINITE ·
                         DC-ITEM-CHANGE-IS-ONE-UNIT · DC-WORLD-PROGRESSION-IS-REACH
    Constraint Eval      SAFETY-IS-A-NATURAL-EXCEPTION: SATISFIED — 채우는 곳이 자연적 예외
                         자리다. 사람이 안전을 만들지 않고 있는 것을 옮긴다
                         CAPACITY-IS-FINITE: SATISFIED — 지니는 양이 유한한 것이 이 후보의 요점이다
                         CHANGE-IS-ONE-UNIT: UNRESOLVED — 나누기가 한 단위로 일어나는지는 03 이 정한다
                         PROGRESSION-IS-REACH: SATISFIED — 지닌 것이 갈 수 있는 범위를 넓힌다
    Observable Result    지닌 양과 그것이 주는 것, 나눈 뒤 양쪽의 몫이 화면에서 읽힌다
    Why one Cycle        아이템 사슬 넷 중 셋이 이미 서 있다 (쓴다 · 담는다 · 건다).
                         새로 서는 것은 **지닌 것이 땅의 요구에 맞선다** 하나다
    의존                 FR-THE-GROUND-HAS-A-LAW 가 먼저 — 거두어 가는 것이 없으면 나를 이유가
                         없다
    Status               PROPOSED

## 추천 순서

    1. FR-THE-GROUND-HAS-A-LAW              바닥이다. 나머지 둘이 이것 없이는 성립하지 않고,
                                            overlay 의 넷째 구멍("땅이 없다")을 여는 것도 이것뿐이다
    2. FR-THE-LAND-SHOWS-BEFORE-IT-TAKES    승인된 원칙 하나(LAW-IS-OBSERVABLE)를 세계에서
                                            닫는다. 값이 싸다 — 예고와 그 관찰이 이미 서 있다
    3. FR-WHAT-KEEPS-YOU-ALIVE-IS-CARRIED   대지형 Capability 표의 첫 칸을 채운다. 셋 중
                                            가장 크고, 아이템 쪽 파일과 닿는다

    Agent 추천은 **1** 이다. 근거는 의존이 아니라 판정이다 — 대지형 MC 아홉의
    `overlay_gap` 이 서로 다른 문장으로 같은 하나를 가리키고 있고(땅이 없다), 그것이
    닫히기 전에는 이 트랙의 어떤 후보도 "겪을 수 있는" 것이 되지 않는다.
    순서는 Human 이 정한다.

## SELECTED

```text
FR-THE-GROUND-HAS-A-LAW — 땅이 법칙을 지닌다
Cycle ID   C-TERRAIN-001        트랙의 첫 번호 (cycles/ 에 C-TERRAIN-* 가 아직 없다)
다음       advprotoh-cycle 스킬 Stage 1 — 아직 시작하지 않았다
```

    **정한 사람** — Human 이 이 선택을 Agent 에게 위임했다 (2026-08-26). 선택은 원래
    Human 소유이므로(CLAUDE.md 원칙 19) 위임의 사실과 고른 근거를 HISTORY.md 에 남겼다.
    근거는 위 "추천 순서" 절과 같다 — 대지형 Capability 아홉의 `overlay_gap` 이 서로 다른
    문장으로 같은 하나(땅이 없다)를 가리키고, 그것이 닫히기 전에는 이 트랙의 어떤 후보도
    겪을 수 있는 것이 되지 않는다.

    **Cycle 이 받아 갈 것** — `01-cycle.md` 의 `MASTER TRACE` 로 그대로 옮긴다.

        Frontier             FR-THE-GROUND-HAS-A-LAW
        Source Goal          MG-EXPLORE-BEIRA
        Source Possibility   MP-LEARN-TO-HANDLE-THE-LAYER
        Target Capability    없음 — 세우는 것은 능력이 아니라 그 능력들이 놓일 땅이다
                             (MW-MACRO-TERRAIN ABSENT · MW-TERRAIN-* 여덟 ABSENT · C022 선례)
        Active Constraints   DC-WORLD-TERRAIN-IS-A-PRINCIPLE ·
                             DC-WORLD-SAFETY-IS-A-NATURAL-EXCEPTION ·
                             DC-WORLD-TERRAIN-LAW-IS-OBSERVABLE ·
                             DC-WORLD-OWNS-THE-SURFACE-LIST ·
                             DC-CONDITION-OPENS-WITHOUT-RECORDING
        Constraint Note      LAW-IS-OBSERVABLE 는 UNRESOLVED 로 넘어간다 — 겪는 것은 이
                             Cycle 이 세우지만 **예고**는 다음 후보의 몫이다
                             (FR-THE-LAND-SHOWS-BEFORE-IT-TAKES). 이 Cycle 에서 그 원칙을
                             다 닫으려 하지 않는다

## 지금 열 수 없는 것

| 기능 / 층 | 무엇이 막고 있는가 |
|---|---|
| 주기를 읽고 창에 맞춘다 · 안전한 자리를 잇는다 · 흔들림을 고정한다 (MC-TIME-THE-CYCLE · MC-FIND-SAFE-ROUTE · MC-ANCHOR-LOCAL-LAW) | `part_of.grounded: false` — BT 가 지형마다 다른 이름의 행동·자원으로만 적었고 묶는 이름이 Agent 의 번역이다. 확정 전에는 후보의 Target 이 되지 않는다 |
| 바깥에서 온 것을 감별한다 (MC-APPRAISE-UNKNOWN-MATTER) | 요구처는 갈비분지인데 서는 자리는 아이템의 정의·관찰이다 — **어느 트랙이 소유하는가**의 판단이 먼저다 (트랙 이동은 NEXT 작업) |
| 소리 없이 함께 움직인다 (MC-COORDINATE-WITHOUT-SOUND) | 세계에 소리가 없다 — 없앨 것이 없으면 그 부재가 관찰되지 않는다 |
| 다른 표식을 빌린다 (MC-IMPERSONATE-IDENTITY) | 존재의 신원이라는 것이 세계에 없다 — 구분되는 것은 종류와 개체 번호뿐이다 |
| 가능성 하나를 현실로 만든다 (MC-REALIZE-ONE-POSSIBILITY) | 세계에 가능성이라는 상태가 없다. 우연의 원천(DC-WORLD-OWNS-THE-CHANCE)과 맞닿아 크다 |
| 생체 신호를 가린다 (MC-CONCEAL-BIOLOGICAL-SIGNAL) | 좇는 쪽의 판단이 필요하고, 그 반쪽을 소유한 MS-CREATURE-BEHAVIOR 가 DRAFT 다 |
| 여덟 대지형의 자원 24종 | 자원 카탈로그 문서의 승인·주입이 그 자리를 받기로 정해졌다 (HISTORY Q50(a)) |
