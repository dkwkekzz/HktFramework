// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktProjectionPipeline.h"
#include "HktPresentationLog.h"
#include "HktCoreEventLog.h"

void FHktProjectionPipeline::Register(TUniquePtr<IHktProjection> Projection)
{
	check(Projection);
	HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
		FString::Printf(TEXT("[Pipeline] Registered Projection: %s (index=%d)"),
			Projection->GetName(), Projections.Num()));
	Projections.Add(MoveTemp(Projection));
}

const FHktEffectsPlan& FHktProjectionPipeline::ProcessFrame(
	const FHktWorldView& View,
	FHktPresentationState& State)
{
	FHktPresentationChangeSet ChangeSet = FHktPresentationChangeSet::FromWorldView(View);
	RunProjections(ChangeSet, State, View.FrameNumber);
	return CurrentPlan;
}

const FHktEffectsPlan& FHktProjectionPipeline::ProcessInitialSync(
	const FHktWorldState& WS, int64 Frame,
	FHktPresentationState& State)
{
	State.Clear();

	FHktPresentationChangeSet ChangeSet = FHktPresentationChangeSet::ForInitialSync(WS, Frame, InitialSyncSpawnBuffer);
	RunProjections(ChangeSet, State, Frame);
	return CurrentPlan;
}

void FHktProjectionPipeline::RunProjections(
	const FHktPresentationChangeSet& Changes,
	FHktPresentationState& State,
	int64 Frame)
{
	CurrentPlan.Reset();
	State.BeginFrame(Frame);

	FHktProjectionContext Ctx { State, CurrentPlan, *Changes.WorldState, Frame };

	for (const TUniquePtr<IHktProjection>& P : Projections)
	{
#if ENABLE_HKT_INSIGHTS
		const int32 EffectsBefore = CurrentPlan.Num();
#endif

		P->Project(Changes, Ctx);

#if ENABLE_HKT_INSIGHTS
		const int32 EffectsAdded = CurrentPlan.Num() - EffectsBefore;
		if (EffectsAdded > 0)
		{
			HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
				FString::Printf(TEXT("[Pipeline] %s → +%d effects"), P->GetName(), EffectsAdded));
		}
#endif
	}

	// --- Dirty 엔티티 → Actor에 ViewModel 증분 전달 Effect 자동 생성 ---
	// 모든 Projection이 State에 쓰기를 완료한 후, DirtyThisFrame의 Actor 엔티티에 대해
	// ForwardDirtyToActor Effect를 일괄 추가. 개별 Projection에서 중복 생성하지 않음.
	for (FHktEntityId Id : State.DirtyThisFrame)
	{
		const FHktEntityPresentation* E = State.Get(Id);
		if (E && E->RenderCategory == EHktRenderCategory::Actor)
		{
			CurrentPlan.Add(EHktEffectType::ForwardDirtyToActor, Id);
		}
	}

#if ENABLE_HKT_INSIGHTS
	if (CurrentPlan.Num() > 0)
	{
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
			FString::Printf(TEXT("[Pipeline] Frame=%lld TotalEffects=%d (%s)"),
				Frame, CurrentPlan.Num(), *CurrentPlan.Describe()));
	}
#endif
}

const IHktProjection* FHktProjectionPipeline::GetProjection(int32 Index) const
{
	return Projections.IsValidIndex(Index) ? Projections[Index].Get() : nullptr;
}
