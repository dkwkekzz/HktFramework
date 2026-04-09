// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"

/**
 * HktUI 공용 헬퍼.
 * 위젯에서 PlayerController의 구체 타입을 모른 채 컴포넌트에 접근할 수 있도록 합니다.
 */
namespace HktUI
{
	/**
	 * PlayerController에서 특정 ActorComponent를 FindComponentByClass로 찾습니다.
	 * @tparam T UActorComponent 서브클래스
	 * @param PC PlayerController (nullptr-safe)
	 * @return 찾은 컴포넌트, 없으면 nullptr
	 */
	template<typename T>
	T* FindComponent(APlayerController* PC)
	{
		static_assert(TIsDerivedFrom<T, UActorComponent>::Value, "T must derive from UActorComponent");
		return PC ? PC->FindComponentByClass<T>() : nullptr;
	}

	/** 첫 번째 로컬 PlayerController를 반환합니다 (Slate 위젯 내부에서 PC 획득용). */
	inline APlayerController* GetFirstLocalPlayerController(const UObject* WorldContextObject = nullptr)
	{
		UWorld* World = nullptr;
		if (WorldContextObject)
		{
			World = WorldContextObject->GetWorld();
		}
		if (!World && GEngine)
		{
			if (const FWorldContext* Context = GEngine->GetWorldContextFromGameViewport(GEngine->GameViewport))
			{
				World = Context->World();
			}
		}
		return World ? World->GetFirstPlayerController() : nullptr;
	}
}
