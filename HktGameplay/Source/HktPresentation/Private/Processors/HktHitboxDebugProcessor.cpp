// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktHitboxDebugProcessor.h"

#if ENABLE_HKT_INSIGHTS

#include "Engine/World.h"
#include "Engine/LocalPlayer.h"
#include "DrawDebugHelpers.h"
#include "HktHitboxDebugTracer.h"

static TAutoConsoleVariable<int32> CVarShowHitbox(
	TEXT("hkt.Debug.ShowHitbox"),
	0,
	TEXT("Server VM ForEachInRadius hitbox visualization. 0=off, 1=sphere, 2=sphere+labels"),
	ECVF_Default);

static TAutoConsoleVariable<int32> CVarHitboxLifetime(
	TEXT("hkt.Debug.HitboxLifetime"),
	30,
	TEXT("Hitbox debug sphere fade-out duration in sim frames (30Hz tick → 30 = 1초)"),
	ECVF_Default);

FHktHitboxDebugProcessor::FHktHitboxDebugProcessor(ULocalPlayer* InLP)
	: LocalPlayer(InLP)
{
}

void FHktHitboxDebugProcessor::Sync(FHktPresentationState& State)
{
	const int32 Mode = CVarShowHitbox.GetValueOnGameThread();

	// CVar 가 꺼지면 VM 측 push 도 중단 — bEnabled 게이트로 zero-cost.
	FHktHitboxDebugTracer& Tracer = FHktHitboxDebugTracer::Get();
	Tracer.SetEnabled(Mode > 0);

	if (Mode <= 0)
	{
		return;
	}

	UWorld* World = LocalPlayer.IsValid() ? LocalPlayer->GetWorld() : nullptr;
	if (!World)
	{
		return;
	}

	const int32 LifetimeFrames = FMath::Max(1, CVarHitboxLifetime.GetValueOnGameThread());
	const uint64 CurrentFrame = static_cast<uint64>(State.GetCurrentFrame());

	TArray<FHktHitboxTrace> Traces;
	Tracer.Snapshot(CurrentFrame, LifetimeFrames, Traces);

	const bool bShowLabels = (Mode >= 2);

	for (const FHktHitboxTrace& T : Traces)
	{
		// age 비율 (0 = 방금, 1 = lifetime 만료 직전)
		const uint64 Age = (CurrentFrame > T.SimFrame) ? (CurrentFrame - T.SimFrame) : 0;
		const float AgeRatio = FMath::Clamp(static_cast<float>(Age) / static_cast<float>(LifetimeFrames), 0.f, 1.f);

		// HitCount 0 = 노란색(공격 빗나감), >0 = 빨간색(명중). age 진행에 따라 alpha 감쇠.
		const uint8 Alpha = static_cast<uint8>(FMath::Lerp(255.f, 32.f, AgeRatio));
		const FColor Color = (T.HitCount > 0)
			? FColor(255, 60, 60, Alpha)
			: FColor(255, 220, 60, Alpha);

		const FVector Center(static_cast<float>(T.Center.X),
		                     static_cast<float>(T.Center.Y),
		                     static_cast<float>(T.Center.Z));
		const float Radius = static_cast<float>(T.RadiusCm);

		DrawDebugSphere(World, Center, Radius, 24, Color,
			/*bPersistent*/false, /*LifeTime*/-1.f, SDPG_World, /*Thickness*/1.5f);

		if (bShowLabels)
		{
			const FString Label = FString::Printf(TEXT("[%s] src:%d R:%d hits:%d age:%llu"),
				*T.StoryTag.ToString(), T.Source, T.RadiusCm, T.HitCount, Age);
			DrawDebugString(World, Center + FVector(0, 0, Radius + 30.f),
				Label, nullptr, Color, -1.f, false, 1.0f);
		}
	}
}

void FHktHitboxDebugProcessor::Teardown()
{
	FHktHitboxDebugTracer::Get().SetEnabled(false);
	LocalPlayer = nullptr;
}

#endif // ENABLE_HKT_INSIGHTS
