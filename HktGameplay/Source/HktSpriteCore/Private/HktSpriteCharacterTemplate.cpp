// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteCharacterTemplate.h"

const FHktSpriteAnimation* UHktSpriteCharacterTemplate::FindAnimation(const FGameplayTag& AnimTag) const
{
	if (!AnimTag.IsValid()) return nullptr;
	return Animations.Find(AnimTag);
}

const FHktSpriteAnimation* UHktSpriteCharacterTemplate::FindAnimationOrFallback(const FGameplayTag& AnimTag) const
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
	// 맵의 임의 첫 원소 — 비었으면 nullptr.
	for (const TPair<FGameplayTag, FHktSpriteAnimation>& Pair : Animations)
	{
		return &Pair.Value;
	}
	return nullptr;
}
