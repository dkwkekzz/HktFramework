// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVMEventRecorder.h"
#include "HktCoreLog.h"
#include "HAL/PlatformFileManager.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Misc/DateTime.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "Dom/JsonObject.h"

FHktVMEventRecorder& FHktVMEventRecorder::Get()
{
    static FHktVMEventRecorder Instance;
    return Instance;
}

void FHktVMEventRecorder::SetActive(bool bNewActive)
{
    FScopeLock ScopeLock(&Lock);
    bActive = bNewActive;
    ++Version;
}

void FHktVMEventRecorder::Record(FHktVMEventRecord&& Record)
{
    if (!bActive)
    {
        return;
    }

    FScopeLock ScopeLock(&Lock);

    if (Entries.Num() == 0)
    {
        Entries.SetNum(MaxEntries);
    }

    const int32 Index = WriteIndex % MaxEntries;
    Entries[Index] = Record;

    if (bRecording)
    {
        Recording.Add(Record);
    }

    ++WriteIndex;
    ++Version;
}

TArray<FHktVMEventRecord> FHktVMEventRecorder::Consume(uint32& InOutReadIndex) const
{
    FScopeLock ScopeLock(&Lock);

    TArray<FHktVMEventRecord> Out;
    if (Entries.Num() == 0 || InOutReadIndex == WriteIndex)
    {
        InOutReadIndex = WriteIndex;
        return Out;
    }

    // 링버퍼 오버플로우 대비: 누락된 만큼은 가장 오래된 살아있는 엔트리부터 시작.
    const uint32 ReadStart = (WriteIndex - InOutReadIndex > static_cast<uint32>(MaxEntries))
        ? (WriteIndex - MaxEntries)
        : InOutReadIndex;

    Out.Reserve(WriteIndex - ReadStart);
    for (uint32 i = ReadStart; i < WriteIndex; ++i)
    {
        Out.Add(Entries[i % MaxEntries]);
    }
    InOutReadIndex = WriteIndex;
    return Out;
}

TArray<FHktVMEventRecord> FHktVMEventRecorder::Snapshot() const
{
    FScopeLock ScopeLock(&Lock);

    TArray<FHktVMEventRecord> Out;
    if (Entries.Num() == 0)
    {
        return Out;
    }

    const uint32 Count = FMath::Min<uint32>(WriteIndex, static_cast<uint32>(MaxEntries));
    const uint32 Start = WriteIndex - Count;
    Out.Reserve(Count);
    for (uint32 i = Start; i < WriteIndex; ++i)
    {
        Out.Add(Entries[i % MaxEntries]);
    }
    return Out;
}

void FHktVMEventRecorder::Clear()
{
    FScopeLock ScopeLock(&Lock);
    Entries.Reset();
    WriteIndex = 0;
    ++Version;
}

void FHktVMEventRecorder::BeginRecording()
{
    FScopeLock ScopeLock(&Lock);
    if (bRecording)
    {
        return;
    }
    bRecording = true;
    Recording.Reset();
    ++Version;
}

void FHktVMEventRecorder::EndRecording()
{
    FScopeLock ScopeLock(&Lock);
    bRecording = false;
    ++Version;
}

TArray<FHktVMEventRecord> FHktVMEventRecorder::GetRecording() const
{
    FScopeLock ScopeLock(&Lock);
    return Recording;
}

int32 FHktVMEventRecorder::GetRecordedCount() const
{
    FScopeLock ScopeLock(&Lock);
    return Recording.Num();
}

// ────────────────────────────────────────────────────────────────────────────
// Recording 직렬화 — JSON
// ────────────────────────────────────────────────────────────────────────────

namespace
{
    TSharedRef<FJsonObject> RecordToJson(const FHktVMEventRecord& R)
    {
        TSharedRef<FJsonObject> O = MakeShared<FJsonObject>();
        O->SetNumberField(TEXT("Timestamp"), R.Timestamp);
        O->SetNumberField(TEXT("FrameNumber"), static_cast<double>(R.FrameNumber));
        O->SetNumberField(TEXT("SimFrame"), static_cast<double>(R.SimFrameNumber));
        O->SetNumberField(TEXT("Source"), R.Source);
        O->SetNumberField(TEXT("Kind"), static_cast<int32>(R.Kind));
        O->SetNumberField(TEXT("Phase"), static_cast<int32>(R.Phase));
        O->SetStringField(TEXT("EventTag"), R.EventTag.IsValid() ? R.EventTag.ToString() : FString());
        O->SetNumberField(TEXT("EventId"), R.EventId);
        O->SetNumberField(TEXT("PlayerUid"), static_cast<double>(R.PlayerUid));
        O->SetNumberField(TEXT("Param0"), R.Param0);
        O->SetNumberField(TEXT("Param1"), R.Param1);
        O->SetNumberField(TEXT("Param2"), R.Param2);
        O->SetNumberField(TEXT("Param3"), R.Param3);
        O->SetNumberField(TEXT("LocX"), R.Location.X);
        O->SetNumberField(TEXT("LocY"), R.Location.Y);
        O->SetNumberField(TEXT("LocZ"), R.Location.Z);
        O->SetNumberField(TEXT("PendingType"), R.PendingType);
        O->SetNumberField(TEXT("Watched"), R.WatchedEntity);
        O->SetNumberField(TEXT("Hit"), R.HitEntity);
        O->SetNumberField(TEXT("Src"), R.SourceEntity);
        O->SetNumberField(TEXT("Tgt"), R.TargetEntity);
        O->SetNumberField(TEXT("ContactX"), R.ContactPoint.X);
        O->SetNumberField(TEXT("ContactY"), R.ContactPoint.Y);
        O->SetNumberField(TEXT("ContactZ"), R.ContactPoint.Z);
        O->SetStringField(TEXT("Note"), R.Note);
        return O;
    }

    bool JsonToRecord(const TSharedPtr<FJsonObject>& O, FHktVMEventRecord& R)
    {
        if (!O.IsValid()) return false;
        R.Timestamp = O->GetNumberField(TEXT("Timestamp"));
        R.FrameNumber = static_cast<uint64>(O->GetNumberField(TEXT("FrameNumber")));
        R.SimFrameNumber = static_cast<int64>(O->GetNumberField(TEXT("SimFrame")));
        R.Source = static_cast<uint8>(O->GetIntegerField(TEXT("Source")));
        R.Kind = static_cast<EHktVMEventKind>(O->GetIntegerField(TEXT("Kind")));
        R.Phase = static_cast<EHktVMEventPhase>(O->GetIntegerField(TEXT("Phase")));
        const FString TagStr = O->GetStringField(TEXT("EventTag"));
        R.EventTag = TagStr.IsEmpty() ? FGameplayTag() : FGameplayTag::RequestGameplayTag(FName(*TagStr), false);
        R.EventId = O->GetIntegerField(TEXT("EventId"));
        R.PlayerUid = static_cast<int64>(O->GetNumberField(TEXT("PlayerUid")));
        R.Param0 = O->GetIntegerField(TEXT("Param0"));
        R.Param1 = O->GetIntegerField(TEXT("Param1"));
        R.Param2 = O->GetIntegerField(TEXT("Param2"));
        R.Param3 = O->GetIntegerField(TEXT("Param3"));
        R.Location.X = O->GetNumberField(TEXT("LocX"));
        R.Location.Y = O->GetNumberField(TEXT("LocY"));
        R.Location.Z = O->GetNumberField(TEXT("LocZ"));
        R.PendingType = static_cast<uint8>(O->GetIntegerField(TEXT("PendingType")));
        R.WatchedEntity = static_cast<FHktEntityId>(O->GetIntegerField(TEXT("Watched")));
        R.HitEntity = static_cast<FHktEntityId>(O->GetIntegerField(TEXT("Hit")));
        R.SourceEntity = static_cast<FHktEntityId>(O->GetIntegerField(TEXT("Src")));
        R.TargetEntity = static_cast<FHktEntityId>(O->GetIntegerField(TEXT("Tgt")));
        R.ContactPoint.X = O->GetNumberField(TEXT("ContactX"));
        R.ContactPoint.Y = O->GetNumberField(TEXT("ContactY"));
        R.ContactPoint.Z = O->GetNumberField(TEXT("ContactZ"));
        R.Note = O->GetStringField(TEXT("Note"));
        return true;
    }
}

FString FHktVMEventRecorder::SaveRecordingToFile(const FString& OptionalPath) const
{
    TArray<FHktVMEventRecord> Snap;
    {
        FScopeLock ScopeLock(&Lock);
        Snap = Recording;
    }

    FString OutPath = OptionalPath;
    if (OutPath.IsEmpty())
    {
        const FString Stamp = FDateTime::Now().ToString(TEXT("%Y%m%d_%H%M%S"));
        OutPath = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("Logs"),
            FString::Printf(TEXT("HktVMEventRecording_%s.json"), *Stamp));
    }

    TArray<TSharedPtr<FJsonValue>> Arr;
    Arr.Reserve(Snap.Num());
    for (const FHktVMEventRecord& R : Snap)
    {
        Arr.Add(MakeShared<FJsonValueObject>(RecordToJson(R)));
    }
    TSharedRef<FJsonObject> Root = MakeShared<FJsonObject>();
    Root->SetNumberField(TEXT("Version"), 1);
    Root->SetNumberField(TEXT("Count"), Snap.Num());
    Root->SetArrayField(TEXT("Records"), Arr);

    FString Json;
    TSharedRef<TJsonWriter<TCHAR>> Writer = TJsonWriterFactory<TCHAR>::Create(&Json);
    if (!FJsonSerializer::Serialize(Root, Writer))
    {
        UE_LOG(LogHktCore, Warning, TEXT("[VMEventRecorder] Save: JSON 직렬화 실패"));
        return FString();
    }

    if (!FFileHelper::SaveStringToFile(Json, *OutPath))
    {
        UE_LOG(LogHktCore, Warning, TEXT("[VMEventRecorder] Save: 파일 쓰기 실패 (%s)"), *OutPath);
        return FString();
    }

    UE_LOG(LogHktCore, Log, TEXT("[VMEventRecorder] %d records → %s"), Snap.Num(), *OutPath);
    return FPaths::ConvertRelativePathToFull(OutPath);
}

bool FHktVMEventRecorder::LoadRecordingFromFile(const FString& InPath)
{
    FString Json;
    if (!FFileHelper::LoadFileToString(Json, *InPath))
    {
        UE_LOG(LogHktCore, Warning, TEXT("[VMEventRecorder] Load: 파일 읽기 실패 (%s)"), *InPath);
        return false;
    }

    TSharedPtr<FJsonObject> Root;
    TSharedRef<TJsonReader<TCHAR>> Reader = TJsonReaderFactory<TCHAR>::Create(Json);
    if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
    {
        UE_LOG(LogHktCore, Warning, TEXT("[VMEventRecorder] Load: JSON 파싱 실패"));
        return false;
    }

    const TArray<TSharedPtr<FJsonValue>>* Arr = nullptr;
    if (!Root->TryGetArrayField(TEXT("Records"), Arr) || Arr == nullptr)
    {
        return false;
    }

    FScopeLock ScopeLock(&Lock);
    Recording.Reset();
    Recording.Reserve(Arr->Num());
    for (const TSharedPtr<FJsonValue>& V : *Arr)
    {
        if (!V.IsValid()) continue;
        const TSharedPtr<FJsonObject>* ObjPtr = nullptr;
        if (!V->TryGetObject(ObjPtr) || ObjPtr == nullptr) continue;
        FHktVMEventRecord R;
        if (JsonToRecord(*ObjPtr, R))
        {
            Recording.Add(MoveTemp(R));
        }
    }
    ++Version;
    UE_LOG(LogHktCore, Log, TEXT("[VMEventRecorder] %d records loaded from %s"), Recording.Num(), *InPath);
    return true;
}
