// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteAnimMappingAsset.h"
#include "HktSpriteCoreLog.h"

void UHktSpriteAnimMappingAsset::RegisterMapping(FGameplayTag AnimTag, FName ActionId, bool bIsCombat)
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

void UHktSpriteAnimMappingAsset::UnregisterMapping(FGameplayTag AnimTag)
{
	AnimMappings.RemoveAll([&AnimTag](const FHktSpriteAnimMappingEntry& Entry)
	{
		return Entry.AnimTag.MatchesTagExact(AnimTag);
	});
}
