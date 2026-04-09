// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"

/**
 * Collision Layer Bitmask - 엔티티 충돌 레이어 정의
 *
 * CollisionLayer: 엔티티가 속하는 레이어 (단일 비트)
 * CollisionMask:  엔티티가 충돌할 대상 레이어 (복수 비트)
 *
 * 충돌 조건: (A.Layer & B.Mask) != 0 && (B.Layer & A.Mask) != 0
 */
namespace EHktCollisionLayer
{
    enum : uint32
    {
        None       = 0,
        Character  = 1 << 0,
        NPC        = 1 << 1,
        Projectile = 1 << 2,
        Building   = 1 << 3,
        Item       = 1 << 4,
        Trigger    = 1 << 5,
        Debris     = 1 << 6,

        // 편의 조합
        AllUnits   = Character | NPC,
        All        = 0xFFFFFFFF,
    };
}

/** 충돌 레이어 매핑 테이블 항목 */
struct FHktCollisionLayerMapping
{
    FGameplayTag ParentTag;
    uint32 Layer;
    uint32 Mask;
};

/**
 * 충돌 레이어 매핑 테이블 (지연 초기화).
 * GameplayTag 계층 매칭(MatchesTag)을 사용하여 ClassTag를 판별한다.
 */
inline const TArray<FHktCollisionLayerMapping>& GetHktCollisionLayerMappings()
{
    static TArray<FHktCollisionLayerMapping> Mappings;
    static bool bInitialized = false;
    if (!bInitialized)
    {
        bInitialized = true;
        // 순서 중요: 구체적인 태그를 먼저 배치 (Projectile < NPC < Character 순 우선)
        Mappings.Add({ FGameplayTag::RequestGameplayTag(FName(TEXT("Entity.Projectile"))),
            EHktCollisionLayer::Projectile,
            EHktCollisionLayer::Character | EHktCollisionLayer::NPC | EHktCollisionLayer::Building });
        Mappings.Add({ FGameplayTag::RequestGameplayTag(FName(TEXT("Entity.Item"))),
            EHktCollisionLayer::Item,
            EHktCollisionLayer::None });
        Mappings.Add({ FGameplayTag::RequestGameplayTag(FName(TEXT("Entity.Building"))),
            EHktCollisionLayer::Building,
            EHktCollisionLayer::Character | EHktCollisionLayer::NPC | EHktCollisionLayer::Projectile });
        Mappings.Add({ FGameplayTag::RequestGameplayTag(FName(TEXT("Entity.Debris"))),
            EHktCollisionLayer::Debris,
            EHktCollisionLayer::Character | EHktCollisionLayer::NPC | EHktCollisionLayer::Projectile });
        Mappings.Add({ FGameplayTag::RequestGameplayTag(FName(TEXT("Entity.NPC"))),
            EHktCollisionLayer::NPC,
            EHktCollisionLayer::Character | EHktCollisionLayer::NPC | EHktCollisionLayer::Projectile | EHktCollisionLayer::Building | EHktCollisionLayer::Debris });
        Mappings.Add({ FGameplayTag::RequestGameplayTag(FName(TEXT("Entity.Character"))),
            EHktCollisionLayer::Character,
            EHktCollisionLayer::Character | EHktCollisionLayer::NPC | EHktCollisionLayer::Projectile | EHktCollisionLayer::Building | EHktCollisionLayer::Debris });
    }
    return Mappings;
}

/**
 * 엔티티 ClassTag에 따른 기본 Collision Layer 반환.
 * GameplayTag 계층 매칭(MatchesTag)으로 판단한다.
 */
inline uint32 GetDefaultCollisionLayer(const FGameplayTag& ClassTag)
{
    if (!ClassTag.IsValid())
        return EHktCollisionLayer::None;

    for (const FHktCollisionLayerMapping& M : GetHktCollisionLayerMappings())
    {
        if (ClassTag.MatchesTag(M.ParentTag))
            return M.Layer;
    }
    return EHktCollisionLayer::None;
}

/**
 * 엔티티 ClassTag에 따른 기본 Collision Mask 반환.
 * GameplayTag 계층 매칭(MatchesTag)으로 판단한다.
 */
inline uint32 GetDefaultCollisionMask(const FGameplayTag& ClassTag)
{
    if (!ClassTag.IsValid())
        return EHktCollisionLayer::None;

    for (const FHktCollisionLayerMapping& M : GetHktCollisionLayerMappings())
    {
        if (ClassTag.MatchesTag(M.ParentTag))
            return M.Mask;
    }
    return EHktCollisionLayer::None;
}
