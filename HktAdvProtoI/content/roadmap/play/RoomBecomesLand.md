# RoomBecomesLand — 방이 땅이 된다, 백왕령

상태: **승인됨** (Human 승인 1회 — 질문 여섯 전부 승인).
선행: [RegionGraphRooms.md](RegionGraphRooms.md) — 방이 있어야 땅으로 채운다. RuleBoundRoom 이 이 Play 뒤에 선다 —
규칙이 바꿀 구조(area · traversable)를 이 Play 가 먼저 세운다.

## 0. Row

**기반 층 L2 — 세계 자체.** 이 Play 가 증명하는 축: *땅은 Region Spec 의 space 가 컴파일된 결과다. 방을
땅으로 바꾸는 데 코드가 필요 없고, 안전한 곳은 안전해서 안전한 것이 아니라 조건이 만든다.*

놓는 미지 — 없다. 백왕령은 미지가 아니라 출발점이다. 대신 이 Play 는 **도구 절반의 1단계**
([L2-World-Tool.md](../L2-World-Tool.md) §4 ①③④⑤⑧⑨)를 플레이로 닫는다.

방향 한 줄과의 관계 — "이후 코드 변경 없이 폴리싱 가능한 구조" 의 실측이다. RegionGraphRooms 의 C004 가
데이터로 방을 바꾸는 것을 실측했다면, 이 Play 는 데이터로 **방을 땅으로 바꾸는 것**을 실측한다.

## 1. References

- [L2-World-Concept.md](../L2-World-Concept.md) §3 알려진 세계 — 산맥 · 강 · 백색 거목 · "안전할 수 있는 조건" (W2) · §16 비주얼 방향
- [L2-World-Tool.md](../L2-World-Tool.md) §1 Height Field · Compiler · World/View Data · §3.2 op 대응표 · §4 1단계
- [design/Plan-World-Authoring-Engine.md](../../../design/Plan-World-Authoring-Engine.md) §3 구조 · §3.5 결정론 · §4 완료 조건
- [design/Design-World-Editor-Terrain-Compiler.md](../../../design/Design-World-Editor-Terrain-Compiler.md) §7 Terrain Shape · §12 Surface 규칙 · §31 Observation · §36 최소 Prototype
- [L2-World-Region.md](../L2-World-Region.md) R11 Terrain 은 결과다 · §13 · §15 9~10

## 2. Play Goal

**백왕령 Region Spec 의 space 에 op 를 더해 컴파일하면(코드 diff 0), 관찰자가 그 땅 위를 걸어 산맥의 급경사에
막히고, 강을 따라 걷고, 백색 거목 곁에 서며, 그 셋이 "왜 여기에 사람이 사는가"의 조건임을 화면에서 읽는다.**

완료 확인 넷: `git diff --stat -- engine content/world content/view` 가 비어 있다(변한 것은 `content/regions/`
와 컴파일 산출뿐) · 급경사 자리에서 이동 요청이 거절된다(사유 코드) · `world:observe` 의 네 장(높이 · 표면 ·
통행 · 의미)이 백왕령을 보여준다 · 서버와 클라이언트의 region hash 가 같다.

## 3. Experience Intent

```text
Start   백왕령은 색칠된 평평한 방이다. 왜 안전한지는 이름표가 말할 뿐이다.
End     북쪽은 산이라 못 넘고, 강이 마을을 지나고, 거목 아래는 비어 있다. 안전한 이유가 땅에 있다.
        그리고 그 땅은 파일 하나를 고쳐 다시 컴파일한 것이다 — 방이었을 때와 같은 Spec 이다.
```

## 4. Breath

```text
평면 → 융기 → 막힘 → 흐름 → 그늘 → 이해 → 조망 → 더 채우고 싶음
```

- **평면** — 방이던 백왕령. 출구 셋. (RegionGraphRooms 의 상태)
- **융기** — 컴파일 뒤 들어오니 북쪽이 솟아 있다. 표면 색이 경사 따라 바뀐다.
- **막힘** — 능선으로 걸어 올라가다 막힌다. 세계의 대답: "너무 가파르다".
- **흐름** — 강이 방을 가로지른다. 강가는 색이 다르다(젖은 표면). 건너는 자리(다리 point)가 하나.
- **그늘** — 백색 거목. 큰 point. 그 둘레의 area 는 조건 태그(settlement/condition).
- **이해** — HUD 의 조건 사유 코드: 산맥이 막고 · 강이 먹이고 · 거목이 물린다. "안전한 조건이 있어서 사람이 산다"(W2).
- **조망** — world:observe 의 top view — 내가 걸은 땅이 한 장으로. 산 · 강 · 거목 · 출구.
- **더 채우고 싶음** — 숲 가장자리는 아직 평평하다. 같은 방법으로 채울 수 있다는 것을 안다.

## 5. Play Structure

### 5.1 융기 · 막힘 — Height Field 와 traversable

```text
존재   백왕령 space 의 op — stamp(ridge, 북쪽 변을 따라) · 기본 높이 0
상태   컴파일 결과 — height 격자(TERRAIN_RESOLUTION) · slope · traversable(급경사 = 0)
조건   이동 규칙이 목표 자리의 traversable 을 읽는다 — 0 이면 거절 (이 Play 가 정하는 유일한 "몸에 닿는" 것 — Human 질문 1)
관찰   바닥이 솟는다(view 가 height 를 샘플) · 급경사 표면 색(cliff) · 거절 사유 코드 → 문구
추론   "북쪽은 산이다. 못 넘는다 — 바깥의 것도 못 넘어온다"  (Concept §3 산맥 → 외부 생물 차단)
반응   거절만. 세계 State 는 안 바뀐다
```

**막힘은 말을 한다** (실주행 판정 Q6 · 확정 7). 요청의 거절은 세계가 사유 코드로 말하지만, 요청이 받아들여진 뒤
**진행이 멎는** 것 — 다른 몸이 밀어붙이거나(몸 충돌) · 밀려서 막힌 땅 위에 서거나 · 방의 끝에 닿거나 — 은 세계가
아무 말도 하지 않았다. 그것을 관찰자 쪽이 알아챈다: 걸으려는데 0.6초 동안 제자리면 막는 몸의 이름 · 발밑의 사유 ·
"무언가에 막혀 있다" 를 한 번 띄우고 기록에 남긴다. 세계는 한 줄도 바뀌지 않는다 — 몸 · 자리 · 땅은 이미 봉투에
있고(RoomAnswersWhenAsked 확정 12 의 어법), 그것을 잇는 것이 관찰자다. 방의 끝은 "방의 끝이다 — 나가는 길은 출구
표식이다" 로 **무엇이** 막는지를 말한다.

### 5.2 흐름 — Curve

```text
존재   curve(layer: feature, tag: river, profile: carve) 동서로 · point(layer: feature, tag: bridge) 하나
상태   강 폭 안은 traversable 0 (물) — 다리 자리만 1. 강가 표면 태그 wet
관찰   파인 물길 · 젖은 색 · 다리 표식
추론   "강은 마을을 지난다(식수·농업). 건너는 곳은 하나"
```

### 5.3 그늘 · 이해 — Point 와 조건 area

```text
존재   point(layer: landmark, tag: WHITE_GIANT_TREE) · area(layer: settlement, tag: condition) 셋 —
       산맥 기슭 · 강가 · 거목 둘레. area(layer: settlement, tag: city) 그 가운데
상태   조건은 표시다 — 포식자가 실제로 못 오는 것은 3층 이후. **표식은 몸에 닿는다** (확정 8): landmark point 둘레
       줄기 반경(1.6) 안은 traversable 0 이고 사유 코드는 landmark-trunk 다. 땅의 성질이 아니라 **거기 선 것**이
       막는 첫 사유이며, 표식이 없는 방은 한 값도 달라지지 않는다
관찰   거목 sprite(billboard) · 조건 area 의 테두리(SceneGroundZone) · 그 안에 서면 HUD 사유 코드(safe-by: ridge / river / tree)
추론   "안전한 곳이라 도시가 있는 게 아니라, 이 셋이 있어서 도시가 있다"  (W2)
반응   없음
```

### 5.4 조망 — Observation

```text
존재   world:observe --height --surface --traversable --semantic --top-view · --report
관찰   PNG 넷 + 보고(검사 ①~⑨ · chunk 수 · instance 수 · hash)
추론   "내가 걸은 것과 그림이 같다" — Build → Observe 루프가 닫힌다 (WE §31)
```

### 5.5 더 채우고 싶음 — 폴리싱의 자리

```text
숲 가장자리(FOREST_EDGE) space 에 stamp(basin) 하나만 더한다 → 컴파일 → 걷는다.
코드 diff 0. 이것이 완료 조건 1 의 두 번째 실측이다.
```

## 6. Required Capability

### Existing (재사용)

```text
RegionGraphRooms 의 전부 · 이동 규칙 · Request.Outcome 거절 · HUD label · SceneGroundZone(polygon) ·
billboard sprite(캐릭터 sprite 장치) · tools/fx-lab 의 playwright 촬영 선례 · motion-atlas 의 generated 선례
```

### Required — 기구 (ENGINE 레인 — 이 Play 의 몸통)

```text
E6   engine/world-authoring 의 나머지 — height-field(base + stamp + curve modifier) · surface(규칙 표 평가) ·
     traversable(경사 임계) · compile(world/view · hash) · observe(래스터 넷 + 보고) · random(seed)  (Plan §3)
E7   engine/view-kernel/terrain — createTerrain(compiledView, palette): chunk mesh · vertex color · heightAt 이
     컴파일 결과를 샘플 (sine 함수 제거) · instanced billboard (거목 하나부터)
E8   tools/world-editor — world:compile · world:observe · world:shot
E9   결정론 — 같은 (description, rules) → 같은 hash. TERRAIN_RESOLUTION 헤더 상수. 스냅샷에 region hash.
     Region 하나 = 격자 하나를 전제하지 않는다 — World 의 높이·통행 데이터도 View 처럼 chunk 단위로 들 수 있어야 하고
     Region 의 extent 에 상한을 두지 않는다 (Rooms 불변 조건 "방은 공간일 뿐이다"). 백왕령·숲 가장자리는 chunk 하나로 충분하다
```

### Required — 세계 · 표현 (content)

```text
W15  WorldState.regions[id].terrain: CompiledWorldTerrain · 이동 규칙이 traversable 을 읽는다
W16  조건 area 안의 HUD 사유 코드 (safe-by:*)
W17  표식의 줄기 — 막는 규칙 표에 point 둘레(landmark layer · 반경) 한 줄. 사유 코드 landmark-trunk (실주행 판정 Q7)
V7   terrain-presentation — surface 태그 → 색 (평지 · 경사 · 급경사 · wet 넷) · landmark 태그 → sprite
V8   biome-rules — surface 규칙 표 (slope 임계 둘 · curve 거리 → wet) — 데이터
V8′  movement-reading — 걸으려는데 멎은 몸이 왜 서 있는지(막는 몸 · 발밑의 사유 · 막혀 있음)를 한 번 띄우고 기록에
     남긴다 · 자판 걸음이 요청하는 앞 거리는 빠르기를 따른다 (걷기 1.6 · 달리기 2.7 — 관찰 결과가 늦게 와도 걸음이
     끊기지 않는다). 둘 다 관찰자 쪽이고 세계에 아무것도 요구하지 않는다 (실주행 판정 Q6)
```

기구가 하나 는다 — **E6′ BlockRule.nearPoint** (point 둘레를 막는 규칙 · PassRule 이 point 둘레를 여는 것의 반대형).
게임 명사가 없고, 밝히지 않은 규칙 표는 예전과 같은 hash 를 낸다.

### 불변 조건 — 코드 변경 없이 폴리싱

```text
산을 옮긴다 · 강을 굽힌다 · 거목을 옮긴다 · 숲 가장자리를 채운다 → content/regions/*.ts 의 space 만
색을 바꾼다 · 표면 규칙을 바꾼다 → content/view 의 표만
줄기의 반경을 바꾼다 · 표식을 하나 더 세운다 → 규칙 표 한 줄 · space 의 point 하나 (같은 사유가 선다)
막힘의 문구를 바꾼다 · 멎음을 재는 시간을 바꾼다 → content/view 의 표와 상수
방으로 되돌린다 → space 의 op 를 지운다 — 같은 Spec
```

## 7. Cycle Breakdown

```text
[x] C005 — 땅이 솟는다: height-field + stamp + compile + view terrain 교체 + 결정론(hash). 백왕령 북쪽 능선.
           급경사는 표면 색만 (아직 안 막힘) — 도구 1단계 ①③④
[x] C006 — 땅이 막고 흐른다: traversable + 이동 거절 + curve(강 · carve · wet) + 다리 point + 거목 billboard +
           조건 area 와 HUD 사유 코드 — 도구 1단계 ⑤⑥, W2
[x] C007 — 보고 다시 만든다: world:observe 넷 + 보고(검사 ①~⑨) + world:shot. 숲 가장자리에 basin 을 데이터로
           더해 코드 diff 0 실측 — 도구 1단계 ⑧⑨, Plan §4 완료 조건 1~3
```

## 확정 사항 (Human 승인)

```text
1. traversable 임계 = 45°. 이것이 2층에서 높이가 몸에 닿는 유일한 형태다 — 더 깎이는 것(체온·체력)은 3층.
   결정론 시뮬 상수로 고정한다.
2. 백왕령의 지형 — 산맥은 북쪽 · 강은 동서로 가로지름 · 백색 거목은 도시 곁. 정식 세계 사실이다.
3. 강을 건너는 자리(다리)는 하나.
4. TERRAIN_RESOLUTION = 1m. 결정론 상수로 헤더 고정. 해상도는 격자 칸의 크기이지 Region 크기의 상한이 아니다 —
   큰 Region 은 chunk 로 나뉜다 (E9).
5. 표면 넷으로 시작 — 평지 · 경사 · 급경사 · 젖음.
6. 순서는 RegionGraphRooms → RoomBecomesLand → RuleBoundRoom. 셋의 Cycle 번호는 C001~C010 으로 고정한다 —
   이 Play 는 C005~C007, RuleBoundRoom 은 C008~C010.

실주행 판정 (Human 답 · Cycle 없이 반영)
7. **막는 것은 보여야 한다.** 요청의 거절만이 아니라 진행이 멎는 것(몸 충돌 · 막힌 땅 위 · 방의 끝)도 말을 한다 —
   말하는 자리는 관찰자 쪽이고 세계는 바뀌지 않는다 (§5.1). 시작 자리와 거목을 지나던 자율 존재의 순회는 비켰다.
8. **거목은 몸에 닿는다.** 표식 point 둘레 반경 1.6 이 줄기이고 사유는 landmark-trunk 다 (§5.3). 그림(높이 17)은
   뒤 컨텐츠 작업이 갈아 끼운다 — 이 Play 가 정한 것은 줄기가 있다는 사실이다.
9. 값은 그대로다 — 평지/비탈 경계각 15° · 강 폭 8 · 깊이 1.5 · 다리 반경 5 · 젖은 땅 폭 6 · 조건 원 4 와 3.5 · 거목 높이 17.
   검사 도구가 spec 의 침묵에서 스스로 고른 판정 방식 다섯(C007)도 그대로 둔다.
```
