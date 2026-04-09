# 복셀 캐릭터 에디터 설정 가이드

**에디터에서 복셀 캐릭터를 세팅하고 눈으로 확인하는 전체 과정**을 설명합니다.

두 가지 액터 타입을 지원합니다:

| 액터 | 방식 | 느낌 |
|------|------|------|
| `AHktVoxelUnitActor` | GPU 스키닝 (단일 메시) | 일반 스켈레탈 메시와 유사한 부드러운 변형 |
| `AHktVoxelRigidUnitActor` | 본별 청크 리지드 | 마인크래프트 / 레고 블록 관절 |

전체 흐름은 **에셋 베이크(1단계) → Blueprint 생성(2단계) → DataAsset 등록(1단계) → 확인(1단계)** 총 5단계입니다.

---

## 공통: Phase 1 — 복셀 스킨 에셋 베이크

두 방식 모두 `UHktVoxelSkinLayerAsset`이 필요합니다. `UHktVoxelSkinBakeLibrary`로 SkeletalMesh를 복셀화합니다.

### 사전 요구사항

- **SkeletalMesh** — 복셀화 대상 캐릭터 메시 (LOD0 레퍼런스 포즈 사용)
- **Skeleton** — 본 웨이트가 칠해져 있어야 본-리지드/GPU스키닝 활성화
- **Python Editor Script Plugin** 활성화 (Editor Preferences → Plugins → Python)

### 방법 A: Python 콘솔

Output Log 하단 `Cmd` 드롭다운을 `Python`으로 변경 후 입력:

```python
import unreal

# 1) 원본 SkeletalMesh 로드
mesh = unreal.load_asset('/Game/Characters/SK_Mannequin')

# 2) 먼저 결과 미리보기 (저장 없이 복셀 수/본 수 확인)
voxel_count = unreal.Array(int)
bone_count = unreal.Array(int)
ok = unreal.HktVoxelSkinBakeLibrary.preview_voxelize(mesh, 32, voxel_count, bone_count)
print(f'Voxels: {voxel_count[0]}, Bones: {bone_count[0]}')

# 3) 베이크 + 저장
asset = unreal.HktVoxelSkinBakeLibrary.bake_skeletal_mesh(
    mesh,                               # 원본 메시
    '/Game/VoxelSkins/VS_Mannequin',    # 저장할 에셋 경로
    32,                                 # 그리드 크기 (32 = 32x32x32)
    True                                # 내부 채우기 (Solid Fill)
)

if asset:
    print(f'저장 완료: {asset.get_name()}')
```

### 방법 B: Editor Utility Widget

1. Content Browser → 우클릭 → **Editor Utilities → Editor Utility Widget**
2. 부모 클래스: `EditorUtilityWidget`
3. 열기 → Graph에서:

```
[Asset Property: SkeletalMesh*] → "Bake Skeletal Mesh" 노드
                                    ├─ Save Path: "/Game/VoxelSkins/VS_MyChar"
                                    ├─ Grid Size: 32
                                    ├─ Solid Fill: true
                                    └─ Return: UHktVoxelSkinLayerAsset*
```

4. Run Editor Utility Widget

### 결과 확인

Content Browser에서 생성된 에셋(`VS_Mannequin`)을 더블클릭하면:

| 필드 | 확인 사항 |
|------|----------|
| `Sparse Voxels` | 배열 크기 > 0 (총 복셀 수) |
| `Bone Groups` | 배열 크기 > 0이면 본 애니메이션 가능 |
| `Source Mesh` | 원본 SkeletalMesh 참조 |
| `Source Skeleton` | 원본 Skeleton 참조 |
| `Bounds Min / Max` | 복셀 범위 (0~31 사이) |

> **Bone Groups가 0이면** 본 웨이트가 없는 메시이거나 복셀화에 실패한 것. Output Log에서 `[HktVoxelSkin]` 로그 확인.

### 파라미터 가이드

| 파라미터 | 값 | 설명 |
|---------|-----|------|
| Grid Size | `32` (기본) | 32×32×32 복셀. 높을수록 정밀하지만 쿼드 수 증가 |
| Grid Size | `16` | 빠른 테스트용. 저해상도 복셀 |
| Grid Size | `64` | 고해상도 (큰 보스급 캐릭터) |
| Solid Fill | `true` | 내부를 꽉 채움 → 파편 이펙트 시 속이 보이지 않음 |
| Solid Fill | `false` | 표면만 → 가벼운 메시, 디버그용 |

---

## AHktVoxelUnitActor 설정 (GPU 스키닝)

단일 메시에서 셰이더가 버텍스별로 본 트랜스폼을 적용. 1 draw call, 부드러운 변형.

### Phase 2 — Blueprint 생성

#### Step 1. Blueprint Class 생성

1. Content Browser → 우클릭 → **Blueprint Class**
2. **All Classes** 펼치기 → `HktVoxelUnitActor` 검색 → 선택
3. 이름: `BP_VoxelKnight_GPU` (예시)
4. **Save**

#### Step 2. Blueprint 프로퍼티 설정

`BP_VoxelKnight_GPU` 더블클릭으로 Blueprint Editor 열기.

**(a) Details 패널 → HKT|VoxelSkin 카테고리:**

| 프로퍼티 | 설정 | 설명 |
|---------|------|------|
| `Default Body Asset` | `VS_Mannequin` (Phase 1에서 생성) | 필수. 몸체 복셀 데이터 |
| `Default Head Asset` | (선택) 별도 에셋 | 머리 레이어 복셀 |
| `Default Armor Asset` | (선택) 별도 에셋 | 갑옷 레이어 복셀 |

> Body만 지정해도 전체 캐릭터가 표시됩니다. Head/Armor는 모듈러 장비 시스템 용도.

**(b) Components 패널 → `HiddenSkeleton` 선택:**

좌측 Components 목록에서 **HiddenSkeleton (SkeletalMeshComponent)** 클릭 → 우측 Details:

| 프로퍼티 | 위치 | 설정 | 설명 |
|---------|------|------|------|
| `Skeletal Mesh Asset` | Mesh 카테고리 | 원본 SkeletalMesh (`SK_Mannequin`) | 본 구조 제공. **미지정 시 SourceMesh에서 자동 로드** |
| `Anim Class` | Animation 카테고리 | AnimBP (`ABP_Mannequin_C`) | **필수 — 직접 지정해야 함**. 자동 로드 안 됨 |
| `Animation Mode` | Animation 카테고리 | `Use Animation Blueprint` (기본값) | 변경 불필요 |

> **핵심**: `Anim Class`를 반드시 지정해야 합니다. 미지정 시 HiddenSkeleton이 T-포즈로 고정되어 애니메이션이 없습니다.

**(c) 확인 후 저장:**

1. **Compile** (툴바 좌상단)
2. **Save**

#### GPU 스키닝 작동 원리 (참고)

```
매 프레임:
  HiddenSkeleton (AnimBP 구동)
    ↓ 본 트랜스폼 (Component Space)
  VoxelUnitActor::UpdateBoneTransformsFromSkeleton()
    ↓ float4 × 3 per bone → GPU Buffer
  Vertex Shader:
    bone_index = vertex[31:25]  (7비트, 메싱 시 패킹됨)
    pos = BoneMatrix[bone_index] × local_pos
```

---

## AHktVoxelRigidUnitActor 설정 (본별 청크 리지드)

본마다 독립적인 복셀 청크를 생성하고, 각각을 HiddenSkeleton의 본 소켓에 어태치. 블록 관절 느낌.

### Phase 2 — Blueprint 생성

#### Step 1. Blueprint Class 생성

1. Content Browser → 우클릭 → **Blueprint Class**
2. **All Classes** 펼치기 → `HktVoxelRigidUnitActor` 검색 → 선택
3. 이름: `BP_VoxelKnight_Rigid` (예시)
4. **Save**

#### Step 2. Blueprint 프로퍼티 설정

`BP_VoxelKnight_Rigid` 더블클릭으로 Blueprint Editor 열기.

**(a) Details 패널 → HKT|VoxelSkin 카테고리:**

| 프로퍼티 | 설정 | 설명 |
|---------|------|------|
| `Default Body Asset` | `VS_Mannequin` (Phase 1에서 생성) | 필수. GPU 스키닝과 동일한 에셋 사용 가능 |
| `Default Head Asset` | (선택) | 별도 머리 에셋 |
| `Default Armor Asset` | (선택) | 별도 갑옷 에셋 |

> **같은 VoxelSkinLayerAsset을 두 방식에서 공유**할 수 있습니다. 에셋 재베이크 불필요.

**(b) Components 패널 → `HiddenSkeleton` 선택:**

| 프로퍼티 | 위치 | 설정 | 설명 |
|---------|------|------|------|
| `Skeletal Mesh Asset` | Mesh 카테고리 | `SK_Mannequin` | 본 소켓 이름 제공. **필수** — 자동 로드 되지만 명시 권장 |
| `Anim Class` | Animation 카테고리 | `ABP_Mannequin_C` | **필수** |

**(c) Compile → Save**

#### 리지드 모드 작동 원리 (참고)

```
BeginPlay:
  BoneGroups 순회:
    ├─ NewObject<UHktVoxelChunkComponent>()  (본마다 1개)
    ├─ AttachToComponent(HiddenSkeleton, BoneName)
    ├─ WriteBoneGroupToChunk() → LoadChunk()
    └─ 본 기준 오프셋 (RefPoseBonePos) 설정

매 프레임:
  HiddenSkeleton이 AnimBP로 자동 Tick
  → 어태치된 청크들이 본 소켓을 따라 자동으로 움직임
  → 추가 GPU 업로드 없음
```

---

## 공통: Phase 3 — DataAsset 등록

VM 스폰 파이프라인에 연결합니다.

#### Step 1. ActorVisualDataAsset 생성

1. Content Browser → 우클릭 → **Miscellaneous → Data Asset**
2. 클래스 선택: **`HktActorVisualDataAsset`**
3. 이름: `DA_VoxelKnight`
4. 더블클릭 → 설정:

| 프로퍼티 | 설정 |
|---------|------|
| `Identifier Tag` | GameplayTag 지정 (예: `Entity.Character.VoxelKnight`) |
| `Actor Class` | `BP_VoxelKnight_GPU` 또는 `BP_VoxelKnight_Rigid` |

5. **Save**

> 두 방식을 비교하려면 DataAsset을 2개 만들어 `ActorClass`만 다르게 지정합니다.

---

## 공통: Phase 4 — 에디터에서 확인

### 방법 1: 레벨에 드래그 (가장 빠름)

1. Content Browser에서 `BP_VoxelKnight_GPU` (또는 `_Rigid`)를 **뷰포트로 드래그**
2. **Play** (Alt+P)
3. 복셀 캐릭터가 AnimBP에 따라 아이들 애니메이션 재생

### 방법 2: Python 스폰

```python
import unreal

bp = unreal.load_asset('/Game/Blueprints/BP_VoxelKnight_GPU')
loc = unreal.Vector(0, 0, 100)
rot = unreal.Rotator(0, 0, 0)
actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
    bp.generated_class(), loc, rot)
```

### 방법 3: VM 스폰 (정식 경로)

서버에서 `Entity.Character.VoxelKnight` 태그로 엔티티 스폰
→ `FHktActorRenderer`가 `DA_VoxelKnight`의 `ActorClass`를 로드
→ 복셀 캐릭터 자동 생성

---

## 트러블슈팅

### 복셀이 안 보임

| 증상 | 확인 |
|------|------|
| 아무것도 안 보임 | Output Log에서 `[VoxelMesher]` 검색 → `Total: 0 verts` 이면 복셀 데이터 없음 |
| 아무것도 안 보임 | `Default Body Asset`이 None인지 확인 |
| 프로시저럴 블록만 보임 | `Default Body Asset` 에셋의 `Sparse Voxels` 크기 확인 (0이면 베이크 실패) |
| 복셀이 바닥 아래에 있음 | 액터 위치 Z값 조정. BodyChunk 오프셋은 발 중앙 기준 |

### 애니메이션이 안 됨

| 증상 | 확인 |
|------|------|
| T-포즈 고정 | `HiddenSkeleton`에 **Anim Class** 미지정 |
| T-포즈 고정 | `HiddenSkeleton`에 **Skeletal Mesh** 미지정 (본 구조 없음) |
| 본 모드 미진입 | VoxelSkinLayerAsset의 `Bone Groups` 크기 = 0 → 본 웨이트 없는 메시로 베이크됨 |
| GPU 스키닝 안 됨 | `[VoxelUnit] GPU Skinning initialized` 로그가 없음 → 에셋에 본 데이터 없음 |
| 리지드 청크 안 붙음 | `[VoxelRigidUnit] InitializeBoneChunks` 로그 확인. SkeletalMesh의 본 이름이 BoneGroup 이름과 일치하는지 |

### 색상이 이상함

| 증상 | 원인 |
|------|------|
| 빨/초/파 면별 색상 | 정상 — 현재 디버그 모드. 셰이더의 `FaceDebugColors` 출력 |
| 전부 흰색 | 팔레트 텍스처 미설정 (GWhiteTexture 폴백) |

---

## 두 방식 빠른 비교 테스트

같은 에셋으로 두 액터를 나란히 배치하면 차이를 바로 확인할 수 있습니다:

```python
import unreal

# 같은 에셋, 다른 액터
gpu_bp = unreal.load_asset('/Game/Blueprints/BP_VoxelKnight_GPU')
rigid_bp = unreal.load_asset('/Game/Blueprints/BP_VoxelKnight_Rigid')

# 나란히 스폰
unreal.EditorLevelLibrary.spawn_actor_from_class(
    gpu_bp.generated_class(), unreal.Vector(-200, 0, 100), unreal.Rotator(0, 0, 0))
unreal.EditorLevelLibrary.spawn_actor_from_class(
    rigid_bp.generated_class(), unreal.Vector(200, 0, 100), unreal.Rotator(0, 0, 0))
```

Play 후:
- **왼쪽 (GPU)**: 복셀이 부드럽게 변형되며 애니메이션
- **오른쪽 (Rigid)**: 팔/다리/머리가 블록째로 움직이는 관절 느낌
