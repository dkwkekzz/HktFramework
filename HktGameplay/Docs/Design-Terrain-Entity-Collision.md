# Terrain-Entity 충돌 처리

HktCore 결정론적 시뮬레이션에서 엔티티가 복셀 지형과 상호작용하는 방식을 설명한다.
물리 엔진 없이 **Movement System 내부**에서 직접 처리하며, 서버-권위적으로 동작한다.

---

## 전체 흐름 (매 프레임 1/30초)

```
ProcessBatch()
 │
 ├─ [1] TerrainSystem::Process()
 │       └─ 엔티티 위치 기준 청크 로드 (±2청크 XY, ±1청크 Z)
 │
 ├─ [2] VMBuildSystem + VMProcessSystem
 │       └─ 이동 명령 발행 (MoveTarget 설정, IsGrounded/JumpVelZ 조작)
 │
 └─ [3] MovementSystem::Process()   ← 충돌 처리 전부 여기서 발생
          ├─ Pass A: 이동 중 엔티티  (IsMoving=1, IsGrounded=1)
          ├─ Pass B: 정지 엔티티    (IsMoving=0, IsGrounded=1)
          └─ Pass C: 점프 엔티티    (JumpVelZ != 0)
```

---

## 충돌 처리 상세

### Pass A — 이동 중 엔티티 지형 충돌

**위치**: `HktSimulationSystems.cpp` — `FHktMovementSystem::Process()` 이동 루프 내부

**게이트**: `IsGrounded != 0` — 점프 중(IsGrounded=0)이면 스킵

```
NewPos = CurPos + Vel × dt
          │
          ▼
CurFloorZ = FindFloorVoxelZ(CurX, CurY, CurVoxelZ)   ← 현재 발판 높이
NewFloorZ = FindFloorVoxelZ(NewX, NewY, NewVoxelZ)   ← 목적지 발판 높이
          │
          ├─ NewFloorZ > CurZ + MaxStepHeight?
          │    YES → 벽/절벽: XY 이동 취소, Z 현재 발판 유지 (이동 차단)
          │    NO  → 경사/평지: NewZ = NewFloorZ         (Z 스냅)
          │
          └─ VMProxy.SetPosition(NewX, NewY, NewZ)
```

**관련 CVar**: `hkt.Terrain.MaxStepHeight` (기본 30cm = 복셀 2개)
- 이 값 **이하** 단차: 자동으로 올라감 (계단 오르기)
- 이 값 **초과** 단차: 이동 차단 (벽으로 인식)

---

### Pass B — 정지 엔티티 지면 스냅

**위치**: `HktSimulationSystems.cpp` — 이동 루프 직후

**게이트**: `IsMoving=0 && IsGrounded=1`

**목적**: 스폰 직후 공중에 있는 엔티티, 지형 변형(SetVoxel) 후 발판이 사라진 엔티티를 올바른 위치로 교정

```
SurfaceZ = FindFloorVoxelZ(CurX, CurY, CurVoxelZ)
CurZ != SurfaceCmZ → PosZ = SurfaceCmZ
```

스냅은 위/아래 **양방향**으로 작동한다:
- 엔티티가 지면 **아래**: 위로 밀어냄 (지면 뚫기 방지)
- 엔티티가 지면 **위**: 아래로 끌어내림 (공중 부양 방지)

---

### Pass C — 점프 중력 및 착지

**위치**: `HktSimulationSystems.cpp` — 정지 스냅 직후

**게이트**: `JumpVelZ != 0`

```
JumpVelZ -= Gravity × dt              (중력 감속)
JumpVelZ = max(JumpVelZ, -MaxFall)    (낙하 속도 상한)
NewZ = CurZ + JumpVelZ × dt

착지 판정: NewZ <= GetSurfaceHeightAt(X, Y)?
  YES → NewZ = SurfaceCmZ
         JumpVelZ = 0
         IsGrounded = 1
         Grounded 이벤트 발행
```

**관련 CVar**:
- `hkt.Jump.Gravity` (기본 980 cm/s²)
- `hkt.Jump.MaxFallSpeed` (기본 2000 cm/s)

---

## 핵심 헬퍼: FindFloorVoxelZ

**위치**: `HktSimulationSystems.cpp` — `MovementSystem::Process` 위 정적 함수

Pass A와 Pass B의 지형 높이 쿼리를 담당한다. `GetSurfaceHeightAt`(최상단 전용 하이트맵)과 달리 **동굴·다층 지형**을 올바르게 처리한다.

```cpp
static int32 FindFloorVoxelZ(const FHktTerrainState& Terrain,
                              int32 VoxelX, int32 VoxelY, int32 StartVoxelZ,
                              int32 MaxScanUp = 8, int32 MaxScanDown = 64);
```

```
입력: 현재 복셀 좌표 (X, Y, Z)

[현재 복셀이 솔리드?]
  YES → 위로 스캔 (최대 MaxScanUp 복셀)
         첫 에어 복셀 Z 반환   ← 솔리드 내부에서 탈출
         탈출 실패 → StartVoxelZ 반환 (fallback)

  NO  → 아래로 스캔 (최대 MaxScanDown 복셀)
         첫 솔리드 복셀 Z+1 반환   ← 그 위가 바닥
         바닥 없음 → StartVoxelZ 반환 (청크 미로드 보호)
```

### GetSurfaceHeightAt vs FindFloorVoxelZ

| 항목 | `GetSurfaceHeightAt` | `FindFloorVoxelZ` |
|---|---|---|
| 방식 | 하이트맵 캐시 O(1) | 현재 Z 기준 복셀 스캔 |
| 동굴/다층 지원 | ❌ XY열 최상단만 | ✅ 실제 발밑 바닥 |
| 청크 미로드 처리 | 0 반환 (Z=0으로 스냅) | StartVoxelZ 반환 (no-op) |
| 사용처 | 점프 착지 판정 (Pass C) | 이동·정지 스냅 (Pass A, B) |

### 성능

일반 케이스(엔티티가 지면 위)는 **2번** IsSolid 호출로 종료된다:

```
IsSolid(X, Y, Z)   → false (현재 위치는 에어)
IsSolid(X, Y, Z-1) → true  (바로 아래가 솔리드) → return Z
```

최악 케이스(64 복셀 스캔)는 엔티티가 매우 높이 떠 있을 때만 발생한다.

---

## IsGrounded 상태 전이

```
스폰
  │ Op_SpawnEntity → IsGrounded = 1 (기본)
  ▼
[접지 상태]  IsGrounded=1, JumpVelZ=0
  │   Pass A: 이동 시 지형 스냅 + 측면 차단
  │   Pass B: 정지 시 양방향 지면 스냅
  │
  │ Story: JumpVelZ = 양수, IsGrounded = 0
  ▼
[공중 상태]  IsGrounded=0, JumpVelZ!=0
  │   Pass A, B: 스킵 (IsGrounded=0 게이트)
  │   Pass C: 중력 적용 + 착지 판정
  │
  │ 착지: NewZ <= GetSurfaceHeightAt
  ▼
[접지 상태]  IsGrounded=1, JumpVelZ=0
              Grounded 이벤트 발행
```

---

## 좌표 변환

모든 충돌 처리는 두 좌표계를 오간다.

| 변환 | 함수 | 설명 |
|---|---|---|
| cm → 복셀 | `FHktTerrainSystem::CmToVoxel(x, y, z)` | floor(cm / 15) |
| 복셀 → cm | `FHktTerrainSystem::VoxelToCm(vx, vy, vz)` | voxel × 15 + 7.5 (복셀 중심) |

복셀 크기: **15cm** (`FHktTerrainSystem::VoxelSizeCm = 15.0f`)

---

## 현재 한계

| 항목 | 상태 | 비고 |
|---|---|---|
| 지면 착지 (양방향 스냅) | ✅ 구현 | Pass A + B |
| 동굴/다층 지형 | ✅ 구현 | FindFloorVoxelZ |
| 벽 충돌 차단 | ✅ 구현 | MaxStepHeight 초과 시 |
| 벽 슬라이딩 | ❌ 미구현 | 벽에 막히면 완전 정지 |
| 점프 천장 충돌 | ❌ 미구현 | 동굴 천장 통과 가능 |
| 투사체 지형 충돌 | ❌ 미구현 | IsGrounded=0이므로 스킵 |
