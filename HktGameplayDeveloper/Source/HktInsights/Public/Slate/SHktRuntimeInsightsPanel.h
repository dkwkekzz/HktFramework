// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"

class SHktInsightTable;

/**
 * SHktRuntimeInsightsPanel
 *
 * "Runtime.*" 카테고리 데이터를 탭 형태로 표시.
 * Runtime.Server / Runtime.Client / Runtime.ProxySimulator 등
 * 카테고리별 SHktInsightTable을 탭으로 나열.
 * FHktCoreDataCollector Version을 직접 폴링하여 실시간 갱신.
 */
class HKTINSIGHTS_API SHktRuntimeInsightsPanel : public SCompoundWidget
{
public:
    SLATE_BEGIN_ARGS(SHktRuntimeInsightsPanel) {}
    SLATE_END_ARGS()

    void Construct(const FArguments& InArgs);

private:
    void RefreshData();
    void RebuildTables();

    /** 카테고리별 테이블 위젯 */
    struct FRuntimeTab
    {
        FString Category;
        TSharedPtr<SHktInsightTable> Table;
    };
    TArray<FRuntimeTab> Tabs;

    TSharedPtr<SVerticalBox> TabContainer;
    uint32 CachedVersion = 0;
};
