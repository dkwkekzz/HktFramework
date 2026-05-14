// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/Views/SListView.h"
#include "HktVMEventRecorder.h"

class STextBlock;

/**
 * SHktVMEventPanel
 *
 * VM 이벤트 3종(FHktEvent / FHktPendingEvent / FHktPhysicsEvent) 의 생성·소비·폐기
 * 라이프사이클을 실시간 표시하는 디버그 패널.
 *
 * - FHktVMEventRecorder 싱글톤에서 폴링 (링버퍼)
 * - Kind/Phase/Source 필터, 텍스트 검색, EntityId 필터
 * - 녹화 (Start/Stop) → JSON 저장/불러오기
 * - 자동 스크롤
 */
class HKTINSIGHTS_API SHktVMEventPanel : public SCompoundWidget
{
public:
    SLATE_BEGIN_ARGS(SHktVMEventPanel) {}
    SLATE_END_ARGS()

    void Construct(const FArguments& InArgs);
    virtual ~SHktVMEventPanel() override;

    virtual FReply OnKeyDown(const FGeometry& MyGeometry, const FKeyEvent& InKeyEvent) override;

private:
    /** 새 레코드 폴링 후 필터 적용 */
    void PollNewRecords();

    /** 필터 통과 여부 */
    bool PassesFilter(const FHktVMEventRecord& Rec) const;

    /** 필터링된 표시 행 재구성 */
    void RebuildFilteredRows();

    /** 선택된 행을 클립보드에 복사 */
    void CopySelectedToClipboard();

    /** 단일 레코드를 한 줄 텍스트로 포맷 */
    static FString FormatRecordForCopy(const FHktVMEventRecord& Rec);

    /** SListView 행 생성 콜백 */
    TSharedRef<ITableRow> OnGenerateRow(TSharedPtr<FHktVMEventRecord> Item,
                                        const TSharedRef<STableViewBase>& OwnerTable);

    // 표시 상태
    TSharedPtr<SListView<TSharedPtr<FHktVMEventRecord>>> ListView;
    TArray<TSharedPtr<FHktVMEventRecord>> AllRows;
    TArray<TSharedPtr<FHktVMEventRecord>> FilteredRows;
    TSharedPtr<STextBlock> StatusText;

    // 필터
    FString FilterText;
    FString EntityIdFilterText;
    TSet<int32> EntityIdFilter;

    bool bShowEvent = true;
    bool bShowPending = true;
    bool bShowPhysics = true;

    bool bShowCreated = true;
    bool bShowConsumed = true;
    bool bShowDiscarded = true;

    bool bShowServer = true;
    bool bShowClient = true;

    bool bAutoScroll = true;
    uint32 ReadIndex = 0;
    uint32 CachedVersion = 0;

    double StartTime = 0.0;
};
