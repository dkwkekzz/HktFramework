// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Slate/SHktViewModelStatePanel.h"
#include "HktCoreDataCollector.h"
#include "Widgets/Input/SComboBox.h"
#include "Widgets/Input/SSearchBox.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Layout/SSplitter.h"
#include "Widgets/Text/STextBlock.h"

#define LOCTEXT_NAMESPACE "HktViewModelStatePanel"

// ── 컬러 팔레트 ──
namespace VMColors
{
    static const FLinearColor Key(0.4f, 0.85f, 1.0f);
    static const FLinearColor Header(0.7f, 0.7f, 0.75f);
    static const FLinearColor Value(0.88f, 0.88f, 0.88f);
    static const FLinearColor FieldName(0.5f, 0.5f, 0.58f);
    static const FLinearColor Dim(0.4f, 0.4f, 0.4f);
    static const FLinearColor SectionHeader(0.95f, 0.85f, 0.4f);
    static const FLinearColor DirtyValue(1.0f, 0.5f, 0.3f);     // 이번 프레임 더티: 주황
    static const FLinearColor TagValue(0.55f, 0.9f, 0.55f);     // GameplayTag: 초록
    static const FLinearColor MetaValue(0.85f, 0.65f, 1.0f);    // Meta: 보라
}

// View 그룹 → 색상
static FSlateColor GetGroupColor(const FString& GroupName)
{
    static const TMap<FString, FLinearColor> GroupPalette = {
        { TEXT("Transform"),     FLinearColor(0.55f, 0.85f, 1.0f) },
        { TEXT("Physics"),       FLinearColor(0.65f, 0.75f, 0.95f) },
        { TEXT("Movement"),      FLinearColor(0.55f, 0.95f, 0.85f) },
        { TEXT("Vitals"),        FLinearColor(1.0f,  0.55f, 0.55f) },
        { TEXT("Combat"),        FLinearColor(1.0f,  0.75f, 0.35f) },
        { TEXT("Ownership"),     FLinearColor(0.85f, 0.85f, 1.0f) },
        { TEXT("Animation"),     FLinearColor(0.95f, 0.85f, 0.55f) },
        { TEXT("Visualization"), FLinearColor(0.85f, 0.65f, 1.0f) },
        { TEXT("Item"),          FLinearColor(0.75f, 0.95f, 0.55f) },
        { TEXT("VoxelSkin"),     FLinearColor(0.55f, 0.95f, 1.0f) },
        { TEXT("Sprite"),        FLinearColor(1.0f,  0.85f, 0.65f) },
        { TEXT("TerrainDebris"), FLinearColor(0.85f, 0.75f, 0.55f) },
    };
    if (const FLinearColor* C = GroupPalette.Find(GroupName))
    {
        return FSlateColor(*C);
    }
    return FSlateColor(VMColors::Value);
}

// View 그룹 정렬 순서 (안정적 표시 순)
static int32 GroupOrderRank(const FString& Group)
{
    static const TArray<FString> Order = {
        TEXT("Transform"), TEXT("Physics"), TEXT("Movement"),
        TEXT("Vitals"), TEXT("Combat"), TEXT("Ownership"),
        TEXT("Animation"), TEXT("Visualization"),
        TEXT("Item"), TEXT("VoxelSkin"), TEXT("Sprite"), TEXT("TerrainDebris")
    };
    int32 Idx = Order.IndexOfByKey(Group);
    return (Idx == INDEX_NONE) ? 0xFFFF : Idx;
}

// 값에서 더티 prefix '*' 분리
static void SplitDirtyValue(const FString& Raw, FString& OutValue, bool& bOutDirty)
{
    if (Raw.Len() > 0 && Raw[0] == TEXT('*'))
    {
        bOutDirty = true;
        OutValue = Raw.Mid(1);
    }
    else
    {
        bOutDirty = false;
        OutValue = Raw;
    }
}

// "Transform.Location" → ("Transform", "Location")
static bool SplitGroupAndField(const FString& FullName, FString& OutGroup, FString& OutField)
{
    int32 DotIdx;
    if (FullName.FindChar(TEXT('.'), DotIdx) && DotIdx > 0)
    {
        OutGroup = FullName.Left(DotIdx);
        OutField = FullName.Mid(DotIdx + 1);
        return true;
    }
    return false;
}

// ============================================================================
// Construct
// ============================================================================

void SHktViewModelStatePanel::Construct(const FArguments& InArgs)
{
    ChildSlot
    [
        SNew(SVerticalBox)

        // ── 헤더 바: Source + Meta ──
        + SVerticalBox::Slot()
        .AutoHeight()
        .Padding(4.f)
        [
            SNew(SHorizontalBox)
            + SHorizontalBox::Slot()
            .AutoWidth()
            .VAlign(VAlign_Center)
            .Padding(0, 0, 4, 0)
            [
                SNew(STextBlock)
                .Text(LOCTEXT("SourceLabel", "Source:"))
                .ColorAndOpacity(FSlateColor(VMColors::FieldName))
            ]
            + SHorizontalBox::Slot()
            .AutoWidth()
            .Padding(0, 0, 12, 0)
            [
                SNew(SComboBox<TSharedPtr<FString>>)
                .OptionsSource(&SourceOptions)
                .OnSelectionChanged_Lambda([this](TSharedPtr<FString> Selected, ESelectInfo::Type)
                {
                    if (Selected.IsValid())
                    {
                        SelectedSource = *Selected;
                        CachedVersion = 0;
                        RefreshData();
                    }
                })
                .OnGenerateWidget_Lambda([](TSharedPtr<FString> Item)
                {
                    return SNew(STextBlock).Text(FText::FromString(*Item));
                })
                [
                    SNew(STextBlock)
                    .Text_Lambda([this]() -> FText
                    {
                        return FText::FromString(SelectedSource.IsEmpty() ? TEXT("(auto)") : SelectedSource);
                    })
                ]
            ]
            + SHorizontalBox::Slot()
            .AutoWidth()
            .VAlign(VAlign_Center)
            .Padding(0, 0, 8, 0)
            [
                SAssignNew(FrameText, STextBlock)
                .Font(FCoreStyle::GetDefaultFontStyle("Bold", 10))
                .ColorAndOpacity(FSlateColor(VMColors::Key))
            ]
            + SHorizontalBox::Slot()
            .AutoWidth()
            .VAlign(VAlign_Center)
            .Padding(0, 0, 8, 0)
            [
                SAssignNew(EntityCountText, STextBlock)
                .Font(FCoreStyle::GetDefaultFontStyle("Regular", 10))
                .ColorAndOpacity(FSlateColor(VMColors::Header))
            ]
            + SHorizontalBox::Slot()
            .AutoWidth()
            .VAlign(VAlign_Center)
            [
                SAssignNew(DirtyCountText, STextBlock)
                .Font(FCoreStyle::GetDefaultFontStyle("Regular", 10))
                .ColorAndOpacity(FSlateColor(VMColors::DirtyValue))
            ]
        ]

        // ── 필터 바 ──
        + SVerticalBox::Slot()
        .AutoHeight()
        .Padding(4, 0, 4, 4)
        [
            SNew(SSearchBox)
            .HintText(LOCTEXT("FilterHint", "Filter entities (key/group/field/value)..."))
            .OnTextChanged_Lambda([this](const FText& Text)
            {
                FilterText = Text.ToString();
                RebuildFilteredRows();
            })
        ]

        // ── 상단 목록 + 하단 상세 ──
        + SVerticalBox::Slot()
        .FillHeight(1.0f)
        [
            SNew(SSplitter)
            .Orientation(Orient_Vertical)

            + SSplitter::Slot()
            .Value(0.5f)
            [
                SAssignNew(ListView, SListView<TSharedPtr<FHktViewModelEntityRow>>)
                .ListItemsSource(&FilteredRows)
                .OnGenerateRow(this, &SHktViewModelStatePanel::OnGenerateRow)
                .OnSelectionChanged_Lambda([this](TSharedPtr<FHktViewModelEntityRow> Item, ESelectInfo::Type SelectInfo)
                {
                    if (SelectInfo == ESelectInfo::Direct) return;
                    SelectedEntityKey = Item.IsValid() ? Item->EntityKey : FString();
                    BuildDetailPanel();
                })
                .SelectionMode(ESelectionMode::Single)
                .HeaderRow
                (
                    SNew(SHeaderRow)
                    + SHeaderRow::Column(TEXT("_Entity"))
                        .DefaultLabel(LOCTEXT("ColEntity", "Entity"))
                        .FillWidth(1.0f)
                    + SHeaderRow::Column(TEXT("RenderCategory"))
                        .DefaultLabel(LOCTEXT("ColRender", "Render"))
                        .FillWidth(0.7f)
                    + SHeaderRow::Column(TEXT("SpawnedFrame"))
                        .DefaultLabel(LOCTEXT("ColSpawn", "SpawnedFrame"))
                        .FillWidth(0.6f)
                    + SHeaderRow::Column(TEXT("LastDirtyFrame"))
                        .DefaultLabel(LOCTEXT("ColDirty", "LastDirty"))
                        .FillWidth(0.6f)
                )
            ]

            + SSplitter::Slot()
            .Value(0.5f)
            [
                SAssignNew(DetailContainer, SVerticalBox)
            ]
        ]
    ];

    CachedVersion = FHktCoreDataCollector::Get().GetVersion();
    RebuildSourceOptions();
    RefreshData();
    BuildDetailPanel();

    // 0.1초 폴링
    RegisterActiveTimer(0.1f, FWidgetActiveTimerDelegate::CreateLambda(
        [this](double, float) -> EActiveTimerReturnType
        {
            const uint32 CurrentVersion = FHktCoreDataCollector::Get().GetVersion();
            if (CurrentVersion != CachedVersion)
            {
                CachedVersion = CurrentVersion;
                RebuildSourceOptions();
                RefreshData();
            }
            return EActiveTimerReturnType::Continue;
        }));
}

// ============================================================================
// Source Options
// ============================================================================

void SHktViewModelStatePanel::RebuildSourceOptions()
{
    TArray<FString> Categories = FHktCoreDataCollector::Get().GetCategories();
    TArray<FString> Sources;
    const FString Prefix(TEXT("Presentation."));
    for (const FString& Cat : Categories)
    {
        if (Cat.StartsWith(Prefix))
        {
            Sources.AddUnique(Cat.Mid(Prefix.Len()));
        }
    }

    bool bChanged = Sources.Num() != SourceOptions.Num();
    if (!bChanged)
    {
        for (int32 i = 0; i < Sources.Num(); ++i)
        {
            if (*SourceOptions[i] != Sources[i]) { bChanged = true; break; }
        }
    }

    if (bChanged)
    {
        SourceOptions.Reset();
        for (const FString& S : Sources)
        {
            SourceOptions.Add(MakeShared<FString>(S));
        }
        if (SelectedSource.IsEmpty() && SourceOptions.Num() > 0)
        {
            SelectedSource = *SourceOptions[0];
        }
    }
}

// ============================================================================
// Data Refresh
// ============================================================================

void SHktViewModelStatePanel::RefreshData()
{
    if (SelectedSource.IsEmpty())
    {
        RebuildSourceOptions();
        if (SelectedSource.IsEmpty())
        {
            AllRows.Reset();
            FilteredRows.Reset();
            EntityRowMap.Empty();
            ListView->RequestListRefresh();
            FrameText->SetText(FText::GetEmpty());
            EntityCountText->SetText(FText::GetEmpty());
            DirtyCountText->SetText(FText::GetEmpty());
            return;
        }
    }

    const FString Category = FString::Printf(TEXT("Presentation.%s"), *SelectedSource);
    TArray<TPair<FString, FString>> Entries = FHktCoreDataCollector::Get().GetEntries(Category);

    FString FrameStr, CountStr, DirtyStr;
    TMap<FString, TMap<FString, FString>> ParsedEntities;
    TSet<FString> SeenProps;
    TArray<FString> NewPropertyOrder;

    // 메타 — 헤더에서 분리하여 표시
    SeenProps.Add(TEXT("RenderCategory"));
    SeenProps.Add(TEXT("SpawnedFrame"));
    SeenProps.Add(TEXT("LastDirtyFrame"));

    for (const auto& Entry : Entries)
    {
        if (Entry.Key == TEXT("_Frame"))             { FrameStr = Entry.Value; continue; }
        if (Entry.Key == TEXT("_EntityCount"))       { CountStr = Entry.Value; continue; }
        if (Entry.Key == TEXT("_DirtyThisFrame"))    { DirtyStr = Entry.Value; continue; }
        if (!Entry.Key.StartsWith(TEXT("E_"))) continue;

        TMap<FString, FString>& Props = ParsedEntities.Add(Entry.Key);
        TArray<FString> Segments;
        Entry.Value.ParseIntoArray(Segments, TEXT("|"), true);
        for (FString& Seg : Segments)
        {
            Seg.TrimStartAndEndInline();
            int32 EqIdx;
            if (Seg.FindChar(TEXT('='), EqIdx) && EqIdx > 0)
            {
                FString PropName = Seg.Left(EqIdx);
                FString PropValue = Seg.Mid(EqIdx + 1);

                // PropName 의 더티 prefix '*' 를 PropValue 쪽으로 이동 (값에 prefix 인코딩으로 통일)
                if (PropName.Len() > 0 && PropName[0] == TEXT('*'))
                {
                    PropName = PropName.Mid(1);
                    PropValue = TEXT("*") + PropValue;
                }

                Props.Add(PropName, PropValue);

                if (!SeenProps.Contains(PropName))
                {
                    SeenProps.Add(PropName);
                    NewPropertyOrder.Add(PropName);
                }
            }
        }
    }

    // View 그룹별 분류
    TArray<FString> NewGroupOrder;
    TMap<FString, TArray<FString>> NewGroupToProps;
    for (const FString& PropName : NewPropertyOrder)
    {
        FString Group, Field;
        if (!SplitGroupAndField(PropName, Group, Field))
        {
            Group = TEXT("Other");
        }
        TArray<FString>& Bucket = NewGroupToProps.FindOrAdd(Group);
        if (Bucket.Num() == 0)
        {
            NewGroupOrder.Add(Group);
        }
        Bucket.Add(PropName);
    }
    NewGroupOrder.Sort([](const FString& A, const FString& B)
    {
        return GroupOrderRank(A) < GroupOrderRank(B);
    });
    for (auto& KV : NewGroupToProps)
    {
        KV.Value.Sort();
    }

    // ── 메타 갱신 ──
    FrameText->SetText(FText::FromString(
        FrameStr.IsEmpty() ? TEXT("") : FString::Printf(TEXT("Frame: %s"), *FrameStr)));
    EntityCountText->SetText(FText::FromString(
        CountStr.IsEmpty() ? TEXT("") : FString::Printf(TEXT("  Entities: %s"), *CountStr)));
    DirtyCountText->SetText(FText::FromString(
        DirtyStr.IsEmpty() ? TEXT("") : FString::Printf(TEXT("  Dirty: %s"), *DirtyStr)));

    // ── 엔티티 셋 변경 감지 & Props in-place 갱신 ──
    bool bEntitySetChanged = false;

    TArray<FString> ToRemove;
    for (auto& KV : EntityRowMap)
    {
        if (!ParsedEntities.Contains(KV.Key))
        {
            ToRemove.Add(KV.Key);
            bEntitySetChanged = true;
        }
    }
    for (const FString& Key : ToRemove)
    {
        EntityRowMap.Remove(Key);
    }

    for (auto& KV : ParsedEntities)
    {
        if (TSharedPtr<FHktViewModelEntityRow>* Existing = EntityRowMap.Find(KV.Key))
        {
            (*Existing)->Props = MoveTemp(KV.Value);
        }
        else
        {
            TSharedPtr<FHktViewModelEntityRow> Row = MakeShared<FHktViewModelEntityRow>();
            Row->EntityKey = KV.Key;
            Row->Props = MoveTemp(KV.Value);
            EntityRowMap.Add(KV.Key, Row);
            bEntitySetChanged = true;
        }
    }

    if (bEntitySetChanged)
    {
        AllRows.Reset();
        for (auto& KV : EntityRowMap)
        {
            AllRows.Add(KV.Value);
        }
        AllRows.Sort([](const TSharedPtr<FHktViewModelEntityRow>& A,
                        const TSharedPtr<FHktViewModelEntityRow>& B)
        {
            int32 IdA = FCString::Atoi(*A->EntityKey.Mid(2));
            int32 IdB = FCString::Atoi(*B->EntityKey.Mid(2));
            return IdA < IdB;
        });

        RebuildFilteredRows();

        if (!SelectedEntityKey.IsEmpty())
        {
            if (TSharedPtr<FHktViewModelEntityRow>* SelRow = EntityRowMap.Find(SelectedEntityKey))
            {
                ListView->SetSelection(*SelRow, ESelectInfo::Direct);
            }
            else
            {
                SelectedEntityKey.Empty();
                BuildDetailPanel();
            }
        }
    }

    // 그룹 구조가 바뀌었으면 Detail 재구성 필요
    bool bGroupStructureChanged = (NewGroupOrder.Num() != ViewGroupOrder.Num());
    if (!bGroupStructureChanged)
    {
        for (int32 i = 0; i < NewGroupOrder.Num(); ++i)
        {
            const TArray<FString>* Old = ViewGroupToPropNames.Find(NewGroupOrder[i]);
            const TArray<FString>* Nw  = NewGroupToProps.Find(NewGroupOrder[i]);
            if (NewGroupOrder[i] != ViewGroupOrder[i] || !Old || !Nw || Old->Num() != Nw->Num())
            {
                bGroupStructureChanged = true; break;
            }
        }
    }

    ViewGroupOrder = MoveTemp(NewGroupOrder);
    ViewGroupToPropNames = MoveTemp(NewGroupToProps);

    if (bGroupStructureChanged && !SelectedEntityKey.IsEmpty())
    {
        BuildDetailPanel();
    }
}

// ============================================================================
// Entity List (상단)
// ============================================================================

void SHktViewModelStatePanel::RebuildFilteredRows()
{
    FilteredRows.Reset();

    if (FilterText.IsEmpty())
    {
        FilteredRows = AllRows;
    }
    else
    {
        for (const auto& Row : AllRows)
        {
            bool bMatch = Row->EntityKey.Contains(FilterText);
            if (!bMatch)
            {
                for (const auto& Prop : Row->Props)
                {
                    if (Prop.Key.Contains(FilterText) || Prop.Value.Contains(FilterText))
                    {
                        bMatch = true; break;
                    }
                }
            }
            if (bMatch)
            {
                FilteredRows.Add(Row);
            }
        }
    }

    ListView->RequestListRefresh();
}

TSharedRef<ITableRow> SHktViewModelStatePanel::OnGenerateRow(
    TSharedPtr<FHktViewModelEntityRow> Item,
    const TSharedRef<STableViewBase>& OwnerTable)
{
    class SVMEntityRow : public SMultiColumnTableRow<TSharedPtr<FHktViewModelEntityRow>>
    {
    public:
        SLATE_BEGIN_ARGS(SVMEntityRow) {}
        SLATE_END_ARGS()

        void Construct(const FArguments& InArgs,
                       const TSharedRef<STableViewBase>& InOwnerTable,
                       TSharedPtr<FHktViewModelEntityRow> InItem)
        {
            Item = InItem;
            SMultiColumnTableRow::Construct(FSuperRowType::FArguments(), InOwnerTable);
        }

        virtual TSharedRef<SWidget> GenerateWidgetForColumn(const FName& ColumnName) override
        {
            FString ColStr = ColumnName.ToString();
            TWeakPtr<FHktViewModelEntityRow> Weak = Item;

            if (ColStr == TEXT("_Entity"))
            {
                return SNew(STextBlock)
                    .Text(TAttribute<FText>::CreateLambda([Weak]()
                    {
                        if (auto E = Weak.Pin()) return FText::FromString(E->EntityKey);
                        return FText::GetEmpty();
                    }))
                    .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                    .ColorAndOpacity(FSlateColor(VMColors::Key))
                    .Margin(FMargin(4, 1));
            }

            FString CapturedCol = ColStr;
            return SNew(STextBlock)
                .Text(TAttribute<FText>::CreateLambda([Weak, CapturedCol]()
                {
                    if (auto E = Weak.Pin())
                    {
                        if (const FString* V = E->Props.Find(CapturedCol))
                        {
                            FString Val; bool bDirty;
                            SplitDirtyValue(*V, Val, bDirty);
                            return FText::FromString(Val);
                        }
                    }
                    return FText::FromString(TEXT("-"));
                }))
                .Font(FCoreStyle::GetDefaultFontStyle("Regular", 9))
                .ColorAndOpacity(TAttribute<FSlateColor>::CreateLambda([Weak, CapturedCol]() -> FSlateColor
                {
                    if (auto E = Weak.Pin())
                    {
                        if (const FString* V = E->Props.Find(CapturedCol))
                        {
                            FString Val; bool bDirty;
                            SplitDirtyValue(*V, Val, bDirty);
                            if (bDirty) return FSlateColor(VMColors::DirtyValue);
                        }
                    }
                    return FSlateColor(VMColors::Value);
                }))
                .Margin(FMargin(4, 1));
        }

        TSharedPtr<FHktViewModelEntityRow> Item;
    };

    return SNew(SVMEntityRow, OwnerTable, Item);
}

// ============================================================================
// Detail Panel — 위젯 1회 생성, TAttribute 람다로 값 갱신
// ============================================================================

void SHktViewModelStatePanel::BuildDetailPanel()
{
    DetailContainer->ClearChildren();

    if (SelectedEntityKey.IsEmpty())
    {
        DetailContainer->AddSlot()
        .AutoHeight()
        .Padding(4.f)
        [
            SNew(STextBlock)
            .Text(LOCTEXT("NoSelection", "Select an entity to view its ViewModel state"))
            .ColorAndOpacity(FSlateColor(VMColors::Dim))
            .Font(FCoreStyle::GetDefaultFontStyle("Italic", 9))
        ];
        return;
    }

    TSharedPtr<FHktViewModelEntityRow> Entity;
    if (TSharedPtr<FHktViewModelEntityRow>* Found = EntityRowMap.Find(SelectedEntityKey))
    {
        Entity = *Found;
    }
    if (!Entity.IsValid()) return;

    TWeakPtr<FHktViewModelEntityRow> Weak = Entity;

    // 헤더
    DetailContainer->AddSlot()
    .AutoHeight()
    .Padding(4, 2, 4, 2)
    [
        SNew(STextBlock)
        .Text(TAttribute<FText>::CreateLambda([Weak]()
        {
            if (auto E = Weak.Pin()) return FText::FromString(E->EntityKey);
            return FText::GetEmpty();
        }))
        .Font(FCoreStyle::GetDefaultFontStyle("Bold", 11))
        .ColorAndOpacity(FSlateColor(VMColors::Key))
    ];

    // 메타: RenderCategory / SpawnedFrame / LastDirtyFrame
    DetailContainer->AddSlot()
    .AutoHeight()
    .Padding(4, 0, 4, 4)
    [
        SNew(STextBlock)
        .Text(TAttribute<FText>::CreateLambda([Weak]()
        {
            if (auto E = Weak.Pin())
            {
                TArray<FString> Parts;
                if (const FString* V = E->Props.Find(TEXT("RenderCategory")))
                {
                    FString Val; bool b; SplitDirtyValue(*V, Val, b);
                    Parts.Add(FString::Printf(TEXT("Render: %s"), *Val));
                }
                if (const FString* V = E->Props.Find(TEXT("SpawnedFrame")))
                {
                    FString Val; bool b; SplitDirtyValue(*V, Val, b);
                    Parts.Add(FString::Printf(TEXT("Born: F%s"), *Val));
                }
                if (const FString* V = E->Props.Find(TEXT("LastDirtyFrame")))
                {
                    FString Val; bool b; SplitDirtyValue(*V, Val, b);
                    Parts.Add(FString::Printf(TEXT("LastDirty: F%s"), *Val));
                }
                if (Parts.Num() > 0)
                {
                    return FText::FromString(FString::Join(Parts, TEXT("  |  ")));
                }
            }
            return FText::GetEmpty();
        }))
        .Font(FCoreStyle::GetDefaultFontStyle("Regular", 9))
        .ColorAndOpacity(FSlateColor(VMColors::MetaValue))
    ];

    // View 그룹별 섹션
    TSharedRef<SScrollBox> Scroll = SNew(SScrollBox);

    auto AddSectionHeader = [&Scroll](const FText& Title)
    {
        Scroll->AddSlot()
        .Padding(4, 6, 4, 2)
        [
            SNew(STextBlock)
            .Text(Title)
            .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
            .ColorAndOpacity(FSlateColor(VMColors::SectionHeader))
        ];
    };

    auto AddPropRow = [&Scroll, &Weak](const FString& FullPropName, const FString& DisplayField, const FString& Group)
    {
        FString CapturedProp = FullPropName;
        FSlateColor BaseColor = GetGroupColor(Group);

        Scroll->AddSlot()
        .Padding(4, 1)
        [
            SNew(SHorizontalBox)
            + SHorizontalBox::Slot()
            .AutoWidth()
            [
                SNew(SBox)
                .MinDesiredWidth(160.f)
                [
                    SNew(STextBlock)
                    .Text(FText::FromString(DisplayField))
                    .Font(FCoreStyle::GetDefaultFontStyle("Regular", 9))
                    .ColorAndOpacity(FSlateColor(VMColors::FieldName))
                ]
            ]
            + SHorizontalBox::Slot()
            .FillWidth(1.0f)
            [
                SNew(STextBlock)
                .Text(TAttribute<FText>::CreateLambda([Weak, CapturedProp]()
                {
                    if (auto E = Weak.Pin())
                    {
                        if (const FString* V = E->Props.Find(CapturedProp))
                        {
                            FString Val; bool bDirty;
                            SplitDirtyValue(*V, Val, bDirty);
                            return FText::FromString(Val);
                        }
                    }
                    return FText::FromString(TEXT("-"));
                }))
                .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                .ColorAndOpacity(TAttribute<FSlateColor>::CreateLambda([Weak, CapturedProp, BaseColor]() -> FSlateColor
                {
                    if (auto E = Weak.Pin())
                    {
                        if (const FString* V = E->Props.Find(CapturedProp))
                        {
                            FString Val; bool bDirty;
                            SplitDirtyValue(*V, Val, bDirty);
                            if (bDirty) return FSlateColor(VMColors::DirtyValue);
                        }
                    }
                    return BaseColor;
                }))
            ]
        ];
    };

    for (const FString& Group : ViewGroupOrder)
    {
        const TArray<FString>* Props = ViewGroupToPropNames.Find(Group);
        if (!Props || Props->Num() == 0) continue;

        AddSectionHeader(FText::FromString(FString::Printf(TEXT("%s (%d)"), *Group, Props->Num())));
        for (const FString& Full : *Props)
        {
            FString G, Field;
            if (!SplitGroupAndField(Full, G, Field)) Field = Full;
            AddPropRow(Full, Field, Group);
        }
    }

    DetailContainer->AddSlot()
    .FillHeight(1.0f)
    .Padding(2.f)
    [
        Scroll
    ];
}

#undef LOCTEXT_NAMESPACE
