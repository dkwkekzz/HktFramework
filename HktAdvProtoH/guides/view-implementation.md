# View Implementation Stage Guide

## Role

GameView Specification 만으로 플레이 가능한 Client 화면을 구현한다.

## Input

- `cycles/<CycleId>/04-gameview.spec.yaml`  ← **유일한 World 계약**
- 기존 View 구현 (`view/`)
- `protocol/` 경계 타입

`03-world-semantic.md` 와 `world/` 는 View 의 입력이 아니다.

## Do

```text
GameView Specification
        ↓
Presentation Resolver
        ↓
Scene State
        ↓
Renderer
```

1. Spec 의 Semantic Role 을 View Asset Registry 에 매핑한다 (`resource-deposit:stone → stone-deposit.png`).
2. Entity / State / Interaction / HUD 를 Presentation 으로 해석한다.
3. 기존 View 는 재구현하지 않고 Delta 만 확장한다.
4. Input 을 Action Request 로 변환해 전송한다 (상태를 직접 바꾸지 않는다).
5. GameView Fixture 만으로 도는 View 단독 테스트를 작성한다.

기술 기준:

```text
Platform   Web / TypeScript
Terrain    3D Terrain
Entity     Sprite Billboard
UI         Web HUD
Camera     View 의 책임
```

구조 기준:

```text
view/
    gameview/   Render 지시 수신 · 해석 (특정 Cycle 의미를 모른다)
    scene/      Scene State
    renderer/   렌더링 capability (sprite billboard · terrain · trail · camera follow)
    terrain/    3D Terrain
    sprites/    Sprite Billboard
    camera/     Camera
    input/      Action Request 발신 (지시받은 대상·키로만)
    hud/        HUD capability (counter · flag · 프롬프트 · 토스트 · 라벨)
    assets/     Asset Registry (sprite 키 → 그림)
```

### View = Render Capability 엔진 (핵심 명제)

View 는 그리기 능력만 제공한다 — "sprite 를 그려라", "지형을 그려라",
"라벨을 붙여라", "counter 를 표시하라". **무엇을 어떻게 그릴지는 각 Cycle 의
World(Observer Projection)가 결정**해 Snapshot 의 표현 지시(sprite 키·variant·
크기·라벨 텍스트·프롬프트 문구)로 내려보낸다. View 는 그 지시를 그대로 그린다.

새 Cycle 의 View 작업은 두 가지뿐이다.

1. **Asset 추가** — World 지시가 참조할 새 sprite 그림 등록
2. **표현이 고도화될 때만 capability 추가** — 예: sprite animation 이 필요해지면
   representation 에 새 kind 를 더하고 그 구현만 추가한다.
   기존 kind 로 그리던 것들의 View 코드는 수정되지 않는다.

지시가 미등록 sprite·미제공 지형을 참조하거나 옵션을 생략해도 엔진 기본값과
placeholder 로 일단 그려져야 한다 — 표현 누락이 게임을 멈추지 않는다.

## Output

- `view/` 실제 코드
- `cycles/<CycleId>/07-view-implementation.md`

항목: `SPEC CONSUMED` · `ASSET MAPPING` · `INPUT → ACTION REQUEST` · `FIXTURE TESTS` · `NOTES`

형식과 작성 예시는 `advprotoh-cycle` 스킬의 `references/artifact-format.md` 가 단일 출처다.

## Must

- 화면 구성은 오직 GameView Specification 으로만 결정한다.
- Sprite / Mesh / Texture / 레이아웃 / Camera 선택은 View 가 책임진다.
- View 는 World 없이 Fixture 만으로 검증 가능해야 한다.
- Cycle Goal 이 실제로 플레이 가능해야 한다 (조작 → 요청 → 반영).

## Must Not

- `world/` 를 import 하거나 World 내부 구현을 계약의 대체 수단으로 사용하지 않는다 — 공유는 `protocol/` 뿐이다.
- Client 에서 World State 를 직접 변경하지 않는다.
- Spec 에 없는 게임 의미를 View 에서 만들어내지 않는다 (예: 클라이언트 임의 판정).
- 엔진 코드(gameview/renderer/hud/input)에 특정 entity id·sprite·게임 의미를 하드코딩하지 않는다 —
  표현 결정은 World Projection 의 지시가 한다.
- 기존 representation kind 의 렌더 코드를 다른 Cycle 작업 중에 수정하지 않는다
  (capability 자체를 고도화하는 Cycle 은 예외).

## Done When

- Spec 의 Entity / State / Interaction / HUD 가 화면에 표현된다.
- Fixture 테스트가 통과한다 (World 미기동 상태에서).
- Cycle Goal 을 사람이 조작해서 달성할 수 있다.
- Spec 에 변화가 없는 Cycle 이면 `GAMEVIEW CHANGE: NONE` 을 확인하고 변경 없음을 기록한다.

## Gap

정보가 부족하면 World 내부를 읽지 않고 반환한다.

```text
GAMEVIEW GAP
Required   현재 Mining 대상 방향을 표현해야 함
Missing    CurrentActionTarget
Reason     CurrentAction 은 있지만 대상 정보를 알 수 없음
Return To  GameView Specification
```
