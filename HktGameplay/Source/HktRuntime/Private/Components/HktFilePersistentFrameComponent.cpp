// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktFilePersistentFrameComponent.h"
#include "HktRuntimeLog.h"
#include "HktCoreEventLog.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonWriter.h"

// --- FHktFilePersistentFrameProvider ---

FHktFilePersistentFrameProvider::FHktFilePersistentFrameProvider()
{
}

FString FHktFilePersistentFrameProvider::GetFilePath() const
{
    return FPaths::ProjectSavedDir() / TEXT("HktPersistentFrame.json");
}

void FHktFilePersistentFrameProvider::ReserveBatch(int64 BatchSize, TFunction<void(int64 NewMaxFrame)> Callback)
{
    int64 CurrentCounter = 0;

    FString FilePath = GetFilePath();
    if (FPaths::FileExists(FilePath))
    {
        FString JsonString;
        if (!FFileHelper::LoadFileToString(JsonString, *FilePath))
        {
            HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Error, EHktLogSource::Server, FString::Printf(TEXT("[PersistentFrame] Failed to load file: %s"), *FilePath));
            return;
        }

        TSharedPtr<FJsonObject> RootObject;
        TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(JsonString);
        if (!FJsonSerializer::Deserialize(Reader, RootObject) || !RootObject.IsValid())
        {
            HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Error, EHktLogSource::Server, TEXT("[PersistentFrame] Failed to parse file"));
            return;
        }

        CurrentCounter = static_cast<int64>(RootObject->GetNumberField(TEXT("GlobalFrameCounter")));
    }

    int64 NewMaxFrame = CurrentCounter + BatchSize;

    TSharedRef<FJsonObject> RootObject = MakeShared<FJsonObject>();
    RootObject->SetNumberField(TEXT("GlobalFrameCounter"), static_cast<double>(NewMaxFrame));

    FString JsonString;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&JsonString);
    if (!FJsonSerializer::Serialize(RootObject, Writer))
    {
        HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Error, EHktLogSource::Server, TEXT("[PersistentFrame] Failed to serialize"));
        return;
    }

    if (!FFileHelper::SaveStringToFile(JsonString, *FilePath))
    {
        HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Error, EHktLogSource::Server, FString::Printf(TEXT("[PersistentFrame] Failed to save file: %s"), *FilePath));
        return;
    }

    Callback(NewMaxFrame);
}

// --- UHktFilePersistentFrameComponent ---

UHktFilePersistentFrameComponent::UHktFilePersistentFrameComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
    Provider = MakeUnique<FHktFilePersistentFrameProvider>();
}

void UHktFilePersistentFrameComponent::BeginPlay()
{
    Super::BeginPlay();
    ReserveNextBatch();
}

bool UHktFilePersistentFrameComponent::IsInitialized() const
{
    return bIsInitialized;
}

int64 UHktFilePersistentFrameComponent::GetFrameNumber() const
{
    return CurrentFrame;
}

void UHktFilePersistentFrameComponent::AdvanceFrame()
{
    if (!bIsInitialized)
    {
        return;
    }

    if (CurrentFrame >= ReservedMaxFrame)
    {
        HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Error, EHktLogSource::Server, FString::Printf(TEXT("[PersistentTick] CRITICAL: Frame range exhausted (Current=%lld, Max=%lld). Waiting for next batch."),
            CurrentFrame, ReservedMaxFrame));
        return;
    }

    CurrentFrame++;

    if (!bIsReservePending && (ReservedMaxFrame - CurrentFrame) < (BatchSize / 5))
    {
        ReserveNextBatch();
    }
}

void UHktFilePersistentFrameComponent::ReserveNextBatch()
{
    if (bIsReservePending)
    {
        return;
    }
    bIsReservePending = true;

    IHktPersistentTickProvider* P = Provider.Get();
    P->ReserveBatch(BatchSize, [this](int64 NewMaxFrame)
    {
        ReservedMaxFrame = NewMaxFrame;

        if (!bIsInitialized)
        {
            CurrentFrame = NewMaxFrame - BatchSize;
            bIsInitialized = true;
            HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Info, EHktLogSource::Server, FString::Printf(TEXT("[PersistentTick] Initialized: CurrentFrame=%lld, ReservedMaxFrame=%lld"),
                CurrentFrame, ReservedMaxFrame));
        }

        bIsReservePending = false;
    });
}
