# AI World Editor + Terrain Compiler 기반 월드 제작 시스템 설계

| 항목 | 내용 |
|---|---|
| **상태** | 주입 원문 (Human) — 로드맵 2층의 **도구** 재료 |
| **약칭** | WE |
| **적용 검토** | [Plan-World-Authoring-Engine.md](Plan-World-Authoring-Engine.md) — 이 문서를 이 저장소의 engine/content 위에 어떻게 세우는가 |
| **범위** | 세계 제작 **도구**(World Editor · Terrain Compiler · Agent/Observation API). 세계 자체(세계압·안전권·지역 지도·이름 목록)는 이 문서의 것이 아니다 — 2층 주입이 따로 준다 |

> Human 이 채팅으로 준 원문이다. 절 번호와 본문은 그대로이고, 절 제목에 markdown 표제 기호만 붙였다.

---

## 1. 목적

본 시스템의 목적은 웹 기반 오픈월드 MMORPG의 거대한 세계를 사람이 직접 수작업으로 제작하지 않고, AI Agent가 제한된 World Editor 명령을 사용하여 생성·관찰·수정할 수 있도록 하는 것이다.
세계는 논리적으로 여러 `Region`이 연결된 구조를 가진다.

```text
WORLD

[백왕령]
    │
[거대 악마의 숲] ─ [붉은 황야]
    │
[얼음 협곡]
```

각 Region은 하나의 작은 타일이나 던전이 아니라 플레이어가 자유롭게 이동하는 독립적인 오픈월드 영역이다.
Region 내부의 실제 지형은 수작업으로 완성된 3D 맵을 배치하지 않는다.
대신:
Terrain Description → Terrain Compiler → 실제 3D World
구조를 사용한다.
AI는 최종 Mesh를 만들지 않는다.
AI는 세계의 의미와 구성을 결정하고 Compiler가 그것을 실제 지형으로 변환한다.

## 2. 전체 구조

```text
                         WORLD
                           │
                    World Region Graph
                           │
              ┌────────────┼────────────┐
              │            │            │
           Region A     Region B     Region C
              │
              ↓
        Region Description
              │
    ┌─────────┼──────────┐
    │         │          │
 Terrain   Features    Gameplay
    │         │          │
    └─────────┼──────────┘
              ↓
       Terrain Compiler
              │
       ┌──────┴──────┐
       │             │
    WORLD DATA     VIEW DATA
       │             │
 Collision        Ground Mesh
 Navigation       Cliff
 Semantic         Materials
 Connection       Props
 Height Query     VFX
                     │
                     ↓
                Terrain Chunks
```

핵심적으로 다음 두 단위를 분리한다.

```text
Region
= AI / 기획 / Gameplay 제작 단위

Terrain Chunk
= Rendering / Streaming / Compiler 구현 단위
```

AI가 수백 개 Terrain Chunk를 직접 작성해서는 안 된다.

## 3. World Region

`Region`은 세계를 구성하는 가장 중요한 제작 단위다.
예:

```text
Giant Demon Forest
거대 악마의 숲
```

하나의 Region은 다음 요소를 가진다.

```text
Region

├─ Identity
├─ Terrain
├─ Biome
├─ Features
├─ Landmark
├─ POI
├─ Connector
├─ Gameplay Semantic
└─ Seed
```

예:

```text
거대 악마의 숲

Identity
→ 거대한 생물들의 먹이사슬이 지배하는 숲

Terrain
→ 중앙 분지
→ 북쪽 산맥
→ 서쪽 협곡

Biome
→ Giant Forest
→ Wet Root
→ Dead Forest

Landmark
→ 붉은 눈의 거목

POI
→ 탐험대 폐허
→ 포식수 둥지
→ 생체 광석 지대

Connector
→ 백왕령
→ 얼음 협곡
→ 붉은 황야
```

## 4. Terrain Chunk

Region 내부는 Runtime에서 여러 Terrain Chunk로 나눈다.
예:

```text
Region

┌────┬────┬────┬────┐
│ C1 │ C2 │ C3 │ C4 │
├────┼────┼────┼────┤
│ C5 │ C6 │ C7 │ C8 │
├────┼────┼────┼────┤
│ C9 │C10 │C11 │C12 │
└────┴────┴────┴────┘
```

Chunk는 다음을 위한 내부 구현 단위다.

```text
Rendering
Streaming
LOD
Collision
Navigation
Compile Cache
```

Chunk 크기는 설계 데이터에서 제거한다.
예:

```ts
chunkSize = 32;
```

또는

```ts
chunkSize = 64;
```

로 변경해도 Region Description에는 영향을 주지 않아야 한다.
따라서:
`16m × 16m Cell`은 세계 설계 규칙이 아니라 Runtime 설정이다.

## 5. World Editor

World Editor는 사람이 사용하는 UI와 AI가 사용하는 API를 동시에 제공한다.

```text
                 World Editor Core
                         │
             ┌───────────┴───────────┐
             │                       │
          Human UI                Agent API
             │                       │
             └───────────┬───────────┘
                         ↓
                 Region Description
```

사람과 AI는 동일한 World Editor Core를 사용한다.
사람:

```text
Brush
Spline
Drag
Drop
Transform
```

AI:

```text
applyTerrainStamp()
createRiver()
paintBiome()
placeLandmark()
```

## 6. World Editor Primitive

Editor의 기본 조작 문법을 네 종류로 제한한다.

### 6.1 Point

하나의 위치를 가지는 요소다.

```text
Landmark
Cave Entrance
Ruin
Building
Giant Tree
Monster Nest
```

예:

```text
placeLandmark(
    asset=GiantRedEyeTree,
    position=[310,280]
)
```

### 6.2 Curve

경로를 가지는 요소다.

```text
Road
Trail
River
Cliff
Ridge
Wall
```

예:

```text
createRiver(
    points=[
        [100,500],
        [170,420],
        [240,330],
        [300,100]
    ]
)
```

Compiler가 Curve를 기반으로 필요한 월드 요소를 생성한다.

```text
River Curve

↓ Compiler

Terrain Carve
Water
River Bank
Wet Surface
Vegetation Rule
Navigation
```

### 6.3 Area

넓은 영역에 의미를 부여한다.

```text
Biome
Swamp
Lake
Danger
Resource
Safe
Spawn
NoSpawn
```

예:

```text
paintBiome(
    polygon=[...],
    biome=GiantForest
)
```

### 6.4 Field / Stamp

지형 자체를 변형하는 요소다.

```text
Hill
Mountain
Ridge
Basin
Crater
Plateau
Valley
```

예:

```text
applyTerrainStamp(
    type=Ridge,
    center=[180,420],
    radius=150,
    height=60
)
```

## 7. Terrain Shape

Terrain의 높이를 몇 가지 완성된 Terrain Model로 표현하지 않는다.
전체 Region에는 연속적인 Height Field가 존재한다.
개념적으로:

```text
Terrain Height

Base Height
    +
Large Scale Shape
    +
Terrain Stamp
    +
Curve Modifier
    +
Local Detail
```

Compiler는 최종적으로 다음 함수를 계산한다.

```text
height(x,z)
```

Terrain Chunk는 이 Field를 필요한 해상도로 Sampling한다.

## 8. Corner Height

초기 프로토타입에서는 Corner Height 방식을 사용할 수 있다.

```text
0────0
│    │
│    │
1────1
```

장점:

```text
구현 단순
편집 단순
AI 제어 단순
```

그러나 Corner Height는 최종 Terrain 데이터 모델이 아니다.
다음과 같은 지형을 표현할 수 없기 때문이다.

```text
0────────0
│   /\   │
│  /  \  │
0────────0
```

따라서 Corner Height는:
Height Field를 편집하는 초기 Editor Tool
중 하나로 취급한다.

## 9. Terrain Data Ownership

인접 Chunk가 각각 별도의 Corner Height를 소유해서는 안 된다.
잘못된 구조:

```text
Chunk A Edge = H1
Chunk B Edge = H2
```

같은 위치에 두 개의 값이 존재하게 된다.
대신 전체 Terrain Field 또는 공유 Vertex Grid가 높이의 Source of Truth가 된다.

```text
●────●────●
│    │    │
●────●────●
│    │    │
●────●────●
```

Chunk는 이 값을 참조하여 자신의 Mesh를 만든다.
이를 통해 Terrain Seam을 구조적으로 방지한다.

## 10. Terrain Layer

Terrain을 완성된 Tile 조합으로 만들지 않는다.
다음 Layer를 분리한다.

```text
Terrain

├─ Shape
├─ Surface
├─ Feature
├─ Biome
├─ Decoration
└─ Gameplay
```

## 11. Shape

실제 지형의 형태다.

```text
Height
Slope
Mountain
Valley
Basin
Cliff
```

Height Field와 Terrain Stamp로 표현한다.

## 12. Surface

실제 지표의 표현이다.

```text
Grass
Dirt
Rock
Mud
Snow
Sand
Ash
Moss
```

가능한 경우 직접 Painting보다 Rule을 사용한다.
예:

```text
Steep Slope
→ Rock

Low Temperature
→ Snow

Flat + Moist
→ Moss / Grass
```

## 13. Feature

지형에 존재하는 중요한 공간 구조다.

```text
Road
River
Cliff
Lake
Cave
Ruin
Bridge
Root
```

Feature는 Point / Curve / Area Primitive를 사용한다.
Feature를 완성형 Terrain Tile로 만들지 않는다.

## 14. Biome

Biome은 Surface가 아니다.
Biome은 여러 World Layer에 영향을 주는 Rule Set이다.
예:

```yaml
GiantForest:

  Surface:
    - DarkSoil
    - Moss

  Vegetation:
    - GiantTree
    - Fern
    - Mushroom

  Rock:
    - MossRock

  Atmosphere:
    Fog: DarkGreen
    Particle: Spore

  TerrainPreference:
    Moisture: High

  Decoration:
    RootsNearTree: true

  Gameplay:
    PredatorSpawn: High
```

따라서:

```text
paintBiome(GiantForest)
```

를 실행하면 단순히 Texture가 변경되는 것이 아니다.

```text
Surface
Vegetation
Decoration
Atmosphere
Spawn Rule
```

이 함께 영향을 받는다.

## 15. Decoration

작은 자연물과 장식은 AI가 직접 배치하지 않는다.
예:

```text
Tree
Rock
Grass
Bush
Flower
Mushroom
Small Root
Debris
```

Procedural Rule이 자동 배치한다.

## 16. Seed

각 Region에는 Seed가 존재한다.

```ts
seed = 183721;
```

Seed의 목적은 자연스러움을 만드는 것이 아니다.
Seed는:
동일한 World Description으로 동일한 결과를 재현하기 위한 결정론적 키
이다.
실제 자연스러움은 Placement Rule이 만든다.

```text
Placement Rule
        +
      Seed
        ↓
Deterministic Variation
```

예를 들어 나무 배치는 다음을 고려한다.

```text
Density
Minimum Distance
Cluster
Slope
Moisture
Distance From Road
Distance From Water
Biome
Species Relationship
```

그 결과를 Seed가 결정론적으로 고정한다.

## 17. Asset Kit

실제 제작해야 하는 Asset은 완성된 Terrain Tile이 아니다.
잘못된 예:

```text
forest_flat.glb
forest_slope.glb
forest_river.glb
forest_river_slope.glb
snow_forest_river.glb
```

이 방식은 조합 폭발을 발생시킨다.
대신 재사용 가능한 Asset Kit을 만든다.

```text
assets/

terrain/
    cliff/
    profiles/

vegetation/
    tree/
    bush/
    grass/

rocks/

landmarks/

poi/

structures/

decals/

vfx/
```

## 18. Tree Kit

예:

```text
TreeKit_GiantForest

Tree_A
Tree_B
Tree_C
Tree_Dead_A

Trunk_A
Trunk_B

Root_A
Root_B
Root_C

Branch_A
Branch_B
```

대규모 배치를 위해 동일 Asset은 GPU Instancing을 사용한다.
권장 표현 방식:

```text
Near
→ Mesh

Middle
→ Simple Mesh / Cross Billboard

Far
→ Billboard / Impostor
```

## 19. Rock Kit

```text
RockKit_Moss

Small_A
Small_B

Medium_A
Medium_B

Large_A
Large_B
```

Rock 역시 Biome Rule에 의해 배치한다.

## 20. Cliff

초기 구현에서는 Modular Cliff Kit을 사용할 수 있다.

```text
Straight
Inner Corner
Outer Corner
End
Large
```

하지만 장기적으로는:

```text
Cliff Curve
    +
Cliff Profile
    +
Material
    +
Rock Decoration
```

구조를 권장한다.

```text
────────────── Cliff Curve

        ↓ Compiler

████████████████
████████████████
```

따라서 Cliff 표현 방식은 Terrain Description과 분리된다.

## 21. Landmark

Landmark는 Procedural Scatter 대상이 아니다.
AI가 의미를 가지고 직접 배치한다.
예:

```text
Giant Red Eye Tree
Titan Skeleton
Floating Mountain
World Root
Frozen Tower
```

각 Region은 보통 1~3개의 핵심 Landmark를 가진다.
Landmark의 역할:

```text
지역 정체성
방향 인식
탐험 유도
스토리
원거리 Silhouette
```

## 22. POI

POI는 작은 완성형 Gameplay Prefab이다.
예:

```text
Explorer Camp
Monster Nest
Ancient Ruin
Mine
Shrine
Village
Cave Entrance
```

예:

```text
POI_AbandonedCamp

Tent
Campfire
Broken Cart
Box
Bones

Spawn Point
Loot Point
Interaction Point
```

Variant를 지원한다.

```text
Size
Damage
Vegetation
Biome
Population
State
```

## 23. Connector

이전의 모든 Cell Edge를 Socket으로 연결하는 방식은 사용하지 않는다.
높이와 Biome의 연속성은 Terrain Field가 처리한다.
Connector는 게임적으로 의미 있는 연결에만 사용한다.
예:

```text
Road
River
Trail
Mountain Pass
Cave
Bridge
World Region Connection
```

예:

```ts
{
  type: "river",
  border: "north",

  offset: 0.63,
  width: 7.5,
  elevation: 2.1,
  direction: 18,
  flow: "out"
}
```

Region 간 연결 역시 Connector로 표현한다.

```text
거대 악마의 숲
       │
 Mountain Pass
       │
   얼음 협곡
```

## 24. World Graph와 Connector

세계 전체는 Region Graph로 관리한다.

```text
White Kingdom
      │
      │ Forest Path
      ↓
Giant Demon Forest
      │
      │ Frozen Pass
      ↓
Ice Canyon
```

Region Graph는 세계의 논리적 연결이다.
Terrain Compiler는 이 정보를 실제 지형 경계로 변환한다.

## 25. Gameplay Semantic Layer

Terrain의 시각적 형태와 별개로 Gameplay 의미가 존재한다.
기본 Semantic:

```text
PATH

BLOCKER

SAFE
DANGER

RESOURCE

SPAWN
NO_SPAWN

POI
LANDMARK

CONNECTION
```

예:

```text
[DANGER]
거대 포식자 영역

[RESOURCE]
생체 광석

[PATH]
안전한 우회로
```

Semantic은 World Data이며 Rendering Asset과 분리한다.

## 26. Asset Catalog

AI가 Asset을 의미로 찾을 수 있어야 한다.
잘못된 예:

```text
rock_043.glb
tree_182.glb
```

권장:

```yaml
id: ROCK_MOSS_LARGE_03

Category:
  Rock

Biome:
  - Forest
  - Swamp

Size:
  2m-5m

Tags:
  - Moss
  - Wet
  - Dark

Placement:
  Slope: 0-45
  NearWater: Preferred

Navigation:
  BlocksMovement: true
```

AI 요청:

```text
습한 숲에 배치할
3~5m 크기의
이동을 방해하는 바위
```

Catalog:

```text
→ ROCK_MOSS_LARGE_03
```

## 27. Terrain Compiler

Terrain Compiler는 Region Description을 실제 World로 변환한다.

```text
Region Description

Terrain
Biome
Feature
Landmark
Gameplay
Seed

        ↓

Terrain Compiler
```

Compiler 작업:

```text
Height Field 계산

Terrain Chunk 생성

Surface 결정

Cliff 생성

River / Road 생성

Vegetation Scatter

Rock Scatter

POI 생성

Collision 생성

Navigation 생성

Semantic Map 생성
```

## 28. World / View 분리

Terrain Compiler가 Three.js Mesh만 생성해서는 안 된다.
동일한 Region Description에서 World와 View 데이터를 모두 만들어야 한다.

```text
                Region Description
                        │
                Terrain Compiler
                        │
             ┌──────────┴──────────┐
             │                     │
         WORLD DATA             VIEW DATA
             │                     │
       Height Query            Ground Mesh
       Traversability          Cliff Mesh
       Collision               Materials
       Semantic Area           Props
       Region                  VFX
       Connector
```

World는 게임 규칙을 담당한다.
View는 표현만 담당한다.

## 29. Compile과 Runtime

Editor 개발 단계에서는 수정 즉시 Compile한다.

```text
Agent Edit
   ↓
Compile
   ↓
Render
   ↓
Observe
```

하지만 Production에서는 모든 Chunk를 매번 브라우저에서 처음부터 계산하지 않는다.

```text
Region Description
        ↓
Terrain Compiler
        ↓
Compiled Chunk
        ↓
Cache
        ↓
Runtime Streaming
```

Compiled Chunk 예:

```text
Chunk_31_18

Render Mesh
Collision
Prop Instances
Semantic
Navigation
```

변경된 Chunk만 다시 Compile할 수 있어야 한다.

## 30. Agent API

AI가 조작해야 하는 핵심 API는 작게 유지한다.

```text
createRegion()

applyTerrainStamp()

sculptTerrain()

paintSurface()

paintBiome()

createCurve()

createRoad()

createRiver()

createCliff()

createArea()

placeAsset()

placePOI()

placeLandmark()

placeConnector()

paintDangerArea()

paintResourceArea()

paintSpawnArea()

move()

rotate()

scale()

erase()
```

AI는 내부 Vertex나 Triangle을 조작하지 않는다.

## 31. Observation API

AI가 자신이 만든 결과를 확인할 수 있어야 한다.

```text
captureWorldImage()

captureTopView()

getHeightMap()

getNavigationMap()

getSemanticMap()

getVisibleLandmarks()

getAssetList()

getPerformanceReport()
```

Agent 작업 방식:

```text
Design
  ↓
Build
  ↓
Observe
  ↓
Evaluate
  ↓
Modify
  ↓
Observe
```

## 32. AI Region 제작 순서

AI는 Terrain을 먼저 무작정 생성하지 않는다.
반드시 Gameplay에서 Terrain으로 내려간다.

Step 1 — Region Identity

```text
거대한 생물들의 먹이사슬 속에서
작은 존재가 살아남으며 탐험하는 숲
```

Step 2 — 외부 Connector

```text
South
→ 백왕령

North
→ 얼음 협곡

East
→ 붉은 황야
```

Step 3 — Landmark

```text
Giant Red Eye Tree

Titan Skeleton
```

Step 4 — 주요 Gameplay 구조

```text
주 진입로

위험 지대

우회로

자원 지역

POI
```

Step 5 — Path / River / Major Curve
Region의 주요 이동 구조를 만든다.

Step 6 — Terrain
Gameplay 구조를 지원하도록 Terrain을 만든다.

```text
Central Basin

North Ridge

West Canyon
```

Step 7 — Biome

```text
Giant Forest

Wet Root

Dead Forest
```

Step 8 — POI

```text
Explorer Ruin

Predator Nest

Bio Crystal Field
```

Step 9 — Procedural Decoration

```text
Tree

Rock

Vegetation

Decal

Small Props
```

Step 10 — Semantic

```text
Danger

Resource

Spawn

Safe

Path

Connection
```

Step 11 — Verification
AI가 실제 결과를 관찰하고 필요한 부분을 수정한다.

## 33. WFC / Wang Tile의 역할

WFC를 World Layout의 핵심 Generator로 사용하지 않는다.
WFC는 다음 용도에 사용할 수 있다.

```text
작은 Rock Formation

폐허 내부 조립

숲 세부 Variation

Decoration

작은 구조물
```

전체 공간 구조는:

```text
AI Design
   ↓
Terrain Structure
   ↓
Procedural Detail / WFC
```

순서로 만든다.
반대로:

```text
WFC
↓
Random World
↓
Gameplay 의미 부여
```

방식은 사용하지 않는다.

## 34. Asset 제작 Pipeline

World Agent가 Asset을 직접 모델링하지 않는다.
새 Asset이 필요한 경우:

```text
World Agent

"붉은 눈의 거대한 고목이 필요하다."
        ↓
Asset Requirement
        ↓
Asset 제작
        ↓
Mesh / Billboard
        ↓
Material
        ↓
Collision
        ↓
LOD / Impostor
        ↓
Prefab
        ↓
Catalog 등록
```

한 번 만들어진 Asset은 모든 Region에서 재사용 가능하다.

## 35. 초기 Asset 세트

최초 Prototype에서는 과도한 Asset을 만들지 않는다.

```text
Terrain Stamp
10~20

Surface
6~10

Tree Kit
1

Rock Kit
1

Vegetation Kit
1

Cliff Kit
1

POI
5

Landmark
3

Connector
5

Decal / VFX
소수
```

## 36. 최소 Terrain Prototype

전체 시스템을 처음부터 만들지 않는다.
첫 구현 단계에서는:

```text
① 공유 Height Field

② Corner Height 편집

③ Terrain Chunk 생성

④ Surface 3종

⑤ 자동 Cliff

⑥ Tree / Rock Instancing

⑦ Connector

⑧ Agent API

⑨ Observation
```

까지만 구현한다.
이 단계에서 확인해야 할 것은:
AI Agent가 지형 Mesh를 직접 다루지 않고도 하나의 플레이 가능한 공간을 만들 수 있는가?
이다.

## 37. 첫 Region 검증

검증 대상:

```text
거대 악마의 숲
```

최소 구성:

```text
Terrain
→ Basin
→ Ridge
→ Canyon

Biome
→ Giant Forest

Landmark
→ Giant Red Eye Tree

POI
→ Explorer Camp
→ Predator Nest

Connector
→ White Kingdom
→ Ice Canyon

Gameplay
→ Main Path
→ Danger
→ Resource
```

AI가:

```text
Build
→ Capture
→ Evaluate
→ Modify
```

Loop를 통해 Human의 직접 Terrain 편집 없이 Region을 완성할 수 있는지 확인한다.

## 38. 최종 핵심 구조

```text
                        WORLD
                          │
                  World Region Graph
                          │
                        REGION
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
     Terrain           Gameplay          Assets
        │                 │                 │
 Height Field        Semantic          Catalog
 Stamp               Path
 Curve               Danger
 Area                Resource
        │                 │
        └────────────┬────┘
                     ↓
              Region Description
                     │
                     ↓
              Terrain Compiler
                     │
          ┌──────────┴──────────┐
          │                     │
      WORLD DATA             VIEW DATA
          │                     │
     Collision              Mesh
     Navigation             Material
     Semantic               Instances
     Height                 VFX
          │                     │
          └──────────┬──────────┘
                     ↓
              Terrain Chunks
                     │
                  Runtime
```

## 39. 최종 원칙

1. Region은 제작 단위다.

```text
거대 악마의 숲
얼음 협곡
붉은 황야
```

를 AI가 만든다.

2. Terrain Chunk는 구현 단위다.
AI가 Chunk를 일일이 설계하지 않는다.
Compiler가 생성한다.

3. AI는 Mesh를 만들지 않는다.
AI는:

```text
Point
Curve
Area
Field
```

를 편집한다.

4. Terrain은 완성형 Tile Asset이 아니다.

```text
Shape
Surface
Feature
Biome
Decoration
Gameplay
```

의 합성 결과다.

5. Asset은 재사용 가능한 LEGO다.

```text
Tree Kit
Rock Kit
Landmark
POI
Cliff
Structure
```

를 반복 사용한다.

6. Compiler가 LEGO를 실제 World로 만든다.

```text
Description
↓
Compiler
↓
World
```

7. AI Agent의 핵심 능력은 반복 수정이다.

```text
Build
↓
Observe
↓
Evaluate
↓
Modify
```

## 40. 한 문장 정의

본 시스템은 AI Agent가 Region 수준의 의미 있는 세계 구조를 Point·Curve·Area·Field라는 작은 편집 문법으로 작성하고, Terrain Compiler가 이를 재사용 가능한 Asset Kit과 결합하여 스트리밍 가능한 3D 오픈월드로 컴파일하는 AI 기반 MMORPG World Editor 시스템이다.
이 구조에서 `Region Description`이 세계 제작의 Source of Truth이며, Terrain Chunk와 실제 Three.js Mesh는 언제든 다시 생성 가능한 파생 결과물이다.
