// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPaperSpriteBuilderFunctionLibrary.h"
#include "HktPaperAssetBuilder.h"
#include "HktPaperWorkspaceScanner.h"
#include "HktPaper2DGeneratorLog.h"

#include "HktPaperCharacterTemplate.h"
#include "HktPaperActorVisualDataAsset.h"

#include "GameplayTagsManager.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonWriter.h"
#include "Serialization/JsonSerializer.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"

namespace
{
	static const FString kDefaultOutputRoot = TEXT("/Game/Generated/PaperSprites");

	FString MakeErrorJson(const FString& Error)
	{
		TSharedPtr<FJsonObject> Root = MakeShared<FJsonObject>();
		Root->SetBoolField(TEXT("success"), false);
		Root->SetStringField(TEXT("error"), Error);
		FString Out;
		const TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&Out);
		FJsonSerializer::Serialize(Root.ToSharedRef(), W);
		return Out;
	}

	FString ResolveOutputDir(const FString& InOutputDir, const FString& SafeChar)
	{
		if (!InOutputDir.IsEmpty())
		{
			return InOutputDir;
		}
		return kDefaultOutputRoot / SafeChar;
	}

	FString ResolveVisualIdentifierTag(const FString& InTag, const FString& CharacterTagStr)
	{
		if (!InTag.IsEmpty())
		{
			return InTag;
		}
		// 기본 컨벤션: 기존 HISM/Niagara 의 Sprite.Character.{X} 와 충돌 없이 PaperSprite.Character.{X}.
		FString Suffix = CharacterTagStr;
		// "Sprite.Character.Knight" 같이 들어오면 마지막 토큰만 추출.
		FString LastToken;
		if (Suffix.Split(TEXT("."), nullptr, &LastToken, ESearchCase::IgnoreCase, ESearchDir::FromEnd))
		{
			Suffix = LastToken;
		}
		return FString::Printf(TEXT("PaperSprite.Character.%s"), *Suffix);
	}

	/** 안 등록된 GameplayTag 를 Native 등록 (BuildPaperCharacter 가 처음 마주칠 때 자동). */
	FGameplayTag EnsureTag(const FString& TagStr)
	{
		if (TagStr.IsEmpty()) return FGameplayTag();
		FGameplayTag Tag = FGameplayTag::RequestGameplayTag(FName(*TagStr), /*ErrorIfNotFound*/false);
		if (Tag.IsValid())
		{
			return Tag;
		}
		UGameplayTagsManager& TagsMgr = UGameplayTagsManager::Get();
		TagsMgr.AddNativeGameplayTag(FName(*TagStr));
		return FGameplayTag::RequestGameplayTag(FName(*TagStr), /*ErrorIfNotFound*/false);
	}
}

// ============================================================================
// BuildPaperSpriteAnim
// ============================================================================
FString UHktPaperSpriteBuilderFunctionLibrary::BuildPaperSpriteAnim(
	const FString& CharacterTagStr,
	const FString& AnimTagStr,
	int32 CellWidth,
	int32 CellHeight,
	float PixelToWorld,
	float FrameDurationMs,
	bool  bLooping,
	bool  bMirrorWestFromEast,
	const FString& VisualIdentifierTagStr,
	const FString& OutputDir)
{
	if (CharacterTagStr.IsEmpty()) return MakeErrorJson(TEXT("CharacterTagStr 필수"));
	if (AnimTagStr.IsEmpty())      return MakeErrorJson(TEXT("AnimTagStr 필수"));

	const FString SafeChar  = HktPaperAssetBuilder::SanitizeForAssetName(CharacterTagStr);
	const FString OutDir    = ResolveOutputDir(OutputDir, SafeChar);

	// 태그 등록 보장.
	EnsureTag(AnimTagStr);
	const FString VisualIdent = ResolveVisualIdentifierTag(VisualIdentifierTagStr, CharacterTagStr);
	const FGameplayTag VisualIdentTag = EnsureTag(VisualIdent);

	HktPaperAssetBuilder::FBuildAnimResult Anim = HktPaperAssetBuilder::BuildAnim(
		CharacterTagStr, AnimTagStr, OutDir,
		PixelToWorld, FrameDurationMs, bLooping, bMirrorWestFromEast,
		CellWidth, CellHeight);

	if (!Anim.bSuccess)
	{
		return MakeErrorJson(Anim.Error.IsEmpty()
			? TEXT("BuildAnim 실패 (원인 미상)") : Anim.Error);
	}

	// Template / Visual 자산 경로.
	const FString TemplateName = FString::Printf(TEXT("DA_PaperCharacter_%s"), *SafeChar);
	const FString VisualName   = FString::Printf(TEXT("DA_PaperVisual_%s"),   *SafeChar);
	const FString TemplatePath = OutDir / TemplateName;
	const FString VisualPath   = OutDir / VisualName;

	// Visual upsert (Template 은 BuildAnim 안에서 이미 갱신·저장됨).
	UHktPaperCharacterTemplate* Template = LoadObject<UHktPaperCharacterTemplate>(
		nullptr, *(TemplatePath + TEXT(".") + TemplateName));
	UHktPaperActorVisualDataAsset* Visual = HktPaperAssetBuilder::LoadOrCreateVisual(
		OutDir, SafeChar, VisualIdentTag, Template);
	if (Visual)
	{
		HktPaperAssetBuilder::SaveDataAsset(Visual);
	}

	// 결과 JSON.
	TSharedPtr<FJsonObject> Root = MakeShared<FJsonObject>();
	Root->SetBoolField(TEXT("success"), true);
	Root->SetStringField(TEXT("characterTag"), CharacterTagStr);
	Root->SetStringField(TEXT("animTag"),      AnimTagStr);
	Root->SetStringField(TEXT("visualIdentifierTag"), VisualIdent);
	Root->SetStringField(TEXT("characterDataAssetPath"), TemplatePath);
	Root->SetStringField(TEXT("visualDataAssetPath"),    VisualPath);
	Root->SetNumberField(TEXT("numDirections"), Anim.NumDirections);
	Root->SetNumberField(TEXT("framesPerDir"),  Anim.FramesPerDir);

	TArray<TSharedPtr<FJsonValue>> Atlases;
	for (const FString& A : Anim.AtlasAssetPaths) Atlases.Add(MakeShared<FJsonValueString>(A));
	Root->SetArrayField(TEXT("atlases"), Atlases);

	TArray<TSharedPtr<FJsonValue>> Flipbooks;
	for (const FString& F : Anim.FlipbookAssetPaths) Flipbooks.Add(MakeShared<FJsonValueString>(F));
	Root->SetArrayField(TEXT("flipbooks"), Flipbooks);

	FString Out;
	const TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&Out);
	FJsonSerializer::Serialize(Root.ToSharedRef(), W);
	return Out;
}

// ============================================================================
// BuildPaperCharacter
// ============================================================================
FString UHktPaperSpriteBuilderFunctionLibrary::BuildPaperCharacter(
	const FString& CharacterTagStr,
	const FString& VisualIdentifierTagStr,
	float PixelToWorld,
	const FString& OutputDir)
{
	if (CharacterTagStr.IsEmpty()) return MakeErrorJson(TEXT("CharacterTagStr 필수"));

	const FString SafeChar = HktPaperAssetBuilder::SanitizeForAssetName(CharacterTagStr);
	const FString OutDir   = ResolveOutputDir(OutputDir, SafeChar);

	TArray<FString> AnimSafeNames;
	if (!HktPaperWorkspace::DiscoverAnimNames(CharacterTagStr, AnimSafeNames) || AnimSafeNames.IsEmpty())
	{
		return MakeErrorJson(FString::Printf(
			TEXT("Workspace 에 anim 폴더가 없음 (char=%s)"), *CharacterTagStr));
	}

	// 디스커버된 SafeAnim 들은 SanitizeForAssetName 결과로, 원본 anim 태그 문자열을 복원하기 어렵다.
	// HktSpriteGenerator 컨벤션은 "Anim.FullBody.Locomotion.Idle" → "Anim_FullBody_Locomotion_Locomotion_Idle"
	// 식의 무손실 1:1 매핑이 아니다 — 워크스페이스 자체가 SafeName 기준으로 정착돼 있다.
	// 따라서 BuildPaperCharacter 는 "SafeAnim 자체를 anim 식별자로 사용"하는 보수적 전략을 쓴다:
	// SafeAnim 안의 '_' 를 '.' 로 복원해 추정 — 호출자가 Tag 등록을 미리 해뒀을 것을 기대.
	TArray<TSharedPtr<FJsonValue>> AnimResults;
	int32 OkCount = 0;
	for (const FString& SafeAnim : AnimSafeNames)
	{
		// '_' → '.' 복원 추정. (이 휴리스틱이 깨지면 호출자가 BuildPaperSpriteAnim 을 anim 별로
		// 직접 호출해 정확한 tag 를 명시한다.)
		FString GuessTag = SafeAnim.Replace(TEXT("_"), TEXT("."));

		const FString Single = BuildPaperSpriteAnim(
			CharacterTagStr, GuessTag,
			/*CellWidth*/ 0, /*CellHeight*/ 0,
			PixelToWorld, /*FrameDurationMs*/ 100.f,
			/*bLooping*/ true, /*bMirrorWestFromEast*/ true,
			VisualIdentifierTagStr, OutDir);

		TSharedPtr<FJsonObject> Obj;
		const TSharedRef<TJsonReader<>> R = TJsonReaderFactory<>::Create(Single);
		if (FJsonSerializer::Deserialize(R, Obj) && Obj.IsValid())
		{
			AnimResults.Add(MakeShared<FJsonValueObject>(Obj));
			bool bOk = false;
			if (Obj->TryGetBoolField(TEXT("success"), bOk) && bOk)
			{
				++OkCount;
			}
		}
	}

	TSharedPtr<FJsonObject> Root = MakeShared<FJsonObject>();
	Root->SetBoolField(TEXT("success"), OkCount > 0);
	Root->SetStringField(TEXT("characterTag"), CharacterTagStr);
	Root->SetStringField(TEXT("outputDir"), OutDir);
	Root->SetNumberField(TEXT("animCount"), AnimResults.Num());
	Root->SetNumberField(TEXT("okCount"), OkCount);
	Root->SetArrayField(TEXT("anims"), AnimResults);
	if (OkCount == 0)
	{
		Root->SetStringField(TEXT("error"), TEXT("모든 anim 빌드 실패"));
	}

	FString Out;
	const TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&Out);
	FJsonSerializer::Serialize(Root.ToSharedRef(), W);
	return Out;
}
