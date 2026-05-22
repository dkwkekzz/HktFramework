// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSnippetJsonCommands.h"
#include "HktStoryJsonParser.h"
#include "HktStoryBuilder.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "HktCoreProperties.h"
#include "Snippets/HktSnippetItem.h"
#include "Snippets/HktSnippetCombat.h"
#include "Snippets/HktSnippetNPC.h"

// HktStory 모듈의 스니펫 함수를 JSON op 로 노출한다.
// HktStoryJsonParser 는 HktCore 모듈에 있어 HktStory 를 알 수 없으므로,
// HktStory 모듈 시작 시 RegisterCommand / RegisterCommandV2 로 추가 등록한다.
//
// V1 (RegisterCommand)  — schema 1 JSON ("R3", "Self") 호환. Item 스니펫만 존재.
// V2 (RegisterCommandV2) — schema 2 JSON ({"var":"name"} / {"self":true} / {"const":N}).
//   PR-3 strangler-fig 마이그레이션이 사용하는 경로.
//
// 라벨이 필요한 스니펫은 failLabel/loopLabel 문자열을 B.ResolveLabel(name) 으로
// int32 키에 매핑한다. 사용자는 동일한 name 을 가진 {"op":"Label", "name":...} 을 두면 된다.

namespace
{
	// I-0035 SnippetRandomLootDrop: JSON entry 객체 하나를 FHktLootEntry 로 파싱.
	// 필수: classTag. weight 누락/≤0 은 1 로 보정 — 모든 entry 가 최소 1 의 기회.
	// 옵션: itemId / props (PropertyName → int) / skillTag / stance / tags (string[]).
	// 반환 false 면 entry 가 사용 불가 (객체 형식 위반).
	bool ParseLootEntry(
		const TSharedPtr<FJsonValue>& Val,
		const FHktStoryCmdArgs& A,
		HktSnippetItem::FHktLootEntry& Out)
	{
		const TSharedPtr<FJsonObject>* EntryObjPtr = nullptr;
		if (!Val.IsValid() || !Val->TryGetObject(EntryObjPtr) || !EntryObjPtr)
		{
			return false;
		}
		const TSharedPtr<FJsonObject>& Obj = *EntryObjPtr;
		if (!A.ResolveTagFunc)
		{
			return false;
		}

		FString ClassTagStr;
		if (!Obj->TryGetStringField(TEXT("classTag"), ClassTagStr) || ClassTagStr.IsEmpty())
		{
			return false;
		}
		Out.ClassTag = A.ResolveTagFunc(ClassTagStr);

		int32 WeightTmp = 1;
		Obj->TryGetNumberField(TEXT("weight"), WeightTmp);
		Out.Weight = FMath::Max(1, WeightTmp);

		int32 ItemIdTmp = 0;
		Obj->TryGetNumberField(TEXT("itemId"), ItemIdTmp);
		Out.ItemId = ItemIdTmp;

		const TSharedPtr<FJsonObject>* PropsObjPtr = nullptr;
		if (Obj->TryGetObjectField(TEXT("props"), PropsObjPtr) && PropsObjPtr)
		{
			for (const TPair<FString, TSharedPtr<FJsonValue>>& Pair : (*PropsObjPtr)->Values)
			{
				const uint16 Pid = FHktStoryJsonParser::ParsePropertyId(Pair.Key);
				if (Pid == 0xFFFF || !Pair.Value.IsValid()) continue;
				double NumVal = 0.0;
				if (Pair.Value->TryGetNumber(NumVal))
				{
					Out.Properties.Add(Pid, static_cast<int32>(NumVal));
				}
			}
		}

		FString SkillTagStr;
		if (Obj->TryGetStringField(TEXT("skillTag"), SkillTagStr) && !SkillTagStr.IsEmpty())
		{
			Out.SkillTag = A.ResolveTagFunc(SkillTagStr);
		}

		FString StanceStr;
		if (Obj->TryGetStringField(TEXT("stance"), StanceStr) && !StanceStr.IsEmpty())
		{
			Out.StanceTag = A.ResolveTagFunc(StanceStr);
		}

		const TArray<TSharedPtr<FJsonValue>>* TagsArrPtr = nullptr;
		if (Obj->TryGetArrayField(TEXT("tags"), TagsArrPtr) && TagsArrPtr)
		{
			Out.AttrTags.Reserve(TagsArrPtr->Num());
			for (const TSharedPtr<FJsonValue>& TV : *TagsArrPtr)
			{
				FString TagStr;
				if (TV.IsValid() && TV->TryGetString(TagStr) && !TagStr.IsEmpty())
				{
					Out.AttrTags.Add(A.ResolveTagFunc(TagStr));
				}
			}
		}

		return true;
	}

	// V1 (schema 1) Item 핸들러 등록 — RegisterIndex 기반 기존 경로 유지.
	void RegisterItemV1(FHktStoryJsonParser& Parser)
	{
		Parser.RegisterCommand(TEXT("SnippetAssignOwnership"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetItem::AssignOwnership(B, A.GetReg(TEXT("entity")), A.GetReg(TEXT("owner")));
		});
		Parser.RegisterCommand(TEXT("SnippetReleaseOwnership"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetItem::ReleaseOwnership(B, A.GetReg(TEXT("entity")));
		});
		Parser.RegisterCommand(TEXT("SnippetApplyItemStats"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetItem::ApplyItemStats(B, A.GetReg(TEXT("item")), A.GetReg(TEXT("character")));
		});
		Parser.RegisterCommand(TEXT("SnippetRemoveItemStats"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetItem::RemoveItemStats(B, A.GetReg(TEXT("item")), A.GetReg(TEXT("character")));
		});
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
		Parser.RegisterCommand(TEXT("SnippetValidateOwnership"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			const int32 FailLabel = B.ResolveLabel(A.GetString(TEXT("failLabel")));
			HktSnippetItem::ValidateOwnership(B, A.GetReg(TEXT("entity")), FailLabel);
		});
		Parser.RegisterCommand(TEXT("SnippetValidateItemState"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			const int32 FailLabel = B.ResolveLabel(A.GetString(TEXT("failLabel")));
			HktSnippetItem::ValidateItemState(B, A.GetReg(TEXT("entity")), A.GetInt(TEXT("expectedState")), FailLabel);
		});
		Parser.RegisterCommand(TEXT("SnippetActivateInSlot"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetItem::ActivateInSlot(B, A.GetReg(TEXT("item")), A.GetReg(TEXT("slotIndex")), A.GetReg(TEXT("character")));
		});
		Parser.RegisterCommand(TEXT("SnippetDeactivateToInventory"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetItem::DeactivateToInventory(B, A.GetReg(TEXT("item")), A.GetReg(TEXT("character")));
		});
		Parser.RegisterCommand(TEXT("SnippetDropToGround"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetItem::DropToGround(B, A.GetReg(TEXT("item")), A.GetReg(TEXT("posSource")));
		});
	}

	// V2 (schema 2) Item 핸들러 — VarRef 기반 신 경로.
	void RegisterItemV2(FHktStoryJsonParser& Parser)
	{
		Parser.RegisterCommandV2(TEXT("SnippetAssignOwnership"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetItem::AssignOwnership(B, A.GetVar(B, TEXT("entity")), A.GetVar(B, TEXT("owner")));
		});
		Parser.RegisterCommandV2(TEXT("SnippetReleaseOwnership"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetItem::ReleaseOwnership(B, A.GetVar(B, TEXT("entity")));
		});
		Parser.RegisterCommandV2(TEXT("SnippetApplyItemStats"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetItem::ApplyItemStats(B, A.GetVar(B, TEXT("item")), A.GetVar(B, TEXT("character")));
		});
		Parser.RegisterCommandV2(TEXT("SnippetRemoveItemStats"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetItem::RemoveItemStats(B, A.GetVar(B, TEXT("item")), A.GetVar(B, TEXT("character")));
		});
		Parser.RegisterCommandV2(TEXT("SnippetLoadItemFromSlot"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			const int32 FailLabel = B.ResolveLabel(A.GetString(TEXT("failLabel")));
			HktSnippetItem::LoadItemFromSlot(B, A.GetVar(B, TEXT("dst")), FailLabel);
		});
		Parser.RegisterCommandV2(TEXT("SnippetSaveItemToEquipSlot"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetItem::SaveItemToEquipSlot(B, A.GetVar(B, TEXT("slotIndex")), A.GetVar(B, TEXT("value")));
		});
		Parser.RegisterCommandV2(TEXT("SnippetClearEquipSlot"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetItem::ClearEquipSlot(B, A.GetVar(B, TEXT("slotIndex")));
		});
		Parser.RegisterCommandV2(TEXT("SnippetFindEmptyEquipSlot"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			const int32 FailLabel = B.ResolveLabel(A.GetString(TEXT("failLabel")));
			HktSnippetItem::FindEmptyEquipSlot(B, A.GetVar(B, TEXT("dst")), FailLabel);
		});
		Parser.RegisterCommandV2(TEXT("SnippetValidateOwnership"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			const int32 FailLabel = B.ResolveLabel(A.GetString(TEXT("failLabel")));
			HktSnippetItem::ValidateOwnership(B, A.GetVar(B, TEXT("entity")), FailLabel);
		});
		Parser.RegisterCommandV2(TEXT("SnippetValidateItemState"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			const int32 FailLabel = B.ResolveLabel(A.GetString(TEXT("failLabel")));
			HktSnippetItem::ValidateItemState(B, A.GetVar(B, TEXT("entity")), A.GetInt(TEXT("expectedState")), FailLabel);
		});
		Parser.RegisterCommandV2(TEXT("SnippetActivateInSlot"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetItem::ActivateInSlot(B, A.GetVar(B, TEXT("item")), A.GetVar(B, TEXT("slotIndex")), A.GetVar(B, TEXT("character")));
		});
		Parser.RegisterCommandV2(TEXT("SnippetDeactivateToInventory"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetItem::DeactivateToInventory(B, A.GetVar(B, TEXT("item")), A.GetVar(B, TEXT("character")));
		});
		Parser.RegisterCommandV2(TEXT("SnippetDropToGround"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetItem::DropToGround(B, A.GetVar(B, TEXT("item")), A.GetVar(B, TEXT("posSource")));
		});
		Parser.RegisterCommandV2(TEXT("SnippetSpawnGroundItemAtPos"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetItem::FHktGroundItemTemplate Tmpl;
			Tmpl.ItemId = A.GetIntOpt(TEXT("itemId"), 0);
			HktSnippetItem::SpawnGroundItemAtPos(B, A.GetTag(TEXT("classTag")), Tmpl, A.GetVarBlock(B, TEXT("pos"), 3));
		});
		// I-0035: 가중치 random loot drop — lifecycle 의 사망 분기에서 한 줄로 호출.
		// 인라인된 N-way drop 분기들을 entry 배열 한 곳으로 모으는 목적.
		Parser.RegisterCommandV2(TEXT("SnippetRandomLootDrop"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			FHktVar PosSource = A.GetVar(B, TEXT("posSource"));

			TArray<HktSnippetItem::FHktLootEntry> Entries;
			const TArray<TSharedPtr<FJsonValue>>* EntriesArr = nullptr;
			if (A.Step.IsValid() && A.Step->TryGetArrayField(TEXT("entries"), EntriesArr) && EntriesArr)
			{
				Entries.Reserve(EntriesArr->Num());
				for (const TSharedPtr<FJsonValue>& Val : *EntriesArr)
				{
					HktSnippetItem::FHktLootEntry E;
					if (ParseLootEntry(Val, A, E))
					{
						Entries.Add(MoveTemp(E));
					}
				}
			}

			HktSnippetItem::RandomLootDrop(B, Entries, PosSource);
		});
	}

	// V2 (schema 2) Combat 핸들러.
	void RegisterCombatV2(FHktStoryJsonParser& Parser)
	{
		Parser.RegisterCommandV2(TEXT("SnippetCooldownCheck"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			const int32 FailLabel = B.ResolveLabel(A.GetString(TEXT("failLabel")));
			HktSnippetCombat::CooldownCheck(B, FailLabel);
		});
		Parser.RegisterCommandV2(TEXT("SnippetCooldownUpdateConst"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetCombat::CooldownUpdateConst(B, A.GetInt(TEXT("recoveryFrame")));
		});
		Parser.RegisterCommandV2(TEXT("SnippetCooldownUpdateFromEntity"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetCombat::CooldownUpdateFromEntity(B, A.GetVar(B, TEXT("item")));
		});
		Parser.RegisterCommandV2(TEXT("SnippetResourceGainClamped"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetCombat::ResourceGainClamped(B,
				A.GetPropertyId(TEXT("currentProp")),
				A.GetPropertyId(TEXT("maxProp")),
				A.GetInt(TEXT("amount")));
		});
		Parser.RegisterCommandV2(TEXT("SnippetAnimTrigger"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetCombat::AnimTrigger(B, A.GetVar(B, TEXT("entity")), A.GetTag(TEXT("animTag")));
		});
		Parser.RegisterCommandV2(TEXT("SnippetAnimLoopStart"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetCombat::AnimLoopStart(B, A.GetVar(B, TEXT("entity")), A.GetTag(TEXT("animTag")));
		});
		Parser.RegisterCommandV2(TEXT("SnippetAnimLoopStop"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetCombat::AnimLoopStop(B, A.GetVar(B, TEXT("entity")), A.GetTag(TEXT("animTag")));
		});
		Parser.RegisterCommandV2(TEXT("SnippetCheckDeath"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetCombat::CheckDeath(B, A.GetVar(B, TEXT("entity")), A.GetTag(TEXT("deadTag")));
		});
	}

	// V2 (schema 2) NPC 핸들러.
	void RegisterNPCV2(FHktStoryJsonParser& Parser)
	{
		auto ParseTemplate = [](const FHktStoryCmdArgs& A) {
			HktSnippetNPC::FHktNPCTemplate Stats;
			Stats.Health = A.GetIntOpt(TEXT("health"), Stats.Health);
			Stats.AttackPower = A.GetIntOpt(TEXT("attackPower"), Stats.AttackPower);
			Stats.Defense = A.GetIntOpt(TEXT("defense"), Stats.Defense);
			Stats.MaxSpeed = A.GetIntOpt(TEXT("maxSpeed"), Stats.MaxSpeed);
			Stats.Team = A.GetIntOpt(TEXT("team"), Stats.Team);
			return Stats;
		};

		Parser.RegisterCommandV2(TEXT("SnippetSetupNPCStats"), [ParseTemplate](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetNPC::SetupNPCStats(B, A.GetTag(TEXT("specificTag")), ParseTemplate(A));
		});
		Parser.RegisterCommandV2(TEXT("SnippetSpawnerLoopBegin"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			const int32 LoopLabel = B.ResolveLabel(A.GetString(TEXT("loopLabel")));
			const int32 WaitLabel = B.ResolveLabel(A.GetString(TEXT("waitLabel")));
			HktSnippetNPC::SpawnerLoopBegin(B, LoopLabel, WaitLabel,
				A.GetTag(TEXT("countTag")), A.GetInt(TEXT("cap")));
		});
		Parser.RegisterCommandV2(TEXT("SnippetSpawnerLoopEnd"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			const int32 LoopLabel = B.ResolveLabel(A.GetString(TEXT("loopLabel")));
			const int32 WaitLabel = B.ResolveLabel(A.GetString(TEXT("waitLabel")));
			HktSnippetNPC::SpawnerLoopEnd(B, LoopLabel, WaitLabel,
				A.GetFloatOpt(TEXT("intervalSeconds"), 1.0f));
		});
		Parser.RegisterCommandV2(TEXT("SnippetSpawnNPCAtPosition"), [ParseTemplate](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
			HktSnippetNPC::SpawnNPCAtPosition(B, A.GetTag(TEXT("npcTag")), ParseTemplate(A),
				A.GetVarBlock(B, TEXT("pos"), 3));
		});
	}
}

void HktStory::RegisterSnippetJsonCommands()
{
	FHktStoryJsonParser& Parser = FHktStoryJsonParser::Get();
	RegisterItemV1(Parser);
	RegisterItemV2(Parser);
	RegisterCombatV2(Parser);
	RegisterNPCV2(Parser);
}
