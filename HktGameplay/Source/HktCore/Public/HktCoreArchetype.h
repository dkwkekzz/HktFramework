// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "HktCoreProperties.h"

// ============================================================================
// EHktArchetype — 엔티티 유형 열거
// ============================================================================

enum class EHktArchetype : uint8
{
    None = 0,
    Character,
    NPC,
    Item,
    Projectile,
    Building,
    Debris,
    Max
};

// ============================================================================
// FHktPropertyTrait — 프로퍼티 특성 (Movable, Combatable, Collidable 등)
//
// 여러 Archetype이 공유하는 프로퍼티 그룹.
// 포인터로 identity 비교. 레지스트리 고정 배열에 저장되어 포인터 안정적.
// ============================================================================

struct FHktPropertyTrait
{
    const TCHAR* Name = TEXT("None");
    TArray<uint16> PropertyIds;
};

// ============================================================================
// FHktArchetypeMetadata — Archetype 메타데이터
// ============================================================================

struct FHktArchetypeMetadata
{
    EHktArchetype Type = EHktArchetype::None;
    const TCHAR* Name = TEXT("None");
    FGameplayTag ClassTag;                          // ClassTag 직접 내장
    TArray<uint16> PropertyIds;                     // 최종 병합된 프로퍼티 목록
    TArray<const FHktPropertyTrait*> Traits;        // 포인터 기반 Trait 목록

    bool HasProperty(uint16 PropId) const
    {
        return PropertyIds.Contains(PropId);
    }

    bool HasTrait(const FHktPropertyTrait* Trait) const
    {
        return Traits.Contains(Trait);
    }

    const TCHAR* ToString() const { return Name; }
};

// ============================================================================
// FHktArchetypeRegistry — Archetype 레지스트리 (Meyers singleton)
// ============================================================================

class HKTCORE_API FHktArchetypeRegistry
{
public:
    static FHktArchetypeRegistry& Get();

    /** Trait 정의 — 고정 배열에 저장, 안정적 포인터 반환 */
    const FHktPropertyTrait* DefineTrait(const TCHAR* DebugName, std::initializer_list<uint16> Props);

    /** Archetype 등록 — ClassTag + Trait 포인터 조합 + 추가 프로퍼티 */
    void Register(EHktArchetype Type, const TCHAR* Name,
                  const FGameplayTag& ClassTag,
                  std::initializer_list<const FHktPropertyTrait*> TraitList,
                  std::initializer_list<uint16> ExtraProps = {});

    const FHktArchetypeMetadata* Find(EHktArchetype Type) const;
    EHktArchetype FindByTag(const FGameplayTag& Tag) const;
    EHktArchetype FindByName(const TCHAR* Name) const;

    /** Trait → 레지스트리 인덱스 (bytecode 인코딩용). 미등록 Trait이면 -1 반환 */
    int32 GetTraitIndex(const FHktPropertyTrait* Trait) const;

    /** 인덱스 → Trait 포인터 (VM 런타임 역조회용). 범위 외이면 nullptr 반환 */
    const FHktPropertyTrait* GetTraitByIndex(int32 Index) const;

private:
    FHktArchetypeMetadata Archetypes[static_cast<int>(EHktArchetype::Max)];

    static constexpr int32 MaxTraits = 16;
    FHktPropertyTrait TraitStorage[MaxTraits];
    int32 TraitCount = 0;
};

// ============================================================================
// HktTrait — Trait 포인터 상수 (InitializeHktArchetypes 에서 설정)
// ============================================================================

namespace HktTrait
{
    HKTCORE_API extern const FHktPropertyTrait* Spatial;
    HKTCORE_API extern const FHktPropertyTrait* Movable;
    HKTCORE_API extern const FHktPropertyTrait* Collidable;
    HKTCORE_API extern const FHktPropertyTrait* Hittable;    // Health/MaxHealth — 피격 가능 대상 (Character, NPC, Building, Debris)
    HKTCORE_API extern const FHktPropertyTrait* Combatable;
    HKTCORE_API extern const FHktPropertyTrait* Animated;
    HKTCORE_API extern const FHktPropertyTrait* EventParam;
    HKTCORE_API extern const FHktPropertyTrait* Ownable;
    HKTCORE_API extern const FHktPropertyTrait* EquipSlots;

    /** EquipSlot0~8 PropertyId 배열 — Trait 포인터에서 직접 참조 */
    inline const TArray<uint16>& GetEquipSlotPropertyIds()
    {
        check(EquipSlots);
        return EquipSlots->PropertyIds;
    }
}

// ============================================================================
// InitializeArchetypes — 모듈 시작 시 호출
// ============================================================================

HKTCORE_API void InitializeHktArchetypes();
