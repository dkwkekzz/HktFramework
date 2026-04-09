// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Widgets/SWidget.h"

/**
 * 실제 화면에 그려지는 UI 구현체(Slate, UMG)를 감싸는 인터페이스.
 * Slate 위젯을 TSharedRef로 관리할 때 사용합니다.
 */
class HKTUI_API IHktUIView
{
public:
	virtual ~IHktUIView() = default;

	/** 실제 Slate 위젯 반환 (필수) */
	virtual TSharedRef<SWidget> GetSlateWidget() const = 0;

	/** 가시성 제어 */
	virtual void SetVisibility(EVisibility InVisibility) = 0;

	/** 렌더 불투명도 (0~1) */
	virtual void SetRenderOpacity(float InOpacity) = 0;
};
