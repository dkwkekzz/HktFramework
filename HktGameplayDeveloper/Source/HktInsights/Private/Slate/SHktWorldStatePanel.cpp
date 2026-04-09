// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Slate/SHktWorldStatePanel.h"
#include "HktCoreDataCollector.h"
#include "HktCoreProperties.h"
#include "GameplayTagsManager.h"
#include "Widgets/Input/SComboBox.h"
#include "Widgets/Input/SSearchBox.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Layout/SSplitter.h"
#include "Widgets/Text/STextBlock.h"

#define LOCTEXT_NAMESPACE "HktWorldStatePanel"

// ── 컬러 팔레트 ──
namespace WSColors
{
    static const FLinearColor Key(0.4f, 0.85f, 1.0f);
    static const FLinearColor Header(0.7f, 0.7f, 0.75f);
    static const FLinearColor Value(0.88f, 0.88f, 0.88f);
    static const FLinearColor FieldName(0.5f, 0.5f, 0.58f);
    static const FLinearColor Dim(0.4f, 0.4f, 0.4f);
    static const FLinearColor TagValue(0.55f, 0.9f, 0.55f);     // 태그 값: 초록
    static const FLinearColor DebugValue(0.95f, 0.85f, 0.4f);   // 디버그 정보: 노랑
    static const FLinearColor HotValue(1.0f, 0.75f, 0.35f);     // Hot 프로퍼티: 주황
    static const FLinearColor ColdValue(0.55f, 0.75f, 0.95f);   // Cold 프로퍼티: 파랑
    static const FLinearColor SectionHeader(0.95f, 0.85f, 0.4f); // 섹션 헤더: 노랑
    static const FLinearColor ArchetypeValue(0.85f, 0.65f, 1.0f); // Archetype: 보라
}

// ── Tag NetIndex 해석 ──

static bool IsTagProperty(const FString& PropName)
{
    return PropName == TEXT("EntitySpawnTag")
        || PropName == TEXT("SpawnFlowTag")
        || PropName == TEXT("ItemSkillTag")
        || PropName == TEXT("Stance");
}

static FString ResolveTagNetIndex(const FString& RawValue)
{
    if (RawValue.IsEmpty()) return RawValue;
    int32 NetIdx = FCString::Atoi(*RawValue);
    if (NetIdx == 0) return RawValue;
    FName TagName = UGameplayTagsManager::Get().GetTagNameFromNetIndex(
        static_cast<FGameplayTagNetIndex>(NetIdx));
    if (TagName.IsNone()) return RawValue;
    return TagName.ToString();
}

static FSlateColor GetPropValueColor(const FString& PropName, EHktPropertyTier Tier)
{
    if (IsTagProperty(PropName))
    {
        return FSlateColor(WSColors::TagValue);
    }
    return FSlateColor(Tier == EHktPropertyTier::Hot ? WSColors::HotValue : WSColors::ColdValue);
}

// ============================================================================
// Construct
// ============================================================================

void SHktWorldStatePanel::Construct(const FArguments& InArgs)
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
                .ColorAndOpacity(FSlateColor(WSColors::FieldName))
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
                .ColorAndOpacity(FSlateColor(WSColors::Key))
            ]
            + SHorizontalBox::Slot()
            .AutoWidth()
            .VAlign(VAlign_Center)
            [
                SAssignNew(EntityCountText, STextBlock)
                .Font(FCoreStyle::GetDefaultFontStyle("Regular", 10))
                .ColorAndOpacity(FSlateColor(WSColors::Header))
            ]
        ]

        // ── 필터 바 ──
        + SVerticalBox::Slot()
        .AutoHeight()
        .Padding(4, 0, 4, 4)
        [
            SNew(SSearchBox)
            .HintText(LOCTEXT("FilterHint", "Filter entities..."))
            .OnTextChanged_Lambda([this](const FText& Text)
            {
                FilterText = Text.ToString();
                RebuildFilteredRows();
            })
        ]

        // ── 상단 목록 + 하단 상세 (SSplitter로 크기 조절 가능) ──
        + SVerticalBox::Slot()
        .FillHeight(1.0f)
        [
            SNew(SSplitter)
            .Orientation(Orient_Vertical)

            + SSplitter::Slot()
            .Value(0.6f)
            [
                SAssignNew(ListView, SListView<TSharedPtr<FHktWorldStateEntityRow>>)
                .ListItemsSource(&FilteredRows)
                .OnGenerateRow(this, &SHktWorldStatePanel::OnGenerateRow)
                .OnSelectionChanged_Lambda([this](TSharedPtr<FHktWorldStateEntityRow> Item, ESelectInfo::Type SelectInfo)
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
                        .FillWidth(1.2f)
                    + SHeaderRow::Column(TEXT("Archetype"))
                        .DefaultLabel(LOCTEXT("ColArchetype", "Archetype"))
                        .FillWidth(0.6f)
                    + SHeaderRow::Column(TEXT("Owner"))
                        .DefaultLabel(LOCTEXT("ColOwner", "Owner"))
                        .FillWidth(0.8f)
                )
            ]

            + SSplitter::Slot()
            .Value(0.4f)
            [
                SAssignNew(DetailContainer, SVerticalBox)
            ]
        ]
    ];

    CachedVersion = FHktCoreDataCollector::Get().GetVersion();
    RebuildSourceOptions();
    RefreshData();
    BuildDetailPanel();

    // 0.1초 Version 폴링
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

void SHktWorldStatePanel::RebuildSourceOptions()
{
    TArray<FString> Categories = FHktCoreDataCollector::Get().GetCategories();
    TArray<FString> WsSources;
    for (const FString& Cat : Categories)
    {
        if (Cat.StartsWith(TEXT("WorldState.")))
        {
            WsSources.AddUnique(Cat.Mid(11));
        }
    }

    bool bChanged = WsSources.Num() != SourceOptions.Num();
    if (!bChanged)
    {
        for (int32 i = 0; i < WsSources.Num(); ++i)
        {
            if (*SourceOptions[i] != WsSources[i]) { bChanged = true; break; }
        }
    }

    if (bChanged)
    {
        SourceOptions.Reset();
        for (const FString& S : WsSources)
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

void SHktWorldStatePanel::RefreshData()
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
            return;
        }
    }

    const FString Category = FString::Printf(TEXT("WorldState.%s"), *SelectedSource);
    TArray<TPair<FString, FString>> Entries = FHktCoreDataCollector::Get().GetEntries(Category);

    // ── 파싱 ──
    FString FrameStr, CountStr;
    TMap<FString, TMap<FString, FString>> ParsedEntities;
    TSet<FString> SeenProps;
    TArray<FString> NewPropertyOrder;

    // 메타 필드는 별도 표시 (헤더/컬럼)하므로 프로퍼티 목록에서 제외
    SeenProps.Add(TEXT("Owner"));
    SeenProps.Add(TEXT("Archetype"));
    SeenProps.Add(TEXT("DebugName"));
    SeenProps.Add(TEXT("ClassTag"));
    SeenProps.Add(TEXT("StoryTag"));
    SeenProps.Add(TEXT("CreationFrame"));
    SeenProps.Add(TEXT("Tags"));

    for (const auto& Entry : Entries)
    {
        if (Entry.Key == TEXT("_Frame"))       { FrameStr = Entry.Value; continue; }
        if (Entry.Key == TEXT("_EntityCount")) { CountStr = Entry.Value; continue; }
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

                // Tag 프로퍼티는 NetIndex → 태그 이름으로 변환
                if (IsTagProperty(PropName))
                {
                    PropValue = ResolveTagNetIndex(PropValue);
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

    // 프로퍼티를 Tier별로 분류 (ID 순 정렬)
    TArray<FString> NewHotProps;
    TArray<FString> NewColdProps;
    for (const FString& PropName : NewPropertyOrder)
    {
        const FHktPropertyDef* Def = HktProperty::FindByName(PropName);
        if (Def && Def->IsHot())
            NewHotProps.Add(PropName);
        else
            NewColdProps.Add(PropName);
    }
    // ID 순 정렬
    auto SortByPropId = [](TArray<FString>& Props)
    {
        Props.Sort([](const FString& A, const FString& B)
        {
            const FHktPropertyDef* DA = HktProperty::FindByName(A);
            const FHktPropertyDef* DB = HktProperty::FindByName(B);
            uint16 IdA = DA ? DA->Id : 0xFFFF;
            uint16 IdB = DB ? DB->Id : 0xFFFF;
            return IdA < IdB;
        });
    };
    SortByPropId(NewHotProps);
    SortByPropId(NewColdProps);

    // ── 메타 갱신 ──
    FrameText->SetText(FText::FromString(
        FrameStr.IsEmpty() ? TEXT("") : FString::Printf(TEXT("Frame: %s"), *FrameStr)));
    EntityCountText->SetText(FText::FromString(
        CountStr.IsEmpty() ? TEXT("") : FString::Printf(TEXT("  Entities: %s"), *CountStr)));

    // ── 엔티티 셋 변경 감지 & Props in-place 갱신 ──
    bool bEntitySetChanged = false;

    // 제거된 엔티티
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

    // 추가 & 기존 Props 갱신
    for (auto& KV : ParsedEntities)
    {
        if (TSharedPtr<FHktWorldStateEntityRow>* Existing = EntityRowMap.Find(KV.Key))
        {
            // 기존 엔티티: Props만 갱신 (포인터 안정, 람다가 자동으로 최신 값 읽음)
            (*Existing)->Props = MoveTemp(KV.Value);
        }
        else
        {
            // 신규 엔티티
            TSharedPtr<FHktWorldStateEntityRow> Row = MakeShared<FHktWorldStateEntityRow>();
            Row->EntityKey = KV.Key;
            Row->Props = MoveTemp(KV.Value);
            EntityRowMap.Add(KV.Key, Row);
            bEntitySetChanged = true;
        }
    }

    // ── 상단 리스트: 엔티티 추가/삭제 시에만 갱신 ──
    if (bEntitySetChanged)
    {
        AllRows.Reset();
        for (auto& KV : EntityRowMap)
        {
            AllRows.Add(KV.Value);
        }
        AllRows.Sort([](const TSharedPtr<FHktWorldStateEntityRow>& A,
                        const TSharedPtr<FHktWorldStateEntityRow>& B)
        {
            int32 IdA = FCString::Atoi(*A->EntityKey.Mid(2));
            int32 IdB = FCString::Atoi(*B->EntityKey.Mid(2));
            return IdA < IdB;
        });

        RebuildFilteredRows();

        // 선택 복원
        if (!SelectedEntityKey.IsEmpty())
        {
            if (TSharedPtr<FHktWorldStateEntityRow>* SelRow = EntityRowMap.Find(SelectedEntityKey))
            {
                ListView->SetSelection(*SelRow, ESelectInfo::Direct);
            }
            else
            {
                // 선택된 엔티티가 제거됨
                SelectedEntityKey.Empty();
                BuildDetailPanel();
            }
        }
    }

    // 프로퍼티 목록 갱신 (Detail 재구성은 엔티티 선택 변경 시에만)
    HotPropertyNames = MoveTemp(NewHotProps);
    ColdPropertyNames = MoveTemp(NewColdProps);
}

// ============================================================================
// Entity List (상단)
// ============================================================================

void SHktWorldStatePanel::RebuildFilteredRows()
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
                        bMatch = true;
                        break;
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

TSharedRef<ITableRow> SHktWorldStatePanel::OnGenerateRow(
    TSharedPtr<FHktWorldStateEntityRow> Item,
    const TSharedRef<STableViewBase>& OwnerTable)
{
    class SEntityRow : public SMultiColumnTableRow<TSharedPtr<FHktWorldStateEntityRow>>
    {
    public:
        SLATE_BEGIN_ARGS(SEntityRow) {}
        SLATE_END_ARGS()

        void Construct(const FArguments& InArgs,
                       const TSharedRef<STableViewBase>& InOwnerTable,
                       TSharedPtr<FHktWorldStateEntityRow> InItem)
        {
            Item = InItem;
            SMultiColumnTableRow::Construct(FSuperRowType::FArguments(), InOwnerTable);
        }

        virtual TSharedRef<SWidget> GenerateWidgetForColumn(const FName& ColumnName) override
        {
            FString ColStr = ColumnName.ToString();

            if (ColStr == TEXT("_Entity"))
            {
                // Entity 컬럼: EntityKey + DebugName (있으면)
                TWeakPtr<FHktWorldStateEntityRow> WeakItem = Item;
                return SNew(STextBlock)
                    .Text(TAttribute<FText>::CreateLambda([WeakItem]()
                    {
                        if (auto E = WeakItem.Pin())
                        {
                            if (const FString* DN = E->Props.Find(TEXT("DebugName")))
                            {
                                return FText::FromString(FString::Printf(TEXT("%s  [%s]"), *E->EntityKey, **DN));
                            }
                            return FText::FromString(E->EntityKey);
                        }
                        return FText::GetEmpty();
                    }))
                    .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                    .ColorAndOpacity(FSlateColor(WSColors::Key))
                    .Margin(FMargin(4, 1));
            }

            // Archetype 컬럼: 보라색으로 표시
            if (ColStr == TEXT("Archetype"))
            {
                TWeakPtr<FHktWorldStateEntityRow> WeakItem2 = Item;
                return SNew(STextBlock)
                    .Text(TAttribute<FText>::CreateLambda([WeakItem2]()
                    {
                        if (auto E = WeakItem2.Pin())
                        {
                            if (const FString* V = E->Props.Find(TEXT("Archetype")))
                                return FText::FromString(*V);
                        }
                        return FText::FromString(TEXT("-"));
                    }))
                    .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                    .ColorAndOpacity(FSlateColor(WSColors::ArchetypeValue))
                    .Margin(FMargin(4, 1));
            }

            // TAttribute 람다로 값 실시간 갱신 (행 재생성 없이)
            TWeakPtr<FHktWorldStateEntityRow> WeakItem = Item;
            FString CapturedCol = ColStr;

            return SNew(STextBlock)
                .Text(TAttribute<FText>::CreateLambda([WeakItem, CapturedCol]()
                {
                    if (auto E = WeakItem.Pin())
                    {
                        if (const FString* V = E->Props.Find(CapturedCol))
                            return FText::FromString(*V);
                    }
                    return FText::FromString(TEXT("-"));
                }))
                .Font(FCoreStyle::GetDefaultFontStyle("Regular", 9))
                .ColorAndOpacity(FSlateColor(WSColors::Value))
                .Margin(FMargin(4, 1));
        }

        TSharedPtr<FHktWorldStateEntityRow> Item;
    };

    return SNew(SEntityRow, OwnerTable, Item);
}

// ============================================================================
// Detail Panel (하단) — 엔티티 선택 시에만 위젯 재구성, 값은 TAttribute 람다
// ============================================================================

void SHktWorldStatePanel::BuildDetailPanel()
{
    DetailContainer->ClearChildren();

    if (SelectedEntityKey.IsEmpty())
    {
        DetailContainer->AddSlot()
        .AutoHeight()
        .Padding(4.f)
        [
            SNew(STextBlock)
            .Text(LOCTEXT("NoSelection", "Select an entity to view details"))
            .ColorAndOpacity(FSlateColor(WSColors::Dim))
            .Font(FCoreStyle::GetDefaultFontStyle("Italic", 9))
        ];
        return;
    }

    // 선택된 엔티티 Row 찾기 (안정적 포인터)
    TSharedPtr<FHktWorldStateEntityRow> Entity;
    if (TSharedPtr<FHktWorldStateEntityRow>* Found = EntityRowMap.Find(SelectedEntityKey))
    {
        Entity = *Found;
    }
    if (!Entity.IsValid()) return;

    TWeakPtr<FHktWorldStateEntityRow> WeakEntity = Entity;

    // ── 헤더: Entity — DebugName 실시간 반영 ──
    DetailContainer->AddSlot()
    .AutoHeight()
    .Padding(4, 2, 4, 2)
    [
        SNew(STextBlock)
        .Text(TAttribute<FText>::CreateLambda([WeakEntity]()
        {
            if (auto E = WeakEntity.Pin())
            {
                FString Header = E->EntityKey;
                if (const FString* DN = E->Props.Find(TEXT("DebugName")))
                {
                    Header += FString::Printf(TEXT("  —  %s"), **DN);
                }
                return FText::FromString(Header);
            }
            return FText::GetEmpty();
        }))
        .Font(FCoreStyle::GetDefaultFontStyle("Bold", 11))
        .ColorAndOpacity(FSlateColor(WSColors::Key))
    ];

    // ── 서브 헤더: Archetype / ClassTag / StoryTag / CreationFrame ──
    DetailContainer->AddSlot()
    .AutoHeight()
    .Padding(4, 0, 4, 4)
    [
        SNew(STextBlock)
        .Text(TAttribute<FText>::CreateLambda([WeakEntity]()
        {
            if (auto E = WeakEntity.Pin())
            {
                TArray<FString> Parts;
                if (const FString* AT = E->Props.Find(TEXT("Archetype")))
                {
                    Parts.Add(FString::Printf(TEXT("Archetype: %s"), **AT));
                }
                if (const FString* CT = E->Props.Find(TEXT("ClassTag")))
                {
                    Parts.Add(FString::Printf(TEXT("Class: %s"), **CT));
                }
                if (const FString* ST = E->Props.Find(TEXT("StoryTag")))
                {
                    Parts.Add(FString::Printf(TEXT("Story: %s"), **ST));
                }
                if (const FString* CF = E->Props.Find(TEXT("CreationFrame")))
                {
                    Parts.Add(FString::Printf(TEXT("Born: F%s"), **CF));
                }
                if (const FString* TG = E->Props.Find(TEXT("Tags")))
                {
                    if (!TG->IsEmpty())
                    {
                        Parts.Add(FString::Printf(TEXT("Tags: %s"), **TG));
                    }
                }
                if (Parts.Num() > 0)
                {
                    return FText::FromString(FString::Join(Parts, TEXT("  |  ")));
                }
            }
            return FText::GetEmpty();
        }))
        .Font(FCoreStyle::GetDefaultFontStyle("Regular", 9))
        .ColorAndOpacity(FSlateColor(WSColors::DebugValue))
    ];

    // ── 프로퍼티 목록 — Tier별 섹션, 위젯 1회 생성, 값은 TAttribute 람다 ──
    TSharedRef<SScrollBox> PropsScroll = SNew(SScrollBox);

    // 섹션 헤더 + 프로퍼티 행 추가 헬퍼
    auto AddSectionHeader = [&PropsScroll](const FText& Title)
    {
        PropsScroll->AddSlot()
        .Padding(4, 6, 4, 2)
        [
            SNew(STextBlock)
            .Text(Title)
            .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
            .ColorAndOpacity(FSlateColor(WSColors::SectionHeader))
        ];
    };

    auto AddPropRow = [&PropsScroll, &WeakEntity](const FString& PropName, EHktPropertyTier Tier)
    {
        FString CapturedProp = PropName;
        FSlateColor ValColor = GetPropValueColor(PropName, Tier);

        PropsScroll->AddSlot()
        .Padding(4, 1)
        [
            SNew(SHorizontalBox)

            // 프로퍼티 이름 (고정)
            + SHorizontalBox::Slot()
            .AutoWidth()
            [
                SNew(SBox)
                .MinDesiredWidth(120.f)
                [
                    SNew(STextBlock)
                    .Text(FText::FromString(PropName))
                    .Font(FCoreStyle::GetDefaultFontStyle("Regular", 9))
                    .ColorAndOpacity(FSlateColor(WSColors::FieldName))
                ]
            ]

            // 프로퍼티 값 (TAttribute 람다 — Props 변경 시 자동 반영)
            + SHorizontalBox::Slot()
            .FillWidth(1.0f)
            [
                SNew(STextBlock)
                .Text(TAttribute<FText>::CreateLambda([WeakEntity, CapturedProp]()
                {
                    if (auto E = WeakEntity.Pin())
                    {
                        if (const FString* V = E->Props.Find(CapturedProp))
                            return FText::FromString(*V);
                    }
                    return FText::FromString(TEXT("-"));
                }))
                .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                .ColorAndOpacity(ValColor)
            ]
        ];
    };

    // Hot 섹션
    if (HotPropertyNames.Num() > 0)
    {
        AddSectionHeader(FText::FromString(FString::Printf(TEXT("Hot Properties (%d)"), HotPropertyNames.Num())));
        for (const FString& PropName : HotPropertyNames)
        {
            AddPropRow(PropName, EHktPropertyTier::Hot);
        }
    }

    // Cold 섹션
    if (ColdPropertyNames.Num() > 0)
    {
        AddSectionHeader(FText::FromString(FString::Printf(TEXT("Cold Properties (%d)"), ColdPropertyNames.Num())));
        for (const FString& PropName : ColdPropertyNames)
        {
            AddPropRow(PropName, EHktPropertyTier::Cold);
        }
    }

    DetailContainer->AddSlot()
    .FillHeight(1.0f)
    .Padding(2.f)
    [
        PropsScroll
    ];
}

#undef LOCTEXT_NAMESPACE
