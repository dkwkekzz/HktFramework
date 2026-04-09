// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/Views/SListView.h"
#include "Widgets/Views/SHeaderRow.h"
#include "HktCoreProperties.h"

/**
 * FHktWorldStateEntityRow - 엔티티 행 데이터 (안정적 포인터, Props만 in-place 갱신)
 */
struct FHktWorldStateEntityRow
{
    FString EntityKey;                   // "E_0", "E_1", ...
    TMap<FString, FString> Props;        // PropertyName → Value (매 틱 갱신)
};

/**
 * SHktWorldStatePanel
 *
 * 상단: 엔티티 목록 (Entity/Owner 고정 컬럼) — 추가/삭제 시에만 테이블 변경
 * 하단: 선택 엔티티 상세 — 위젯 1회 생성, TAttribute 람다로 값만 실시간 갱신
 */
class HKTINSIGHTS_API SHktWorldStatePanel : public SCompoundWidget
{
public:
    SLATE_BEGIN_ARGS(SHktWorldStatePanel) {}
    SLATE_END_ARGS()

    void Construct(const FArguments& InArgs);

private:
    void RefreshData();
    void RebuildSourceOptions();
    void RebuildFilteredRows();
    void BuildDetailPanel();

    TSharedRef<ITableRow> OnGenerateRow(
        TSharedPtr<FHktWorldStateEntityRow> Item,
        const TSharedRef<STableViewBase>& OwnerTable);

    // Source 선택
    TArray<TSharedPtr<FString>> SourceOptions;
    FString SelectedSource;

    // 메타 정보
    TSharedPtr<STextBlock> FrameText;
    TSharedPtr<STextBlock> EntityCountText;

    // 상단: 엔티티 목록
    TSharedPtr<SListView<TSharedPtr<FHktWorldStateEntityRow>>> ListView;
    TArray<TSharedPtr<FHktWorldStateEntityRow>> AllRows;
    TArray<TSharedPtr<FHktWorldStateEntityRow>> FilteredRows;
    TMap<FString, TSharedPtr<FHktWorldStateEntityRow>> EntityRowMap;  // 안정적 포인터 유지
    FString FilterText;

    // 하단: 선택 상세
    FString SelectedEntityKey;
    TSharedPtr<SVerticalBox> DetailContainer;
    TArray<FString> HotPropertyNames;    // Hot Tier 프로퍼티 (ID 순)
    TArray<FString> ColdPropertyNames;   // Cold Tier 프로퍼티 (ID 순)

    uint32 CachedVersion = 0;
};
