// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Modules/ModuleManager.h"

#if !UE_BUILD_SHIPPING
#include "HktServerRuleInterfaces.h"
#include "HktCoreTags.h"
#include "Engine/World.h"
#include "Engine/Engine.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/Pawn.h"
#include "Misc/Parse.h"
#include "HAL/IConsoleManager.h"
#include "GameplayTagContainer.h"

namespace HktDebugSpawnerCmd
{
	// 짧은 별칭 → Story.Flow.Spawner.Natural.* 태그로 해소.
	// 추가 spawner 가 늘어나면 본 테이블만 확장 (PR-6+ Pine/BerryBush 등).
	static FGameplayTag ResolveNaturalAlias(const FString& Alias)
	{
		const FString A = Alias.ToLower();
		if (A == TEXT("oak"))   return HktNaturalStoryTags::OakSpawn;
		if (A == TEXT("birch")) return HktNaturalStoryTags::BirchSpawn;
		// 직접 풀네임 입력도 허용 (예: hkt.spawn.natural Story.Flow.Spawner.Natural.Oak)
		return FGameplayTag::RequestGameplayTag(FName(*Alias), /*ErrorIfNotFound=*/false);
	}

	static FVector ResolveLocalPlayerLocation(UWorld* World, bool& bOutValid)
	{
		bOutValid = false;
		if (!World) return FVector::ZeroVector;
		APlayerController* PC = World->GetFirstPlayerController();
		if (!PC) return FVector::ZeroVector;
		if (APawn* Pawn = PC->GetPawn())
		{
			bOutValid = true;
			return Pawn->GetActorLocation();
		}
		// pawn 미준비 시 카메라 위치 폴백
		FVector CamLoc; FRotator CamRot;
		PC->GetPlayerViewPoint(CamLoc, CamRot);
		bOutValid = true;
		return CamLoc;
	}

	// `hkt.spawn.natural <Oak|Birch|FullTag> [param2/lineageId] [param3] [offsetCm]`
	// - param2 미지정: time-based seed (반복 호출 시 다른 LineageId)
	// - offsetCm: 플레이어 forward 방향으로 이동 (시야에 들어오게). 기본 800cm = 8m
	static void HandleSpawnNatural(const TArray<FString>& Args, UWorld* World)
	{
		if (Args.Num() < 1)
		{
			UE_LOG(LogTemp, Warning, TEXT("[hkt.spawn.natural] usage: hkt.spawn.natural <Oak|Birch|FullTag> [param2] [param3] [offsetCm]"));
			return;
		}
		const FGameplayTag StoryTag = ResolveNaturalAlias(Args[0]);
		if (!StoryTag.IsValid())
		{
			UE_LOG(LogTemp, Warning, TEXT("[hkt.spawn.natural] unresolved tag '%s'"), *Args[0]);
			return;
		}

		IHktServerRule* Rule = HktRule::GetServerRule(World);
		if (!Rule)
		{
			UE_LOG(LogTemp, Warning, TEXT("[hkt.spawn.natural] ServerRule null — 서버 컨텍스트가 아닙니다"));
			return;
		}

		bool bLocValid = false;
		FVector Loc = ResolveLocalPlayerLocation(World, bLocValid);
		if (!bLocValid)
		{
			UE_LOG(LogTemp, Warning, TEXT("[hkt.spawn.natural] 로컬 플레이어 위치 해소 실패 — 원점(0,0,0) 으로 폴백"));
		}

		// forward 방향 offset — 플레이어 시야 안쪽에 spawn
		const float OffsetCm = (Args.Num() >= 4) ? FCString::Atof(*Args[3]) : 800.f;
		if (bLocValid && OffsetCm != 0.f)
		{
			if (APlayerController* PC = World->GetFirstPlayerController())
			{
				FVector CamLoc; FRotator CamRot;
				PC->GetPlayerViewPoint(CamLoc, CamRot);
				Loc += CamRot.Vector() * OffsetCm;
				Loc.Z = 0.f; // spawner 는 지표면 기준 — Z=0 으로 고정
			}
		}

		// time-based default lineage seed — 반복 호출 시 다른 가계로 검증
		const int32 Param2 = (Args.Num() >= 2)
			? FCString::Atoi(*Args[1])
			: static_cast<int32>(FPlatformTime::Cycles() & 0x7FFFFFFF);
		const int32 Param3 = (Args.Num() >= 3) ? FCString::Atoi(*Args[2]) : 0;

		Rule->EnqueueDebugSpawner(StoryTag, Loc, Param2, Param3);

		UE_LOG(LogTemp, Log,
			TEXT("[hkt.spawn.natural] enqueued tag=%s loc=(%.0f,%.0f,%.0f) p2=%d p3=%d"),
			*StoryTag.ToString(), Loc.X, Loc.Y, Loc.Z, Param2, Param3);
	}

	static FAutoConsoleCommandWithWorldAndArgs GSpawnNaturalCmd(
		TEXT("hkt.spawn.natural"),
		TEXT("디버그: 자연 spawner story 를 로컬 플레이어 시야 앞쪽에 즉시 발화. ")
		TEXT("Usage: hkt.spawn.natural <Oak|Birch|FullTag> [param2/lineageId] [param3] [offsetCm=800]"),
		FConsoleCommandWithWorldAndArgsDelegate::CreateStatic(&HandleSpawnNatural));
}
#endif // !UE_BUILD_SHIPPING

IMPLEMENT_MODULE(FDefaultModuleImpl, HktRule)
