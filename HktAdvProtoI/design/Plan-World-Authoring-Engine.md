# Plan — 세계 제작 도구(engine) 제안: World Editor + Terrain Compiler 적용 검토

| 항목 | 내용 |
|---|---|
| **상태** | **확정** — 2층 도구 절반의 결과물은 [content/roadmap/L2-World-Tool.md](../content/roadmap/L2-World-Tool.md) 다. 다음 주입(세계관 컨셉 · 세계 content 구성)이 닿는 자리는 그 문서 §3 |
| **재료** | [Design-World-Editor-Terrain-Compiler.md](Design-World-Editor-Terrain-Compiler.md) (WE) |
| **자리** | 로드맵 2층의 **도구 절반**. 세계 절반(세계압·안전권·깊이·지역 지도·이름 목록)은 이 문서가 답하지 않는다 — 2층 주입이 준다 |
| **소유** | 이 문서가 제안하는 것은 전부 `engine/` · `tools/` 의 기구와 `content/` 의 **빈 자리**다. 자리에 무엇을 넣는가는 컨텐츠 주입의 것이다 |

> 한 문장 — **도구는 세계를 쓰는 문법과 컴파일러이지 세계가 아니다.** WE 의 Region
> Description 을 이 저장소의 기반/컨텐츠 분리 위에 세우면, 2층 주입은 "무엇이 있는가"만
> 주고 그것이 어떻게 땅이 되는지는 기반이 맡는다.

---

## 0. 이 문서의 책임

```text
답한다
    WE 의 어느 원칙을 그대로 받고, 어느 것을 이 저장소에 맞춰 바꾸며, 어느 것을 미루는가
    engine/ 에 무엇이 서고 content/ 에 어떤 빈 자리가 생기는가 (형과 경계)
    Agent API · Observation API 가 이 공정(파일이 인터페이스)에서 무엇으로 나타나는가
    1단계 범위와 완료 조건 · 로드맵에서의 순서 (도구 → 세계)

답하지 않는다
    세계압이 자연 법칙인가 · 안전권과 깊이 단계 · 지역 지도 · 이름   → 2층 주입 (Human)
    높이·경사가 몸에 무엇을 하는가                                 → 2층 Play 의 Cycle · 3층
    Biome 이 무엇을 낳는가 · Semantic 태그의 뜻                     → 컨텐츠 데이터
```

## 1. 지금 코드가 선 자리 (실측)

| 항목 | 지금 | WE 가 요구하는 것 | 판정 |
|---|---|---|---|
| 높이 | `engine/view-kernel/terrain/terrain.ts` 의 `heightAt` — sine 하드코딩, **view 전용**. 세계 판정은 평면 (x,z) | 높이는 World Data (Height Query), View 는 그것을 샘플 (WE §28) | **바꾼다** — 높이의 출처를 view 에서 컴파일 결과로 옮긴다 |
| 세계 범위·배치 | `WORLD_BOUNDS` 40×40 사각 · `SPAWN_POINTS` · `DEFAULT_NPCS` 상수 (`content/world/semantic/world-state.ts` · `index.ts`) | Region extent · Point 프리미티브 | **대체** — Region Description 이 범위와 자리를 준다 |
| 지면 구역 | `SceneGroundZone` (circle 만, `engine/view-kernel/scene/scene-state.ts`) + 렌더러 `drawZones` | Area (polygon) | **확장** — polygon shape 추가. 이미 "의미 없는 프리미티브" 원칙이 같다 |
| 관찰 계약 | `GameViewSnapshot` = entities · interactions · hud · commands. 지형은 `scene` 문자열뿐 | View 가 지형 데이터를 안다 | **작게 확장** — Region id + Description hash 만 봉투에. 지형 본체는 tick 마다 싣지 않는다 (§3.5) |
| 결정론 | 시뮬 상수 헤더 고정 · 세계에 난수 State 없음 (L1 §3) | Seed 로 재현 (WE §16) | **맞는다** — Seed 는 컴파일 시간의 난수. 세계 State 가 아니다 |
| 관찰 촬영 | `tools/fx-lab/test/terrain-shot.js` (playwright, PNG) | Observation API (WE §31) | **선례 있음** — 같은 방식으로 도구를 세운다 |
| 생성물 캐시 | `view/motion-atlas.generated.ts` ← `npm run motions:scan` | Compiled Chunk cache (WE §29) | **선례 있음** — `*.generated.ts` 규약을 그대로 |
| 렌더 | three.js WebGL (`renderer.ts`) · 캐릭터는 billboard sprite | Mesh kit · GPU instancing (WE §17~§19) | **단계화** — sprite instancing 부터, mesh kit 은 뒤 |
| AI 의 손 | advprotoi 스킬이 **파일**로 일한다 (Cycle Artifact — 파일만이 단계 간 인터페이스) | 함수 호출 API (WE §30) | **번역** — 함수 하나 = Description 의 op 종류 하나 (§3.3) |

## 2. 판정 — WE 의 무엇을 받고 무엇을 바꾸는가

### 2.1 그대로 받는 원칙

```text
Region Description 이 Source of Truth, Chunk·Mesh 는 파생물        WE §40 — L1 의 "저장되는 State / 유도되는 사실" 구분과 같다
AI 는 Point · Curve · Area · Field 만 편집하고 vertex 를 만지지 않는다  WE §6 · §39-3
World Data 와 View Data 를 같은 Description 에서 함께 만든다         WE §28 — 핵심 원칙 1·2 와 동일
Seed 는 자연스러움이 아니라 재현의 열쇠                             WE §16 — 핵심 원칙 6
Chunk 크기는 설계 데이터가 아니라 runtime 설정                       WE §4
Landmark 는 직접 놓고 Decoration 은 규칙이 놓는다                    WE §15 · §21
Gameplay 에서 Terrain 으로 내려간다                                  WE §32 — L0 §4 (위험과 재료의 원인이 먼저) 와 같은 방향
Build → Observe → Evaluate → Modify                                  WE §31 — 이 공정의 실측 검증(05-verification) 과 같은 자세
```

### 2.2 이 저장소에 맞춰 바꾸는 것

| # | WE | 이 저장소에서 | 이유 |
|---|---|---|---|
| 1 | `paintBiome(GiantForest)` · Semantic `DANGER` · Surface `Moss` 처럼 **이름이 API 에 박혀 있다** | 기반은 `area(layer, tag)` · `surfaceRule[]` · `catalogEntry` **형**만 안다. 태그가 무엇을 뜻하는지는 `content/` 의 규칙 표·카탈로그가 정한다 | 기반은 게임 명사를 모른다 (설계 반전 ⑤). Biome rule set(WE §14) 은 통째로 컨텐츠 **데이터**다 |
| 2 | Agent API = 함수 호출 | Agent API = **Description 에 쌓이는 순서 있는 op 목록**. 컴파일은 op 재생. `move/rotate/scale/erase` 는 op 의 수정·삭제 | 이 공정의 AI 는 파일로 일한다. op 목록이면 diff·undo·재현이 공짜다 |
| 3 | Corner Height 를 초기 편집 도구로 (WE §8 · §36 ②) | **짓지 않는다.** 공유 Height Field + Stamp + Curve modifier 를 첫날부터 | 이미 연속 `heightAt` 이 있다. WE 자신도 최종 모델이 아니라고 했다 — 되돌아갈 이유가 없다 |
| 4 | Chunk 가 Collision · Navigation 도 가진다 | Chunk 는 **View 의 것**. World Data 는 chunk 없이 고정 해상도 격자 하나 (`TERRAIN_RESOLUTION` 시뮬 상수) | 세계 판정의 결정론이 view 설정(chunk 크기)에 묶이면 안 된다 |
| 5 | World = Region Graph, Region 간 Connector 가 지형 경계가 된다 (WE §24) | **1단계는 Region 하나 = 세계 하나.** Graph 와 Region 간 Connector 는 Description 에 기록하되, 컴파일러는 경계 태그(`connection`)까지만 만든다 | 다중 Region 을 한 세계에 두는가는 관찰자 참여·투영·영속을 건드린다 — Human 질문 (§6-2) |
| 6 | Tree/Rock mesh kit · Cliff kit · LOD/Impostor | **billboard sprite instancing** 부터 (기존 sprite 장치). Cliff 는 kit 이 아니라 **경사 규칙**(급경사 → surface `cliff` 태그 + 통행 불가) | 지금 자산 파이프라인은 sprite 다. WE §20 도 장기적으로 Curve+Profile 을 권한다 — kit 은 짓지 않는다 |
| 7 | Human UI (Brush · Spline · Drag) 를 Agent API 와 동급으로 | **후순위.** lab 페이지(top view + op 목록 + 다시 컴파일) 로 시작 | 이 프로젝트의 제작자는 AI 이고 Human 은 승인자다. Brush 는 Human 이 직접 지형을 만지는 도구인데 그것이 이 트랙이 피하려는 일이다 |
| 8 | Navigation · Collision mesh | 1단계는 **Traversability 격자**만 (통행 가능/불가 + 사유 태그). 경로 탐색은 없다 | 지금 이동 규칙은 `inBounds` 하나다. 세계가 높이를 어떻게 다루는지는 2층 Play 가 정한다 |

### 2.3 받지 않거나 미루는 것

```text
WFC / Wang Tile (WE §33)          필요가 생길 때. 1단계 배치는 scatter 규칙만
Asset 제작 파이프라인 (WE §34)     "자산 요구서" 를 파일로 남기는 규약만 둔다 — 제작은 이 트랙 밖
Streaming (WE §29)                세계가 수십 m 인 동안 필요 없다. compiled *.generated.ts 캐시까지만
WE §37 의 예시 이름               거대 악마의 숲 · 백왕령 · 얼음 협곡 · 붉은 황야 는 WE 의 **예시**이지 이 세계의 사실이
                                  아니다. 첫 Region 의 이름과 사실은 2층 주입이 준다 — 도구는 그것을 기다리지 않는다
```

## 3. 제안 구조

```text
engine/world-authoring/            기반 — 게임 명사 없음 · 순수 함수 · DOM 없음 · Math.random 없음
  description.ts                   RegionDescription = identity(id · extent · seed) + ops[] (순서 있는 편집 목록)
  primitives.ts                    Point · Curve(polyline · width · profile) · Area(polygon | circle · layer · tag) ·
                                   Field(stamp: kind · center · radius · height · falloff)
  ops.ts                           Op 종류와 그 의미 (WE §30 ↔ 1:1, §3.3) · erase/move 는 op id 로
  height-field.ts                  공유 vertex grid — base + stamps + curve modifier(carve/raise/flatten) → height(x,z) bilinear
  surface.ts                       규칙 표 평가 — slope · height · curve 거리 → surface 태그. 규칙은 인자로 받는다
  semantic.ts                      Area layer 조회 — tagsAt(x, z, layer) · 경계 polygon 유지
  scatter.ts                       결정론 배치 — seed · density · minDistance · slope · curve 거리 · area 조건 → instances
  random.ts                        seeded PRNG (splitmix32) — 세계 State 가 아니라 컴파일의 것
  compile.ts                       (description, rules) → { world: CompiledWorldTerrain, view: CompiledViewTerrain, hash }
  observe.ts                       height / surface / semantic / traversability 를 숫자 버퍼로 래스터 · 요약 보고 (PNG 인코딩은 tools)
  tests/                           결정론(같은 입력 → 같은 hash) · seam 없음 · stamp 합성 · scatter 규칙

engine/view-kernel/terrain/        createTerrain(compiledView, palette) — chunk mesh · vertex color(surface 태그 → 색은 인자) ·
                                   instanced billboard(scatter 태그 → sprite 는 인자). heightAt 은 컴파일 결과를 샘플한다 —
                                   sine 함수는 사라진다
engine/view-kernel/scene/          SceneGroundZone.shape 에 polygon 추가
engine/protocol-core/gameview.ts   봉투에 region: { id, hash } — 지형 본체는 싣지 않는다 (§3.5)

content/regions/                   이 세계의 Region Description (데이터) — world 와 view 가 **함께 읽는** 유일한 content 하위 폴더
  <region-id>.region.ts            identity + ops
  <region-id>.compiled.generated.ts  npm run world:compile 산출 (커밋 — motion-atlas 선례)
content/world/semantic/terrain.ts  WorldState.terrain: CompiledWorldTerrain · 규칙이 쓰는 heightAt / traversable / tagsAt
content/world/rules/move.ts        inBounds → traversable (2층 Play 가 정하는 만큼만 — 지금은 범위 판정 대체)
content/world/index.ts             초기 배치 상수 → Description 의 Point(role 태그) 에서 spawn
content/view/terrain-presentation.ts  surface 태그 → 색 · semantic 태그 → zone 스타일 · scatter 태그 → sprite id
content/view/biome-rules.ts        Biome rule set (WE §14 의 yaml 에 해당) — surface 규칙 · scatter 규칙 · 자산 카탈로그 참조

tools/world-editor/                Agent API 표면 + Human lab
  cli.ts                           op 추가/수정/삭제 · compile · observe (§3.3 · §3.4)
  lab/                             top view + op 목록 + 다시 컴파일 (surface-lab 선례) — Human UI 의 1단계
```

### 3.1 Region Description (형)

```ts
// engine/world-authoring/description.ts — 게임 명사 없음. 태그는 불투명 문자열이다.
export interface RegionDescription {
  id: string;
  /** 세계 좌표 범위 (x, z) — 세계의 bounds 가 여기서 나온다 */
  extent: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** 컴파일 재현의 열쇠 — 세계 State 가 아니다 */
  seed: number;
  /** 순서 있는 편집. 컴파일은 이것을 재생한다 */
  ops: readonly RegionOp[];
}

export type RegionOp =
  | { id: string; kind: 'stamp'; stamp: 'hill' | 'ridge' | 'basin' | 'plateau' | 'valley' | 'crater';
      center: XZ; radius: number; height: number; falloff?: number; rotation?: number; length?: number }
  | { id: string; kind: 'curve'; layer: string; tag: string; points: XZ[]; width: number;
      profile?: 'carve' | 'raise' | 'flatten'; depth?: number }
  | { id: string; kind: 'area'; layer: string; tag: string;
      shape: { kind: 'polygon'; points: XZ[] } | { kind: 'circle'; center: XZ; radius: number } }
  | { id: string; kind: 'point'; layer: string; tag: string; position: XZ; rotation?: number; scale?: number }
  | { id: string; kind: 'connector'; tag: string; border: 'north' | 'south' | 'east' | 'west';
      offset: number; width: number; to?: string };
```

`layer` 는 컨텐츠가 짓는 이름의 공간이다 — 예컨대 `biome` · `semantic` · `surface` · `landmark` ·
`poi` · `spawn`. 기반은 layer 도 tag 도 뜻을 모르고 **조회만** 제공한다. 무엇을 layer 로
둘지는 2층 주입과 그 Play 의 02-world 가 정한다.

### 3.2 컴파일러 출력 (World / View)

```ts
// 세계가 규칙에 쓰는 것 — 고정 해상도 격자. chunk 없음.
export interface CompiledWorldTerrain {
  extent: Extent;
  resolution: number;                       // TERRAIN_RESOLUTION — 시뮬 상수
  height: Float32Array;                     // 공유 vertex grid — 높이의 단일 출처
  surface: Uint8Array; surfaceTags: string[];
  traversable: Uint8Array;                  // 0 = 통행 불가 (급경사 · blocker 태그)
  areas: { layer: string; tag: string; shape: AreaShape }[];   // tagsAt 이 이것을 읽는다
  points: { layer: string; tag: string; position: XZ; rotation: number; scale: number }[];
  connectors: { tag: string; border: Border; position: XZ; width: number; to?: string }[];
}

// View 가 그리는 것 — chunk 로 나뉜다. chunkSize 는 runtime 인자.
export interface CompiledViewTerrain {
  chunkSize: number;
  chunks: { ix: number; iz: number; positions: Float32Array; surface: Uint8Array }[];
  instances: { tag: string; position: XZ; rotation: number; scale: number }[];   // scatter 결과
  surfaceTags: string[];
}
```

두 출력은 같은 `height` 격자에서 나온다 — chunk 경계는 격자의 vertex 를 공유하므로 seam 이
구조적으로 없다 (WE §9). view 의 `heightAt` 은 이 격자를 bilinear 로 샘플한다.

### 3.3 Agent API — WE §30 의 함수 ↔ op

| WE §30 | op | 비고 |
|---|---|---|
| `createRegion()` | Description 파일 생성 (`id · extent · seed`) | `npm run world:edit -- create <id>` |
| `applyTerrainStamp()` · `sculptTerrain()` | `stamp` | sculpt 는 작은 반경의 stamp 다 — 별도 op 를 두지 않는다 |
| `createCurve()` · `createRoad()` · `createRiver()` · `createCliff()` | `curve` (layer=`feature`, tag=`road`/`river`/`cliff` …) | 무엇이 강인지는 tag — 강이 파고 젖게 하는 것은 컨텐츠의 curve 규칙 |
| `paintSurface()` · `paintBiome()` · `createArea()` · `paintDangerArea()` · `paintResourceArea()` · `paintSpawnArea()` | `area` (layer · tag) | 함수 여섯이 op 하나다 — 차이는 layer/tag 뿐 |
| `placeAsset()` · `placePOI()` · `placeLandmark()` | `point` (layer · tag) | 자산 카탈로그 조회는 tools 의 것 — op 는 tag 만 기록 |
| `placeConnector()` | `connector` | 1단계는 경계 태그까지 (§2.2-5) |
| `move()` · `rotate()` · `scale()` | 같은 `id` 의 op 를 바꿔 쓴다 | |
| `erase()` | 그 `id` 의 op 를 지운다 | |

AI 는 이 op 를 **파일 편집** 또는 CLI 로 쌓는다. 둘 다 같은 Description 에 닿으므로
"사람과 AI 가 같은 Editor Core 를 쓴다"(WE §5) 는 파일 하나로 성립한다.

### 3.4 Observation API — WE §31 ↔ 도구

| WE §31 | 이 저장소 | 어디서 |
|---|---|---|
| `getHeightMap()` · `getSemanticMap()` · `getNavigationMap()` | `npm run world:observe -- <id> --height --semantic --traversable` → PNG + 숫자 요약 | Node — `observe.ts` 래스터, 브라우저 없음 |
| `captureTopView()` | `--top-view` → PNG | Node 래스터 (surface 색 + area 경계 + point 표식) |
| `captureWorldImage()` | `npm run world:shot -- <id> [--at x,z]` | playwright — `terrain-shot.js` 선례 |
| `getVisibleLandmarks()` · `getAssetList()` | `--report` 의 points/instances 표 | Node |
| `getPerformanceReport()` | `--report` 의 chunk 수 · instance 수 · 컴파일 시간 | Node |

관찰이 세계를 바꾸지 않는다 — 전부 읽기 전용 도구다 (boundary check · catalog 와 같은 규약).

### 3.5 결정론과 영속

```text
컴파일은 순수하다        같은 (description, rules) → 같은 hash. Math.random · Date · 파일 순서에 기대지 않는다
TERRAIN_RESOLUTION       세계 격자의 해상도는 시뮬 상수(헤더 고정). view 의 chunkSize 는 runtime 인자
높이는 세계 State 인가    저장되는 것은 Description(과 그 hash). 컴파일 결과는 유도되는 사실이다 — 스냅샷에는 싣지 않는다
스냅샷                   WorldSnapshot 에 region { id, hash } 를 찍는다. 복구 시 같은 hash 의 컴파일 결과를 다시 만든다 —
                         hash 가 다르면 State 는 복구하지 않는다 (STATE_VERSION 과 같은 규칙, 올린다)
관찰 계약                GameViewSnapshot.region = { id, hash }. 클라이언트는 자기 content/regions 의 같은 Description 을
                         컴파일해 그린다 — hash 가 다르면 "세계와 다른 땅을 보고 있다" 를 HUD 사유 코드로 낸다
지형 본체를 tick 마다 싣지 않는다   30Hz 관찰 결과에 격자를 싣는 것은 이 계약의 것이 아니다. 나중에 세계가 땅을 바꾸는 층이 오면
                         "바뀐 자리" 만 봉투에 더한다 — 지금은 예고만
```

### 3.6 경계 규칙 하나를 더한다

`content/regions/` 는 world 와 view 가 함께 읽어야 한다 (서버는 규칙에, 클라이언트는 그리기에).
지금 규칙 3(컨텐츠를 부르는 것은 조립뿐)은 `content/world` ↔ `content/view` 사이를 막지
않으므로 형식상 이미 가능하지만, **클라이언트가 world 를 import 하지 않는다**는 사실을 지키려면
`regions/` 가 `world/` · `view/` 를 import 하지 않는다는 방향 규칙이 필요하다.

```text
규칙 4   content/regions/** 은 content/world/** · content/view/** 를 import 하지 않는다 (데이터만)
         — engine/world-authoring 의 형만 import 한다
```

`tools/boundary/check.ts` 에 한 줄을 더한다.

## 4. 1단계 범위 — WE §36 에 대응

| WE §36 | 이 저장소 1단계 | 검증 |
|---|---|---|
| ① 공유 Height Field | `height-field.ts` · `CompiledWorldTerrain.height` | seam 0 · 같은 입력 같은 hash |
| ② Corner Height 편집 | **짓지 않는다** (§2.2-3) — stamp/curve 가 편집이다 | — |
| ③ Terrain Chunk 생성 | `CompiledViewTerrain.chunks` · `createTerrain` 교체 | chunkSize 를 바꿔도 세계 hash 불변 |
| ④ Surface 3종 | 규칙 표 3줄 (예: 평지 · 경사 · 급경사) — 이름은 컨텐츠 | top view 에서 세 색 |
| ⑤ 자동 Cliff | 급경사 → surface 태그 + `traversable = 0` | traversability map |
| ⑥ Tree / Rock Instancing | scatter → billboard instancing (sprite 2종) | instance 수 · shot |
| ⑦ Connector | `connector` op → 경계 태그 (Region 간 이동은 없음) | semantic map 에 표시 |
| ⑧ Agent API | `content/regions/*.region.ts` + `world:edit` CLI | op 추가 → compile → hash 변화 |
| ⑨ Observation | `world:observe` (Node PNG) + `world:shot` (playwright) | PNG 4종 + report |

**완료 조건** (WE §36 의 물음 "AI 가 mesh 를 만지지 않고 플레이 가능한 공간을 만드는가" 를
이 저장소의 실측으로):

```text
1. npm run world:compile <id> 를 두 번 돌려 같은 hash · npm test 통과 (결정론 · seam · 경계 규칙 4)
2. 서버(world)와 클라이언트(view)가 같은 Description 에서 같은 높이를 가진다 — 관찰 결과의 hash 일치
3. AI 가 op 만으로 Region 하나를 쓰고 world:observe 로 네 장을 받는다 (Build → Observe 한 바퀴)
4. 관찰자가 그 땅 위를 걸어 area 경계를 넘고, 그 사실이 화면(zone)과 HUD(사유 코드)에서 읽힌다
   — 이것은 2층 Play 와 합류하는 조건이다. 도구만으로는 3 까지다
```

## 5. 로드맵에서의 자리 — 도구 먼저, 세계 다음

2층은 절반이 둘이다. 도구는 명사를 모르므로 세계를 기다리지 않는다.

```text
A. ENGINE 레인  engine/world-authoring · view terrain 교체 · tools/world-editor · 경계 규칙 4
                게임 명사 없이 선다. 자체 검증(vitest · lab · observe PNG) 으로 닫는다.
                Cycle 이 아니다 — Cycle 안에서는 engine/ 을 고치지 않는다는 규칙
                (Design-System-Content-Separation.md)의 반대편, 기구만 세우는 레인이다.
                별도 커밋 · Cycle 번호 없음.
B. 2층 주입     Human 이 세계 사실을 준다 — 세계압은 자연 법칙인가 · 안전권과 깊이 단계 ·
                지역 지도 · 이름 목록 → L2-*.md. A 의 문법(layer · tag · Region · Connector)
                으로 적힐 수 있는 형태면 좋지만, 그 형태를 강요하지 않는다.
C. 2층 Play     B 의 첫 Region 을 A 의 Description 으로 쓴다 → Cycle → "안전권을 나서 깊이가
                달라지는 것을 본다". 높이·경사·area 가 몸에 무엇을 하는가는 여기서 02-world 가
                정한다 — A 는 traversable 격자와 tagsAt 조회까지만 준비한다.
```

A 가 하지 말아야 할 것 — 태그의 뜻을 정하는 것, 이름을 짓는 것, 높이가 몸에 하는 일을
정하는 것. 그 셋이 B · C 의 것이다. A 가 그것을 하면 기반이 컨텐츠를 안 것이 된다.

## 6. 확정 사항

```text
1. content/regions/ 는 world·view 가 함께 읽는 데이터 폴더다. 경계 규칙 4 를 더한다 (§3.6).
2. Region 하나 = 세계 하나. 다중 Region(Region Graph 가 실제 이동이 되는 것)은 이 도구의 것이
   아니다 — 필요해지면 기반 층의 새 행으로 올린다 (관찰자 참여·투영·영속을 건드린다).
3. A 는 traversable 격자와 tagsAt 조회까지만 준비한다. 높이·경사·구역이 몸에 무엇을 하는가는
   2층 Play 의 02-world 가 정한다.
4. 자산은 billboard sprite instancing 으로 시작한다. mesh kit · cliff kit 은 없다.
5. Human UI 는 lab 페이지(top view · op 목록 · 재컴파일) 다. Brush · Spline 은 두지 않는다.
6. 지형 시각화(지면 구역 장치)의 소유는 이 문서 §3 이다 — SceneGroundZone 은 이 문법의 View 쪽
   프리미티브이며 polygon 을 더한다. 별도 지형 시각화 문서는 두지 않는다.
7. 폐기 문서를 인용하던 자리는 출처 표기로만 남는다. 세계 사실(이름·지형·자원)의 정본은 2층
   세계 절반 주입이 다시 준다 — content/roadmap/L2-World-Tool.md §3.
8. "Actor 아닌 존재의 공간 존재"(투사체·장판·함정)는 6층(능력) 주입 때 새 재료로 다시 세운다.
   Skill 문서들이 가리키는 자리는 그대로 둔다.
```

## 7. 하지 않는 것

```text
세계의 사실을 정하는 것          이름 · 세계압 · 안전권 · 깊이 — 2층 주입
WE §37 의 예시 Region 을 짓는 것  거대 악마의 숲은 WE 의 삽화다
Corner Height 편집 도구           §2.2-3
Mesh kit · Cliff kit · LOD        §2.2-6 — sprite 먼저
경로 탐색 · Collision mesh        §2.2-8 — traversable 격자까지
Streaming · 부분 재컴파일          Region 하나가 작은 동안 필요 없다. compiled *.generated.ts 캐시까지
Brush · Spline UI                 §2.2-7
세계가 땅을 바꾸는 것             "머물면 발밑의 땅이 열린다" 같은 것은 땅이 State 가 되는 층의 일이다 — 이 도구는 정적 땅을 만든다
```
