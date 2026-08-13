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
    gameview/   Spec 수신 · 해석 (범용 순회 — 특정 Cycle 의미를 모른다)
    scene/      Scene State
    engine/     Role / Interaction / HUD Registry — Cycle 별 표현 데이터
    renderer/   렌더링 (entity 배열 순회 — role 하드코딩 금지)
    terrain/    3D Terrain
    sprites/    Sprite Billboard
    camera/     Camera
    input/      Action Request 발신
    hud/        HUD
    assets/     Asset Registry
```

### View = 명세를 그대로 그리는 엔진 (핵심 명제)

View 는 Snapshot 의 entities / interactions / hud 배열을 **범용으로 순회**하며 그린다.
같은 표현(동일 role:state)을 그리는 View 코드는 Cycle 이 늘어도 수정되지 않는다.

새 Cycle 의 View 작업은 두 가지뿐이다.

1. **Registry 항목 추가** — 스프라이트(Asset) · Role 특성 · 입력 바인딩 · HUD 표시 · 사유 문구
2. **새 표현 패턴이 처음 등장할 때만** 엔진 확장 (기존 패턴 코드는 불변)

미등록 role / HUD id / 사유 코드도 기본 형식으로 일단 그려져야 한다 —
표현 등록 누락이 게임을 멈추지 않는다.

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
- 엔진 코드(gameview/renderer/hud/input)에 특정 entity id·role 을 하드코딩하지 않는다 —
  Cycle 별 표현은 Registry 데이터로만 추가한다.
- 기존 role 의 표현 코드를 다른 Cycle 작업 중에 수정하지 않는다 (표현 자체를 바꾸는 Cycle 은 예외).

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
