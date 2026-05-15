// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/Views/SListView.h"
#include "HktWorkspaceTypes.h"

class FReply;
class STextBlock;
class SMultiLineEditableTextBox;

/**
 * SHktWorkspacePanel — I-0008 워크스페이스 패널.
 *
 *  - "Scan" 버튼: 워크스페이스 루트를 다시 스캔해 Tag 목록 갱신.
 *  - 행별 Build 버튼: 해당 Tag 만 빌드.
 *  - "Build All Stale" 버튼: 변경된 Tag 만 일괄 빌드.
 *  - "Build All (Force)" 버튼: manifest 무시하고 일괄 빌드.
 *
 *  결과 로그는 패널 하단 텍스트 박스에 표시.
 */
class SHktWorkspacePanel : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SHktWorkspacePanel) {}
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);

private:
	struct FRow
	{
		FHktWorkspaceTagEntry Entry;
		FString  InputsHash;
		bool     bUpToDate = false;
	};

	void RefreshScan();
	void AppendLog(const FString& Line);

	TSharedRef<ITableRow> GenerateRowWidget(TSharedPtr<FRow> Item, const TSharedRef<STableViewBase>& OwnerTable);

	FReply OnClickScan();
	FReply OnClickBuildStale();
	FReply OnClickBuildForce();

	TArray<TSharedPtr<FRow>> Rows;
	TSharedPtr<SListView<TSharedPtr<FRow>>> ListView;
	TSharedPtr<SMultiLineEditableTextBox> LogBox;
	TSharedPtr<STextBlock> StatusText;
};
