// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktHISMSpriteAnimationDataAsset.h"

const FHktSpriteAnimation* UHktHISMSpriteAnimationDataAsset::FindAnimation(const FGameplayTag& AnimTag) const
{
	if (!AnimTag.IsValid()) return nullptr;
	return Animations.Find(AnimTag);
}

const FHktSpriteAnimation* UHktHISMSpriteAnimationDataAsset::FindAnimationOrFallback(const FGameplayTag& AnimTag) const
{
	if (const FHktSpriteAnimation* Found = FindAnimation(AnimTag))
	{
		return Found;
	}
	if (DefaultAnimTag.IsValid())
	{
		if (const FHktSpriteAnimation* Default = Animations.Find(DefaultAnimTag))
		{
			return Default;
		}
	}
	for (const TPair<FGameplayTag, FHktSpriteAnimation>& Pair : Animations)
	{
		return &Pair.Value;
	}
	return nullptr;
}
