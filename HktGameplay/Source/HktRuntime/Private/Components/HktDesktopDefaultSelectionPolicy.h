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
    virtual const FHktVoxelSelection& GetLastResolvedVoxel() const override { return LastResolvedVoxel; }
    virtual FHktEntityId GetLastResolvedTargetEntityId() const override { return LastResolvedTargetEntityId; }

private:
    /**
     * 선택 기준 화면 좌표를 반환.
     *  - 커서 표시 모드: 마우스 커서 위치.
     *  - 커서 숨김 모드(ShoulderView 마우스룩): 클릭할 커서가 없으므로 뷰포트 중앙(조준점 레티클 위치).
     */
    bool GetSelectionScreenPosition(FVector2D& OutScreenPos) const;

    /** GetSelectionScreenPosition 좌표에서 월드로 deproject 한 레이(원점/방향). */
    bool GetSelectionWorldRay(FVector& OutOrigin, FVector& OutDir) const;

    bool GetHitUnderCursor(FHitResult& OutHit) const;
    bool GetSelectableEntityUnderCursor(FHktEntityId& OutEntityId) const;
    bool GetEntityFromEntityHud(FHktEntityId& OutEntityId) const;

    /** 가장 최근 ResolveTarget 의 voxel 적중 정보. const 메서드에서 갱신되도록 mutable. */
    mutable FHktVoxelSelection LastResolvedVoxel;

    /** 가장 최근 ResolveTarget 의 OutEntity 스냅샷 (voxel 이면 VoxelTargetEntityId, 미적중이면 InvalidEntityId). */
    mutable FHktEntityId LastResolvedTargetEntityId = InvalidEntityId;
};
