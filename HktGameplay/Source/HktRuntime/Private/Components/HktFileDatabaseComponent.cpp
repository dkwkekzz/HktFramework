// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktFileDatabaseComponent.h"
#include "HktRuntimeLog.h"
#include "HktCoreEventLog.h"
#include "HktInventoryTypes.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/Paths.h"
#include "HktRuntimeTags.h"
#include "Settings/HktRuntimeGlobalSetting.h"

// ============================================================================
// SaveGame Custom Serialization
// ============================================================================

void UHktPlayerSaveGame::Serialize(FArchive& Ar)
{
	Super::Serialize(Ar);

	// FHktPlayerRecord 의 UPROPERTY 필드 (PlayerUid, LastLoginTime, CreatedTime,
	// LastPosition) 는 Super 가 처리. 비-UPROPERTY 컬렉션은 명시적 직렬화 필요.

	// I-0041: Player Inventory 영속화 — InventoryItems 는 friend operator<< 보유.
	// 빈 배열도 정상 직렬화되므로 신규 플레이어 케이스 안전.
	Ar << PlayerRecord.InventoryItems;

	// TODO(I-0011/I-0034): ActiveEvents·EntityStates 직렬화 활성화.
	// ActiveEvents 는 FHktEvent operator<< 보유로 즉시 활성화 가능하나,
	// EntityStates(FHktEntityState) 는 현재 NetSerialize 만 있어 디스크용
	// operator<< 추가 후 활성화 — 본 PR 범위 외(I-0041).
	//Ar << PlayerRecord.ActiveEvents;
	//Ar << PlayerRecord.EntityStates;
}

UHktFileDatabaseComponent::UHktFileDatabaseComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
	DefaultVisualTag = HktGameplayTags::Visual_Character_Default;
	DefaultFlowTag = HktGameplayTags::Flow_Character_Default;
}

void UHktFileDatabaseComponent::BeginPlay()
{
	Super::BeginPlay();
}

void UHktFileDatabaseComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	for (const auto& Pair : CachedRecords)
	{
		SaveToSlot(Pair.Key, Pair.Value, [](bool) {});
	}
	Super::EndPlay(EndPlayReason);
}

// ============================================================================
// 슬롯 관리 (Slot Management)
// ============================================================================

FString UHktFileDatabaseComponent::GetSaveSlotName(int64 PlayerUid)
{
	// 슬롯 이름 형식: "Player_{UID}"
	// Saved/SaveGames/Player_{UID}.sav 파일을 생성합니다.
	return FString::Printf(TEXT("Player_%lld"), PlayerUid);
}

// ============================================================================
// SaveGame 로드/저장 로직 (SaveGame Load/Save Logic)
// ============================================================================

void UHktFileDatabaseComponent::LoadFromSlot(int64 PlayerUid, TFunction<void(TOptional<FHktPlayerRecord>)> Callback)
{
	FString SlotName = GetSaveSlotName(PlayerUid);

	// SaveGame이 존재하는지 확인
	if (UGameplayStatics::DoesSaveGameExist(SlotName, 0))
	{
		UHktPlayerSaveGame* LoadedGame = Cast<UHktPlayerSaveGame>(UGameplayStatics::LoadGameFromSlot(SlotName, 0));
		if (LoadedGame)
		{
			HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Info, EHktLogSource::Server, FString::Printf(TEXT("[FileDatabase] Loaded SaveGame for player: %lld"), PlayerUid));
			Callback(TOptional<FHktPlayerRecord>(LoadedGame->PlayerRecord));
			return;
		}
	}

	// 찾을 수 없음 - 신규 플레이어로 간주
	Callback(TOptional<FHktPlayerRecord>());
}

void UHktFileDatabaseComponent::SaveToSlot(int64 PlayerUid, const FHktPlayerRecord& Record, TFunction<void(bool bSuccess)> Callback)
{
	FString SlotName = GetSaveSlotName(PlayerUid);

	UHktPlayerSaveGame* SaveGameInstance = Cast<UHktPlayerSaveGame>(UGameplayStatics::CreateSaveGameObject(UHktPlayerSaveGame::StaticClass()));
	if (SaveGameInstance)
	{
		SaveGameInstance->PlayerRecord = Record;

		if (UGameplayStatics::SaveGameToSlot(SaveGameInstance, SlotName, 0))
		{
			HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Info, EHktLogSource::Server, FString::Printf(TEXT("[FileDatabase] Saved SaveGame for player: %lld"), PlayerUid));
			Callback(true);
		}
		else
		{
			HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Error, EHktLogSource::Server, FString::Printf(TEXT("[FileDatabase] Failed to write SaveGame to slot: %s"), *SlotName));
			Callback(false);
		}
	}
	else
	{
		HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Error, EHktLogSource::Server, FString::Printf(TEXT("[FileDatabase] Failed to create SaveGame instance for player: %lld"), PlayerUid));
		Callback(false);
	}
}

// ============================================================================
// IHktWorldDatabase 구현
// ============================================================================

void UHktFileDatabaseComponent::LoadPlayerRecordAsync(int64 InPlayerUid, const FGameplayTag& InSpawnStoryTag, TFunction<void(const FHktPlayerRecord&)> InCallback)
{
	UE_LOG(LogHktRuntime, Log,
		TEXT("[FloatRepro] FileDB.LoadPlayerRecordAsync: uid=%lld spawnTag=%s"),
		InPlayerUid, *InSpawnStoryTag.ToString());

	if (FHktPlayerRecord* Cached = CachedRecords.Find(InPlayerUid))
	{
		UE_LOG(LogHktRuntime, Log,
			TEXT("[FloatRepro] FileDB: cached record HIT — LastPos=(%.1f, %.1f, %.1f)"),
			Cached->LastPosition.X, Cached->LastPosition.Y, Cached->LastPosition.Z);
		InCallback(*Cached);
		return;
	}

	// PC가 지정한 Spawn Story Tag가 없으면 기본값(Story.State.Player.InWorld) 사용
	const FGameplayTag EnterTag = InSpawnStoryTag.IsValid()
		? InSpawnStoryTag
		: HktGameplayTags::Story_PlayerInWorld;

	LoadFromSlot(InPlayerUid, [this, InPlayerUid, EnterTag, InCallback](TOptional<FHktPlayerRecord> Loaded)
	{
		if (Loaded.IsSet())
		{
			FHktPlayerRecord& Record = Loaded.GetValue();
			Record.PlayerUid = InPlayerUid;

			UE_LOG(LogHktRuntime, Log,
				TEXT("[FloatRepro] FileDB: SaveGame LOADED uid=%lld LastPos=(%.1f, %.1f, %.1f) Entities=%d"),
				InPlayerUid, Record.LastPosition.X, Record.LastPosition.Y, Record.LastPosition.Z,
				Record.EntityStates.Num());

			// 기존 레코드에 월드 진입 이벤트가 없으면 추가 (재진입 시)
			bool bHasInWorldEvent = false;
			for (const FHktEvent& Event : Record.ActiveEvents)
			{
				if (Event.EventTag == EnterTag)
				{
					bHasInWorldEvent = true;
					break;
				}
			}

			if (!bHasInWorldEvent)
			{
				FHktEvent EnterWorldEvent;
				EnterWorldEvent.EventTag = EnterTag;
				EnterWorldEvent.SourceEntity = static_cast<FHktEntityId>(InPlayerUid);
				EnterWorldEvent.TargetEntity = InvalidEntityId;
				EnterWorldEvent.Location = Record.LastPosition;
				EnterWorldEvent.PlayerUid = InPlayerUid;
				Record.ActiveEvents.Add(EnterWorldEvent);
			}

			CachedRecords.Add(InPlayerUid, Record);
			InCallback(Record);
		}
		else
		{
			// 신규 레코드 생성
			FHktPlayerRecord& NewRecord = CachedRecords.Add(InPlayerUid);
			NewRecord.PlayerUid = InPlayerUid;
			NewRecord.CreatedTime = FDateTime::UtcNow();
			NewRecord.LastLoginTime = NewRecord.CreatedTime;

			// 초기 월드 진입 이벤트 추가 — Location 은 ProjectSettings 의 폴백 Generator 결과.
			// [FloatRepro] 본 호출 시점이 BakedAsset 비동기 로드 *전* 이면 Z 가 fallback 값이며,
			// 이후 BakedAsset 가 다른 표면 Z 를 갖는 경우 캐릭터가 떠다니는 원인이 된다.
			FHktEvent EnterWorldEvent;
			EnterWorldEvent.EventTag = EnterTag;
			EnterWorldEvent.SourceEntity = static_cast<FHktEntityId>(InPlayerUid);
			EnterWorldEvent.TargetEntity = InvalidEntityId;
			EnterWorldEvent.Location = GetDefault<UHktRuntimeGlobalSetting>()->ComputeDefaultSpawnLocation(GetWorld());
			EnterWorldEvent.PlayerUid = InPlayerUid;
			NewRecord.ActiveEvents.Add(EnterWorldEvent);

			UE_LOG(LogHktRuntime, Log,
				TEXT("[FloatRepro] FileDB: NEW record uid=%lld → EnterWorld.Location=(%.1f, %.1f, %.1f) tag=%s"),
				InPlayerUid, EnterWorldEvent.Location.X, EnterWorldEvent.Location.Y, EnterWorldEvent.Location.Z,
				*EnterTag.ToString());

			InCallback(NewRecord);
		}
	});
}

void UHktFileDatabaseComponent::SavePlayerRecordAsync(int64 InPlayerUid, FHktPlayerState&& InState, TArray<FHktInventoryItem>&& InInventoryItems)
{
	// 기존 레코드 로드 또는 새로 생성
	FHktPlayerRecord* ExistingRecord = CachedRecords.Find(InPlayerUid);

	if (ExistingRecord)
	{
		// 기존 레코드 업데이트
		ExistingRecord->ActiveEvents = MoveTemp(InState.ActiveEvents);
		ExistingRecord->EntityStates = MoveTemp(InState.OwnedEntities);
		ExistingRecord->InventoryItems = MoveTemp(InInventoryItems);
		// LastLoginTime, CreatedTime, LastPosition은 유지

		SaveToSlot(InPlayerUid, *ExistingRecord, [InPlayerUid](bool bSuccess)
		{
			if (!bSuccess)
			{
				HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Warning, EHktLogSource::Server, FString::Printf(TEXT("[FileDatabase] Save failed for PlayerUid=%lld"), InPlayerUid));
			}
		});
	}
	else
	{
		// 캐시에 없으면 파일에서 로드 시도
		LoadFromSlot(InPlayerUid, [this, InPlayerUid, State = MoveTemp(InState), InventoryItems = MoveTemp(InInventoryItems)](TOptional<FHktPlayerRecord> Loaded) mutable
		{
			FHktPlayerRecord& RecordToSave = CachedRecords.Add(InPlayerUid);

			if (Loaded.IsSet())
			{
				// 파일에서 로드된 레코드 사용
				RecordToSave = Loaded.GetValue();
				RecordToSave.PlayerUid = InPlayerUid;
			}
			else
			{
				// 신규 레코드 생성
				RecordToSave.PlayerUid = InPlayerUid;
				RecordToSave.CreatedTime = FDateTime::UtcNow();
				RecordToSave.LastLoginTime = RecordToSave.CreatedTime;
				RecordToSave.LastPosition = FVector::ZeroVector;
			}

			// ActiveEvents, EntityStates, InventoryItems 이동
			RecordToSave.ActiveEvents = MoveTemp(State.ActiveEvents);
			RecordToSave.EntityStates = MoveTemp(State.OwnedEntities);
			RecordToSave.InventoryItems = MoveTemp(InventoryItems);

			// 파일에 저장
			SaveToSlot(InPlayerUid, CachedRecords[InPlayerUid], [InPlayerUid](bool bSuccess)
			{
				if (!bSuccess)
				{
					HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Warning, EHktLogSource::Server, FString::Printf(TEXT("[FileDatabase] Save failed for PlayerUid=%lld"), InPlayerUid));
				}
			});
		});
	}
}

const FHktPlayerRecord* UHktFileDatabaseComponent::GetCachedPlayerRecord(int64 InPlayerUid) const
{
	return CachedRecords.Find(InPlayerUid);
}