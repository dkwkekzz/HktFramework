// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVFXAssetBank.h"

UNiagaraSystem* UHktVFXAssetBank::FindSystem(const FString& Key) const
{
    for (const auto& Entry : Entries)
    {
        if (Entry.Key == Key)
        {
            return Entry.System.LoadSynchronous();
        }
    }
    return nullptr;
}

UNiagaraSystem* UHktVFXAssetBank::FindClosestSystem(const FHktVFXIntent& Intent) const
{
    // 1. 정확한 매칭
    FString ExactKey = Intent.GetAssetKey();
    if (UNiagaraSystem* Exact = FindSystem(ExactKey))
        return Exact;

    // 2. Intensity 무시하고 매칭 → 가장 가까운 Intensity 선택
    FString BaseKey = FString::Printf(TEXT("VFX_%s_%s"),
        *UEnum::GetValueAsString(Intent.EventType).RightChop(20),  // "EHktVFXEventType::" 제거
        *UEnum::GetValueAsString(Intent.Element).RightChop(18));   // "EHktVFXElement::" 제거

    UNiagaraSystem* BestMatch = nullptr;
    float BestIntensityDiff = MAX_FLT;

    for (const auto& Entry : Entries)
    {
        if (Entry.Key.StartsWith(BaseKey))
        {
            // 키에서 intensity 추출하여 가장 가까운 것 선택
            // Key 형식: VFX_EventType_Element_I{N}[_Surface]
            int32 IPos = Entry.Key.Find(TEXT("_I"));
            if (IPos != INDEX_NONE)
            {
                FString IntStr = Entry.Key.Mid(IPos + 2, 1);
                float EntryIntensity = FCString::Atof(*IntStr) / 10.f;
                float Diff = FMath::Abs(EntryIntensity - Intent.Intensity);
                if (Diff < BestIntensityDiff)
                {
                    BestIntensityDiff = Diff;
                    BestMatch = Entry.System.LoadSynchronous();
                }
            }
        }
    }

    return BestMatch;
}
