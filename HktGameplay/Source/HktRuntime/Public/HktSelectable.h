// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "HktRuntimeTypes.h"
#include "HktSelectable.generated.h"

//=============================================================================
// IHktSelectable - 선택 가능한 오브젝트 인터페이스
//=============================================================================

UINTERFACE(MinimalAPI, BlueprintType)
class UHktSelectable : public UInterface
{
	GENERATED_BODY()
};

/**
 * 선택 가능한 오브젝트가 구현하는 인터페이스.
 * EntityId를 제공하여 Intent 시스템에서 Subject/Target으로 사용됨.
 */
class HKTRUNTIME_API IHktSelectable
{
	GENERATED_BODY()

public:
	/** 이 오브젝트의 EntityId를 반환 */
	virtual FHktEntityId GetEntityId() const = 0;

	/** 선택 가능 여부 반환 (기본: true) */
	virtual bool IsSelectable() const { return true; }
};
