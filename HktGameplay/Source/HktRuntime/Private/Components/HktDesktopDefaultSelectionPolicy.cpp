// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktDesktopDefaultSelectionPolicy.h"
#include "HktSelectable.h"
#include "IHktEntityHudHitTestProvider.h"
#include "HktCoreEventLog.h"
#include "GameFramework/HUD.h"
#include "GameFramework/PlayerController.h"
#include "Engine/World.h"

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
