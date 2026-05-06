// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/Views/SListView.h"
#include "Widgets/Views/SHeaderRow.h"

/**
 * FHktViewModelEntityRow - 엔티티 행 데이터 (안정적 포인터, Props만 in-place 갱신)
 *
 * Props 의 키는 "View.Field" 형식 (예: "Transform.Location", "Vitals.Health").
 * 더티 표시는 Publisher 측에서 값 prefix '*' 로 인코딩 (예: "*123.4") — 패널이 분리하여 하이라이트.
 */
struct FHktViewModelEntityRow
{
    FString EntityKey;                   // "E_0", "E_1", ...
    TMap<FString, FString> Props;        // "View.Field" → "Value" (또는 "*Value" 더티)
};

/**
 * SHktViewModelStatePanel
 *
 * HktPresentation의 FHktPresentationState (ViewModel) 를 실시간으로 시각화한다.
 * 데이터는 FHktCoreDataCollector 의 "Presentation.<Source>" 카테고리에서 폴링.
 *
 * 상단: 엔티티 목록 (Entity / RenderCategory / SpawnedFrame)
 * 하단: 선택 엔티티 상세 — View 그룹별(Transform, Vitals, Combat, ...) 섹션
 */
class HKTINSIGHTS_API SHktViewModelStatePanel : public SCompoundWidget
{
public:
    SLATE_BEGIN_ARGS(SHktViewModelStatePanel) {}
    SLATE_END_ARGS()

    void Construct(const FArguments& InArgs);

private:
    void RefreshData();
    void RebuildSourceOptions();
    void RebuildFilteredRows();
    void BuildDetailPanel();

    TSharedRef<ITableRow> OnGenerateRow(
        TSharedPtr<FHktViewModelEntityRow> Item,
        const TSharedRef<STableViewBase>& OwnerTable);

    // Source 선택 (Server / Client / Standalone)
    TArray<TSharedPtr<FString>> SourceOptions;
    FString SelectedSource;

    // 메타 정보
    TSharedPtr<STextBlock> FrameText;
    TSharedPtr<STextBlock> EntityCountText;
    TSharedPtr<STextBlock> DirtyCountText;

    // 상단: 엔티티 목록
    TSharedPtr<SListView<TSharedPtr<FHktViewModelEntityRow>>> ListView;
    TArray<TSharedPtr<FHktViewModelEntityRow>> AllRows;
    TArray<TSharedPtr<FHktViewModelEntityRow>> FilteredRows;
    TMap<FString, TSharedPtr<FHktViewModelEntityRow>> EntityRowMap;
    FString FilterText;

    // 하단: 선택 상세
    FString SelectedEntityKey;
    TSharedPtr<SVerticalBox> DetailContainer;

    // View 그룹 → 그 안에 속한 PropertyName(전체키 "Transform.Location") 리스트
    // 그룹 이름은 "Transform", "Vitals", "Combat", ... ("Meta" 는 헤더로 별도 표시)
    TArray<FString> ViewGroupOrder;                          // 발견 순서 유지
    TMap<FString, TArray<FString>> ViewGroupToPropNames;

    uint32 CachedVersion = 0;
};
