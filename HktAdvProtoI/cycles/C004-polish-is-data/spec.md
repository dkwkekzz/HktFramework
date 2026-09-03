# C004 — 폴리싱은 데이터로

```text
CYCLE          C004-polish-is-data
SOURCE         content/roadmap/play/RegionGraphRooms.md §6 "불변 조건 — 코드 변경 없이 폴리싱" · §6 E4 ·
               확정 사항 5·7
               (근거: content/roadmap/play/RuleBoundRoom.md 확정 4 "고대 문은 RegionGraphRooms 의 C004 가
                데이터로 연다" · 같은 문서 §4 자신감 · §7 C005 ·
                content/roadmap/L2-World-Tool.md §3 연결 계약 · design/Plan-World-Authoring-Engine.md §5)
SELECTED_FROM  Play Cycle Breakdown — "C004 — 폴리싱은 데이터로"
```

**확장 Cycle** — C001·C002·C003 의 State/Rule 위에 더한다. 복사·재작성하지 않는다.
여기 없는 것은 그 셋 그대로다.

이 Cycle 은 Play 의 **마지막**이고, 성질이 앞의 셋과 다르다. 새 방도 새 규칙도 짓지 않는다 —
앞의 셋이 세운 것이 **약속대로 데이터인가를 잰다**. 그래서 Playable Goal 은 "무엇이 새로 되는가"가
아니라 "무엇을 코드 없이 할 수 있는가"다.

## Playable Goal

숲 안쪽의 **고대 문이 열려 있다**. 붉은 빗장이 사라지고, 붙어서 요청하면 "잠겨 있다" 가 아니라
"아직 갈 수 없는 곳이다" 가 온다 — 문은 열렸고 그 너머가 아직 지어지지 않았을 뿐이다.
이 변화를 만든 것은 **데이터 한 줄**이다. 그리고 `npm run world:observe` 가 세계의 방 아홉과
Connector 열셋과 검사 결과를 표로 뱉어, 무엇이 데이터이고 무엇이 코드인지를 한 화면에서 보게 한다.

## Experience Intent

```text
Start   앞의 셋이 "이건 나중에 데이터로 바꿀 수 있다" 고 말했다. 말뿐인지 아닌지는 아직 모른다.
End     문 하나를 여는 데 코드가 한 줄도 필요하지 않았다. 세계는 이제 자기 그래프를 스스로 읊고,
        규칙은 방의 이름을 하나도 모른다 — 다른 세계를 만든다는 것이 content/ 를 갈아 끼우는 일이라는 말이
        약속이 아니라 측정값이 됐다.
```

Play 의 Breath 밖이다 — 이 Cycle 은 체험이 아니라 **검증**이다 (Play §6 "검증 C004 가 이것을 실측한다").
다만 고대 문이 열리는 것 하나는 세계의 사실이고, RuleBoundRoom 의 첫 숨(자신감)이 그 위에 선다.

## World Change

```text
① 고대 문이 열린다 — ANCIENT_GATE 가 CLOSED_CONNECTORS 에서 빠진다.
   여는 규칙은 여전히 없다 (Play W7) — 컨텐츠 데이터가 처음부터 열린 것으로 적을 뿐이다.
   그 너머(FANTASY_MAZE)는 아직 경계이므로 건너기는 region-not-built 로 거절된다.
   미로의 입구가 이렇게 선다 (RuleBoundRoom 확정 4 · C005 가 그 방들을 짓는다)
② 세계가 시작하는 방이 데이터가 된다 — START_REGION 이 content/world 에서 content/regions 로 옮겨 간다.
   그 결과 **규칙 코드가 이름으로 아는 방·연결이 하나도 남지 않는다**
③ 세계가 자기 그래프를 읊는다 — tools/world-editor 의 world:observe --graph.
   방 표 · Connector 표 · 중첩 사슬 · 검사 보고. 세계를 바꾸지 않는 읽기 전용 관찰이다  (Play E4)
```

세계의 State 규칙은 하나도 바뀌지 않는다. ①은 데이터, ②는 그 데이터가 사는 자리, ③은 도구다.

## Observable Result

```text
① 숲 안쪽의 북서쪽 표식(−13, 13)이 **붉은 빗장에서 열린 팻말로** 바뀐다 — 다섯 출구가 모두 열린 표식이다
② 그 표식에 붙어 `Q` 를 누르면 "아직 갈 수 없는 곳이다" 가 뜬다 — C002 의 "잠겨 있다" 가 아니다.
   몸은 그 자리 그대로다
③ `npm run world:observe` 가 방 아홉 · Connector 열셋 · 중첩 둘 · 경계 셋을 표로 내고
   마지막 줄에 "검사 오류 0" 을 적는다
④ 앞의 세 Cycle 의 관찰이 하나도 바뀌지 않는다 — 백왕령 출구 셋 · 숲 안쪽 출구 다섯 ·
   거목 → 내부 세계 → 추락 → 심장 호수 → 물길이 그대로다
```

## Reuse

### Existing (그대로 쓴다)

```text
RULE-REGION-TRANSIT-001 의 전제·사유 여섯 (하나도 바뀌지 않는다 — 데이터가 달라지면 답이 달라질 뿐) ·
isConnectorOpen · isRegionBuilt · CLOSED_CONNECTORS · FRONTIER_REGIONS · region-exit 의 state(open | locked) ·
문구 "잠겨 있다" · "아직 갈 수 없는 곳이다" (둘 다 이미 있다 — 어느 쪽이 오는지만 달라진다) ·
engine/world-authoring 의 Description · Graph · checkGraph(검사 전부) · exitsOf · reachableRegions ·
content/view 의 표 전부
```

### Added (이 Cycle 이 세운다)

```text
Data       CLOSED_CONNECTORS = [] (ANCIENT_GATE 제거) · content/regions 가 START_REGION 을 소유
World      없음 — 규칙이 하나도 늘지 않는다. START_REGION 의 import 자리만 옮긴다
Protocol   없음
View       없음 — 표가 한 줄도 늘지 않는다 (open 표식도 문구도 이미 있다)
Tools      tools/world-editor/observe.ts + npm run world:observe          (Play E4)
Test       규칙 코드가 방·연결의 이름을 모른다는 검사 · 변형 데이터로 세계를 세우는 실측
```

## Out of Scope

```text
환상의 미로의 방 · Region State · Connector.activation · 압력                 RuleBoundRoom (C005~C007)
고대 문을 **무엇이** 여는가 (지식·조건)                                        3층 (RuleBoundRoom 확정 4 가 명시)
붉은 황야 · 얼음 협곡의 방                                                     이 Play 밖 (확정 5) — 경계로 남는다
world:compile · 높이 · 표면 · 경사 · scatter · stamp/curve/area op            ENGINE A → RoomBecomesLand (확정 7)
도구의 편집 기능 (world:observe 는 읽기 전용이다)                              아직 아무도 요구하지 않았다
카메라가 방 전체를 담는 것 · 방 바닥이 지형에 묻히는 것                         C002·C003 이월 → C008
```

## SPEC

```text
SPEC-001  고대 문이 열려 있다
          조건   세계가 만들어진다
          기대   닫힌 Connector 가 하나도 없다 — CLOSED_CONNECTORS 가 비어 있다.
                ANCIENT_GATE 는 여전히 Graph 에 있고 from · to · direction · transition 이 C002 그대로다
          경계   여는 규칙도 닫는 규칙도 여전히 없다 (Play W7). 세계 State 에 들어가지 않고 저장되지도 않는다

SPEC-002  열린 문의 표식과 대답
          조건   관찰자의 몸이 FOREST_DEEP 에 있다
          기대   region-exit 다섯이 전부 state = open 이다. ANCIENT_GATE 의 kind 는 door 그대로다.
                그 Connector 로 붙어서 건너기를 요청하면 사유는 region-not-built 다
          경계   connector-inactive 는 이제 이 세계의 어떤 요청에도 오지 않는다 —
                사유 코드 자체는 남는다 (규칙이 지워지지 않았다. 닫힌 문이 다시 생기면 그대로 쓴다)

SPEC-003  규칙 코드는 방과 연결의 이름을 모른다
          조건   content/world 의 코드(테스트 제외)를 전부 읽는다
          기대   Region id 아홉 · 경계 이름 셋 · Connector id 열셋 가운데 **어느 것도 나타나지 않는다**.
                이름을 아는 자리는 content/regions(데이터)와 content/view 의 표뿐이다
          경계   engine 도 마찬가지다 (이미 그렇다 — 기반은 게임 명사를 모른다).
                transition 의 종류 이름(falling)은 여기 해당하지 않는다 — 그것은 어떤 방이나 연결의
                이름이 아니라 연결의 **갈래**이고, 규칙이 그 갈래에 반응하는 것이 규칙의 내용이다

SPEC-004  세계가 시작하는 방은 데이터다
          조건   세계가 만들어진다
          기대   관찰자의 새 몸 · 기본 자율 존재 둘 · 광맥 하나가 서는 방은 여전히 WHITE_KING_DOMAIN 이고,
                그 사실은 content/regions 가 소유한다
          경계   행동은 하나도 바뀌지 않는다 — 옮긴 것은 그 이름이 적힌 자리뿐이다

SPEC-005  방을 더하는 것은 데이터다
          조건   지금 데이터에 방 하나와 그 방으로 가는 Connector 하나를 더한 **변형**을 만든다
                (코드는 한 줄도 바꾸지 않는다 — 값만 만든다)
          기대   그 변형으로 검사를 돌리면 오류가 0 이고, 시작 방에서 새 방까지 닿는다.
                더한 방에서 나가는 끝이 exitsOf 로 나온다
          경계   경계(frontier)를 지어 방으로 만들면 그 이름은 경계 목록에서 빠져야 한다 —
                안 빼면 frontier-built 다 (C003 이 RED_EYE_TREE 로 실제로 겪은 순서 그대로)

SPEC-006  방을 넓히는 것도 · 문을 여닫는 것도 데이터다
          조건   변형에서 어느 방의 extent 를 넓히고, 열린 Connector 하나를 닫힌 목록에 넣는다
          기대   넓힌 방에서 몸이 갈 수 있는 범위가 그만큼 넓어지고(RULE-MOVE-001 이 그 extent 를 읽는다),
                시점 거리도 그 크기를 따라간다(C003 의 비례). 닫은 Connector 는 state = locked 가 되고
                건너기가 connector-inactive 로 거절된다
          경계   어느 것도 규칙을 고쳐서 되는 것이 아니다 — 값 하나가 바뀌면 규칙이 다른 답을 낼 뿐이다

SPEC-007  색과 표식은 표다
          조건   View 의 표에 없는 depth 태그와 없는 transition 종류를 가진 방·연결을 그린다
          기대   게임이 멈추지 않는다 — depth 는 무채색 기본값으로, 표식은 색 없이 그려진다.
                표에 한 줄을 더하면 그 순간 색이 붙는다
          경계   표에 없는 것이 화면에 오류로 뜨지 않는다 (폴백 규칙 — C001 부터의 약속)

SPEC-008  world:observe --graph 가 세계를 읊는다
          조건   `npm run world:observe` 를 돌린다
          기대   표준 출력에 아래가 이 순서로 실린다
                  방 표        id · depth · extent · anchor 수      (REGION_SPECS 순서)
                  Connector 표 id · from → to · direction · transition · 열림/닫힘 · 지어짐/경계
                                                                    (connectors 배열 순서)
                  중첩         parent ⊃ child                       (containment 순서)
                  경계         아직 짓지 않은 이름들                 (frontiers 순서)
                  검사         오류 목록 또는 "검사 오류 0"          (checkGraph — 시작 방을 주어 ⑧까지)
          경계   방·Connector·중첩·경계의 수를 도구가 스스로 정하지 않는다 — 데이터가 준 만큼 적는다

SPEC-009  도구는 세계를 바꾸지 않는다
          조건   world:observe 를 두 번 돌린다
          기대   두 출력이 글자까지 같고, 데이터 파일이 하나도 바뀌지 않는다
          경계   `--graph` 말고 다른 것을 주면 무엇을 아는지 밝히고 아무것도 바꾸지 않는다

SPEC-010  앞의 세 Cycle 이 그대로다
          조건   C001 · C002 · C003 의 시나리오를 전부 다시 돌린다
          기대   STATE_VERSION 이 그대로이고, 고대 문에 걸린 것 말고는 기대가 하나도 바뀌지 않는다.
                C001~C003 에서 저장된 스냅샷이 그대로 되살아난다
          경계   고대 문에 걸린 기대는 **바뀐다** — C002 가 "잠겨 있다" 로 검증하던 자리가
                이제 "아직 갈 수 없는 곳이다" 다. 그것이 이 Cycle 이 친 폴리싱의 증거이므로
                기대를 지우지 않고 뒤집는다 (닫힌 문 자체의 규칙은 SPEC-006 의 변형이 계속 검증한다)
```

## State

```text
World.closedConnectors[]              CHANGED — [ANCIENT_GATE] → [] (빈 목록).
                                      형도 규칙도 그대로다. 값이 비었을 뿐이다
World.startRegion                     CHANGED — 사는 자리가 content/world 에서 content/regions 로.
                                      값은 WHITE_KING_DOMAIN 그대로
World.regions[] · graph.*             REUSED — 하나도 바뀌지 않는다
```

이 Cycle 의 데이터 값:

```text
closed        (없음)                                        ← C003 까지 [ANCIENT_GATE]
frontiers     FANTASY_MAZE · RED_WASTE · ICE_CANYON          (그대로)
start         WHITE_KING_DOMAIN                              (값 그대로 · 자리만 옮긴다)
```

## Rule

```text
R1  RULE-REGION-TRANSIT-001                                                  REUSED (한 글자도 안 바꾼다)
    THEN 전제 넷째(Connector 가 열려 있다)가 이제 늘 참이다 — 규칙이 아니라 데이터가 그렇게 만들었다.
         그래서 ANCIENT_GATE 의 대답이 connector-inactive 에서 region-not-built 로 넘어간다.
         **이것이 이 Cycle 의 증명이다**: 관찰 가능한 세계가 바뀌었는데 규칙은 그대로다

R2  관찰 투영의 region-exit state                                            REUSED
    THEN isConnectorOpen 이 이제 늘 참이므로 locked 표식이 이 세계에서 사라진다.
         값이 없어진 것이지 갈래가 없어진 것이 아니다

R3  세계의 초기 배치                                                          REUSED (자리만 옮긴다)
    THEN START_REGION 을 content/regions 에서 읽는다. 놓이는 곳은 그대로다

R4  Graph 정합 검사                                                          REUSED
    THEN 검사 전부 그대로. world:observe 가 그 결과를 사람이 읽을 표로 옮길 뿐이다

R5  나머지 Rule 전부                                                         REUSED (변화 없음)
    THEN 이 Cycle 은 세계의 규칙을 하나도 더하지 않는다
```

## REUSED / ADDED

```text
REUSED   Rule 전부 · 사유 코드 전부(connector-inactive 포함 — 쓰이지 않을 뿐 남는다) ·
         문구 전부 · View 의 표 전부 · protocol 전부 · STATE_VERSION · checkGraph · exitsOf
ADDED    tools/world-editor/observe.ts · npm run world:observe ·
         규칙 코드의 이름 없음 검사 · 변형 데이터 실측 시나리오
CHANGED  CLOSED_CONNECTORS 의 값(비었다) · START_REGION 이 사는 자리
AFFECTED RULE-REGION-TRANSIT-001 의 대답 (규칙이 아니라 데이터가 바꾼다 — R1)
```

## Observable (관찰 계약)

**하나도 바뀌지 않는다.** 형도 값의 갈래도 그대로다 — `entities[role=region-exit].state` 는 여전히
`open | locked` 이고 `interactions[transit].reason` 도 여섯 그대로다. 이 세계의 데이터에서
locked 와 connector-inactive 가 **나오지 않게** 됐을 뿐이다.

그래서 `content/protocol/` 도 `content/view/` 도 이 Cycle 에서 손대지 않는다. 그것이 이 Cycle 의 주장이다:
**세계가 눈에 띄게 달라졌는데 계약도 표현도 코드도 그대로다.**

## UNRESOLVED

없음.

Design 이 침묵한 것 중 **답 없이도 성립하는** 것은 기본형으로 두었다 (Human 이 감사할 자리):

```text
고대 문을 여는 것과 확정 3      RegionGraphRooms 확정 3 은 "고대 문은 이 Play 동안 닫혀 있다" 이고,
                              RuleBoundRoom 확정 4 는 "고대 문은 RegionGraphRooms 의 C004 가 데이터로
                              연다" 이다. 둘 다 Human 승인이다. **뒤의 것을 따랐다** — C004 를 이름으로
                              지목했고 STATE §1 도 그렇게 적혀 있으며, 확정 3 은 Play 의 체험 구간
                              (C001~C003 · Breath 의 "닫힌 문"과 "새로운 미지")을 지키는 말로 읽힌다.
                              C004 는 그 체험 밖의 검증 Cycle 이다.
                              **어긋난 두 문장이므로 Human 이 확인할 자리다** — 아니라면 이 한 줄을 되돌리면 된다
어느 방을 더해 실측할지         짓지 않는다. 남은 경계 셋 중 붉은 황야·얼음 협곡은 확정 5 가 이 Play 밖으로
                              돌렸고 환상의 미로는 C005 의 것이다. 그래서 "방을 더한다" 는 **변형 데이터**로
                              재고 세계에는 방을 늘리지 않는다 (SPEC-005). 실제로 방을 더하는 실측은
                              C003 이 RED_EYE_TREE 로 이미 한 번 쳤다
어느 색을 바꿔 실측할지         바꾸지 않는다. 지금 색은 앞의 셋이 근거를 대고 고른 것이므로 실측을 이유로
                              뒤집지 않는다. 표가 유일한 출처라는 것은 폴백으로 잰다 (SPEC-007)
world:observe 의 출력 형식      사람이 읽을 표다 — 기계가 읽을 형식(JSON)은 아무도 요구하지 않았다.
                              요구가 오면 그때 늘린다 (선행 추상화 금지)
"코드 diff 0" 의 측정 방법      diff 를 세는 도구를 만들지 않는다. **왜 diff 가 0 인가**를 재는 것이
                              더 오래 간다 — 규칙이 이름을 모르면(SPEC-003) 이름이 바뀌어도 규칙은
                              바뀔 수 없다. 그것이 이 Cycle 이 고른 측정이다
transition 갈래 이름은 예외      규칙이 'falling' 을 아는 것(RULE-REGION-FALL-001)은 이름을 아는 것이
                              아니라 갈래에 반응하는 것이다 — 그것을 지우면 규칙의 내용이 없어진다
                              (SPEC-003 경계)
```
