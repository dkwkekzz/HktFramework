// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Slate/SHktGameplayLogPanel.h"
#include "Widgets/Input/SCheckBox.h"
#include "Widgets/Input/SSearchBox.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Layout/SSplitter.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Input/SButton.h"

#define LOCTEXT_NAMESPACE "HktGameplayLogPanel"

// ── 컬러 팔레트 ──
namespace LogColors
{
    static const FLinearColor Time(0.5f, 0.5f, 0.55f);
    static const FLinearColor Frame(0.6f, 0.6f, 0.65f);
    static const FLinearColor Entity(0.4f, 0.85f, 1.0f);
    static const FLinearColor Message(0.88f, 0.88f, 0.88f);
    static const FLinearColor Dim(0.4f, 0.4f, 0.4f);

    // 카테고리별 색상
    static const FLinearColor CatCoreEntity(0.3f, 0.9f, 0.5f);
    static const FLinearColor CatCoreVM(0.9f, 0.7f, 0.3f);
    static const FLinearColor CatCoreStory(0.8f, 0.5f, 0.9f);
    static const FLinearColor CatRuntimeServer(1.0f, 0.5f, 0.3f);
    static const FLinearColor CatRuntimeClient(0.3f, 0.8f, 0.8f);
    static const FLinearColor CatRuntimeIntent(0.9f, 0.9f, 0.3f);
    static const FLinearColor CatPresentation(0.6f, 0.8f, 0.4f);
    static const FLinearColor CatAsset(0.3f, 0.7f, 0.9f);
    static const FLinearColor CatRule(0.9f, 0.4f, 0.6f);
    static const FLinearColor CatStory(0.7f, 0.5f, 1.0f);
    static const FLinearColor CatUI(0.95f, 0.75f, 0.5f);
    static const FLinearColor CatVFX(0.5f, 0.95f, 0.9f);
    static const FLinearColor CatDefault(0.7f, 0.7f, 0.7f);

    // LogLevel별 색상
    static const FLinearColor LevelVerbose(0.55f, 0.55f, 0.55f);
    static const FLinearColor LevelInfo(0.7f, 0.85f, 1.0f);
    static const FLinearColor LevelWarning(1.0f, 0.85f, 0.3f);
    static const FLinearColor LevelError(1.0f, 0.35f, 0.3f);

    // Source별 색상
    static const FLinearColor SourceServer(1.0f, 0.6f, 0.3f);
    static const FLinearColor SourceClient(0.3f, 0.85f, 0.85f);
}

static FLinearColor GetLogLevelColor(EHktLogLevel Level)
{
    switch (Level)
    {
    case EHktLogLevel::Verbose: return LogColors::LevelVerbose;
    case EHktLogLevel::Info:    return LogColors::LevelInfo;
    case EHktLogLevel::Warning: return LogColors::LevelWarning;
    case EHktLogLevel::Error:   return LogColors::LevelError;
    default:                    return LogColors::LevelInfo;
    }
}

static FLinearColor GetLogSourceColor(EHktLogSource Source)
{
    switch (Source)
    {
    case EHktLogSource::Server: return LogColors::SourceServer;
    case EHktLogSource::Client: return LogColors::SourceClient;
    default:                    return LogColors::SourceServer;
    }
}

// ============================================================================
// Construct
// ============================================================================

void SHktGameplayLogPanel::Construct(const FArguments& InArgs)
{
    StartTime = FPlatformTime::Seconds();

    ChildSlot
    [
        SNew(SVerticalBox)

        // ── 헤더 바: Active 토글 + Clear + 로그 수 ──
        + SVerticalBox::Slot()
        .AutoHeight()
        .Padding(4.f)
        [
            SNew(SHorizontalBox)

            // Active 토글
            + SHorizontalBox::Slot()
            .AutoWidth()
            .VAlign(VAlign_Center)
            .Padding(0, 0, 8, 0)
            [
                SNew(SCheckBox)
                .IsChecked_Lambda([]() -> ECheckBoxState
                {
                    return FHktCoreEventLog::Get().IsActive() ? ECheckBoxState::Checked : ECheckBoxState::Unchecked;
                })
                .OnCheckStateChanged_Lambda([](ECheckBoxState NewState)
                {
                    FHktCoreEventLog::Get().SetActive(NewState == ECheckBoxState::Checked);
                })
                [
                    SNew(STextBlock)
                    .Text(LOCTEXT("ActiveLabel", "Active"))
                    .Font(FCoreStyle::GetDefaultFontStyle("Bold", 10))
                ]
            ]

            // Clear 버튼
            + SHorizontalBox::Slot()
            .AutoWidth()
            .VAlign(VAlign_Center)
            .Padding(0, 0, 8, 0)
            [
                SNew(SButton)
                .OnClicked_Lambda([this]() -> FReply
                {
                    FHktCoreEventLog::Get().Clear();
                    AllRows.Reset();
                    FilteredRows.Reset();
                    KnownCategories.Reset();
                    EnabledCategories.Reset();
                    ReadIndex = 0;
                    RebuildCategoryTree();
                    ListView->RequestListRefresh();
                    return FReply::Handled();
                })
                [ SNew(STextBlock).Text(LOCTEXT("ClearBtn", "Clear")) ]
            ]

            // Dump to File 버튼
            + SHorizontalBox::Slot()
            .AutoWidth()
            .VAlign(VAlign_Center)
            .Padding(0, 0, 8, 0)
            [
                SNew(SButton)
                .OnClicked_Lambda([this]() -> FReply
                {
                    const FString Path = FHktCoreEventLog::Get().DumpToFile();
                    if (!Path.IsEmpty())
                    {
                        LogCountText->SetText(FText::FromString(
                            FString::Printf(TEXT("Dumped %d entries -> %s"), AllRows.Num(), *Path)));
                    }
                    else
                    {
                        LogCountText->SetText(LOCTEXT("DumpFailed", "Dump failed: no entries or write error"));
                    }
                    return FReply::Handled();
                })
                [ SNew(STextBlock).Text(LOCTEXT("DumpBtn", "Dump to File")) ]
            ]

            // AutoScroll 토글
            + SHorizontalBox::Slot()
            .AutoWidth()
            .VAlign(VAlign_Center)
            .Padding(0, 0, 12, 0)
            [
                SNew(SCheckBox)
                .IsChecked_Lambda([this]() -> ECheckBoxState
                {
                    return bAutoScroll ? ECheckBoxState::Checked : ECheckBoxState::Unchecked;
                })
                .OnCheckStateChanged_Lambda([this](ECheckBoxState NewState)
                {
                    bAutoScroll = (NewState == ECheckBoxState::Checked);
                })
                [
                    SNew(STextBlock)
                    .Text(LOCTEXT("AutoScrollLabel", "Auto-scroll"))
                ]
            ]

            // ── Source 필터 (클라/서버 분리) ──
            + SHorizontalBox::Slot()
            .AutoWidth()
            .VAlign(VAlign_Center)
            .Padding(0, 0, 4, 0)
            [
                SNew(SCheckBox)
                .IsChecked_Lambda([this]() { return bShowServer ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
                .OnCheckStateChanged_Lambda([this](ECheckBoxState S) { bShowServer = (S == ECheckBoxState::Checked); RebuildFilteredRows(); })
                [
                    SNew(STextBlock)
                    .Text(LOCTEXT("ServerLabel", "Server"))
                    .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                    .ColorAndOpacity(FSlateColor(LogColors::SourceServer))
                ]
            ]
            + SHorizontalBox::Slot()
            .AutoWidth()
            .VAlign(VAlign_Center)
            .Padding(0, 0, 8, 0)
            [
                SNew(SCheckBox)
                .IsChecked_Lambda([this]() { return bShowClient ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
                .OnCheckStateChanged_Lambda([this](ECheckBoxState S) { bShowClient = (S == ECheckBoxState::Checked); RebuildFilteredRows(); })
                [
                    SNew(STextBlock)
                    .Text(LOCTEXT("ClientLabel", "Client"))
                    .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                    .ColorAndOpacity(FSlateColor(LogColors::SourceClient))
                ]
            ]

            // ── LogLevel 최소 레벨 ──
            + SHorizontalBox::Slot()
            .AutoWidth()
            .VAlign(VAlign_Center)
            .Padding(0, 0, 4, 0)
            [
                SNew(STextBlock)
                .Text(LOCTEXT("LevelLabel", "Level:"))
                .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                .ColorAndOpacity(FSlateColor(LogColors::Dim))
            ]
            + SHorizontalBox::Slot()
            .AutoWidth()
            .VAlign(VAlign_Center)
            .Padding(0, 0, 4, 0)
            [
                SNew(SButton)
                .OnClicked_Lambda([this]() -> FReply { MinLogLevel = EHktLogLevel::Verbose; RebuildFilteredRows(); return FReply::Handled(); })
                [ SNew(STextBlock).Text(LOCTEXT("VrbBtn", "VRB")).Font(FCoreStyle::GetDefaultFontStyle("Regular", 8)).ColorAndOpacity(FSlateColor(LogColors::LevelVerbose)) ]
            ]
            + SHorizontalBox::Slot()
            .AutoWidth()
            .VAlign(VAlign_Center)
            .Padding(0, 0, 4, 0)
            [
                SNew(SButton)
                .OnClicked_Lambda([this]() -> FReply { MinLogLevel = EHktLogLevel::Info; RebuildFilteredRows(); return FReply::Handled(); })
                [ SNew(STextBlock).Text(LOCTEXT("InfBtn", "INF")).Font(FCoreStyle::GetDefaultFontStyle("Regular", 8)).ColorAndOpacity(FSlateColor(LogColors::LevelInfo)) ]
            ]
            + SHorizontalBox::Slot()
            .AutoWidth()
            .VAlign(VAlign_Center)
            .Padding(0, 0, 4, 0)
            [
                SNew(SButton)
                .OnClicked_Lambda([this]() -> FReply { MinLogLevel = EHktLogLevel::Warning; RebuildFilteredRows(); return FReply::Handled(); })
                [ SNew(STextBlock).Text(LOCTEXT("WrnBtn", "WRN")).Font(FCoreStyle::GetDefaultFontStyle("Regular", 8)).ColorAndOpacity(FSlateColor(LogColors::LevelWarning)) ]
            ]
            + SHorizontalBox::Slot()
            .AutoWidth()
            .VAlign(VAlign_Center)
            .Padding(0, 0, 12, 0)
            [
                SNew(SButton)
                .OnClicked_Lambda([this]() -> FReply { MinLogLevel = EHktLogLevel::Error; RebuildFilteredRows(); return FReply::Handled(); })
                [ SNew(STextBlock).Text(LOCTEXT("ErrBtn", "ERR")).Font(FCoreStyle::GetDefaultFontStyle("Regular", 8)).ColorAndOpacity(FSlateColor(LogColors::LevelError)) ]
            ]

            // 로그 수
            + SHorizontalBox::Slot()
            .FillWidth(1.0f)
            .VAlign(VAlign_Center)
            [
                SAssignNew(LogCountText, STextBlock)
                .Font(FCoreStyle::GetDefaultFontStyle("Regular", 9))
                .ColorAndOpacity(FSlateColor(LogColors::Dim))
            ]
        ]

        // ── 필터 바 ──
        + SVerticalBox::Slot()
        .AutoHeight()
        .Padding(4, 0, 4, 4)
        [
            SNew(SHorizontalBox)

            // 텍스트 검색
            + SHorizontalBox::Slot()
            .FillWidth(1.0f)
            .Padding(0, 0, 4, 0)
            [
                SNew(SSearchBox)
                .HintText(LOCTEXT("SearchHint", "Filter messages..."))
                .OnTextChanged_Lambda([this](const FText& Text)
                {
                    FilterText = Text.ToString();
                    RebuildFilteredRows();
                })
            ]

            // Entity ID 필터
            + SHorizontalBox::Slot()
            .AutoWidth()
            .Padding(0, 0, 4, 0)
            [
                SNew(SBox)
                .MinDesiredWidth(150.f)
                [
                    SNew(SSearchBox)
                    .HintText(LOCTEXT("EntityHint", "Entity IDs (1,2,3)"))
                    .OnTextChanged_Lambda([this](const FText& Text)
                    {
                        EntityIdFilterText = Text.ToString();
                        EntityIdFilter.Empty();

                        TArray<FString> Parts;
                        EntityIdFilterText.ParseIntoArray(Parts, TEXT(","), true);
                        for (const FString& Part : Parts)
                        {
                            FString Trimmed = Part.TrimStartAndEnd();
                            if (!Trimmed.IsEmpty())
                            {
                                EntityIdFilter.Add(FCString::Atoi(*Trimmed));
                            }
                        }
                        RebuildFilteredRows();
                    })
                ]
            ]
        ]

        // ── 본문: 카테고리 사이드바 + 로그 리스트 ──
        + SVerticalBox::Slot()
        .FillHeight(1.0f)
        [
            SNew(SSplitter)
            .Orientation(Orient_Horizontal)

            // 카테고리 사이드바 (트리뷰)
            + SSplitter::Slot()
            .Value(0.15f)
            [
                SAssignNew(CategoryContainer, SVerticalBox)
            ]

            // 로그 리스트
            + SSplitter::Slot()
            .Value(0.85f)
            [
                SAssignNew(ListView, SListView<TSharedPtr<FHktLogEntry>>)
                .ListItemsSource(&FilteredRows)
                .OnGenerateRow(this, &SHktGameplayLogPanel::OnGenerateRow)
                .SelectionMode(ESelectionMode::Single)
                .HeaderRow
                (
                    SNew(SHeaderRow)
                    + SHeaderRow::Column(TEXT("Time"))
                        .DefaultLabel(LOCTEXT("ColTime", "Time"))
                        .FixedWidth(70.f)
                    + SHeaderRow::Column(TEXT("Frame"))
                        .DefaultLabel(LOCTEXT("ColFrame", "Frame"))
                        .FixedWidth(70.f)
                    + SHeaderRow::Column(TEXT("Level"))
                        .DefaultLabel(LOCTEXT("ColLevel", "Level"))
                        .FixedWidth(40.f)
                    + SHeaderRow::Column(TEXT("Source"))
                        .DefaultLabel(LOCTEXT("ColSource", "Source"))
                        .FixedWidth(55.f)
                    + SHeaderRow::Column(TEXT("Category"))
                        .DefaultLabel(LOCTEXT("ColCategory", "Category"))
                        .FixedWidth(130.f)
                    + SHeaderRow::Column(TEXT("Entity"))
                        .DefaultLabel(LOCTEXT("ColEntity", "Entity"))
                        .FixedWidth(60.f)
                    + SHeaderRow::Column(TEXT("Tag"))
                        .DefaultLabel(LOCTEXT("ColTag", "Tag"))
                        .FixedWidth(140.f)
                    + SHeaderRow::Column(TEXT("Message"))
                        .DefaultLabel(LOCTEXT("ColMessage", "Message"))
                        .FillWidth(1.0f)
                )
            ]
        ]
    ];

    // 수집 활성화
    FHktCoreEventLog::Get().SetActive(true);

    // 0.1초 폴링
    RegisterActiveTimer(0.1f, FWidgetActiveTimerDelegate::CreateLambda(
        [this](double, float) -> EActiveTimerReturnType
        {
            PollNewEntries();
            return EActiveTimerReturnType::Continue;
        }));
}

SHktGameplayLogPanel::~SHktGameplayLogPanel()
{
    FHktCoreEventLog::Get().SetActive(false);
}

// ============================================================================
// 폴링
// ============================================================================

void SHktGameplayLogPanel::PollNewEntries()
{
    const uint32 CurrentVersion = FHktCoreEventLog::Get().GetVersion();
    if (CurrentVersion == CachedVersion)
    {
        return;
    }
    CachedVersion = CurrentVersion;

    TArray<FHktLogEntry> NewEntries = FHktCoreEventLog::Get().Consume(ReadIndex);
    if (NewEntries.Num() == 0)
    {
        return;
    }

    bool bNewCategory = false;
    for (FHktLogEntry& Entry : NewEntries)
    {
        TSharedPtr<FHktLogEntry> SharedEntry = MakeShared<FHktLogEntry>(MoveTemp(Entry));

        // 새 카테고리 발견 시 활성화
        if (!KnownCategories.HasTagExact(SharedEntry->Category))
        {
            KnownCategories.AddTag(SharedEntry->Category);
            EnabledCategories.AddTag(SharedEntry->Category);
            bNewCategory = true;
        }

        AllRows.Add(SharedEntry);

        if (PassesFilter(*SharedEntry))
        {
            FilteredRows.Add(SharedEntry);
        }
    }

    // 최대 표시 행 제한 (AllRows가 너무 커지지 않도록)
    constexpr int32 MaxDisplayRows = 8192;
    if (AllRows.Num() > MaxDisplayRows)
    {
        const int32 RemoveCount = AllRows.Num() - MaxDisplayRows;
        AllRows.RemoveAt(0, RemoveCount);
        RebuildFilteredRows();
    }

    if (bNewCategory)
    {
        RebuildCategoryTree();
    }

    LogCountText->SetText(FText::FromString(
        FString::Printf(TEXT("Showing %d / %d entries"), FilteredRows.Num(), AllRows.Num())));

    ListView->RequestListRefresh();

    if (bAutoScroll && FilteredRows.Num() > 0)
    {
        ListView->RequestScrollIntoView(FilteredRows.Last());
    }
}

// ============================================================================
// 필터
// ============================================================================

bool SHktGameplayLogPanel::PassesFilter(const FHktLogEntry& Entry) const
{
    // LogLevel 필터: MinLogLevel 이상만 표시
    if (Entry.Level < MinLogLevel)
    {
        return false;
    }

    // Source 필터 (클라/서버 분리)
    switch (Entry.Source)
    {
    case EHktLogSource::Server: if (!bShowServer) return false; break;
    case EHktLogSource::Client: if (!bShowClient) return false; break;
    }

    // 카테고리 필터: HasTagExact()로 리프 태그 기반 매칭 (트리뷰에서 계층 토글)
    if (!EnabledCategories.HasTagExact(Entry.Category))
    {
        return false;
    }

    // Entity ID 필터
    if (EntityIdFilter.Num() > 0)
    {
        if (Entry.EntityId == InvalidEntityId || !EntityIdFilter.Contains(Entry.EntityId))
        {
            return false;
        }
    }

    // 텍스트 검색
    if (!FilterText.IsEmpty())
    {
        const FString CategoryDisplay = GetCategoryDisplayName(Entry.Category);
        if (!Entry.Message.Contains(FilterText) &&
            !CategoryDisplay.Contains(FilterText) &&
            !Entry.EventTag.ToString().Contains(FilterText))
        {
            return false;
        }
    }

    return true;
}

void SHktGameplayLogPanel::RebuildFilteredRows()
{
    FilteredRows.Reset();
    for (const auto& Row : AllRows)
    {
        if (PassesFilter(*Row))
        {
            FilteredRows.Add(Row);
        }
    }

    LogCountText->SetText(FText::FromString(
        FString::Printf(TEXT("Showing %d / %d entries"), FilteredRows.Num(), AllRows.Num())));

    ListView->RequestListRefresh();
}

void SHktGameplayLogPanel::RebuildCategoryTree()
{
    // ── 태그를 계층 구조로 파싱하여 트리 노드 구축 ──
    CategoryRootNodes.Reset();

    TArray<FGameplayTag> Tags;
    KnownCategories.GetGameplayTagArray(Tags);
    Tags.Sort([](const FGameplayTag& A, const FGameplayTag& B)
    {
        return A.GetTagName().LexicalLess(B.GetTagName());
    });

    // "HktLog." 접두사 제거 후 dot 기준으로 트리 구축
    static const FString Prefix = TEXT("HktLog.");

    for (const FGameplayTag& CatTag : Tags)
    {
        FString TagStr = CatTag.ToString();
        FString DisplayPath = TagStr;
        if (DisplayPath.StartsWith(Prefix))
        {
            DisplayPath.RightChopInline(Prefix.Len());
        }

        TArray<FString> Segments;
        DisplayPath.ParseIntoArray(Segments, TEXT("."), true);

        // 현재 레벨의 노드 리스트에서 탐색하며 트리를 빌드
        TArray<TSharedPtr<FCategoryTreeNode>>* CurrentLevel = &CategoryRootNodes;
        for (int32 i = 0; i < Segments.Num(); ++i)
        {
            const FString& Seg = Segments[i];
            const bool bIsLeaf = (i == Segments.Num() - 1);

            // 이미 존재하는 노드 찾기
            TSharedPtr<FCategoryTreeNode>* Found = CurrentLevel->FindByPredicate(
                [&Seg](const TSharedPtr<FCategoryTreeNode>& N) { return N->DisplayName == Seg; });

            if (Found)
            {
                // 리프에 도달하면 태그 할당
                if (bIsLeaf)
                {
                    (*Found)->Tag = CatTag;
                }
                CurrentLevel = &(*Found)->Children;
            }
            else
            {
                TSharedPtr<FCategoryTreeNode> NewNode = MakeShared<FCategoryTreeNode>();
                NewNode->DisplayName = Seg;
                if (bIsLeaf)
                {
                    NewNode->Tag = CatTag;
                }
                CurrentLevel->Add(NewNode);
                CurrentLevel = &NewNode->Children;
            }
        }
    }

    // ── UI 재구성: 헤더 + All/None + 트리뷰 ──
    CategoryContainer->ClearChildren();

    // 헤더
    CategoryContainer->AddSlot()
    .AutoHeight()
    .Padding(4, 2)
    [
        SNew(STextBlock)
        .Text(LOCTEXT("CatHeader", "Categories"))
        .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
        .ColorAndOpacity(FSlateColor(LogColors::Message))
    ];

    // 전체 선택/해제
    CategoryContainer->AddSlot()
    .AutoHeight()
    .Padding(4, 1)
    [
        SNew(SHorizontalBox)
        + SHorizontalBox::Slot()
        .AutoWidth()
        .Padding(0, 0, 4, 0)
        [
            SNew(SButton)
            .OnClicked_Lambda([this]() -> FReply
            {
                EnabledCategories = KnownCategories;
                RebuildFilteredRows();
                if (CategoryTreeView.IsValid())
                {
                    CategoryTreeView->RequestTreeRefresh();
                }
                return FReply::Handled();
            })
            [ SNew(STextBlock).Text(LOCTEXT("AllBtn", "All")) ]
        ]
        + SHorizontalBox::Slot()
        .AutoWidth()
        [
            SNew(SButton)
            .OnClicked_Lambda([this]() -> FReply
            {
                EnabledCategories.Reset();
                RebuildFilteredRows();
                if (CategoryTreeView.IsValid())
                {
                    CategoryTreeView->RequestTreeRefresh();
                }
                return FReply::Handled();
            })
            [ SNew(STextBlock).Text(LOCTEXT("NoneBtn", "None")) ]
        ]
    ];

    // 트리뷰
    CategoryContainer->AddSlot()
    .FillHeight(1.0f)
    [
        SNew(SScrollBox)
        + SScrollBox::Slot()
        [
            SAssignNew(CategoryTreeView, STreeView<TSharedPtr<FCategoryTreeNode>>)
            .TreeItemsSource(&CategoryRootNodes)
            .OnGenerateRow(this, &SHktGameplayLogPanel::OnGenerateCategoryRow)
            .OnGetChildren(this, &SHktGameplayLogPanel::OnGetCategoryChildren)
            .SelectionMode(ESelectionMode::None)
        ]
    ];

    // 모든 노드를 기본 확장
    TFunction<void(const TArray<TSharedPtr<FCategoryTreeNode>>&)> ExpandAll =
        [this, &ExpandAll](const TArray<TSharedPtr<FCategoryTreeNode>>& Nodes)
    {
        for (const auto& Node : Nodes)
        {
            CategoryTreeView->SetItemExpansion(Node, true);
            ExpandAll(Node->Children);
        }
    };
    ExpandAll(CategoryRootNodes);
}

TSharedRef<ITableRow> SHktGameplayLogPanel::OnGenerateCategoryRow(
    TSharedPtr<FCategoryTreeNode> Item,
    const TSharedRef<STableViewBase>& OwnerTable)
{
    // 노드에 대응하는 색상 결정
    FSlateColor NodeColor = FSlateColor(LogColors::Message);
    if (Item->Tag.IsValid())
    {
        NodeColor = GetCategoryColor(Item->Tag);
    }
    else if (Item->Children.Num() > 0)
    {
        // 중간 노드: 첫 번째 리프의 색상 사용
        TArray<FGameplayTag> LeafTags;
        Item->GatherLeafTags(LeafTags);
        if (LeafTags.Num() > 0)
        {
            NodeColor = GetCategoryColor(LeafTags[0]);
        }
    }

    const bool bHasChildren = Item->Children.Num() > 0;
    const FSlateFontInfo Font = bHasChildren
        ? FCoreStyle::GetDefaultFontStyle("Bold", 9)
        : FCoreStyle::GetDefaultFontStyle("Regular", 9);

    return SNew(STableRow<TSharedPtr<FCategoryTreeNode>>, OwnerTable)
    [
        SNew(SCheckBox)
        .IsChecked_Lambda([this, Item]() -> ECheckBoxState
        {
            return GetNodeCheckState(Item);
        })
        .OnCheckStateChanged_Lambda([this, Item](ECheckBoxState NewState)
        {
            // Undetermined → Checked 로 처리
            const ECheckBoxState Target = (NewState != ECheckBoxState::Unchecked)
                ? ECheckBoxState::Checked : ECheckBoxState::Unchecked;
            ToggleNodeCheckState(Item, Target);
            RebuildFilteredRows();
            if (CategoryTreeView.IsValid())
            {
                CategoryTreeView->RequestTreeRefresh();
            }
        })
        [
            SNew(STextBlock)
            .Text(FText::FromString(Item->DisplayName))
            .Font(Font)
            .ColorAndOpacity(NodeColor)
        ]
    ];
}

void SHktGameplayLogPanel::OnGetCategoryChildren(
    TSharedPtr<FCategoryTreeNode> Item,
    TArray<TSharedPtr<FCategoryTreeNode>>& OutChildren)
{
    OutChildren = Item->Children;
}

ECheckBoxState SHktGameplayLogPanel::GetNodeCheckState(TSharedPtr<FCategoryTreeNode> Node) const
{
    TArray<FGameplayTag> LeafTags;
    Node->GatherLeafTags(LeafTags);

    if (LeafTags.Num() == 0)
    {
        return ECheckBoxState::Unchecked;
    }

    int32 EnabledCount = 0;
    for (const FGameplayTag& LeafTag : LeafTags)
    {
        if (EnabledCategories.HasTagExact(LeafTag))
        {
            ++EnabledCount;
        }
    }

    if (EnabledCount == 0)
    {
        return ECheckBoxState::Unchecked;
    }
    if (EnabledCount == LeafTags.Num())
    {
        return ECheckBoxState::Checked;
    }
    return ECheckBoxState::Undetermined;
}

void SHktGameplayLogPanel::ToggleNodeCheckState(TSharedPtr<FCategoryTreeNode> Node, ECheckBoxState NewState)
{
    TArray<FGameplayTag> LeafTags;
    Node->GatherLeafTags(LeafTags);

    for (const FGameplayTag& LeafTag : LeafTags)
    {
        if (NewState == ECheckBoxState::Checked)
        {
            EnabledCategories.AddTag(LeafTag);
        }
        else
        {
            EnabledCategories.RemoveTag(LeafTag);
        }
    }
}

// ============================================================================
// 행 생성
// ============================================================================

TSharedRef<ITableRow> SHktGameplayLogPanel::OnGenerateRow(
    TSharedPtr<FHktLogEntry> Item,
    const TSharedRef<STableViewBase>& OwnerTable)
{
    class SLogRow : public SMultiColumnTableRow<TSharedPtr<FHktLogEntry>>
    {
    public:
        SLATE_BEGIN_ARGS(SLogRow) {}
        SLATE_END_ARGS()

        void Construct(const FArguments& InArgs,
                       const TSharedRef<STableViewBase>& InOwnerTable,
                       TSharedPtr<FHktLogEntry> InItem,
                       double InStartTime)
        {
            Item = InItem;
            PanelStartTime = InStartTime;
            SMultiColumnTableRow::Construct(FSuperRowType::FArguments(), InOwnerTable);
        }

        virtual TSharedRef<SWidget> GenerateWidgetForColumn(const FName& ColumnName) override
        {
            FString ColStr = ColumnName.ToString();

            if (ColStr == TEXT("Time"))
            {
                double RelTime = Item->Timestamp - PanelStartTime;
                return SNew(STextBlock)
                    .Text(FText::FromString(FString::Printf(TEXT("%.2fs"), RelTime)))
                    .Font(FCoreStyle::GetDefaultFontStyle("Regular", 8))
                    .ColorAndOpacity(FSlateColor(LogColors::Time))
                    .Margin(FMargin(2, 1));
            }

            if (ColStr == TEXT("Frame"))
            {
                return SNew(STextBlock)
                    .Text(FText::FromString(FString::Printf(TEXT("%llu"), Item->FrameNumber)))
                    .Font(FCoreStyle::GetDefaultFontStyle("Regular", 8))
                    .ColorAndOpacity(FSlateColor(LogColors::Frame))
                    .Margin(FMargin(2, 1));
            }

            if (ColStr == TEXT("Level"))
            {
                return SNew(STextBlock)
                    .Text(FText::FromString(FString(GetLogLevelName(Item->Level))))
                    .Font(FCoreStyle::GetDefaultFontStyle("Bold", 8))
                    .ColorAndOpacity(FSlateColor(GetLogLevelColor(Item->Level)))
                    .Margin(FMargin(2, 1));
            }

            if (ColStr == TEXT("Source"))
            {
                return SNew(STextBlock)
                    .Text(FText::FromString(FString(GetLogSourceName(Item->Source))))
                    .Font(FCoreStyle::GetDefaultFontStyle("Bold", 8))
                    .ColorAndOpacity(FSlateColor(GetLogSourceColor(Item->Source)))
                    .Margin(FMargin(2, 1));
            }

            if (ColStr == TEXT("Category"))
            {
                FString DisplayName = SHktGameplayLogPanel::GetCategoryDisplayName(Item->Category);
                return SNew(STextBlock)
                    .Text(FText::FromString(DisplayName))
                    .Font(FCoreStyle::GetDefaultFontStyle("Bold", 8))
                    .ColorAndOpacity(SHktGameplayLogPanel::GetCategoryColor(Item->Category))
                    .Margin(FMargin(2, 1));
            }

            if (ColStr == TEXT("Entity"))
            {
                FString EntityStr = Item->EntityId != InvalidEntityId
                    ? FString::Printf(TEXT("%d"), Item->EntityId)
                    : TEXT("-");
                return SNew(STextBlock)
                    .Text(FText::FromString(EntityStr))
                    .Font(FCoreStyle::GetDefaultFontStyle("Regular", 8))
                    .ColorAndOpacity(FSlateColor(LogColors::Entity))
                    .Margin(FMargin(2, 1));
            }

            if (ColStr == TEXT("Tag"))
            {
                FString TagStr = Item->EventTag.IsValid() ? Item->EventTag.ToString() : TEXT("-");
                return SNew(STextBlock)
                    .Text(FText::FromString(TagStr))
                    .Font(FCoreStyle::GetDefaultFontStyle("Regular", 8))
                    .ColorAndOpacity(FSlateColor(LogColors::Dim))
                    .Margin(FMargin(2, 1));
            }

            // Message — Warning/Error는 레벨 색상으로 강조
            {
                FLinearColor MsgColor = LogColors::Message;
                if (Item->Level >= EHktLogLevel::Warning)
                {
                    MsgColor = GetLogLevelColor(Item->Level);
                }
                return SNew(STextBlock)
                    .Text(FText::FromString(Item->Message))
                    .Font(FCoreStyle::GetDefaultFontStyle("Regular", 8))
                    .ColorAndOpacity(FSlateColor(MsgColor))
                    .Margin(FMargin(2, 1));
            }
        }

        TSharedPtr<FHktLogEntry> Item;
        double PanelStartTime = 0.0;
    };

    return SNew(SLogRow, OwnerTable, Item, StartTime);
}

// ============================================================================
// 카테고리 색상 — MatchesTag()로 계층적 매칭
// ============================================================================

FSlateColor SHktGameplayLogPanel::GetCategoryColor(const FGameplayTag& Category)
{
    if (Category.MatchesTag(HktLogTags::Core_Entity))       return FSlateColor(LogColors::CatCoreEntity);
    if (Category.MatchesTag(HktLogTags::Core_VM))           return FSlateColor(LogColors::CatCoreVM);
    if (Category.MatchesTag(HktLogTags::Core_Story))        return FSlateColor(LogColors::CatCoreStory);
    if (Category.MatchesTag(HktLogTags::Runtime_Server))    return FSlateColor(LogColors::CatRuntimeServer);
    if (Category.MatchesTag(HktLogTags::Runtime_Client))    return FSlateColor(LogColors::CatRuntimeClient);
    if (Category.MatchesTag(HktLogTags::Runtime_Intent))    return FSlateColor(LogColors::CatRuntimeIntent);
    if (Category.MatchesTag(HktLogTags::Presentation))      return FSlateColor(LogColors::CatPresentation);
    if (Category.MatchesTag(HktLogTags::Asset))             return FSlateColor(LogColors::CatAsset);
    if (Category.MatchesTag(HktLogTags::Rule))              return FSlateColor(LogColors::CatRule);
    if (Category.MatchesTag(HktLogTags::Story))             return FSlateColor(LogColors::CatStory);
    if (Category.MatchesTag(HktLogTags::UI))                return FSlateColor(LogColors::CatUI);
    if (Category.MatchesTag(HktLogTags::VFX))               return FSlateColor(LogColors::CatVFX);
    return FSlateColor(LogColors::CatDefault);
}

// ============================================================================
// 표시명: "HktLog." 접두사 제거
// ============================================================================

FString SHktGameplayLogPanel::GetCategoryDisplayName(const FGameplayTag& Category)
{
    static const FString Prefix = TEXT("HktLog.");
    FString TagStr = Category.ToString();
    if (TagStr.StartsWith(Prefix))
    {
        TagStr.RightChopInline(Prefix.Len());
    }
    return TagStr;
}

#undef LOCTEXT_NAMESPACE
