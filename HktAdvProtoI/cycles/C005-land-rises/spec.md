# C005 — 땅이 솟는다

```text
CYCLE          C005-land-rises
SOURCE         content/roadmap/play/RoomBecomesLand.md §2 Play Goal · §4 Breath(평면 → 융기) · §5.1 ·
               §6 E6·E7·E9 · V7 · 확정 사항 2·4·5
               (근거: content/roadmap/L2-World-Tool.md §1 Height Field · Compiler · §4 코드 대응 ·
                design/Plan-World-Authoring-Engine.md §3.2 두 산출물 · §3.5 결정론 ·
                content/roadmap/play/RegionGraphRooms.md 불변 조건 "방은 공간일 뿐이다")
SELECTED_FROM  Play Cycle Breakdown — "C005 — 땅이 솟는다"
```

**확장 Cycle** — C001~C004 의 State/Rule 위에 더한다. 복사·재작성하지 않는다.
기구(height-field · surface · compile · view terrain)는 ENGINE A 가 이미 세웠다 — 이 Cycle 은
그것을 **처음 쓰는 자리**이고, 여기서 만드는 것은 데이터와 표와 배선이다.

## Playable Goal

백왕령의 Region Spec `space` 에 **stamp 하나**를 더해 컴파일하면, 관찰자가 들어섰을 때 방의 북쪽이
**솟아 있다**. 걸어 올라가면 바닥 색이 경사를 따라 갈리고(평지 → 비탈 → 급경사), 능선 위에도 올라설 수
있다 — 아직 아무것도 막지 않는다. 그 땅을 만든 것은 `content/regions` 의 데이터 한 덩이이고,
`engine` 도 `content/world` 도 한 줄도 바뀌지 않는다.

## Experience Intent

```text
Start   백왕령은 색칠된 평평한 바닥이다. 왜 안전한지는 이름표가 말할 뿐이다.
End     북쪽이 솟았다. 올라가 보면 발밑 색이 바뀌고, 꼭대기에서 방이 내려다보인다.
        땅이 생겼는데 규칙은 하나도 늘지 않았다 — 파일 하나에 op 하나를 더한 것이다.
```

Play 의 Breath 중 **평면 → 융기** 구간을 만든다. **막힘**(급경사가 몸을 세우는 것)은 C006 이다 —
이 Cycle 에서 급경사는 색일 뿐이다.

## World Change

```text
① 백왕령의 space 에 op 가 하나 는다 — stamp(ridge · 북쪽 변을 따라). 나머지 여덟 방은 그대로 평평하다
② 그 방의 Description hash 가 바뀐다 — descriptionHash 는 ops 를 읽으므로 자동이다.
   세계도 클라이언트도 같은 Description 을 보므로 대조는 C001 의 것 그대로다
③ 세계의 규칙은 하나도 바뀌지 않는다. 이동도 투영도 스냅샷도 그대로다 —
   땅은 아직 몸에 닿지 않는다 (Play §5.1 의 traversable 은 C006)
```

**세계 State 가 늘지 않는다**는 것이 이 Cycle 의 성질이다. 컴파일 결과는 Description 에서
유도되는 사실이므로 저장되지 않고, 이 Cycle 에서는 **관찰자 쪽만** 그것을 만든다 (Plan §3.5).

## Observable Result

```text
① 백왕령에 들어서면 북쪽이 솟아 있다 — 평평하던 바닥에 능선이 있다
② 걸어 올라가면 발밑 색이 갈린다 — 평지 · 비탈 · 급경사 셋
③ 능선 위로 올라설 수 있다 — 아직 아무것도 막지 않는다 (C006 이 막는다)
④ 나머지 여덟 방은 평평하다 — 같은 코드가 데이터가 없는 방에서는 평면을 그린다
⑤ 몸·광맥·출구 표식이 전부 땅에 붙어 있다 — 능선 위에 서면 표지도 함께 올라간다
⑥ 세계의 대답도 HUD 도 하나도 바뀌지 않는다 — 땅은 아직 게임 규칙이 아니다
```

## Reuse

### Existing (그대로 쓴다)

```text
engine/world-authoring 의 buildHeightField · evaluateSurface · compileRegion · stamp op · descriptionHash ·
engine/view-kernel 의 createTerrain(view, palette) · terrainHeightSampler · renderer.setTerrain ·
RULE-MOVE-001 의 extent 판정(그대로 — traversable 은 아직 없다) · 투영 전부 · 스냅샷 전부 ·
region { id, hash } 대조와 hash-mismatch 문구 · SceneGroundZone(바닥 polygon) · 방 이름·깊이 표
```

### Added (이 Cycle 이 세운다)

```text
Data       content/regions/white-king-domain.ts 에 stamp op 하나
View       content/view/biome-rules.ts (표면 규칙 표 — 경사 임계) ·
           content/view/terrain-presentation.ts (surface 태그 → 색) ·
           관찰자가 자기 Description 을 컴파일해 renderer 에 넘기는 배선
World      없음
Protocol   없음
Engine     없음 — ENGINE A 가 이미 세웠다
```

## Out of Scope

```text
traversable · 급경사가 몸을 막는 것 · 거절 사유 코드                    C006
curve(강 · carve · wet) · 다리 point · 조건 area 와 safe-by 사유 코드    C006
world:observe 넷 · 보고 · world:shot · 데이터만으로 basin 더하기 실측     C007
백색 거목 billboard · scatter · instance                                C006~C007
WorldState 가 terrain 을 갖는 것 · 세계가 컴파일하는 것                  C006 (traversable 을 읽어야 할 때)
컴파일 산출을 파일로 굽는 것(*.compiled.generated.ts) · world:compile     C007 (도구가 설 때)
높이가 이동 속도·체력에 하는 일                                          3층 이후
```

## SPEC

```text
SPEC-001  백왕령에 능선이 선다
          조건   세계가 만들어진다
          기대   WHITE_KING_DOMAIN 의 space.ops 에 kind = stamp 인 op 가 하나 있다 —
                stamp = ridge · 북쪽(+z) 변을 따라 놓인다. extent 는 −20..20 그대로다
          경계   나머지 여덟 방의 ops 에는 stamp 가 없다. anchor point 는 아홉 방 모두 그대로다

SPEC-002  같은 Description 은 같은 땅을 준다
          조건   같은 Description 과 같은 규칙으로 두 번 컴파일한다
          기대   hash 가 같고 height 격자의 모든 값이 같고 surface 색인이 전부 같다
          경계   stamp 의 값 하나(중심 · 반경 · 높이 · falloff 중 아무것)가 달라지면 hash 가 달라진다

SPEC-003  화면의 땅이 그 격자다
          조건   백왕령의 컴파일 결과로 땅을 그리고, 같은 자리의 높이를 샘플러로 잰다
          기대   그려진 vertex 의 높이와 샘플한 높이가 같다. chunk 경계에서도 같다
          경계   격자 밖을 재면 0 이다 — 없는 땅을 지어내지 않는다

SPEC-004  표면이 경사로 갈린다
          조건   백왕령의 컴파일 결과를 본다
          기대   surfaceTags 가 셋이고(평지 · 비탈 · 급경사), 능선의 허리에는 비탈이,
                평평한 남쪽에는 평지가 붙는다. 규칙은 배열 순서로 첫 번째가 이긴다
          경계   젖음(wet)은 아직 없다 — 강이 오는 C006 의 것이다 (확정 5 의 넷 중 셋만 쓴다)

SPEC-005  색은 표가 정한다
          조건   관찰자가 그 땅을 그린다
          기대   surface 태그마다 표의 색이 곱해진다. 태그 셋이 서로 다른 색이다
          경계   표에 없는 태그가 와도 게임이 멈추지 않는다 — 기본색으로 그려진다 (C001 부터의 폴백 규칙)

SPEC-006  급경사는 아직 막지 않는다
          조건   관찰자의 몸이 능선의 급경사 자리로 이동을 요청한다
          기대   받아들여진다. RULE-MOVE-001 은 extent 만 본다 — C004 까지와 한 글자도 다르지 않다
          경계   extent 밖은 여전히 out-of-bounds 다. 높이가 판정에 끼어들지 않는다

SPEC-007  데이터가 없는 방은 평평하다
          조건   stamp 가 없는 여덟 방을 컴파일한다
          기대   height 격자가 전부 0 이고 surface 는 평지 하나뿐이다. 땅은 그려지되 평면이다
          경계   Description 을 모르는 region id 면 땅을 그리지 않는다 — 바닥 없이도 게임은 돈다

SPEC-008  세계는 땅을 싣지 않는다
          조건   관찰 결과가 만들어지고, 세계를 저장하고 되살린다
          기대   봉투의 형이 하나도 바뀌지 않고 STATE_VERSION 도 그대로다. 스냅샷에 height ·
                surface · chunk 가 없다. region.hash 는 Description 에서 나온 그 값 그대로다
          경계   백왕령의 hash 는 stamp 가 늘었으므로 C004 까지와 다른 값이다 —
                형이 바뀐 것이 아니라 데이터가 바뀐 것이다

SPEC-009  방이 커져도 같은 코드다
          조건   한 변 40 인 방과 한 변 80 인 방을 각각 컴파일한다
          기대   둘 다 chunk 여럿으로 나뉜다 (Region 하나 ≠ chunk 하나). 두 방 다 seam 이 없다 —
                이웃 chunk 의 경계 vertex 가 같은 자리·같은 높이다
          경계   chunk 를 나누는 값을 바꿔도 height 격자와 hash 는 바뀌지 않는다 —
                세계 판정이 그리는 쪽 설정에 묶이지 않는다
```

## State

```text
Region.space.ops[]        REUSED — 값이 하나 는다 (stamp 하나). 형은 ENGINE A 가 세웠다
Region.hash               REUSED — descriptionHash 그대로. ops 가 늘어 값이 바뀐다

컴파일 결과               유도되는 사실 — 저장되지 않고 세계 State 가 아니다.
                          이 Cycle 에서는 관찰자 쪽만 만든다 (세계가 만드는 것은 C006)
WorldState                CHANGED 없음 — 이 Cycle 은 세계의 State 를 하나도 더하지 않는다
```

이 Cycle 의 데이터 값:

```text
WHITE_KING_DOMAIN   stamp(ridge) — 북쪽 변을 따라. 중심 · 반경 · 높이 · falloff 는 데이터다
표면 규칙            평지 → 비탈 → 급경사 (경사 임계 둘 · 아래 UNRESOLVED 의 기본형)
해상도               TERRAIN_RESOLUTION = 1 (확정 4 · 결정론 상수로 헤더 고정)
```

## Rule

```text
R1  RULE-MOVE-001                                REUSED (한 글자도 안 바꾼다)
    THEN extent 판정 그대로. 높이는 판정에 끼어들지 않는다 — 급경사는 아직 색일 뿐이다 (SPEC-006)

R2  관찰 투영                                     REUSED (변화 없음)
    THEN region { id, hash } 도 그대로다. hash 의 값만 데이터가 늘어 달라진다

R3  영속                                          REUSED (변화 없음)
    THEN STATE_VERSION 그대로. 컴파일 결과는 저장되지 않는다 (유도되는 사실)

R4  나머지 Rule 전부                               REUSED
    THEN 이 Cycle 은 세계의 규칙을 하나도 더하지도 고치지도 않는다.
         **그것이 이 Cycle 의 주장이다** — 땅은 데이터로 생긴다
```

## REUSED / ADDED

```text
REUSED   Rule 전부 · 사유 코드 전부 · protocol 전부 · STATE_VERSION · descriptionHash ·
         region { id, hash } 대조 · ENGINE A 의 컴파일러와 view terrain 전부
ADDED    stamp op 값 하나 (데이터) · 표면 규칙 표 · surface 태그 → 색 표 ·
         관찰자가 컴파일해 renderer 에 넘기는 배선
CHANGED  없음 — engine 도 content/world 도 content/protocol 도 손대지 않는다
AFFECTED 관찰자가 보는 바닥의 모양 (규칙이 아니라 데이터가 바꾼다)
```

## Observable (관찰 계약)

**하나도 바뀌지 않는다.** 형도 값의 갈래도 그대로다 — `region { id, hash }` 는 C001 부터 있었고
`hash` 의 값만 데이터가 늘어 달라진다.

그래서 `content/protocol/` 은 이 Cycle 에서 손대지 않고 `STATE_VERSION` 도 그대로다.

**땅은 봉투로 오지 않는다.** 관찰자가 자기 `content/regions` 의 같은 Description 을 컴파일해 그린다 —
바닥 polygon 을 그리던 것과 같은 방식이고(C001), 세계가 보낸 hash 와 다르면 이미 있는 문구
("세계와 다른 땅을 보고 있다")가 그 사실을 말한다. 30Hz 관찰 결과에 격자를 싣는 것은 이 계약의 것이
아니다 (Plan §3.5).

## UNRESOLVED

없음.

Design 이 침묵한 것 중 **답 없이도 성립하는** 것은 기본형으로 두었다 (Human 이 감사할 자리):

```text
표면 경사 임계 둘          급경사 = 45° 이상은 확정 1 이 준 값이다(그 각이 C006 에서 몸을 막는다).
                        평지와 비탈을 가르는 각은 어느 문서에도 없어 **15°** 로 두었다 —
                        45° 의 1/3 이고, 걸어 오를 수 있지만 평평하지는 않은 구간이라는 뜻이다.
                        규칙 표의 값이므로 코드가 아니라 데이터로 바꾼다 (색·anchor 좌표와 같은 성격)
능선 stamp 의 값          중심 · 반경 · 높이 · falloff 는 데이터다 (C001~C003 의 anchor 좌표 선례).
                        방향만 확정 2("산맥은 북쪽")에서 왔다. 북쪽 변을 따라 놓되 방을 다 덮지 않는다 —
                        올라가 볼 수 있어야 융기가 관찰되기 때문이다
규칙 표를 content/view 에 두는 것   이 Cycle 에서는 **관찰자만** 컴파일하므로 View 의 것이다
                        (L2-World-Tool §4 의 파일 지도 그대로). 세계가 traversable 을 읽어야 하는 C006 에서
                        비로소 "world 와 view 가 같은 규칙을 읽는가" 가 문제가 된다 — 그때 자리를 정한다.
                        지금 옮겨 두는 것은 아무도 요구하지 않은 구조다
컴파일을 언제 하는가       관찰 결과의 region.id 가 바뀔 때. 방마다 한 번 컴파일해 두고 다시 쓴다 —
                        매 프레임 컴파일하지 않는다. 어디에 두고 다시 쓰는지는 조립의 몫이다
컴파일 산출을 굽지 않는 것  Plan 은 *.compiled.generated.ts 를 예고했지만 그것을 만드는 도구(world:compile)가
                        C007 의 것이다. 그때까지는 켤 때 컴파일한다 — 방 아홉이 그 정도 크기다
```
