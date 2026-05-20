# Design — Entity Collision · Selection Visualization

> 본 문서는 [I-0033](intents/I-0033.md) — *엔티티 충돌·선택의 시뮬레이션 일치* 의 구현 정리.

## 동기

`FHktPhysicsSystem` 은 캡슐-캡슐 narrow-phase 로 엔티티 간 충돌을 결정론적으로 해결한다. 그러나 종전까지 두 가지 가시화 공백이 있었다.

1. **충돌 페어 가시화 부재** — `FHktPhysicsEvent` 는 산출되지만, *어떤 두 엔티티가 어떤 접촉점에서 부딪쳤는지* 를 실시간으로 추적할 수단이 없었다. 회귀가 발생하면 로그 grep 으로만 사후 분석.
2. **픽업 볼륨 vs 시뮬레이션 캡슐 불일치** — `AHktSpritePaperActor` 의 `IHktSelectable` 픽업이 `UBoxComponent` 였다. sim 은 캡슐, 픽업은 박스 → 모서리 over-pick / 측면 under-pick. 또한 각 selectable 액터의 픽업 볼륨을 sim 캡슐과 *나란히* 비교할 디버그 오버레이가 없었다.

본 작업은 이 두 공백을 메우고 정합 검증 수단을 표준화한다.

## 구성

### 1. `FHktCollisionDebugTracer` (HktCore)

`HktCore/Public/HktCollisionDebugTracer.h` · `HktCore/Private/HktCollisionDebugTracer.cpp`

- 싱글톤 ring buffer (`RingCapacity = 512`), `FCriticalSection` 동기화.
- `FHktCollisionPair { SimFrame, EntityA, EntityB, PosA, PosB, ContactPoint, LayerA, LayerB }` 적재.
- `bEnabled` atomic gate → off 시 `Push()` 는 atomic load 한 번에 종료. 결정론·성능 영향 0.
- `Snapshot(CurrentFrame, MaxAgeFrames, OutPairs)` — 최근 N 프레임 페어만 복사.
- `ENABLE_HKT_INSIGHTS` 가드 — Shipping 빌드에서는 헤더 자체가 비어 있다.

### 2. `FHktPhysicsSystem` push hook

`HktCore/Private/HktSimulationSystems.cpp` Phase 1 narrow-phase 의 두 contact 발화 지점:

- **완전 겹침 fallback** (`Dist <= SMALL_NUMBER`) — `ContactPoint = PosA`
- **정상 overlap** — `ContactPoint = (ClosestA + ClosestB) * 0.5f`

양쪽 모두 `FHktPhysicsEvent` 생성 직후 `IsEnabled()` 게이트 통과 시 `FHktCollisionPair` 를 push 한다. `SimFrame` 은 `WorldState.FrameNumber`, `LayerA/B` 는 `FEntityData::Layer` 에서 그대로 전달.

### 3. `FHktCollisionDebugProcessor` 의 페어·픽업 시각화 (HktPresentation)

`HktPresentation/Private/Processors/HktCollisionDebugProcessor.{h,cpp}`

- `Sync()` 가 CVar 를 읽어 `FHktCollisionDebugTracer::Get().SetEnabled(...)` 동기화.
- `DrawCollisionPairs()` — `Snapshot` 으로 최근 `CollisionPairLifetime` 프레임 페어를 받아 `DrawDebugLine`(레이어 색 평균) + `DrawDebugPoint`(접촉점, 빨강). age 기반 alpha 페이드.
- `DrawSelectableHitboxes()` — `TActorIterator<AActor>` 로 `IHktSelectable` 구현체를 순회. `ECC_Visibility` block 인 `UPrimitiveComponent` 만 대상.
  - `UCapsuleComponent` → `DrawDebugCapsule` (옅은 주황)
  - 기타 (`UStaticMeshComponent`, voxel chunk 등) → `Bounds` 박스 (주황)

### 4. `AHktSpritePaperActor` 픽업 캡슐화 (HktSpriteCore)

`HktGameplay/Source/HktSpriteCore/{Public,Private}/HktSpritePaperActor.{h,cpp}`

- `UBoxComponent HitBox` → `UCapsuleComponent HitCapsule`.
- `ApplyPhysics` 가 VM `CollisionRadius` / `CollisionHalfHeight` → `SetCapsuleSize(R, HH)` 1:1 반영.
- `RelativeLocation.Z = HalfHeight` 로 캡슐 origin(=중심) 을 띄워 캡슐 발이 `ActorLocation`(= entity foot) 에 닿게 정렬 — sim 캡슐과 동일 좌표계.
- `SetUsingAbsoluteRotation(true)` 유지 — 빌보드 pitch 가 캡슐을 기울이지 못하게 차단 (yaw 는 XY 대칭이라 무관).
- collision response: `QueryOnly` + `ECC_Visibility = Block`, 나머지 채널 Ignore. overlap·nav 없음. `bHiddenInGame = true`.

## 콘솔 명령

| CVar | 기본 | 효과 |
|---|---|---|
| `hkt.Debug.ShowCollision` | 0 | 1=sim capsule, 2=+감지범위, 3=+voxel cell. |
| `hkt.Debug.ShowCollisionLabels` | 0 | sim capsule 위 EntityId/Layer 라벨. |
| `hkt.Debug.ShowEntityPos` | 0 | 모든 엔티티 origin sphere. |
| `hkt.Debug.ShowCollisionPairs` | 0 | **신규.** `FHktPhysicsSystem` 검출 페어 라인 + 접촉점. |
| `hkt.Debug.CollisionPairLifetime` | 15 | **신규.** 페어 라인 fade-out sim frame 수 (30Hz 기준 0.5s). |
| `hkt.Debug.ShowSelectableHitbox` | 0 | **신규.** `IHktSelectable` 액터의 실제 픽업 볼륨 (주황). |

## 정합 검증 시나리오

1. `hkt.Debug.ShowCollision 1` (녹색 sim 캡슐) + `hkt.Debug.ShowSelectableHitbox 1` (주황 actor 픽업) 동시 ON.
2. Paper2D 액터 — 두 캡슐이 완전히 겹쳐 보여야 정상. 이번 작업으로 보장됨.
3. `AHktUnitActor` — sim 캡슐은 발에서 위로, actor 캡슐은 중심이 발에 있어 *반 캡슐만큼 아래로* 어긋남. (남은 작업)
4. `AHktItemActor` / `AHktVoxelUnitActorBase` — 주황은 mesh AABB / voxel chunk, 녹색은 sim 캡슐로 형태 자체가 다름. (남은 작업)
5. `hkt.Debug.ShowCollisionPairs 1` — 두 엔티티가 충돌하는 순간 라인 + 접촉점이 잠깐 떴다가 fade-out.

## 남은 정합 미달

| 액터 | 결함 | 향후 |
|---|---|---|
| `AHktUnitActor` | `UCapsuleComponent` origin = 중심이지만 `SetActorLocation`이 foot. 캡슐이 `HalfHeight` 만큼 아래로 침범. | actor capsule 을 mesh 가 아닌 보조 subcomponent 로 분리 또는 +Z 오프셋 패치. |
| `AHktItemActor` | `ApplyPhysics` 미구현. mesh AABB 가 픽업. | sim 캡슐로 보조 hit component 추가. |
| `AHktVoxelUnitActorBase` | `ApplyPhysics` 미구현. voxel chunk 가 픽업. | 동일. |

## 참고

- [I-0033](intents/I-0033.md) — 본 의도
- [I-0014](intents/I-0014.md) — 상위 의도 (모험과 성장을 위한 상호작용)
- [Design-Terrain-Entity-Collision.md](Design-Terrain-Entity-Collision.md) — 지형-엔티티 충돌 (sim Phase 2)
