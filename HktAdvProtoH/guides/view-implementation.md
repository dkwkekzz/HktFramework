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

구조 기준 — 팩의 `view/` 는 **결정 Layer 뿐**이다. 그리는 능력은 엔진이 소유한다.

```text
view/
    resolve.ts                   Presentation Resolver — Snapshot → Render Plan (진입점)
    role-presentation.ts         Entity Role 을 어떻게 그릴지 (role 당 단일 항목)
    kind-presentation.ts         존재 종류(CharacterKind)가 정하는 표현
    interaction-presentation.ts  Interaction Role 의 키 바인딩 · 프롬프트
    hud-presentation.ts          HUD 항목 id 의 라벨 · 아이콘 · 토스트
    combat-presentation.ts       전투 관찰값의 표시
    effect-presentation.ts       어떤 사건이 어떤 이펙트를 얼마나 세게 켜는가 (F1)
    code-text.ts                 의미 코드 → 플레이어 문구
    bindings.ts                  이 팩의 특수 키 규칙
    command-request.ts           명령 한 줄 → Action Request
    sprites.ts                   Sprite 표 (절차 생성 픽셀아트 — 외부 이미지 없음)
    motion-source.ts             motions/ 자동 발견 (+ motion-atlas.generated.ts 는 생성물)

engine/view-kernel/              capability Layer — 팩이 편집하지 않는다
    renderer · scene(Render Plan 타입) · sprites · terrain · camera · input · hud ·
    assets · motion 재생 · net · 엔진 공통 presentation(collision·facing·link·session) ·
    fx(이펙트 오버레이 + 스플랫 런타임)
```

팩은 표·문구·바인딩·스프라이트를 **주입**하고 (registerSprites · CodeTextFn · KeyBinding),
엔진은 그것을 그린다. 경계의 단일 출처는
[design/Design-System-Content-Separation.md](../design/Design-System-Content-Separation.md).

### View 의 2-Layer 구조 (핵심 명제)

World 는 **semantic**(role/state/값/사유 코드)만 보낸다. View 는 두 Layer 로 나뉜다.

```text
Semantic Snapshot (World)
        ↓
Presentation 결정 Layer   view/ — role 별 "어떻게 그릴지" 결정
        ↓ Render Plan            (sprite·크기·라벨 형식·문구·키)
Capability Layer          engine/view-kernel/ — 그리기 능력만 제공, 의미를 모른다
```

두 Layer 는 분리를 유지한다 — capability 코드에 게임 의미(role·문구)를 넣지 않고,
결정 Layer 는 그리기 구현을 갖지 않는다.

**같은 종류의 대상을 그리는 결정은 role/id 당 단일 항목이다** — 모든 Cycle 이
`view/*-presentation.ts` 의 같은 항목을 공유·발전시키며, Cycle 별로 결정 코드를
분리하거나 중복하지 않는다. 새 Cycle 의 View 작업은:

1. **결정 항목 추가** — 새 role/interaction/HUD id/사유의 presentation 항목 + Asset 등록.
   종(kind)이 정하는 표현(그림 기준 방향 등)은 `view/kind-presentation.ts` 의
   kind 항목으로만, 역할(role)이 정하는 표현(카메라·라벨·자리 비움 등)은
   `view/role-presentation.ts` 로만 — 종과 역할을 섞지 않는다.
   그림 자체는 `motions/<kind>/<action>.<격자>.<프레임>.<fps>.png` 파일 규약이
   자동 발견한다 (motions/README.md) — 등록 코드를 만들지 않는다.
   현재 등록 전체는 `npm run catalog` 로 관찰한다 (kind 정적 데이터 3원소 — CLAUDE.md).
2. **표현이 고도화될 때만 capability 추가** — 예: sprite animation 이 필요해지면
   그 능력을 더하고, 기존 능력으로 그리던 것들의 코드는 수정하지 않는다.

### 이펙트 (F1)

Cycle 이 새 사건(타격의 새 방식 · 새 스킬 · 새 상태 전이)을 만들면, 그 사건이 화면에서
*터지게* 하는 것은 `view/effect-presentation.ts` 한 곳이다. 코드가 아니라 **표**를 늘린다.

```text
World 가 보내는 의미        effect-presentation           engine/view-kernel/fx
(skill · damageType ·   →   어떤 게놈을 얼마나 세게   →   그 게놈을 켠다
 guard · critical ·          (SceneEffect 한 줄)           (이펙트 오버레이)
 값의 변화)
```

그 파일은 **표 넷**이 전부다. 새 스킬·새 사건은 표에 한 줄이 늘 뿐이다 —
스킬 이름으로 분기하는 코드를 만들지 않는다.

```text
SKILL_EFFECTS        스킬 하나가 어떻게 터지는가 — 이펙트 · 세기 기준 · 초기 반경 ·
                     각 흔들림 · 축 기울기 · 터짐 증폭까지 **스킬마다 따로**
DAMAGE_TYPE_EFFECTS  등록되지 않은 스킬의 기본값 (방식으로만 가른다)
GUARD_EFFECTS        막힘 · 무너짐 — 치는 쪽이 아니라 받는 쪽의 사건
WORLD_EVENT_EFFECTS  타격이 아닌 사건 (채굴 · 알게 됨)
```

세 가지 규칙만 지킨다.

1. **이펙트는 세계에 넣지 않는다.** 세계는 사건을 낳고, 이펙트는 그 사건의 읽는 법이다.
   근거: [design/Design-Effect-Presentation.md](../design/Design-Effect-Presentation.md).
2. **세기는 사건의 값에서 나온다.** 게놈을 새로 만들어 "센 타격" 을 만들지 않는다 —
   같은 게놈에 `strength` 를 달리 준다 (게놈이 가진 것은 그 세기에 대한 *감도*뿐이다).
   세기의 **기준(`reference`)은 스킬이 갖는다** — 고급 스킬(≈55)과 기본 스킬(≈20)을 같은
   자로 재면 기본 스킬은 영원히 스침으로만 보인다.
3. **예산을 넘기지 않는다.** 화면에 동시에 올릴 수 있는 이펙트는 `EFFECT_SET` 의 7개다.
   새 이펙트를 넣으려면 무엇을 뺄지 함께 정한다.

새 *모양*이 필요하면 그것은 View 구현이 아니라 게놈 작업이다 — `tools/fx-lab/` 에서 맞추고
`engine/view-kernel/fx/splat/fx.js` 의 `FX_PRESETS` 에 한 줄로 넣는다 (셰이더·엔진·렌더러는
건드리지 않는다). 랩과 게임은 같은 런타임 사본을 읽으므로 랩에서 맞춘 값이 그대로 산다.

미등록 role/HUD id/사유 코드도 기본 결정과 placeholder 로 일단 그려져야 한다 —
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
- 이펙트를 `world/` 나 GameView 계약에 넣지 않는다 — 세계는 사건까지만 낳는다 (F1).
- 이펙트의 *모양*을 결정 Layer 코드로 만들지 않는다 — 모양은 게놈이고, 표는 사건→게놈 사상만 갖는다.
- Capability 코드(`engine/view-kernel/`)에 특정 role·게임 의미·문구를 하드코딩하지 않는다 —
  결정은 `view/` 의 role/id 단위 항목만이 한다. 그리고 팩 작업 중 `engine/` 을 편집하지 않는다.
- 같은 종류 대상의 결정 코드를 Cycle 별로 분리·중복하지 않는다 — 단일 항목을 발전시킨다.
- 기존 capability 의 렌더 코드를 다른 Cycle 작업 중에 수정하지 않는다
  (capability 고도화는 기반 트랙의 일이다 — 필요하면 사유를 적고 반환한다).

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
