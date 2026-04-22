// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSnippetJsonCommands.h"
#include "HktStoryJsonParser.h"
#include "HktStoryBuilder.h"
#include "Snippets/HktSnippetItem.h"

// HktStory 모듈의 스니펫 함수를 JSON op로 노출한다.
// HktStoryJsonParser는 HktCore 모듈에 있어 HktStory를 알 수 없으므로,
// HktStory 모듈 시작 시 RegisterCommand()로 추가 등록한다.
//
// 라벨이 필요한 스니펫(LoadItemFromSlot 등)은 failLabel 문자열을
// B.ResolveLabel(name) 으로 int32 키에 매핑한다.
// 사용자는 동일한 name을 가진 {"op": "Label", "name": ...}을 두면 된다.

void HktStory::RegisterSnippetJsonCommands()
{
	FHktStoryJsonParser& Parser = FHktStoryJsonParser::Get();

	// --- 소유권 ---
	Parser.RegisterCommand(TEXT("SnippetAssignOwnership"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		HktSnippetItem::AssignOwnership(B, A.GetReg(TEXT("entity")), A.GetReg(TEXT("owner")));
	});
	Parser.RegisterCommand(TEXT("SnippetReleaseOwnership"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		HktSnippetItem::ReleaseOwnership(B, A.GetReg(TEXT("entity")));
	});

	// --- 아이템 스탯 ---
	Parser.RegisterCommand(TEXT("SnippetApplyItemStats"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		HktSnippetItem::ApplyItemStats(B, A.GetReg(TEXT("item")), A.GetReg(TEXT("character")));
	});
	Parser.RegisterCommand(TEXT("SnippetRemoveItemStats"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		HktSnippetItem::RemoveItemStats(B, A.GetReg(TEXT("item")), A.GetReg(TEXT("character")));
	});

	// --- 슬롯 디스패치 ---
	Parser.RegisterCommand(TEXT("SnippetLoadItemFromSlot"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		const int32 FailLabel = B.ResolveLabel(A.GetString(TEXT("failLabel")));
		HktSnippetItem::LoadItemFromSlot(B, A.GetReg(TEXT("dst")), FailLabel);
	});
	Parser.RegisterCommand(TEXT("SnippetSaveItemToEquipSlot"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		HktSnippetItem::SaveItemToEquipSlot(B, A.GetReg(TEXT("slotIndex")), A.GetReg(TEXT("value")));
	});
	Parser.RegisterCommand(TEXT("SnippetClearEquipSlot"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		HktSnippetItem::ClearEquipSlot(B, A.GetReg(TEXT("slotIndex")));
	});
	Parser.RegisterCommand(TEXT("SnippetFindEmptyEquipSlot"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		const int32 FailLabel = B.ResolveLabel(A.GetString(TEXT("failLabel")));
		HktSnippetItem::FindEmptyEquipSlot(B, A.GetReg(TEXT("dst")), FailLabel);
	});

	// --- 검증 ---
	Parser.RegisterCommand(TEXT("SnippetValidateOwnership"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		const int32 FailLabel = B.ResolveLabel(A.GetString(TEXT("failLabel")));
		HktSnippetItem::ValidateOwnership(B, A.GetReg(TEXT("entity")), FailLabel);
	});
	Parser.RegisterCommand(TEXT("SnippetValidateItemState"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		const int32 FailLabel = B.ResolveLabel(A.GetString(TEXT("failLabel")));
		HktSnippetItem::ValidateItemState(B, A.GetReg(TEXT("entity")), A.GetInt(TEXT("expectedState")), FailLabel);
	});

	// --- 고수준 아이템 상태 전환 ---
	Parser.RegisterCommand(TEXT("SnippetActivateInSlot"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		HktSnippetItem::ActivateInSlot(B, A.GetReg(TEXT("item")), A.GetReg(TEXT("slotIndex")), A.GetReg(TEXT("character")));
	});
	Parser.RegisterCommand(TEXT("SnippetDeactivateToBag"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		HktSnippetItem::DeactivateToBag(B, A.GetReg(TEXT("item")), A.GetReg(TEXT("character")));
	});
	Parser.RegisterCommand(TEXT("SnippetDropToGround"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		HktSnippetItem::DropToGround(B, A.GetReg(TEXT("item")), A.GetReg(TEXT("posSource")));
	});
}
