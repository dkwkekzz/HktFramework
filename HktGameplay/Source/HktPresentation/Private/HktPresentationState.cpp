// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPresentationState.h"
#include "GameplayTagsManager.h"
#include "HktRuntimeTags.h"

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
	using FHktDeltaApplier = void(*)(FHktPresentationState&, FHktEntityId, int32, int64);

	const TArray<FHktDeltaApplier>& GetDeltaDispatchTable()
	{
		static const TArray<FHktDeltaApplier> Table = []()
		{
			TArray<FHktDeltaApplier> T;
			T.SetNumZeroed(HktProperty::MaxCount());

			// --- Transform ---
			// Location/RenderLocation 동시 갱신 (단일 축 반영)
			T[PropertyId::PosX] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (FHktTransformView* Tv = S.GetMutableTransform(Id))
				{
					Tv->Location.Value.X = static_cast<float>(V);
					Tv->Location.Set(Tv->Location.Value, F);
					Tv->RenderLocation.Set(Tv->Location.Value, F);
				}
			};
			T[PropertyId::PosY] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (FHktTransformView* Tv = S.GetMutableTransform(Id))
				{
					Tv->Location.Value.Y = static_cast<float>(V);
					Tv->Location.Set(Tv->Location.Value, F);
					Tv->RenderLocation.Set(Tv->Location.Value, F);
				}
			};
			T[PropertyId::PosZ] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (FHktTransformView* Tv = S.GetMutableTransform(Id))
				{
					Tv->Location.Value.Z = static_cast<float>(V);
					Tv->Location.Set(Tv->Location.Value, F);
					Tv->RenderLocation.Set(Tv->Location.Value, F);
				}
			};
			T[PropertyId::RotYaw] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (FHktTransformView* Tv = S.GetMutableTransform(Id))
				{
					Tv->Rotation.Value.Yaw = static_cast<float>(V);
					Tv->Rotation.Set(Tv->Rotation.Value, F);
				}
			};

			// --- Physics ---
			T[PropertyId::CollisionRadius] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Physics.IsValidIndex(Id))
					S.Physics[Id].CollisionRadius.Set(FMath::Max(static_cast<float>(V), 50.f), F);
			};
			T[PropertyId::CollisionHalfHeight] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Physics.IsValidIndex(Id))
					S.Physics[Id].CollisionHalfHeight.Set(FMath::Max(static_cast<float>(V), 30.f), F);
			};
			T[PropertyId::CollisionLayer] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Physics.IsValidIndex(Id))
					S.Physics[Id].CollisionLayer.Set(V, F);
			};

			// --- Movement ---
			T[PropertyId::MoveTargetX] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Movement.IsValidIndex(Id))
				{
					FHktMovementView& M = S.Movement[Id];
					M.MoveTarget.Value.X = static_cast<float>(V);
					M.MoveTarget.Set(M.MoveTarget.Value, F);
				}
			};
			T[PropertyId::MoveTargetY] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Movement.IsValidIndex(Id))
				{
					FHktMovementView& M = S.Movement[Id];
					M.MoveTarget.Value.Y = static_cast<float>(V);
					M.MoveTarget.Set(M.MoveTarget.Value, F);
				}
			};
			T[PropertyId::MoveTargetZ] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Movement.IsValidIndex(Id))
				{
					FHktMovementView& M = S.Movement[Id];
					M.MoveTarget.Value.Z = static_cast<float>(V);
					M.MoveTarget.Set(M.MoveTarget.Value, F);
				}
			};
			T[PropertyId::MoveForce] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Movement.IsValidIndex(Id))
					S.Movement[Id].MoveForce.Set(static_cast<float>(V), F);
			};
			T[PropertyId::IsMoving] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Movement.IsValidIndex(Id))
					S.Movement[Id].bIsMoving.Set(V != 0, F);
			};
			T[PropertyId::IsGrounded] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Movement.IsValidIndex(Id))
					S.Movement[Id].bIsJumping.Set(V == 0, F);
			};
			T[PropertyId::VelX] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Movement.IsValidIndex(Id))
				{
					FHktMovementView& M = S.Movement[Id];
					M.Velocity.Value.X = static_cast<float>(V);
					M.Velocity.Set(M.Velocity.Value, F);
				}
			};
			T[PropertyId::VelY] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Movement.IsValidIndex(Id))
				{
					FHktMovementView& M = S.Movement[Id];
					M.Velocity.Value.Y = static_cast<float>(V);
					M.Velocity.Set(M.Velocity.Value, F);
				}
			};
			T[PropertyId::VelZ] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Movement.IsValidIndex(Id))
				{
					FHktMovementView& M = S.Movement[Id];
					M.Velocity.Value.Z = static_cast<float>(V);
					M.Velocity.Set(M.Velocity.Value, F);
				}
			};

			// --- Vitals (비율은 같은 뷰 안에서 상호 의존) ---
			T[PropertyId::Health] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Vitals.IsValidIndex(Id))
				{
					FHktVitalsView& Vi = S.Vitals[Id];
					Vi.Health.Set(static_cast<float>(V), F);
					Vi.HealthRatio.Set((Vi.MaxHealth.Get() > 0.f) ? static_cast<float>(V) / Vi.MaxHealth.Get() : 0.f, F);
				}
			};
			T[PropertyId::MaxHealth] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Vitals.IsValidIndex(Id))
				{
					FHktVitalsView& Vi = S.Vitals[Id];
					Vi.MaxHealth.Set(static_cast<float>(V), F);
					Vi.HealthRatio.Set((V > 0) ? Vi.Health.Get() / static_cast<float>(V) : 0.f, F);
				}
			};
			T[PropertyId::Mana] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Vitals.IsValidIndex(Id))
				{
					FHktVitalsView& Vi = S.Vitals[Id];
					Vi.Mana.Set(static_cast<float>(V), F);
					Vi.ManaRatio.Set((Vi.MaxMana.Get() > 0.f) ? static_cast<float>(V) / Vi.MaxMana.Get() : 0.f, F);
				}
			};
			T[PropertyId::MaxMana] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Vitals.IsValidIndex(Id))
				{
					FHktVitalsView& Vi = S.Vitals[Id];
					Vi.MaxMana.Set(static_cast<float>(V), F);
					Vi.ManaRatio.Set((V > 0) ? Vi.Mana.Get() / static_cast<float>(V) : 0.f, F);
				}
			};

			// --- Combat ---
			T[PropertyId::AttackPower] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Combat.IsValidIndex(Id)) S.Combat[Id].AttackPower.Set(V, F);
			};
			T[PropertyId::Defense] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Combat.IsValidIndex(Id)) S.Combat[Id].Defense.Set(V, F);
			};
			T[PropertyId::CP] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Combat.IsValidIndex(Id))
				{
					FHktCombatView& C = S.Combat[Id];
					C.CP.Set(V, F);
					C.CPRatio.Set((C.MaxCP.Get() > 0) ? static_cast<float>(V) / static_cast<float>(C.MaxCP.Get()) : 0.f, F);
				}
			};
			T[PropertyId::MaxCP] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Combat.IsValidIndex(Id))
				{
					FHktCombatView& C = S.Combat[Id];
					C.MaxCP.Set(V, F);
					C.CPRatio.Set((V > 0) ? static_cast<float>(C.CP.Get()) / static_cast<float>(V) : 0.f, F);
				}
			};
			T[PropertyId::AttackSpeed] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Combat.IsValidIndex(Id)) S.Combat[Id].AttackSpeed.Set(V, F);
			};
			T[PropertyId::MotionPlayRate] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Combat.IsValidIndex(Id)) S.Combat[Id].MotionPlayRate.Set(V, F);
			};

			// --- Ownership ---
			T[PropertyId::Team] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Ownership.IsValidIndex(Id))
				{
					FHktOwnershipView& O = S.Ownership[Id];
					O.Team.Set(V, F);
					O.TeamColor.Set(FHktPresentationState::GetTeamColor(V), F);
				}
			};

			// --- Animation ---
			T[PropertyId::AnimState] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Animation.IsValidIndex(Id)) S.Animation[Id].AnimState.Set(IndexToTag(V), F);
			};
			T[PropertyId::VisualState] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Animation.IsValidIndex(Id)) S.Animation[Id].MontageState.Set(IndexToTag(V), F);
			};
			T[PropertyId::AnimStateUpper] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Animation.IsValidIndex(Id)) S.Animation[Id].AnimStateUpper.Set(IndexToTag(V), F);
			};
			T[PropertyId::Stance] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Animation.IsValidIndex(Id)) S.Animation[Id].Stance.Set(IndexToTag(V), F);
			};

			// --- Visualization ---
			T[PropertyId::EntitySpawnTag] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Visualization.IsValidIndex(Id)) S.Visualization[Id].VisualElement.Set(IndexToTag(V), F);
			};

			// --- Item ---
			T[PropertyId::OwnerEntity] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Items.IsValidIndex(Id)) S.Items[Id].OwnerEntity.Set(V, F);
			};
			T[PropertyId::EquipIndex] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Items.IsValidIndex(Id)) S.Items[Id].EquipIndex.Set(V, F);
			};
			T[PropertyId::ItemState] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Items.IsValidIndex(Id)) S.Items[Id].ItemState.Set(V, F);
			};
			T[PropertyId::Equippable] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Items.IsValidIndex(Id)) S.Items[Id].Equippable.Set(V, F);
			};

			// --- Voxel Skin ---
			T[PropertyId::VoxelSkinSet] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.VoxelSkins.IsValidIndex(Id)) S.VoxelSkins[Id].VoxelSkinSet.Set(V, F);
			};
			T[PropertyId::VoxelPalette] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.VoxelSkins.IsValidIndex(Id)) S.VoxelSkins[Id].VoxelPalette.Set(V, F);
			};

			// --- Sprite (2D 라그나로크 방식) ---
			T[PropertyId::Facing] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Sprites.IsValidIndex(Id))
					S.Sprites[Id].Facing.Set(static_cast<uint8>(V & 0x07), F);
			};
			T[PropertyId::AnimStartTick] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Sprites.IsValidIndex(Id)) S.Sprites[Id].AnimStartTick.Set(V, F);
			};
			T[PropertyId::SpriteBody] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Sprites.IsValidIndex(Id)) S.Sprites[Id].BodyPart.Set(IndexToTag(V), F);
			};
			T[PropertyId::SpriteHead] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Sprites.IsValidIndex(Id)) S.Sprites[Id].HeadPart.Set(IndexToTag(V), F);
			};
			T[PropertyId::SpriteWeapon] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Sprites.IsValidIndex(Id)) S.Sprites[Id].WeaponPart.Set(IndexToTag(V), F);
			};
			T[PropertyId::SpriteShield] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Sprites.IsValidIndex(Id)) S.Sprites[Id].ShieldPart.Set(IndexToTag(V), F);
			};
			T[PropertyId::SpriteHeadgearTop] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Sprites.IsValidIndex(Id)) S.Sprites[Id].HeadgearTop.Set(IndexToTag(V), F);
			};
			T[PropertyId::SpriteHeadgearMid] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Sprites.IsValidIndex(Id)) S.Sprites[Id].HeadgearMid.Set(IndexToTag(V), F);
			};
			T[PropertyId::SpriteHeadgearLow] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				if (S.Sprites.IsValidIndex(Id)) S.Sprites[Id].HeadgearLow.Set(IndexToTag(V), F);
			};

			// --- Terrain Debris (뷰가 없으면 lazy 할당) ---
			T[PropertyId::TerrainTypeId] = [](FHktPresentationState& S, FHktEntityId Id, int32 V, int64 F)
			{
				FHktTerrainDebrisView& Dv = EnsureView(S.TerrainDebris, Id);
				Dv.TerrainTypeId.Set(V, F);
			};

			return T;
		}();
		return Table;
	}
}

// ============================================================================
// FHktPresentationState — 정적 유틸
// ============================================================================

EHktRenderCategory FHktPresentationState::DetermineRenderCategory(const FGameplayTagContainer& Tags)
{
	if (Tags.HasTag(HktArchetypeTags::Entity_Character)
		|| Tags.HasTag(HktArchetypeTags::Entity_NPC)
		|| Tags.HasTag(HktArchetypeTags::Entity_Building))
		return EHktRenderCategory::Actor;
	if (Tags.HasTag(HktArchetypeTags::Entity_Projectile))
		return EHktRenderCategory::MassEntity;
	if (Tags.HasTag(HktArchetypeTags::Entity_Item))
		return EHktRenderCategory::Actor;
	return EHktRenderCategory::None;
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
	V.CollisionRadius.Set(FMath::Max(static_cast<float>(WS.GetProperty(Id, PropertyId::CollisionRadius)), 50.f), F);
	V.CollisionHalfHeight.Set(FMath::Max(static_cast<float>(WS.GetProperty(Id, PropertyId::CollisionHalfHeight)), 30.f), F);
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
	V.BodyPart.Set(IndexToTag(WS.GetProperty(Id, PropertyId::SpriteBody)), F);
	V.HeadPart.Set(IndexToTag(WS.GetProperty(Id, PropertyId::SpriteHead)), F);
	V.WeaponPart.Set(IndexToTag(WS.GetProperty(Id, PropertyId::SpriteWeapon)), F);
	V.ShieldPart.Set(IndexToTag(WS.GetProperty(Id, PropertyId::SpriteShield)), F);
	V.HeadgearTop.Set(IndexToTag(WS.GetProperty(Id, PropertyId::SpriteHeadgearTop)), F);
	V.HeadgearMid.Set(IndexToTag(WS.GetProperty(Id, PropertyId::SpriteHeadgearMid)), F);
	V.HeadgearLow.Set(IndexToTag(WS.GetProperty(Id, PropertyId::SpriteHeadgearLow)), F);
	V.Facing.Set(static_cast<uint8>(WS.GetProperty(Id, PropertyId::Facing) & 0x07), F);
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

void FHktPresentationState::AddEntity(const FHktWorldState& WS, FHktEntityId Id)
{
	if (Id < 0) return;

	const int32 Index = static_cast<int32>(Id);
	const FGameplayTagContainer Tags = WS.GetTags(Id);
	const EHktRenderCategory Category = DetermineRenderCategory(Tags);

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

	// Meta는 유지 (RemovedFrame 추적용). Clear()에서만 Meta 제거.
}

// ============================================================================
// 델타 적용 — PropertyId → 해당 뷰 필드로 디스패치
// ============================================================================

void FHktPresentationState::ApplyDelta(FHktEntityId Id, uint16 PropId, int32 NewValue)
{
	if (!IsValid(Id)) return;

	const TArray<FHktDeltaApplier>& Table = GetDeltaDispatchTable();
	if (PropId >= Table.Num()) return;
	FHktDeltaApplier Fn = Table[PropId];
	if (!Fn) return;

	Fn(*this, Id, NewValue, CurrentFrame);
	TouchDirty(Id);
}


void FHktPresentationState::ApplyOwnerDelta(FHktEntityId Id, int64 NewOwnerUid)
{
	if (!IsValid(Id)) return;
	const int32 Index = static_cast<int32>(Id);
	if (!Ownership.IsValidIndex(Index)) return;

	FHktOwnershipView& V = Ownership[Index];
	V.OwnedPlayerUid.Set(NewOwnerUid, CurrentFrame);
	V.OwnerLabel.Set(NewOwnerUid != 0 ? FString::Printf(TEXT("P:%lld"), NewOwnerUid) : TEXT("-"), CurrentFrame);
	TouchDirty(Id);
}

void FHktPresentationState::ApplyTagDelta(FHktEntityId Id, const FGameplayTagContainer& NewTags)
{
	if (!IsValid(Id)) return;
	const int32 Index = static_cast<int32>(Id);
	if (!Animation.IsValidIndex(Index))
	{
		// 태그만 변경되는 Item/Debris 엔터티의 경우 — 필요하면 lazy 할당
		// 현재는 태그를 필요로 하는 건 AnimInstance뿐이므로 스킵
		return;
	}
	FHktAnimationView& V = Animation[Index];
	V.Tags = NewTags;
	V.TagsDirtyFrame = CurrentFrame;
	TouchDirty(Id);
}

void FHktPresentationState::AddAnimTrigger(FHktEntityId Id, const FGameplayTag& Tag)
{
	if (!IsValid(Id)) return;
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
	CurrentFrame = 0;
}
