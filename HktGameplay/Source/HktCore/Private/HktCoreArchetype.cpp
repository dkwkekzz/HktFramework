// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktCoreArchetype.h"
#include "HktCoreDefs.h"

// ============================================================================
// HktTrait 포인터 정의
// ============================================================================

namespace HktTrait
{
    const FHktPropertyTrait* Spatial    = nullptr;
    const FHktPropertyTrait* Movable    = nullptr;
    const FHktPropertyTrait* Collidable = nullptr;
    const FHktPropertyTrait* Hittable   = nullptr;
    const FHktPropertyTrait* Combatable = nullptr;
    const FHktPropertyTrait* Animated   = nullptr;
    const FHktPropertyTrait* EventParam = nullptr;
    const FHktPropertyTrait* Ownable    = nullptr;
    const FHktPropertyTrait* EquipSlots = nullptr;
}

// ============================================================================
// FHktArchetypeRegistry
// ============================================================================

FHktArchetypeRegistry& FHktArchetypeRegistry::Get()
{
    static FHktArchetypeRegistry Instance;
    return Instance;
}

const FHktPropertyTrait* FHktArchetypeRegistry::DefineTrait(const TCHAR* DebugName, std::initializer_list<uint16> Props)
{
    check(TraitCount < MaxTraits);
    FHktPropertyTrait& T = TraitStorage[TraitCount++];
    T.Name = DebugName;
    T.PropertyIds.Reset();
    T.PropertyIds.Append(Props.begin(), static_cast<int32>(Props.size()));
    return &T;
}

void FHktArchetypeRegistry::Register(
    EHktArchetype Type, const TCHAR* Name,
    const FGameplayTag& ClassTag,
    std::initializer_list<const FHktPropertyTrait*> TraitList,
    std::initializer_list<uint16> ExtraProps)
{
    const int32 Idx = static_cast<int32>(Type);
    if (Idx <= 0 || Idx >= static_cast<int32>(EHktArchetype::Max)) return;

    FHktArchetypeMetadata& Meta = Archetypes[Idx];
    Meta.Type = Type;
    Meta.Name = Name;
    Meta.ClassTag = ClassTag;
    Meta.PropertyIds.Reset();
    Meta.Traits.Reset();

    // Trait 프로퍼티 병합 (중복 제거)
    for (const FHktPropertyTrait* T : TraitList)
    {
        if (!T) continue;
        Meta.Traits.Add(T);
        for (uint16 PropId : T->PropertyIds)
        {
            Meta.PropertyIds.AddUnique(PropId);
        }
    }

    // 추가 프로퍼티 병합
    for (uint16 PropId : ExtraProps)
    {
        Meta.PropertyIds.AddUnique(PropId);
    }
}

const FHktArchetypeMetadata* FHktArchetypeRegistry::Find(EHktArchetype Type) const
{
    const int32 Idx = static_cast<int32>(Type);
    if (Idx <= 0 || Idx >= static_cast<int32>(EHktArchetype::Max)) return nullptr;
    if (Archetypes[Idx].Type == EHktArchetype::None) return nullptr;
    return &Archetypes[Idx];
}

EHktArchetype FHktArchetypeRegistry::FindByTag(const FGameplayTag& Tag) const
{
    // 정확한 매칭 먼저 (고정 배열 순회, 최대 5개)
    for (int32 i = 1; i < static_cast<int32>(EHktArchetype::Max); ++i)
    {
        if (Archetypes[i].Type != EHktArchetype::None && Archetypes[i].ClassTag == Tag)
        {
            return Archetypes[i].Type;
        }
    }

    // 부모 태그 매칭 (Entity.Character.Player → Entity.Character)
    for (int32 i = 1; i < static_cast<int32>(EHktArchetype::Max); ++i)
    {
        if (Archetypes[i].Type != EHktArchetype::None && Tag.MatchesTag(Archetypes[i].ClassTag))
        {
            return Archetypes[i].Type;
        }
    }

    return EHktArchetype::None;
}

EHktArchetype FHktArchetypeRegistry::FindByName(const TCHAR* Name) const
{
    for (int32 i = 1; i < static_cast<int32>(EHktArchetype::Max); ++i)
    {
        if (Archetypes[i].Type != EHktArchetype::None && FCString::Stricmp(Archetypes[i].Name, Name) == 0)
            return Archetypes[i].Type;
    }
    return EHktArchetype::None;
}

int32 FHktArchetypeRegistry::GetTraitIndex(const FHktPropertyTrait* Trait) const
{
    for (int32 i = 0; i < TraitCount; ++i)
    {
        if (&TraitStorage[i] == Trait) return i;
    }
    return -1;
}

const FHktPropertyTrait* FHktArchetypeRegistry::GetTraitByIndex(int32 Index) const
{
    if (Index < 0 || Index >= TraitCount) return nullptr;
    return &TraitStorage[Index];
}

// ============================================================================
// InitializeHktArchetypes
// ============================================================================

void InitializeHktArchetypes()
{
    auto& R = FHktArchetypeRegistry::Get();

    // ===== Trait 정의 → 포인터 할당 =====

    HktTrait::Spatial = R.DefineTrait(TEXT("Spatial"), {
        HktProperty::PosX, HktProperty::PosY, HktProperty::PosZ, HktProperty::RotYaw,
    });

    HktTrait::Movable = R.DefineTrait(TEXT("Movable"), {
        // Spatial 프로퍼티 포함 (Register에서 AddUnique로 중복 제거)
        HktProperty::PosX, HktProperty::PosY, HktProperty::PosZ, HktProperty::RotYaw,
        HktProperty::MoveTargetX, HktProperty::MoveTargetY, HktProperty::MoveTargetZ,
        HktProperty::MoveForce, HktProperty::IsMoving, HktProperty::IsGrounded, HktProperty::MaxSpeed,
        HktProperty::VelX, HktProperty::VelY, HktProperty::VelZ,
        // JumpVelZ 제거 — VelZ로 통합 (HktCoreProperties.h 의 DEPRECATED_JumpVelZ 참조)
    });

    HktTrait::Collidable = R.DefineTrait(TEXT("Collidable"), {
        HktProperty::CollisionLayer, HktProperty::CollisionMask,
        HktProperty::CollisionRadius, HktProperty::CollisionHalfHeight, HktProperty::Mass,
    });

    // Hittable: 피격 가능 대상의 최소 조건 (Character, NPC, Building, Debris 공통)
    HktTrait::Hittable = R.DefineTrait(TEXT("Hittable"), {
        HktProperty::Health, HktProperty::MaxHealth,
    });

    HktTrait::Combatable = R.DefineTrait(TEXT("Combatable"), {
        HktProperty::Health, HktProperty::MaxHealth,
        HktProperty::AttackPower, HktProperty::Defense, HktProperty::Team,
        HktProperty::CP, HktProperty::MaxCP,
        HktProperty::AttackSpeed, HktProperty::MotionPlayRate,
        HktProperty::NextActionFrame, HktProperty::Stance,
    });

    HktTrait::Animated = R.DefineTrait(TEXT("Animated"), {
        HktProperty::AnimState, HktProperty::VisualState, HktProperty::AnimStateUpper,
        HktProperty::VoxelSkinSet, HktProperty::VoxelPalette,
    });

    HktTrait::Ownable = R.DefineTrait(TEXT("Ownable"), {
        HktProperty::OwnerEntity, HktProperty::EntitySpawnTag,
    });

    HktTrait::EquipSlots = R.DefineTrait(TEXT("EquipSlots"), {
        HktProperty::EquipSlot0, HktProperty::EquipSlot1, HktProperty::EquipSlot2,
        HktProperty::EquipSlot3, HktProperty::EquipSlot4, HktProperty::EquipSlot5,
        HktProperty::EquipSlot6, HktProperty::EquipSlot7, HktProperty::EquipSlot8,
    });

    HktTrait::EventParam = R.DefineTrait(TEXT("EventParam"), {
        HktProperty::TargetPosX, HktProperty::TargetPosY, HktProperty::TargetPosZ,
        HktProperty::Param0, HktProperty::Param1, HktProperty::Param2, HktProperty::Param3,
    });

    // ===== Archetype 등록 (ClassTag + Trait 포인터 조합 + 고유 프로퍼티) =====

    R.Register(EHktArchetype::Character, TEXT("Character"),
        HktArchetypeTags::Entity_Character,
        {HktTrait::Movable, HktTrait::Collidable, HktTrait::Hittable, HktTrait::Combatable,
         HktTrait::Animated, HktTrait::Ownable, HktTrait::EventParam, HktTrait::EquipSlots},
        {
            HktProperty::Mana, HktProperty::MaxMana,
            HktProperty::BagCapacity,
        });

    R.Register(EHktArchetype::NPC, TEXT("NPC"),
        HktArchetypeTags::Entity_NPC,
        {HktTrait::Movable, HktTrait::Collidable, HktTrait::Hittable, HktTrait::Combatable,
         HktTrait::Animated, HktTrait::Ownable, HktTrait::EventParam},
        {
            HktProperty::IsNPC, HktProperty::SpawnFlowTag,
        });

    R.Register(EHktArchetype::Item, TEXT("Item"),
        HktArchetypeTags::Entity_Item,
        {HktTrait::Spatial, HktTrait::Collidable, HktTrait::Ownable, HktTrait::EventParam},
        {
            HktProperty::ItemState, HktProperty::ItemId, HktProperty::EquipIndex,
            HktProperty::Equippable,
            HktProperty::ItemSkillTag, HktProperty::SkillCPCost, HktProperty::RecoveryFrame,
            HktProperty::SkillTargetRequired, HktProperty::AttackRange,
            HktProperty::AttackPower, HktProperty::Defense, HktProperty::Stance,
        });

    R.Register(EHktArchetype::Projectile, TEXT("Projectile"),
        HktArchetypeTags::Entity_Projectile,
        {HktTrait::Movable, HktTrait::Collidable, HktTrait::Ownable},
        {
            HktProperty::AttackPower, HktProperty::Team,
        });

    R.Register(EHktArchetype::Building, TEXT("Building"),
        HktArchetypeTags::Entity_Building,
        {HktTrait::Spatial, HktTrait::Collidable, HktTrait::Hittable, HktTrait::Ownable},
        {
            HktProperty::Team,
        });

    R.Register(EHktArchetype::Debris, TEXT("Debris"),
        HktArchetypeTags::Entity_Debris,
        // Movable: GravitySystem 이 IsGrounded/VelZ 로 낙하 처리 (Crumble/Crack/Shatter 의 튕김/낙하).
        {HktTrait::Movable, HktTrait::Collidable, HktTrait::Hittable, HktTrait::Ownable},
        {
            HktProperty::TerrainTypeId,
            // 복셀 파괴 시 원래 위치를 기록하여 Debris Lifecycle 이 복원/소멸 처리에 사용.
            HktProperty::DebrisOriginX,
            HktProperty::DebrisOriginY,
            HktProperty::DebrisOriginZ,
        });
}
