// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Slate/SHktRuntimeInsightsPanel.h"
#include "Slate/SHktInsightTable.h"
#include "HktCoreDataCollector.h"
#include "Widgets/Text/STextBlock.h"

#define LOCTEXT_NAMESPACE "HktRuntimeInsightsPanel"

void SHktRuntimeInsightsPanel::Construct(const FArguments& InArgs)
{
    ChildSlot
    [
        SNew(SVerticalBox)
        + SVerticalBox::Slot()
        .AutoHeight()
        .Padding(4.f)
        [
            SNew(STextBlock)
            .Text(LOCTEXT("RuntimeTitle", "Runtime Insights"))
            .Font(FCoreStyle::GetDefaultFontStyle("Bold", 14))
        ]
        + SVerticalBox::Slot()
        .FillHeight(1.0f)
        [
            SAssignNew(TabContainer, SVerticalBox)
        ]
    ];

    CachedVersion = FHktCoreDataCollector::Get().GetVersion();
    RebuildTables();
    RefreshData();

    // 0.1초 간격으로 Version 직접 폴링 — 서브시스템 의존 없음
    RegisterActiveTimer(0.1f, FWidgetActiveTimerDelegate::CreateLambda(
        [this](double, float) -> EActiveTimerReturnType
        {
            const uint32 CurrentVersion = FHktCoreDataCollector::Get().GetVersion();
            if (CurrentVersion != CachedVersion)
            {
                CachedVersion = CurrentVersion;
                RebuildTables();
                RefreshData();
            }
            return EActiveTimerReturnType::Continue;
        }));
}

void SHktRuntimeInsightsPanel::RebuildTables()
{
    TArray<FString> AllCategories = FHktCoreDataCollector::Get().GetCategories();
    TArray<FString> RuntimeCategories;
    for (const FString& Cat : AllCategories)
    {
        if (Cat.StartsWith(TEXT("Runtime.")))
        {
            RuntimeCategories.Add(Cat);
        }
    }
    RuntimeCategories.Sort();

    // 카테고리 변경 여부 확인
    bool bChanged = RuntimeCategories.Num() != Tabs.Num();
    if (!bChanged)
    {
        for (int32 i = 0; i < RuntimeCategories.Num(); ++i)
        {
            if (Tabs[i].Category != RuntimeCategories[i]) { bChanged = true; break; }
        }
    }

    if (!bChanged) return;

    // 컨테이너 초기화 및 재구성
    TabContainer->ClearChildren();
    Tabs.Reset();

    for (const FString& Cat : RuntimeCategories)
    {
        FString ShortName = Cat.Mid(8); // "Runtime." 이후

        FRuntimeTab Tab;
        Tab.Category = Cat;

        TabContainer->AddSlot()
        .FillHeight(1.0f)
        .Padding(2.f)
        [
            SAssignNew(Tab.Table, SHktInsightTable)
            .Title(FText::FromString(ShortName))
        ];

        Tabs.Add(MoveTemp(Tab));
    }
}

void SHktRuntimeInsightsPanel::RefreshData()
{
    for (FRuntimeTab& Tab : Tabs)
    {
        TArray<TPair<FString, FString>> Entries = FHktCoreDataCollector::Get().GetEntries(Tab.Category);
        Tab.Table->SetData(Entries);
    }
}

#undef LOCTEXT_NAMESPACE
