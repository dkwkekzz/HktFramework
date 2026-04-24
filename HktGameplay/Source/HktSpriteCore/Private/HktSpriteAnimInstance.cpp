// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteAnimInstance.h"
#include "HktSpriteCoreLog.h"
#include "HktRuntimeTags.h"

// ============================================================================
// 내부 헬퍼
// ============================================================================

FGameplayTag UHktSpriteAnimInstance::ExtractLayerParent(const FGameplayTag& AnimTag)
{
	// UHktAnimInstance::ExtractLayerParent와 동일 규약:
	//   Anim.FullBody.Locomotion.Run → Anim.FullBody
	//   Anim.UpperBody.Combat.Attack → Anim.UpperBody
	//   Anim.Montage.Attack          → Anim.Montage
	const FString TagStr = AnimTag.ToString();
	int32 FirstDot = INDEX_NONE;
	TagStr.FindChar(TEXT('.'), FirstDot);
	if (FirstDot == INDEX_NONE)
	{
		return AnimTag;
	}
	const int32 SecondDot = TagStr.Find(TEXT("."), ESearchCase::CaseSensitive, ESearchDir::FromStart, FirstDot + 1);
	if (SecondDot == INDEX_NONE)
	{
		return AnimTag;
	}
	const FString ParentStr = TagStr.Left(SecondDot);
	return FGameplayTag::RequestGameplayTag(FName(*ParentStr), false);
}

FName UHktSpriteAnimInstance::TagLeafToActionId(const FGameplayTag& Tag)
{
	if (!Tag.IsValid()) return NAME_None;
	const FString TagStr = Tag.ToString();
	int32 LastDot = INDEX_NONE;
	TagStr.FindLastChar(TEXT('.'), LastDot);
	const FString Leaf = (LastDot != INDEX_NONE && LastDot + 1 < TagStr.Len())
		? TagStr.RightChop(LastDot + 1)
		: TagStr;
	return FName(*Leaf.ToLower());
}

const FHktSpriteAnimMappingEntry* UHktSpriteAnimInstance::FindMapping(const FGameplayTag& Tag) const
{
	if (!Tag.IsValid()) return nullptr;
	for (const FHktSpriteAnimMappingEntry& Entry : AnimMappings)
	{
		if (Entry.AnimTag.MatchesTagExact(Tag))
		{
			return &Entry;
		}
	}
	return nullptr;
}

// ============================================================================
// 상태 갱신
// ============================================================================

void UHktSpriteAnimInstance::SyncFromTagContainer(FHktSpriteAnimState& State, const FGameplayTagContainer& EntityTags, int64 CurrentTick) const
{
	// Entity 태그 중 Anim.* 계열만 필터링 (UHktAnimInstance와 동일)
	const FGameplayTagContainer CurrentAnimTags = EntityTags.Filter(FGameplayTagContainer(HktGameplayTags::Anim));

	// 새로 추가된 태그 → ApplyAnimTag
	for (const FGameplayTag& Tag : CurrentAnimTags)
	{
		if (!State.PrevAnimTags.HasTagExact(Tag))
		{
			ApplyAnimTag(State, Tag, CurrentTick);
		}
	}

	// 제거된 태그 → RemoveAnimTag
	for (const FGameplayTag& Tag : State.PrevAnimTags)
	{
		if (!CurrentAnimTags.HasTagExact(Tag))
		{
			RemoveAnimTag(State, Tag);
		}
	}

	State.PrevAnimTags = CurrentAnimTags;
}

void UHktSpriteAnimInstance::ApplyAnimTag(FHktSpriteAnimState& State, const FGameplayTag& AnimTag, int64 CurrentTick) const
{
	if (!AnimTag.IsValid())
	{
		return;
	}

	const FGameplayTag LayerParent = ExtractLayerParent(AnimTag);

	FGameplayTag& Current = State.AnimLayerTags.FindOrAdd(LayerParent);
	Current = AnimTag;

	// FullBody는 AnimStateTag와 동기화 (하위호환)
	if (LayerParent.MatchesTagExact(HktGameplayTags::Anim_FullBody))
	{
		State.AnimStateTag = AnimTag;
	}

	// 시작 tick은 트리거/상태 진입 시점에 기록. FullBody가 아닌(=Montage/UpperBody)
	// 오버라이드 계열은 항상 최신 tick으로 갱신. FullBody 상태 변화도 tick 갱신.
	State.CurrentAnimTag       = AnimTag;
	State.CurrentAnimStartTick = CurrentTick;
}

void UHktSpriteAnimInstance::RemoveAnimTag(FHktSpriteAnimState& State, const FGameplayTag& AnimTag) const
{
	if (!AnimTag.IsValid())
	{
		return;
	}

	const FGameplayTag LayerParent = ExtractLayerParent(AnimTag);

	// 해당 레이어의 현재 태그가 이 태그이면 제거
	if (FGameplayTag* Current = State.AnimLayerTags.Find(LayerParent))
	{
		if (Current->MatchesTagExact(AnimTag))
		{
			State.AnimLayerTags.Remove(LayerParent);
		}
	}

	// FullBody는 AnimStateTag와 동기화
	if (LayerParent.MatchesTagExact(HktGameplayTags::Anim_FullBody) && State.AnimStateTag.MatchesTagExact(AnimTag))
	{
		State.AnimStateTag = FGameplayTag();
	}

	// CurrentAnimTag가 제거되는 태그이면 무효화 (선택 로직이 다음 우선순위로 폴백)
	if (State.CurrentAnimTag.MatchesTagExact(AnimTag))
	{
		State.CurrentAnimTag = FGameplayTag();
	}
}

void UHktSpriteAnimInstance::SyncStance(FHktSpriteAnimState& State, FGameplayTag NewStance) const
{
	if (State.StanceTag == NewStance)
	{
		return;
	}
	State.StanceTag = NewStance;
}

// ============================================================================
// 결과 해석
// ============================================================================

void UHktSpriteAnimInstance::SelectActiveMapping(const FHktSpriteAnimState& State, FName& OutActionId, bool& bOutIsCombat,
	FGameplayTag& OutActiveLayer) const
{
	OutActionId    = NAME_None;
	bOutIsCombat   = false;
	OutActiveLayer = FGameplayTag();

	// 우선순위: Montage > UpperBody > FullBody > (그 외 레이어 중 임의 하나)
	static const FGameplayTag* PriorityLayers[] = {
		&HktGameplayTags::Anim_Montage,
		&HktGameplayTags::Anim_UpperBody,
		&HktGameplayTags::Anim_FullBody,
	};

	auto ResolveFromTag = [this, &OutActionId, &bOutIsCombat](const FGameplayTag& Tag)
	{
		if (const FHktSpriteAnimMappingEntry* Entry = FindMapping(Tag))
		{
			OutActionId  = Entry->ActionId;
			bOutIsCombat = Entry->bIsCombat;
			return true;
		}
		if (bUseTagLeafFallback)
		{
			OutActionId  = TagLeafToActionId(Tag);
			bOutIsCombat = false;
			return OutActionId != NAME_None;
		}
		return false;
	};

	for (const FGameplayTag* LayerPtr : PriorityLayers)
	{
		if (!LayerPtr) continue;
		if (const FGameplayTag* Found = State.AnimLayerTags.Find(*LayerPtr))
		{
			if (Found->IsValid() && ResolveFromTag(*Found))
			{
				OutActiveLayer = *LayerPtr;
				return;
			}
		}
	}

	// 우선순위 레이어에 없지만 다른 Anim.* 레이어에 태그가 있으면 사용
	for (const TPair<FGameplayTag, FGameplayTag>& Pair : State.AnimLayerTags)
	{
		if (!Pair.Value.IsValid()) continue;
		if (ResolveFromTag(Pair.Value))
		{
			OutActiveLayer = Pair.Key;
			return;
		}
	}

	// 아무것도 없으면 DefaultActionId
	OutActionId    = DefaultActionId;
	bOutIsCombat   = false;
	OutActiveLayer = FGameplayTag();
}

FName UHktSpriteAnimInstance::ApplyStanceOverride(FName BaseActionId, const FGameplayTag& StanceTag) const
{
	if (BaseActionId.IsNone() || !StanceTag.IsValid())
	{
		return BaseActionId;
	}
	if (const FHktSpriteStanceMapping* StanceMap = StanceMappings.Find(StanceTag))
	{
		if (const FName* Override = StanceMap->ActionIdOverrides.Find(BaseActionId))
		{
			return *Override;
		}
	}
	return BaseActionId;
}

void UHktSpriteAnimInstance::ResolveRenderOutputs(const FHktSpriteAnimState& State, int64 FallbackAnimStartTick,
	FName& OutActionId, float& OutPlayRate, int64& OutAnimStartTick) const
{
	FName BaseActionId = NAME_None;
	bool bIsCombat = false;
	FGameplayTag ActiveLayer;
	SelectActiveMapping(State, BaseActionId, bIsCombat, ActiveLayer);

	OutActionId = ApplyStanceOverride(BaseActionId, State.StanceTag);

	// Combat 액션은 AttackPlayRate 반영
	OutPlayRate = bIsCombat ? FMath::Max(State.AttackPlayRate, 0.01f) : 1.0f;

	// Montage/UpperBody 오버라이드가 활성이면 내부 CurrentAnimStartTick을 사용(트리거 시점 기준).
	// FullBody 전환은 서버의 AnimStartTick을 권위값으로 사용(네트워크 동기 유지).
	const bool bUseLocalTick = ActiveLayer.IsValid()
		&& (ActiveLayer.MatchesTagExact(HktGameplayTags::Anim_Montage)
			|| ActiveLayer.MatchesTagExact(HktGameplayTags::Anim_UpperBody));
	OutAnimStartTick = bUseLocalTick ? State.CurrentAnimStartTick : FallbackAnimStartTick;
}

// ============================================================================
// 동적 매핑 등록
// ============================================================================

void UHktSpriteAnimInstance::RegisterAnimMapping(FGameplayTag AnimTag, FName ActionId, bool bIsCombat)
{
	if (!AnimTag.IsValid()) return;

	for (FHktSpriteAnimMappingEntry& Entry : AnimMappings)
	{
		if (Entry.AnimTag.MatchesTagExact(AnimTag))
		{
			Entry.ActionId  = ActionId;
			Entry.bIsCombat = bIsCombat;
			UE_LOG(LogHktSpriteCore, Verbose, TEXT("[HktSpriteAnim] Updated mapping: %s -> %s"),
				*AnimTag.ToString(), *ActionId.ToString());
			return;
		}
	}

	FHktSpriteAnimMappingEntry NewEntry;
	NewEntry.AnimTag   = AnimTag;
	NewEntry.ActionId  = ActionId;
	NewEntry.bIsCombat = bIsCombat;
	AnimMappings.Add(NewEntry);

	UE_LOG(LogHktSpriteCore, Verbose, TEXT("[HktSpriteAnim] Registered mapping: %s -> %s (Combat=%d)"),
		*AnimTag.ToString(), *ActionId.ToString(), bIsCombat ? 1 : 0);
}

void UHktSpriteAnimInstance::UnregisterAnimMapping(FGameplayTag AnimTag)
{
	AnimMappings.RemoveAll([&AnimTag](const FHktSpriteAnimMappingEntry& Entry)
	{
		return Entry.AnimTag.MatchesTagExact(AnimTag);
	});
}

bool UHktSpriteAnimInstance::HasAnimMapping(FGameplayTag AnimTag) const
{
	return FindMapping(AnimTag) != nullptr;
}

FGameplayTag UHktSpriteAnimInstance::GetAnimLayerTag(const FHktSpriteAnimState& State, const FGameplayTag& LayerTag)
{
	if (const FGameplayTag* Found = State.AnimLayerTags.Find(LayerTag))
	{
		return *Found;
	}
	return FGameplayTag();
}
