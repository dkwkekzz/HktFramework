// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktServerRule.h"
#include "HktCoreSimulator.h"
#include "HktCoreProperties.h"
#include "HktCoreArchetype.h"
#include "HktInventoryTypes.h"
#include "HktStoryEventParams.h"
#include "HktRuleLog.h"
#include "GameplayTagsManager.h"
#include "NativeGameplayTags.h"
#include "HAL/IConsoleManager.h"

namespace
{
	int32 HashCombineHelper(int64 A, int32 B)
	{
		return static_cast<int32>(A * 2654435761) ^ B;
	}

	// I-0041: Player Inventory 용량 정책 — 계정-단위 보관 공간 슬롯 수.
	// Entity Bag(=활성 슬롯, I-0040) 의 BagCapacity 와는 별개. 결정론 영향 없음
	// (시뮬레이션 상수 아님 — 단순 보관 한도).
	static int32 GPlayerInventoryCapacity = 20;
	static FAutoConsoleVariableRef CVarPlayerInventoryCapacity(
		TEXT("hkt.Player.InventoryCapacity"),
		GPlayerInventoryCapacity,
		TEXT("Player Inventory(=계정 보관 공간) 슬롯 수. 로그인 시점에 적용. 기본 20."),
		ECVF_Default);
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

	// FHktEvent 생성 — 클라이언트가 보낸 이벤트를 서버 시퀀스로 재발행.
	// 클라이언트는 `Event.Natural.*` (또는 다른 시뮬 이벤트) 를 직접 발사하며,
	// 검증은 VM precondition + 결정론 모델이 담당한다 (Plan §3 ADR-R1 참조).
	FHktEvent Event = InEvent;
	Event.EventId = ++ServerEventSequence;
	Event.PlayerUid = PlayerUid;
	PendingGroupIntents[GroupIndex].Add(Event);
}

// 아이템 이벤트 태그 (내부 전용 Activate/Deactivate — Inventory 연동)
UE_DEFINE_GAMEPLAY_TAG_STATIC(Event_Item_Activate,   "Story.Event.Item.Activate");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Event_Item_Deactivate, "Story.Event.Item.Deactivate");

// ============================================================================
// Inventory 요청 수신 — Inventory ↔ Entity 전환
// ============================================================================


// EquipSlot PropertyId는 HktTrait::GetEquipSlotPropertyIds()에서 가져옴

/** FHktInventoryItem → FHktEntityState 변환 (엔티티 복원용) */
static FHktEntityState InventoryItemToEntityState(const FHktInventoryItem& InItem, int64 OwnerUid)
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

/** WorldState에서 아이템 엔티티 프로퍼티를 FHktInventoryItem으로 스냅샷 */
static FHktInventoryItem SnapshotEntityToInventoryItem(const FHktWorldState& WS, FHktEntityId ItemEntity)
{
	FHktInventoryItem Item;
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

void FHktDefaultServerRule::OnReceived_InventoryRequest(
	const FHktInventoryRequest& InRequest, IHktWorldPlayer& InPlayer)
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
	case EHktInventoryAction::StoreFromSlot:
	{
		// EquipSlot → Inventory: 엔티티 프로퍼티 스냅샷 → Inventory 에 저장 → Deactivate 이벤트
		if (InRequest.EquipIndex < 0 || InRequest.EquipIndex >= HktTrait::GetEquipSlotPropertyIds().Num()) return;

		const FHktEntityId ItemEntity = WS.GetProperty(InRequest.SourceEntity, HktTrait::GetEquipSlotPropertyIds()[InRequest.EquipIndex]);
		if (ItemEntity == 0 || !WS.IsValidEntity(ItemEntity)) return;

		// Deactivate 전에 스냅샷 (Deactivate가 엔티티를 파괴하기 때문)
		FHktInventoryItem InventoryItem = SnapshotEntityToInventoryItem(WS, ItemEntity);
		int32 OutInventorySlot = -1;
		if (!InPlayer.StoreToInventory(InventoryItem, OutInventorySlot)) return;

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
	case EHktInventoryAction::RestoreToSlot:
	{
		// Inventory → EquipSlot: Inventory 에서 아이템 꺼내기 → 엔티티 생성 + Activate (틱에서 처리)
		if (InRequest.EquipIndex < 0 || InRequest.EquipIndex >= HktTrait::GetEquipSlotPropertyIds().Num()) return;

		FHktInventoryItem OutItem;
		if (!InPlayer.TakeFromInventory(InRequest.InventorySlot, OutItem)) return;

		PendingInventoryEntitySpawns.Add({ OutItem, PlayerUid, GroupIndex, InRequest.SourceEntity, InRequest.EquipIndex, false });
		break;
	}
	case EHktInventoryAction::Discard:
	{
		// Inventory → Ground: Inventory 에서 아이템 꺼내기 → 바닥 엔티티 생성 (틱에서 처리)
		FHktInventoryItem OutItem;
		if (!InPlayer.TakeFromInventory(InRequest.InventorySlot, OutItem)) return;

		PendingInventoryEntitySpawns.Add({ OutItem, PlayerUid, GroupIndex, InRequest.SourceEntity, -1, true });
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
	const FGameplayTag SpawnStoryTag = InPlayer.GetSpawnStoryTag();
	TWeakInterfacePtr<IHktWorldPlayer> WeakPlayer(&InPlayer);

	const int64 FrameAtPostLogin = CachedFrame ? CachedFrame->GetFrameNumber() : -1;
	UE_LOG(LogHktRule, Log,
		TEXT("[FloatRepro] ServerRule.OnEvent_GameModePostLogin: uid=%lld frame=%lld bTerrainReady=%d"),
		PlayerUid, FrameAtPostLogin, bTerrainReady ? 1 : 0);

	CachedDB->LoadPlayerRecordAsync(PlayerUid, SpawnStoryTag, [this, WeakPlayer, PlayerUid](const FHktPlayerRecord& Record)
	{
		if (Record.IsValid())
		{
			UE_LOG(LogHktRule, Log,
				TEXT("[FloatRepro] ServerRule: PendingLoginResults.Enqueue uid=%lld LastPos.Z=%.1f bTerrainReady=%d"),
				PlayerUid, Record.LastPosition.Z, bTerrainReady ? 1 : 0);
			PendingLoginResults.Enqueue({ WeakPlayer, Record });
		}
	});
}

void FHktDefaultServerRule::OnEvent_GameModeLogout(const IHktWorldPlayer& InPlayer)
{
	// 로그아웃 UID를 큐잉 — ProcessPendingConnections에서 ExitWorldPlayer 포함하여 처리 (item 9)
	PendingLogoutRequests.Enqueue(InPlayer.GetPlayerUid());
}

void FHktDefaultServerRule::OnEvent_TerrainReady()
{
	if (bTerrainReady) return;
	bTerrainReady = true;
	const int64 FrameAtReady = CachedFrame ? CachedFrame->GetFrameNumber() : -1;
	UE_LOG(LogHktRule, Log,
		TEXT("[FloatRepro] ServerRule.OnEvent_TerrainReady: frame=%lld — 캐릭터/월드 스토리 게이트 해제, 다음 Tick 에 PendingLoginResults 처리."),
		FrameAtReady);
}

void FHktDefaultServerRule::OnEvent_GameModeInitWorld(const FGameplayTag& InStoryTag, const FVector& InLocation)
{
	if (!InStoryTag.IsValid())
	{
		UE_LOG(LogHktRule, Warning,
			TEXT("[ServerRule] OnEvent_GameModeInitWorld: invalid StoryTag — WorldInit story 가 큐잉되지 않습니다. AHktGameMode::WorldInitStoryTag UPROPERTY 가 비어있거나 잘못된 태그입니다."));
		return;
	}
	UE_LOG(LogHktRule, Log,
		TEXT("[ServerRule] OnEvent_GameModeInitWorld: queued story=%s location=(%.0f,%.0f,%.0f)"),
		*InStoryTag.ToString(), InLocation.X, InLocation.Y, InLocation.Z);
	PendingWorldInit.Emplace(FPendingWorldInit{ InStoryTag, InLocation });
}

void FHktDefaultServerRule::EnqueueDebugSpawner(const FGameplayTag& InStoryTag, const FVector& InLocation, int32 InParam2, int32 InParam3)
{
	if (!InStoryTag.IsValid())
	{
		UE_LOG(LogHktRule, Warning,
			TEXT("[ServerRule] EnqueueDebugSpawner: invalid StoryTag — 큐잉 거부."));
		return;
	}
	UE_LOG(LogHktRule, Log,
		TEXT("[ServerRule] EnqueueDebugSpawner: story=%s loc=(%.0f,%.0f,%.0f) p2=%d p3=%d"),
		*InStoryTag.ToString(), InLocation.X, InLocation.Y, InLocation.Z, InParam2, InParam3);
	PendingDebugSpawners.Add(FPendingDebugSpawner{ InStoryTag, InLocation, InParam2, InParam3 });
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
			TArray<FHktInventoryItem> InventoryItems;
			if (IHktWorldPlayer* WorldPlayer = Graph.GetWorldPlayer(LogoutUid))
			{
				InventoryItems = WorldPlayer->ExportInventoryForRecord();
			}

			IHktRelevancyGroup& Group = Graph.GetRelevancyGroup(GroupIndex);
			IHktAuthoritySimulator& Simulator = Group.GetSimulator();
			DB.SavePlayerRecordAsync(LogoutUid, Simulator.ExportPlayerState(LogoutUid), MoveTemp(InventoryItems));

			const int32 GroupIdx = Graph.GetRelevancyGroupIndex(LogoutUid);
			FGroupEventSend& GroupEventSend = Result.EventSends[GroupIdx];
			GroupEventSend.Batch.RemovedOwnerIds.Add(LogoutUid);
		}
	}

	// 로그인 처리 — Graph 등록은 EndFrame에서 처리 (item 5)
	//
	// 지형이 HktCore 에 반영되기 전까지 보류 — 캐릭터 Story 는 지형 표면 Z 와 어긋난
	// 위치에 SetPosition 하면 첫 PIE 진입에서 "떠다님" 증상을 만든다(Plan §race fix).
	// PendingLoginResults 큐는 그대로 유지되며 다음 틱에서 재평가된다.
	if (bTerrainReady)
	{
		FPendingLoginResult LoginResult;
		while (PendingLoginResults.Dequeue(LoginResult))
		{
			IHktWorldPlayer* NewPlayer = LoginResult.WeakPlayer.Get();
			if (!NewPlayer) continue;

			// DB에서 로드한 Inventory(=Player Inventory, I-0041) 복원 + 클라이언트 FullSync.
			// 신규 플레이어(InventoryItems 비어있음) 도 CVar 기반 Capacity 전파를 위해
			// 항상 호출한다 — Capacity 가 20 외의 값이면 클라 LocalInventoryState 와
			// 어긋나기 때문. 비용은 로그인당 1 RPC.
			NewPlayer->RestoreInventoryFromRecord(LoginResult.Record.InventoryItems, GPlayerInventoryCapacity);
			NewPlayer->SendInventoryFullSync();

			const int32 GroupIdx  = Graph.CalculateRelevancyGroupIndex(LoginResult.Record.LastPosition);
			FGroupEventSend& GroupEventSend = Result.EventSends[GroupIdx];
			GroupEventSend.Entered.Add(NewPlayer);

			UE_LOG(LogHktRule, Log,
				TEXT("[FloatRepro] ServerRule: LOGIN DISPATCH frame=%lld uid=%lld groupIdx=%d LastPos=(%.1f, %.1f, %.1f)"),
				CurrentFrameNumber, NewPlayer->GetPlayerUid(), GroupIdx,
				LoginResult.Record.LastPosition.X,
				LoginResult.Record.LastPosition.Y,
				LoginResult.Record.LastPosition.Z);
		}
	}
	else if (!bLoggedTerrainNotReady && !PendingLoginResults.IsEmpty())
	{
		UE_LOG(LogHktRule, Log,
			TEXT("[FloatRepro] ServerRule: 지형 로딩 대기 중 — PendingLoginResults 처리 보류 (frame=%lld). "
				 "OnEvent_TerrainReady 수신 후 재개합니다."),
			CurrentFrameNumber);
		bLoggedTerrainNotReady = true;
	}

	// --- World Init Story (GameMode에서 지정한 1회성 Story) ---
	// 지정된 위치의 그룹(또는 그룹이 없으면 0번)에 이벤트를 주입한다.
	// 지형 미반영 상태에서는 보류 — Spawner Story 가 지형 의존 시 fallback Generator 결과로
	// 잘못된 셀이 채워지는 race 방지. 큐는 유지되어 다음 틱에서 재평가.
	if (PendingWorldInit.IsSet() && bTerrainReady)
	{
		if (NumGroups <= 0)
		{
			// 그룹이 없으면 큐잉 유지 — 다음 틱에서 재시도. 인스턴스당 첫 발생만 경고.
			if (!bLoggedPendingWorldInitZeroGroup)
			{
				const FPendingWorldInit& Init = PendingWorldInit.GetValue();
				UE_LOG(LogHktRule, Warning,
					TEXT("[ServerRule] PendingWorldInit 대기 중 (tag=%s) — RelevancyGroup 미생성. 플레이어 입장 후 자동 재시도."),
					*Init.StoryTag.ToString());
				bLoggedPendingWorldInitZeroGroup = true;
			}
		}
		else
		{
			const FPendingWorldInit& Init = PendingWorldInit.GetValue();
			int32 TargetGroup = Graph.CalculateRelevancyGroupIndex(Init.Location);
			if (!PendingGroupIntents.IsValidIndex(TargetGroup))
			{
				TargetGroup = 0;
			}

			FHktEvent InitEvent = HktEventBuilder::Spawner(
				Init.StoryTag,
				static_cast<int32>(Init.Location.X),
				static_cast<int32>(Init.Location.Y));
			InitEvent.Location = Init.Location;
			InitEvent.EventId = ++ServerEventSequence;
			PendingGroupIntents[TargetGroup].Add(InitEvent);

			UE_LOG(LogHktRule, Log,
				TEXT("[ServerRule] PendingWorldInit dispatched: tag=%s group=%d eventId=%d"),
				*Init.StoryTag.ToString(), TargetGroup, InitEvent.EventId);

			PendingWorldInit.Reset();
		}
	}

	// 디버그 spawner 큐 소비 — `hkt.spawn.natural` 콘솔 커맨드로 enqueue 된 것들.
	// PendingWorldInit 와 같은 enqueue 패턴이지만 *복수 호출* 지원 (반복 검증용).
	for (const FPendingDebugSpawner& Dbg : PendingDebugSpawners)
	{
		int32 TargetGroup = Graph.CalculateRelevancyGroupIndex(Dbg.Location);
		if (!PendingGroupIntents.IsValidIndex(TargetGroup))
		{
			TargetGroup = 0;
		}
		if (!PendingGroupIntents.IsValidIndex(TargetGroup))
		{
			UE_LOG(LogHktRule, Warning,
				TEXT("[ServerRule] PendingDebugSpawner: NumGroups=%d — %s 큐잉 실패 (월드 미준비)."),
				PendingGroupIntents.Num(), *Dbg.StoryTag.ToString());
			continue;
		}
		FHktEvent DbgEvent = HktEventBuilder::Spawner(
			Dbg.StoryTag,
			static_cast<int32>(Dbg.Location.X),
			static_cast<int32>(Dbg.Location.Y),
			static_cast<int32>(Dbg.Location.Z));
		DbgEvent.Location = Dbg.Location;
		DbgEvent.Param2   = Dbg.Param2;
		// Param3 = Z (cm) 가 기본. 호출자가 명시적으로 Param3 를 채웠으면 그것을 우선.
		if (Dbg.Param3 != 0)
		{
			DbgEvent.Param3 = Dbg.Param3;
		}
		DbgEvent.EventId  = ++ServerEventSequence;
		PendingGroupIntents[TargetGroup].Add(DbgEvent);
		UE_LOG(LogHktRule, Log,
			TEXT("[ServerRule] PendingDebugSpawner dispatched: tag=%s group=%d eventId=%d p2=%d p3=%d"),
			*Dbg.StoryTag.ToString(), TargetGroup, DbgEvent.EventId, Dbg.Param2, Dbg.Param3);
	}
	PendingDebugSpawners.Reset();

	// --- ProcessSimulationAndPayloads ---

	// RestoreToSlot/Discard: 가방에서 꺼낸 아이템을 엔티티로 생성 + Activate 이벤트
	for (const FPendingInventoryEntitySpawn& Spawn : PendingInventoryEntitySpawns)
	{
		if (!PendingGroupIntents.IsValidIndex(Spawn.GroupIndex)) continue;

		FHktEntityState ES = InventoryItemToEntityState(Spawn.Item, Spawn.PlayerUid);

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
	PendingInventoryEntitySpawns.Reset();

	// 병렬 시뮬레이션 (item 8: diff 캐싱 없음)
	ParallelFor(NumGroups, [&](int32 GroupIndex)
	{
		FGroupEventSend& GroupEventSend = Result.EventSends[GroupIndex];
		FHktSimulationEvent& GroupBatch = GroupEventSend.Batch;

		GroupBatch.FrameNumber = CurrentFrameNumber;
		GroupBatch.RandomSeed = HashCombineHelper(CurrentFrameNumber, GroupIndex);
		GroupBatch.NewEvents.Append(MoveTemp(PendingGroupIntents[GroupIndex]));

		// Inventory 에서 복원된 엔티티 주입
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

		// I-0027: server 가 이번 프레임에 emit 한 spawner / voxel-attribution event 들을
		// batch 의 NewEvents 에 putback → Client_ReceiveFrameBatch 에 그대로 실린다.
		// 클라 proxy 는 `bIsAuthoritative=false` 라 자체 emit 안 함 — batch 의 event 만
		// 받아서 deterministic 하게 동일 Birch_Spawn 등을 재실행. server/client 동기.
		// 결과적으로 voxel attribution 으로 spawn 된 entity 가 client 에도 생성되어 actor 표시.
		const TArray<FHktEvent>& Emitted = Simulator.GetEmittedSpawnerEvents();
		if (Emitted.Num() > 0)
		{
			GroupBatch.NewEvents.Append(Emitted);
		}

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
