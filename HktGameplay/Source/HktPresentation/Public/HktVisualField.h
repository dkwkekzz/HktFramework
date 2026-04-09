// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

/**
 * THktVisualField<T> — Generation Counter 기반 변경 추적 필드
 * Set(Value, Frame) 후 IsDirty(CurrentFrame)으로 이번 프레임 변경 여부 판단.
 * 리셋 불필요: 다음 프레임에서 카운터만 올리면 이전 dirty는 자동 소멸.
 */
template<typename T>
struct THktVisualField
{
	T Value{};
	int64 LastModifiedFrame = 0;

	FORCEINLINE void Set(const T& InValue, int64 Frame)
	{
		Value = InValue;
		LastModifiedFrame = Frame;
	}

	FORCEINLINE bool IsDirty(int64 CurrentFrame) const
	{
		return LastModifiedFrame == CurrentFrame;
	}

	FORCEINLINE const T& Get() const { return Value; }
	FORCEINLINE operator const T&() const { return Value; }
};
