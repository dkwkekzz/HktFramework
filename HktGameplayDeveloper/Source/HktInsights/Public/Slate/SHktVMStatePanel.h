// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/Views/SListView.h"

class STextBlock;
class SVerticalBox;

/** Entity 행: WorldState의 전체 entity + VM 요약 (stable pointer, in-place 갱신) */
struct FHktVMEntityRow
{
    FString EntityKey;     // "E_1"
    FString DebugName;     // "Goblin" (WorldState에서)
    FString Archetype;     // "Character" (WorldState에서)
    int32 VMCount = 0;
    FString VMNames;       // "Attack,Move"
};

/** VM 행: 개별 VM의 모든 프로퍼티 (stable pointer, Props만 in-place 갱신) */
struct FHktVMRow
{
    FString VMKey;         // "VM_0"
    FString EntityKey;     // "E_1" (Src 필드에서 파싱)
    TMap<FString, FString> Props;
};

/**
 * SHktVMStatePanel
 *
 * 전체 Entity 목록에서 선택한 entity의 VM 상태를 상세히 표시하는 3-pane 뷰어.
 * - 좌: Entity 리스트 (WorldState 전체 entity, VM 개수 표시)
 * - 우: 선택된 entity의 VM 목록
 * - 하: 선택된 VM의 상세 정보 (TAttribute 람다로 실시간 갱신)
 *
 * Entity/VM 행은 stable pointer를 유지하고 값만 in-place 갱신하여 깜빡임 방지.
 */
class HKTINSIGHTS_API SHktVMStatePanel : public SCompoundWidget
{
public:
    SLATE_BEGIN_ARGS(SHktVMStatePanel) {}
    SLATE_END_ARGS()

    void Construct(const FArguments& InArgs);
    virtual ~SHktVMStatePanel();

private:
    void RebuildSourceOptions();
    void RefreshData();
    void RebuildFilteredEntityRows();
    void RebuildVMList();
    void BuildDetailPanel();

    // Entity 리스트 콜백
    TSharedRef<ITableRow> OnGenerateEntityRow(TSharedPtr<FHktVMEntityRow> Item, const TSharedRef<STableViewBase>& OwnerTable);
    // VM 리스트 콜백
    TSharedRef<ITableRow> OnGenerateVMRow(TSharedPtr<FHktVMRow> Item, const TSharedRef<STableViewBase>& OwnerTable);

    // Source 선택
    TArray<TSharedPtr<FString>> SourceOptions;
    FString SelectedSource;

    // Entity 데이터 (stable pointer)
    TMap<FString, TSharedPtr<FHktVMEntityRow>> EntityRowMap;
    TArray<TSharedPtr<FHktVMEntityRow>> AllEntityRows;
    TArray<TSharedPtr<FHktVMEntityRow>> FilteredEntityRows;
    TSharedPtr<SListView<TSharedPtr<FHktVMEntityRow>>> EntityListView;
    FString SelectedEntityKey;
    FString FilterText;

    // VM 데이터 (stable pointer)
    TMap<FString, TSharedPtr<FHktVMRow>> VMRowMap;
    TArray<TSharedPtr<FHktVMRow>> AllVMRows;
    TArray<TSharedPtr<FHktVMRow>> FilteredVMRows;
    TSharedPtr<SListView<TSharedPtr<FHktVMRow>>> VMListView;
    FString SelectedVMKey;

    // 상세 패널
    TSharedPtr<SVerticalBox> DetailContainer;
    FString DetailBoundVMKey;  // 현재 Detail에 바인딩된 VM

    // 요약 텍스트
    TSharedPtr<STextBlock> SummaryText;

    // 폴링
    uint32 CachedVersion = 0;
};
