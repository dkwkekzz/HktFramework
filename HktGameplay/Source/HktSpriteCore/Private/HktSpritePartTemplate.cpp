// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpritePartTemplate.h"

const FHktSpriteAction* UHktSpritePartTemplate::FindAction(const FGameplayTag& AnimTag) const
{
	if (!AnimTag.IsValid()) return nullptr;
	for (const FHktSpriteAction& Action : Actions)
	{
		if (Action.AnimTag.MatchesTagExact(AnimTag))
		{
			return &Action;
		}
	}
	return nullptr;
}

const FHktSpriteAction* UHktSpritePartTemplate::FindActionOrFallback(const FGameplayTag& AnimTag) const
{
	if (const FHktSpriteAction* Found = FindAction(AnimTag))
	{
		return Found;
	}
	if (DefaultAnimTag.IsValid())
	{
		if (const FHktSpriteAction* Default = FindAction(DefaultAnimTag))
		{
			return Default;
		}
	}
	return Actions.Num() > 0 ? &Actions[0] : nullptr;
}
