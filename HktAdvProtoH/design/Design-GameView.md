# Design-GameView.md

GameView Architecture Design

## 1. 목적

GameView는 `Observable World State`를 사람이 게임 형태로 관찰할 수 있도록 표현하는 Runtime이다.

GameView 자체는 World의 의미를 구현하지 않는다.

즉 GameView는 다음을 알지 않는다.

* Mining이 무엇인지
* Attack이 무엇인지
* HP가 무엇인지
* Knowledge가 무엇인지
* Goal이 무엇인지
* Possibility가 무엇인지

GameView가 아는 것은 다음과 같은 시각 표현 언어뿐이다.

* 3D 공간
* Terrain
* Position / Rotation / Scale
* Sprite Billboard
* Primitive Shape
* Text
* Line
* Group
* Animation
* Effect

World의 의미를 이 시각 언어로 어떻게 표현할지는 각 Implementation Cycle의 `View Definition`에서 결정한다.

## 2. 기본 원칙

전체 구조는 다음과 같다.

```text
Goal / Possibility
        ↓
      Intent
        ↓
World State / Rule
        ↓
Observable World State
        ↓
   View Definition
        ↓
 GameView Runtime
        ↓
 Human Observation

```

GameView는 반드시 `ObservableWorldState`만 사용한다.

```text
World Internal State
        │
        X
        │
     GameView


ObservableWorldState
        │
        ▼
     GameView

```

따라서 GameView 내부에서 World Rule을 다시 판단해서는 안 된다.

예를 들어 다음은 허용하지 않는다.

```text
if distance(actor, target) < attackRange:
    playAttack()

```

Attack 가능 여부는 World가 판단해야 한다.

GameView는 이미 발생한 Observable Transition을 받아:

```text
RULE-ATTACK executed
Actor A
Target B

```

를 시각적으로 표현할 뿐이다.

## 3. 초기 Rendering Model

초기 Web GameView의 표현 방식은 다음으로 고정한다.

```text
3D Terrain
    +
2D Sprite Billboard

```

화면 구조:

```text
                 Camera
                   │
                   ▼

       [2D Billboard Character]
                  ▓▓
                  ▓▓
                   │
                   │ World Position
                   ▼

        ┌───────────────────────┐
       /                         \
      /        3D Terrain         \
     /                             \
    └───────────────────────────────┘

```

즉:

* 공간은 3D
* Terrain은 3D Mesh
* Actor / Item / Resource 등의 주요 표현은 2D Sprite
* Sprite는 3D World Position에 배치
* Sprite는 Camera를 바라보는 Billboard 방식으로 표현

한다.

초기 목표는 완전한 3D 게임을 만드는 것이 아니다.

World의 공간 관계를 3D로 관찰하면서 Entity를 명확하고 저렴하게 표현하는 것이 목적이다.

## 4. GameView의 Layer 구조

GameView는 네 계층으로 나눈다.

```text
┌─────────────────────────────────────┐
│          View Definition            │
│ World Semantic → Visual Binding     │
└──────────────────┬──────────────────┘
                   ▼
┌─────────────────────────────────────┐
│          Visual Library             │
│ Character / Marker / Bar / Effect   │
└──────────────────┬──────────────────┘
                   ▼
┌─────────────────────────────────────┐
│        Visual Primitive API         │
│ Terrain / Billboard / Shape / Line  │
└──────────────────┬──────────────────┘
                   ▼
┌─────────────────────────────────────┐
│          Rendering Backend          │
│           WebGL Renderer            │
└─────────────────────────────────────┘

```

각 Layer의 변화 속도는 달라야 한다.

```text
Rendering Backend     거의 변경 없음
Primitive API         매우 느리게 확장
Visual Library        Cycle에 따라 성장
View Definition       Cycle마다 생성/변경

```

## 5. GameView Core

GameView Core는 World Semantic과 무관한 일반적인 Rendering 기능만 제공한다.

초기 Core는 다음 capability를 가진다.

### 5.1 Scene

```text
Scene
Camera
World Transform
Render Layer
Visibility
Depth

```

### 5.2 Terrain

```text
Terrain
Grid
Plane
Height Surface

```

초기에는 Terrain 표현을 단순하게 유지한다.

예:

```text
Terrain {
    surface
    material
    position
    scale
}

```

Terrain에 의미를 부여하지 않는다.

GameView는 이것이:

* 숲인지
* 광산인지
* 마을인지
* 위험 지역인지

알 필요가 없다.

## 6. Terrain의 Semantic 규칙

Terrain에 대해서는 중요한 구분이 필요하다.

Case A — 단순 시각적 Terrain

Terrain 모양이 World Rule에 영향을 주지 않는다면 View Resource로 존재할 수 있다.

```text
World
Actor.Position

View
TerrainAsset

```

Case B — Terrain이 World 판단에 영향을 줌

예:

```text
Elevation
Walkable
Water
Cliff
Road
MovementCost

```

등이 Rule 판단에 사용된다면 이것은 단순 View 데이터가 아니다.

```text
World Semantic State
        ↓
Observable Terrain State
        ↓
View Definition
        ↓
Terrain Renderer

```

가 되어야 한다.

원칙은 다음과 같다.

World 판단에 영향을 주는 Terrain 정보는 반드시 Observable World State에서 유래해야 한다.

## 7. Billboard Primitive

초기 Entity 표현의 핵심 primitive는 `Billboard`다.

```text
Billboard {
    position
    size
    anchor
    sprite
    facing
    opacity
    layer
    visible
}

```

기본적으로:

```text
facing = camera

```

를 지원한다.

따라서 Actor의 회전과 관계없이 Sprite 자체는 읽기 쉽게 Camera를 향할 수 있다.

필요하다면 별도의 semantic direction을 sprite frame이나 marker로 표현한다.

## 8. Billboard와 World Position

Actor의 World State:

```text
Actor.Position
    x
    y
    z

```

Observable:

```text
Actor.Position = (10, 2, 24)

```

View Definition:

```text
CharacterBillboard {
    position = Actor.Position
}

```

GameView Runtime:

```text
World Position
        ↓
3D Scene Transform
        ↓
Billboard Position

```

GameView는 `Actor.Position`이라는 의미를 이해하지 않는다.

View Definition이 해당 값을 Billboard의 `position` parameter에 연결한다.

## 9. 초기 Primitive Vocabulary

첫 버전에서는 최대한 작은 vocabulary를 제공한다.

### 9.1 3D Primitive

```text
Terrain
Plane
Box
Line3D
Point

```

### 9.2 2D / Billboard Primitive

```text
SpriteBillboard
TextBillboard
IconBillboard

Circle
Rectangle
Triangle
Polygon
Line2D
Text

```

2D Primitive 역시 Billboard 공간 내부에서 사용할 수 있다.

예:

```text
BillboardGroup
 ├ Character Sprite
 ├ Rectangle
 ├ Rectangle
 └ Text

```

이를 이용하면 별도의 HP Bar 기능 없이도 Bar 표현이 가능하다.

## 10. Composition

Primitive는 조합할 수 있어야 한다.

```text
Group
Attach
Parent / Child
Offset
Anchor
Layer

```

예:

```text
CharacterVisual

Group
 ├ SpriteBillboard
 │
 ├ NameLabel
 │
 └ StatusArea

```

World Semantic과 시각 요소 간 결합은 Group 내부가 아니라 View Definition이 담당한다.

## 11. Visual Library

Cycle이 진행됨에 따라 늘어나야 하는 것은 GameView Core가 아니라 `Visual Library`다.

초기:

```text
Visual Library

CharacterBillboard
ResourceBillboard
NameLabel
ValueBar
SelectionMarker

```

이후 자연스럽게:

```text
Visual Library

Entity
 ├ CharacterBillboard
 ├ ResourceMarker
 ├ ItemMarker
 └ BuildingMarker

Status
 ├ ValueBar
 ├ ProgressBar
 ├ StatusIcon
 └ FloatingText

Spatial
 ├ SelectionRing
 ├ RangeIndicator
 ├ TargetLine
 ├ PathIndicator
 └ AreaMarker

Effects
 ├ Pulse
 ├ Flash
 ├ Shake
 ├ Fade
 ├ FloatingValue
 └ TransferEffect

```

로 성장한다.

## 12. Visual Component는 Semantic을 몰라야 한다

예를 들어 `HPBar`라는 Component보다 `ValueBar`를 사용한다.

```text
ValueBar {
    value
    max
}

```

Combat Cycle:

```text
ValueBar.value = Actor.HP
ValueBar.max   = Actor.MaxHP

```

Mining Cycle:

```text
ValueBar.value = Deposit.ResourceAmount
ValueBar.max   = Deposit.ResourceCapacity

```

Tool Cycle:

```text
ValueBar.value = Tool.Durability
ValueBar.max   = Tool.MaxDurability

```

동일한 시각 vocabulary를 재사용한다.

따라서 Visual Library에는 가급적:

```text
HPBar
MiningProgress
PoisonMarker
AttackAnimation

```

같은 World-specific 이름을 넣지 않는다.

대신:

```text
ValueBar
ProgressIndicator
StatusMarker
ImpactEffect

```

처럼 일반화한다.

## 13. Character 표현

초기 Character 역시 GameView Core의 특별한 World 개념으로 만들지 않는다.

Visual Library의 Composite Component로 만든다.

```text
CharacterBillboard

BillboardGroup
 ├ Sprite
 ├ ShadowMarker
 ├ DirectionMarker
 └ LabelAnchor

```

처음에는 단순 placeholder를 사용할 수 있다.

```text
CharacterBillboard v0

Circle
+
Triangle Direction Marker

```

이후:

```text
CharacterBillboard v1

2D Sprite
+
Direction Marker

```

로 바꿀 수 있다.

World State나 Observable Contract는 바뀌지 않는다.

## 14. View Definition

Implementation Cycle이 GameView를 사용하는 핵심 artifact다.

예를 들어 Mining Cycle:

```text
VIEW WORLD-MINING-001

ActorVisual {
    component = CharacterBillboard

    position = Actor.Position
    sprite   = VisualCatalog.Actor.Default
}

DepositVisual {
    component = ResourceMarker

    position = Deposit.Position
}

DepositAmount {
    component = ValueBar

    attach = DepositVisual

    value = Deposit.ResourceAmount
    max   = Deposit.ResourceCapacity
}

```

중요한 것은:

```text
Position이 추가되었다
        ↓
GameView 코드 변경

```

이 아니라

```text
Position이 Observable해졌다
        ↓
View Definition에서
position parameter에 binding

```

하는 것이다.

## 15. Visual Asset Catalog

Sprite와 같은 실제 asset은 World State와 분리한다.

```text
Visual Catalog

Actor.Default
Actor.Warrior
Actor.Merchant

Resource.Stone
Resource.Wood

Item.Pickaxe

```

View Definition에서:

```text
Actor.Type
    ↓
Visual Mapping
    ↓
Actor.Warrior

```

와 같이 연결할 수 있다.

중요한 점은 `warrior.png` 같은 asset 경로가 World State에 들어가지 않는 것이다.

World는:

```text
Actor.Type = Warrior

```

같은 의미만 알고,

View 쪽에서 적절한 표현 asset을 선택한다.

## 16. Camera

Camera 역시 GameView Runtime capability다.

초기에는 다음 정도만 제공한다.

```text
Camera
    position
    target
    zoom
    orbit

```

기본 Viewer는:

```text
Perspective / Isometric-like Camera

```

형태로 두고 사람이 Runtime World를 관찰하는 데 집중한다.

초기 단계에서는 Camera movement 자체를 World Semantic으로 취급하지 않는다.

즉 Viewer가 자유롭게:

```text
rotate
zoom
pan

```

할 수 있다.

이것은 세계 상태를 변경하지 않는다.

## 17. World Space와 Screen Space

표현은 두 공간으로 구분한다.

World Space

World의 위치 관계를 보여주는 것.

```text
Terrain
Character
Resource
Range
Path
Target
Effect

```

Screen Space

관찰 도구로 사용하는 것.

```text
Current Goal
Selected Possibility
Current Rule
Transition
Inspector
Timeline

```

구조:

```text
┌─────────────────────────────────────┐
│ Goal: AcquireStone                  │
│ Possibility: MineStone              │
│ Rule: RULE-MINE-001                 │
├─────────────────────────────────────┤
│                                     │
│           3D World View             │
│                                     │
│       Actor ▓        ◆ Deposit      │
│                                     │
│                                     │
├─────────────────────────────────────┤
│ Transition #1742                    │
│ Stone 0 → 1                         │
│ Deposit 100 → 99                    │
└─────────────────────────────────────┘

```

Game 화면과 Semantic Debug 정보는 같은 ObservableWorldState를 사용한다.

## 18. Transition Visual Language

State뿐 아니라 Transition도 표현한다.

GameView Core에는 World-specific animation 대신 범용 animation vocabulary를 제공한다.

```text
move
rotate
scale
fade
pulse
flash
shake
spawn
despawn
wait

sequence
parallel
repeat

```

예를 들어 Mining Cycle은 다음과 같이 표현할 수 있다.

```text
ON RULE-MINE-001

sequence {

    rotateToward(
        ActorVisual,
        DepositVisual
    )

    repeat 2 {
        moveOffset(ActorVisual, +small)
        moveOffset(ActorVisual, -small)
    }

    pulse(DepositVisual)

    floatingText(
        ActorVisual,
        "+1 Stone"
    )
}

```

GameView는 `Mine`의 의미를 이해하지 않는다.

`RULE-MINE-001`에 어떤 Visual Sequence를 연결할지는 Cycle의 View Definition이 결정한다.

## 19. Cycle이 확장될 때 Visual 표현 확장 규칙

새로운 Cycle에서 새로운 표현이 필요할 경우 반드시 다음 순서로 해결한다.

```text
Visual Requirement
        ↓
① 기존 Visual Component로 가능한가?
        │
        No
        ↓
② 기존 Primitive 조합으로 가능한가?
        │
        No
        ↓
③ 재사용 가능한 Visual Component를
   만들 수 있는가?
        │
        No
        ↓
④ Generic Primitive / Capability
   확장이 필요한가?
        │
        No
        ↓
⑤ Specialized Renderer가 필요한가?

```

이 순서를 건너뛰어 World-specific Renderer를 바로 추가하지 않는다.

## 20. 예: Interaction Range

새 Cycle에서 Interaction Range 표현이 필요하다.

Observable:

```text
Actor.Position
InteractionRange = 5

```

기존 Primitive:

```text
Circle

```

이 있으면:

```text
RangeIndicator {
    circle
    center = Actor.Position
    radius = InteractionRange
}

```

로 해결한다.

GameView Core 변경 없음.

## 21. 예: Vision Cone

Vision Cone이 필요하다.

기존 Polygon으로 충분하다면:

```text
VisionIndicator {
    polygon
}

```

으로 Composite Component를 만든다.

만약 곡선 Sector가 반드시 필요하다면:

```text
GAME VIEW CAPABILITY GAP

Required By:
    WORLD-PERCEPTION-003

Missing Capability:
    Sector Geometry

Reason:
    현재 Polygon만으로 정확한
    시야 범위 표현이 어려움.

Proposal:
    Generic Sector Primitive

```

를 생성한다.

승인된 경우에만 Primitive Vocabulary를 확장한다.

## 22. Specialized Renderer

Primitive와 Component만으로 모든 요구를 해결할 수 있다고 가정하지 않는다.

후기 Cycle에서는 다음과 같은 요구가 발생할 수 있다.

```text
Large Tile Terrain
Fog of War
Particle System
Complex Trail
Skinned Animation
Shader Effect
Large Navigation Mesh Visualization

```

이 경우 `Renderer Plugin`이라는 Escape Hatch를 둔다.

```text
GameView
 ├ Primitive Renderer
 ├ Billboard Renderer
 ├ Visual Component Runtime
 │
 └ Renderer Plugin

```

예:

```text
TileLayerRenderer
ParticleRenderer
FogMaskRenderer

```

단 다음은 피한다.

```text
MiningRenderer
CombatRenderer
WolfRenderer
TradeRenderer

```

Renderer Plugin 역시 World Semantic이 아니라 일반적인 시각 capability여야 한다.

## 23. GameView Capability Proposal

GameView Core 확장은 Cycle의 부수 작업으로 몰래 수행하지 않는다.

명시적인 Proposal을 만든다.

```text
GAME VIEW CAPABILITY PROPOSAL

Required By:
    WORLD-EXPLORATION-014

Visual Requirement:
    대규모 tiled terrain 표현

Current Capability:
    Plane
    Terrain Mesh
    Sprite Billboard

Problem:
    수천 개의 개별 Primitive로 표현하면
    기능적으로는 가능하지만
    운영 비용이 과도함.

Proposed Capability:
    TileLayer

Generic Interface:
    tile map
    tile atlas
    position
    scale
    visibility

```

이 Proposal이 승인되어야 GameView capability가 확장된다.

## 24. Visual Library 승격 규칙

Cycle 하나에서 한 번 사용한 표현을 바로 공용 Component로 만들 필요는 없다.

처음에는 Local Composition으로 구현한다.

```text
Cycle A

circle
+
triangle
+
text

```

동일한 패턴이 반복되면:

```text
Cycle B
Cycle C

```

공용 Visual Component로 승격한다.

```text
CharacterMarker

```

따라서 Visual Library는 실제 사용을 통해 성장한다.

## 25. 세 종류의 성장

GameView가 성장할 때 무엇이 성장하는지를 명확히 구분한다.

Level 1 — Primitive Vocabulary

```text
Terrain
Billboard
Circle
Rectangle
Triangle
Polygon
Line
Text
Group
...

```

매우 느리게 증가한다.

Level 2 — Visual Library

```text
CharacterBillboard
ResourceMarker
ValueBar
SelectionRing
RangeIndicator
FloatingText
...

```

Cycle이 진행되며 점진적으로 증가한다.

Level 3 — View Definition

```text
Actor.Position → CharacterBillboard.position

Actor.HP
→ ValueBar.value

Deposit.Position
→ ResourceMarker.position

InteractionRange
→ RangeIndicator.radius

```

거의 모든 Cycle에서 증가한다.

이상적인 성장 패턴은:

```text
Primitive        █
Visual Library   ██████
View Definition  ███████████████████

```

이다.

Primitive가 Cycle 수에 비례해 계속 증가한다면 추상화가 잘못되었을 가능성이 높다.

## 26. Implementation Package 확장

기존 Implementation Package를 다음처럼 확장한다.

```text
IMPLEMENTATION PACKAGE

1. Source Design

2. Intent

3. Required World State

4. Required World Rule

5. Observable Contract

6. Visual Requirement

7. View Definition

8. Required GameView Capabilities

9. Constraints

10. Completion Conditions

```

## 27. Visual Requirement

Visual Requirement는 구현 코드를 적는 곳이 아니다.

다음 질문에 답한다.

인간이 이 Intent의 Runtime 동작을 게임 공간에서 이해하려면 무엇을 볼 수 있어야 하는가?

Mining 예:

```text
VISUAL REQUIREMENT

Designer must be able to see:

- Actor의 위치
- Deposit의 위치
- Actor와 Deposit의 공간 관계
- 현재 Resource 양
- Mine Transition 발생
- Resource 감소
- Actor Resource 증가

```

## 28. Required GameView Capabilities

Cycle은 자신이 요구하는 시각 capability를 선언한다.

예:

```text
REQUIRED GAMEVIEW CAPABILITIES

Terrain
CharacterBillboard
ResourceMarker
ValueBar
FloatingText
Pulse

```

모두 기존 Library에 있다면 GameView 수정 없이 구현한다.

없는 것이 존재하면 `Capability Resolution` 단계로 들어간다.

## 29. Cycle Workflow

최종 Cycle Workflow:

```text
Human Design
Goal / Possibility
        ↓
Intent Extraction
        ↓
World State / Rule
        ↓
Observable Contract
        ↓
Visual Requirement
        ↓
Capability Resolution
        │
        ├ Existing Component
        ├ Primitive Composition
        ├ New Visual Component
        ├ Capability Proposal
        └ Renderer Plugin Proposal
        ↓
View Definition
        ↓
World Implementation
        ↓
Observable Implementation
        ↓
GameView Binding
        ↓
Runtime Scenario
        ↓
Human Observation

```

## 30. GameView Completion Gate

각 Cycle 완료 시 다음을 검사한다.

```text
[ ] World Semantic이 Observable한가?

[ ] View는 ObservableWorldState만 읽는가?

[ ] GameView 내부에 World Rule 판단이 들어가지 않았는가?

[ ] 새로운 Semantic 때문에
    World-specific GameView code를 추가하지 않았는가?

[ ] 기존 Visual Vocabulary를 우선 사용했는가?

[ ] 새 Component는 충분히 일반적인가?

[ ] Primitive 확장이 정말 필요한가?

[ ] Terrain의 의미적 정보가
    View 전용 데이터로 빠지지 않았는가?

[ ] Transition을 시각적으로 확인할 수 있는가?

[ ] Goal → Possibility → Rule → Transition → View를
    추적할 수 있는가?

```

## 31. 초기 Web 구현 범위

첫 번째 GameView 버전은 다음까지만 구현한다.

Rendering

```text
WebGL Scene
3D Camera
Basic Lighting
3D Terrain
2D Sprite Billboard
Primitive Shapes
Text Billboard

```

Interaction

```text
Camera Pan
Camera Orbit
Camera Zoom

Entity Selection
Entity Focus

```

Observable Binding

```text
World Position
Entity Identity
Current Goal
Current Possibility
Current Rule
Transition

```

Visual Library v0

```text
CharacterBillboard
ResourceMarker
NameLabel
ValueBar
SelectionRing
FloatingText

```

Animation v0

```text
move
rotate
scale
fade
pulse
flash
shake

sequence
parallel

```

## 32. 첫 Vertical Slice

첫 번째 검증 Scenario는 Mining 같은 하나의 완전한 Cycle을 사용한다.

```text
AcquireStone
    ↓
MineStone
    ↓
RULE-MINE-001

```

World:

```text
Actor.Position
Actor.Inventory
Actor.Knowledge

Deposit.Position
Deposit.ResourceAmount

```

View:

```text
3D Terrain

Actor
    Character Billboard

Deposit
    Resource Billboard

Actor / Deposit
    World Position에 배치

```

Transition:

```text
Mine
    ↓
Actor visual reaction

Deposit
    pulse

Actor Inventory
    +1 Stone floating text

Deposit Amount
    ValueBar 감소

```

그리고 동시에 Inspector에서:

```text
Goal
    AcquireStone

Possibility
    MineStone

Rule
    RULE-MINE-001

Before
    Stone = 0
    Deposit = 100

After
    Stone = 1
    Deposit = 99

```

를 볼 수 있어야 한다.

## 33. 장기적인 방향

초기:

```text
3D Terrain
+
2D Sprite Billboard

```

로 시작하지만 이 구조는 표현 방식 자체를 고정하지 않는다.

향후:

```text
Animated Billboard
3D Props
Voxel
Tile Terrain
Particle
3D Character

```

등으로 발전할 수 있다.

중요한 것은 새로운 Renderer가 추가되더라도:

```text
ObservableWorldState
        ↓
View Definition
        ↓
Visual Language
        ↓
Renderer

```

라는 구조를 유지하는 것이다.

World Semantic이 Renderer 종류에 종속되어서는 안 된다.

## 34. 핵심 Architecture Rule

Rule 1

GameView는 게임을 구현하는 곳이 아니다.

Rule 2

GameView는 `ObservableWorldState`를 표현하는 Visual Language Runtime이다.

Rule 3

초기 Visual Model은 `3D Terrain + 2D Sprite Billboard`로 시작한다.

Rule 4

새로운 World Semantic이 추가되었다고 GameView Core를 수정하지 않는다.

Rule 5

각 Cycle은 `View Definition`을 통해 Observable Semantic을 기존 Visual Vocabulary에 연결한다.

Rule 6

필요한 표현이 없으면 먼저 기존 Primitive를 조합한다.

Rule 7

반복되는 표현은 Visual Component로 승격한다.

Rule 8

Primitive / Renderer 확장은 일반적인 Visual Capability가 부족할 때만 수행한다.

Rule 9

World-specific Renderer는 만들지 않는다.

Rule 10

Cycle이 확장될수록 GameView Core가 커지는 것이 아니라 Visual Language가 풍부해져야 한다.

## 35. 한 문장 정의

GameView는 3D Terrain 위에 2D Billboard와 범용 Visual Primitive를 배치하는 안정적인 Web Rendering Runtime으로 시작하며, 각 Implementation Cycle은 GameView 코드를 확장하는 대신 Observable World State를 기존 Visual Vocabulary에 연결하는 View Definition을 생성하고, 기존 언어로 표현할 수 없는 요구가 반복적으로 등장할 때에만 Visual Component → Generic Capability → Renderer Plugin 순서로 시각 언어 자체를 확장한다.
