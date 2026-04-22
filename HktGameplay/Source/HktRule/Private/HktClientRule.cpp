// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktClientRule.h"
#include "HktCoreProperties.h"
#include "HktCoreEventLog.h"
#include "HktStoryBuilder.h"
#include "HktStoryEventParams.h"

// 기본 액션 태그 (슬롯 미선택 시 타겟 유형에 따라 TargetDefault Story가 분기)
UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_Event_Target_Default, "Story.Event.Target.Default");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_Event_Move_Jump, "Story.Event.Move.Jump");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_Event_Move_Forward, "Story.Event.Move.Forward");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_Event_Move_Stop, "Story.Event.Move.Stop");

FHktDefaultClientRule::FHktDefaultClientRule()
{
}

FHktDefaultClientRule::~FHktDefaultClientRule()
{
}

// ============================================================================
// 컨텍스트 바인딩
// ============================================================================

void FHktDefaultClientRule::BindContext(
	IHktProxySimulator*      InSimulator,
	IHktIntentBuilder*       InBuilder,
	IHktUnitSelectionPolicy* InPolicy,
	IHktCommandContainer*    InContainer,
	IHktWorldPlayer*         InWorldPlayer)
{
	CachedSimulator   = InSimulator;
	CachedBuilder     = InBuilder;
	CachedPolicy      = InPolicy;
	CachedContainer   = InContainer;
	CachedWorldPlayer = InWorldPlayer;
}

// ============================================================================
// 소유권 체크
// ============================================================================

bool FHktDefaultClientRule::IsOwnedByMe(FHktEntityId Entity) const
{
	if (!CachedWorldPlayer || !CachedSimulator || !CachedSimulator->IsInitialized())
		return false;

	const int64 MyUid = CachedWorldPlayer->GetPlayerUid();
	if (MyUid == 0) return false;

	const FHktWorldState& WS = CachedSimulator->GetWorldState();
	return WS.GetOwnerUid(Entity) == MyUid;
}

// ============================================================================
// 유저 이벤트
// ============================================================================

void FHktDefaultClientRule::OnUserEvent_LoginButtonClick() {}

void FHktDefaultClientRule::OnUserEvent_SubjectInputAction()
{
	if (!CachedPolicy || !CachedBuilder)
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Intent, EHktLogLevel::Warning, EHktLogSource::Client,
			TEXT("SubjectAction ignored: context not bound (Policy or Builder is null)"));
		return;
	}

	FHktEntityId SelectedEntity = CachedPolicy->ResolveSubject();

	// 아이템은 Subject가 될 수 없다
	if (SelectedEntity != InvalidEntityId && CachedSimulator && CachedSimulator->IsInitialized())
	{
		const FHktWorldState& WS = CachedSimulator->GetWorldState();
		const int32 ItemId = WS.GetProperty(SelectedEntity, PropertyId::ItemId);
		if (ItemId > 0)
		{
			HKT_EVENT_LOG_ENTITY(HktLogTags::Runtime_Intent, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("SubjectAction rejected: Entity %d is an item (ItemId=%d), items cannot be Subject"), SelectedEntity, ItemId),
				SelectedEntity);
			return;
		}
	}
	else if (SelectedEntity == InvalidEntityId)
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Intent, EHktLogLevel::Info, EHktLogSource::Client,
			TEXT("SubjectAction: no selectable entity under cursor"));
	}

	// 소유 여부와 무관하게 선택 가능 (비소유 대상은 관찰만, 행위는 제한)
	CachedBuilder->SetSubject(SelectedEntity);
	CachedBuilder->ResetCommand();
}

void FHktDefaultClientRule::OnUserEvent_TargetInputAction()
{
	if (!CachedPolicy || !CachedBuilder)
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Intent, EHktLogLevel::Warning, EHktLogSource::Client,
			TEXT("TargetAction ignored: context not bound (Policy or Builder is null)"));
		return;
	}

	// Subject 없으면 무반응
	FHktEntityId SubjectEntity = CachedBuilder->GetSubjectEntityId();
	if (SubjectEntity == InvalidEntityId)
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Intent, EHktLogLevel::Warning, EHktLogSource::Client,
			TEXT("TargetAction ignored: no Subject selected"));
		return;
	}

	// 내 소유 아닌 Subject면 관찰만 (제어 불가)
	if (!IsOwnedByMe(SubjectEntity))
	{
		HKT_EVENT_LOG_ENTITY(HktLogTags::Runtime_Intent, EHktLogLevel::Warning, EHktLogSource::Client,
			FString::Printf(TEXT("TargetAction ignored: Subject %d is not owned by this player (observe only)"), SubjectEntity),
			SubjectEntity);
		return;
	}

	// Target 해석
	FHktEntityId TargetEntity = InvalidEntityId;
	FVector TargetLocation = FVector::ZeroVector;
	CachedPolicy->ResolveTarget(TargetEntity, TargetLocation);
	CachedBuilder->SetTarget(TargetEntity, TargetLocation);

	const int32 PendingSlot = CachedBuilder->GetCommandSlotIndex();

	FHktEvent Event;
	if (PendingSlot >= 0 && CachedContainer)
	{
		// SlotAction 선택됨 → 해당 슬롯의 EventTag로 UseSkill 이벤트 생성
		FGameplayTag EventTag = CachedContainer->GetEventTagAtSlot(PendingSlot);
		Event = HktEventBuilder::UseSkillFromSlot(EventTag, SubjectEntity, TargetEntity, TargetLocation, PendingSlot);
	}
	else
	{
		// SlotAction 없음 → 기본 액션 (타겟 유형 기반)
		// PC가 지정한 TargetDefault Story Tag가 있으면 우선 사용, 없으면 기본값
		FGameplayTag TargetDefaultTag = CachedWorldPlayer ? CachedWorldPlayer->GetTargetDefaultStoryTag() : FGameplayTag();
		if (!TargetDefaultTag.IsValid())
		{
			TargetDefaultTag = Tag_Event_Target_Default;
		}
		Event = HktEventBuilder::TargetDefault(TargetDefaultTag, SubjectEntity, TargetEntity, TargetLocation);
	}

	// ValidateStory 사전조건 검증
	if (CachedSimulator && CachedSimulator->IsInitialized())
	{
		const FHktWorldState& WS = CachedSimulator->GetWorldState();
		if (!HktStory::ValidateEvent(WS, Event))
		{
			HKT_EVENT_LOG_TAG(HktLogTags::Runtime_Intent, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("TargetAction rejected by ValidateEvent: %s"), *Event.ToString()),
				SubjectEntity, Event.EventTag);
			CachedBuilder->ResetCommand();
			return;
		}
	}

	CachedBuilder->SetPendingRuntimeEvent(Event);
	CachedBuilder->ResetCommand();

	HKT_EVENT_LOG_TAG(HktLogTags::Runtime_Intent, EHktLogLevel::Info, EHktLogSource::Client,
		FString::Printf(TEXT("TargetAction %s"), *Event.ToString()),
		SubjectEntity, Event.EventTag);
}

void FHktDefaultClientRule::OnUserEvent_CommandInputAction(int32 InSlotIndex)
{
	if (!CachedBuilder)
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Intent, EHktLogLevel::Warning, EHktLogSource::Client,
			FString::Printf(TEXT("CommandAction(Slot=%d) ignored: Builder is null"), InSlotIndex));
		return;
	}

	// Subject 없으면 무시
	FHktEntityId SubjectEntity = CachedBuilder->GetSubjectEntityId();
	if (SubjectEntity == InvalidEntityId)
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Intent, EHktLogLevel::Warning, EHktLogSource::Client,
			FString::Printf(TEXT("CommandAction(Slot=%d) ignored: no Subject selected"), InSlotIndex));
		return;
	}
	// 내 소유 아닌 Subject면 무시
	if (!IsOwnedByMe(SubjectEntity))
	{
		HKT_EVENT_LOG_ENTITY(HktLogTags::Runtime_Intent, EHktLogLevel::Warning, EHktLogSource::Client,
			FString::Printf(TEXT("CommandAction(Slot=%d) ignored: Subject %d is not owned by this player"), InSlotIndex, SubjectEntity),
			SubjectEntity);
		return;
	}

	CachedBuilder->SetCommandSlot(InSlotIndex);
}

void FHktDefaultClientRule::OnUserEvent_ZoomInputAction(float InDelta)
{
}

void FHktDefaultClientRule::OnUserEvent_JumpInputAction()
{
	if (!CachedBuilder || !CachedSimulator || !CachedSimulator->IsInitialized())
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Intent, EHktLogLevel::Warning, EHktLogSource::Client,
			TEXT("JumpAction ignored: context not bound"));
		return;
	}

	FHktEntityId SubjectEntity = CachedBuilder->GetSubjectEntityId();
	if (SubjectEntity == InvalidEntityId)
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Intent, EHktLogLevel::Warning, EHktLogSource::Client,
			TEXT("JumpAction ignored: no Subject selected"));
		return;
	}

	if (!IsOwnedByMe(SubjectEntity))
	{
		HKT_EVENT_LOG_ENTITY(HktLogTags::Runtime_Intent, EHktLogLevel::Warning, EHktLogSource::Client,
			FString::Printf(TEXT("JumpAction ignored: Subject %d is not owned by this player"), SubjectEntity),
			SubjectEntity);
		return;
	}

	// 이미 점프 중이면 무시 (IsGrounded == 0)
	const FHktWorldState& WS = CachedSimulator->GetWorldState();
	if (WS.GetProperty(SubjectEntity, PropertyId::IsGrounded) == 0)
	{
		HKT_EVENT_LOG_ENTITY(HktLogTags::Runtime_Intent, EHktLogLevel::Info, EHktLogSource::Client,
			FString::Printf(TEXT("JumpAction ignored: Subject %d is already airborne"), SubjectEntity),
			SubjectEntity);
		return;
	}

	FHktEvent Event = HktEventBuilder::Jump(Tag_Event_Move_Jump, SubjectEntity);

	if (!HktStory::ValidateEvent(WS, Event))
	{
		HKT_EVENT_LOG_TAG(HktLogTags::Runtime_Intent, EHktLogLevel::Warning, EHktLogSource::Client,
			FString::Printf(TEXT("JumpAction rejected by ValidateEvent")),
			SubjectEntity, Event.EventTag);
		return;
	}

	CachedBuilder->SetPendingRuntimeEvent(Event);

	HKT_EVENT_LOG_TAG(HktLogTags::Runtime_Intent, EHktLogLevel::Info, EHktLogSource::Client,
		FString::Printf(TEXT("JumpAction %s"), *Event.ToString()),
		SubjectEntity, Event.EventTag);
}

void FHktDefaultClientRule::OnUserEvent_MoveInputAction(const FVector& InDirection)
{
	if (!CachedBuilder || !CachedSimulator || !CachedSimulator->IsInitialized())
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Intent, EHktLogLevel::Warning, EHktLogSource::Client,
			TEXT("MoveInputAction ignored: context not bound"));
		return;
	}

	FHktEntityId SubjectEntity = CachedBuilder->GetSubjectEntityId();
	if (SubjectEntity == InvalidEntityId)
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Intent, EHktLogLevel::Warning, EHktLogSource::Client,
			TEXT("MoveInputAction ignored: no Subject selected"));
		return;
	}

	if (!IsOwnedByMe(SubjectEntity))
	{
		HKT_EVENT_LOG_ENTITY(HktLogTags::Runtime_Intent, EHktLogLevel::Warning, EHktLogSource::Client,
			FString::Printf(TEXT("MoveInputAction ignored: Subject %d is not owned by this player"), SubjectEntity),
			SubjectEntity);
		return;
	}

	// Subject의 현재 위치에서 방향 벡터 * 거리로 목표 위치 계산
	const FHktWorldState& WS = CachedSimulator->GetWorldState();
	const int32 PosX = WS.GetProperty(SubjectEntity, PropertyId::PosX);
	const int32 PosY = WS.GetProperty(SubjectEntity, PropertyId::PosY);
	const int32 PosZ = WS.GetProperty(SubjectEntity, PropertyId::PosZ);

	static constexpr float MoveProjectionDistance = 100000.0f;  // 충분히 먼 목표 (1km)
	FVector TargetLocation = FVector(PosX, PosY, PosZ) + InDirection * MoveProjectionDistance;

	FHktEvent Event = HktEventBuilder::MoveForward(Tag_Event_Move_Forward, SubjectEntity, TargetLocation);
	CachedBuilder->SetPendingRuntimeEvent(Event);

	HKT_EVENT_LOG_TAG(HktLogTags::Runtime_Intent, EHktLogLevel::Info, EHktLogSource::Client,
		FString::Printf(TEXT("MoveInputAction Dir=(%.1f,%.1f,%.1f) %s"), InDirection.X, InDirection.Y, InDirection.Z, *Event.ToString()),
		SubjectEntity, Event.EventTag);
}

void FHktDefaultClientRule::OnUserEvent_MoveStopAction()
{
	if (!CachedBuilder || !CachedSimulator || !CachedSimulator->IsInitialized())
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Intent, EHktLogLevel::Warning, EHktLogSource::Client,
			TEXT("MoveStopAction ignored: context not bound"));
		return;
	}

	FHktEntityId SubjectEntity = CachedBuilder->GetSubjectEntityId();
	if (SubjectEntity == InvalidEntityId)
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Intent, EHktLogLevel::Warning, EHktLogSource::Client,
			TEXT("MoveStopAction ignored: no Subject selected"));
		return;
	}

	if (!IsOwnedByMe(SubjectEntity))
	{
		return;
	}

	FHktEvent Event = HktEventBuilder::MoveStop(Tag_Event_Move_Stop, SubjectEntity);
	CachedBuilder->SetPendingRuntimeEvent(Event);

	HKT_EVENT_LOG_TAG(HktLogTags::Runtime_Intent, EHktLogLevel::Info, EHktLogSource::Client,
		FString::Printf(TEXT("MoveStopAction %s"), *Event.ToString()),
		SubjectEntity, Event.EventTag);
}

// ============================================================================
// 수신 이벤트 (내부 캐싱된 Simulator 사용)
// ============================================================================

void FHktDefaultClientRule::OnReceived_InitialState(const FHktWorldState& InState, int32 InGroupIndex)
{
	if (!CachedSimulator) return;

	CachedSimulator->RestoreState(InState, InGroupIndex);

	// 초기화 전 도착한 서버 Batch를 큐에 적재 (틱에서 처리)
	for (const FHktSimulationEvent& B : PendingBatches)
	{
		if (B.FrameNumber > InState.FrameNumber)
		{
			CachedSimulator->EnqueueServerBatch(B);
		}
	}
	PendingBatches.Empty();
}

void FHktDefaultClientRule::OnReceived_FrameBatch(const FHktSimulationEvent& InBatch)
{
	if (!CachedSimulator || !CachedSimulator->IsInitialized())
	{
		PendingBatches.Add(InBatch);
		return;
	}
	// 즉시 처리하지 않고 큐에 적재 — 다음 틱에서 롤백/빨리감기 처리
	CachedSimulator->EnqueueServerBatch(InBatch);
}

void FHktDefaultClientRule::OnReceived_BagUpdate(const FHktBagDelta& InDelta)
{
	// BagComponent가 Client_ReceiveBagUpdate에서 직접 LocalBagState를 업데이트하고
	// 델리게이트를 브로드캐스트하므로, ClientRule에서는 추가 처리 불필요.
	// 향후 UI 시스템이 복잡해지면 여기서 추가 로직 가능.
}
