# View Implementation Stage Guide

## Role

GameView Specification 만으로 플레이 가능한 Client 화면을 구현한다.

View 는 Cycle 별로 나뉘지 않는다 — **어떠한 world 라도 명세대로 그려주는 엔진**이다.
따라서 이 단계의 기본 결론은 대개 "엔진은 그대로, 에셋만 등록" 이다.
엔진을 고쳐야 한다면 그것은 이번 Cycle 전용 처리가 아니라 *표현 능력의 일반적 부족*이어야 한다.

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

1. Spec 의 Semantic Role 을 View Asset Registry 에 등록한다 (`role` 또는 `role:state` → 그림).
   등록하지 않으면 대체 표현으로 그려진다 — 게임이 멈추지는 않는다.
2. 엔진이 이번 Spec 을 이미 그릴 수 있는지 확인한다 (목록 · 라벨 · 프롬프트 · HUD 항목 · 상호작용).
3. 못 그리는 것이 있으면 **일반 능력**으로 더한다 — 특정 존재를 이름으로 특별 취급하지 않는다.
4. Input 은 Snapshot 의 상호작용이 들고 있는 request 를 그대로 보낸다 (상태를 직접 바꾸지 않는다).
5. GameView Fixture 만으로 도는 View 단독 테스트를 작성한다 —
   이번 Cycle Fixture 와 **관계없는 world Fixture** 를 함께 돌려 엔진의 일반성을 확인한다.

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
    gameview/   Spec 수신 · 해석
    scene/      Scene State
    renderer/   렌더링
    terrain/    3D Terrain
    sprites/    Sprite Billboard
    camera/     Camera
    input/      Action Request 발신
    hud/        HUD
    assets/     Asset Registry
```

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
- View 코드에 특정 존재·상호작용·사유의 이름을 박지 않는다 (`player` · `deposit` · `out-of-range` …).
  표시 문구는 World 가 주고, View 는 그린다.
- Cycle 별로 View 를 나누지 않는다 — 분기 대신 명세 항목을 늘린다.

## Done When

- Spec 의 Entity / State / Interaction / HUD 가 화면에 표현된다.
- 처음 보는 world Fixture 를 줘도 멈추지 않고 명세대로 그린다.
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
