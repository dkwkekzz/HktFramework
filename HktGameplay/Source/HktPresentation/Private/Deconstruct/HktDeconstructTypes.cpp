// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Deconstruct/HktDeconstructTypes.h"
#include "HktVFXIntent.h"

EHktDeconstructElement HktMapVFXElementToDeconstruct(EHktVFXElement InElement)
{
	switch (InElement)
	{
	case EHktVFXElement::Fire:      return EHktDeconstructElement::Fire;
	case EHktVFXElement::Ice:       return EHktDeconstructElement::Ice;
	case EHktVFXElement::Lightning: return EHktDeconstructElement::Lightning;
	case EHktVFXElement::Dark:      return EHktDeconstructElement::Void;
	case EHktVFXElement::Nature:    return EHktDeconstructElement::Nature;

	// 나머지 Element는 가장 가까운 Deconstruct Element로 fallback
	case EHktVFXElement::Water:     return EHktDeconstructElement::Ice;
	case EHktVFXElement::Earth:     return EHktDeconstructElement::Nature;
	case EHktVFXElement::Wind:      return EHktDeconstructElement::Lightning;
	case EHktVFXElement::Holy:      return EHktDeconstructElement::Lightning;
	case EHktVFXElement::Poison:    return EHktDeconstructElement::Void;
	case EHktVFXElement::Arcane:    return EHktDeconstructElement::Void;
	case EHktVFXElement::Physical:  return EHktDeconstructElement::Fire;
	default:                        return EHktDeconstructElement::Fire;
	}
}
