// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/Views/SListView.h"

/**
 * FHktInsightTableRow - 테이블 행 데이터
 * Key + 여러 값 (파이프 구분자로 파싱됨)
 */
struct FHktInsightTableRow
{
    FString Key;
    TArray<FString> Values;
};

/**
 * SHktInsightTable
 *
 * 공통 Key-Values 테이블 위젯.
 * - 필터 텍스트 박스 (Key/Value 에서 검색)
 * - Key 컬럼 + 다중 Value 컬럼 (파이프 구분자 파싱)
 * - Field=Value 포맷 자동 감지, 상태 키워드 컬러링
 * - SetData()로 데이터를 주입 (변경 시에만 호출)
 */
class HKTINSIGHTS_API SHktInsightTable : public SCompoundWidget
{
public:
    SLATE_BEGIN_ARGS(SHktInsightTable) {}
        /** 테이블 제목 */
        SLATE_ARGUMENT(FText, Title)
    SLATE_END_ARGS()

    void Construct(const FArguments& InArgs);

    /** 데이터 갱신 (외부에서 호출). 파이프(|) 구분자로 값을 자동 분할. */
    void SetData(const TArray<TPair<FString, FString>>& InData);

private:
    /** 필터링된 행 목록 재구성 */
    void RebuildFilteredRows();

    /** SListView 콜백 */
    TSharedRef<ITableRow> OnGenerateRow(TSharedPtr<FHktInsightTableRow> Item, const TSharedRef<STableViewBase>& OwnerTable);

    /** 값 문자열에 따른 색상 결정 */
    static FSlateColor GetValueColor(const FString& Value);

    /** 전체 데이터 */
    TArray<TSharedPtr<FHktInsightTableRow>> AllRows;

    /** 필터 적용된 행 */
    TArray<TSharedPtr<FHktInsightTableRow>> FilteredRows;

    /** 리스트뷰 */
    TSharedPtr<SListView<TSharedPtr<FHktInsightTableRow>>> ListView;

    /** 필터 문자열 */
    FString FilterText;
};
