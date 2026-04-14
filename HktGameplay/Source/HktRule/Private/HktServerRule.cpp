// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktServerRule.h"
#include "HktCoreSimulator.h"
#include "HktCoreProperties.h"
#include "HktCoreArchetype.h"
#include "HktBagTypes.h"
#include "HktStoryEventParams.h"
#include "GameplayTagsManager.h"
#include "NativeGameplayTags.h"
#include "HktTempMapStoryConfig.h"

// Story 태그 — .cpp 전용 static 정의
UE_DEFINE_GAMEPLAY_TAG_STATIC(Flow_Spawner_GoblinCamp,            "Story.Flow.Spawner.GoblinCamp");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Flow_Spawner_Item_TreeDrop,         "Story.Flow.Spawner.Item.TreeDrop");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Flow_Spawner_Wave_Arena,            "Story.Flow.Spawner.Wave.Arena");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Flow_Spawner_Item_AncientStaff,     "Story.Flow.Spawner.Item.AncientStaff");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Flow_Spawner_Item_Bandage,          "Story.Flow.Spawner.Item.Bandage");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Flow_Spawner_Item_ThunderHammer,    "Story.Flow.Spawner.Item.ThunderHammer");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Flow_Spawner_Item_WingsOfFreedom,   "Story.Flow.Spawner.Item.WingsOfFreedom");


TArray<FHktTempStoryEntry> HktTempMapStoryConfig::GetSpawnersForGroup(int32 GroupIndex)
{
	TArray<FHktTempStoryEntry> Out;

	//// 전역 스토리 — 모든 그룹 공통 (FHktMapData::GlobalStories 대응)
	//Out.Add({ Flow_Spawner_GoblinCamp,    1000 + GroupIndex * 500, 1000 });
	//Out.Add({ Flow_Spawner_Item_TreeDrop,  1200 + GroupIndex * 500,  800 });
	//
	//// 아이템 스포너 — 4종 아이템 맵 배치 (각 1개씩)
	//Out.Add({ Flow_Spawner_Item_AncientStaff,    800 + GroupIndex * 500,  600 });
	//Out.Add({ Flow_Spawner_Item_Bandage,        1400 + GroupIndex * 500,  600 });
	//Out.Add({ Flow_Spawner_Item_ThunderHammer,   800 + GroupIndex * 500, 1200 });
	//Out.Add({ Flow_Spawner_Item_WingsOfFreedom, 1400 + GroupIndex * 500, 1200 });
	//
	//// 그룹 0 전용 — Region별 스토리 (FHktMapRegion::Stories 대응)
	//if (GroupIndex == 0)
	//{
	//	Out.Add({ Flow_Spawner_Wave_Arena, 2000, 2000 });
	//}

	return Out;
}

namespace
{
	int32 HashCombineHelper(int64 A, int32 B)
	{
		return static_cast<int32>(A * 2654435761) ^ B;
	}
}

FHktDefaultServerRule::FHktDefaultServerRule()
{
}

FHktDefaultServerRule::~FHktDefaultServerRule()
{
}

// ============================================================================
// 컨텍스트 바인딩 (item 2)
// ============================================================================

void FHktDefaultServerRule::BindContext(
	IHktFrameManager* InFrame,
	IHktRelevancyGraph* InGraph,
	IHktWorldDatabase* InDB)
{
	CachedFrame   = InFrame;
	CachedGraph   = InGraph;
	CachedDB      = InDB;
}

// ============================================================================
// 인증
// ============================================================================

void FHktDefaultServerRule::OnReceived_Authentication(
	IHktAuthenticator& Authenticator,
	const IHktPrincipal& InPrincipal,
	TFunction<void(bool bSuccess, const FString& Token)> InResultCallback)
{
	Authenticator.Authenticate(InPrincipal.GetLoginID(), InPrincipal.GetLoginPW(), InResultCallback);
}

// ============================================================================
// 클라이언트 요청 수신 — 서버가 WorldState에서 EventTag 해석
// ============================================================================

void FHktDefaultServerRule::OnReceived_RuntimeEvent(
	const FHktEvent& InEvent, const IHktWorldPlayer& InPlayer)
{
	if (!CachedGraph) return;

	const int64 PlayerUid = InPlayer.GetPlayerUid();
	const int32 GroupIndex = CachedGraph->GetRelevancyGroupIndex(PlayerUid);
	if (!PendingGroupIntents.IsValidIndex(GroupIndex)) return;

	// 소스 엔티티 소유권 검증
	const IHktRelevancyGroup& Group = CachedGraph->GetRelevancyGroup(GroupIndex);
	const FHktWorldState& WS = Group.GetSimulator().GetWorldState();
	if (!WS.IsValidEntity(InEvent.SourceEntity)) return;
	if (WS.GetOwnerUid(InEvent.SourceEntity) != PlayerUid) return;

	// EventTag 유효성 검증
	if (!InEvent.EventTag.IsValid()) return;

	// FHktEvent 생성 — 클라이언트가 보낸 이벤트를 서버 시퀀스로 재발행
	FHktEvent Event = InEvent;
	Event.EventId = ++ServerEventSequence;
	Event.PlayerUid = PlayerUid;
	PendingGroupIntents[GroupIndex].Add(Event);
}

// 아이템 이벤트 태그 (내부 전용 Activate/Deactivate — Bag 연동)
UE_DEFINE_GAMEPLAY_TAG_STATIC(Event_Item_Activate,   "Story.Event.Item.Activate");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Event_Item_Deactivate, "Story.Event.Item.Deactivate");

// ============================================================================
// 가방 요청 수신 — Bag ↔ Entity 전환
// ============================================================================


// EquipSlot PropertyId는 HktTrait::GetEquipSlotPropertyIds()에서 가져옴

/** FHktBagItem → FHktEntityState 변환 (엔티티 복원용) */
static FHktEntityState BagItemToEntityState(const FHktBagItem& InItem, int64 OwnerUid)
{
	FHktEntityState ES;
	ES.Data.SetNumZeroed(PropertyId::MaxCount());
	ES.OwnerUid = OwnerUid;

	ES.Data[PropertyId::ItemId]              = InItem.ItemId;
	ES.Data[PropertyId::AttackPower]         = InItem.AttackPower;
	ES.Data[PropertyId::Defense]             = InItem.Defense;
	ES.Data[PropertyId::Stance]              = InItem.Stance;
	ES.Data[PropertyId::ItemSkillTag]        = InItem.ItemSkillTag;
	ES.Data[PropertyId::SkillCPCost]         = InItem.SkillCPCost;
	ES.Data[PropertyId::SkillTargetRequired] = InItem.SkillTargetRequired;
	ES.Data[PropertyId::RecoveryFrame]       = InItem.RecoveryFrame;
	ES.Data[PropertyId::EntitySpawnTag]      = InItem.EntitySpawnTag;

	// EntitySpawnTag → ClassTag (Tags에 추가)
	if (InItem.EntitySpawnTag > 0)
	{
		FName TagName = UGameplayTagsManager::Get().GetTagNameFromNetIndex(
			static_cast<FGameplayTagNetIndex>(InItem.EntitySpawnTag));
		if (!TagName.IsNone())
		{
			FGameplayTag Tag = FGameplayTag::RequestGameplayTag(TagName, false);
			if (Tag.IsValid())
			{
				ES.Tags.AddTag(Tag);
			}
		}
	}

	return ES;
}

/** WorldState에서 아이템 엔티티 프로퍼티를 FHktBagItem으로 스냅샷 */
static FHktBagItem SnapshotEntityToBagItem(const FHktWorldState& WS, FHktEntityId ItemEntity)
{
	FHktBagItem Item;
	Item.ItemId              = WS.GetProperty(ItemEntity, PropertyId::ItemId);
	Item.AttackPower         = WS.GetProperty(ItemEntity, PropertyId::AttackPower);
	Item.Defense             = WS.GetProperty(ItemEntity, PropertyId::Defense);
	Item.Stance              = WS.GetProperty(ItemEntity, PropertyId::Stance);
	Item.ItemSkillTag        = WS.GetProperty(ItemEntity, PropertyId::ItemSkillTag);
	Item.SkillCPCost         = WS.GetProperty(ItemEntity, PropertyId::SkillCPCost);
	Item.SkillTargetRequired = WS.GetProperty(ItemEntity, PropertyId::SkillTargetRequired);
	Item.RecoveryFrame       = WS.GetProperty(ItemEntity, PropertyId::RecoveryFrame);
	Item.EntitySpawnTag      = WS.GetProperty(ItemEntity, PropertyId::EntitySpawnTag);
	return Item;
}

void FHktDefaultServerRule::OnReceived_BagRequest(
	const FHktBagRequest& InRequest, IHktWorldPlayer& InPlayer)
{
	if (!CachedGraph) return;

	const int64 PlayerUid = InPlayer.GetPlayerUid();
	const int32 GroupIndex = CachedGraph->GetRelevancyGroupIndex(PlayerUid);
	if (!PendingGroupIntents.IsValidIndex(GroupIndex)) return;

	// 소스 엔티티(캐릭터) 소유권 검증
	const IHktRelevancyGroup& Group = CachedGraph->GetRelevancyGroup(GroupIndex);
	const FHktWorldState& WS = Group.GetSimulator().GetWorldState();
	if (!WS.IsValidEntity(InRequest.SourceEntity)) return;
	if (WS.GetOwnerUid(InRequest.SourceEntity) != PlayerUid) return;

	switch (InRequest.Action)
	{
	case EHktBagAction::StoreFromSlot:
	{
		// EquipSlot → Bag: 엔티티 프로퍼티 스냅샷 → 가방에 저장 → Deactivate 이벤트
		if (InRequest.EquipIndex < 0 || InRequest.EquipIndex >= HktTrait::GetEquipSlotPropertyIds().Num()) return;

		const FHktEntityId ItemEntity = WS.GetProperty(InRequest.SourceEntity, HktTrait::GetEquipSlotPropertyIds()[InRequest.EquipIndex]);
		if (ItemEntity == 0 || !WS.IsValidEntity(ItemEntity)) return;

		// Deactivate 전에 스냅샷 (Deactivate가 엔티티를 파괴하기 때문)
		FHktBagItem BagItem = SnapshotEntityToBagItem(WS, ItemEntity);
		int32 OutBagSlot = -1;
		if (!InPlayer.StoreToBag(BagItem, OutBagSlot)) return;

		// Deactivate 이벤트 발행 (기존 Story가 스탯 차감 + 슬롯 클리어 + 엔티티 정리)
		FHktEvent Event;
		Event.EventId = ++ServerEventSequence;
		Event.EventTag = Event_Item_Deactivate;
		Event.SourceEntity = InRequest.SourceEntity;
		Event.TargetEntity = ItemEntity;
		Event.PlayerUid = PlayerUid;
		PendingGroupIntents[GroupIndex].Add(Event);
		break;
	}
	case EHktBagAction::RestoreToSlot:
	{
		// Bag → EquipSlot: 가방에서 아이템 꺼내기 → 엔티티 생성 + Activate (틱에서 처리)
		if (InRequest.EquipIndex < 0 || InRequest.EquipIndex >= HktTrait::GetEquipSlotPropertyIds().Num()) return;

		FHktBagItem OutItem;
		if (!InPlayer.TakeFromBag(InRequest.BagSlot, OutItem)) return;

		PendingBagEntitySpawns.Add({ OutItem, PlayerUid, GroupIndex, InRequest.SourceEntity, InRequest.EquipIndex, false });
		break;
	}
	case EHktBagAction::Discard:
	{
		// Bag → Ground: 가방에서 아이템 꺼내기 → 바닥 엔티티 생성 (틱에서 처리)
		FHktBagItem OutItem;
		if (!InPlayer.TakeFromBag(InRequest.BagSlot, OutItem)) return;

		PendingBagEntitySpawns.Add({ OutItem, PlayerUid, GroupIndex, InRequest.SourceEntity, -1, true });
		break;
	}
	default:
		break;
	}
}

// ============================================================================
// 액터 이벤트 (item 1, 2)
// ============================================================================

void FHktDefaultServerRule::OnEvent_GameModePostLogin(IHktWorldPlayer& InPlayer)
{
	if (!CachedDB) return;

	const int64 PlayerUid = InPlayer.GetPlayerUid();
	TWeakInterfacePtr<IHktWorldPlayer> WeakPlayer(&InPlayer);

	CachedDB->LoadPlayerRecordAsync(PlayerUid, [this, WeakPlayer](const FHktPlayerRecord& Record)
	{
		if (Record.IsValid())
		{
			PendingLoginResults.Enqueue({ WeakPlayer, Record });
		}
	});
}

void FHktDefaultServerRule::OnEvent_GameModeLogout(const IHktWorldPlayer& InPlayer)
{
	// 로그아웃 UID를 큐잉 — ProcessPendingConnections에서 ExitWorldPlayer 포함하여 처리 (item 9)
	PendingLogoutRequests.Enqueue(InPlayer.GetPlayerUid());
}

// ============================================================================
// 틱 (item 1, 2, 3, 4, 5, 6, 8, 9)
// ============================================================================

FHktEventGameModeTickResult FHktDefaultServerRule::OnEvent_GameModeTick(float InDeltaTime)
{
	FHktEventGameModeTickResult Result;

	if (!CachedFrame || !CachedGraph || !CachedDB)
	{
		return Result;
	}

	IHktFrameManager&           Frame   = *CachedFrame;
	IHktRelevancyGraph&         Graph   = *CachedGraph;
	IHktWorldDatabase&          DB      = *CachedDB;

	// --- ProcessReady ---
	Frame.AdvanceFrame();

	// --- ProcessPendingConnections ---
	Graph.UpdateRelevancy();

	const int32 NumGroups = Graph.NumRelevancyGroup();
	const int64 CurrentFrameNumber = Frame.GetFrameNumber();

	PendingGroupIntents.SetNum(NumGroups);
	PendingGroupEntityStates.SetNum(NumGroups);
	Result.EventSends.SetNum(NumGroups);

	// 로그아웃 처리 (item 9: ExitWorldPlayer 호출)
	int64 LogoutUid;
	while (PendingLogoutRequests.Dequeue(LogoutUid))
	{
		const int32 GroupIndex = Graph.GetRelevancyGroupIndex(LogoutUid);
		if (GroupIndex != INDEX_NONE)
		{
			// 가방 데이터 내보내기 (DB 저장 전)
			TArray<FHktBagItem> BagItems;
			if (IHktWorldPlayer* WorldPlayer = Graph.GetWorldPlayer(LogoutUid))
			{
				BagItems = WorldPlayer->ExportBagForRecord();
			}

			IHktRelevancyGroup& Group = Graph.GetRelevancyGroup(GroupIndex);
			IHktAuthoritySimulator& Simulator = Group.GetSimulator();
			DB.SavePlayerRecordAsync(LogoutUid, Simulator.ExportPlayerState(LogoutUid), MoveTemp(BagItems));

			const int32 GroupIdx = Graph.GetRelevancyGroupIndex(LogoutUid);
			FGroupEventSend& GroupEventSend = Result.EventSends[GroupIdx];
			GroupEventSend.Batch.RemovedOwnerIds.Add(LogoutUid);
		}
	}

	// 로그인 처리 — Graph 등록은 EndFrame에서 처리 (item 5)
	FPendingLoginResult LoginResult;
	while (PendingLoginResults.Dequeue(LoginResult))
	{
		IHktWorldPlayer* NewPlayer = LoginResult.WeakPlayer.Get();
		if (!NewPlayer) continue;

		// DB에서 로드한 가방 데이터 복원 + 클라이언트 FullSync
		if (LoginResult.Record.BagItems.Num() > 0)
		{
			NewPlayer->RestoreBagFromRecord(LoginResult.Record.BagItems);
			NewPlayer->SendBagFullSync();
		}

		const int32 GroupIdx  = Graph.CalculateRelevancyGroupIndex(LoginResult.Record.LastPosition);
		FGroupEventSend& GroupEventSend = Result.EventSends[GroupIdx];
		GroupEventSend.Entered.Add(NewPlayer);
	}

	// --- Temp Map Story Injection (TODO: MapGenerator의 FHktMapData로 교체) ---
	// HktTempMapStoryConfig에서 테스트용 스토리 목록을 읽어 1회 fire.
	// 향후: FHktMapData::GlobalStories + FHktMapRegion::Stories에서 읽도록 변경.
	if (ActiveSpawnerFlows.Num() == 0)
	{
		for (int32 GroupIndex = 0; GroupIndex < NumGroups; ++GroupIndex)
		{
			for (const FHktTempStoryEntry& Entry : HktTempMapStoryConfig::GetSpawnersForGroup(GroupIndex))
			{
				FHktEvent SpawnerEvent = HktEventBuilder::Spawner(Entry.StoryTag, Entry.SpawnPosX, Entry.SpawnPosY);
				SpawnerEvent.EventId = ++ServerEventSequence;
				PendingGroupIntents[GroupIndex].Add(SpawnerEvent);
				ActiveSpawnerFlows.Add(Entry.StoryTag);
			}
		}
	}

	// --- ProcessSimulationAndPayloads ---

	// RestoreToSlot/Discard: 가방에서 꺼낸 아이템을 엔티티로 생성 + Activate 이벤트
	for (const FPendingBagEntitySpawn& Spawn : PendingBagEntitySpawns)
	{
		if (!PendingGroupIntents.IsValidIndex(Spawn.GroupIndex)) continue;

		FHktEntityState ES = BagItemToEntityState(Spawn.Item, Spawn.PlayerUid);

		if (Spawn.bDiscard)
		{
			// Ground 엔티티: ItemState=0 (바닥 상태), 캐릭터 위치에 드롭
			ES.Data[PropertyId::ItemState] = 0;
			const IHktRelevancyGroup& Group = Graph.GetRelevancyGroup(Spawn.GroupIndex);
			const FHktWorldState& WS = Group.GetSimulator().GetWorldState();
			if (WS.IsValidEntity(Spawn.CharacterEntity))
			{
				ES.Data[PropertyId::PosX] = WS.GetProperty(Spawn.CharacterEntity, PropertyId::PosX);
				ES.Data[PropertyId::PosY] = WS.GetProperty(Spawn.CharacterEntity, PropertyId::PosY);
				ES.Data[PropertyId::PosZ] = WS.GetProperty(Spawn.CharacterEntity, PropertyId::PosZ);
			}
		}

		const int32 NewEntityIndex = PendingGroupEntityStates[Spawn.GroupIndex].Num();
		PendingGroupEntityStates[Spawn.GroupIndex].Add(ES);

		if (!Spawn.bDiscard)
		{
			// RestoreToSlot: Activate 이벤트
			// TargetEntity는 ImportEntityState 후 시뮬레이터가 할당하므로 아직 알 수 없음.
			// Param1에 NewEntityStates 인덱스를 전달 → Story에서 해당 인덱스로 엔티티 참조.
			// (PendingGroupEntityStates가 GroupBatch.NewEntityStates의 앞부분에 삽입됨)
			FHktEvent ActivateEvent = HktEventBuilder::ItemActivate(Event_Item_Activate, Spawn.CharacterEntity, Spawn.PlayerUid, Spawn.EquipIndex, NewEntityIndex);
			ActivateEvent.EventId = ++ServerEventSequence;
			PendingGroupIntents[Spawn.GroupIndex].Add(ActivateEvent);
		}
	}
	PendingBagEntitySpawns.Reset();

	// 병렬 시뮬레이션 (item 8: diff 캐싱 없음)
	ParallelFor(NumGroups, [&](int32 GroupIndex)
	{
		FGroupEventSend& GroupEventSend = Result.EventSends[GroupIndex];
		FHktSimulationEvent& GroupBatch = GroupEventSend.Batch;

		GroupBatch.FrameNumber = CurrentFrameNumber;
		GroupBatch.DeltaSeconds = InDeltaTime;
		GroupBatch.RandomSeed = HashCombineHelper(CurrentFrameNumber, GroupIndex);
		GroupBatch.NewEvents.Append(MoveTemp(PendingGroupIntents[GroupIndex]));

		// Bag에서 복원된 엔티티 주입
		if (PendingGroupEntityStates.IsValidIndex(GroupIndex))
		{
			GroupBatch.NewEntityStates.Append(MoveTemp(PendingGroupEntityStates[GroupIndex]));
		}

		// 신입 엔티티/이벤트 주입
		for (IHktWorldPlayer* NewPlayer : GroupEventSend.Entered)
		{
			if (const FHktPlayerRecord* Rec = DB.GetCachedPlayerRecord(NewPlayer->GetPlayerUid()))
			{
				GroupBatch.NewEntityStates.Append(Rec->EntityStates);
				GroupBatch.NewEvents.Append(Rec->ActiveEvents);
			}
		}

		// item 8: diff 버림 (서버는 Diff 불필요)
		IHktRelevancyGroup& Group = Graph.GetRelevancyGroup(GroupIndex);
		IHktAuthoritySimulator& Simulator = Group.GetSimulator();
		Simulator.AdvanceFrame(GroupBatch);

		GroupEventSend.Existing = &Group.GetCachedWorldPlayers();
		GroupEventSend.NewState = &Simulator.GetWorldState();

		for (int64 PlayerUid : GroupEventSend.Batch.RemovedOwnerIds)
		{
			Graph.UnregisterPlayer(PlayerUid);
		}

		for (IHktWorldPlayer* NewPlayer : GroupEventSend.Entered)
		{
			Graph.RegisterPlayer(NewPlayer, GroupIndex);
		}
	});

	return Result;
}
