// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "SHktWorkspacePanel.h"
#include "HktWorkspaceLog.h"
#include "HktWorkspaceScanner.h"
#include "HktWorkspaceManifest.h"
#include "HktWorkspaceSettings.h"
#include "HktWorkspaceFunctionLibrary.h"

#include "Widgets/SBoxPanel.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Input/SMultiLineEditableTextBox.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Views/STableRow.h"
#include "Widgets/Views/SHeaderRow.h"
#include "Styling/AppStyle.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

#define LOCTEXT_NAMESPACE "HktWorkspacePanel"

namespace
{
	FText ModeText(EHktWorkspaceTagMode M)
	{
		switch (M)
		{
			case EHktWorkspaceTagMode::Character:    return LOCTEXT("ModeCharacter", "Character");
			case EHktWorkspaceTagMode::StaticVisual: return LOCTEXT("ModeStatic",    "StaticVisual");
			default:                                  return LOCTEXT("ModeUnknown",   "Unknown");
		}
	}
}

void SHktWorkspacePanel::Construct(const FArguments& InArgs)
{
	ChildSlot
	[
		SNew(SBorder)
		.Padding(8)
		.BorderImage(FAppStyle::GetBrush("ToolPanel.GroupBorder"))
		[
			SNew(SVerticalBox)

			+ SVerticalBox::Slot().AutoHeight().Padding(2)
			[
				SNew(STextBlock)
				.Text(LOCTEXT("Title",
					"HKT Workspace — {Saved}/Workspace/{Paper2D,HISM}/{Tag}/... 를 스캔해 자동 빌드"))
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(2)
			[
				SAssignNew(StatusText, STextBlock)
				.Text(LOCTEXT("StatusInit", "준비됨 — Scan 버튼으로 시작"))
			]

			+ SVerticalBox::Slot().AutoHeight().Padding(2)
			[
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot().AutoWidth().Padding(2)
				[
					SNew(SButton)
					.Text(LOCTEXT("Scan", "Scan"))
					.OnClicked(this, &SHktWorkspacePanel::OnClickScan)
				]
				+ SHorizontalBox::Slot().AutoWidth().Padding(2)
				[
					SNew(SButton)
					.Text(LOCTEXT("BuildStale", "Build All Stale"))
					.OnClicked(this, &SHktWorkspacePanel::OnClickBuildStale)
				]
				+ SHorizontalBox::Slot().AutoWidth().Padding(2)
				[
					SNew(SButton)
					.Text(LOCTEXT("BuildForce", "Build All (Force)"))
					.OnClicked(this, &SHktWorkspacePanel::OnClickBuildForce)
				]
			]

			+ SVerticalBox::Slot().FillHeight(1).Padding(2)
			[
				SAssignNew(ListView, SListView<TSharedPtr<FRow>>)
				.ListItemsSource(&Rows)
				.OnGenerateRow(this, &SHktWorkspacePanel::GenerateRowWidget)
				.HeaderRow(
					SNew(SHeaderRow)
					+ SHeaderRow::Column("Category").DefaultLabel(LOCTEXT("Category", "Category")).FillWidth(0.10f)
					+ SHeaderRow::Column("Tag").DefaultLabel(LOCTEXT("Tag", "Tag")).FillWidth(0.34f)
					+ SHeaderRow::Column("Mode").DefaultLabel(LOCTEXT("Mode", "Mode")).FillWidth(0.10f)
					+ SHeaderRow::Column("Anims").DefaultLabel(LOCTEXT("Anims", "#Anims")).FillWidth(0.06f)
					+ SHeaderRow::Column("Status").DefaultLabel(LOCTEXT("Status", "Status")).FillWidth(0.12f)
					+ SHeaderRow::Column("Action").DefaultLabel(LOCTEXT("Action", "Action")).FillWidth(0.16f)
					+ SHeaderRow::Column("Path").DefaultLabel(LOCTEXT("Path", "Folder")).FillWidth(0.12f)
				)
			]

			+ SVerticalBox::Slot().FillHeight(0.6f).Padding(2)
			[
				SAssignNew(LogBox, SMultiLineEditableTextBox)
				.IsReadOnly(true)
				.AutoWrapText(true)
				.Text(FText::GetEmpty())
			]
		]
	];

	RefreshScan();
}

void SHktWorkspacePanel::AppendLog(const FString& Line)
{
	if (!LogBox.IsValid()) return;
	FText Prev = LogBox->GetText();
	FString Combined = Prev.ToString();
	if (!Combined.IsEmpty()) Combined += TEXT("\n");
	Combined += Line;
	LogBox->SetText(FText::FromString(Combined));
}

void SHktWorkspacePanel::RefreshScan()
{
	Rows.Reset();

	const FString Root = UHktWorkspaceSettings::ResolveWorkspaceRoot();
	TArray<FHktWorkspaceTagEntry> Entries;
	FHktWorkspaceScanner::ScanAll(Root, Entries);

	for (const FHktWorkspaceTagEntry& E : Entries)
	{
		TSharedPtr<FRow> R = MakeShared<FRow>();
		R->Entry = E;
		R->InputsHash = (E.Mode == EHktWorkspaceTagMode::Unknown)
			? FString() : FHktWorkspaceManifest::ComputeInputsHash(E);

		FHktWorkspaceManifestData Prev;
		R->bUpToDate = FHktWorkspaceManifest::Load(E.FolderPath, Prev)
			&& Prev.InputsHash == R->InputsHash
			&& !R->InputsHash.IsEmpty();
		Rows.Add(R);
	}

	if (StatusText.IsValid())
	{
		StatusText->SetText(FText::FromString(FString::Printf(
			TEXT("Root=%s — entries=%d"), *Root, Rows.Num())));
	}
	if (ListView.IsValid())
	{
		ListView->RequestListRefresh();
	}
	AppendLog(FString::Printf(TEXT("[Scan] Root=%s entries=%d"), *Root, Rows.Num()));
}

TSharedRef<ITableRow> SHktWorkspacePanel::GenerateRowWidget(
	TSharedPtr<FRow> Item, const TSharedRef<STableViewBase>& OwnerTable)
{
	const FString CategoryStr = FHktWorkspaceScanner::CategoryToString(Item->Entry.Category);
	const FText   Mode        = ModeText(Item->Entry.Mode);
	const FText   StatusTxt   = Item->bUpToDate
		? LOCTEXT("Fresh", "fresh")
		: LOCTEXT("Stale", "stale");

	const FString FolderRel = FPaths::GetCleanFilename(Item->Entry.FolderPath);
	const int32 AnimCount   = Item->Entry.Anims.Num();

	TSharedRef<SWidget> ActionCell = SNew(SButton)
		.Text(LOCTEXT("Build", "Build"))
		.IsEnabled(Item->Entry.Category == EHktWorkspaceCategory::Paper2D
			&& Item->Entry.Mode != EHktWorkspaceTagMode::Unknown)
		.OnClicked_Lambda([this, Item]() -> FReply
		{
			const FString CategoryStr = FHktWorkspaceScanner::CategoryToString(Item->Entry.Category);
			AppendLog(FString::Printf(TEXT("[Build] %s/%s …"), *CategoryStr, *Item->Entry.FolderName));

			const FString Json = UHktWorkspaceFunctionLibrary::BuildTag(
				CategoryStr, Item->Entry.FolderName, /*bForce*/false, /*WorkspaceRoot*/FString());
			AppendLog(Json);
			RefreshScan();
			return FReply::Handled();
		});

	return SNew(STableRow<TSharedPtr<FRow>>, OwnerTable)
		[
			SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().FillWidth(0.10f).Padding(2)
			[
				SNew(STextBlock).Text(FText::FromString(CategoryStr))
			]
			+ SHorizontalBox::Slot().FillWidth(0.34f).Padding(2)
			[
				SNew(STextBlock).Text(FText::FromString(Item->Entry.TagString))
			]
			+ SHorizontalBox::Slot().FillWidth(0.10f).Padding(2)
			[
				SNew(STextBlock).Text(Mode)
			]
			+ SHorizontalBox::Slot().FillWidth(0.06f).Padding(2)
			[
				SNew(STextBlock).Text(FText::AsNumber(AnimCount))
			]
			+ SHorizontalBox::Slot().FillWidth(0.12f).Padding(2)
			[
				SNew(STextBlock).Text(StatusTxt)
			]
			+ SHorizontalBox::Slot().FillWidth(0.16f).Padding(2)
			[
				ActionCell
			]
			+ SHorizontalBox::Slot().FillWidth(0.12f).Padding(2)
			[
				SNew(STextBlock).Text(FText::FromString(FolderRel))
			]
		];
}

FReply SHktWorkspacePanel::OnClickScan()
{
	RefreshScan();
	return FReply::Handled();
}

FReply SHktWorkspacePanel::OnClickBuildStale()
{
	AppendLog(TEXT("[BuildStale] ScanAndBuildAll(force=false)"));
	const FString Json = UHktWorkspaceFunctionLibrary::ScanAndBuildAll(/*Root*/FString(), /*bForce*/false);
	AppendLog(Json);
	RefreshScan();
	return FReply::Handled();
}

FReply SHktWorkspacePanel::OnClickBuildForce()
{
	AppendLog(TEXT("[BuildForce] ScanAndBuildAll(force=true)"));
	const FString Json = UHktWorkspaceFunctionLibrary::ScanAndBuildAll(/*Root*/FString(), /*bForce*/true);
	AppendLog(Json);
	RefreshScan();
	return FReply::Handled();
}

#undef LOCTEXT_NAMESPACE
