// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HktSelectable.h"
#include "IHktPresentableActor.h"
#include "HktVoxelSkinTypes.h"
#include "HktVoxelSkinAssembler.h"
#include "Meshing/HktVoxelMeshScheduler.h"
#include "HktVoxelUnitActorBase.generated.h"

class UHktVoxelChunkComponent;
class USkeletalMeshComponent;
class UHktAnimInstance;
class UHktVoxelSkinLayerAsset;
class FHktVoxelRenderCache;
struct FHktEntityPresentation;
struct FHktVoxelBoneGroup;

/**
 * 복셀 캐릭터 공통 베이스.
 *
 * 스킨 조합, 팔레트, 위치 보간, 애니메이션 포워딩 등
 * 렌더링 모드에 무관한 공통 로직을 담당한다.
 * 서브클래스가 본 애니메이션 방식을 결정:
 *   - AHktVoxelUnitActor      : 단일 메시 GPU 스키닝
 *   - AHktVoxelRigidUnitActor : 본별 청크 리지드 어태치
 */
UCLASS(Abstract)
class AHktVoxelUnitActorBase : public AActor, public IHktSelectable, public IHktPresentableActor
{
	GENERATED_BODY()

public:
	AHktVoxelUnitActorBase();
	virtual ~AHktVoxelUnitActorBase();

	virtual void BeginPlay() override;
	virtual void Tick(float DeltaTime) override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

	// IHktSelectable
	virtual FHktEntityId GetEntityId() const override { return CachedEntityId; }

	// IHktPresentableActor
	virtual void SetEntityId(FHktEntityId InEntityId) override { CachedEntityId = InEntityId; }
	virtual void ApplyTransform(const FHktEntityPresentation& Entity) override {}
	virtual void ApplyPresentation(const FHktEntityPresentation& Entity, int64 Frame, bool bForceAll,
		TFunctionRef<AActor*(FHktEntityId)> GetActorFunc) override;

protected:
	/** 초기 복셀 데이터 로드 + 메싱 요청 */
	void InitializeVoxelMesh();

	/** 스킨 세트 변경 시 공통 처리 (레이어 SkinSetID 갱신) — 서브클래스가 본 모드 진입을 결정 */
	void OnSkinSetChanged(uint16 NewSkinSetID);

	/** 팔레트 변경 시 — 서브클래스가 오버라이드하여 본 청크에도 적용 가능 */
	virtual void OnPaletteChanged(uint8 NewPaletteRow);

	/** 메싱 완료 콜백 — 서브클래스가 오버라이드 (청크 구조가 다름) */
	virtual void PollMeshReady();

	/** 본 데이터 발견 시 호출 — 서브클래스가 구현 */
	virtual void OnBoneDataAvailable(const TArray<FHktVoxelBoneGroup>& BoneGroups) {}

	/** 본 데이터 없을 때 (정적 모드 복귀) — 서브클래스가 구현 */
	virtual void OnBoneDataUnavailable() {}

	/** 본 애니메이션이 활성 상태인지 — 서브클래스가 구현 */
	virtual bool IsBoneAnimationActive() const { return false; }

	/** 서브클래스 Tick 확장 포인트 */
	virtual void TickAnimation(float DeltaTime) {}

	/** HiddenSkeleton에 SkeletalMesh 자동 설정 (VoxelLayerAsset의 SourceMesh에서) */
	void EnsureSkeletonMesh();

	/** HiddenSkeleton의 AnimInstance 캐시 반환 */
	UHktAnimInstance* GetAnimInstance();

	/** 레이어 → 기본 에셋 매핑 헬퍼 */
	UHktVoxelSkinLayerAsset* GetDefaultAssetForLayer(EHktVoxelSkinLayer::Type Layer) const;

	// --- Components ---
	UPROPERTY(VisibleAnywhere, Category = "HKT|Voxel")
	TObjectPtr<USceneComponent> RootScene;

	/** 단일 복셀 청크 — 정적 모드 및 GPU 스키닝 모드에서 사용 */
	UPROPERTY(VisibleAnywhere, Category = "HKT|Voxel")
	TObjectPtr<UHktVoxelChunkComponent> BodyChunk;

	/** 숨긴 스켈레톤 — 본 트랜스폼 구동용 (렌더링 안 함) */
	UPROPERTY(VisibleAnywhere, Category = "HKT|Voxel")
	TObjectPtr<USkeletalMeshComponent> HiddenSkeleton;

	// --- Voxel Data ---
	TSharedPtr<FHktVoxelRenderCache> EntityRenderCache;
	TUniquePtr<FHktVoxelMeshScheduler> MeshScheduler;
	FHktVoxelSkinAssembler SkinAssembler;

	// --- Default Voxel Skin Assets (에디터/블루프린트에서 설정) ---
	UPROPERTY(EditDefaultsOnly, Category = "HKT|VoxelSkin")
	TObjectPtr<UHktVoxelSkinLayerAsset> DefaultBodyAsset;

	UPROPERTY(EditDefaultsOnly, Category = "HKT|VoxelSkin")
	TObjectPtr<UHktVoxelSkinLayerAsset> DefaultHeadAsset;

	UPROPERTY(EditDefaultsOnly, Category = "HKT|VoxelSkin")
	TObjectPtr<UHktVoxelSkinLayerAsset> DefaultArmorAsset;

	// --- Cached State ---
	uint16 CachedSkinSetID = 0;
	uint8  CachedPaletteRow = 0;

	static const FIntVector EntityChunkCoord;

private:
	/** 애니메이션 포워딩 (공통) */
	void ForwardAnimation(const FHktEntityPresentation& Entity, int64 Frame, bool bForceAll);

	FHktEntityId CachedEntityId = InvalidEntityId;
	FVector InterpLocation = FVector::ZeroVector;
	FVector CachedRenderLocation = FVector::ZeroVector;
	FRotator InterpRotation = FRotator::ZeroRotator;
	FRotator CachedRotation = FRotator::ZeroRotator;

	TWeakObjectPtr<UHktAnimInstance> CachedAnimInstance;
};
