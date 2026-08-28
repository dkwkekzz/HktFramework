# Frontier — TERRAIN 트랙

## 후보

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
                         것이 있다는 형태 (C014 · `world/semantic/acquaintance.ts`) ·
                         **예고할 거리가 이제 실제로 있다** (C-TERRAIN-002 —
                         자리마다 `kept` 가 있고 `saturation` 까지 남은 양이 정해지므로
                         "언제 넘치는가" 가 세계 안에서 계산 가능한 값이 되었다) ·
                         그리는 자리도 이미 있다 (`SceneGroundZone.intensity` — 그 Cycle 이
                         뿜음의 맥동으로 처음 썼다)
    Playable Result      Player 가 땅에 퍼지는 무늬를 보고 자리를 옮겨, 거두어 가는 순간을
                         겪지 않는다
    Source Goal          MG-EXPLORE-BEIRA
    Source Possibility   MP-LEARN-TO-HANDLE-THE-LAYER
    Missing / Partial    **MW-CIRCULATION-EVIDENCE (ABSENT)** — 이 후보가 여는 노드다.
                         BT §15.8("플레이어가 설명 없이 볼 수 있는 증거는 무엇인가")이
                         주입되며 섰다. 함께 움직이는 것: MW-SURVIVAL-PRESSURE (PARTIAL —
                         world_shape 의 "읽은 사람과 읽지 못한 사람이 다른 결과를 낸다"
                         가 여기서 닫힌다).
                         Capability 쪽은 여전히 Target 이 아니다 — MC-READ-ENVIRONMENT 가
                         같은 자리를 보지만 `grounded: false` 다
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
    의존                 **둘 다 닫혔다.** FR-THE-GROUND-HAS-A-LAW (C-TERRAIN-001) 없이는
                         아무 일도 일어나지 않는 것의 예고가 되고,
                         FR-THE-LAND-KEEPS-WHAT-IT-TAKES (C-TERRAIN-002) 없이는 거두는
                         속도가 상수라 예고할 것이 없어 "곧 위험" 타이머가 된다.
                         **이제 막는 것이 없다**
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

### FR-LOSING-IS-A-PROCESS — 잃는 것은 한순간이 아니다

    이것이 무엇인가      존재가 즉시 쓰러지는 대신 **단계적으로 다른 것이 되어 간다.**
                         그 진행은 관찰되고, 끝나기 전에 개입하면 되돌릴 자리가 남는다
    세계에 생기는 것      ① 존재가 "무엇이 되어 가는 중" 이라는 상태를 지닌다 — 어디까지
                            왔는지가 값으로 있다
                         ② 그 진행에는 원인이 있다 — 땅의 법칙이 그것을 민다
                            (BT §11.2 — 꽃가루가 약한 생체 상태를 추적하고 뿌리가 마지막
                            모습을 미리 만든다)
                         ③ 진행을 **붙들 수 있다.** 붙든 동안 멈추고, 놓으면 멈춘 자리에서
                            다시 이어진다
                         ④ 관찰: 지금 어디까지 왔는지와 무엇이 밀고 있는지가 읽힌다
    이 기능이 아닌 것     되돌리는 일이 아니다 (MC-RESTORE-BIOLOGICAL-STATE 는 Target 이
                         아니다 — 이쪽은 아직 잃지 않은 것을 붙든다) · 치료가 아니다 —
                         나아지게 하지 않고 지금 상태를 지금 상태로 묶어 둘 뿐이다 ·
                         죽음의 연출이 아니다 — 값이 0 이 되는 것과 다른 것이 되어 가는 것은
                         서로 다른 사건이다 · 사람꽃과 혈화수해 전체를 세우는 일이 아니다 ·
                         붙잡은 것을 끊는 일이 아니다 (MP-CUT-WHAT-HOLDS-THEM 은 다른 갈래다)
    이미 있는 것         **코드 대조.** 땅의 법칙이 dt 로 몸에서 값을 빼 간다 —
                         `world/simulation/ground-law-apply.ts` · `semantic/terrain.ts`
                         의 `GROUND_LAWS` (C-TERRAIN-001) · 아직 끝나지 않은 것이 진행도로
                         관찰에 실린다 — 행동의 `state` · `progress` (C019 ·
                         `world/semantic/collision.ts`) · 살펴보기 전에는 가려진 것이
                         있다는 형태 (C014 · `semantic/acquaintance.ts`)
    Playable Result      Player 가 꽃에 붙들리기 시작한 동료를 보고 달려가 그 진행을 붙들어
                         두고, 그동안 자기는 아무것도 하지 못한 채 **누구를 붙들지 고른다**
    Source Goal          MG-RESCUE-THE-TAKEN
    Source Possibility   MP-STOP-THE-TRANSFER
    Missing / Partial    MC-HOLD-BIOLOGICAL-STATE (MISSING · `grounded: true`)
    Active Constraints   DC-WORLD-TERRAIN-IS-A-PRINCIPLE · DC-WORLD-TERRAIN-LAW-IS-OBSERVABLE ·
                         DC-CONDITION-OPENS-WITHOUT-RECORDING · DC-COMBAT-ABILITY-IS-A-RULE ·
                         DC-COMBAT-UNAVAILABLE-HAS-A-REASON
    Constraint Eval      IS-A-PRINCIPLE: SATISFIED — 진행을 미는 것이 법칙이고, 그 법칙이
                         무엇을 어떤 조건에서 바꾸는지가 정의된다
                         LAW-IS-OBSERVABLE: SATISFIED — 어디까지 왔는지가 증거로 보인다
                         CONDITION-OPENS-WITHOUT-RECORDING: SATISFIED — 놓으면 저절로 다시
                         진행된다. 되돌리는 규칙을 따로 두지 않는다
                         ABILITY-IS-A-RULE: SATISFIED — 피해가 전혀 없는 조작이다
                         UNAVAILABLE-HAS-A-REASON: UNRESOLVED — 늦어서 못 붙드는 경우의
                         사유를 무엇으로 싣는지는 04 가 정한다
    Observable Result    진행이 값으로 보이고, 붙든 동안 멈추며, 놓으면 이어진다.
                         붙든 쪽은 그동안 다른 것을 하지 못한다
    Why one Cycle        땅이 dt 로 몸을 바꾸는 규칙이 이미 돌고, 아직 끝나지 않은 것의
                         진행도를 관찰에 싣는 형태도 이미 있다. 새로 서는 것은 **그 진행이
                         값을 깎는 대신 다른 것이 되어 가는 것**과 **그것을 멈추는 손**이다
    의존                 없음 — `FR-THE-GROUND-HAS-A-LAW`(C-TERRAIN-001)가 이미 닫혔고 그
                         위에 바로 선다. `C-TERRAIN-002`(땅이 거둔 것을 간직한다)와 겹치지 않는다
                         (저쪽은 거둔 것이 **땅**에 쌓이는 일, 이쪽은 **몸**이 다른 것이
                         되어 가는 일)
    비고                 **이 후보가 MG-RESCUE-THE-TAKEN 의 병목이다.** 그 Goal 의 갈래 셋이
                         전부 "되돌릴 자리가 남아 있다" 를 전제하는데, 지금 세계에서 존재는
                         멀쩡하거나 쓰러지거나 둘뿐이다
    Status               PROPOSED

### FR-THE-LAND-IS-ALIVE-AND-ANSWERS — 땅이 살아 있고 응답한다

    이것이 무엇인가      땅이 법칙을 지닌 무대가 아니라 **살아 있는 존재**다. 그것과 이어지면
                         그 상태를 읽을 수 있고, 이어진 것을 통해 무언가를 전할 수 있다
    세계에 생기는 것      ① 자리가 살아 있는 것과 죽은 것으로 갈린다
                         ② 몸과 살아 있는 자리 사이에 **연결**이 상태로 존재한다 — 세계에
                            있으므로 끊기고 부술 수 있다
                         ③ 연결을 통해 읽는 일과 전하는 일이 둘 다 성립한다
                         ④ 연결이 없는 자리에서는 그 행동이 성립하지 않고 사유가 함께 온다
    이 기능이 아닌 것     이어진 것을 묶어 못 움직이게 하는 일이 아니다 (MC-BIND 는 Target 이
                         아니다 — 형태가 같고 방향이 반대다) · 환경을 읽기만 하는 일이
                         아니다 (MC-READ-ENVIRONMENT) · 유랑대지를 통째로 세우는 일이 아니다 ·
                         회복이 아니다 — 무엇이 오가는지는 이어진 쪽이 지닌 것이 정한다
    이미 있는 것         **코드 대조.** 자리가 상수가 아니라 State 다 —
                         `world/semantic/world-state.ts#WorldState.groundZones` ·
                         자리가 자기 법칙의 이름을 지닌다 — `GroundZone.law` · `role` ·
                         존재와 존재 사이의 태도가 세계의 사실로 있다 —
                         `world/semantic/relation.ts` (C018) · 자리가 관찰 계약에 실린다 —
                         `protocol/gameview-terrain.ts`
    Playable Result      Player 가 창을 땅에 꽂아 그 자리와 이어지고, 이어진 동안에만 땅이
                         지금 어떤 상태인지를 읽으며, 창을 뽑거나 죽은 자리로 옮기면 그것이
                         곧바로 닫히는 것을 본다
    Source Goal          MG-EXPLORE-BEIRA
    Source Possibility   MP-LEARN-TO-HANDLE-THE-LAYER
    Missing / Partial    MC-LINK-TO-LIVING-WORLD (MISSING · `grounded: true`)
    Active Constraints   DC-WORLD-TERRAIN-IS-A-PRINCIPLE · DC-COMBAT-ABILITY-IS-A-RULE ·
                         DC-COMBAT-UNAVAILABLE-HAS-A-REASON · DC-COMBAT-STRONG-RULE-HAS-COUNTERPLAY
    Constraint Eval      IS-A-PRINCIPLE: SATISFIED — 살아 있음이 그 땅의 원리에서 나온다 (BT §9.1)
                         ABILITY-IS-A-RULE: SATISFIED — 피해가 아니라 관계를 만드는 조작이다
                         UNAVAILABLE-HAS-A-REASON: SATISFIED — 이어지지 않은 자리에서 못
                         쓴다는 사유가 이 후보의 요점 중 하나다
                         STRONG-RULE-HAS-COUNTERPLAY: SATISFIED — 죽은 자리로 밀거나 연결을
                         끊는 것이 대응이다
    Observable Result    지금 이어져 있는지와 이어진 자리가 어떤 상태인지가 읽히고,
                         끊기면 그것이 곧바로 닫힌다
    Why one Cycle        자리가 이미 State 이고 법칙의 이름을 지니며, 존재 사이의 관계를
                         세계의 사실로 두는 형태도 이미 있다 (태도). 새로 서는 것은 **몸과
                         자리 사이의 관계** 하나다
    의존                 없음 — 기다리던 것이 닫혔다. `C-TERRAIN-002` 로 자리가 내부 상태를
                         쌓으므로 이어졌을 때 **읽을 거리가 이미 있다**
    Status               PROPOSED

## 추천 순서

    2. FR-THE-LAND-SHOWS-BEFORE-IT-TAKES    부채(불공정 — 안전한 자리가 옮겨 다니는데
                                            읽을 방법이 없다)는 그대로 남아 있다. 생성이
                                            섰으므로(C-TERRAIN-003) 이제 예고할 대상이
                                            태어난 세계 전체다 — 그 08 도 이 후보를
                                            그대로 재추천했다
    3. FR-WHAT-KEEPS-YOU-ALIVE-IS-CARRIED   대지형 Capability 표의 첫 칸을 채운다.
                                            아이템 쪽 파일과 닿는다 — 분출구가 생겨나고
                                            사라지므로 "언제 어디서 채우는가" 가 판단이 된다
    4. FR-LOSING-IS-A-PROCESS               **Q71(b) 확장으로 새로 열렸다.** 다섯 중
                                            유일하게 **다른 Goal** 을 연다 —
                                            MG-RESCUE-THE-TAKEN 은 갈래 셋을 가졌으나
                                            셋 다 "되돌릴 자리가 남아 있다" 를 전제하고,
                                            그 전제가 이 후보다. 의존이 없다
    5. FR-THE-LAND-IS-ALIVE-AND-ANSWERS     같은 확장에서 열렸다. **읽을 것은 이제 있다** —
                                            C-TERRAIN-002 로 자리가 내부 상태를 쌓으므로
                                            이어졌을 때 읽을 거리가 생겼다

    **다만 4 는 다른 축이다.** 1·2·3·5 가 전부 "땅이 무엇을 하는가" 라면 4 는 "존재가
    어떻게 잃는가" 이고, 그것이 서면 갈래가 0 이던 Goal 하나가 통째로 열린다.
    지금 세계에서 존재는 멀쩡하거나 쓰러지거나 둘뿐이라는 것이 이 트랙 밖까지 걸리는
    제약이므로, 예고(2)와 나란히 두고 볼 것을 권한다 (생성은 닫혔다).

## SELECTED

```text
없음 — Human 선택 대기
```

    남은 넷 중 의존이 빈 것은 셋이다 (예고 · 잃는 과정 · 응답 — 위 "추천 순서").
    나르기(FR-WHAT-KEEPS-YOU-ALIVE-IS-CARRIED)는 아이템 트랙과 닿으므로 고를 때
    그쪽이 무엇을 도는 중인지 먼저 본다 (LANES 겹침 표).

    직전 반영 경위: [../feedback/C-TERRAIN-003-the-world-is-born-of-its-law.md](../feedback/C-TERRAIN-003-the-world-is-born-of-its-law.md)

## 지금 열 수 없는 것

| 기능 / 층 | 무엇이 막고 있는가 |
|---|---|
| 주기를 읽고 창에 맞춘다 · 안전한 자리를 잇는다 · 흔들림을 고정한다 (MC-TIME-THE-CYCLE · MC-FIND-SAFE-ROUTE · MC-ANCHOR-LOCAL-LAW) | `part_of.grounded: false` — BT 가 지형마다 다른 이름의 행동·자원으로만 적었고 묶는 이름이 Agent 의 번역이다. 확정 전에는 후보의 Target 이 되지 않는다 |
| 바깥에서 온 것을 감별한다 (MC-APPRAISE-UNKNOWN-MATTER) | 요구처는 갈비분지인데 서는 자리는 아이템의 정의·관찰이다 — **어느 트랙이 소유하는가**의 판단이 먼저다 (트랙 이동은 NEXT 작업) |
| 소리 없이 함께 움직인다 (MC-COORDINATE-WITHOUT-SOUND) | 세계에 소리가 없다 — 없앨 것이 없으면 그 부재가 관찰되지 않는다 |
| 다른 표식을 빌린다 (MC-IMPERSONATE-IDENTITY) | 존재의 신원이라는 것이 세계에 없다 — 구분되는 것은 종류와 개체 번호뿐이다 |
| 가능성 하나를 현실로 만든다 (MC-REALIZE-ONE-POSSIBILITY) | 세계에 가능성이라는 상태가 없다. 우연의 원천(DC-WORLD-OWNS-THE-CHANCE)과 맞닿아 크다 |
| 생체 신호를 가린다 (MC-CONCEAL-BIOLOGICAL-SIGNAL) | 좇는 쪽의 판단이 필요하고, 그 반쪽을 소유한 MS-CREATURE-BEHAVIOR 가 DRAFT 다 |
| **생성 사슬의 아래 고리 — 적응 (MW-ADAPTED-LIFE) · 자원 (MW-TERRAIN-RESOURCE) · 사람 (MW-NATURAL-SETTLEMENT)** | BT §1 사슬의 ④⑤⑥ 이다 — 순서 관문(생성)은 C-TERRAIN-003 으로 닫혔고, 태어난 분포가 "어디서 나는가" 를 답할 바닥이 되었다. **자원의 Master 쪽도 열렸다** — RC 주입 + Q73~Q75 판정으로 BT 24종까지 growth/items 에 섰다 (HISTORY). 남은 열쇠는 적응·생명의 `Design-Creature-Behavior-R0.md` 승인과, 자원을 **세계에** 세우는 Cycle (MW-TERRAIN-RESOURCE 는 여전히 ABSENT — 유래가 선 것과 세계에 선 것은 다르다) |
| **아래쪽을 스스로 정한다 · 날아가는 것의 방향을 튼다 · 없는 자리에 발판을 둔다** (MC-REDEFINE-DOWN · MC-REDIRECT-FALLING-THING · MC-PLACE-FOOTING) | **세계에 위아래가 없다.** `world/semantic/position.ts` 의 `WorldPosition` 은 `x` · `z` 뿐이고 떨어지는 일도 오르는 일도 규칙에 없다 — 셋 다 "아래쪽" 을 전제하므로 그 축이 서기 전에는 개념이 성립하지 않는다. 그리고 그 축을 세우는 일은 팩의 시스템이 아니라 **기반(engine/physics)** 에 걸리므로 Cycle 이 아니라 ENGINE 트랙 작업이다 (guides/works.md 의 WORLD → ENGINE 승격). 셋 다 `grounded: true` 이고 요구처(MW-TERRAIN-SKYFALL-RANGE · MW-TERRAIN-BREATHLESS-SEA)도 있으므로, 축이 서는 날 곧바로 후보가 된다. 발판 쪽은 장벽이 하나 더 있다 — 몸이 아닌 것이 세계의 자리를 갖는 일 (MS-SKILL-FORM 의 공간 존재 칸 · [combat.md](combat.md) 의 같은 절) |
