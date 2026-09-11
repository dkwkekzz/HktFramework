# ENGINE — 기반 모듈 API 명세

`engine/` 다섯 모듈이 export 하는 함수·타입·상수를 코드에 있는 그대로 구조로만 적는다. Cycle 번호·경위·완료 이력은 두지 않는다.
갱신 규칙: Cycle 을 main 에 합친 직후, 이 문서와 코드의 API 가 어긋난 것만 고친다. 사용처("누가 쓰는가")는 `content/ app/ server/ tools/` 의 import 를 grep 한 결과다 (tests 제외 · `—` 는 그 넷 어디서도 import 하지 않음).

| 모듈 | 역할 | 진입 파일 |
|---|---|---|
| `engine/world-kernel` | Authoritative World 의 껍데기 — 참여/요청/Tick/투영의 인과 순서와 영속 | `kernel.ts` (`createWorldKernel`) · `clock.ts` |
| `engine/physics` | 지면 평면(x,z) 위 순수 물리 솔버 도구상자 — 이동·관성·밀어내기·호 스윕 | 파일별 개별 import (index 없음) |
| `engine/view-kernel` | View 쪽 Capability — 렌더·HUD·입력·이어짐·모션·프레젠테이션 결정 기구 | 하위 폴더별 개별 import (index 없음) |
| `engine/protocol-core` | World ↔ View 봉투 — ActionRequest · GameViewSnapshot · 전송 메시지 · Semantic Id | `actions.ts` · `gameview.ts` · `transport.ts` |
| `engine/world-authoring` | Region Description → 컴파일된 지형/그래프/검사/뼈대 생성/등급/초안 고리 | `compile.ts` · `check.ts` · `author.ts` · `draft.ts` |

## world-kernel

세계에 대해 아는 것은 "시간이 흐르고 관찰자가 있다"(`CoreWorldState`)뿐이다. Actor·물건·능력치·Rule·투영은 전부 `WorldContent<S>` 로 등록된 팩의 것이며, 커널은 인과의 순서(참여 → 요청 → systems → time += dt → postTimeSystems → 관찰자별 투영)만 돌린다.

| 파일 | 하는 일 |
|---|---|
| `kernel.ts` | `World` 인터페이스와 `createWorldKernel` — pending 큐·핸들러 맵·마지막 관찰 보관 |
| `tick.ts` | `runWorldTick` — 한 Tick 의 인과 순서 |
| `content.ts` | 팩이 자신을 등록하는 계약 `WorldContent` · `InteractionHandler` · `WorldSystem` |
| `dispatch.ts` | ActionRequest → 등록된 InteractionHandler 호출 (모르는 관찰자·미등록 interaction 거절) |
| `state.ts` | `CoreWorldState` 와 관찰자 조회 헬퍼 |
| `observer.ts` | `ObserverState` 형과 Id 길이 한계 |
| `observer-join.ts` / `observer-leave.ts` / `observer-mark.ts` | RULE-OBSERVER-JOIN/LEAVE/MARK-001 |
| `request-reply.ts` | RULE-REQUEST-REPLY-001 — ActionResult 를 요청한 관찰자에게 갈 대답으로 |
| `persistence.ts` | `WorldSnapshot` 뜨기/되살리기 (버전 불일치면 null) |
| `clock.ts` | `startWorldClock` — setInterval 로 `world.tick` 을 돌리고 관찰 결과를 sink 에 넘긴다 |

| export | 종류 | 시그니처 요약 | 용도 | 사용처 |
|---|---|---|---|---|
| `World` | type | `{ join(id); leave(id); request(id, ActionRequest); mark(id, n); tick(dt): WorldTickResult; latestObservation(id); snapshot(): WorldSnapshot }` | 세계의 외부 표면 — pull 경로 없음 | content |
| `createWorldKernel` | fn | `<S extends CoreWorldState>(state: S, content: WorldContent<S>) => World` | 팩 State + 계약으로 세계를 세운다 | content |
| `WorldContent` | type | `<S>{ tickInterval; stateVersion; spawnObserverBody(state, ordinal): string; interactions; systems; postTimeSystems; projectObserver(state, id): GameViewSnapshot \| null }` | 팩 등록 계약 | content |
| `InteractionHandler` · `WorldSystem` | type | `<S>{ id; handle(state, observerId, action): ActionResult }` · `<S>(state: S, dt) => void` | interaction 수용 경로 · Tick 시스템 | content / — |
| `CoreWorldState` | type | `{ time: number; observers: ObserverState[] }` | Engine 이 요구하는 최소 State | content |
| `findObserver` · `isAttended` · `presentObserverCount` | fn | `(state, observerId) => ObserverState?` · `(state, actorId) => boolean` · `(state) => number` | 관찰자 조회 · 조종 중인가 · present 수 | content / — / — |
| `ObserverState` · `MAX_OBSERVER_ID_LENGTH` | type/const | `{ id; actorId; present; acknowledgedMark }` · `64` | 세계가 아는 관찰자 · Id 길이 한계 | engine |
| `runWorldTick` | fn | `<S>(state, dt, pendingObservers, pending, content, handlers) => WorldTickResult` | 한 Tick 의 인과 순서 | engine |
| `WorldTickResult` · `PendingObserverEvent` · `PendingRequest` | type | `{ observations: Map<id, GameViewSnapshot>; observerResults; results; outcomes: Map<id, RequestOutcomeView[]> }` · `{ kind: 'join'\|'leave'\|'mark'; observerId; mark? }` · `{ observerId; action }` | Tick 산출물 · 미처리 큐 원소 | engine |
| `dispatchAction` | fn | `<S>(state, observerId, action, handlers: ReadonlyMap<string, InteractionHandler<S>>) => ActionResult` | 요청 수용 | engine |
| `ruleObserverJoin` · `evaluateObserverIdentity` | fn | `<S>(state, observerId, spawnBody: (state, ordinal) => string) => ActionResult` · `(observerId) => string \| null` | 참여/재참여 · Id 형식 검증 | engine / — |
| `ruleObserverLeave` · `ruleObserverMark` | fn | `(state, observerId) => ActionResult` · `(state, observerId, mark) => ActionResult` | 이탈 · 표식 수용 | engine |
| `ruleRequestReply` · `groupOutcomesByObserver` · `AddressedOutcome` | fn/type | `(observerId, action, result) => AddressedOutcome` · `(addressed[]) => Map<string, RequestOutcomeView[]>` · `{ observerId; outcome }` | 판정 → 대답 · 관찰자별 묶기 | engine / engine / — |
| `WorldSnapshot` | type | `{ version: string; state: unknown }` | 영속 단위 | content, server |
| `takeSnapshot` · `restoreState` | fn | `<S>(version, state) => WorldSnapshot` · `<S>(snapshot, version) => S \| null` | structuredClone 뜨기 · 버전 일치 시 복구(모든 present=false) | engine / content |
| `startWorldClock` · `WorldClock` · `ObservationSink` | fn/type | `(world, onObservation: ObservationSink, tickInterval, now?) => WorldClock` · `{ stop() }` · `(observations, outcomes) => void` | 세계의 시계 (dt 상한 0.25s) | server / server / — |

**content 가 채우는 것** — `WorldContent<S>` 전부: `tickInterval` · `stateVersion` · `spawnObserverBody` · `interactions[]` · `systems[]` · `postTimeSystems[]` · `projectObserver`. State 형 `S` 는 `CoreWorldState` 를 확장한 plain JSON 이어야 한다 (persistence 가 structuredClone 한다).

## physics

게임 명사도 튜닝 수치도 없는 순수 함수 모음. 커널 파이프라인의 단계가 아니며 팩의 시스템이 골라 부른다. 강성·마찰·충격량·경계 등 상수는 전부 인자로 받는다. 몸은 구조적 타입(`PointBody` / `KineticBody`)이다.

| 파일 | 하는 일 |
|---|---|
| `vec.ts` | `Vec2 {x,z}` 와 거리·정규화 |
| `body.ts` | 솔버가 읽는 몸의 형 |
| `seek.ts` | 목표점 추적 이동 적분 |
| `momentum.ts` | 관성 적분 + 마찰 감쇠 + 경계 고정 |
| `push.ts` | 겹친 원끼리 속도 밀어내기 |
| `sweep.ts` | 호(arc) 스윕 충돌구 · 원 접촉 · 방사 충격량 |

| export | 종류 | 시그니처 요약 | 용도 | 사용처 |
|---|---|---|---|---|
| `Vec2` · `CENTER_EPSILON` | type/const | `{ x: number; z: number }` · `1e-9` | 지면 평면 벡터 · 중심 일치 한계 | engine / content (re-export) |
| `distance` · `normalized` · `normalizedOrFixed` | fn | `(a, b) => number` · `(dx, dz) => Vec2 \| null` · `(dx, dz) => Vec2` (길이 0 → `{1,0}`) | 거리 · 단위 벡터 | content (re-export) / content / engine |
| `PointBody` · `KineticBody` | type | `{ position: Vec2 }` · `PointBody & { velocity; bodyRadius; bodyMass }` | 이동 대상 · 관성/밀어내기/충격 대상 | engine |
| `integrateSeek` · `SeekStep` | fn/type | `(body: PointBody, target, step, arriveEpsilon = 0) => SeekStep` · `{ arrived; dx; dz }` | step 만큼 접근, 도착 시 스냅 | content / — |
| `integrateMomentum` · `PlaneBounds` | fn/type | `(bodies: KineticBody[], friction, restSpeed, dt, bounds?) => void` · `{ minX; maxX; minZ; maxZ }` | 위치 += 속도·dt, 감쇠, 정지, 경계 | content / — |
| `resolveCirclePush` | fn | `(bodies: KineticBody[], stiffness, dt) => number` | 겹침 쌍마다 속도 밀기, 밀린 쌍 수 반환 | content |
| `arcSweepCollider` · `ArcSweepSpec` · `ArcSweep` | fn/type | `(position, facing, progress, spec) => ArcSweep` · `{ arc; tipRadius; reach; begin; end }` · `{ center; radius; active }` | 진행도에 따른 칼끝 자리/활성 | content / — / — |
| `circleHits` · `applyRadialImpulse` | fn | `(center, radius, body & {bodyRadius}) => boolean` · `(origin, body: KineticBody, impulse) => void` | 구-몸 접촉 · 방사 충격 | — |

## view-kernel

Capability(그리기·HUD·입력·이어짐)와 결정 기구(presentation)를 제공한다. 무엇을 어떻게 그릴지는 `SceneState`(Render Plan)에 이미 결정되어 실려 오며, 사람이 읽을 문구는 코드(`CodeTextFn`)로 부르고 팩의 문구 표가 답한다. 종류·역할·스프라이트·팔레트·키 바인딩은 팩이 등록한다.

### assets
| 파일 | 하는 일 |
|---|---|
| `registry.ts` | spriteId → 절차 생성 픽셀아트 Canvas. 미등록 id 는 placeholder |

| export | 종류 | 시그니처 요약 | 용도 | 사용처 |
|---|---|---|---|---|
| `SpriteSheet` | type | `{ palette: Record<string,string>; maps: Record<string,string[]> }` | 팩의 그림 표 | content |
| `registerSprites` · `spriteCanvas` | fn | `(sheet) => void` · `(spriteId) => HTMLCanvasElement` | 등록 · 캐시된 캔버스 | app / engine |

### camera
| 파일 | 하는 일 |
|---|---|
| `orientation.ts` | three 없는 순수 각 계산 — turn/tilt, 시점 기준 방향, 좌우 읽기 |
| `camera.ts` | orientation 결과를 three PerspectiveCamera 에 얹고 몸을 따라간다 |

| export | 종류 | 시그니처 요약 | 용도 | 사용처 |
|---|---|---|---|---|
| `ViewOrientation` · `PlaneDirection` | type | `{ turn; tilt }` · `{ x; z }` | 시점 각 · 지면 방향 | engine |
| `DEFAULT_ORIENTATION` · `VIEW_DISTANCE` · `TILT_MIN` · `TILT_MAX` · `TERRAIN_CLEARANCE` | const | `{turn:0, tilt:π/6}` · `15` · `25°` · `45°` · `1.2` | 시점 상수 | engine / — / — / — / — |
| `clampTilt` · `wrapTurn` · `turned` · `viewForward` · `viewRight` · `worldDirection` | fn | `(tilt)=>n` · `(turn)=>n` · `(cur, dTurn, dTilt) => ViewOrientation` · `(turn) => PlaneDirection` ×2 · `(turn, local) => PlaneDirection` | 각 갱신 · 시점 기준 → 세계 방향 | — / — / engine / — / — / engine |
| `screenSideValue` · `viewOffset` | fn | `(turn, facing) => number` · `(orientation) => { x; y; z }` | 몸 방향의 화면 좌우 값 · 카메라 오프셋 | content / engine |
| `createViewCamera` · `ViewCamera` | fn/type | `(aspect) => ViewCamera` · `{ camera; turn(dTurn, dTilt); orientation(); worldDirection(local); follow(player, groundHeight, terrainHeight) }` | 카메라 | engine / — |

### fx
| 파일 | 하는 일 |
|---|---|
| `effect-layer.ts` | 스플랫 런타임을 투명 WebGPU 캔버스로 화면 위에 얹고 이펙트를 켠다 |
| `splat/index.ts` | classic script 아홉(`*.js`, 바이트 그대로 반입, 수정 금지)의 적재 순서 |
| `splat-runtime.d.ts` | 런타임이 window 에 올리는 전역의 형 (`SplatEngine` · `SplatFxSystem` · `SplatGenes` · `SplatFxEvent` · `SplatFrameOptions`) |

| export | 종류 | 시그니처 요약 | 용도 | 사용처 |
|---|---|---|---|---|
| `createEffectLayer` | fn | `(container: HTMLElement, options?: EffectLayerOptions) => EffectLayer` | 층 생성 (WebGPU 없으면 supported=false) | engine, tools |
| `EffectLayer` | type | `{ supported; live(); names(); activeEffects(); snapshot(): Promise<EffectSnapshot\|null>; trigger(EffectEvent); render(EffectViewpoint, dt); dispose() }` | 층 핸들 | engine |
| `EffectLayerOptions` | type | `{ names?; splats?; worldScale?; onUnavailable? }` | 예산·배율 (컨텐츠 결정) | engine |
| `EffectEvent` · `EffectViewpoint` · `EffectPoint` · `EffectSnapshot` | type | `{ name; origin; dir?; strength?; roll?; radius?; scale? }` · `{ view; fovY; near; far; focus? }` · `{x;y;z}` · `{ width; height; bytesPerRow; pixels }` | 이펙트 켜기 · 시점 · 점 · 디버그 픽셀 | — |
| `SPLAT_RUNTIME_LOADED` | const | `true` | import 부작용 표식 | — |

### hud
| 파일 | 하는 일 |
|---|---|
| `hud.ts` | counter/flag 위젯·프롬프트·토스트·entity 라벨/판·타격 표시·대답 notice |
| `command-console.ts` | `SceneCommandSurface` 를 그리는 명령 표면 |
| `surface.ts` | 겹쳐 뜨는 표면(`SceneSurface[]`) — 자판을 잡는다 |
| `surface-focus.ts` / `surface-tip.ts` | 표면 안 자판 이동·Escape 뜻 / 곁말 펴는 방향 (순수 함수) |
| `slot-bar.ts` | 늘 서 있는 칸 띠(`SceneSlotBar[]`) |
| `target-frame.ts` | 화면 중앙 상단 판(`SceneTargetFrame`) |
| `touch-pad.ts` | 손가락용 행동 버튼 — 키 코드를 내놓는다 |

| export | 종류 | 시그니처 요약 | 용도 | 사용처 |
|---|---|---|---|---|
| `createHud` · `Hud` | fn/type | `(container) => Hud` · `{ render(scene, labels: EntityLabel[], session?, overlays?: HudOverlays); notice(text) }` | HUD | app / — |
| `EntityLabel` · `EntityPlate` · `StrikeMark` · `HudOverlays` | type | `{id;x;y;text}` · `{id;x;y;name;health;healthMaximum;healthRatio;downed;inspect?}` · `{x;y;text;emphasis;age;detail?;guard?}` · `{ plates; strikes }` | 몸 위 표시 입력 | app / app / app / — |
| `celebrationText` | fn | `(item: Pick<SceneHudItem,'celebrateText'>, previous, value) => string \| undefined` | `{}` 자리에 증가량 끼움 | — |
| `createCommandConsole` · `CommandConsole` · `CommandConsoleHandlers` | fn/type | `(container, handlers) => CommandConsole` · `{ render(SceneCommandSurface); capturing() }` · `{ onText; onSubmit; onClose }` | 명령 표면 | app / — / — |
| `createSurfaceLayer` · `SurfaceLayer` · `SurfaceHandlers` | fn/type | `(container, handlers, textOf?: CodeTextFn) => SurfaceLayer` · `{ render(SceneSurface[]); capturing() }` · `{ onClose; onPickCell?; onCommitCell?; onMenuCell?; onPressRow?; … }` | 겹침 표면 | — |
| `surfaceMarkup` · `groupSections` · `SURFACE_TEXT_CODES` | fn/const | `(surface, textOf?) => string` · `(sections) => SceneSurfaceSection[][]` · `['surface.close', 'surface.empty-cell', 'surface.state.*']` | DOM 없는 마크업 · 문구 코드 | tools / — / engine |
| `tabStopId` · `enterStop` · `escapeMeans` · `focusToClaim` · `SurfaceEscape` · `FocusClaim` | fn/type | `(ids, focusId)=>id?` · `(count, backwards)=>n` · `({anyOpen,inField,tipOpen}) => SurfaceEscape` · `({focusId,lastFocus,justOpened,typing}) => FocusClaim` · `'none'\|'leave-field'\|'close-tip'\|'close-surface'` · `{move:'none'}\|{move:'ring';id}\|{move:'enter'}` | 표면 자판 길 | engine ×4 / — / — |
| `tipPlacement` · `TipBox` · `TipSide` · `TipAlign` · `TipPlacement` | fn/type | `(cell, room, tip: {width;height}, gap) => TipPlacement` · 상자 · `'below'\|'above'` · `'center'\|'start'\|'end'` · `{ side; align }` | 곁말 방향 | engine / — ×4 |
| `createSlotBarLayer` · `slotBarMarkup` · `SlotBarLayer` · `SlotBarHandlers` · `SLOT_BAR_TEXT_CODES` | fn/type/const | `(container, handlers, textOf?) => SlotBarLayer` · `(bar, textOf?) => string` · `{ render(bars) }` · `{ onPress(cellId) }` · `['slot.key','slot.no-key']` | 칸 띠 | — / — / — / — / engine |
| `createTargetFrame` · `targetFrameMarkup` · `TargetFrameLayer` | fn/type | `(container) => TargetFrameLayer` · `(frame) => string` · `{ render(frame?: SceneTargetFrame) }` | 상단 판 | app / — / — |
| `createTouchPad` · `touchActionViews` · `TouchPad` · `TouchActionView` | fn/type | `(container, textOf?) => TouchPad` · `(scene) => TouchActionView[]` · `{ render(scene, stick: StickView, visible); consumePresses() }` · `{ code; label; available; reason? }` | 손가락 버튼 | — |

### input
| 파일 | 하는 일 |
|---|---|
| `keyboard.ts` | 이동/시점 키 추적 + 그 외 키 코드 소비 |
| `pointer.ts` | 오른쪽 끌기로 시점 회전 |
| `pointer-intent.ts` | 화면 집기 결과(`PointerPick`)를 요청으로 옮기는 정책의 형 |
| `input.ts` | 클릭 → renderer 에 집기 → 정책 → 요청 발신 |
| `touch.ts` | 가상 스틱 + 탭 |
| `bindings.ts` | 팩 등록 특수 키 규칙(`KeyBinding`)과 dispatch |
| `engine-keys.ts` | 기반이 먼저 가져가는 키의 단일 출처 |
| `focus.ts` | 목록/격자에서 다음 초점 산수 |

| export | 종류 | 시그니처 요약 | 용도 | 사용처 |
|---|---|---|---|---|
| `attachKeyboard` · `KeyboardState` | fn/type | `() => KeyboardState` · `{ direction(); turn(); consumeKeyPresses(); suspendMovement(bool) }` | window 키 리스너 | app / — |
| `MOVE_KEY_CODES` · `TURN_KEY_CODES` | const | `readonly string[]` | 이동/시점 키 코드 | engine |
| `attachPointerLook` · `LookSink` · `TURN_PER_PIXEL` · `TILT_PER_PIXEL` | fn/type/const | `(element, look: LookSink) => void` · `(dTurn, dTilt) => void` · `0.006` · `0.004` | 끌어서 시점 | app / engine / engine / engine |
| `PointerPick` · `PointerIntent` | type | `{ entityId: string\|null; ground: {x;z}\|null; modifiers: {alt;shift;ctrl;meta} }` · `(pick) => ActionRequest \| null` | 집힌 것 · 그 뜻 (조립이 준다) | app,content,engine / engine |
| `attachInput` · `pickAt` · `ActionSink` | fn/type | `(renderer: GameRenderer, send: ActionSink, intent: PointerIntent) => void` · `(renderer, clientX, clientY, modifiers) => PointerPick` · `(action) => void` | 클릭 리스너 · 집기 · 발신 | app / — / — |
| `attachTouchControls` · `TouchControls` · `StickView` | fn/type | `(element, look: LookSink) => TouchControls` · `{ direction(); stick(); tapSuppressed(now); engaged() }` · `{ active; originX; originY; knobX; knobY }` | 터치 스틱 | — / — / engine |
| `stickVector` · `clampKnob` · `STICK_RADIUS` · `STICK_DEADZONE` · `TAP_SLOP` · `TAP_SUPPRESS_MS` | fn/const | `(dx, dy) => {x;z}\|null` · `(dx, dy) => {x;y}` · `56` · `10` · `12` · `400` | 스틱 산수·상수 | — |
| `KeyBinding` · `BindingSend` · `dispatchKey` | type/fn | `{ code: string; invoke(scene: SceneState, send: BindingSend): boolean \| void }` · `(action) => number \| null` · `(bindings, code, scene, send) => boolean` | 팩 특수 키 규칙 · 가져간 바인딩 있으면 true | content / — / app |
| `ENGINE_KEYS` · `EngineKeyId` · `engineKeyCode` · `ENGINE_KEY_CODES` | const/type/fn | `{ command:['Slash']; move; turn; colliderObserve:['KeyC']; attributeInspect:['KeyV'] }` · `keyof ENGINE_KEYS` · `(id) => string` · 전체 코드 목록 | 예약 키 | — / engine / engine / — |
| `engineKeyTextCode` · `ENGINE_KEY_TEXT_CODES` | fn/const | `(id) => 'engine.key.<id>'` · 목록 | 문구 코드 | engine |
| `nextIndex` · `moveFocus` · `moveFocusGrid` | fn | `(count, at, delta)=>n` · `(ids, current, delta)=>id?` · `(ids, current, columns, {dx?,dy?})=>id?` | 초점 이동 | engine / — / — |

### motion
| 파일 | 하는 일 |
|---|---|
| `motion-format.ts` | `motions/<kind>/<action>[.opt…].png` 경로 파싱 |
| `motion-geometry.ts` | 시트 안 프레임 기하(정적 분석 결과)와 UV/크기 |
| `motion-library.ts` | (kind, action) → MotionAsset 색인 |
| `motion-frame.ts` | SceneMotion + 시각 → 프레임 번호/UV |

| export | 종류 | 시그니처 요약 | 용도 | 사용처 |
|---|---|---|---|---|
| `parseMotionPath` · `MotionAsset` | fn/type | `(path, url) => MotionAsset \| null` · `{ id; characterKind; action; url; path; cols; rows; frames; fps; play: MotionPlay }` | 경로 규약 파싱 | engine, tools |
| `MotionPlay` · `DEFAULT_FPS` · `ROOT_DIR` | type/const | `'loop'\|'once'` · `8` · `'motions'` | 규약 상수 | — / — / tools |
| `MotionGeometry` · `MotionFrameGeometry` · `PixelRect` · `MotionAtlas` | type | `{ sheet; cols; rows; refHeightPx; frames; warnings }` · `{ rect; content; anchor }` · `[x,y,w,h]` · `Readonly<Record<path, MotionGeometry>>` | 프레임 기하 · 팩이 주입하는 아틀라스 | engine,tools / tools / — / content,tools |
| `uniformGeometry` · `frameUv` · `frameWorldSize` | fn | `(w, h, cols, rows) => MotionGeometry` · `(geometry, frame, insetTexels = 0) => uv` · `(geometry, frame, size) => {width;height}` | 기하 산수 | engine |
| `createMotionLibrary` · `MotionLibrary` | fn/type | `(sources: Record<string,string>, atlas?: MotionAtlas) => MotionLibrary` · `{ resolve(kind, action): MotionAsset\|null; geometry(asset); all() }` | glob 결과로 색인 · 조회 | content |
| `EMPTY_MOTION_LIBRARY` · `FALLBACK_ACTION` | const | 빈 라이브러리 · `'idle'` | 기본값 | — |
| `motionFrameIndex` · `motionFrameUv` | fn | `(motion: SceneMotion, timeSeconds) => number` · `(motion, frame) => uv` | 프레임 선택 | engine / — |

### net
| 파일 | 하는 일 |
|---|---|
| `world-link.ts` | 관찰자 ↔ 세계 이어짐 — join·재접속·표식·대답 수거·stale 판정 |
| `link-telemetry.ts` | 관찰자 쪽 왕복/도착률 측정 |
| `observer-identity.ts` | 저장소에서 관찰자 Id 를 읽거나 생성 |
| `pending.ts` | 보낸 요청과 대답을 표식으로 짚어 맞추는 표 |

| export | 종류 | 시그니처 요약 | 용도 | 사용처 |
|---|---|---|---|---|
| `createWorldLink` · `browserSocketFactory` | fn | `(connect: SocketFactory, observerId, schedule?, now?, address = '') => WorldLink` · `(url) => SocketFactory` | 이어짐 생성 · WebSocket 기반 | app |
| `WorldLink` | type | `{ send(action): boolean; sendMarked(action): number\|null; takeOutcomes(); latest(); state(): LinkState; poll(nowMs); stale(); telemetry(nowMs); address(); close() }` | 이어짐 핸들 | — |
| `SocketFactory` · `LinkSocket` · `LinkHandlers` · `Scheduler` | type | `(handlers) => LinkSocket` · `{ send; close }` · `{ onOpen; onMessage(raw); onClose }` · `(fn, ms) => void` | 주입 계약 | — |
| `OBSERVATION_TIMEOUT_MS` · `POLL_STALL_MS` · `MARK_INTERVAL_MS` · `RETRY_DELAYS_MS` | const | `1500` · `100` · `500` · `[300,600,1200,2400,5000]` | 이어짐 상수 | — |
| `createLinkTelemetry` · `LinkTelemetry` · `LinkTelemetryRecorder` | fn/type | `() => LinkTelemetryRecorder` · `{ roundTripMs; arrivalRatePerSecond; sinceLastObservationMs; sentCount; reconnectCount }` · `{ recordSent; recordMarkSent; recordObservation; recordReconnect; read(nowMs) }` | 측정 | engine / engine / — |
| `ARRIVAL_WINDOW_MS` · `PENDING_MARK_LIMIT` | const | `2000` · `64` | 측정 상수 | — |
| `resolveObserverId` · `browserIdentityStorage` · `IdentityStorage` · `IDENTITY_KEY` | fn/type/const | `(storage, generate?) => string` · `() => IdentityStorage` · `{ getItem(key): string\|null; setItem(key, value) }` · `'hkt.observer.id'` | Id 확보 | app / app / — / — |
| `createPendingRequests` · `PendingRequests` | fn/type | `<T>() => PendingRequests<T>` · `{ add(mark, value): boolean; resolve(mark): T?; waiting(match); values(); size(); clear() }` | 기다림 표 | — |

### presentation
| 파일 | 하는 일 |
|---|---|
| `code-text.ts` | 문구 코드 → 말 변환 함수의 형과 기본값 |
| `text-codes.ts` | 기반이 부르는 문구 코드 전부(팩이 덮어야 할 목록) |
| `command-presentation.ts` | 명령 표면 결정 — 목록·자리 채우기·문장 합성·호출 해석 |
| `facing-presentation.ts` | 몸 방향 → 그림 좌우 |
| `collision-presentation.ts` | Snapshot 의 body/swing → 충돌체 디버그 지시 |
| `link-presentation.ts` / `session-presentation.ts` | 이어짐 수치/상태 → 화면 줄 |

| export | 종류 | 시그니처 요약 | 용도 | 사용처 |
|---|---|---|---|---|
| `CodeTextFn` · `RAW_CODE` · `ENGINE_TEXT_CODES` | type/const | `(code, detail?) => string` · 코드를 그대로 돌려주는 기본값 · COMMAND+SURFACE+SLOT_BAR+ENGINE_KEY+SESSION+LINK 코드 합집합 | 문구 변환 계약 · 팩이 덮을 목록 | engine / engine / — |
| `COMMAND_TEXT_CODES` · `LINK_TEXT_CODES` · `SESSION_TEXT_CODES` | const | `readonly string[]` | 문구 코드 | engine |
| `commandEntries` · `composeCommand` · `invocationOf` | fn | `(snapshot, observerStates, textOf?) => SceneCommandEntry[]` · `(text, entries, snapshot, observerStates, textOf?) => SceneCommandComposition` · `(…같음) => CommandInvocation` | 명령 목록 · 입력 중 상태 · Enter 해석 | content / content / app |
| `fillSlots` · `CommandFill` · `CommandInvocation` | fn/type | `(parameters: CommandParameterView[], words, snapshot) => CommandFill` · `{ filled; leftover }` · `{kind:'world';commandId;values}\|{kind:'observer';commandId}\|{kind:'rejected';problem}` | 자리 채우기 · 호출 결과 | — |
| `ObserverCommandId` · `OBSERVER_COMMANDS` · `ObserverCommandStates` | type/const/type | `'collider-observe'\|'attribute-inspect'` · 정의 목록 · `Record<Id, boolean>` | 관찰자 쪽 명령 | app / — / — |
| `facingDecision` · `readSide` · `ScreenSide` · `FacingDecision` · `DEFAULT_SPRITE_BASELINE` · `AMBIGUOUS_BAND` | fn/type/const | `(baseline, screenSide, previous) => FacingDecision` · `(screenSide, previous, baseline) => ScreenSide` · `'left'\|'right'` · `{ side; flip }` · `'right'` · `0.12` | 좌우 읽기 | content / — / app,content / — / — / — |
| `collisionDebug` | fn | `(snapshot: GameViewSnapshot) => SceneColliderDebug` | 충돌체 디버그 지시 | content |
| `telemetryLines` · `bindingLines` · `LinkLine` · `LinkBinding` | fn/type | `(telemetry, textOf?) => LinkLine[]` · `(binding, textOf?) => LinkLine[]` · `{ id; label; value; grade? }` · `{ observerId; characterId; worldAddress }` | 이어짐 줄 | app / app / engine / — |
| `sessionPresentation` · `SessionPresentation` | fn/type | `(state: LinkState, stale, telemetry?, binding?, textOf?) => SessionPresentation` · `{ state; text; stale; telemetry; binding }` | 세션 표시 | app / engine |

### renderer · scene · sprites · terrain
| 파일 | 하는 일 |
|---|---|
| `renderer/renderer.ts` | SceneState 를 three.js 로 — billboard·terrain·zones·highlight·camera follow·effects |
| `scene/scene-state.ts` | Render Plan 형 — Capability 층의 유일한 입력 |
| `scene/interaction-choice.ts` | 한 키에 여럿 걸릴 때 거리로 고르기 |
| `sprites/billboard.ts` | 모션 시트 또는 절차 픽셀아트를 카메라 향한 Sprite 로 |
| `terrain/terrain.ts` | `CompiledViewTerrain` chunk 를 mesh 로, 높이 샘플러 |
| `terrain/ground-fill.ts` | 지형을 따라가는 구역 채움 기하 |

| export | 종류 | 시그니처 요약 | 용도 | 사용처 |
|---|---|---|---|---|
| `createRenderer` · `RendererOptions` | fn/type | `(container, options?) => GameRenderer` · `{ effects?: EffectLayerOptions }` | 렌더러 생성 · 이펙트 예산 주입 | app / — |
| `GameRenderer` | type | `{ render(state, dt?); setTerrain({world, view}, palette: TerrainPalette); pickGround; pickEntity; worldToScreen(x, z, yOffset); drawnPosition(id); turnView; viewTurn(); viewWorldDirection(local); domElement }` | 렌더러 표면 | engine |
| `highlightCenter` · `sceneAmbience` · `sameAmbience` · `DEFAULT_AMBIENCE` | fn/const | `(highlight, drawnPositionOf) => {x;z}\|null` · `(ambience?) => SceneAmbience` · `(a, b) => boolean` · 기본 분위기 | 순수 보조 | — |
| `SceneState` | type | `{ specId; terrain; entities; interactions; hud; colliderDebug?; self?; strikes; effects; worldTime; commandSurface; surfaces; slotBars; zones; keyHints?; highlight?; targetFrame?; ambience? }` | Render Plan | app, content, engine |
| `SceneEntity` · `SceneMotion` · `SceneNameplate` · `SceneSelf` · `SceneStrike` · `SceneEffect` · `SceneInteraction` · `SceneHudItem` | type | 존재·모션·이름판·자기·타격·이펙트·상호작용·HUD 항목 | Plan 원소 | — / content,engine / content / content / content / — / engine / engine |
| `SceneColliderDebug` · `SceneDebugCapsule` · `SceneDebugSphere` · `SceneDebugVector` | type | 충돌체 디버그 지시 | Plan 원소 | engine |
| `SceneCommandSurface` · `SceneCommandEntry` · `SceneCommandSlot` · `SceneCommandComposition` · `SceneCommandHistoryLine` | type | 명령 표면 지시 | Plan 원소 | content,engine / engine / engine / engine / app,content |
| `SceneSurface` · `SceneSurfaceSection` · `SceneSurfaceRow` · `SceneSurfaceCell` · `SceneSurfaceField` · `SceneSurfaceRowState` · `SceneSurfaceShape` | type | 겹침 표면 지시 | Plan 원소 | engine,tools / engine / — ×5 |
| `SceneSlotBar` · `SceneSlotCell` · `SceneSlotState` · `SceneTargetFrame` · `SceneFrameRow` · `SceneFrameLogLine` | type | 칸 띠 · 상단 판 지시 | Plan 원소 | engine / — / — / content,engine / content / content |
| `SceneGroundZone` · `SceneHighlight` · `SceneAmbience` | type | 지면 구역 · 지목 강조 · 분위기 | Plan 원소 | content,engine |
| `chooseByKey` · `choosePrompt` · `selfPosition` · `targetDistance` | fn | `(scene, code) => SceneInteraction?` · `(scene) => SceneInteraction?` · `(scene) => {x;z}?` · `(scene, interaction) => number` | 키의 뜻 고르기 | app / engine / — / — |
| `createBillboard` · `Billboard` · `BillboardAppearance` | fn/type | `(appearance, timeSeconds = 0) => Billboard` · `{ object: THREE.Sprite; setAppearance; setPosition }` · `{ spriteId; size; motion?; tint?; flip? }` | 스프라이트 | engine / engine / — |
| `createTerrain` · `terrainHeightSampler` · `TerrainPalette` | fn/type | `(view: CompiledViewTerrain, palette) => THREE.Object3D` · `(world: CompiledWorldTerrain) => (x, z) => number` · `{ colorOf(surfaceTag): number; instanceOf?(tag): {spriteId; worldHeight}\|null }` | 지형 그리기·높이 · 태그 → 색/그림 (컨텐츠 결정) | engine / engine / content,engine |
| `createGroundFill` · `GroundFillShape` · `GroundFillOptions` | fn/type | `(shape, options) => THREE.BufferGeometry` · polygon\|circle · `{ step; lift; heightAt }` | 구역 채움 | engine / engine / — |

**content 가 채우는 것** — `SpriteSheet`(그림 표) · `TerrainPalette`(태그 → 색/instance) · `MotionAtlas` + 모션 시트 glob · `KeyBinding[]`(특수 키 규칙) · `PointerIntent`(클릭의 뜻) · `CodeTextFn`(`ENGINE_TEXT_CODES` 전부를 덮는 문구 표) · `EffectLayerOptions.names`(이펙트 예산) · `SceneState` 를 만드는 결정 Layer 전체(스냅샷 → Render Plan).

## protocol-core

World ↔ View 사이를 오가는 봉투의 구조만 있다. 존재의 role/state/kind, interaction id, HUD id, 명령 효과 코드, 거절 사유 코드는 전부 불투명 문자열이며 그 뜻은 팩의 `protocol/` 이 확장해 소유한다.

| 파일 | 하는 일 |
|---|---|
| `actions.ts` | View → World 요청 봉투와 판정 결과 |
| `gameview.ts` | World → View 관찰 결과 봉투 (존재·interaction·HUD·명령 카탈로그·대답) |
| `transport.ts` | WebSocket 메시지 형과 파서 |
| `semantic-id.ts` | Engine 이 소유하는 RULE/INTENT 식별자 상수 |

| export | 종류 | 시그니처 요약 | 용도 | 사용처 |
|---|---|---|---|---|
| `ActionRequest` · `ActionResult` | type | `{ interactionId; position?: {x;z}; targetEntityId?; mark? }` · `{status:'success';rule}\|{status:'failure';rule;reason}` | 요청 봉투 (팩이 확장) · 판정 결과 | content,server,engine / content (re-export),engine |
| `GameViewSnapshot` | type | `{ specId; scene; observer: ObserverView; entities; interactions; hud; debug; commands; region?: {id;hash} }` | 관찰 결과 봉투 | content, server, engine |
| `EntityView` · `BodyView` · `SwingView` | type | `{ id; role; state; name?; position; labelValue?; kind?; progress?; targetEntityId?; attended?; body?; swing? }` · `{ radius; height; mass; facing; velocity }` · `{ center; radius; active; struck }` | 존재 · 몸/행동 충돌체 | content,engine / — / — |
| `GameViewPosition` · `InteractionView` | type | `{ x; z }` · `{ id; role; targetEntityId?; available; reason? }` | 자리 · 걸 수 있는 interaction | content |
| `HudItemView` · `ObserverView` · `DebugAuthorityView` | type | `{ id; kind: 'counter'\|'flag'\|'label'; value; progress? }` · `{ id; characterId; acknowledgedMark }` · `{ open }` | HUD 항목 · 수신자 · 속성 변경 허용 | — |
| `CommandView` · `CommandParameterView` · `CommandDomainView` · `CommandDomainOptionView` · `CommandDomainKind` | type | `{ id; effect; available; reason?; parameters }` · `{ id; required; omittedMeaning?; domain }` · `{ kind; refers?; options?; minimum?; maximum? }` · `{ name; thenDomain? }` · `'entity'\|'choice'\|'number'\|'text'\|'from-previous-choice'` | 명령 카탈로그 | engine ×3 / — / — |
| `RequestOutcomeView` | type | `{ accepted; rule; reason?; mark? }` | 요청 하나의 대답 | server, engine |
| `TRANSPORT_PATH` | const | `'/world'` | WebSocket 경로 | app, server |
| `ObservationMessage` · `OutcomeMessage` · `ServerMessage` · `JoinMessage` · `ActionMessage` · `MarkMessage` · `ClientMessage` | type | `{type:'observation';snapshot}` · `{type:'outcome';outcomes}` · 합집합 · `{type:'join';observerId}` · `{type:'action';action}` · `{type:'mark';mark}` · 합집합 | 세계 → 관찰자 셋 · 관찰자 → 세계 넷 | server / server / — / engine / engine / engine / — |
| `parseServerMessage` · `parseClientMessage` · `LinkState` | fn/type | `(raw: string) => ServerMessage \| null` · `(raw) => ClientMessage \| null` · `'connecting'\|'connected'\|'disconnected'` | JSON 파싱·형 검사 · 이어짐 상태(관찰자 소유) | engine / server / engine |
| `RULE_OBSERVER_JOIN` · `RULE_OBSERVER_LEAVE` · `RULE_OBSERVER_MARK` · `RULE_REQUEST_REPLY` · `RULE_WORLD_TICK` · `INTENT_*` (10) · `SemanticIdentifier` | const/type | `'RULE-…-001'` / `'INTENT-…-001'` 문자열 · `string` | Rule/Intent 식별자 | engine ×3 / — |

## world-authoring

Region Description(순서 있는 op 목록)을 Source of Truth 로 두고, 컴파일·조회·그래프·검사·관찰·뼈대 생성·등급·초안 고리를 제공한다. layer·tag·reason·transition·depth·role 은 전부 불투명 문자열이며, 어느 layer 가 anchor 인지·어떤 태그가 어휘인지는 `CompileRules` · `CheckContract` · `AuthorTemplates` · `WorldContracts` 로 컨텐츠가 준다. 순수·결정론 — Math.random·Date·fs 를 쓰지 않는다.

| 파일 | 하는 일 |
|---|---|
| `description.ts` | `RegionDescription` 과 op 넷(point·stamp·curve·area), 조회, 결정적 hash |
| `compiled.ts` | 컴파일 산출물·규칙 형 (`CompiledWorldTerrain` · `CompiledViewTerrain` · `CompileRules`) |
| `height-field.ts` | extent/resolution 격자에 stamp·curve 를 ops 순서로 적용, 높이·경사 샘플 |
| `surface.ts` | 경사·curve 근접으로 표면 태그 표 평가 |
| `compile.ts` | `compileRegion` — 격자 → 세계 격자 + View chunk + hash |
| `query.ts` | 컴파일 결과에 자리로 묻기 (통행·사유·표면·area 태그) |
| `observe.ts` | 컴파일 결과를 raster 판·요약 수치로 |
| `graph.ts` | Region 사이의 Connector/Containment 와 도달 계산 |
| `check.ts` | 검사 ①~㊻ (`checkGraph` · `checkRegions`) 와 열쇠×자물쇠 표 — ㊸ 은 원천 · 경로 · 태어남을 **양쪽으로** 잰다 |
| `condition.ts` | Condition 형(Target · Query · Operator · Value · Qualifier · all/any) 과 평가기 — 게임 명사 0 · 저장 0 |
| `opportunity.ts` | Opportunity 형(id · region · availability · discovery · target · possibleActions · progress · outcomes) · Mutation op 어휘 · Event 판별(`isEventOpportunity` — 시간 qualifier 가 있는가) · 기계 표기 — 게임 명사 0 · 판정 0 |
| `candidate.ts` | 두 CheckReport 의 달라진 줄 |
| `brief.ts` | `RegionBrief`(열 답 — 여덟째 탄생은 탄생지·개체군까지, 아홉째 물음은 Lock·흔적까지, 열째는 내밂) zod 스키마와 파서 |
| `author.ts` | brief + 템플릿 → 방 뼈대(Description·Connector·원천·생명·철·물음) |
| `grade.ts` | brief 를 계약 목록(성질 어휘 · 물음의 자리와 세기 포함)과 **결정 나무**로 대조해 A/B/C |
| `draft.ts` | 미지 한 줄 → brief 되먹임 고리와 시스템 글 |

| export | 종류 | 시그니처 요약 | 용도 | 사용처 |
|---|---|---|---|---|
| `RegionDescription` | type | `{ id; extent: Extent; seed; ops: RegionOp[] }` | Local Space 원본 | content, engine |
| `RegionOp` = `PointOp`\|`StampOp`\|`CurveOp`\|`AreaOp` | type | `{id;kind:'point';layer;tag;position}` / `{kind:'stamp';stamp:'hill'\|'ridge'\|'basin';center;radius;height;falloff?}` / `{kind:'curve';layer;tag;points;width;profile?:'carve';depth?}` / `{kind:'area';layer;tag;shape}` | 편집 넷 | engine,tools / engine ×3 / content,engine |
| `XZ` · `Extent` · `extentContains` · `extentPolygon` · `extentCenter` | type/fn | `{x;z}` · `{minX;maxX;minZ;maxZ}` · `(extent, p) => boolean` · `(extent) => XZ[4]` · `(extent) => XZ` | 좌표·범위 산수 (compiled.ts 에도 `XZ` 재정의) | content,engine / content,engine,tools / content / content / — |
| `pointsOf` · `areasOf` · `curvesOf` · `findPoint` | fn | `(d, layer) => PointOp[]` · `(d, layer) => AreaOp[]` · `(d, layer, tag) => CurveOp[]` · `(d, layer, tag) => PointOp?` | ops 순서 조회 | content,engine(,tools) |
| `distanceToPolyline` · `nearestCurveDistance` · `polylineStrip` · `descriptionHash` | fn | `(points, x, z) => number` · `(curves, x, z) => number` · `(points, width) => XZ[]` · `(d) => string` (8-hex FNV-1a) | 선 기하 · 같은 Description → 같은 값 | engine / engine / content / content,engine |
| `CompileRules` · `SurfaceRule` · `BlockRule` · `PassRule` | type | `{ resolution; surface; blocked?; passages?; instanceLayers? }` · `{ tag; maxSlope?; nearCurve? }` · `{ minSlope?; nearCurve?; nearPoint?; reason }` · `{ layer; tag; radius }` | 컴파일 규칙 (컨텐츠가 준다) | content, engine |
| `compileRegion` · `regionHash` · `DEFAULT_CHUNK_SIZE` | fn/const | `(description, rules, options?: { chunkSize? }) => CompiledRegion` · `(description, rules) => string` · `32` | 컴파일 · (description, rules) hash · chunk 칸 수 | content,tools / — / — |
| `CompiledRegion` · `CompiledWorldTerrain` | type | `{ world; view; hash }` · `{ extent; resolution; cols; rows; height: Float32Array; surface; surfaceTags; traversable; blocked; blockedTags; areas; points }` | 산출물 · 세계 규칙이 읽는 격자 | content, engine, tools |
| `CompiledViewTerrain` · `HeightField` · `AreaShape` | type | `{ chunkSize; chunks[{ix;iz;cols;rows;positions;surface}]; surfaceTags; instances[{tag;position;y}] }` · `{ extent; resolution; cols; rows; height }` · polygon\|circle | View chunk · 격자 · 모양 | engine |
| `buildHeightField` · `sampleHeight` · `slopeAtVertex` · `vertexX` · `vertexZ` · `heightAtVertex` · `sampleSlope` | fn | `(description, resolution) => HeightField` · `(field, x, z) => number` · `(field, ix, iz) => rad` · `(field, ix) => x` · `(field, iz) => z` · `(field, ix, iz) => number` · `(field, x, z) => rad` | 격자 생성·샘플 | engine ×5 / — / — |
| `evaluateSurface` · `DEFAULT_SURFACE_TAG` | fn/const | `(field, rules: SurfaceRule[], description?) => { surface; surfaceTags }` · `'default'` | 표면 태그 평가 | engine / — |
| `isTraversableAt` · `blockedReasonAt` · `surfaceAt` · `tagsAt` · `areaCoversPoint` | fn | `(world, x, z) => boolean` · `=> string\|null` · `=> string\|null` · `(world, x, z, layer) => string[]` · `(shape, x, z) => boolean` | 자리로 묻기 (격자 밖은 통행 가능) | content(,engine) |
| `rasterHeight` · `rasterSurface` · `rasterTraversable` · `rasterSemantic` · `RasterMap` | fn/type | `(world) => RasterMap` ×3 · `(world, layer) => RasterMap` · `{ width; height; values: Uint8Array; legend; range? }` | 격자 1:1 값 판 | tools (rasterSemantic 은 engine 도) |
| `summarize` · `TerrainSummary` | fn/type | `(region: CompiledRegion) => TerrainSummary` · 격자·태그별 칸 수·chunk·instance 수 | 보고 수치 | tools |
| `RegionGraph` · `Connector` · `ConnectorEnd` · `ConnectorExit` | type | `{ regions; containment[{parent;child}]; connectors; frontiers? }` · `{ id; from; to; direction: 'bidirectional'\|'one-way'; transition }` · `{ region; anchor }` · `{ connector; here; there }` | Region 사이 | content,engine / — / engine / content |
| `exitsOf` · `findConnector` · `isFrontier` · `reachableRegions` · `reachableRegionsExcept` | fn | `(graph, regionId) => ConnectorExit[]` · `(graph, id) => Connector?` · `(graph, regionId) => boolean` · `(graph, start) => string[]` · `(graph, start, blockedConnectorIds) => string[]` | 그래프 조회 · BFS 도달 (connectors 순서) | content,engine / content / engine / engine / engine |
| `checkGraph` · `GraphIssue` · `GraphIssueCode` | fn/type | `(descriptions, graph, anchorLayer, startRegion?) => GraphIssue[]` · `{ code; region; detail }` · `'unknown-region'\|'missing-anchor'\|'no-exit'\|'frontier-built'\|'unused-frontier'\|'unreachable'\|'containment-unlinked'` | 그래프 정합 | tools / — / — |
| `checkRegions` · `CheckRegionsInput` | fn/type | `(input) => CheckReport` · `{ regions: CheckRegion[]; graph; contract: CheckContract; compile?: RegionCompiler; ecology?; time?; life?; access?; memory?; condition? }` | 검사 ①~㊾ 한 번에 (없는 계통은 absent) | tools |
| `CheckCondition` · `CheckConditionSite` · `CheckConditionVocabulary` · `CheckConditionQueryRule` · `CONDITION_ITEM` | type/const | `{ sites: { where; condition }[]; vocabulary: { targets: Partial<Record<TargetKind, string[]>>; queries: { target; query; paths? }[] } }` · `{ mark '㊹'; id 'condition-refs' }` | ㊹ 조건의 참조 무결 — 잎마다 Target 갈래·ref · Query·path · Operator·value 형 · qualifier 형. 자리만인 Target 은 ref 없이 선다 | tools |
| `Condition` · `ConditionLeaf` · `ConditionAll` · `ConditionAny` · `ConditionTarget` · `ConditionQuery` · `ConditionOperator` · `ConditionQualifier`(Time · Change) · `ConditionValue` · `ConditionVerdict` | type | `{ target: { kind; ref? }; query: { kind; path? }; operator; value?; qualifier?; chance? }` · `{ all }` / `{ any }` · `'met'\|'unmet'\|'undecidable'` | 조건의 한 형 — Target 여덟 + 자리 셋(actor · player · faction) · Query 다섯 + 자리 다섯 · Operator 아홉 · qualifier 하나까지 | content |
| `evaluateCondition` · `ConditionRead` · `UNREADABLE` | fn/type/const | `(condition, read) => ConditionVerdict` · `{ value(leaf); previous?(leaf); heldSince?(leaf); now? }` | 판정 셋 — 자리만인 것 · 읽을 수 없는 것 · 직전 값 없는 change · now 없는 time 은 판정 불가(거짓이 아니다). undefined 는 EXISTS 의 거짓. all/any 에서 판정 불가는 위로 오른다 | content · tools |
| `conditionLeaves` · `formatConditionLeaf` · `isConditionGroup` · `DECIDABLE_/DEFERRED_/SINGLETON_TARGET_KINDS` · `DECIDABLE_/DEFERRED_QUERY_KINDS` · `CONDITION_OPERATORS` · `VALUELESS_OPERATORS` · `TIME_/CHANGE_QUALIFIER_MODES` | fn/const | `(condition) => ConditionLeaf[]` · `(leaf) => string`(`kind(ref).query(path) OP value [qualifier]`) | 잎 펴기 · 기계 표기 · 어휘 상수 | content · tools |
| `CheckRegion` · `CheckContract` · `RegionCompiler` | type | `{ id; depth; space; coreRules }` · `{ anchorLayer; resourceLayer; hazardLayer; phenomenonLayer; settlementLayer; settlementTags; conditionPrefix; traceLayer; lifeSiteTags?; startRegion? }` · `(region: CheckRegion) => CompiledWorldTerrain` | 방 · 게임 명사 건네는 계약 · 컴파일러 | tools / tools / — |
| `CheckReport` · `CheckItem` · `CheckRef` · `CheckStatus` | type | `{ ok; counts; items }` · `{ mark; id; name; status; answer; refs }` · `{ where; detail }` · `'pass'\|'fail'\|'absent'\|'report'` | 보고 | engine,tools / engine,tools / — / — |
| `CheckEcology` (+ `CheckEcologyMaterial` · `CheckEcologySource` · `CheckEcologyFlow`) | type | `{ materials; sources; flows; regions[{id;isolationReason}] }` | 재료 계통 (⑩~㉒ · ㊾ 캘 횟수) | tools / — / tools / — |
| `CheckTime` (+ `CheckTimePhase` · `CheckTimeRoute` · `CheckTimeConnector` · `CheckTimeSource`) | type | `{ seasons; dayPhases; presenceLayer; phases; routes; seasonalConnectors; seasonalSources; sourceIds }` | 시간 계약 (㉓~㉖) | tools / tools / tools / — / — |
| `CheckLife` (+ `CheckLifeFormation` · `CheckLifePopulation` · `CheckLifeLink` · `CheckLifeRecovery` · `CheckLifeAbsence`) | type | `{ formations; populations; links; lifeRecoveries; regionRules; residueSourceIds; … }` | 생명 계통 (㉗~㉝) | tools |
| `CheckAccess` (+ `CheckAccessAnswerRule` · `CheckAccessRequirement` · `CheckAccessLock` · `CheckAccessSeed` · `CheckAccessSeedProperty` · `CheckAccessSeedSource`) | type | `{ aspects; relations; tagSeparator; statementKinds; answerKinds; supportKind; connectorLockKind; areaLockKind; answers; locks; seeds; seedSources; silences? }` | 접근 계약 (㉞~㊷ ㊽ — ㊽ 은 묻지 않는 방의 사유, 판정하지 않는다) | tools / — ×6 |
| `accessAnswerMap` · `AccessAnswerRow` · `AccessAnswerCell` | fn/type | `(input: CheckRegionsInput) => AccessAnswerRow[]` · `{ lock; region; important; requirements; cells }` · `{ kind; answers[{id;property;regions}] }` | 열쇠×자물쇠 표 | tools |
| `checkShifts` · `CheckShift` | fn/type | `(before: CheckReport, after: CheckReport) => CheckShift[]` · `{ mark; id; name; before?; after; broke }` | 후보 전후 차이 | tools |
| `RegionBriefSchema` · `RegionBrief` | const/type | zod strictObject `{ id; name; depth; kinds; parent?; answers: RegionAnswers; neighbours; requires }` | 아홉 답 형 (아홉째 `offering` 은 없으면 미답) | tools / engine,tools |
| `AnswerSchema`·`WorthSchema`·`BirthSchema`·`RegionAnswersSchema`·`NeighbourSchema`·`RequirementSchema` (+ `z.infer` 타입 `Answer`·`Worth`·`Birth`·`RegionAnswers`·`Neighbour`·`Requirement`) | const/type | 답 = 문장 또는 `{ unanswered }` · 귀함(sources[]) · 탄생(born[]) · 이웃 · 요구(`kind: 'rule'\|'axis'\|'contract'`) | 하위 스키마 | — |
| `parseRegionBrief` · `BriefParse` · `BriefProblem` | fn/type | `(value: unknown) => BriefParse` · `{ok:true;brief}\|{ok:false;problems}` · `{ path; message }` | 던지지 않는 파서 | engine,tools / — / — |
| `ANSWER_ORDER` · `AnswerKey` · `answerOf` · `isUnanswered` · `unansweredKeys` | const/type/fn | 여덟 키 순서 · 그 합집합 · `(brief, key) => Answer` · `(answer) => boolean` · `(brief) => AnswerKey[]` | 답 접근 | engine,tools / engine / engine,tools / engine,tools / engine |
| `authorRegion` · `AuthorInput` · `AuthoredRegion` | fn/type | `(input) => AuthoredRegion` · `{ brief; templates: AuthorTemplates; compile?: (space) => CompiledWorldTerrain }` · `{ spec: AuthoredSpec; connectors: AuthoredConnector[]; name; neighbourAnchors; unanswered; unauthored }` | brief → 뼈대 (seed = briefSeed) | tools / — / tools |
| `AuthorTemplates` | type | `{ anchorLayer; resourceLayer; traceLayer; presenceLayer; depthLayer; hazardLayer; traceTag(level); byDepth: Record<depth, DepthDefaults>; depthFallback; terrainByKind: Record<kind, TerrainRecipe[]>; terrainFallback; sourceByRole: Record<role, SourceDefaults>; birthByMode: Record<mode, BirthDefaults>; stateRequirement: Record<state, StateRequirement>; population: PopulationDefaults; phaseByKind: Record<kind, PhaseRecipe[]>; clueLayer }` | 컨텐츠가 주는 템플릿 | content |
| `AskingSchema` · `Asking` · `AuthoredAccess` · `AuthoredLock` · `AuthoredLockRequirement` · `AuthoredLockTrace` | schema/type | `{ said; locks[]{id; at{kind;ref}; strength; important; requires[]{property?;seasons;state?;knowledge?}; traces[]; reason?} }`(미답 기본값) · `{ locks?; silence? }` · `{ id; at; strength; requires; important?; traces; reason? }` | ⑨~⑫ 물음 — brief 의 답과 생성기의 산출 (어휘는 계약이 안다) | engine,tools / — / tools / — ×3 |
| `BirthDefaults` · `StateRequirement` · `PopulationDefaults` · `PhaseRecipe` | type | `{ bindingSeconds; spentSeconds?; transition; populationRequirement?; sourceUnmetCode }` · `{ kind; unmetCode }` · `{ birthDisturbance?; radiusStep }` · `{ season; depth?; hazard? }` | 탄생 방식별·상태별·개체군·갈래별 철의 기본형 (전부 컨텐츠가 준다) | content |
| `AuthoredEcology` · `AuthoredLifeSite` · `AuthoredLifeRequirement` · `AuthoredPopulation` · `AuthoredLink` · `AuthoredPhases` · `AuthoredPhaseSeason` | type | `{ lifeFormation?; populations?; links?; absenceReason? }` · 컨텐츠 탄생지 표와 같은 키 차례 · `{ kind; sourceId?; populationId?; value?; unmetCode }` · `{ id; scale; declineCause; presence?; presenceOps?; birthDisturbance? }` · `{ from; to; kind; via? }` · `{ seasons }` · `{ depthOverlay?; hazardExtend? }` | 생성기가 내는 생명·철 (굳힌 글자가 컨텐츠 형으로 컴파일된다) | tools / — ×6 |
| `TerrainRecipe` · `DepthDefaults` · `SourceDefaults` · `AuthoredSpec` · `AuthoredSource` · `AuthoredConnector` · `briefSeed` | type/fn | `{ id; stamp; center(비율); radius; height; falloff? }` · `{ half; traceBase }` · `{ supply; harvests; collapses?; recoverySeconds }` · `{ id; depth; space; resourceEcology?; phases?; access?; ecology? }` · 컨텐츠 원천 표와 같은 키 · Connector 와 같은 형 · `(brief) => number` | 템플릿·뼈대 원소 · 해시 | content / — ×6 |
| `gradeRegion` · `GradeResult` · `Grade` · `Gap` | fn/type | `(brief, contracts: WorldContracts) => GradeResult` · `{ grade; blocking: Gap[]; pending: Gap[]; because }` · `'A'\|'B'\|'C'` · `{ required; missing; reason; returnTo }` | 등급 판정 | tools |
| `WorldContracts` | type | `{ hazardKinds; depths; transitions; carriers; roles; propertyAspects; propertyRelations; propertyTagSeparator?; propertyStatements?; lockAtKinds?; lockStrengths?; regions; frontiers; rules; returnTo: {vocabulary;rule;axis;contract;brief;pending} }` | 컨텐츠가 주는 어휘·계약 목록 | content |
| `draftRegion` · `DraftInput` · `DraftResult` · `DraftRound` · `DraftOutcome` · `DraftStage` | fn/type | `(input) => Promise<DraftResult>` · `{ unknown; system; schema; ask: DraftPort; trial: DraftTrialFn; attempts? }` · `{ outcome; brief?; rounds }` · `{ round; asked; stage?; problems }` · `'passed'\|'returned'\|'exhausted'` · `'shape'\|'world'` | 물어 → 형 검사 → trial → 되묻기 (기본 3회) | tools / — / tools / — / tools / — |
| `DraftPort` · `DraftAsk` · `DraftTrialFn` · `DraftTrial` · `draftQuestion` | type/fn | `(ask: DraftAsk) => Promise<unknown>` · `{ system; user; schema }` · `(brief) => DraftTrial` · `{ ok; problems; retry }` · `(unknown, rounds) => string` | 도구가 주입하는 모델·시험 · 되물음 글 | tools / — / — / tools / — |
| `renderDraftSystem` · `DraftPromptSpec` · `DraftWorldFacts` | fn/type | `(spec, facts, read: (path) => string) => string` · `{ documents; examples; rules }` · `{ vocabulary[{of;names}]; standing }` | 시스템 글 (fs 는 도구가) | tools / content / tools |

**content 가 채우는 것** — `CompileRules`(해상도·표면/막힘/통행 규칙·instance layer) · `CheckContract`(+ `CheckEcology` · `CheckTime` · `CheckLife` · `CheckAccess` 계통 데이터) · `RegionCompiler` · `AuthorTemplates` · `WorldContracts` · `DraftPromptSpec` · `DraftPort`/`DraftTrialFn`(도구 쪽).

## 미사용

`content/ app/ server/ tools/` 어디서도 import 되지 않는 export (tests 제외, grep 확인). "engine 내부" 는 engine 안 다른 파일이 import 하는 것, "미참조" 는 그것도 없는 것.

| 모듈 | engine 내부에서만 import | 어디서도 import 되지 않음 |
|---|---|---|
| world-kernel | `ObserverState` `MAX_OBSERVER_ID_LENGTH` `runWorldTick` `WorldTickResult` `PendingObserverEvent` `PendingRequest` `dispatchAction` `ruleObserverJoin` `ruleObserverLeave` `ruleObserverMark` `ruleRequestReply` `groupOutcomesByObserver` `takeSnapshot` | `WorldSystem` `isAttended` `presentObserverCount` `evaluateObserverIdentity` `AddressedOutcome` `ObservationSink` |
| physics | `Vec2` `normalizedOrFixed` `PointBody` `KineticBody` | `SeekStep` `PlaneBounds` `ArcSweepSpec` `ArcSweep` `circleHits` `applyRadialImpulse` |
| protocol-core | `CommandView` `CommandParameterView` `CommandDomainView` `JoinMessage` `ActionMessage` `MarkMessage` `parseServerMessage` `LinkState` `RULE_OBSERVER_JOIN` `RULE_OBSERVER_LEAVE` `RULE_OBSERVER_MARK` | `BodyView` `SwingView` `HudItemView` `ObserverView` `DebugAuthorityView` `CommandDomainOptionView` `CommandDomainKind` `ServerMessage` `ClientMessage` `RULE_REQUEST_REPLY` `RULE_WORLD_TICK` `INTENT_*` 열 개 `SemanticIdentifier` |
| view-kernel / assets·camera | `spriteCanvas` `createViewCamera` `ViewOrientation` `PlaneDirection` `DEFAULT_ORIENTATION` `turned` `worldDirection` `viewOffset` | `ViewCamera` `TERRAIN_CLEARANCE` `VIEW_DISTANCE` `TILT_MIN` `TILT_MAX` `clampTilt` `wrapTurn` `viewForward` `viewRight` |
| view-kernel / fx | `EffectLayer` `EffectLayerOptions` | `EffectEvent` `EffectViewpoint` `EffectPoint` `EffectSnapshot` `SPLAT_RUNTIME_LOADED` |
| view-kernel / hud | `SURFACE_TEXT_CODES` `SLOT_BAR_TEXT_CODES` `tabStopId` `enterStop` `escapeMeans` `focusToClaim` `tipPlacement` | `Hud` `HudOverlays` `celebrationText` `CommandConsole` `CommandConsoleHandlers` `createSurfaceLayer` `SurfaceLayer` `SurfaceHandlers` `groupSections` `SurfaceEscape` `FocusClaim` `TipBox` `TipSide` `TipAlign` `TipPlacement` `createSlotBarLayer` `slotBarMarkup` `SlotBarLayer` `SlotBarHandlers` `targetFrameMarkup` `TargetFrameLayer` `createTouchPad` `touchActionViews` `TouchPad` `TouchActionView` |
| view-kernel / input | `MOVE_KEY_CODES` `TURN_KEY_CODES` `LookSink` `TURN_PER_PIXEL` `TILT_PER_PIXEL` `PointerIntent` `StickView` `EngineKeyId` `engineKeyCode` `engineKeyTextCode` `ENGINE_KEY_TEXT_CODES` `nextIndex` | `KeyboardState` `pickAt` `ActionSink` `attachTouchControls` `TouchControls` `stickVector` `clampKnob` `STICK_RADIUS` `STICK_DEADZONE` `TAP_SLOP` `TAP_SUPPRESS_MS` `BindingSend` `ENGINE_KEYS` `ENGINE_KEY_CODES` `moveFocus` `moveFocusGrid` |
| view-kernel / motion | `uniformGeometry` `frameUv` `frameWorldSize` `motionFrameIndex` | `MotionPlay` `DEFAULT_FPS` `PixelRect` `motionFrameUv` `EMPTY_MOTION_LIBRARY` `FALLBACK_ACTION` |
| view-kernel / net | `createLinkTelemetry` `LinkTelemetry` | `WorldLink` `SocketFactory` `LinkSocket` `LinkHandlers` `Scheduler` `OBSERVATION_TIMEOUT_MS` `POLL_STALL_MS` `MARK_INTERVAL_MS` `RETRY_DELAYS_MS` `LinkTelemetryRecorder` `ARRIVAL_WINDOW_MS` `PENDING_MARK_LIMIT` `IdentityStorage` `IDENTITY_KEY` `createPendingRequests` `PendingRequests` |
| view-kernel / presentation | `CodeTextFn` `RAW_CODE` `COMMAND_TEXT_CODES` `LINK_TEXT_CODES` `SESSION_TEXT_CODES` `LinkLine` `SessionPresentation` | `ENGINE_TEXT_CODES` `fillSlots` `CommandFill` `CommandInvocation` `OBSERVER_COMMANDS` `ObserverCommandStates` `readSide` `FacingDecision` `DEFAULT_SPRITE_BASELINE` `AMBIGUOUS_BAND` `LinkBinding` (command-presentation 의 `CodeTextFn` 재export) |
| view-kernel / renderer·scene·sprites·terrain | `GameRenderer` `choosePrompt` `createBillboard` `Billboard` `createTerrain` `terrainHeightSampler` `createGroundFill` `GroundFillShape` `SceneInteraction` `SceneHudItem` `SceneColliderDebug` `SceneDebugCapsule` `SceneDebugSphere` `SceneDebugVector` `SceneCommandEntry` `SceneCommandSlot` `SceneCommandComposition` `SceneSurfaceSection` `SceneSlotBar` | `RendererOptions` `highlightCenter` `sceneAmbience` `sameAmbience` `DEFAULT_AMBIENCE` `selfPosition` `targetDistance` `SceneEntity` `SceneEffect` `SceneSurfaceRow` `SceneSurfaceCell` `SceneSurfaceField` `SceneSurfaceRowState` `SceneSurfaceShape` `SceneSlotCell` `SceneSlotState` `BillboardAppearance` `GroundFillOptions` |
| world-authoring | `PointOp` `StampOp` `CurveOp` `distanceToPolyline` `nearestCurveDistance` `HeightField` `AreaShape` `CompiledViewTerrain` `XZ`(compiled) `buildHeightField` `sampleHeight` `slopeAtVertex` `vertexX` `vertexZ` `evaluateSurface` `ConnectorEnd` `isFrontier` `reachableRegions` `reachableRegionsExcept` `AnswerKey` `unansweredKeys` | `extentCenter` `regionHash` `DEFAULT_CHUNK_SIZE` `heightAtVertex` `sampleSlope` `DEFAULT_SURFACE_TAG` `Connector` `GraphIssue` `GraphIssueCode` `RegionCompiler` `CheckRef` `CheckStatus` `CheckEcologyMaterial` `CheckEcologyFlow` `CheckTimeConnector` `CheckTimeSource` `CheckAccessAnswerRule` `CheckAccessRequirement` `CheckAccessLock` `CheckAccessSeed` `CheckAccessSeedProperty` `CheckAccessSeedSource` `AnswerSchema` `WorthSchema` `BirthSchema` `RegionAnswersSchema` `NeighbourSchema` `RequirementSchema` `Answer` `Worth` `Birth` `RegionAnswers` `Neighbour` `Requirement` `BriefParse` `BriefProblem` `AuthorInput` `AuthoredSpec` `AuthoredSource` `AuthoredConnector` `DepthDefaults` `SourceDefaults` `briefSeed` `DraftInput` `DraftRound` `DraftStage` `DraftAsk` `DraftTrialFn` `draftQuestion` |
