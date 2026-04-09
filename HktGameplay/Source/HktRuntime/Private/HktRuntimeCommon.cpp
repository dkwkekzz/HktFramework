// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktRuntimeCommon.h"

int32 HktRuntimeCommon::HashCombineHelper(int64 A, int32 B)
{
    return (int32)(A * 2654435761) ^ B;
}