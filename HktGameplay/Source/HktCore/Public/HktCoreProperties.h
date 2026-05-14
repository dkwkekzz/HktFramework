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

    // 2D 스프라이트 (HktSpriteCore)
    // 캐릭터 Template 키는 EntitySpawnTag(19)를 그대로 재사용 — SpawnEntity의 ClassTag가 곧 Template Tag.
    // 프레임 선택은 Presentation의 HktResolveSpriteFrame 순수 함수가 담당.
    // 주: Facing 은 클라 viewmodel 산출(LastMoveDirXY + 카메라 yaw) — VM 권위 프로퍼티 아님.
    HKT_DEFINE_PROPERTY(AnimStartTick,        Cold) // AnimState 전환 시점 (VM frame)

    // ===== Region-Scalar 카운터 (PR-2, Cold tier) =====
    //
    // Docs/Concepts/C01_TranquilWilds/04-region-state.md §3-D3 그룹 A 의 시즌 0 카운터.
    // RegionEntity (Entity.Region 태그 보유) 1 row 가 카운터를 보관하며,
    // FHktWorldState::FindOrCreateRegionEntity 가 lazy-create 한다.
    // 자주 갱신되지 않으므로 Cold tier — Hot stride 부담 없음.

    HKT_DEFINE_PROPERTY(RegionIdKey,               Cold) // RegionId (packed macro-tile). FindOrCreateRegionEntity 의 lookup 키 — 별도 store 0, 순수 SoA.
    HKT_DEFINE_PROPERTY(RegionFireCounter,         Cold) // 발화 누적
    HKT_DEFINE_PROPERTY(RegionHarvestedClusters,   Cold) // 베리/허브 cluster 수확 누적
    HKT_DEFINE_PROPERTY(RegionDeadTrees,           Cold) // 고사목 누적
    HKT_DEFINE_PROPERTY(RegionSuccessionPatches,   Cold) // 천이 패치 누적
    HKT_DEFINE_PROPERTY(RegionSeenTheGrain,        Cold) // 풀-결 관측 누적
    HKT_DEFINE_PROPERTY(RegionFelledElders,        Cold) // Elder 베기 누적 (집계용 scalar — lineage 별 상세는 PR-3 의 group B 가 담당)
    HKT_DEFINE_PROPERTY(RegionCrossingPoints,      Cold) // 발견된 ford crossing 수 (group C 상세는 PR-3+)
    HKT_DEFINE_PROPERTY(RegionBirchCount,          Cold) // Birch 현존 cap (Implementation-Plan §6.1 데모 시나리오)
    HKT_DEFINE_PROPERTY(RegionOakCount,            Cold) // Oak 현존 cap (PR-5+ 예약)
    HKT_DEFINE_PROPERTY(RegionPineCount,           Cold) // Pine 현존 cap (PR-7+ 예약)

    // ===== Region-Record (PR-3, Cold tier — 04 §3-D4 Group B) =====
    //
    // region 안의 *키별 record entity* 가 보관하는 컬럼들. record 1개 = SoA row 1개.
    // 모든 record 는 `Entity.RegionRecord.*` 태그 + `RegionIdKey` (소속 region) + `RecordKey` (record 키)
    // 3-컬럼을 기본으로 갖고, record 유형별 추가 컬럼을 덧붙인다.
    // lookup 은 `FHktWorldState::FindOrCreateRegionRecord` 가 SoA 선형 스캔으로 처리 (TMap 0).

    HKT_DEFINE_PROPERTY(RecordKey,                 Cold) // 32bit 자유 key — LineageId / VariantId / OreSpeciesId 공용. modulo 슬롯 매핑 0.

    // Lineage (Oak/Birch 가계 등) — Entity.RegionRecord.Lineage
    HKT_DEFINE_PROPERTY(LineageFelledCount,        Cold) // 이 가계에서 베인 그루 수 누적
    HKT_DEFINE_PROPERTY(LineagePromotedCount,      Cold) // 이 가계에서 후계자 promotion 발화 누적
    HKT_DEFINE_PROPERTY(LineageElderPosX,          Cold) // Elder 좌표 — 다음 자식 spawn 의 anchor (cm 단위)
    HKT_DEFINE_PROPERTY(LineageElderPosY,          Cold)
    HKT_DEFINE_PROPERTY(LineageElderPosZ,          Cold)

    // Variant (Mushroom/Herb 변종 등) — Entity.RegionRecord.Variant
    HKT_DEFINE_PROPERTY(VariantPotency,            Cold) // 변종의 효능 강도
    HKT_DEFINE_PROPERTY(VariantFirstFoundFrame,    Cold) // 처음 식별된 시뮬레이션 프레임 (0=미식별)

    // Ore (광종 depletion) — Entity.RegionRecord.OreSpecies
    HKT_DEFINE_PROPERTY(OreDepletedCount,          Cold) // 이 광종의 누적 채광량 (임계 시 광종 전이)
    HKT_DEFINE_PROPERTY(OreCurrentSpeciesId,       Cold) // 현재 region 에서 등장 중인 광종 (전이 후 변경)

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
