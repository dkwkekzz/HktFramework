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

	using FHktDeltaApplier = void(*)(FHktEntityPresentation&, int32, int64);

	/** PropId → 핸들러 디스패치 테이블. 첫 호출 시 lazy 초기화. */
	const TArray<FHktDeltaApplier>& GetDeltaDispatchTable()
	{
		static const TArray<FHktDeltaApplier> Table = []()
		{
			TArray<FHktDeltaApplier> T;
			T.SetNumZeroed(HktProperty::MaxCount());

			// --- Transform ---
			T[PropertyId::PosX]   = [](FHktEntityPresentation& E, int32 V, int64 F) { E.Location.Value.X = static_cast<float>(V); E.Location.Set(E.Location.Value, F); };
			T[PropertyId::PosY]   = [](FHktEntityPresentation& E, int32 V, int64 F) { E.Location.Value.Y = static_cast<float>(V); E.Location.Set(E.Location.Value, F); };
			T[PropertyId::PosZ]   = [](FHktEntityPresentation& E, int32 V, int64 F) { E.Location.Value.Z = static_cast<float>(V); E.Location.Set(E.Location.Value, F); };
			T[PropertyId::RotYaw] = [](FHktEntityPresentation& E, int32 V, int64 F) { E.Rotation.Value.Yaw = static_cast<float>(V); E.Rotation.Set(E.Rotation.Value, F); };

			// --- Movement ---
			T[PropertyId::MoveTargetX] = [](FHktEntityPresentation& E, int32 V, int64 F) { E.MoveTarget.Value.X = static_cast<float>(V); E.MoveTarget.Set(E.MoveTarget.Value, F); };
			T[PropertyId::MoveTargetY] = [](FHktEntityPresentation& E, int32 V, int64 F) { E.MoveTarget.Value.Y = static_cast<float>(V); E.MoveTarget.Set(E.MoveTarget.Value, F); };
			T[PropertyId::MoveTargetZ] = [](FHktEntityPresentation& E, int32 V, int64 F) { E.MoveTarget.Value.Z = static_cast<float>(V); E.MoveTarget.Set(E.MoveTarget.Value, F); };
			T[PropertyId::MoveForce]   = [](FHktEntityPresentation& E, int32 V, int64 F) { E.MoveForce.Set(static_cast<float>(V), F); };
			T[PropertyId::IsMoving]    = [](FHktEntityPresentation& E, int32 V, int64 F) { E.bIsMoving.Set(V != 0, F); };
			T[PropertyId::IsGrounded]  = [](FHktEntityPresentation& E, int32 V, int64 F) { E.bIsJumping.Set(V == 0, F); };
			// JumpVelZ 는 DEPRECATED — 수직 속도는 VelZ 로 통합됨
			T[PropertyId::VelX]        = [](FHktEntityPresentation& E, int32 V, int64 F) { E.Velocity.Value.X = static_cast<float>(V); E.Velocity.Set(E.Velocity.Value, F); };
			T[PropertyId::VelY]        = [](FHktEntityPresentation& E, int32 V, int64 F) { E.Velocity.Value.Y = static_cast<float>(V); E.Velocity.Set(E.Velocity.Value, F); };
			T[PropertyId::VelZ]        = [](FHktEntityPresentation& E, int32 V, int64 F) { E.Velocity.Value.Z = static_cast<float>(V); E.Velocity.Set(E.Velocity.Value, F); };

			// --- Physics ---
			T[PropertyId::CollisionRadius] = [](FHktEntityPresentation& E, int32 V, int64 F) { E.CollisionRadius.Set(FMath::Max(static_cast<float>(V), 50.f), F); };
			T[PropertyId::CollisionLayer]  = [](FHktEntityPresentation& E, int32 V, int64 F) { E.CollisionLayer.Set(V, F); };

			// --- Vitals ---
			T[PropertyId::Health] = [](FHktEntityPresentation& E, int32 V, int64 F) {
				E.Health.Set(static_cast<float>(V), F);
				E.HealthRatio.Set((E.MaxHealth.Get() > 0.f) ? static_cast<float>(V) / E.MaxHealth.Get() : 0.f, F);
			};
			T[PropertyId::MaxHealth] = [](FHktEntityPresentation& E, int32 V, int64 F) {
				E.MaxHealth.Set(static_cast<float>(V), F);
				E.HealthRatio.Set((V > 0) ? E.Health.Get() / static_cast<float>(V) : 0.f, F);
			};
			T[PropertyId::Mana] = [](FHktEntityPresentation& E, int32 V, int64 F) {
				E.Mana.Set(static_cast<float>(V), F);
				E.ManaRatio.Set((E.MaxMana.Get() > 0.f) ? static_cast<float>(V) / E.MaxMana.Get() : 0.f, F);
			};
			T[PropertyId::MaxMana] = [](FHktEntityPresentation& E, int32 V, int64 F) {
				E.MaxMana.Set(static_cast<float>(V), F);
				E.ManaRatio.Set((V > 0) ? E.Mana.Get() / static_cast<float>(V) : 0.f, F);
			};

			// --- Combat ---
			T[PropertyId::AttackPower]    = [](FHktEntityPresentation& E, int32 V, int64 F) { E.AttackPower.Set(V, F); };
			T[PropertyId::Defense]        = [](FHktEntityPresentation& E, int32 V, int64 F) { E.Defense.Set(V, F); };
			T[PropertyId::CP] = [](FHktEntityPresentation& E, int32 V, int64 F) {
				E.CP.Set(V, F);
				E.CPRatio.Set((E.MaxCP.Get() > 0) ? static_cast<float>(V) / static_cast<float>(E.MaxCP.Get()) : 0.f, F);
			};
			T[PropertyId::MaxCP] = [](FHktEntityPresentation& E, int32 V, int64 F) {
				E.MaxCP.Set(V, F);
				E.CPRatio.Set((V > 0) ? static_cast<float>(E.CP.Get()) / static_cast<float>(V) : 0.f, F);
			};
			T[PropertyId::AttackSpeed]    = [](FHktEntityPresentation& E, int32 V, int64 F) { E.AttackSpeed.Set(V, F); };
			T[PropertyId::MotionPlayRate] = [](FHktEntityPresentation& E, int32 V, int64 F) { E.MotionPlayRate.Set(V, F); };

			// --- Ownership ---
			T[PropertyId::Team] = [](FHktEntityPresentation& E, int32 V, int64 F) {
				E.Team.Set(V, F);
				E.TeamColor.Set(FHktEntityPresentation::GetTeamColor(V), F);
			};

			// --- Animation ---
			T[PropertyId::AnimState]      = [](FHktEntityPresentation& E, int32 V, int64 F) { E.AnimState.Set(IndexToTag(V), F); };
			T[PropertyId::VisualState]    = [](FHktEntityPresentation& E, int32 V, int64 F) { E.MontageState.Set(IndexToTag(V), F); };
			T[PropertyId::AnimStateUpper] = [](FHktEntityPresentation& E, int32 V, int64 F) { E.AnimStateUpper.Set(IndexToTag(V), F); };
			T[PropertyId::Stance]         = [](FHktEntityPresentation& E, int32 V, int64 F) { E.Stance.Set(IndexToTag(V), F); };

			// --- Visualization ---
			T[PropertyId::EntitySpawnTag] = [](FHktEntityPresentation& E, int32 V, int64 F) { E.VisualElement.Set(IndexToTag(V), F); };

			// --- Item ---
			T[PropertyId::OwnerEntity] = [](FHktEntityPresentation& E, int32 V, int64 F) { E.OwnerEntity.Set(V, F); };
			T[PropertyId::EquipIndex]  = [](FHktEntityPresentation& E, int32 V, int64 F) { E.EquipIndex.Set(V, F); };
			T[PropertyId::ItemState]   = [](FHktEntityPresentation& E, int32 V, int64 F) { E.ItemState.Set(V, F); };

			// --- Voxel Skin ---
			T[PropertyId::VoxelSkinSet] = [](FHktEntityPresentation& E, int32 V, int64 F) { E.VoxelSkinSet.Set(V, F); };
			T[PropertyId::VoxelPalette] = [](FHktEntityPresentation& E, int32 V, int64 F) { E.VoxelPalette.Set(V, F); };
			T[PropertyId::Equippable]   = [](FHktEntityPresentation& E, int32 V, int64 F) { E.Equippable.Set(V, F); };

			// --- Terrain Debris ---
			T[PropertyId::TerrainTypeId] = [](FHktEntityPresentation& E, int32 V, int64 F) { E.TerrainTypeId.Set(V, F); };

			return T;
		}();
		return Table;
	}
}

// --------------------------------------------------------------------------- FHktEntityPresentation
void FHktEntityPresentation::InitFromWorldState(const FHktWorldState& WS, FHktEntityId Id, int64 Frame)
{
	EntityId = Id;
	Tags = WS.GetTags(Id);
	TagsDirtyFrame = Frame;
	RenderCategory = DetermineRenderCategory(Tags);
	SpawnedFrame = Frame;
	RemovedFrame = 0;
	LastDirtyFrame = Frame;

	// Transform
	FIntVector P = WS.GetPosition(Id);
	Location.Set(FVector(static_cast<float>(P.X), static_cast<float>(P.Y), static_cast<float>(P.Z)), Frame);
	Rotation.Set(FRotator(0.f, static_cast<float>(WS.GetProperty(Id, PropertyId::RotYaw)), 0.f), Frame);

	// Physics
	CollisionRadius.Set(FMath::Max(static_cast<float>(WS.GetProperty(Id, PropertyId::CollisionRadius)), 50.f), Frame);
	CollisionLayer.Set(WS.GetProperty(Id, PropertyId::CollisionLayer), Frame);

	// Movement
	MoveTarget.Set(FVector(
		static_cast<float>(WS.GetProperty(Id, PropertyId::MoveTargetX)),
		static_cast<float>(WS.GetProperty(Id, PropertyId::MoveTargetY)),
		static_cast<float>(WS.GetProperty(Id, PropertyId::MoveTargetZ))), Frame);
	MoveForce.Set(static_cast<float>(WS.GetProperty(Id, PropertyId::MoveForce)), Frame);
	bIsMoving.Set(WS.GetProperty(Id, PropertyId::IsMoving) != 0, Frame);
	bIsJumping.Set(WS.GetProperty(Id, PropertyId::IsGrounded) == 0, Frame);
	Velocity.Set(FVector(
		static_cast<float>(WS.GetProperty(Id, PropertyId::VelX)),
		static_cast<float>(WS.GetProperty(Id, PropertyId::VelY)),
		static_cast<float>(WS.GetProperty(Id, PropertyId::VelZ))), Frame);

	// Vitals
	float H = static_cast<float>(WS.GetProperty(Id, PropertyId::Health));
	float MH = static_cast<float>(WS.GetProperty(Id, PropertyId::MaxHealth));
	float M = static_cast<float>(WS.GetProperty(Id, PropertyId::Mana));
	float MM = static_cast<float>(WS.GetProperty(Id, PropertyId::MaxMana));
	Health.Set(H, Frame);
	MaxHealth.Set(MH, Frame);
	HealthRatio.Set((MH > 0.f) ? H / MH : 0.f, Frame);
	Mana.Set(M, Frame);
	MaxMana.Set(MM, Frame);
	ManaRatio.Set((MM > 0.f) ? M / MM : 0.f, Frame);

	// Combat
	AttackPower.Set(WS.GetProperty(Id, PropertyId::AttackPower), Frame);
	Defense.Set(WS.GetProperty(Id, PropertyId::Defense), Frame);
	{
		int32 CpVal = WS.GetProperty(Id, PropertyId::CP);
		int32 MaxCpVal = WS.GetProperty(Id, PropertyId::MaxCP);
		CP.Set(CpVal, Frame);
		MaxCP.Set(MaxCpVal, Frame);
		CPRatio.Set((MaxCpVal > 0) ? static_cast<float>(CpVal) / static_cast<float>(MaxCpVal) : 0.f, Frame);
	}
	AttackSpeed.Set(WS.GetProperty(Id, PropertyId::AttackSpeed), Frame);
	{
		int32 MprVal = WS.GetProperty(Id, PropertyId::MotionPlayRate);
		MotionPlayRate.Set(MprVal > 0 ? MprVal : WS.GetProperty(Id, PropertyId::AttackSpeed), Frame);
	}

	// Ownership
	Team.Set(WS.GetProperty(Id, PropertyId::Team), Frame);
	OwnedPlayerUid.Set(WS.GetOwnerUid(Id), Frame);

	// Pre-computed Display
	ComputeOwnerLabel(WS.GetOwnerUid(Id), Frame);
	ComputeTeamColor(WS.GetProperty(Id, PropertyId::Team), Frame);

	// Animation
	AnimState.Set(IndexToTag(WS.GetProperty(Id, PropertyId::AnimState)), Frame);
	MontageState.Set(IndexToTag(WS.GetProperty(Id, PropertyId::VisualState)), Frame);
	AnimStateUpper.Set(IndexToTag(WS.GetProperty(Id, PropertyId::AnimStateUpper)), Frame);
	Stance.Set(IndexToTag(WS.GetProperty(Id, PropertyId::Stance)), Frame);

	// Visualization
	VisualElement.Set(IndexToTag(WS.GetProperty(Id, PropertyId::EntitySpawnTag)), Frame);

	// Item
	OwnerEntity.Set(WS.GetProperty(Id, PropertyId::OwnerEntity), Frame);
	EquipIndex.Set(WS.GetProperty(Id, PropertyId::EquipIndex), Frame);
	ItemState.Set(WS.GetProperty(Id, PropertyId::ItemState), Frame);
	Equippable.Set(WS.GetProperty(Id, PropertyId::Equippable), Frame);
}

void FHktEntityPresentation::ApplyDelta(uint16 PropId, int32 NewValue, int64 Frame)
{
	const auto& Table = GetDeltaDispatchTable();
	if (PropId < Table.Num() && Table[PropId])
	{
		Table[PropId](*this, NewValue, Frame);
	}
}

void FHktEntityPresentation::ApplyOwnerDelta(int64 NewOwnerUid, int64 Frame)
{
	OwnedPlayerUid.Set(NewOwnerUid, Frame);
	ComputeOwnerLabel(NewOwnerUid, Frame);
}

bool FHktEntityPresentation::IsAlive() const
{
	return RemovedFrame == 0;
}

bool FHktEntityPresentation::IsSpawnedAt(int64 Frame) const
{
	return SpawnedFrame == Frame;
}

bool FHktEntityPresentation::IsRemovedAt(int64 Frame) const
{
	return RemovedFrame == Frame;
}

void FHktEntityPresentation::ComputeOwnerLabel(int64 Uid, int64 Frame)
{
	OwnerLabel.Set(Uid != 0 ? FString::Printf(TEXT("P:%lld"), Uid) : TEXT("-"), Frame);
}

void FHktEntityPresentation::ComputeTeamColor(int32 TeamIndex, int64 Frame)
{
	TeamColor.Set(GetTeamColor(TeamIndex), Frame);
}

FLinearColor FHktEntityPresentation::GetTeamColor(int32 TeamIndex)
{
	return GTeamColors[FMath::Clamp(TeamIndex, 0, GTeamColorCount - 1)];
}

EHktRenderCategory FHktEntityPresentation::DetermineRenderCategory(const FGameplayTagContainer& Tags)
{
	if (Tags.HasTag(HktArchetypeTags::Entity_Character) || Tags.HasTag(HktArchetypeTags::Entity_NPC) || Tags.HasTag(HktArchetypeTags::Entity_Building))
		return EHktRenderCategory::Actor;
	if (Tags.HasTag(HktArchetypeTags::Entity_Projectile))
		return EHktRenderCategory::MassEntity;
	if (Tags.HasTag(HktArchetypeTags::Entity_Item))
		return EHktRenderCategory::Actor;
	return EHktRenderCategory::None;
}

// --------------------------------------------------------------------------- FHktPresentationState
void FHktPresentationState::BeginFrame(int64 Frame)
{
	CurrentFrame = Frame;
	SpawnedThisFrame.Reset();
	RemovedThisFrame.Reset();
	DirtyThisFrame.Reset();
}

void FHktPresentationState::EnsureCapacity(FHktEntityId MaxId)
{
	if (MaxId >= Entities.Num())
	{
		int32 OldNum = Entities.Num();
		Entities.SetNum(MaxId + 1);
		ValidMask.SetNumUninitialized(MaxId + 1);
		for (int32 i = OldNum; i <= MaxId; ++i)
			ValidMask[i] = false;
	}
}

void FHktPresentationState::AddEntity(const FHktWorldState& WS, FHktEntityId Id)
{
	EnsureCapacity(Id);
	Entities[Id].InitFromWorldState(WS, Id, CurrentFrame);
	ValidMask[Id] = true;
	SpawnedThisFrame.Add(Id);
}

void FHktPresentationState::RemoveEntity(FHktEntityId Id)
{
	if (Id < Entities.Num() && ValidMask[Id])
	{
		Entities[Id].RemovedFrame = CurrentFrame;
		ValidMask[Id] = false;
		RemovedThisFrame.Add(Id);
	}
}

void FHktPresentationState::ApplyDelta(FHktEntityId Id, uint16 PropId, int32 NewValue)
{
	if (Id >= Entities.Num() || !ValidMask[Id]) return;
	FHktEntityPresentation& E = Entities[Id];

	if (E.LastDirtyFrame != CurrentFrame)
	{
		E.LastDirtyFrame = CurrentFrame;
		DirtyThisFrame.Add(Id);
	}

	E.ApplyDelta(PropId, NewValue, CurrentFrame);
}

void FHktPresentationState::ApplyOwnerDelta(FHktEntityId Id, int64 NewOwnerUid)
{
	if (Id >= Entities.Num() || !ValidMask[Id]) return;
	FHktEntityPresentation& E = Entities[Id];

	if (E.LastDirtyFrame != CurrentFrame)
	{
		E.LastDirtyFrame = CurrentFrame;
		DirtyThisFrame.Add(Id);
	}

	E.ApplyOwnerDelta(NewOwnerUid, CurrentFrame);
}

void FHktPresentationState::ApplyTagDelta(FHktEntityId Id, const FGameplayTagContainer& NewTags)
{
	if (Id >= Entities.Num() || !ValidMask[Id]) return;
	FHktEntityPresentation& E = Entities[Id];

	if (E.LastDirtyFrame != CurrentFrame)
	{
		E.LastDirtyFrame = CurrentFrame;
		DirtyThisFrame.Add(Id);
	}

	E.Tags = NewTags;
	E.TagsDirtyFrame = CurrentFrame;
}

bool FHktPresentationState::IsValid(FHktEntityId Id) const
{
	return Id >= 0 && Id < Entities.Num() && ValidMask[Id];
}

const FHktEntityPresentation* FHktPresentationState::Get(FHktEntityId Id) const
{
	return IsValid(Id) ? &Entities[Id] : nullptr;
}

FHktEntityPresentation* FHktPresentationState::GetMutable(FHktEntityId Id)
{
	return IsValid(Id) ? &Entities[Id] : nullptr;
}

int64 FHktPresentationState::GetCurrentFrame() const
{
	return CurrentFrame;
}

void FHktPresentationState::Clear()
{
	Entities.Reset();
	ValidMask.Reset();
	SpawnedThisFrame.Reset();
	RemovedThisFrame.Reset();
	DirtyThisFrame.Reset();
	CurrentFrame = 0;
}
