// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktEffectsPlan.h"

namespace
{
	const TCHAR* EffectTypeToString(EHktEffectType Type)
	{
		switch (Type)
		{
		case EHktEffectType::ResolveAsset:           return TEXT("ResolveAsset");
		case EHktEffectType::SpawnActor:             return TEXT("SpawnActor");
		case EHktEffectType::DestroyActor:           return TEXT("DestroyActor");
		case EHktEffectType::ComputeRenderLocation:  return TEXT("ComputeRenderLocation");
		case EHktEffectType::PlayVFXAtLocation:      return TEXT("PlayVFXAtLocation");
		case EHktEffectType::AttachVFXToEntity:      return TEXT("AttachVFXToEntity");
		case EHktEffectType::DetachVFXFromEntity:    return TEXT("DetachVFXFromEntity");
		default:                                     return TEXT("Unknown");
		}
	}
}

FHktEffect& FHktEffectsPlan::Add(EHktEffectType Type, FHktEntityId EntityId)
{
	FHktEffect& E = Effects.AddDefaulted_GetRef();
	E.Type = Type;
	E.EntityId = EntityId;
	return E;
}

FHktEffect& FHktEffectsPlan::AddVFX(EHktEffectType Type, FGameplayTag Tag, FVector Location)
{
	FHktEffect& E = Effects.AddDefaulted_GetRef();
	E.Type = Type;
	E.Tag = Tag;
	E.Location = Location;
	return E;
}

FHktEffect& FHktEffectsPlan::AddVFXEntity(EHktEffectType Type, FGameplayTag Tag, FHktEntityId EntityId, FVector Location)
{
	FHktEffect& E = Effects.AddDefaulted_GetRef();
	E.Type = Type;
	E.Tag = Tag;
	E.EntityId = EntityId;
	E.Location = Location;
	return E;
}

FString FHktEffectsPlan::Describe() const
{
	if (Effects.IsEmpty()) return TEXT("(empty)");

	// Effect 타입별 카운트 (MAX_VALUE 센티널로 배열 크기 자동 조정)
	int32 Counts[static_cast<int32>(EHktEffectType::MAX_VALUE)] = {};
	for (const FHktEffect& E : Effects)
	{
		int32 Idx = static_cast<int32>(E.Type);
		if (Idx < UE_ARRAY_COUNT(Counts)) ++Counts[Idx];
	}

	FString Result;
	for (int32 i = 0; i < UE_ARRAY_COUNT(Counts); ++i)
	{
		if (Counts[i] > 0)
		{
			if (Result.Len() > 0) Result += TEXT(", ");
			Result += FString::Printf(TEXT("%s×%d"), EffectTypeToString(static_cast<EHktEffectType>(i)), Counts[i]);
		}
	}
	return Result;
}

int32 FHktEffectsPlan::CountByType(EHktEffectType Type) const
{
	int32 Count = 0;
	for (const FHktEffect& E : Effects)
		if (E.Type == Type) ++Count;
	return Count;
}
