// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktCoreDefs.h"
#include "HktVisualField.h"
#include "HktWorldState.h"
#include "HktCoreProperties.h"
#include "GameplayTagContainer.h"
#include "Math/Color.h"
#include "UObject/SoftObjectPath.h"

/** 엔터티의 렌더 카테고리 (어떤 렌더러가 담당할지 결정) */
enum class EHktRenderCategory : uint8
{
	None = 0,
	Actor,
	MassEntity,
	FX,
	Debris,
};

// ============================================================================
// Per-entity lifecycle / metadata — 모든 유효 엔터티에 할당
// ============================================================================

struct FHktEntityMeta
{
	FHktEntityId EntityId = InvalidEntityId;
	EHktRenderCategory RenderCategory = EHktRenderCategory::None;
	int64 SpawnedFrame = 0;
	int64 RemovedFrame = 0;
	int64 LastDirtyFrame = -1;

	FORCEINLINE bool IsAlive() const { return RemovedFrame == 0; }
	FORCEINLINE bool IsSpawnedAt(int64 Frame) const { return SpawnedFrame == Frame; }
	FORCEINLINE bool IsRemovedAt(int64 Frame) const { return RemovedFrame == Frame; }
};

// ============================================================================
// SOA View Components — 목적별로 분할된 뷰모델.
// 각 뷰는 엔터티가 실제로 필요로 할 때만 TSparseArray에 삽입된다.
// Generation counter 기반 더티 트래킹은 THktVisualField 내부에서 유지.
// ============================================================================

struct FHktTransformView
{
	THktVisualField<FVector>  Location;
	THktVisualField<FRotator> Rotation;
	THktVisualField<FVector>  RenderLocation;

	FORCEINLINE bool AnyDirty(int64 F) const
	{
		return Location.IsDirty(F) || Rotation.IsDirty(F) || RenderLocation.IsDirty(F);
	}
};

struct FHktPhysicsView
{
	THktVisualField<float> CollisionRadius;
	THktVisualField<float> CollisionHalfHeight;
	THktVisualField<int32> CollisionLayer;

	FORCEINLINE bool AnyDirty(int64 F) const
	{
		return CollisionRadius.IsDirty(F) || CollisionHalfHeight.IsDirty(F) || CollisionLayer.IsDirty(F);
	}
};

struct FHktMovementView
{
	THktVisualField<FVector> MoveTarget;
	THktVisualField<float>   MoveForce;
	THktVisualField<bool>    bIsMoving;
	THktVisualField<bool>    bIsJumping;   // IsGrounded == 0에서 파생
	THktVisualField<FVector> Velocity;

	FORCEINLINE bool AnyDirty(int64 F) const
	{
		return MoveTarget.IsDirty(F) || MoveForce.IsDirty(F)
			|| bIsMoving.IsDirty(F) || bIsJumping.IsDirty(F) || Velocity.IsDirty(F);
	}
};

struct FHktVitalsView
{
	THktVisualField<float> Health;
	THktVisualField<float> MaxHealth;
	THktVisualField<float> HealthRatio;
	THktVisualField<float> Mana;
	THktVisualField<float> MaxMana;
	THktVisualField<float> ManaRatio;

	FORCEINLINE bool AnyDirty(int64 F) const
	{
		return Health.IsDirty(F) || MaxHealth.IsDirty(F) || HealthRatio.IsDirty(F)
			|| Mana.IsDirty(F) || MaxMana.IsDirty(F) || ManaRatio.IsDirty(F);
	}
};

struct FHktCombatView
{
	THktVisualField<int32> AttackPower;
	THktVisualField<int32> Defense;
	THktVisualField<int32> CP;
	THktVisualField<int32> MaxCP;
	THktVisualField<float> CPRatio;
	THktVisualField<int32> AttackSpeed;
	THktVisualField<int32> MotionPlayRate;

	FORCEINLINE bool AnyDirty(int64 F) const
	{
		return AttackPower.IsDirty(F) || Defense.IsDirty(F) || CP.IsDirty(F)
			|| MaxCP.IsDirty(F) || CPRatio.IsDirty(F) || AttackSpeed.IsDirty(F)
			|| MotionPlayRate.IsDirty(F);
	}
};

struct FHktOwnershipView
{
	THktVisualField<int32>        Team;
	THktVisualField<int64>        OwnedPlayerUid;
	THktVisualField<FString>      OwnerLabel;     // "P:12345" 또는 "-"
	THktVisualField<FLinearColor> TeamColor;      // Team 인덱스에서 계산된 색상

	FORCEINLINE bool AnyDirty(int64 F) const
	{
		return Team.IsDirty(F) || OwnedPlayerUid.IsDirty(F)
			|| OwnerLabel.IsDirty(F) || TeamColor.IsDirty(F);
	}
};

struct FHktAnimationView
{
	THktVisualField<FGameplayTag> AnimState;
	THktVisualField<FGameplayTag> MontageState;
	THktVisualField<FGameplayTag> AnimStateUpper;
	THktVisualField<FGameplayTag> Stance;

	/** AnimInstance 태그 동기화용 */
	FGameplayTagContainer Tags;
	int64 TagsDirtyFrame = -1;

	/** 이번 프레임에 수신된 일회성 애니메이션 이벤트 (Processor Sync에서 소비 후 Reset) */
	TArray<FGameplayTag> PendingAnimTriggers;

	FORCEINLINE bool AnyDirty(int64 F) const
	{
		return AnimState.IsDirty(F) || MontageState.IsDirty(F)
			|| AnimStateUpper.IsDirty(F) || Stance.IsDirty(F)
			|| TagsDirtyFrame == F || PendingAnimTriggers.Num() > 0;
	}
};

struct FHktVisualizationView
{
	THktVisualField<FGameplayTag>    VisualElement;
	THktVisualField<FSoftObjectPath> ResolvedAssetPath;   // VisualElement에서 비동기 해결된 에셋 경로

	FORCEINLINE bool AnyDirty(int64 F) const
	{
		return VisualElement.IsDirty(F) || ResolvedAssetPath.IsDirty(F);
	}
};

struct FHktItemView
{
	THktVisualField<int32> OwnerEntity;   // 소유 캐릭터 EntityId (0 = 없음)
	THktVisualField<int32> EquipIndex;    // -1 = 미등록, 0+ = 장착 슬롯
	THktVisualField<int32> ItemState;
	THktVisualField<int32> Equippable;    // 장착 가능 여부 (0=불가, 1=가능)

	FORCEINLINE bool IsAttached() const
	{
		return OwnerEntity.Get() != InvalidEntityId && ItemState.Get() == 2 && Equippable.Get() != 0;
	}
	/** 소유된 아이템 (InBag 또는 Active) — Ground 상태가 아닌 소유 아이템은 월드에서 숨김 */
	FORCEINLINE bool IsOwned() const
	{
		return OwnerEntity.Get() != InvalidEntityId && ItemState.Get() != 0;
	}
	FORCEINLINE bool AnyDirty(int64 F) const
	{
		return OwnerEntity.IsDirty(F) || EquipIndex.IsDirty(F)
			|| ItemState.IsDirty(F) || Equippable.IsDirty(F);
	}
};

struct FHktVoxelSkinView
{
	THktVisualField<int32> VoxelSkinSet;  // 스킨 세트 ID (외형 메시 결정, 변경 시 재메싱)
	THktVisualField<int32> VoxelPalette;  // 팔레트 행 번호 (색상 결정, 재메싱 불필요)

	FORCEINLINE bool AnyDirty(int64 F) const
	{
		return VoxelSkinSet.IsDirty(F) || VoxelPalette.IsDirty(F);
	}
};

struct FHktTerrainDebrisView
{
	THktVisualField<int32> TerrainTypeId; // Debris 원래 복셀 TypeID (렌더링용)

	FORCEINLINE bool AnyDirty(int64 F) const
	{
		return TerrainTypeId.IsDirty(F);
	}
};

// ============================================================================
// Pending queues — ProcessDiff에서 적재 → Processor에서 소비
// ============================================================================

struct FHktPendingSpawn      { FHktEntityId EntityId; FGameplayTag VisualTag; };
struct FHktPendingVFXEvent   { FGameplayTag Tag; FVector Location; };
struct FHktPendingVFXAttach  { FGameplayTag Tag; FHktEntityId EntityId; FVector Location; };
struct FHktPendingVFXDetach  { FGameplayTag Tag; FHktEntityId EntityId; };

// ============================================================================
// FHktPresentationState — 완벽한 SOA 뷰모델 컨테이너
// ============================================================================

struct HKTPRESENTATION_API FHktPresentationState
{
	// --- SOA views. TSparseArray keyed by EntityId — O(1) 접근, 미사용 엔터티는 할당 안 됨. ---
	TSparseArray<FHktEntityMeta>        Metas;
	TSparseArray<FHktTransformView>     Transforms;
	TSparseArray<FHktPhysicsView>       Physics;
	TSparseArray<FHktMovementView>      Movement;
	TSparseArray<FHktVitalsView>        Vitals;
	TSparseArray<FHktCombatView>        Combat;
	TSparseArray<FHktOwnershipView>     Ownership;
	TSparseArray<FHktAnimationView>     Animation;
	TSparseArray<FHktVisualizationView> Visualization;
	TSparseArray<FHktItemView>          Items;
	TSparseArray<FHktVoxelSkinView>     VoxelSkins;
	TSparseArray<FHktTerrainDebrisView> TerrainDebris;

	int64 CurrentFrame = 0;

	TArray<FHktEntityId> SpawnedThisFrame;
	TArray<FHktEntityId> RemovedThisFrame;
	TArray<FHktEntityId> DirtyThisFrame;

	/** ProcessDiff에서 적재 → Processor Tick/Sync에서 소비 후 ClearFrameChanges에서 정리 */
	TArray<FHktPendingSpawn>     PendingSpawns;
	TArray<FHktPendingVFXEvent>  PendingVFXEvents;
	TArray<FHktPendingVFXAttach> PendingVFXAttachments;
	TArray<FHktPendingVFXDetach> PendingVFXDetachments;

	// --- 프레임 관리 ---
	void BeginFrame(int64 Frame);
	void ClearFrameChanges();

	// --- 엔터티 생명주기 ---
	void AddEntity(const FHktWorldState& WS, FHktEntityId Id);
	void RemoveEntity(FHktEntityId Id);

	// --- 델타 적용 ---
	void ApplyDelta(FHktEntityId Id, uint16 PropId, int32 NewValue);
	void ApplyOwnerDelta(FHktEntityId Id, int64 NewOwnerUid);
	void ApplyTagDelta(FHktEntityId Id, const FGameplayTagContainer& NewTags);
	void AddAnimTrigger(FHktEntityId Id, const FGameplayTag& Tag);

	// --- 조회 ---
	FORCEINLINE bool IsValid(FHktEntityId Id) const
	{
		return Id >= 0 && Metas.IsValidIndex(Id) && Metas[Id].IsAlive();
	}

	FORCEINLINE const FHktEntityMeta*        GetMeta(FHktEntityId Id)          const { return (Id >= 0 && Metas.IsValidIndex(Id))         ? &Metas[Id]         : nullptr; }
	FORCEINLINE const FHktTransformView*     GetTransform(FHktEntityId Id)     const { return (Id >= 0 && Transforms.IsValidIndex(Id))    ? &Transforms[Id]    : nullptr; }
	FORCEINLINE const FHktPhysicsView*       GetPhysics(FHktEntityId Id)       const { return (Id >= 0 && Physics.IsValidIndex(Id))       ? &Physics[Id]       : nullptr; }
	FORCEINLINE const FHktMovementView*      GetMovement(FHktEntityId Id)      const { return (Id >= 0 && Movement.IsValidIndex(Id))      ? &Movement[Id]      : nullptr; }
	FORCEINLINE const FHktVitalsView*        GetVitals(FHktEntityId Id)        const { return (Id >= 0 && Vitals.IsValidIndex(Id))        ? &Vitals[Id]        : nullptr; }
	FORCEINLINE const FHktCombatView*        GetCombat(FHktEntityId Id)        const { return (Id >= 0 && Combat.IsValidIndex(Id))        ? &Combat[Id]        : nullptr; }
	FORCEINLINE const FHktOwnershipView*     GetOwnership(FHktEntityId Id)     const { return (Id >= 0 && Ownership.IsValidIndex(Id))     ? &Ownership[Id]     : nullptr; }
	FORCEINLINE const FHktAnimationView*     GetAnimation(FHktEntityId Id)     const { return (Id >= 0 && Animation.IsValidIndex(Id))     ? &Animation[Id]     : nullptr; }
	FORCEINLINE const FHktVisualizationView* GetVisualization(FHktEntityId Id) const { return (Id >= 0 && Visualization.IsValidIndex(Id)) ? &Visualization[Id] : nullptr; }
	FORCEINLINE const FHktItemView*          GetItem(FHktEntityId Id)          const { return (Id >= 0 && Items.IsValidIndex(Id))         ? &Items[Id]         : nullptr; }
	FORCEINLINE const FHktVoxelSkinView*     GetVoxelSkin(FHktEntityId Id)     const { return (Id >= 0 && VoxelSkins.IsValidIndex(Id))    ? &VoxelSkins[Id]    : nullptr; }
	FORCEINLINE const FHktTerrainDebrisView* GetTerrainDebris(FHktEntityId Id) const { return (Id >= 0 && TerrainDebris.IsValidIndex(Id)) ? &TerrainDebris[Id] : nullptr; }

	FORCEINLINE FHktEntityMeta*           GetMutableMeta(FHktEntityId Id)             { return (Id >= 0 && Metas.IsValidIndex(Id))            ? &Metas[Id]            : nullptr; }
	FORCEINLINE FHktTransformView*        GetMutableTransform(FHktEntityId Id)        { return (Id >= 0 && Transforms.IsValidIndex(Id))       ? &Transforms[Id]       : nullptr; }
	FORCEINLINE FHktAnimationView*        GetMutableAnimation(FHktEntityId Id)        { return (Id >= 0 && Animation.IsValidIndex(Id))        ? &Animation[Id]        : nullptr; }
	FORCEINLINE FHktVisualizationView*    GetMutableVisualization(FHktEntityId Id)    { return (Id >= 0 && Visualization.IsValidIndex(Id))    ? &Visualization[Id]    : nullptr; }

	FORCEINLINE int64 GetCurrentFrame() const { return CurrentFrame; }

	void Clear();

	// --- 유틸 ---
	static EHktRenderCategory DetermineRenderCategory(const FGameplayTagContainer& Tags);
	static FLinearColor GetTeamColor(int32 TeamIndex);

private:
	/** RenderCategory / Tags를 기반으로 필요한 뷰만 할당 */
	void AllocateViewsForEntity(FHktEntityId Id, EHktRenderCategory Category, const FGameplayTagContainer& Tags);

	/** 해당 프레임에 처음 더티가 되면 DirtyThisFrame에 추가 */
	void TouchDirty(FHktEntityId Id);

	// --- 뷰별 델타 핸들러 ---
	void InitTransformFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktTransformView& V, int64 F);
	void InitPhysicsFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktPhysicsView& V, int64 F);
	void InitMovementFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktMovementView& V, int64 F);
	void InitVitalsFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktVitalsView& V, int64 F);
	void InitCombatFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktCombatView& V, int64 F);
	void InitOwnershipFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktOwnershipView& V, int64 F);
	void InitAnimationFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktAnimationView& V, int64 F);
	void InitVisualizationFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktVisualizationView& V, int64 F);
	void InitItemFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktItemView& V, int64 F);
	void InitVoxelSkinFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktVoxelSkinView& V, int64 F);
	void InitTerrainDebrisFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktTerrainDebrisView& V, int64 F);
};
