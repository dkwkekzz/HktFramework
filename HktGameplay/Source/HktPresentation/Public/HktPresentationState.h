// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktCoreDefs.h"
#include "HktVisualField.h"
#include "HktWorldState.h"
#include "HktCoreProperties.h"
#include "HktTagDataAsset.h"
#include "GameplayTagContainer.h"
#include "Math/Color.h"
#include "Misc/EnumClassFlags.h"
#include "UObject/SoftObjectPath.h"

class UHktAssetSubsystem;

/**
 * Delta 적용 실패(drop) 사유 비트플래그.
 * 동일 (Entity, Reason) 조합당 1회만 로그하기 위해 엔터티별 비트마스크로 누적된다.
 * RemoveEntity 시 해당 엔터티 슬롯 제거 → 재spawn 시 재로깅 가능.
 *
 * 설계 노트:
 *  - PropId 별로 분리하지 않는 이유: 같은 뷰 미할당으로 인한 cascade(예: Movement 뷰 부재 →
 *    VelX/Y/Z + MoveTargetX/Y/Z + MoveForce + IsMoving + IsGrounded = 9개 PropId 가 모두 drop)는
 *    근본 원인이 하나이므로 카테고리 단위 1회 로그로 충분. 첫 로그 메시지에 trigger PropId 가
 *    포함되므로 진단 시작점도 명확.
 *  - 저장소: TSparseArray<EHktDropReason> (엔터티당 uint16 2바이트, 다른 SOA 뷰들과 동일 패턴).
 *  - 게이트: ShouldLogDropOnce 가 EventLog 활성 + Level 조건도 함께 검사 → 패널 닫힌 동안에는
 *    dedup 비트도 set 되지 않음 (패널 열리면 그때 첫 로그 정상 출력).
 */
enum class EHktDropReason : uint16
{
	None                      = 0,
	Property_InvalidEntity    = 1 << 0,
	Property_PropIdRange      = 1 << 1,
	Property_NoDispatcher     = 1 << 2,
	Property_ViewMissing      = 1 << 3,
	Owner_InvalidEntity       = 1 << 4,
	Owner_ViewMissing         = 1 << 5,
	Tag_InvalidEntity         = 1 << 6,
	Tag_ViewMissing           = 1 << 7,   // 의도적 스킵 — Verbose
	AnimTrigger_InvalidEntity = 1 << 8,
};
ENUM_CLASS_FLAGS(EHktDropReason);

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

	// PropertyId::ActionIntentTarget 미러. 공격 의도의 대상 EntityId — 클라이언트가 공격 애니메이션
	// 재생 시 표적을 바라보도록 facing 을 보정할 때 사용. InvalidEntityId 면 표적 없음(이동/idle).
	// 값 자체는 표적 사망/Brain 종료 시점에 0 으로 재설정되므로 영구 sticky 아님.
	THktVisualField<int32> TargetEntityId;

	FORCEINLINE bool AnyDirty(int64 F) const
	{
		return AttackPower.IsDirty(F) || Defense.IsDirty(F) || CP.IsDirty(F)
			|| MaxCP.IsDirty(F) || CPRatio.IsDirty(F) || AttackSpeed.IsDirty(F)
			|| MotionPlayRate.IsDirty(F) || TargetEntityId.IsDirty(F);
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

/**
 * FHktSpriteView — 2D 스프라이트 캐릭터의 Character + Facing + AnimStartTick.
 * 캐릭터 1개당 UHktHISMSpriteVisualAsset 1개를 매핑한다 (Visual 의 AnimationAsset 으로 anim 분기).
 * 프레임 결정은 Processor(Sync 시점)에서 Animation/Transform/CurrentTick과 결합하여 수행.
 */
struct FHktSpriteView
{
	THktVisualField<FGameplayTag> Character;      // CharacterTemplate Tag — 캐릭터당 1개
	THktVisualField<uint8>        Facing;         // 0..7 (N,NE,E,SE,S,SW,W,NW)
	// 화면-공간 좌우 (0=Left, 1=Right). 카메라 right vector 에 LastMoveDirXY 를
	// 투영한 부호로 산출. 좌/우 2슬롯 sprite (NumDirections<=2) 경로가 8방향
	// Facing 의 N/S→E 양자화 손실을 우회해 정확한 좌우 결정에 사용한다.
	THktVisualField<uint8>        FacingRight;
	THktVisualField<int32>        AnimStartTick;  // AnimState 전환 시점의 VM frame

	FORCEINLINE bool AnyDirty(int64 F) const
	{
		return Character.IsDirty(F)
			|| Facing.IsDirty(F) || FacingRight.IsDirty(F) || AnimStartTick.IsDirty(F);
	}

	FORCEINLINE bool IsCharacterDirty(int64 F) const
	{
		return Character.IsDirty(F);
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
	TSparseArray<FHktSpriteView>        Sprites;
	TSparseArray<FHktTerrainDebrisView> TerrainDebris;

	int64 CurrentFrame = 0;

	// ─── 카메라 거리 컬링 (클라 렌더 한정) ───
	//
	// `UHktPresentationSubsystem::OnTick` 이 SyncProcessors 직전에 매 프레임 갱신.
	// 각 Processor (ActorProcessor / SpriteCrowdHost) 는 `IsEntityWithinRenderCull(Id)`
	// 로 게이트한다 — ActorProcessor 는 반경 밖 Actor 를 파괴/미생성(재진입 시 재스폰),
	// SpriteCrowdHost 는 unregister. 시뮬은 그대로 진행 (서버 권위 유지).
	// CullRadiusSqCm <= 0 이면 컬링 비활성화 (모두 표시).
	//
	// CullCenter: 반경의 중심. 카메라가 따라가는 View Target(보통 조종 폰)의 위치를 사용한다 —
	// 카메라 물리 위치(숄더/탑다운에서 캐릭터 뒤·위로 치우침)가 아니라 플레이어 캐릭터 주변에
	// 대칭 버블을 형성하기 위함. View Target 부재 시 카메라 위치로 폴백.
	FVector CullCenter = FVector::ZeroVector;
	float   CullRadiusSqCm = 0.f;

	// 반경 이탈 후 Actor 파괴까지의 유예 시간(초). 경계에서 진동하는 대상의 파괴/재스폰
	// 깜빡임을 막는다 — 연속으로 이 시간만큼 반경 밖에 머문 Actor 만 파괴, 그 안에 재진입하면
	// 타이머가 취소되어 살아남는다. 유예 중에도 정상 렌더링(숨김 없음). <=0 이면 즉시 파괴.
	float   CullDespawnLingerSeconds = 0.f;

	/**
	 * 엔터티가 컬링 반경(CullCenter 중심) 안에 있는지. CullRadiusSqCm<=0 (비활성) 또는
	 * Transform 미할당이면 true (그린다). 좌표 출처: RenderLocation (있으면) → Location 폴백.
	 *
	 * 부착(장착) 아이템은 자신의 SOA Location 이 소유자를 따라 갱신되지 않아 stale 하므로,
	 * 소유자의 위치로 컬링한다 → 아이템 액터가 소유자와 항상 함께 스폰/파괴되어 생명주기가
	 * 일치한다. (소유자만 파괴되고 아이템이 남아 소켓 부착이 끊긴 채 고아가 되는 문제 방지.)
	 */
	FORCEINLINE bool IsEntityWithinRenderCull(FHktEntityId Id) const
	{
		if (CullRadiusSqCm <= 0.f) return true;
		const FHktTransformView* T = GetTransform(ResolveCullAnchorEntity(Id));
		if (!T) return true;
		const FVector P = T->RenderLocation.Get().IsZero() ? T->Location.Get() : T->RenderLocation.Get();
		return FVector::DistSquared(P, CullCenter) <= CullRadiusSqCm;
	}

	/**
	 * 컬링 위치 판정에 사용할 앵커 엔터티. 부착 아이템이면 소유자 엔터티를, 그 외에는 자기 자신을
	 * 반환한다. 소유자 Transform 이 없으면(소유자 제거 등) 자기 자신으로 폴백.
	 */
	FORCEINLINE FHktEntityId ResolveCullAnchorEntity(FHktEntityId Id) const
	{
		const FHktItemView* Item = GetItem(Id);
		if (Item && Item->IsAttached())
		{
			const FHktEntityId OwnerId = static_cast<FHktEntityId>(Item->OwnerEntity.Get());
			if (OwnerId != InvalidEntityId && GetTransform(OwnerId))
				return OwnerId;
		}
		return Id;
	}

	TArray<FHktEntityId> SpawnedThisFrame;
	TArray<FHktEntityId> RemovedThisFrame;
	TArray<FHktEntityId> DirtyThisFrame;

	/** ProcessDiff에서 적재 → Processor Tick/Sync에서 소비 후 ClearFrameChanges에서 정리 */
	TArray<FHktPendingSpawn>     PendingSpawns;
	TArray<FHktPendingVFXEvent>  PendingVFXEvents;
	TArray<FHktPendingVFXAttach> PendingVFXAttachments;
	TArray<FHktPendingVFXDetach> PendingVFXDetachments;

	/**
	 * Delta 적용 실패(drop) 로그 dedup — 엔터티별 사유 비트마스크.
	 * 동일 (Entity, Reason) 조합당 1회만 출력. RemoveEntity 시 슬롯 제거 → 재spawn 시 재로깅.
	 * 매 틱 발생 가능한 silent-drop(예: VelX 가 매 틱 변경되는데 Movement 뷰 부재)이
	 * 로그를 도배하는 것을 원천 차단한다.
	 *
	 * 다른 SOA 뷰들과 동일하게 EntityId 인덱싱 TSparseArray 사용 — TMap 해시 오버헤드 회피,
	 * 캐시 친화적 dense layout.
	 */
	TSparseArray<EHktDropReason> LoggedDropFlags;

	/**
	 * Id < 0 (네트워크/직렬화 버그) 케이스 dedup — sparse array 인덱싱 불가능하므로 단일 필드 사용.
	 * 모든 음수 Id 가 공유 (rare path 이므로 충분).
	 */
	EHktDropReason NegativeIdLoggedFlags = EHktDropReason::None;

	// --- 프레임 관리 ---
	void BeginFrame(int64 Frame);
	void ClearFrameChanges();

	// --- 엔터티 생명주기 ---
	// AssetSubsystem 은 visual tag → TagDataAsset 클래스 → RenderCategory 해석에 사용.
	// nullptr 이면 RenderCategory = None 으로 처리 (테스트/헤드리스 경로 호환).
	void AddEntity(const FHktWorldState& WS, FHktEntityId Id, const UHktAssetSubsystem* AssetSubsystem);
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
	FORCEINLINE const FHktSpriteView*        GetSprite(FHktEntityId Id)        const { return (Id >= 0 && Sprites.IsValidIndex(Id))       ? &Sprites[Id]       : nullptr; }
	FORCEINLINE const FHktTerrainDebrisView* GetTerrainDebris(FHktEntityId Id) const { return (Id >= 0 && TerrainDebris.IsValidIndex(Id)) ? &TerrainDebris[Id] : nullptr; }

	FORCEINLINE FHktEntityMeta*           GetMutableMeta(FHktEntityId Id)             { return (Id >= 0 && Metas.IsValidIndex(Id))            ? &Metas[Id]            : nullptr; }
	FORCEINLINE FHktTransformView*        GetMutableTransform(FHktEntityId Id)        { return (Id >= 0 && Transforms.IsValidIndex(Id))       ? &Transforms[Id]       : nullptr; }
	FORCEINLINE FHktAnimationView*        GetMutableAnimation(FHktEntityId Id)        { return (Id >= 0 && Animation.IsValidIndex(Id))        ? &Animation[Id]        : nullptr; }
	FORCEINLINE FHktVisualizationView*    GetMutableVisualization(FHktEntityId Id)    { return (Id >= 0 && Visualization.IsValidIndex(Id))    ? &Visualization[Id]    : nullptr; }
	FORCEINLINE FHktSpriteView*           GetMutableSprite(FHktEntityId Id)           { return (Id >= 0 && Sprites.IsValidIndex(Id))          ? &Sprites[Id]          : nullptr; }

	FORCEINLINE int64 GetCurrentFrame() const { return CurrentFrame; }

	void Clear();

	// --- 유틸 ---
	/**
	 * 엔터티의 렌더 카테고리 결정. 우선순위:
	 *   1) WS 의 EntitySpawnTag(visual tag) 로 AssetSubsystem 에 매핑된 TagDataAsset 클래스 → GetRenderCategory()
	 *   2) 매핑 실패 시 EHktRenderCategory::None
	 * 기존 archetype 태그(Entity_Character/NPC/...) 분기는 더 이상 사용하지 않음.
	 */
	static EHktRenderCategory DetermineRenderCategory(const FHktWorldState& WS, FHktEntityId Id, const UHktAssetSubsystem* AssetSubsystem);
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
	void InitSpriteFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktSpriteView& V, int64 F);
	void InitTerrainDebrisFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktTerrainDebrisView& V, int64 F);
};
