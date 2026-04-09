// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "IHktPlayerInteractionInterface.h"
#include "HktLoginPlayerController.generated.h"

/**
 * 로그인 맵 전용 PlayerController.
 * UI 입력만 처리하며, RequestLogin 성공 시 GameInstance에 토큰 저장 후 인게임 맵으로 전환.
 */
UCLASS()
class HKTRUNTIME_API AHktLoginPlayerController : public APlayerController
	, public IHktPlayerInteractionInterface
{
	GENERATED_BODY()

public:
	AHktLoginPlayerController();

	// === IHktPlayerInteractionInterface ===
	virtual void ExecuteCommand(UObject* CommandData) override;
	virtual bool GetWorldState(const FHktWorldState*& OutState) const override;
	virtual FOnHktWorldViewUpdated& OnWorldViewUpdated() override;
	virtual FOnHktWheelInput& OnWheelInput() override;
	virtual FOnHktSubjectChanged& OnSubjectChanged() override;
	virtual FOnHktTargetChanged& OnTargetChanged() override;
	virtual FOnHktIntentSubmitted& OnIntentSubmitted() override;

protected:
	virtual void BeginPlay() override;

private:
	FOnHktWorldViewUpdated WorldViewUpdatedDelegate;
	FOnHktWheelInput WheelInputDelegate;
	FOnHktSubjectChanged SubjectChangedDelegate;
	FOnHktTargetChanged TargetChangedDelegate;
	FOnHktIntentSubmitted IntentSubmittedDelegate;
};
