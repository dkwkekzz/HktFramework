// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteAnimProcessor.h"
#include "HktSpriteAnimMappingAsset.h"
#include "HktSpriteCoreLog.h"
#include "HktRuntimeTags.h"

namespace HktSpriteAnimProcessor
{

// ============================================================================
// 내부 헬퍼 (파일 스코프)
// ============================================================================

namespace
{
	/**
	 * UHktAnimInstance::ExtractLayerParent와 동일 규약:
	 *   Anim.FullBody.Locomotion.Run → Anim.FullBody
	 *   Anim.UpperBody.Combat.Attack → Anim.UpperBody
	 *   Anim.Montage.Attack          → Anim.Montage
	 */
	FGameplayTag ExtractLayerParent(const FGameplayTag& AnimTag)
	{
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

	FName TagLeafToActionId(const FGameplayTag& Tag)
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

	/**
	 * 주어진 태그를 매핑 테이블에서 찾거나, 없으면 leaf-fallback으로 ActionId 결정.
	 * 성공 시 true, OutActionId/bOutIsCombat 채움.
	 */
	bool ResolveTagToAction(const UHktSpriteAnimMappingAsset* Mapping, const FGameplayTag& Tag,
		FName& OutActionId, bool& bOutIsCombat)
	{
		if (Mapping)
		{
			if (const FHktSpriteAnimMappingEntry* Entry = Mapping->FindMapping(Tag))
			{
				OutActionId  = Entry->ActionId;
				bOutIsCombat = Entry->bIsCombat;
				return OutActionId != NAME_None;
			}
		}
		const bool bFallback = !Mapping || Mapping->bUseTagLeafFallback;
		if (bFallback)
		{
			OutActionId  = TagLeafToActionId(Tag);
			bOutIsCombat = false;
			return OutActionId != NAME_None;
		}
		return false;
	}

	FName ApplyStanceOverride(const UHktSpriteAnimMappingAsset* Mapping, FName BaseActionId, const FGameplayTag& StanceTag)
	{
		if (!Mapping || BaseActionId.IsNone() || !StanceTag.IsValid())
		{
			return BaseActionId;
		}
		if (const FHktSpriteStanceMapping* StanceMap = Mapping->StanceMappings.Find(StanceTag))
		{
			if (const FName* Override = StanceMap->ActionIdOverrides.Find(BaseActionId))
			{
				return *Override;
			}
		}
		return BaseActionId;
	}
} // namespace

// ============================================================================
// 상태 갱신
// ============================================================================

void SyncFromTagContainer(const UHktSpriteAnimMappingAsset* /*Mapping*/, FHktSpriteAnimFragment& Fragment,
	const FGameplayTagContainer& EntityTags, int64 CurrentTick)
{
	// Entity 태그 중 Anim.* 계열만 필터링 (UHktAnimInstance와 동일)
	const FGameplayTagContainer CurrentAnimTags = EntityTags.Filter(FGameplayTagContainer(HktGameplayTags::Anim));

	// 새로 추가된 태그 → ApplyAnimTag
	for (const FGameplayTag& Tag : CurrentAnimTags)
	{
		if (!Fragment.PrevAnimTags.HasTagExact(Tag))
		{
			ApplyAnimTag(Fragment, Tag, CurrentTick);
		}
	}

	// 제거된 태그 → RemoveAnimTag
	for (const FGameplayTag& Tag : Fragment.PrevAnimTags)
	{
		if (!CurrentAnimTags.HasTagExact(Tag))
		{
			RemoveAnimTag(Fragment, Tag);
		}
	}

	Fragment.PrevAnimTags = CurrentAnimTags;
}

void ApplyAnimTag(FHktSpriteAnimFragment& Fragment, const FGameplayTag& AnimTag, int64 CurrentTick)
{
	if (!AnimTag.IsValid())
	{
		return;
	}

	const FGameplayTag LayerParent = ExtractLayerParent(AnimTag);

	FGameplayTag& Current = Fragment.AnimLayerTags.FindOrAdd(LayerParent);
	Current = AnimTag;

	// FullBody는 AnimStateTag와 동기화 (하위호환)
	if (LayerParent.MatchesTagExact(HktGameplayTags::Anim_FullBody))
	{
		Fragment.AnimStateTag = AnimTag;
	}

	// Montage/UpperBody/FullBody 모두 트리거 시점 tick을 기록.
	// ResolveRenderOutputs에서 활성 레이어에 따라 사용 여부 결정.
	Fragment.CurrentAnimTag       = AnimTag;
	Fragment.CurrentAnimStartTick = CurrentTick;
}

void RemoveAnimTag(FHktSpriteAnimFragment& Fragment, const FGameplayTag& AnimTag)
{
	if (!AnimTag.IsValid())
	{
		return;
	}

	const FGameplayTag LayerParent = ExtractLayerParent(AnimTag);

	// 해당 레이어의 현재 태그가 이 태그이면 제거
	if (FGameplayTag* Current = Fragment.AnimLayerTags.Find(LayerParent))
	{
		if (Current->MatchesTagExact(AnimTag))
		{
			Fragment.AnimLayerTags.Remove(LayerParent);
		}
	}

	// FullBody는 AnimStateTag와 동기화
	if (LayerParent.MatchesTagExact(HktGameplayTags::Anim_FullBody) && Fragment.AnimStateTag.MatchesTagExact(AnimTag))
	{
		Fragment.AnimStateTag = FGameplayTag();
	}

	// CurrentAnimTag가 제거되는 태그이면 무효화 (선택 로직이 다음 우선순위로 폴백)
	if (Fragment.CurrentAnimTag.MatchesTagExact(AnimTag))
	{
		Fragment.CurrentAnimTag = FGameplayTag();
	}
}

void SyncStance(FHktSpriteAnimFragment& Fragment, FGameplayTag NewStance)
{
	if (Fragment.StanceTag == NewStance)
	{
		return;
	}
	Fragment.StanceTag = NewStance;
}

// ============================================================================
// 결과 해석
// ============================================================================

void ResolveRenderOutputs(const UHktSpriteAnimMappingAsset* Mapping, const FHktSpriteAnimFragment& Fragment,
	int64 FallbackAnimStartTick, FName& OutActionId, float& OutPlayRate, int64& OutAnimStartTick)
{
	FName BaseActionId = NAME_None;
	bool  bIsCombat    = false;
	FGameplayTag ActiveLayer;

	// 우선순위: Montage > UpperBody > FullBody > (기타 레이어 중 임의 하나) > Default
	static const FGameplayTag* kPriorityLayers[] = {
		&HktGameplayTags::Anim_Montage,
		&HktGameplayTags::Anim_UpperBody,
		&HktGameplayTags::Anim_FullBody,
	};

	bool bResolved = false;
	for (const FGameplayTag* LayerPtr : kPriorityLayers)
	{
		if (!LayerPtr) continue;
		if (const FGameplayTag* Found = Fragment.AnimLayerTags.Find(*LayerPtr))
		{
			if (Found->IsValid() && ResolveTagToAction(Mapping, *Found, BaseActionId, bIsCombat))
			{
				ActiveLayer = *LayerPtr;
				bResolved = true;
				break;
			}
		}
	}

	if (!bResolved)
	{
		for (const TPair<FGameplayTag, FGameplayTag>& Pair : Fragment.AnimLayerTags)
		{
			if (!Pair.Value.IsValid()) continue;
			if (ResolveTagToAction(Mapping, Pair.Value, BaseActionId, bIsCombat))
			{
				ActiveLayer = Pair.Key;
				bResolved = true;
				break;
			}
		}
	}

	if (!bResolved)
	{
		BaseActionId = Mapping ? Mapping->DefaultActionId : FName(TEXT("idle"));
		bIsCombat    = false;
		ActiveLayer  = FGameplayTag();
	}

	OutActionId = ApplyStanceOverride(Mapping, BaseActionId, Fragment.StanceTag);

	// Combat 액션은 AttackPlayRate 반영
	OutPlayRate = bIsCombat ? FMath::Max(Fragment.AttackPlayRate, 0.01f) : 1.0f;

	// Montage/UpperBody 오버라이드가 활성이면 내부 CurrentAnimStartTick을 사용(트리거 시점 기준).
	// FullBody 전환은 서버의 AnimStartTick을 권위값으로 사용(네트워크 동기 유지).
	const bool bUseLocalTick = ActiveLayer.IsValid()
		&& (ActiveLayer.MatchesTagExact(HktGameplayTags::Anim_Montage)
			|| ActiveLayer.MatchesTagExact(HktGameplayTags::Anim_UpperBody));
	OutAnimStartTick = bUseLocalTick ? Fragment.CurrentAnimStartTick : FallbackAnimStartTick;
}

FGameplayTag GetAnimLayerTag(const FHktSpriteAnimFragment& Fragment, const FGameplayTag& LayerTag)
{
	if (const FGameplayTag* Found = Fragment.AnimLayerTags.Find(LayerTag))
	{
		return *Found;
	}
	return FGameplayTag();
}

} // namespace HktSpriteAnimProcessor
