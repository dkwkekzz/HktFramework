// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

// ============================================================================
// FHktPropertyDef — 프로퍼티 메타데이터
//
// 매크로로 등록된 각 프로퍼티의 ID, 이름, 저장 Tier를 보관.
// operator uint16() 덕분에 기존 enum 문법 그대로 사용 가능.
// ============================================================================

enum class EHktPropertyTier : uint8 { Hot, Cold };

struct FHktPropertyDef
{
    uint16 Id;
    const TCHAR* Name;
    EHktPropertyTier Tier;

    FORCEINLINE operator uint16() const { return Id; }
    FORCEINLINE const TCHAR* ToString() const { return Name; }
    FORCEINLINE bool IsHot() const { return Tier == EHktPropertyTier::Hot; }
};

// ============================================================================
// FHktPropertyRegistry — 프로퍼티 메타데이터 중앙 저장소
//
// 매크로 등록 시 자동으로:
//   - ID 부여 (선언 순서)
//   - NameTable[Id] → 이름  (O(1) 조회)
//   - NameMap[Name] → Def*  (O(1) 조회)
//   - HotCount 자동 집계
// ============================================================================

namespace HktProperty
{
    namespace Detail
    {
        struct FPropertyRegistry
        {
            const TCHAR* NameTable[256]{};
            const FHktPropertyDef* DefTable[256]{};     // ID → Def* (O(1) Tier/메타 조회)
            TMap<FName, const FHktPropertyDef*> NameMap;
            uint16 TotalCount = 0;
            uint16 HotCount = 0;

            void Register(const FHktPropertyDef* P)
            {
                NameTable[P->Id] = P->Name;
                DefTable[P->Id] = P;
                NameMap.Add(FName(P->Name), P);
                TotalCount = FMath::Max(TotalCount, static_cast<uint16>(P->Id + 1));
                if (P->IsHot()) ++HotCount;
            }
        };

        inline uint16& Counter() { static uint16 C = 0; return C; }

        inline FPropertyRegistry& GetRegistry()
        {
            static FPropertyRegistry R;
            return R;
        }
    }
}

// ============================================================================
// HKT_DEFINE_PROPERTY — 프로퍼티 선언 매크로
//
// 사용: HKT_DEFINE_PROPERTY(PosX, Hot)   → ID 자동, Hot tier
//       HKT_DEFINE_PROPERTY(AnimState, Cold) → ID 자동, Cold tier
// ============================================================================

#define HKT_DEFINE_PROPERTY(PropName, TierValue) \
    inline const FHktPropertyDef PropName{::HktProperty::Detail::Counter()++, TEXT(#PropName), EHktPropertyTier::TierValue}; \
    inline const bool PropName##_Registered = (::HktProperty::Detail::GetRegistry().Register(&PropName), true);

// ============================================================================
// HktProperty — 프로퍼티 정의 (선언 순서 = ID, 기존 enum 순서 유지)
// ============================================================================

namespace HktProperty
{
    // ===== Hot Properties (매 프레임 접근, O(1) 직접 인덱싱) =====

    // 위치/이동
    HKT_DEFINE_PROPERTY(PosX,            Hot)    // 0
    HKT_DEFINE_PROPERTY(PosY,            Hot)    // 1
    HKT_DEFINE_PROPERTY(PosZ,            Hot)    // 2
    HKT_DEFINE_PROPERTY(RotYaw,          Hot)    // 3
    HKT_DEFINE_PROPERTY(MoveTargetX,     Hot)    // 4
    HKT_DEFINE_PROPERTY(MoveTargetY,     Hot)    // 5
    HKT_DEFINE_PROPERTY(MoveTargetZ,     Hot)    // 6
    HKT_DEFINE_PROPERTY(MoveForce,       Hot)    // 7
    HKT_DEFINE_PROPERTY(IsMoving,        Hot)    // 8
    HKT_DEFINE_PROPERTY(IsGrounded,      Hot)    // 9
    HKT_DEFINE_PROPERTY(MaxSpeed,        Hot)    // 10

    // 전투/상태
    HKT_DEFINE_PROPERTY(Health,          Hot)    // 11
    HKT_DEFINE_PROPERTY(MaxHealth,       Hot)    // 12
    HKT_DEFINE_PROPERTY(AttackPower,     Hot)    // 13
    HKT_DEFINE_PROPERTY(Defense,         Hot)    // 14
    HKT_DEFINE_PROPERTY(Team,            Hot)    // 15
    HKT_DEFINE_PROPERTY(Mana,            Hot)    // 16
    HKT_DEFINE_PROPERTY(MaxMana,         Hot)    // 17

    // 소유
    HKT_DEFINE_PROPERTY(OwnerEntity,     Hot)    // 18
    HKT_DEFINE_PROPERTY(EntitySpawnTag,  Hot)    // 19

    // 스탠스
    HKT_DEFINE_PROPERTY(Stance,          Hot)    // 20

    // 전투 (CP/공속)
    HKT_DEFINE_PROPERTY(CP,              Hot)    // 21
    HKT_DEFINE_PROPERTY(MaxCP,           Hot)    // 22
    HKT_DEFINE_PROPERTY(AttackSpeed,     Hot)    // 23
    HKT_DEFINE_PROPERTY(MotionPlayRate,  Hot)    // 24
    HKT_DEFINE_PROPERTY(NextActionFrame, Hot)    // 25

    // 충돌
    HKT_DEFINE_PROPERTY(CollisionLayer,  Hot)    // 26
    HKT_DEFINE_PROPERTY(CollisionMask,   Hot)    // 27
    HKT_DEFINE_PROPERTY(CollisionRadius, Hot)    // 28
    HKT_DEFINE_PROPERTY(Mass,            Hot)    // 29

    // 캡슐 반높이 (cm). 기존 DEPRECATED_JumpVelZ 슬롯(30) 재사용.
    // 캡슐 전체 높이 = 2 * HalfHeight, 캡슐 AABB Z = [PosZ, PosZ + 2*HalfHeight]
    HKT_DEFINE_PROPERTY(CollisionHalfHeight, Hot) // 30

    // ===== Cold Properties (공간 절약, 선형 탐색) =====

    // 이벤트 파라미터
    HKT_DEFINE_PROPERTY(TargetPosX,      Cold)   // 31
    HKT_DEFINE_PROPERTY(TargetPosY,      Cold)   // 32
    HKT_DEFINE_PROPERTY(TargetPosZ,      Cold)   // 33
    HKT_DEFINE_PROPERTY(Param0,          Cold)   // 34
    HKT_DEFINE_PROPERTY(Param1,          Cold)   // 35
    HKT_DEFINE_PROPERTY(Param2,          Cold)   // 36
    HKT_DEFINE_PROPERTY(Param3,          Cold)   // 37

    // 애니메이션/비주얼
    HKT_DEFINE_PROPERTY(AnimState,       Cold)   // 38
    HKT_DEFINE_PROPERTY(VisualState,     Cold)   // 39
    HKT_DEFINE_PROPERTY(AnimStateUpper,  Cold)   // 40

    // 물리
    HKT_DEFINE_PROPERTY(VelX,            Cold)   // 41
    HKT_DEFINE_PROPERTY(VelY,            Cold)   // 42
    HKT_DEFINE_PROPERTY(VelZ,            Cold)   // 43

    // 아이템
    HKT_DEFINE_PROPERTY(ItemState,       Cold)   // 44
    HKT_DEFINE_PROPERTY(ItemId,          Cold)   // 45
    HKT_DEFINE_PROPERTY(EquipIndex,      Cold)   // 46

    // 가방
    HKT_DEFINE_PROPERTY(BagCapacity,     Cold)   // 47

    // NPC
    HKT_DEFINE_PROPERTY(IsNPC,           Cold)   // 48
    HKT_DEFINE_PROPERTY(SpawnFlowTag,    Cold)   // 49

    // 아이템 스킬
    HKT_DEFINE_PROPERTY(ItemSkillTag,    Cold)   // 50
    HKT_DEFINE_PROPERTY(SkillCPCost,     Cold)   // 51
    HKT_DEFINE_PROPERTY(RecoveryFrame,   Cold)   // 52
    HKT_DEFINE_PROPERTY(SkillTargetRequired, Cold) // 53

    // 공격 사거리
    HKT_DEFINE_PROPERTY(AttackRange,     Cold)   // 54

    // 장착 가능 여부
    HKT_DEFINE_PROPERTY(Equippable,      Cold)   // 55

    // 캐릭터 장착 슬롯
    HKT_DEFINE_PROPERTY(EquipSlot0,      Cold)   // 56
    HKT_DEFINE_PROPERTY(EquipSlot1,      Cold)   // 57
    HKT_DEFINE_PROPERTY(EquipSlot2,      Cold)   // 58
    HKT_DEFINE_PROPERTY(EquipSlot3,      Cold)   // 59
    HKT_DEFINE_PROPERTY(EquipSlot4,      Cold)   // 60
    HKT_DEFINE_PROPERTY(EquipSlot5,      Cold)   // 61
    HKT_DEFINE_PROPERTY(EquipSlot6,      Cold)   // 62
    HKT_DEFINE_PROPERTY(EquipSlot7,      Cold)   // 63
    HKT_DEFINE_PROPERTY(EquipSlot8,      Cold)   // 64

    // 복셀 스킨
    HKT_DEFINE_PROPERTY(VoxelSkinSet,    Cold)   // 65
    HKT_DEFINE_PROPERTY(VoxelPalette,    Cold)   // 66

    // 지형 파편
    HKT_DEFINE_PROPERTY(TerrainTypeId,   Cold)   // 67 — Debris 엔티티의 원래 복셀 TypeID
    HKT_DEFINE_PROPERTY(DebrisOriginX,   Cold)   // 68 — Debris 원래 복셀 위치 X (cm)
    HKT_DEFINE_PROPERTY(DebrisOriginY,   Cold)   // 69 — Debris 원래 복셀 위치 Y (cm)
    HKT_DEFINE_PROPERTY(DebrisOriginZ,   Cold)   // 70 — Debris 원래 복셀 위치 Z (cm)

    // 2D 스프라이트 스켈레탈 (HktSpriteCore)
    // VM은 프레임을 모른다 — Facing/AnimStartTick + PartId만 저장.
    // 프레임 선택은 Presentation의 HktResolveSpriteFrame 순수 함수가 담당.
    HKT_DEFINE_PROPERTY(Facing,               Cold) // 71 — 8방향 (0=N, 1=NE, ..., 7=NW)
    HKT_DEFINE_PROPERTY(AnimStartTick,        Cold) // 72 — AnimState 전환 시점 (VM frame)
    HKT_DEFINE_PROPERTY(SpriteBody,           Cold) // 73 — Body PartTemplate FGameplayTag NetIndex

    // ================================================================
    // 메타데이터 질의 — Registry에서 자동 집계
    // ================================================================

    /** Hot 프로퍼티 개수 (3-Tier Storage의 HotStride) */
    inline uint16 HotMaxCount() { return Detail::GetRegistry().HotCount; }

    /** 전체 프로퍼티 개수 */
    inline uint16 MaxCount() { return Detail::GetRegistry().TotalCount; }

    /** PropId → 이름 문자열 (O(1)) */
    inline const TCHAR* GetPropertyName(uint16 PropId)
    {
        return PropId < Detail::GetRegistry().TotalCount
            ? Detail::GetRegistry().NameTable[PropId]
            : nullptr;
    }

    /** PropId → FHktPropertyDef (O(1) 직접 조회) */
    inline const FHktPropertyDef* GetPropertyDef(uint16 PropId)
    {
        return PropId < Detail::GetRegistry().TotalCount
            ? Detail::GetRegistry().DefTable[PropId]
            : nullptr;
    }

    /** 이름 → FHktPropertyDef (O(1) TMap 조회) */
    inline const FHktPropertyDef* FindByName(const FString& InName)
    {
        if (const auto* Found = Detail::GetRegistry().NameMap.Find(FName(*InName)))
            return *Found;
        return nullptr;
    }
}

// 하위 호환 — 기존 PropertyId::PosX 문법 유지
namespace PropertyId = HktProperty;
