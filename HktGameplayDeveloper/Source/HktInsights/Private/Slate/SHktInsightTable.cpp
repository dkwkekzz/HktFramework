// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Slate/SHktInsightTable.h"
#include "Widgets/Input/SSearchBox.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Text/STextBlock.h"

#define LOCTEXT_NAMESPACE "HktInsightTable"

// 컬러 팔레트
namespace HktInsightColors
{
    // 키 컬러 (연한 시안)
    static const FLinearColor Key(0.4f, 0.85f, 1.0f);

    // 상태 키워드
    static const FLinearColor Created(1.0f, 0.85f, 0.0f);      // 노랑
    static const FLinearColor Running(0.3f, 0.8f, 1.0f);       // 시안
    static const FLinearColor Completed(0.3f, 1.0f, 0.3f);     // 초록
    static const FLinearColor Failed(1.0f, 0.3f, 0.3f);        // 빨강
    static const FLinearColor Positive(0.4f, 0.9f, 0.4f);      // 초록 (Active/Yes/OK)
    static const FLinearColor Negative(0.55f, 0.55f, 0.55f);   // 회색 (None/NULL/No)

    // Field=Value 분리
    static const FLinearColor FieldName(0.5f, 0.5f, 0.58f);    // 흐린 회색
    static const FLinearColor Value(0.88f, 0.88f, 0.88f);      // 밝은 회색
    static const FLinearColor Separator(0.3f, 0.3f, 0.35f);    // 어두운 회색
}

FSlateColor SHktInsightTable::GetValueColor(const FString& Value)
{
    if (Value == TEXT("Created"))    return FSlateColor(HktInsightColors::Created);
    if (Value == TEXT("Running") || Value == TEXT("Processing"))
                                    return FSlateColor(HktInsightColors::Running);
    if (Value == TEXT("Completed")) return FSlateColor(HktInsightColors::Completed);
    if (Value == TEXT("Failed"))    return FSlateColor(HktInsightColors::Failed);
    if (Value == TEXT("Active") || Value == TEXT("Yes") || Value == TEXT("OK"))
                                    return FSlateColor(HktInsightColors::Positive);
    if (Value == TEXT("None") || Value == TEXT("NULL") || Value == TEXT("No") || Value == TEXT("(none)"))
                                    return FSlateColor(HktInsightColors::Negative);
    return FSlateColor(HktInsightColors::Value);
}

void SHktInsightTable::Construct(const FArguments& InArgs)
{
    ChildSlot
    [
        SNew(SVerticalBox)

        // 제목 + 필터
        + SVerticalBox::Slot()
        .AutoHeight()
        .Padding(4.f)
        [
            SNew(SHorizontalBox)
            + SHorizontalBox::Slot()
            .AutoWidth()
            .VAlign(VAlign_Center)
            .Padding(0, 0, 8, 0)
            [
                SNew(STextBlock)
                .Text(InArgs._Title)
                .Font(FCoreStyle::GetDefaultFontStyle("Bold", 12))
                .ColorAndOpacity(FSlateColor(HktInsightColors::Key))
            ]
            + SHorizontalBox::Slot()
            .FillWidth(1.0f)
            [
                SNew(SSearchBox)
                .HintText(LOCTEXT("FilterHint", "Filter..."))
                .OnTextChanged_Lambda([this](const FText& Text)
                {
                    FilterText = Text.ToString();
                    RebuildFilteredRows();
                })
            ]
        ]

        // 리스트 (헤더 없음 — 값이 자기 서술적)
        + SVerticalBox::Slot()
        .FillHeight(1.0f)
        [
            SAssignNew(ListView, SListView<TSharedPtr<FHktInsightTableRow>>)
            .ListItemsSource(&FilteredRows)
            .OnGenerateRow(this, &SHktInsightTable::OnGenerateRow)
            .SelectionMode(ESelectionMode::None)
        ]
    ];
}

void SHktInsightTable::SetData(const TArray<TPair<FString, FString>>& InData)
{
    AllRows.Reset(InData.Num());
    for (const auto& Pair : InData)
    {
        TSharedPtr<FHktInsightTableRow> Row = MakeShared<FHktInsightTableRow>();
        Row->Key = Pair.Key;

        // 파이프(|) 구분자로 값 분할
        TArray<FString> Segments;
        Pair.Value.ParseIntoArray(Segments, TEXT("|"), true);
        for (FString& Seg : Segments)
        {
            Seg.TrimStartAndEndInline();
        }
        if (Segments.Num() == 0 && !Pair.Value.IsEmpty())
        {
            Segments.Add(Pair.Value.TrimStartAndEnd());
        }
        Row->Values = MoveTemp(Segments);

        AllRows.Add(Row);
    }
    RebuildFilteredRows();
}

void SHktInsightTable::RebuildFilteredRows()
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
            bool bMatch = Row->Key.Contains(FilterText);
            if (!bMatch)
            {
                for (const FString& V : Row->Values)
                {
                    if (V.Contains(FilterText))
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

    if (ListView.IsValid())
    {
        ListView->RequestListRefresh();
    }
}

TSharedRef<ITableRow> SHktInsightTable::OnGenerateRow(
    TSharedPtr<FHktInsightTableRow> Item,
    const TSharedRef<STableViewBase>& OwnerTable)
{
    // Values 가로 박스 생성
    TSharedRef<SHorizontalBox> ValuesBox = SNew(SHorizontalBox);

    for (int32 i = 0; i < Item->Values.Num(); ++i)
    {
        const FString& Val = Item->Values[i];

        // 값 사이 구분자
        if (i > 0)
        {
            ValuesBox->AddSlot()
            .AutoWidth()
            .Padding(2, 0)
            [
                SNew(STextBlock)
                .Text(FText::FromString(TEXT("\u00B7")))  // middle dot
                .Font(FCoreStyle::GetDefaultFontStyle("Regular", 9))
                .ColorAndOpacity(FSlateColor(HktInsightColors::Separator))
            ];
        }

        // Field=Value 포맷 감지
        int32 EqIdx = INDEX_NONE;
        Val.FindChar(TEXT('='), EqIdx);

        if (EqIdx > 0 && EqIdx < Val.Len() - 1)
        {
            FString FieldName = Val.Left(EqIdx);
            FString FieldValue = Val.Mid(EqIdx + 1);

            ValuesBox->AddSlot()
            .AutoWidth()
            .Padding(4, 0, 0, 0)
            [
                SNew(SHorizontalBox)
                + SHorizontalBox::Slot()
                .AutoWidth()
                [
                    SNew(STextBlock)
                    .Text(FText::FromString(FieldName + TEXT("=")))
                    .Font(FCoreStyle::GetDefaultFontStyle("Regular", 9))
                    .ColorAndOpacity(FSlateColor(HktInsightColors::FieldName))
                ]
                + SHorizontalBox::Slot()
                .AutoWidth()
                [
                    SNew(STextBlock)
                    .Text(FText::FromString(FieldValue))
                    .Font(FCoreStyle::GetDefaultFontStyle("Regular", 9))
                    .ColorAndOpacity(GetValueColor(FieldValue))
                ]
            ];
        }
        else
        {
            // 단순 값 (상태 키워드 등)
            ValuesBox->AddSlot()
            .AutoWidth()
            .Padding(4, 0, 0, 0)
            [
                SNew(STextBlock)
                .Text(FText::FromString(Val))
                .Font(FCoreStyle::GetDefaultFontStyle("Regular", 9))
                .ColorAndOpacity(GetValueColor(Val))
            ];
        }
    }

    return SNew(STableRow<TSharedPtr<FHktInsightTableRow>>, OwnerTable)
    [
        SNew(SHorizontalBox)

        // Key 컬럼
        + SHorizontalBox::Slot()
        .AutoWidth()
        .Padding(6, 2, 8, 2)
        [
            SNew(SBox)
            .MinDesiredWidth(130.f)
            [
                SNew(STextBlock)
                .Text(FText::FromString(Item->Key))
                .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                .ColorAndOpacity(FSlateColor(HktInsightColors::Key))
            ]
        ]

        // Values 컬럼
        + SHorizontalBox::Slot()
        .FillWidth(1.0f)
        .Padding(0, 2)
        [
            ValuesBox
        ]
    ];
}

#undef LOCTEXT_NAMESPACE
