// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/Views/SListView.h"
#include "Widgets/Views/STreeView.h"
#include "GameplayTagContainer.h"
#include "HktCoreEventLog.h"

struct FHktLogEntry;

/** 카테고리 트리 노드: 태그 계층 구조를 UI 트리로 표현 */
struct FCategoryTreeNode
{
    /** 이 레벨의 표시 이름 (예: "Core", "Entity") */
    FString DisplayName;

    /** 이 노드에 대응하는 FGameplayTag (리프 노드는 실제 태그, 중간 노드는 Invalid 가능) */
    FGameplayTag Tag;

    /** 자식 노드 */
    TArray<TSharedPtr<FCategoryTreeNode>> Children;

    /** 이 노드 이하의 모든 리프 태그를 수집 */
    void GatherLeafTags(TArray<FGameplayTag>& OutTags) const
    {
        if (Children.Num() == 0 && Tag.IsValid())
        {
            OutTags.Add(Tag);
        }
        for (const auto& Child : Children)
        {
            Child->GatherLeafTags(OutTags);
        }
    }
};

/**
 * SHktGameplayLogPanel
 *
 * HktGameplay 이벤트 로그를 시간순으로 표시하는 디버그 패널.
 * FHktCoreEventLog 싱글톤을 통해 링 버퍼에서 이벤트를 읽어 표시.
 *
 * - 패널 열림/닫힘에 따라 로그 수집 자동 활성화/비활성화
 * - Category(FGameplayTag) 계층적 필터링: 트리뷰로 상위 태그 선택 시 하위 포함
 * - EntityId, EventTag, 텍스트 필터 지원
 * - 자동 스크롤 (하단 고정)
 */
class HKTINSIGHTS_API SHktGameplayLogPanel : public SCompoundWidget
{
public:
    SLATE_BEGIN_ARGS(SHktGameplayLogPanel) {}
    SLATE_END_ARGS()

    void Construct(const FArguments& InArgs);
    virtual ~SHktGameplayLogPanel() override;

private:
    /** 새 로그 엔트리 폴링 및 필터 적용 */
    void PollNewEntries();

    /** 필터 조건에 매칭되는지 확인 */
    bool PassesFilter(const FHktLogEntry& Entry) const;

    /** 필터링된 행 목록 재구성 */
    void RebuildFilteredRows();

    /** 카테고리 트리 재구성 (KnownCategories → 트리 노드) */
    void RebuildCategoryTree();

    /** STreeView 행 생성 콜백 */
    TSharedRef<ITableRow> OnGenerateCategoryRow(TSharedPtr<FCategoryTreeNode> Item,
                                                 const TSharedRef<STableViewBase>& OwnerTable);

    /** STreeView 자식 노드 콜백 */
    void OnGetCategoryChildren(TSharedPtr<FCategoryTreeNode> Item,
                                TArray<TSharedPtr<FCategoryTreeNode>>& OutChildren);

    /** 노드의 체크 상태 계산 (자식 포함 계층적 판단) */
    ECheckBoxState GetNodeCheckState(TSharedPtr<FCategoryTreeNode> Node) const;

    /** 노드 체크 상태 토글 (자식 포함 재귀적 적용) */
    void ToggleNodeCheckState(TSharedPtr<FCategoryTreeNode> Node, ECheckBoxState NewState);

    /** SListView 행 생성 콜백 */
    TSharedRef<ITableRow> OnGenerateRow(TSharedPtr<FHktLogEntry> Item,
                                         const TSharedRef<STableViewBase>& OwnerTable);

    /** 카테고리별 색상 */
    static FSlateColor GetCategoryColor(const FGameplayTag& Category);

    /** FGameplayTag에서 "HktLog." 접두사 제거 후 표시용 문자열 반환 */
    static FString GetCategoryDisplayName(const FGameplayTag& Category);

    // ── 데이터 ──

    /** 필터를 통과한 전체 로그 (표시용) */
    TArray<TSharedPtr<FHktLogEntry>> FilteredRows;

    /** 필터를 통과하지 않은 것 포함 전체 로그 (필터 변경 시 재적용용) */
    TArray<TSharedPtr<FHktLogEntry>> AllRows;

    /** 리스트뷰 */
    TSharedPtr<SListView<TSharedPtr<FHktLogEntry>>> ListView;

    /** 카테고리 트리뷰 */
    TSharedPtr<STreeView<TSharedPtr<FCategoryTreeNode>>> CategoryTreeView;

    /** 카테고리 트리 루트 노드 */
    TArray<TSharedPtr<FCategoryTreeNode>> CategoryRootNodes;

    /** All/None 버튼 + 트리뷰를 담는 컨테이너 */
    TSharedPtr<SVerticalBox> CategoryContainer;

    /** 로그 카운트 텍스트 */
    TSharedPtr<STextBlock> LogCountText;

    // ── 필터 상태 ──
    FString FilterText;
    FString EntityIdFilterText;             // 쉼표 구분 엔티티 ID
    TSet<int32> EntityIdFilter;             // 파싱된 엔티티 ID 셋
    FGameplayTagContainer EnabledCategories;  // 활성화된 카테고리 태그
    FGameplayTagContainer KnownCategories;    // 지금까지 본 카테고리 태그

    // ── LogLevel 필터 ──
    EHktLogLevel MinLogLevel = EHktLogLevel::Verbose;  // 이 레벨 이상만 표시

    // ── Source 필터 (클라/서버 분리) ──
    bool bShowServer = true;
    bool bShowClient = true;

    // ── 폴링 상태 ──
    uint32 ReadIndex = 0;
    uint32 CachedVersion = 0;
    bool bAutoScroll = true;
    double StartTime = 0.0;           // 패널 시작 시간 (상대 시간 표시용)
};
