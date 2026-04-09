// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Slate/SHktVMStatePanel.h"
#include "HktCoreDataCollector.h"
#include "Widgets/Input/SComboBox.h"
#include "Widgets/Input/SSearchBox.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Layout/SSplitter.h"
#include "Widgets/Text/STextBlock.h"

#define LOCTEXT_NAMESPACE "HktVMStatePanel"

// ── 컬러 팔레트 ──
namespace VMColors
{
    static const FLinearColor EntityKey(0.4f, 0.85f, 1.0f);      // Cyan
    static const FLinearColor EntityDim(0.55f, 0.7f, 0.8f);      // Dim cyan (VM 없는 entity)
    static const FLinearColor VMKey(0.85f, 0.7f, 1.0f);          // Light purple
    static const FLinearColor Header(0.7f, 0.7f, 0.75f);         // Gray
    static const FLinearColor Value(0.88f, 0.88f, 0.88f);        // Light gray
    static const FLinearColor FieldName(0.5f, 0.5f, 0.58f);      // Dim gray
    static const FLinearColor Dim(0.4f, 0.4f, 0.4f);             // Dark gray
    static const FLinearColor SectionHeader(0.95f, 0.85f, 0.4f); // Yellow
    static const FLinearColor Running(0.4f, 0.9f, 0.4f);         // Green
    static const FLinearColor Blocked(0.9f, 0.6f, 0.2f);         // Orange
    static const FLinearColor Yielded(0.85f, 0.85f, 0.4f);       // Yellow
    static const FLinearColor Failed(0.9f, 0.3f, 0.3f);          // Red
    static const FLinearColor Archetype(0.85f, 0.65f, 1.0f);     // Purple (Archetype)
}

static FSlateColor GetStatusColor(const FString& Status)
{
    if (Status == TEXT("Running") || Status == TEXT("Ready"))  return FSlateColor(VMColors::Running);
    if (Status == TEXT("Blocked"))   return FSlateColor(VMColors::Blocked);
    if (Status == TEXT("Yielded"))   return FSlateColor(VMColors::Yielded);
    if (Status == TEXT("Failed"))    return FSlateColor(VMColors::Failed);
    return FSlateColor(VMColors::Value);
}

static FSlateColor GetStatusColorFromRow(TWeakPtr<FHktVMRow> WeakRow)
{
    if (auto R = WeakRow.Pin())
    {
        if (const FString* S = R->Props.Find(TEXT("Status")))
        {
            return GetStatusColor(*S);
        }
    }
    return FSlateColor(VMColors::Value);
}

// ============================================================================
// Construct / Destruct
// ============================================================================

SHktVMStatePanel::~SHktVMStatePanel()
{
    FHktCoreDataCollector::Get().DisableCollection(TEXT("VMDetail"));
}

void SHktVMStatePanel::Construct(const FArguments& InArgs)
{
    FHktCoreDataCollector::Get().EnableCollection(TEXT("VMDetail"));

    ChildSlot
    [
        SNew(SVerticalBox)

        // ── 헤더 바: Source 선택 + 요약 ──
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
                        // Source 변경 시 전체 재구성
                        EntityRowMap.Empty();
                        VMRowMap.Empty();
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
            .FillWidth(1.0f)
            .VAlign(VAlign_Center)
            [
                SAssignNew(SummaryText, STextBlock)
                .Font(FCoreStyle::GetDefaultFontStyle("Bold", 10))
                .ColorAndOpacity(FSlateColor(VMColors::Header))
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
                RebuildFilteredEntityRows();
            })
        ]

        // ── 메인: 상단(Entity + VM 리스트) / 하단(상세) ──
        + SVerticalBox::Slot()
        .FillHeight(1.0f)
        [
            SNew(SSplitter)
            .Orientation(Orient_Vertical)

            + SSplitter::Slot()
            .Value(0.45f)
            [
                SNew(SSplitter)
                .Orientation(Orient_Horizontal)

                // 좌: Entity 리스트
                + SSplitter::Slot()
                .Value(0.4f)
                [
                    SNew(SVerticalBox)
                    + SVerticalBox::Slot()
                    .AutoHeight()
                    .Padding(4, 2)
                    [
                        SNew(STextBlock)
                        .Text(LOCTEXT("EntityListHeader", "Entities"))
                        .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                        .ColorAndOpacity(FSlateColor(VMColors::SectionHeader))
                    ]
                    + SVerticalBox::Slot()
                    .FillHeight(1.0f)
                    [
                        SAssignNew(EntityListView, SListView<TSharedPtr<FHktVMEntityRow>>)
                        .ListItemsSource(&FilteredEntityRows)
                        .OnGenerateRow(this, &SHktVMStatePanel::OnGenerateEntityRow)
                        .OnSelectionChanged_Lambda([this](TSharedPtr<FHktVMEntityRow> Item, ESelectInfo::Type SelectInfo)
                        {
                            if (SelectInfo == ESelectInfo::Direct) return;
                            SelectedEntityKey = Item.IsValid() ? Item->EntityKey : FString();
                            SelectedVMKey.Empty();
                            DetailBoundVMKey.Empty();
                            RebuildVMList();
                            BuildDetailPanel();
                        })
                        .SelectionMode(ESelectionMode::Single)
                    ]
                ]

                // 우: VM 리스트
                + SSplitter::Slot()
                .Value(0.6f)
                [
                    SNew(SVerticalBox)
                    + SVerticalBox::Slot()
                    .AutoHeight()
                    .Padding(4, 2)
                    [
                        SNew(STextBlock)
                        .Text(LOCTEXT("VMListHeader", "Active VMs"))
                        .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                        .ColorAndOpacity(FSlateColor(VMColors::SectionHeader))
                    ]
                    + SVerticalBox::Slot()
                    .FillHeight(1.0f)
                    [
                        SAssignNew(VMListView, SListView<TSharedPtr<FHktVMRow>>)
                        .ListItemsSource(&FilteredVMRows)
                        .OnGenerateRow(this, &SHktVMStatePanel::OnGenerateVMRow)
                        .OnSelectionChanged_Lambda([this](TSharedPtr<FHktVMRow> Item, ESelectInfo::Type SelectInfo)
                        {
                            if (SelectInfo == ESelectInfo::Direct) return;
                            SelectedVMKey = Item.IsValid() ? Item->VMKey : FString();
                            BuildDetailPanel();
                        })
                        .SelectionMode(ESelectionMode::Single)
                    ]
                ]
            ]

            // 하: VM 상세
            + SSplitter::Slot()
            .Value(0.55f)
            [
                SNew(SScrollBox)
                + SScrollBox::Slot()
                [
                    SAssignNew(DetailContainer, SVerticalBox)
                ]
            ]
        ]
    ];

    CachedVersion = FHktCoreDataCollector::Get().GetVersion();
    RebuildSourceOptions();
    RefreshData();

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

void SHktVMStatePanel::RebuildSourceOptions()
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
// Data Refresh — stable pointer 유지, 값만 in-place 갱신
// ============================================================================

void SHktVMStatePanel::RefreshData()
{
    if (SelectedSource.IsEmpty())
    {
        RebuildSourceOptions();
        if (SelectedSource.IsEmpty()) return;
    }

    // ── 1. WorldState에서 전체 Entity 목록 읽기 ──
    const FString WsCategory = FString::Printf(TEXT("WorldState.%s"), *SelectedSource);
    TArray<TPair<FString, FString>> WsEntries = FHktCoreDataCollector::Get().GetEntries(WsCategory);

    TSet<FString> CurrentEntityKeys;
    bool bEntityAdded = false;
    for (const auto& Entry : WsEntries)
    {
        if (!Entry.Key.StartsWith(TEXT("E_"))) continue;
        CurrentEntityKeys.Add(Entry.Key);

        // DebugName, Archetype 파싱
        FString DebugName;
        FString Archetype;
        TArray<FString> Segments;
        Entry.Value.ParseIntoArray(Segments, TEXT("|"), true);
        for (FString& Seg : Segments)
        {
            Seg.TrimStartAndEndInline();
            if (Seg.StartsWith(TEXT("DebugName=")))
            {
                DebugName = Seg.Mid(10);
            }
            else if (Seg.StartsWith(TEXT("Archetype=")))
            {
                Archetype = Seg.Mid(10);
            }
        }

        if (TSharedPtr<FHktVMEntityRow>* Existing = EntityRowMap.Find(Entry.Key))
        {
            // 기존: DebugName, Archetype 갱신 (VMCount/VMNames는 아래에서 갱신)
            (*Existing)->DebugName = DebugName;
            (*Existing)->Archetype = Archetype;
        }
        else
        {
            // 신규
            TSharedPtr<FHktVMEntityRow> Row = MakeShared<FHktVMEntityRow>();
            Row->EntityKey = Entry.Key;
            Row->DebugName = DebugName;
            Row->Archetype = Archetype;
            EntityRowMap.Add(Entry.Key, Row);
            bEntityAdded = true;
        }
    }

    // 제거된 entity
    bool bEntitySetChanged = false;
    {
        TArray<FString> ToRemove;
        for (auto& KV : EntityRowMap)
        {
            if (!CurrentEntityKeys.Contains(KV.Key))
            {
                ToRemove.Add(KV.Key);
                bEntitySetChanged = true;
            }
        }
        for (const FString& Key : ToRemove)
        {
            EntityRowMap.Remove(Key);
        }
        if (bEntityAdded)
        {
            bEntitySetChanged = true;  // 신규 추가 감지
        }
    }

    // ── 2. VMDetail에서 VM 데이터 읽기 ──
    TArray<TPair<FString, FString>> VMEntries = FHktCoreDataCollector::Get().GetEntries(TEXT("VMDetail"));

    // Entity별 VM 요약 수집
    TMap<FString, TPair<int32, FString>> VMSummaryMap;  // EntityKey → (Count, Names)
    TSet<FString> CurrentVMKeys;

    for (const auto& Entry : VMEntries)
    {
        if (Entry.Key.StartsWith(TEXT("E_")))
        {
            // Entity 요약 행
            int32 Count = 0;
            FString Names;
            TArray<FString> Segments;
            Entry.Value.ParseIntoArray(Segments, TEXT("|"), true);
            for (FString& Seg : Segments)
            {
                Seg.TrimStartAndEndInline();
                int32 EqIdx;
                if (Seg.FindChar(TEXT('='), EqIdx) && EqIdx > 0)
                {
                    FString Field = Seg.Left(EqIdx);
                    FString Val = Seg.Mid(EqIdx + 1);
                    if (Field == TEXT("VMCount"))  Count = FCString::Atoi(*Val);
                    else if (Field == TEXT("Names"))  Names = Val;
                }
            }
            VMSummaryMap.Add(Entry.Key, TPair<int32, FString>(Count, Names));
        }
        else if (Entry.Key.StartsWith(TEXT("VM_")))
        {
            CurrentVMKeys.Add(Entry.Key);

            // Props 파싱
            TMap<FString, FString> NewProps;
            FString SrcEntityKey;
            TArray<FString> Segments;
            Entry.Value.ParseIntoArray(Segments, TEXT("|"), true);
            for (FString& Seg : Segments)
            {
                Seg.TrimStartAndEndInline();
                int32 EqIdx;
                if (Seg.FindChar(TEXT('='), EqIdx) && EqIdx > 0)
                {
                    FString Field = Seg.Left(EqIdx);
                    FString Val = Seg.Mid(EqIdx + 1);
                    NewProps.Add(Field, Val);
                    if (Field == TEXT("Src"))
                    {
                        SrcEntityKey = FString::Printf(TEXT("E_%s"), *Val);
                    }
                }
            }

            if (TSharedPtr<FHktVMRow>* Existing = VMRowMap.Find(Entry.Key))
            {
                // 기존 VM: Props만 in-place 갱신
                (*Existing)->Props = MoveTemp(NewProps);
                (*Existing)->EntityKey = SrcEntityKey;
            }
            else
            {
                // 신규 VM
                TSharedPtr<FHktVMRow> Row = MakeShared<FHktVMRow>();
                Row->VMKey = Entry.Key;
                Row->EntityKey = SrcEntityKey;
                Row->Props = MoveTemp(NewProps);
                VMRowMap.Add(Entry.Key, Row);
            }
        }
    }

    // 제거된 VM
    bool bVMSetChanged = false;
    {
        TArray<FString> ToRemove;
        for (auto& KV : VMRowMap)
        {
            if (!CurrentVMKeys.Contains(KV.Key))
            {
                ToRemove.Add(KV.Key);
                bVMSetChanged = true;
            }
        }
        for (const FString& Key : ToRemove)
        {
            VMRowMap.Remove(Key);
        }
        if (CurrentVMKeys.Num() != VMRowMap.Num())
        {
            bVMSetChanged = true;
        }
    }

    // ── 3. Entity에 VM 요약 in-place 병합 ──
    for (auto& KV : EntityRowMap)
    {
        if (const TPair<int32, FString>* Summary = VMSummaryMap.Find(KV.Key))
        {
            KV.Value->VMCount = Summary->Key;
            KV.Value->VMNames = Summary->Value;
        }
        else
        {
            KV.Value->VMCount = 0;
            KV.Value->VMNames.Empty();
        }
    }

    // ── 4. Entity 셋 변경 시에만 리스트 재구성 ──
    if (bEntitySetChanged)
    {
        AllEntityRows.Reset();
        for (auto& KV : EntityRowMap)
        {
            AllEntityRows.Add(KV.Value);
        }
        AllEntityRows.Sort([](const TSharedPtr<FHktVMEntityRow>& A, const TSharedPtr<FHktVMEntityRow>& B)
        {
            int32 IdA = FCString::Atoi(*A->EntityKey.Mid(2));
            int32 IdB = FCString::Atoi(*B->EntityKey.Mid(2));
            return IdA < IdB;
        });

        RebuildFilteredEntityRows();

        // 선택 복원
        if (!SelectedEntityKey.IsEmpty())
        {
            if (TSharedPtr<FHktVMEntityRow>* SelRow = EntityRowMap.Find(SelectedEntityKey))
            {
                EntityListView->SetSelection(*SelRow, ESelectInfo::Direct);
            }
            else
            {
                SelectedEntityKey.Empty();
                SelectedVMKey.Empty();
                DetailBoundVMKey.Empty();
            }
        }
    }

    // ── 5. VM 셋 변경 시에만 리스트 재구성 ──
    if (bVMSetChanged)
    {
        AllVMRows.Reset();
        for (auto& KV : VMRowMap)
        {
            AllVMRows.Add(KV.Value);
        }

        RebuildVMList();

        // VM 선택 복원
        if (!SelectedVMKey.IsEmpty())
        {
            if (TSharedPtr<FHktVMRow>* SelRow = VMRowMap.Find(SelectedVMKey))
            {
                VMListView->SetSelection(*SelRow, ESelectInfo::Direct);
            }
            else
            {
                SelectedVMKey.Empty();
            }
        }
    }

    // 요약 텍스트
    SummaryText->SetText(FText::FromString(
        FString::Printf(TEXT("Active VMs: %d  |  Entities: %d"), VMRowMap.Num(), EntityRowMap.Num())));

    // Detail 패널: VM이 바뀌었거나 아직 바인딩 안 되었으면 재구성
    if (SelectedVMKey != DetailBoundVMKey)
    {
        BuildDetailPanel();
    }
    // 동일 VM이면 TAttribute 람다가 자동으로 최신 Props를 읽으므로 재구성 불필요
}

// ============================================================================
// Entity 필터
// ============================================================================

void SHktVMStatePanel::RebuildFilteredEntityRows()
{
    FilteredEntityRows.Reset();

    if (FilterText.IsEmpty())
    {
        FilteredEntityRows = AllEntityRows;
    }
    else
    {
        for (const auto& Row : AllEntityRows)
        {
            bool bMatch = Row->EntityKey.Contains(FilterText)
                || Row->DebugName.Contains(FilterText)
                || Row->VMNames.Contains(FilterText)
                || Row->Archetype.Contains(FilterText);
            if (bMatch)
            {
                FilteredEntityRows.Add(Row);
            }
        }
    }

    EntityListView->RequestListRefresh();
}

// ============================================================================
// VM List (선택된 Entity의 VM만 필터링)
// ============================================================================

void SHktVMStatePanel::RebuildVMList()
{
    FilteredVMRows.Reset();

    if (SelectedEntityKey.IsEmpty())
    {
        // Entity 미선택 시 VM 리스트 비움
    }
    else
    {
        for (const auto& Row : AllVMRows)
        {
            if (Row->EntityKey == SelectedEntityKey)
            {
                FilteredVMRows.Add(Row);
            }
        }
    }

    VMListView->RequestListRefresh();
}

// ============================================================================
// Entity Row — TAttribute 람다로 값 실시간 갱신 (행 위젯 재생성 없음)
// ============================================================================

TSharedRef<ITableRow> SHktVMStatePanel::OnGenerateEntityRow(
    TSharedPtr<FHktVMEntityRow> Item,
    const TSharedRef<STableViewBase>& OwnerTable)
{
    TWeakPtr<FHktVMEntityRow> WeakItem = Item;

    return SNew(STableRow<TSharedPtr<FHktVMEntityRow>>, OwnerTable)
    [
        SNew(SHorizontalBox)

        // Entity Key + DebugName + VM 요약
        + SHorizontalBox::Slot()
        .FillWidth(1.0f)
        [
            SNew(STextBlock)
            .Text(TAttribute<FText>::CreateLambda([WeakItem]()
            {
                if (auto E = WeakItem.Pin())
                {
                    FString Label = E->EntityKey;
                    if (!E->DebugName.IsEmpty())
                    {
                        Label += FString::Printf(TEXT("  [%s]"), *E->DebugName);
                    }
                    if (E->VMCount > 0)
                    {
                        Label += FString::Printf(TEXT("  (%d VMs) %s"), E->VMCount, *E->VMNames);
                    }
                    return FText::FromString(Label);
                }
                return FText::GetEmpty();
            }))
            .ColorAndOpacity(TAttribute<FSlateColor>::CreateLambda([WeakItem]()
            {
                if (auto E = WeakItem.Pin())
                {
                    return FSlateColor((E->VMCount > 0) ? VMColors::EntityKey : VMColors::EntityDim);
                }
                return FSlateColor(VMColors::EntityDim);
            }))
            .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
            .Margin(FMargin(4, 2))
        ]

        // Archetype 뱃지
        + SHorizontalBox::Slot()
        .AutoWidth()
        .Padding(4, 2)
        [
            SNew(STextBlock)
            .Text(TAttribute<FText>::CreateLambda([WeakItem]()
            {
                if (auto E = WeakItem.Pin())
                {
                    if (!E->Archetype.IsEmpty())
                        return FText::FromString(E->Archetype);
                }
                return FText::GetEmpty();
            }))
            .Font(FCoreStyle::GetDefaultFontStyle("Regular", 8))
            .ColorAndOpacity(FSlateColor(VMColors::Archetype))
        ]
    ];
}

// ============================================================================
// VM Row — TAttribute 람다로 값 실시간 갱신
// ============================================================================

TSharedRef<ITableRow> SHktVMStatePanel::OnGenerateVMRow(
    TSharedPtr<FHktVMRow> Item,
    const TSharedRef<STableViewBase>& OwnerTable)
{
    TWeakPtr<FHktVMRow> WeakItem = Item;

    return SNew(STableRow<TSharedPtr<FHktVMRow>>, OwnerTable)
    [
        SNew(STextBlock)
        .Text(TAttribute<FText>::CreateLambda([WeakItem]()
        {
            if (auto R = WeakItem.Pin())
            {
                const FString* Status = R->Props.Find(TEXT("Status"));
                const FString* Event = R->Props.Find(TEXT("Event"));
                const FString* PC = R->Props.Find(TEXT("PC"));
                const FString* CodeSize = R->Props.Find(TEXT("CodeSize"));

                return FText::FromString(FString::Printf(TEXT("%s: %s  [%s]  PC=%s/%s"),
                    *R->VMKey,
                    Event ? **Event : TEXT("?"),
                    Status ? **Status : TEXT("?"),
                    PC ? **PC : TEXT("?"),
                    CodeSize ? **CodeSize : TEXT("?")));
            }
            return FText::GetEmpty();
        }))
        .ColorAndOpacity(TAttribute<FSlateColor>::CreateLambda([WeakItem]()
        {
            return GetStatusColorFromRow(WeakItem);
        }))
        .Font(FCoreStyle::GetDefaultFontStyle("Regular", 9))
        .Margin(FMargin(4, 2))
    ];
}

// ============================================================================
// Detail Panel — 위젯 1회 생성, TAttribute 람다로 값 실시간 갱신
// ============================================================================

void SHktVMStatePanel::BuildDetailPanel()
{
    DetailContainer->ClearChildren();
    DetailBoundVMKey = SelectedVMKey;

    if (SelectedVMKey.IsEmpty())
    {
        FText Hint = SelectedEntityKey.IsEmpty()
            ? LOCTEXT("NoEntitySelection", "Select an entity to view its VMs")
            : (FilteredVMRows.Num() > 0
                ? LOCTEXT("SelectVM", "Select a VM to view details")
                : LOCTEXT("NoVMs", "No active VMs for this entity"));

        DetailContainer->AddSlot()
        .AutoHeight()
        .Padding(4.f)
        [
            SNew(STextBlock)
            .Text(Hint)
            .ColorAndOpacity(FSlateColor(VMColors::Dim))
            .Font(FCoreStyle::GetDefaultFontStyle("Italic", 9))
        ];
        return;
    }

    // 선택된 VM 찾기 (stable pointer)
    TSharedPtr<FHktVMRow>* FoundVM = VMRowMap.Find(SelectedVMKey);
    if (!FoundVM || !FoundVM->IsValid()) return;
    TWeakPtr<FHktVMRow> WeakVM = *FoundVM;

    // ── 헤더: VM Key + Event Tag ──
    DetailContainer->AddSlot()
    .AutoHeight()
    .Padding(4, 4, 4, 2)
    [
        SNew(STextBlock)
        .Text(TAttribute<FText>::CreateLambda([WeakVM]()
        {
            if (auto R = WeakVM.Pin())
            {
                const FString* Event = R->Props.Find(TEXT("Event"));
                return FText::FromString(FString::Printf(TEXT("%s  —  %s"),
                    *R->VMKey, Event ? **Event : TEXT("?")));
            }
            return FText::GetEmpty();
        }))
        .Font(FCoreStyle::GetDefaultFontStyle("Bold", 11))
        .ColorAndOpacity(FSlateColor(VMColors::VMKey))
    ];

    // ── 필드 추가 헬퍼 ──
    auto AddField = [this, WeakVM](const FString& Name, const FString& PropKey, FLinearColor FixedColor = VMColors::Value)
    {
        FString CapturedPropKey = PropKey;
        DetailContainer->AddSlot()
        .AutoHeight()
        .Padding(8, 1)
        [
            SNew(SHorizontalBox)
            + SHorizontalBox::Slot()
            .AutoWidth()
            [
                SNew(SBox)
                .MinDesiredWidth(120.f)
                [
                    SNew(STextBlock)
                    .Text(FText::FromString(Name))
                    .Font(FCoreStyle::GetDefaultFontStyle("Regular", 9))
                    .ColorAndOpacity(FSlateColor(VMColors::FieldName))
                ]
            ]
            + SHorizontalBox::Slot()
            .FillWidth(1.0f)
            [
                SNew(STextBlock)
                .Text(TAttribute<FText>::CreateLambda([WeakVM, CapturedPropKey]()
                {
                    if (auto R = WeakVM.Pin())
                    {
                        if (const FString* V = R->Props.Find(CapturedPropKey))
                            return FText::FromString(*V);
                    }
                    return FText::FromString(TEXT("-"));
                }))
                .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                .ColorAndOpacity(FSlateColor(FixedColor))
            ]
        ];
    };

    // Status (색상도 동적)
    {
        DetailContainer->AddSlot()
        .AutoHeight()
        .Padding(8, 1)
        [
            SNew(SHorizontalBox)
            + SHorizontalBox::Slot()
            .AutoWidth()
            [
                SNew(SBox)
                .MinDesiredWidth(120.f)
                [
                    SNew(STextBlock)
                    .Text(FText::FromString(TEXT("Status")))
                    .Font(FCoreStyle::GetDefaultFontStyle("Regular", 9))
                    .ColorAndOpacity(FSlateColor(VMColors::FieldName))
                ]
            ]
            + SHorizontalBox::Slot()
            .FillWidth(1.0f)
            [
                SNew(STextBlock)
                .Text(TAttribute<FText>::CreateLambda([WeakVM]()
                {
                    if (auto R = WeakVM.Pin())
                    {
                        if (const FString* V = R->Props.Find(TEXT("Status")))
                            return FText::FromString(*V);
                    }
                    return FText::FromString(TEXT("-"));
                }))
                .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                .ColorAndOpacity(TAttribute<FSlateColor>::CreateLambda([WeakVM]()
                {
                    return GetStatusColorFromRow(WeakVM);
                }))
            ]
        ];
    }

    // PC (두 필드 결합)
    {
        DetailContainer->AddSlot()
        .AutoHeight()
        .Padding(8, 1)
        [
            SNew(SHorizontalBox)
            + SHorizontalBox::Slot()
            .AutoWidth()
            [
                SNew(SBox)
                .MinDesiredWidth(120.f)
                [
                    SNew(STextBlock)
                    .Text(FText::FromString(TEXT("PC")))
                    .Font(FCoreStyle::GetDefaultFontStyle("Regular", 9))
                    .ColorAndOpacity(FSlateColor(VMColors::FieldName))
                ]
            ]
            + SHorizontalBox::Slot()
            .FillWidth(1.0f)
            [
                SNew(STextBlock)
                .Text(TAttribute<FText>::CreateLambda([WeakVM]()
                {
                    if (auto R = WeakVM.Pin())
                    {
                        const FString* PC = R->Props.Find(TEXT("PC"));
                        const FString* CS = R->Props.Find(TEXT("CodeSize"));
                        return FText::FromString(FString::Printf(TEXT("%s / %s"),
                            PC ? **PC : TEXT("-"), CS ? **CS : TEXT("-")));
                    }
                    return FText::FromString(TEXT("-"));
                }))
                .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                .ColorAndOpacity(FSlateColor(VMColors::Value))
            ]
        ];
    }

    AddField(TEXT("Last Op"), TEXT("Op"));
    AddField(TEXT("Source Entity"), TEXT("Src"));
    AddField(TEXT("Target Entity"), TEXT("Tgt"));
    AddField(TEXT("Creation Frame"), TEXT("CreationFrame"));
    AddField(TEXT("Player UID"), TEXT("PlayerUid"));

    // ── Section Header 헬퍼 ──
    auto AddSectionHeader = [this](const FText& Title)
    {
        DetailContainer->AddSlot()
        .AutoHeight()
        .Padding(4, 6, 4, 2)
        [
            SNew(STextBlock)
            .Text(Title)
            .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
            .ColorAndOpacity(FSlateColor(VMColors::SectionHeader))
        ];
    };

    // ── Registers ──
    AddSectionHeader(LOCTEXT("RegistersHeader", "Registers"));

    // 범용 레지스터 (R0-R8)
    auto AddRegisterRow = [this, WeakVM](const TCHAR* RegNames[], int32 Count)
    {
        TSharedRef<SHorizontalBox> HBox = SNew(SHorizontalBox);
        for (int32 i = 0; i < Count; ++i)
        {
            FString CapturedReg = RegNames[i];
            HBox->AddSlot()
            .AutoWidth()
            .Padding(4, 0)
            [
                SNew(SHorizontalBox)
                + SHorizontalBox::Slot().AutoWidth()
                [
                    SNew(STextBlock)
                    .Text(FText::FromString(FString::Printf(TEXT("%s="), *CapturedReg)))
                    .Font(FCoreStyle::GetDefaultFontStyle("Regular", 9))
                    .ColorAndOpacity(FSlateColor(VMColors::FieldName))
                ]
                + SHorizontalBox::Slot().AutoWidth()
                [
                    SNew(SBox).MinDesiredWidth(50.f)
                    [
                        SNew(STextBlock)
                        .Text(TAttribute<FText>::CreateLambda([WeakVM, CapturedReg]()
                        {
                            if (auto R = WeakVM.Pin())
                            {
                                if (const FString* V = R->Props.Find(CapturedReg))
                                    return FText::FromString(*V);
                            }
                            return FText::FromString(TEXT("-"));
                        }))
                        .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                        .ColorAndOpacity(FSlateColor(VMColors::Value))
                    ]
                ]
            ];
        }
        DetailContainer->AddSlot().AutoHeight().Padding(4, 1) [ HBox ];
    };

    {
        const TCHAR* Row1[] = { TEXT("R0"), TEXT("R1"), TEXT("R2"), TEXT("R3"), TEXT("R4") };
        const TCHAR* Row2[] = { TEXT("R5"), TEXT("R6"), TEXT("R7"), TEXT("R8") };
        AddRegisterRow(Row1, 5);
        AddRegisterRow(Row2, 4);
    }

    // 특수 레지스터
    {
        const TCHAR* Row1[] = { TEXT("Self"), TEXT("Target"), TEXT("Spawned") };
        const TCHAR* Row2[] = { TEXT("Hit"), TEXT("Iter"), TEXT("Flag") };
        AddRegisterRow(Row1, 3);
        AddRegisterRow(Row2, 3);
    }

    // ── Wait State ──
    AddSectionHeader(LOCTEXT("WaitStateHeader", "Wait State"));
    AddField(TEXT("Type"), TEXT("WaitType"));
    AddField(TEXT("Watched Entity"), TEXT("WaitEntity"));
    AddField(TEXT("Remaining Time"), TEXT("WaitTime"));
    AddField(TEXT("Wait Frames"), TEXT("WaitFrames"));

    // ── Context Params ──
    AddSectionHeader(LOCTEXT("ContextHeader", "Context Params"));
    AddField(TEXT("Param0"), TEXT("Param0"));
    AddField(TEXT("Param1"), TEXT("Param1"));
    AddField(TEXT("TargetPos"), TEXT("TargetPos"));
}

#undef LOCTEXT_NAMESPACE
