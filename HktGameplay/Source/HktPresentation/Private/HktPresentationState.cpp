// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPresentationState.h"
#include "GameplayTagsManager.h"
#include "HktPresentationLog.h"
#include "HktRuntimeTags.h"
#include "HktAssetSubsystem.h"
#include "HktCoreEventLog.h"

namespace
{
	static FGameplayTag IndexToTag(int32 InTagNetIndex)
	{
		FName TagName = UGameplayTagsManager::Get().GetTagNameFromNetIndex(static_cast<FGameplayTagNetIndex>(InTagNetIndex));
		return FGameplayTag::RequestGameplayTag(TagName);
	}

	static const FLinearColor GTeamColors[] = {
		FLinearColor::White,
		FLinearColor(0.3f, 0.6f, 1.f),
		FLinearColor(1.f, 0.3f, 0.3f),
		FLinearColor(0.3f, 1.f, 0.3f),
		FLinearColor(1.f, 1.f, 0.3f)
	};
	static constexpr int32 GTeamColorCount = UE_ARRAY_COUNT(GTeamColors);

	/** SparseArray의 특정 인덱스에 뷰가 존재하도록 보장. 부재 시 삽입. */
	template<typename ViewT>
	FORCEINLINE ViewT& EnsureView(TSparseArray<ViewT>& Arr, FHktEntityId Id)
	{
		const int32 Index = static_cast<int32>(Id);
		if (!Arr.IsValidIndex(Index))
		{
			Arr.Insert(Index, ViewT());
		}
		return Arr[Index];
	}

	// ============================================================================
	// ApplyDelta 디스패치 테이블
	//
	// PropertyId::XXX는 runtime const FHktPropertyDef 객체라 constexpr이 아니다.
	// switch의 case 레이블로 쓸 수 없기 때문에 런타임 테이블 룩업으로 디스패치.
	// 테이블은 첫 호출 시 한 번만 초기화되며, 미등록 슬롯은 nullptr로 남아 자동 스킵.
	// ============================================================================
	// 디스패처 반환값:
	//   true  = 대상 뷰가 할당돼 있어 정상 적용됨
	//   false = 뷰 미할당 (해당 엔터티 카테고리에서 의도적으로 누락된 뷰; ApplyDelta 가 사유 로그)
	using FHktDeltaApplier = bool(*)(FHktPresentationState&, FHktEntityId, int32, int64);

	const TArray<FHktDeltaApplier>& GetDeltaDispatchTable()
	{
		static const TArray<FHktDeltaApplier> Table = []()
		{
			TArray<FHktDeltaApplier> T;
			T.SetNumZeroed(HktProperty::MaxCount());

			// --- Transform ---
			// Location/RenderLocation 동시 갱신 (단일 축 반영)
			T[PropertyId::PosX] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				FHktTransformView* Tv = S.GetMutableTransform(Id);
				if (!Tv) return false;
				Tv->Location.Value.X = static_cast<float>(V);
				Tv->Location.Set(Tv->Location.Value, F);
				Tv->RenderLocation.Set(Tv->Location.Value, F);
				return true;
			};
			T[PropertyId::PosY] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				FHktTransformView* Tv = S.GetMutableTransform(Id);
				if (!Tv) return false;
				Tv->Location.Value.Y = static_cast<float>(V);
				Tv->Location.Set(Tv->Location.Value, F);
				Tv->RenderLocation.Set(Tv->Location.Value, F);
				return true;
			};
			T[PropertyId::PosZ] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				FHktTransformView* Tv = S.GetMutableTransform(Id);
				if (!Tv) return false;
				Tv->Location.Value.Z = static_cast<float>(V);
				Tv->Location.Set(Tv->Location.Value, F);
				Tv->RenderLocation.Set(Tv->Location.Value, F);
				return true;
			};
			T[PropertyId::RotYaw] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				FHktTransformView* Tv = S.GetMutableTransform(Id);
				if (!Tv) return false;
				Tv->Rotation.Value.Yaw = static_cast<float>(V);
				Tv->Rotation.Set(Tv->Rotation.Value, F);
				return true;
			};

			// --- Physics ---
			// Property 값을 그대로 반영 (floor 없음). 가시 capsule 이 필요한 actor 측에서
			// 각자 fallback 처리 (HktUnitActor::ApplyPhysics 등) — ViewModel 은 권위값 1:1.
			T[PropertyId::CollisionRadius] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Physics.IsValidIndex(Id)) return false;
				S.Physics[Id].CollisionRadius.Set(static_cast<float>(V), F);
				return true;
			};
			T[PropertyId::CollisionHalfHeight] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Physics.IsValidIndex(Id)) return false;
				S.Physics[Id].CollisionHalfHeight.Set(static_cast<float>(V), F);
				return true;
			};
			T[PropertyId::CollisionLayer] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Physics.IsValidIndex(Id)) return false;
				S.Physics[Id].CollisionLayer.Set(V, F);
				return true;
			};

			// --- Movement ---
			T[PropertyId::MoveTargetX] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Movement.IsValidIndex(Id)) return false;
				FHktMovementView& M = S.Movement[Id];
				M.MoveTarget.Value.X = static_cast<float>(V);
				M.MoveTarget.Set(M.MoveTarget.Value, F);
				return true;
			};
			T[PropertyId::MoveTargetY] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Movement.IsValidIndex(Id)) return false;
				FHktMovementView& M = S.Movement[Id];
				M.MoveTarget.Value.Y = static_cast<float>(V);
				M.MoveTarget.Set(M.MoveTarget.Value, F);
				return true;
			};
			T[PropertyId::MoveTargetZ] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Movement.IsValidIndex(Id)) return false;
				FHktMovementView& M = S.Movement[Id];
				M.MoveTarget.Value.Z = static_cast<float>(V);
				M.MoveTarget.Set(M.MoveTarget.Value, F);
				return true;
			};
			T[PropertyId::MoveForce] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Movement.IsValidIndex(Id)) return false;
				S.Movement[Id].MoveForce.Set(static_cast<float>(V), F);
				return true;
			};
			T[PropertyId::IsMoving] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Movement.IsValidIndex(Id)) return false;
				S.Movement[Id].bIsMoving.Set(V != 0, F);
				return true;
			};
			T[PropertyId::IsGrounded] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Movement.IsValidIndex(Id)) return false;
				S.Movement[Id].bIsJumping.Set(V == 0, F);
				return true;
			};
			T[PropertyId::VelX] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Movement.IsValidIndex(Id)) return false;
				FHktMovementView& M = S.Movement[Id];
				M.Velocity.Value.X = static_cast<float>(V);
				M.Velocity.Set(M.Velocity.Value, F);
				return true;
			};
			T[PropertyId::VelY] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Movement.IsValidIndex(Id)) return false;
				FHktMovementView& M = S.Movement[Id];
				M.Velocity.Value.Y = static_cast<float>(V);
				M.Velocity.Set(M.Velocity.Value, F);
				return true;
			};
			T[PropertyId::VelZ] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Movement.IsValidIndex(Id)) return false;
				FHktMovementView& M = S.Movement[Id];
				M.Velocity.Value.Z = static_cast<float>(V);
				M.Velocity.Set(M.Velocity.Value, F);
				return true;
			};

			// --- Vitals (비율은 같은 뷰 안에서 상호 의존) ---
			T[PropertyId::Health] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Vitals.IsValidIndex(Id)) return false;
				FHktVitalsView& Vi = S.Vitals[Id];
				Vi.Health.Set(static_cast<float>(V), F);
				Vi.HealthRatio.Set((Vi.MaxHealth.Get() > 0.f) ? static_cast<float>(V) / Vi.MaxHealth.Get() : 0.f, F);
				return true;
			};
			T[PropertyId::MaxHealth] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Vitals.IsValidIndex(Id)) return false;
				FHktVitalsView& Vi = S.Vitals[Id];
				Vi.MaxHealth.Set(static_cast<float>(V), F);
				Vi.HealthRatio.Set((V > 0) ? Vi.Health.Get() / static_cast<float>(V) : 0.f, F);
				return true;
			};
			T[PropertyId::Mana] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Vitals.IsValidIndex(Id)) return false;
				FHktVitalsView& Vi = S.Vitals[Id];
				Vi.Mana.Set(static_cast<float>(V), F);
				Vi.ManaRatio.Set((Vi.MaxMana.Get() > 0.f) ? static_cast<float>(V) / Vi.MaxMana.Get() : 0.f, F);
				return true;
			};
			T[PropertyId::MaxMana] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Vitals.IsValidIndex(Id)) return false;
				FHktVitalsView& Vi = S.Vitals[Id];
				Vi.MaxMana.Set(static_cast<float>(V), F);
				Vi.ManaRatio.Set((V > 0) ? Vi.Mana.Get() / static_cast<float>(V) : 0.f, F);
				return true;
			};

			// --- Combat ---
			T[PropertyId::AttackPower] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Combat.IsValidIndex(Id)) return false;
				S.Combat[Id].AttackPower.Set(V, F);
				return true;
			};
			T[PropertyId::Defense] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Combat.IsValidIndex(Id)) return false;
				S.Combat[Id].Defense.Set(V, F);
				return true;
			};
			T[PropertyId::CP] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Combat.IsValidIndex(Id)) return false;
				FHktCombatView& C = S.Combat[Id];
				C.CP.Set(V, F);
				C.CPRatio.Set((C.MaxCP.Get() > 0) ? static_cast<float>(V) / static_cast<float>(C.MaxCP.Get()) : 0.f, F);
				return true;
			};
			T[PropertyId::MaxCP] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Combat.IsValidIndex(Id)) return false;
				FHktCombatView& C = S.Combat[Id];
				C.MaxCP.Set(V, F);
				C.CPRatio.Set((V > 0) ? static_cast<float>(C.CP.Get()) / static_cast<float>(V) : 0.f, F);
				return true;
			};
			T[PropertyId::AttackSpeed] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Combat.IsValidIndex(Id)) return false;
				S.Combat[Id].AttackSpeed.Set(V, F);
				return true;
			};
			T[PropertyId::MotionPlayRate] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Combat.IsValidIndex(Id)) return false;
				S.Combat[Id].MotionPlayRate.Set(V, F);
				return true;
			};

			// --- Ownership ---
			T[PropertyId::Team] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Ownership.IsValidIndex(Id)) return false;
				FHktOwnershipView& O = S.Ownership[Id];
				O.Team.Set(V, F);
				O.TeamColor.Set(FHktPresentationState::GetTeamColor(V), F);
				return true;
			};

			// --- Animation ---
			T[PropertyId::AnimState] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Animation.IsValidIndex(Id)) return false;
				S.Animation[Id].AnimState.Set(IndexToTag(V), F);
				return true;
			};
			T[PropertyId::VisualState] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Animation.IsValidIndex(Id)) return false;
				S.Animation[Id].MontageState.Set(IndexToTag(V), F);
				return true;
			};
			T[PropertyId::AnimStateUpper] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Animation.IsValidIndex(Id)) return false;
				S.Animation[Id].AnimStateUpper.Set(IndexToTag(V), F);
				return true;
			};
			T[PropertyId::Stance] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Animation.IsValidIndex(Id)) return false;
				S.Animation[Id].Stance.Set(IndexToTag(V), F);
				return true;
			};

			// --- Visualization & Sprite (둘 다 EntitySpawnTag = 캐릭터 Template Tag로 재사용) ---
			// Visualization 또는 Sprites 중 하나라도 적용되면 성공으로 간주.
			T[PropertyId::EntitySpawnTag] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				const FGameplayTag Tag = IndexToTag(V);
				bool bApplied = false;
				if (S.Visualization.IsValidIndex(Id)) { S.Visualization[Id].VisualElement.Set(Tag, F); bApplied = true; }
				if (S.Sprites.IsValidIndex(Id))      { S.Sprites[Id].Character.Set(Tag, F);      bApplied = true; }
				return bApplied;
			};

			// --- Item ---
			T[PropertyId::OwnerEntity] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Items.IsValidIndex(Id)) return false;
				S.Items[Id].OwnerEntity.Set(V, F);
				return true;
			};
			T[PropertyId::EquipIndex] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Items.IsValidIndex(Id)) return false;
				S.Items[Id].EquipIndex.Set(V, F);
				return true;
			};
			T[PropertyId::ItemState] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Items.IsValidIndex(Id)) return false;
				S.Items[Id].ItemState.Set(V, F);
				return true;
			};
			T[PropertyId::Equippable] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Items.IsValidIndex(Id)) return false;
				S.Items[Id].Equippable.Set(V, F);
				return true;
			};

			// --- Voxel Skin ---
			T[PropertyId::VoxelSkinSet] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.VoxelSkins.IsValidIndex(Id)) return false;
				S.VoxelSkins[Id].VoxelSkinSet.Set(V, F);
				return true;
			};
			T[PropertyId::VoxelPalette] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.VoxelSkins.IsValidIndex(Id)) return false;
				S.VoxelSkins[Id].VoxelPalette.Set(V, F);
				return true;
			};

			// --- Sprite (2D 라그나로크 방식) ---
			// Facing 은 VM 권위가 아님 — 클라(HktSpriteCrowdHost / HktSpritePaperActor)가
			// LastMoveDirXY + 카메라 yaw 로 산출 후 Sprites[Id].Facing 에 직접 기록.
			T[PropertyId::AnimStartTick] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				if (!S.Sprites.IsValidIndex(Id)) return false;
				S.Sprites[Id].AnimStartTick.Set(V, F);
				return true;
			};

			// --- Terrain Debris (뷰가 없으면 lazy 할당 — 항상 성공) ---
			T[PropertyId::TerrainTypeId] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F) -> bool
			{
				FHktTerrainDebrisView& Dv = EnsureView(S.TerrainDebris, Id);
				Dv.TerrainTypeId.Set(V, F);
				return true;
			};

			return T;
		}();
		return Table;
	}
}

// ============================================================================
// FHktPresentationState — 정적 유틸
// ============================================================================

EHktRenderCategory FHktPresentationState::DetermineRenderCategory(const FHktWorldState& WS, FHktEntityId Id, const UHktAssetSubsystem* AssetSubsystem)
{
	if (!AssetSubsystem)
	{
		HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
			TEXT("RenderCategory=None: AssetSubsystem 미주입 (시각적으로 보이지 않음)"), Id);
		return EHktRenderCategory::None;
	}

	const FGameplayTag VisualTag = IndexToTag(WS.GetProperty(Id, PropertyId::EntitySpawnTag));
	if (!VisualTag.IsValid())
	{
		HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
			TEXT("RenderCategory=None: EntitySpawnTag 미설정 (시각적으로 보이지 않음)"), Id);
		return EHktRenderCategory::None;
	}

	const EHktRenderCategory Category = AssetSubsystem->GetTagRenderCategory(VisualTag);
	if (Category == EHktRenderCategory::None)
	{
		HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
			FString::Printf(TEXT("RenderCategory=None: Tag=%s 에 매핑된 TagDataAsset 없음 또는 GetRenderCategory()=None (시각적으로 보이지 않음)"), *VisualTag.ToString()),
			Id);
	}
	return Category;
}

FLinearColor FHktPresentationState::GetTeamColor(int32 TeamIndex)
{
	return GTeamColors[FMath::Clamp(TeamIndex, 0, GTeamColorCount - 1)];
}

// ============================================================================
// 뷰 할당 — RenderCategory/Tags 기반 필요 뷰만 할당
// ============================================================================

void FHktPresentationState::AllocateViewsForEntity(FHktEntityId Id, EHktRenderCategory Category, const FGameplayTagContainer& Tags)
{
	// [DIAG-PlayerInitV2] schema 2 회귀 진단 — id=0 + anim tag 패턴 추적용. 안정화 후 제거.
	UE_LOG(LogHktPresentation, Warning,
		TEXT("[DIAG] AllocateViewsForEntity Id=%d Category=%d Tags=[%s]"),
		static_cast<int32>(Id), static_cast<int32>(Category), *Tags.ToStringSimple());

	const int32 Index = static_cast<int32>(Id);

	// 재할당 안전성: 같은 ID로 AddEntity가 다시 호출되면 기존 뷰를 초기화.
	// TSparseArray::Insert는 이미 유효한 인덱스에 assert하므로 방어.
	auto EnsureSlot = [Index](auto& Arr)
	{
		using ElemT = typename std::remove_reference<decltype(Arr[Index])>::type;
		if (Arr.IsValidIndex(Index))
			Arr[Index] = ElemT{};
		else
			Arr.Insert(Index, ElemT{});
	};

	// Transform은 거의 모든 엔터티가 필요
	EnsureSlot(Transforms);

	const bool bIsItem       = Tags.HasTag(HktArchetypeTags::Entity_Item);
	const bool bIsActor      = (Category == EHktRenderCategory::Actor);
	const bool bIsMassEntity = (Category == EHktRenderCategory::MassEntity);
	const bool bIsCharacter  = Tags.HasTag(HktArchetypeTags::Entity_Character)
		|| Tags.HasTag(HktArchetypeTags::Entity_NPC);
	const bool bIsBuilding   = Tags.HasTag(HktArchetypeTags::Entity_Building);

	if (bIsActor || bIsMassEntity)      EnsureSlot(Physics);
	if (bIsCharacter || bIsMassEntity)  EnsureSlot(Movement);
	if (bIsCharacter || bIsBuilding)    EnsureSlot(Vitals);
	if (bIsCharacter)                   EnsureSlot(Combat);
	if (bIsActor)                       EnsureSlot(Ownership);
	if (bIsCharacter)                   EnsureSlot(Animation);
	if (bIsActor || bIsMassEntity)      EnsureSlot(Visualization);
	if (bIsItem)                        EnsureSlot(Items);

	// VoxelSkin — 복셀 캐릭터만 사용. 현재 태그 체계에 별도 구분 태그가 없어
	// Character 전원에 배치. 추후 Entity_VoxelCharacter 태그 도입 시 gate.
	if (bIsCharacter)                   EnsureSlot(VoxelSkins);

	// Sprite — 2D 라그나로크 방식 캐릭터. 현재는 Character/NPC 전원에 배치.
	// 추후 Entity_SpriteCharacter 태그 도입 시 gate.
	if (bIsCharacter)                   EnsureSlot(Sprites);

	// TerrainDebris — 분류되지 않은 엔터티를 Debris로 간주 (현재 Entity_Debris 태그 부재)
	if (Category == EHktRenderCategory::None)
		EnsureSlot(TerrainDebris);
}

// ============================================================================
// 초기값 로드 — WorldState → View
// ============================================================================

void FHktPresentationState::InitTransformFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktTransformView& V, int64 F)
{
	const FIntVector P = WS.GetPosition(Id);
	const FVector Loc(static_cast<float>(P.X), static_cast<float>(P.Y), static_cast<float>(P.Z));
	V.Location.Set(Loc, F);
	V.RenderLocation.Set(Loc, F);
	V.Rotation.Set(FRotator(0.f, static_cast<float>(WS.GetProperty(Id, PropertyId::RotYaw)), 0.f), F);
}

void FHktPresentationState::InitPhysicsFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktPhysicsView& V, int64 F)
{
	// ViewModel = Property 1:1 (floor 없음). dispatcher 와 동일 규약.
	V.CollisionRadius.Set(static_cast<float>(WS.GetProperty(Id, PropertyId::CollisionRadius)), F);
	V.CollisionHalfHeight.Set(static_cast<float>(WS.GetProperty(Id, PropertyId::CollisionHalfHeight)), F);
	V.CollisionLayer.Set(WS.GetProperty(Id, PropertyId::CollisionLayer), F);
}

void FHktPresentationState::InitMovementFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktMovementView& V, int64 F)
{
	V.MoveTarget.Set(FVector(
		static_cast<float>(WS.GetProperty(Id, PropertyId::MoveTargetX)),
		static_cast<float>(WS.GetProperty(Id, PropertyId::MoveTargetY)),
		static_cast<float>(WS.GetProperty(Id, PropertyId::MoveTargetZ))), F);
	V.MoveForce.Set(static_cast<float>(WS.GetProperty(Id, PropertyId::MoveForce)), F);
	V.bIsMoving.Set(WS.GetProperty(Id, PropertyId::IsMoving) != 0, F);
	V.bIsJumping.Set(WS.GetProperty(Id, PropertyId::IsGrounded) == 0, F);
	V.Velocity.Set(FVector(
		static_cast<float>(WS.GetProperty(Id, PropertyId::VelX)),
		static_cast<float>(WS.GetProperty(Id, PropertyId::VelY)),
		static_cast<float>(WS.GetProperty(Id, PropertyId::VelZ))), F);
}

void FHktPresentationState::InitVitalsFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktVitalsView& V, int64 F)
{
	const float H  = static_cast<float>(WS.GetProperty(Id, PropertyId::Health));
	const float MH = static_cast<float>(WS.GetProperty(Id, PropertyId::MaxHealth));
	const float M  = static_cast<float>(WS.GetProperty(Id, PropertyId::Mana));
	const float MM = static_cast<float>(WS.GetProperty(Id, PropertyId::MaxMana));
	V.Health.Set(H, F);
	V.MaxHealth.Set(MH, F);
	V.HealthRatio.Set((MH > 0.f) ? H / MH : 0.f, F);
	V.Mana.Set(M, F);
	V.MaxMana.Set(MM, F);
	V.ManaRatio.Set((MM > 0.f) ? M / MM : 0.f, F);
}

void FHktPresentationState::InitCombatFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktCombatView& V, int64 F)
{
	V.AttackPower.Set(WS.GetProperty(Id, PropertyId::AttackPower), F);
	V.Defense.Set(WS.GetProperty(Id, PropertyId::Defense), F);
	const int32 CpVal = WS.GetProperty(Id, PropertyId::CP);
	const int32 MaxCpVal = WS.GetProperty(Id, PropertyId::MaxCP);
	V.CP.Set(CpVal, F);
	V.MaxCP.Set(MaxCpVal, F);
	V.CPRatio.Set((MaxCpVal > 0) ? static_cast<float>(CpVal) / static_cast<float>(MaxCpVal) : 0.f, F);
	V.AttackSpeed.Set(WS.GetProperty(Id, PropertyId::AttackSpeed), F);
	const int32 MprVal = WS.GetProperty(Id, PropertyId::MotionPlayRate);
	V.MotionPlayRate.Set(MprVal > 0 ? MprVal : WS.GetProperty(Id, PropertyId::AttackSpeed), F);
}

void FHktPresentationState::InitOwnershipFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktOwnershipView& V, int64 F)
{
	const int32 TeamIdx = WS.GetProperty(Id, PropertyId::Team);
	const int64 Uid = WS.GetOwnerUid(Id);
	V.Team.Set(TeamIdx, F);
	V.OwnedPlayerUid.Set(Uid, F);
	V.TeamColor.Set(GetTeamColor(TeamIdx), F);
	V.OwnerLabel.Set(Uid != 0 ? FString::Printf(TEXT("P:%lld"), Uid) : TEXT("-"), F);
}

void FHktPresentationState::InitAnimationFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktAnimationView& V, int64 F)
{
	V.AnimState.Set(IndexToTag(WS.GetProperty(Id, PropertyId::AnimState)), F);
	V.MontageState.Set(IndexToTag(WS.GetProperty(Id, PropertyId::VisualState)), F);
	V.AnimStateUpper.Set(IndexToTag(WS.GetProperty(Id, PropertyId::AnimStateUpper)), F);
	V.Stance.Set(IndexToTag(WS.GetProperty(Id, PropertyId::Stance)), F);
	V.Tags = WS.GetTags(Id);
	V.TagsDirtyFrame = F;
}

void FHktPresentationState::InitVisualizationFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktVisualizationView& V, int64 F)
{
	V.VisualElement.Set(IndexToTag(WS.GetProperty(Id, PropertyId::EntitySpawnTag)), F);
}

void FHktPresentationState::InitItemFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktItemView& V, int64 F)
{
	V.OwnerEntity.Set(WS.GetProperty(Id, PropertyId::OwnerEntity), F);
	V.EquipIndex.Set(WS.GetProperty(Id, PropertyId::EquipIndex), F);
	V.ItemState.Set(WS.GetProperty(Id, PropertyId::ItemState), F);
	V.Equippable.Set(WS.GetProperty(Id, PropertyId::Equippable), F);
}

void FHktPresentationState::InitVoxelSkinFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktVoxelSkinView& V, int64 F)
{
	V.VoxelSkinSet.Set(WS.GetProperty(Id, PropertyId::VoxelSkinSet), F);
	V.VoxelPalette.Set(WS.GetProperty(Id, PropertyId::VoxelPalette), F);
}

void FHktPresentationState::InitSpriteFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktSpriteView& V, int64 F)
{
	// Character Template Tag = SpawnEntity의 ClassTag (EntitySpawnTag). 별도 프로퍼티 없음.
	V.Character.Set(IndexToTag(WS.GetProperty(Id, PropertyId::EntitySpawnTag)), F);
	// Facing 은 VM 권위 아님 — 클라가 매 프레임 산출하므로 초기값은 기본(S=4) 유지.
	V.AnimStartTick.Set(WS.GetProperty(Id, PropertyId::AnimStartTick), F);
}

void FHktPresentationState::InitTerrainDebrisFromWS(const FHktWorldState& WS, FHktEntityId Id, FHktTerrainDebrisView& V, int64 F)
{
	V.TerrainTypeId.Set(WS.GetProperty(Id, PropertyId::TerrainTypeId), F);
}

// ============================================================================
// 프레임 관리
// ============================================================================

void FHktPresentationState::BeginFrame(int64 Frame)
{
	CurrentFrame = Frame;
	// SpawnedThisFrame / RemovedThisFrame / DirtyThisFrame는 여기서 초기화하지 않음.
	// Processor Sync 후 ClearFrameChanges()로 정리.
}

void FHktPresentationState::ClearFrameChanges()
{
	SpawnedThisFrame.Reset();
	RemovedThisFrame.Reset();
	DirtyThisFrame.Reset();
	PendingSpawns.Reset();
	PendingVFXEvents.Reset();
	PendingVFXAttachments.Reset();
	PendingVFXDetachments.Reset();
}

void FHktPresentationState::TouchDirty(FHktEntityId Id)
{
	if (Id < 0) return;
	FHktEntityMeta* M = GetMutableMeta(Id);
	if (!M) return;
	if (M->LastDirtyFrame != CurrentFrame)
	{
		M->LastDirtyFrame = CurrentFrame;
		DirtyThisFrame.Add(Id);
	}
}

// ============================================================================
// 엔터티 생명주기
// ============================================================================

void FHktPresentationState::AddEntity(const FHktWorldState& WS, FHktEntityId Id, const UHktAssetSubsystem* AssetSubsystem)
{
	if (Id < 0) return;

	const int32 Index = static_cast<int32>(Id);
	const FGameplayTagContainer Tags = WS.GetTags(Id);
	const EHktRenderCategory Category = DetermineRenderCategory(WS, Id, AssetSubsystem);

	// Meta 삽입
	FHktEntityMeta Meta;
	Meta.EntityId = Id;
	Meta.RenderCategory = Category;
	Meta.SpawnedFrame = CurrentFrame;
	Meta.RemovedFrame = 0;
	Meta.LastDirtyFrame = CurrentFrame;
	if (Metas.IsValidIndex(Index))
	{
		Metas[Index] = Meta;
	}
	else
	{
		Metas.Insert(Index, Meta);
	}

	// 카테고리/태그 기반 뷰 할당
	AllocateViewsForEntity(Id, Category, Tags);

	// 초기값 로드
	if (FHktTransformView* V = GetMutableTransform(Id))        InitTransformFromWS(WS, Id, *V, CurrentFrame);
	if (Physics.IsValidIndex(Index))                            InitPhysicsFromWS(WS, Id, Physics[Index], CurrentFrame);
	if (Movement.IsValidIndex(Index))                           InitMovementFromWS(WS, Id, Movement[Index], CurrentFrame);
	if (Vitals.IsValidIndex(Index))                             InitVitalsFromWS(WS, Id, Vitals[Index], CurrentFrame);
	if (Combat.IsValidIndex(Index))                             InitCombatFromWS(WS, Id, Combat[Index], CurrentFrame);
	if (Ownership.IsValidIndex(Index))                          InitOwnershipFromWS(WS, Id, Ownership[Index], CurrentFrame);
	if (FHktAnimationView* V = GetMutableAnimation(Id))         InitAnimationFromWS(WS, Id, *V, CurrentFrame);
	if (FHktVisualizationView* V = GetMutableVisualization(Id)) InitVisualizationFromWS(WS, Id, *V, CurrentFrame);
	if (Items.IsValidIndex(Index))                              InitItemFromWS(WS, Id, Items[Index], CurrentFrame);
	if (VoxelSkins.IsValidIndex(Index))                         InitVoxelSkinFromWS(WS, Id, VoxelSkins[Index], CurrentFrame);
	if (Sprites.IsValidIndex(Index))                            InitSpriteFromWS(WS, Id, Sprites[Index], CurrentFrame);
	if (TerrainDebris.IsValidIndex(Index))                      InitTerrainDebrisFromWS(WS, Id, TerrainDebris[Index], CurrentFrame);

	SpawnedThisFrame.Add(Id);
}

void FHktPresentationState::RemoveEntity(FHktEntityId Id)
{
	if (Id < 0 || !Metas.IsValidIndex(Id)) return;
	FHktEntityMeta& Meta = Metas[Id];
	if (!Meta.IsAlive()) return;

	Meta.RemovedFrame = CurrentFrame;
	RemovedThisFrame.Add(Id);

	// SparseArray 실제 제거 — 후속 프레임의 View 쿼리가 자연스럽게 null을 반환하도록
	const int32 Index = static_cast<int32>(Id);
	if (Transforms.IsValidIndex(Index))     Transforms.RemoveAt(Index);
	if (Physics.IsValidIndex(Index))        Physics.RemoveAt(Index);
	if (Movement.IsValidIndex(Index))       Movement.RemoveAt(Index);
	if (Vitals.IsValidIndex(Index))         Vitals.RemoveAt(Index);
	if (Combat.IsValidIndex(Index))         Combat.RemoveAt(Index);
	if (Ownership.IsValidIndex(Index))      Ownership.RemoveAt(Index);
	if (Animation.IsValidIndex(Index))      Animation.RemoveAt(Index);
	if (Visualization.IsValidIndex(Index))  Visualization.RemoveAt(Index);
	if (Items.IsValidIndex(Index))          Items.RemoveAt(Index);
	if (VoxelSkins.IsValidIndex(Index))     VoxelSkins.RemoveAt(Index);
	if (Sprites.IsValidIndex(Index))        Sprites.RemoveAt(Index);
	if (TerrainDebris.IsValidIndex(Index))  TerrainDebris.RemoveAt(Index);

	// Drop 로그 dedup 슬롯 정리 — 재spawn 시 같은 사유의 drop 이 다시 한 번 로그될 수 있도록.
	if (LoggedDropFlags.IsValidIndex(Index)) LoggedDropFlags.RemoveAt(Index);

	// Meta는 유지 (RemovedFrame 추적용). Clear()에서만 Meta 제거.
}

// ============================================================================
// 델타 적용 — PropertyId → 해당 뷰 필드로 디스패치
// ============================================================================

namespace
{
	/** Id 가 유효하지 않을 때의 사유 분류 — 진단 로그 전용 */
	static const TCHAR* DiagInvalidReason(const FHktPresentationState& S, FHktEntityId Id)
	{
		if (Id < 0)                              return TEXT("InvalidEntityId(<0)");
		if (!S.Metas.IsValidIndex(Id))           return TEXT("EntityNotInMetas(미스폰/InitialSync 미완)");
		if (!S.Metas[Id].IsAlive())              return TEXT("EntityDead(이미 Remove 됨)");
		return TEXT("Unknown");
	}

	/**
	 * Drop 로그 1회성 게이트 — 동일 (Entity, Reason) 조합은 한 번만 통과.
	 *
	 * EventLog 가 비활성(패널 미오픈) 또는 Level 이 MinLogLevel 미만이면 게이트 자체가 false 반환 →
	 * dedup 비트도 set 되지 않음. 이렇게 해서 "패널 닫힌 동안 drop 이 발생 → 비트 set →
	 * 패널 열어도 영영 dedup 으로 안 찍힘" 시나리오를 방지한다.
	 *
	 * Shipping 빌드(ENABLE_HKT_INSIGHTS 미정의): 항상 false 반환 → dedup 메모리/CPU 0.
	 *
	 * Id < 0 (네트워크/직렬화 버그) 케이스는 sparse array 인덱싱 불가하므로
	 * 모든 음수 Id 가 공유하는 단일 필드 NegativeIdLoggedFlags 로 1회 한정.
	 * (Clear() 에서만 리셋.)
	 */
	static bool ShouldLogDropOnce(FHktPresentationState& S, FHktEntityId Id, EHktDropReason Reason, EHktLogLevel Level)
	{
#if ENABLE_HKT_INSIGHTS
		if (!FHktCoreEventLog::Get().ShouldLog(Level))
			return false;

		EHktDropReason* Flags;
		if (Id < 0)
		{
			Flags = &S.NegativeIdLoggedFlags;
		}
		else
		{
			const int32 Index = static_cast<int32>(Id);
			if (!S.LoggedDropFlags.IsValidIndex(Index))
			{
				S.LoggedDropFlags.Insert(Index, EHktDropReason::None);
			}
			Flags = &S.LoggedDropFlags[Index];
		}

		if (EnumHasAnyFlags(*Flags, Reason))
			return false;
		*Flags |= Reason;
		return true;
#else
		return false;
#endif
	}
}

void FHktPresentationState::ApplyDelta(FHktEntityId Id, uint16 PropId, int32 NewValue)
{
	if (!IsValid(Id))
	{
		if (ShouldLogDropOnce(*this, Id, EHktDropReason::Property_InvalidEntity, EHktLogLevel::Warning))
		{
			const TCHAR* PropName = HktProperty::GetPropertyName(PropId);
			HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("DROP PropertyDelta Frame=%lld Prop=%s(%u) Value=%d Reason=%s (이후 동일 키는 dedup)"),
					CurrentFrame, PropName ? PropName : TEXT("?"), PropId, NewValue,
					DiagInvalidReason(*this, Id)),
				Id);
		}
		return;
	}

	const TArray<FHktDeltaApplier>& Table = GetDeltaDispatchTable();
	if (PropId >= Table.Num())
	{
		if (ShouldLogDropOnce(*this, Id, EHktDropReason::Property_PropIdRange, EHktLogLevel::Warning))
		{
			HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("DROP PropertyDelta Frame=%lld PropId=%u Value=%d Reason=PropIdOutOfRange(Table=%d) (이후 동일 키는 dedup)"),
					CurrentFrame, PropId, NewValue, Table.Num()),
				Id);
		}
		return;
	}
	FHktDeltaApplier Fn = Table[PropId];
	if (!Fn)
	{
		if (ShouldLogDropOnce(*this, Id, EHktDropReason::Property_NoDispatcher, EHktLogLevel::Warning))
		{
			const TCHAR* PropName = HktProperty::GetPropertyName(PropId);
			HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("DROP PropertyDelta Frame=%lld Prop=%s(%u) Value=%d Reason=NoDispatcher(디스패치 테이블 미등록) (이후 동일 키는 dedup)"),
					CurrentFrame, PropName ? PropName : TEXT("?"), PropId, NewValue),
				Id);
		}
		return;
	}

	const bool bApplied = Fn(*this, Id, NewValue, CurrentFrame);
	if (!bApplied)
	{
		if (ShouldLogDropOnce(*this, Id, EHktDropReason::Property_ViewMissing, EHktLogLevel::Warning))
		{
			const TCHAR* PropName = HktProperty::GetPropertyName(PropId);
			const FHktEntityMeta* M = GetMeta(Id);
			HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("DROP PropertyDelta Frame=%lld Prop=%s(%u) Value=%d Reason=ViewNotAllocated(Category=%d) — 이 PropertyId 가 요구하는 뷰가 이 엔터티 카테고리에서 미할당. AllocateViewsForEntity 매핑 확인 필요. (이후 동일 키는 dedup)"),
					CurrentFrame, PropName ? PropName : TEXT("?"), PropId, NewValue,
					M ? static_cast<int32>(M->RenderCategory) : -1),
				Id);
		}
		return;
	}

	TouchDirty(Id);
}


void FHktPresentationState::ApplyOwnerDelta(FHktEntityId Id, int64 NewOwnerUid)
{
	if (!IsValid(Id))
	{
		if (ShouldLogDropOnce(*this, Id, EHktDropReason::Owner_InvalidEntity, EHktLogLevel::Warning))
		{
			HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("DROP OwnerDelta Frame=%lld Owner=%lld Reason=%s (이후 동일 키는 dedup)"),
					CurrentFrame, NewOwnerUid, DiagInvalidReason(*this, Id)),
				Id);
		}
		return;
	}
	const int32 Index = static_cast<int32>(Id);
	if (!Ownership.IsValidIndex(Index))
	{
		if (ShouldLogDropOnce(*this, Id, EHktDropReason::Owner_ViewMissing, EHktLogLevel::Warning))
		{
			const FHktEntityMeta* M = GetMeta(Id);
			HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("DROP OwnerDelta Frame=%lld Owner=%lld Reason=OwnershipViewNotAllocated(Category=%d) — Actor 가 아닌 카테고리에는 Ownership 뷰 미할당. (이후 동일 키는 dedup)"),
					CurrentFrame, NewOwnerUid, M ? static_cast<int32>(M->RenderCategory) : -1),
				Id);
		}
		return;
	}

	FHktOwnershipView& V = Ownership[Index];
	V.OwnedPlayerUid.Set(NewOwnerUid, CurrentFrame);
	V.OwnerLabel.Set(NewOwnerUid != 0 ? FString::Printf(TEXT("P:%lld"), NewOwnerUid) : TEXT("-"), CurrentFrame);
	TouchDirty(Id);
}

void FHktPresentationState::ApplyTagDelta(FHktEntityId Id, const FGameplayTagContainer& NewTags)
{
	if (!IsValid(Id))
	{
		if (ShouldLogDropOnce(*this, Id, EHktDropReason::Tag_InvalidEntity, EHktLogLevel::Warning))
		{
			HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("DROP TagDelta Frame=%lld Tags=%s Reason=%s (이후 동일 키는 dedup)"),
					CurrentFrame, *NewTags.ToString(), DiagInvalidReason(*this, Id)),
				Id);
		}
		return;
	}
	const int32 Index = static_cast<int32>(Id);
	if (!Animation.IsValidIndex(Index))
	{
		// 태그만 변경되는 Item/Debris 엔터티의 경우 — Animation 뷰가 없는 카테고리는 의도적 스킵.
		// 정상 동작이지만 진단 가시성을 위해 Verbose 1회 로그 (EventLog 기본 MinLevel=Info 라 수집 안 됨).
		if (ShouldLogDropOnce(*this, Id, EHktDropReason::Tag_ViewMissing, EHktLogLevel::Verbose))
		{
			const FHktEntityMeta* M = GetMeta(Id);
			HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
				FString::Printf(TEXT("SKIP TagDelta Frame=%lld Tags=%s Reason=AnimationViewNotAllocated(Category=%d) — 비-Character 엔터티는 의도적 스킵"),
					CurrentFrame, *NewTags.ToString(), M ? static_cast<int32>(M->RenderCategory) : -1),
				Id);
		}
		return;
	}
	FHktAnimationView& V = Animation[Index];
	V.Tags = NewTags;
	V.TagsDirtyFrame = CurrentFrame;
	TouchDirty(Id);
}

void FHktPresentationState::AddAnimTrigger(FHktEntityId Id, const FGameplayTag& Tag)
{
	if (!IsValid(Id))
	{
		if (ShouldLogDropOnce(*this, Id, EHktDropReason::AnimTrigger_InvalidEntity, EHktLogLevel::Warning))
		{
			HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("DROP AnimTrigger Frame=%lld Tag=%s Reason=%s (이후 동일 키는 dedup)"),
					CurrentFrame, *Tag.ToString(), DiagInvalidReason(*this, Id)),
				Id);
		}
		return;
	}
	FHktAnimationView& V = EnsureView(Animation, Id);
	V.PendingAnimTriggers.Add(Tag);
	TouchDirty(Id);
}

// ============================================================================
// 전체 초기화
// ============================================================================

void FHktPresentationState::Clear()
{
	Metas.Empty();
	Transforms.Empty();
	Physics.Empty();
	Movement.Empty();
	Vitals.Empty();
	Combat.Empty();
	Ownership.Empty();
	Animation.Empty();
	Visualization.Empty();
	Items.Empty();
	VoxelSkins.Empty();
	Sprites.Empty();
	TerrainDebris.Empty();

	SpawnedThisFrame.Reset();
	RemovedThisFrame.Reset();
	DirtyThisFrame.Reset();
	PendingSpawns.Reset();
	PendingVFXEvents.Reset();
	PendingVFXAttachments.Reset();
	PendingVFXDetachments.Reset();
	LoggedDropFlags.Empty();
	NegativeIdLoggedFlags = EHktDropReason::None;
	CurrentFrame = 0;
}
