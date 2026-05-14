// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPaperAnimationDataAsset.h"
#include "PaperFlipbook.h"  // TObjectPtr<UPaperFlipbook> StaticClass 참조

const FHktPaperAnimMeta* UHktPaperAnimationDataAsset::FindAnimation(const FGameplayTag& AnimTag) const
{
	if (!AnimTag.IsValid())
	{
		return nullptr;
	}
	return Animations.Find(AnimTag);
}

const FHktPaperAnimMeta* UHktPaperAnimationDataAsset::FindAnimationOrFallback(
	const FGameplayTag& AnimTag, FGameplayTag* OutResolvedTag) const
{
	if (const FHktPaperAnimMeta* Found = FindAnimation(AnimTag))
	{
		if (OutResolvedTag) { *OutResolvedTag = AnimTag; }
		return Found;
	}
	if (DefaultAnimTag.IsValid())
	{
		if (const FHktPaperAnimMeta* Default = Animations.Find(DefaultAnimTag))
		{
			if (OutResolvedTag) { *OutResolvedTag = DefaultAnimTag; }
			return Default;
		}
	}
	for (const TPair<FGameplayTag, FHktPaperAnimMeta>& Pair : Animations)
	{
		if (OutResolvedTag) { *OutResolvedTag = Pair.Key; }
		return &Pair.Value;
	}
	return nullptr;
}
