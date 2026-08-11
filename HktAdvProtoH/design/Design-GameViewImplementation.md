# Design-GameViewImplementation.md

GameView Implementation Plan — Web 개발 환경 구현 결정

## 1. 문서의 위치

기준 문서는 [Design-GameView.md](Design-GameView.md)(Architecture)다. 이 문서는 그 아키텍처를 **Web 환경에서 어떻게 구현할 것인가**에 대한 Implementation Mechanism 결정만 담는다.

```text
Design-GameView.md              무엇이어야 하는가 (계약·구조·확장 규칙)
Design-GameViewImplementation   어떻게 만들 것인가 (스택·폴더·실행 모델·순서)
```

- 두 문서가 충돌하면 Architecture 문서가 우선한다.
- 이 문서의 내용은 전부 Implementation Mechanism이다 — Stage 4 Agent의 재량 범위 안에서 조정될 수 있으며, 조정해도 설계 변경이 아니다. 단 §2의 전제는 예외다.

## 2. 전제 (Architecture에서 오는 불변 — 재량 아님)

1. GameView는 `ObservableWorldState`만 읽는다. World 내부 접근 경로 자체를 만들지 않는다.
2. GameView Core(Backend / Primitive / Library)에는 World 의미가 들어가지 않는다. Semantic 연결은 View Definition만 담당한다.
3. **공간 의미는 3D** — `Position = (x, y, z)`. Architecture 문서 §8이 전제하는 형태이며, Stage 2(World Model)는 Position을 처음부터 3D로 정의해야 한다. 초기 Cycle이 평지(y=0)여도 의미 모델은 3D다.
4. 초기 Rendering Model은 `3D Terrain + 2D Sprite Billboard` (Architecture §3). 단 이것은 표현 방식이지 의미가 아니므로, 이후 교체는 Implementation 변경일 뿐이다 (Architecture §33).

## 3. 기술 스택

```text
Rendering Backend    three.js (WebGL)
Dev / Build          Vite
World / Observable   순수 ES Module — DOM·three 의존 금지
Headless 검증        Node (world+observable을 그대로 import)
언어                 JavaScript (ES Module)
```

선택 이유:

- **three.js**: Scene/Camera/Raycast/텍스처 관리를 직접 WebGL로 재구현할 이유가 없다. Architecture의 Rendering Backend 층이 얇은 어댑터로 three.js를 감싸므로, backend 교체 가능성도 구조적으로 열려 있다. HktCreature / HktAssetGeneratorA 트랙과 같은 계열이라 학습 비용이 없다.
- **world / observable의 무의존성**: Verification(Stage 5)이 브라우저 없이 Node에서 같은 코드를 돌려 Transition Log를 검증한다. GameView와 검증이 **같은 Observable을 소비**하므로 "Rendering 자체가 검증 수단"이 성립한다.

## 4. 폴더 구조 — Architecture 4층과의 매핑

```text
HktAdvProtoH/app/
│
├─ world/                      # World State + Rule + tick (순수 JS)
│   ├─ state.js
│   ├─ rules/                  #   각 Rule에 Implements: INTENT-XXX trace
│   └─ tick.js
│
├─ observable/                 # Semantic Projection (순수 JS)
│   ├─ project.js              #   WorldState → Observable 스냅샷 (직렬화 가능 JSON)
│   └─ transitions.js          #   Transition Log {Before, Input, Rule, After, trace}
│
├─ gameview/                   # GameView Core — Cycle이 수정하지 않는 안정층
│   ├─ backend/                #   [Rendering Backend] three.js 어댑터
│   ├─ primitives/             #   [Primitive API] terrain / billboard / shape / text / group
│   ├─ library/                #   [Visual Library] character-billboard / value-bar / ...
│   └─ animation/              #   pulse / floatingText / sequence ... 실행기
│
├─ views/
│   ├─ definitions/            #   [View Definition] Cycle 산출물 — cycle-001-mining.view.js
│   ├─ debug/                  #   DebugView (스냅샷 원문)
│   └─ designer/               #   DesignerView (Goal/Possibility + reason + Transition)
│
├─ assets/sprites/             # Visual Asset Catalog (atlas + catalog.js)
└─ index.html                  # 진입점 — GameView + Inspector 패널 (Architecture §17 레이아웃)
```

**Import 방향 규칙** (위반은 구조 위반):

```text
views/definitions → gameview/library → gameview/primitives → gameview/backend

three.js import 허용 범위:  gameview/backend, gameview/primitives 만
world/ import 허용 범위:    없음 — View 쪽 어디서도 world를 import하지 않는다
                            (스냅샷·Transition Log 데이터로만 전달)
```

이 규칙은 "View는 Observable만 읽는다"를 코드 구조로 강제하는 장치다. 검증 스크립트로 정적 확인한다 (§9).

## 5. View Definition의 V0 실행 모델

Architecture §14·§18의 View Definition은 선언적 형식이다. V0에서는 **별도 DSL 텍스트와 파서를 만들지 않고**, 같은 선언 구조를 그대로 담은 JS 모듈로 구현한다.

```js
// views/definitions/cycle-001-mining.view.js
// VIEW WORLD-MINING-001 — Implements: INTENT-MINING-001
export default {
    visuals: {
        ActorVisual: {
            component: 'CharacterBillboard',
            bind: obs => ({
                position: obs.actors.Arin.position,
                sprite: 'Actor.Default',
            }),
        },
        DepositAmount: {
            component: 'ValueBar',
            attach: 'DepositVisual',
            bind: obs => ({
                value: obs.deposits.Deposit01.resourceAmount,
                max: obs.deposits.Deposit01.resourceCapacity,
            }),
        },
    },
    transitions: {
        'RULE-MINE-001': (t, fx) => fx.sequence([
            fx.pulse('DepositVisual'),
            fx.floatingText('ActorVisual', `+${t.after.stoneGained} Stone`),
        ]),
    },
}
```

- `bind`는 **스냅샷 → props 순수 함수**다. Observable 외에는 읽을 것이 없도록 시그니처로 강제된다.
- 선언 구조가 Architecture §14 형식과 1:1 대응하므로, 이후 View Definition을 데이터 파일(JSON/DSL)로 옮길 필요가 생기면 이 모양 그대로 직렬화하면 된다. 인터프리터 선행 구축 비용을 지불하지 않기 위한 결정이다.

## 6. 런타임 루프와 Sync

```text
world.tick(input)
    ↓
observable 스냅샷 + Transition Log      ← 직렬화 가능 JSON, structuredClone로 전달
    ↓
GameView Runtime (매 프레임)
    ① 각 View Definition의 bind(스냅샷) 평가
    ② visual id 기반 diff → 생성 / 갱신 / 제거
    ③ Transition Log의 신규 항목 → transitions 핸들러 → animation 실행기에 큐잉
    ④ three.js Scene 반영
```

- **diff 기반 retained scene**: 매 프레임 bind 결과(props)를 이전 값과 비교해 변경분만 적용. 객체 풀링·인스턴싱은 Core 내부 최적화로, Definition은 모른다.
- **Transition은 1회 소비 이벤트**: 스냅샷(상태)과 달리 Log의 각 항목은 한 번만 연출로 변환된다.
- 보간(이동 스무딩)은 View 재량이되, 표시 값은 항상 스냅샷 값으로 수렴한다 — 렌더가 자체 상태를 발명하지 않는다.

## 7. Billboard 구현 결정

- **Cylindrical billboard** — Y축 회전만 카메라를 추적하는 커스텀 quad. `THREE.Sprite`(구면 billboard)는 3/4 부감 카메라에서 지면에 선 캐릭터가 뒤로 눕는 문제가 있어 사용하지 않는다. Architecture §7의 `facing = camera`는 이 방식으로 구현한다.
- **Anchor 기본값 bottom-center** — Billboard의 `position`이 발 위치와 일치. Architecture §7의 `anchor` 파라미터로 조정 가능.
- **Sprite atlas + UV 오프셋** — 프레임 애니메이션·방향 프레임은 UV 전환. 픽셀아트 에셋이면 NearestFilter.
- **Placeholder 우선** — Architecture §13의 v0(Circle + Triangle 방향 마커)로 시작한다. 스프라이트 에셋이 없어도 Vertical Slice가 성립하고, 에셋 교체는 Visual Asset Catalog 항목 교체일 뿐이다.

## 8. V0 구현 범위 — Architecture §31의 부분집합

Architecture §31은 첫 버전의 상한이다. 실제 V0는 §32 Vertical Slice(Mining)에 필요한 것만 역산해 구현한다.

```text
V0 필수 (Vertical Slice가 요구)

Scene / Camera(orbit·zoom·pan) / Lighting
Terrain: Plane + Grid
SpriteBillboard (placeholder shape 포함) / TextBillboard
Circle / Rectangle / Triangle / Group
Library: CharacterBillboard, ResourceMarker, ValueBar, FloatingText
Animation: pulse, move, fade, sequence
Inspector 패널: Goal / Possibility / Rule / Before·After (Architecture §17)

V0 유예 (요구하는 Cycle이 올 때 — 선구현 금지)

Entity Selection / Focus
parallel / repeat / shake
SelectionRing, IconBillboard, StatusIcon
Height Surface Terrain, Line3D, Polygon
```

유예 목록은 Capability 대기 목록이지 로드맵이 아니다 — 추가는 Architecture §19의 해결 순서와 §23 Proposal 절차를 따른다.

## 9. 검증 연결 (Stage 5)

1. **Semantic / Runtime 검증** — Node에서 `world/` + `observable/`을 import해 시나리오를 헤드리스 실행하고 Transition Log를 단언한다. 브라우저·three.js 불필요.
2. **구조 검증** — §4의 import 방향 규칙을 정적 스캔하는 스크립트 (`views/`가 `world/`를 import하지 않는가, `three` import가 backend/primitives 밖에 없는가).
3. **GameView 눈 검증** — Vite dev server로 Vertical Slice를 띄워 인간이 관찰한다 (Architecture §30 Gate 체크리스트). 스크린샷 자동화(Playwright + Chromium)는 회귀가 실제로 문제 될 때 도입한다.

## 10. 구현 순서

```text
IMPL-A  스캐폴드
        Vite + 폴더 구조 + 빈 GameView Runtime.
        Terrain 평면 위에 placeholder billboard 하나가 떠 있는 화면.

IMPL-B  World 코어
        world/ + observable/ + Node 헤드리스 실행 경로.
        Mining 시나리오의 Transition Log가 Node에서 출력·단언됨.

IMPL-C  View Definition Runtime
        bind 평가 → diff → scene 반영 + Transition → animation 큐.
        §5의 실행 모델이 동작.

IMPL-D  Vertical Slice (= Architecture §32)
        cycle-001-mining.view.js + Inspector 패널.
        Mine 실행 시 pulse / +1 Stone floating text / ValueBar 감소와
        Inspector의 Before·After를 동시에 관찰.
```

IMPL-A~D **전체가 CYCLE-001 Implementation(Stage 4)의 Implementation Mechanism으로 수행된다** — GameView Core 구축을 위한 별도 트랙이나 Stage는 존재하지 않는다. Stage 4는 원래 파일·클래스 구조를 Agent 재량으로 두며, Cycle-001의 Observable Proof를 만족시키는 데 필요한 최소 Core(V0 범위, §8)를 세우는 것은 그 재량 안의 구현 작업이다. 실제 착수는 CYCLE-001 Contract(Stage 0)와 Human Semantic Review 승인 이후이며, 이후 Core 확장은 Cycle 부수 작업이 아니라 GAMEVIEW-CAPABILITY-GAP 승인 절차로만 일어난다.
