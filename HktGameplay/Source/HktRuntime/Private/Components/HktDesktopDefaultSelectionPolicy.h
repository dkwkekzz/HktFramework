// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HktCoreDefs.h"
#include "HktWorldState.h"
#include "HktClientRuleInterfaces.h"
#include "HktDesktopDefaultSelectionPolicy.generated.h"

/**
 * UHktDesktopDefaultSelectionPolicy
 *
 * 아키텍처:
 *   - 컴포넌트는 인터페이스 구현에 집중
 *   - IHktUnitSelectionPolicy 인터페이스 구현:
 *     - ResolveSubject(): 커서 아래 Selectable 조회
 *     - ResolveTarget(): 커서 아래 Target 조회
 *
 * 플랫폼 및 환경별로 다른 SelectionPolicy 구현 가능:
 *   - 데스크톱: 마우스 커서 기반 선택
 *   - 모바일: 터치 입력 기반 선택
 *   - VR: 레이캐스트 기반 선택
 *
 * Rule에서의 사용:
 *   Rule->OnUserEvent_SubjectInputAction(*SelectionPolicy, *IntentBuilder);
 *   Rule->OnUserEvent_TargetInputAction(*SelectionPolicy, *IntentBuilder);
 */
UCLASS(ClassGroup=(HktRuntime), meta=(BlueprintSpawnableComponent))
class HKTRUNTIME_API UHktDesktopDefaultSelectionPolicy
    : public UActorComponent
    , public IHktUnitSelectionPolicy
{
    GENERATED_BODY()

public:
    UHktDesktopDefaultSelectionPolicy();

    // === IHktUnitSelectionPolicy 구현 ===

    virtual FHktEntityId ResolveSubject() const override;
    virtual void ResolveTarget(FHktEntityId& OutEntity, FVector& OutLocation) const override;

private:
    bool GetHitUnderCursor(FHitResult& OutHit) const;
    bool GetSelectableEntityUnderCursor(FHktEntityId& OutEntityId) const;
    bool GetEntityFromEntityHud(FHktEntityId& OutEntityId) const;
};
