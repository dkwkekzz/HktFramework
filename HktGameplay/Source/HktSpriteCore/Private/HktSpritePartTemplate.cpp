// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpritePartTemplate.h"

const FHktSpriteAction* UHktSpritePartTemplate::FindAction(FName ActionId) const
{
	return Actions.Find(ActionId);
}
