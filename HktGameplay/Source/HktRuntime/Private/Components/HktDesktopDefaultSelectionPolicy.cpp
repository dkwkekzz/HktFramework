// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktDesktopDefaultSelectionPolicy.h"
#include "HktSelectable.h"
#include "IHktEntityHudHitTestProvider.h"
#include "IHktHitRefinementProvider.h"
#include "HktCoreEventLog.h"
#include "GameFramework/HUD.h"
#include "GameFramework/PlayerController.h"
#include "Engine/World.h"
#include "Misc/ScopeExit.h"

UHktDesktopDefaultSelectionPolicy::UHktDesktopDefaultSelectionPolicy()
{
    PrimaryComponentTick.bCanEverTick = false;
}

// ============================================================================
// IHktUnitSelectionPolicy 구현
// ============================================================================

FHktEntityId UHktDesktopDefaultSelectionPolicy::ResolveSubject() const
{
    FHktEntityId OutEntity = InvalidEntityId;
    GetSelectableEntityUnderCursor(OutEntity);
    return OutEntity;
}

void UHktDesktopDefaultSelectionPolicy::ResolveTarget(FHktEntityId& OutEntity, FVector& OutLocation) const
{
    OutEntity = InvalidEntityId;
    OutLocation = FVector::ZeroVector;
    LastResolvedVoxel = FHktVoxelSelection{};
    LastResolvedTargetEntityId = InvalidEntityId;

    // OutEntity 가 어떤 경로로 결정되든 LastResolvedTargetEntityId 가 항상 동기화되도록 보장.
    // IntentBuilder.TargetEntityId 는 Rule 의 ResetCommand 직후 비워지므로 PC/Presentation 이
    // "방금 해석된 타겟" 을 사후 조회할 때 이 캐시를 사용.
    ON_SCOPE_EXIT { LastResolvedTargetEntityId = OutEntity; };

    // 2D 엔티티 HUD 히트를 먼저 시도
    if (GetEntityFromEntityHud(OutEntity))
    {
        // 위치는 3D 트레이스로 보충
        FHitResult Hit;
        if (GetHitUnderCursor(Hit))
        {
            OutLocation = Hit.Location;
        }
        return;
    }

    // 3D 트레이스 폴백
    FHitResult Hit;
    if (!GetHitUnderCursor(Hit))
    {
        HKT_EVENT_LOG(HktLogTags::Runtime_Intent, EHktLogLevel::Verbose, EHktLogSource::Client,
            TEXT("ResolveTarget: no hit under cursor"));
        return;
    }

    // 복셀 지형 히트 시 DDA 레이캐스트로 voxel 정보 추출 — voxel 도 EntityId 로 추상화.
    if (IHktHitRefinementProvider* Refiner = Cast<IHktHitRefinementProvider>(Hit.GetActor()))
    {
        APlayerController* PC = Cast<APlayerController>(GetOwner());
        FVector WorldOrigin, WorldDir;
        if (PC && PC->DeprojectMousePositionToWorld(WorldOrigin, WorldDir))
        {
            FHktVoxelSelection VoxelHit;
            if (Refiner->TryGetVoxelHit(WorldOrigin, WorldDir, VoxelHit))
            {
                LastResolvedVoxel = VoxelHit;
                OutEntity = VoxelTargetEntityId;   // sentinel — Rule/PC/UI 가 동일하게 EntityId 로 식별
                // 타겟 위치는 voxel 중심이 아니라 클릭된 "면"(surface) 으로 보낸다.
                // 중심을 쓰면 캐릭터 Z 와 voxel 중심 Z 사이의 영구적 Z gap 때문에
                // MovementSystem 의 3D 도착 판정(ArrivalThresholdSq=16cm²) 을 통과 못해
                // MoveEnd 가 emit 되지 않고 IsMoving 이 1 로 고정되며 제자리 걸음 발생.
                // HitNormal 방향으로 half-voxel 이동 → 윗면 클릭 시 타겟이 voxel 상단 표면이 됨.
                const double HalfVox = static_cast<double>(VoxelHit.VoxelSize) * 0.5;
                OutLocation = VoxelHit.WorldCenter + VoxelHit.HitNormal * HalfVox;
                return;
            }

            // Voxel 정보가 없으면 기존 FHitResult 정밀 보정만 시도
            FHitResult RefinedHit;
            if (Refiner->RefineHit(WorldOrigin, WorldDir, Hit, RefinedHit))
            {
                Hit = RefinedHit;
            }
            else
            {
                // DDA가 solid 복셀을 찾지 못함 — 파괴된 영역 통과 → 히트 없음
                HKT_EVENT_LOG(HktLogTags::Runtime_Intent, EHktLogLevel::Verbose, EHktLogSource::Client,
                    TEXT("ResolveTarget: voxel refinement found no solid voxel"));
                return;
            }
        }
    }

    if (IHktSelectable* Selectable = Cast<IHktSelectable>(Hit.GetActor()))
    {
        if (Selectable->IsSelectable())
        {
            OutEntity = Selectable->GetEntityId();
        }
        else
        {
            HKT_EVENT_LOG(HktLogTags::Runtime_Intent, EHktLogLevel::Warning, EHktLogSource::Client,
                FString::Printf(TEXT("ResolveTarget: Actor '%s' implements IHktSelectable but IsSelectable() returned false"),
                    *Hit.GetActor()->GetName()));
        }
    }

    OutLocation = Hit.Location;
}

// ============================================================================
// 내부 헬퍼
// ============================================================================

bool UHktDesktopDefaultSelectionPolicy::GetHitUnderCursor(FHitResult& OutHit) const
{
    APlayerController* Controller = Cast<APlayerController>(GetOwner());
    if (!Controller)
    {
        return false;
    }

    return Controller->GetHitResultUnderCursor(ECC_Visibility, false, OutHit);
}

bool UHktDesktopDefaultSelectionPolicy::GetSelectableEntityUnderCursor(FHktEntityId& OutEntityId) const
{
    // 2D 엔티티 HUD 히트를 먼저 시도
    if (GetEntityFromEntityHud(OutEntityId))
    {
        return true;
    }

    // 3D 트레이스 폴백
    FHitResult Hit;
    if (!GetHitUnderCursor(Hit))
    {
        HKT_EVENT_LOG(HktLogTags::Runtime_Intent, EHktLogLevel::Verbose, EHktLogSource::Client,
            TEXT("ResolveSubject: no hit under cursor"));
        return false;
    }

    IHktSelectable* Selectable = Cast<IHktSelectable>(Hit.GetActor());
    if (!Selectable)
    {
        HKT_EVENT_LOG(HktLogTags::Runtime_Intent, EHktLogLevel::Verbose, EHktLogSource::Client,
            FString::Printf(TEXT("ResolveSubject: Actor '%s' does not implement IHktSelectable"),
                Hit.GetActor() ? *Hit.GetActor()->GetName() : TEXT("null")));
        return false;
    }
    if (!Selectable->IsSelectable())
    {
        HKT_EVENT_LOG(HktLogTags::Runtime_Intent, EHktLogLevel::Warning, EHktLogSource::Client,
            FString::Printf(TEXT("ResolveSubject: Actor '%s' IsSelectable() returned false"),
                *Cast<AActor>(Selectable)->GetName()));
        return false;
    }

    OutEntityId = Selectable->GetEntityId();
    return true;
}

bool UHktDesktopDefaultSelectionPolicy::GetEntityFromEntityHud(FHktEntityId& OutEntityId) const
{
    APlayerController* Controller = Cast<APlayerController>(GetOwner());
    if (!Controller) return false;

    AHUD* HUD = Controller->GetHUD();
    IHktEntityHudHitTestProvider* Provider = Cast<IHktEntityHudHitTestProvider>(HUD);
    if (!Provider) return false;

    float MouseX, MouseY;
    if (!Controller->GetMousePosition(MouseX, MouseY)) return false;

    return Provider->GetEntityUnderScreenPosition(FVector2D(MouseX, MouseY), OutEntityId);
}
