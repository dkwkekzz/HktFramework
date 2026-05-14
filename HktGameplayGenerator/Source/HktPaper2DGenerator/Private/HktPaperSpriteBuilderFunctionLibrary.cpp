// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPaperSpriteBuilderFunctionLibrary.h"
#include "HktPaperAssetBuilder.h"
#include "HktPaperWorkspaceScanner.h"
#include "HktPaper2DGeneratorLog.h"

#include "HktPaperCharacterTemplate.h"
#include "HktPaperActorVisualDataAsset.h"
#include "HktSpritePaperActor.h"

#include "GameplayTagsManager.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonWriter.h"
#include "Serialization/JsonSerializer.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Engine/Texture2D.h"
#include "PaperSprite.h"
#include "SpriteEditorOnlyTypes.h"
#include "HAL/FileManager.h"
#include "Misc/Paths.h"
#include "Misc/PackageName.h"
#include "UObject/Package.h"
#include "UObject/SavePackage.h"
#include "AssetRegistry/AssetRegistryModule.h"

namespace
{
	static const FString kDefaultOutputRoot       = TEXT("/Game/Generated/PaperSprites");
	static const FString kDefaultStaticOutputRoot = TEXT("/Game/Generated/PaperSprites/Static");

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

	// PR-5: 캐릭터별 사이드카는 BuildPaperCharacter 가 로드해 인자로 명시 전달한다.
	// 단일 anim 호출(BuildPaperSpriteAnim)은 호출자의 인자가 항상 우선 — 사이드카
	// 자동 적용은 의도와 어긋난다(에디터 패널에서 anim 별 미세 튜닝 케이스).

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

	// PR-5: 캐릭터별 사이드카(`paper_character_meta.json`) 로드 — 발견되면 anim 별
	// 빌드 시 인자로 명시 전달해 캐릭터별 override 로 동작.
	HktPaperWorkspace::FCharacterMeta CharMeta;
	const bool bHasCharMeta = HktPaperWorkspace::LoadCharacterMeta(CharacterTagStr, CharMeta);
	const float ResolvedPixelToWorld    = (bHasCharMeta && CharMeta.bHasPixelToWorld)
		? CharMeta.PixelToWorld : PixelToWorld;
	const float ResolvedFrameDurationMs = (bHasCharMeta && CharMeta.bHasFrameDurationMs)
		? CharMeta.FrameDurationMs : 100.f;
	const bool  ResolvedLooping         = (bHasCharMeta && CharMeta.bHasLooping)
		? CharMeta.bLooping : true;
	const bool  ResolvedMirrorWFE       = (bHasCharMeta && CharMeta.bHasMirrorWestFromEast)
		? CharMeta.bMirrorWestFromEast : true;

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
			ResolvedPixelToWorld, ResolvedFrameDurationMs,
			ResolvedLooping, ResolvedMirrorWFE,
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
	Root->SetBoolField(TEXT("characterMetaLoaded"), bHasCharMeta);
	if (bHasCharMeta)
	{
		TSharedPtr<FJsonObject> Meta = MakeShared<FJsonObject>();
		Meta->SetNumberField(TEXT("pixelToWorld"),    ResolvedPixelToWorld);
		Meta->SetNumberField(TEXT("frameDurationMs"), ResolvedFrameDurationMs);
		Meta->SetBoolField  (TEXT("looping"),         ResolvedLooping);
		Meta->SetBoolField  (TEXT("mirrorWestFromEast"), ResolvedMirrorWFE);
		Root->SetObjectField(TEXT("characterMeta"), Meta);
	}
	if (OkCount == 0)
	{
		Root->SetStringField(TEXT("error"), TEXT("모든 anim 빌드 실패"));
	}

	FString Out;
	const TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&Out);
	FJsonSerializer::Serialize(Root.ToSharedRef(), W);
	return Out;
}

// ============================================================================
// 정적 객체 (UPaperSprite 1장) 빌더 — 나무·바위·아이콘 등
// ============================================================================

namespace
{
	/** 전체 텍스처 → UPaperSprite 1개. 피벗 = 셀 하단 중앙 (지면 기준). */
	UPaperSprite* BuildWholeSprite(
		UPackage* Pkg,
		const FString& AssetName,
		UTexture2D* AtlasTex,
		float PixelToWorld)
	{
		if (!Pkg || !AtlasTex) return nullptr;

		// 기존 동일 이름이 있으면 transient 로 옮겨 새로 만든다 — 소스 이미지 변경에 대응.
		if (UPaperSprite* Existing = FindObject<UPaperSprite>(Pkg, *AssetName))
		{
			Existing->Rename(nullptr, GetTransientPackage(),
				REN_DontCreateRedirectors | REN_NonTransactional | REN_DoNotDirty);
		}

		UPaperSprite* Sprite = NewObject<UPaperSprite>(
			Pkg, FName(*AssetName), RF_Public | RF_Standalone);

		const int32 W = AtlasTex->GetSizeX();
		const int32 H = AtlasTex->GetSizeY();

		FSpriteAssetInitParameters InitParams;
		InitParams.Texture   = AtlasTex;
		InitParams.Offset    = FIntPoint(0, 0);
		InitParams.Dimension = FIntPoint(W, H);
		if (PixelToWorld > KINDA_SMALL_NUMBER)
		{
			InitParams.SetPixelsPerUnrealUnit(1.f / PixelToWorld);
		}

		Sprite->InitializeSprite(InitParams, /*bRebuildData=*/false);
		Sprite->SetTrim(false, FVector2D::ZeroVector, FVector2D(W, H), /*bRebuildData=*/false);

		// 피벗 = 하단 중앙. 나무/입간판류는 발 기준이 지면에 닿아야 자연스럽다.
		Sprite->SetPivotMode(
			ESpritePivotMode::Custom,
			FVector2D(W * 0.5f, H),
			/*bRebuildData=*/false);

		Sprite->RebuildData();
		return Sprite;
	}

	/** Visual 자산을 정적 sprite 슬롯에 wiring 후 저장. */
	UHktPaperActorVisualDataAsset* UpsertStaticVisual(
		const FString& OutputPackageDir,
		const FString& SafeTag,
		const FGameplayTag& IdentifierTag,
		UPaperSprite* Sprite,
		float PixelToWorld)
	{
		const FString AssetName   = FString::Printf(TEXT("DA_PaperVisual_%s"), *SafeTag);
		const FString PackagePath = OutputPackageDir / AssetName;
		const FString ObjectPath  = PackagePath + TEXT(".") + AssetName;

		UHktPaperActorVisualDataAsset* Visual = LoadObject<UHktPaperActorVisualDataAsset>(nullptr, *ObjectPath);
		if (!Visual)
		{
			UPackage* Pkg = CreatePackage(*PackagePath);
			if (!Pkg) return nullptr;
			Pkg->FullyLoad();
			Visual = NewObject<UHktPaperActorVisualDataAsset>(
				Pkg, FName(*AssetName), RF_Public | RF_Standalone);
		}

		Visual->IdentifierTag  = IdentifierTag;
		Visual->ActorClass     = AHktSpritePaperActor::StaticClass();
		Visual->StaticSprite   = Sprite;
		Visual->PixelToWorld   = PixelToWorld;
		// AnimationAsset / Animation 은 의도적으로 비움 — 정적 경로.
		Visual->AnimationAsset = nullptr;
		Visual->Animation      = nullptr;

		HktPaperAssetBuilder::SaveDataAsset(Visual);
		return Visual;
	}
}

FString UHktPaperSpriteBuilderFunctionLibrary::BuildPaperStaticVisual(
	const FString& VisualTagStr,
	const FString& SourceImagePath,
	float PixelToWorld,
	const FString& OutputDir)
{
	if (VisualTagStr.IsEmpty())      return MakeErrorJson(TEXT("VisualTagStr 필수"));
	if (SourceImagePath.IsEmpty())   return MakeErrorJson(TEXT("SourceImagePath 필수"));

	// 상대 경로면 프로젝트 디렉토리 기준으로 확장.
	FString PngPath = SourceImagePath;
	if (FPaths::IsRelative(PngPath))
	{
		PngPath = FPaths::ConvertRelativePathToFull(FPaths::ProjectDir(), PngPath);
	}
	if (!FPaths::FileExists(PngPath))
	{
		return MakeErrorJson(FString::Printf(TEXT("PNG 파일 없음: %s"), *PngPath));
	}

	const FString SafeTag = HktPaperAssetBuilder::SanitizeForAssetName(VisualTagStr);
	const FString OutDir  = !OutputDir.IsEmpty() ? OutputDir : (kDefaultStaticOutputRoot / SafeTag);

	const FGameplayTag VisualTag = EnsureTag(VisualTagStr);
	if (!VisualTag.IsValid())
	{
		return MakeErrorJson(FString::Printf(TEXT("VisualTag(%s) 등록 실패"), *VisualTagStr));
	}

	// 1) PNG → UTexture2D
	const FString TextureAssetName = FString::Printf(TEXT("T_PaperStatic_%s"), *SafeTag);
	const FString TexturePackage   = OutDir / TextureAssetName;
	UTexture2D* Tex = HktPaperAssetBuilder::ImportAtlasTexture(PngPath, TexturePackage, TextureAssetName);
	if (!Tex)
	{
		return MakeErrorJson(FString::Printf(TEXT("ImportAtlasTexture 실패: %s"), *PngPath));
	}

	// 2) 전체 텍스처 → UPaperSprite 1개 (별도 패키지)
	const FString SpriteAssetName = FString::Printf(TEXT("PS_PaperStatic_%s"), *SafeTag);
	const FString SpritePackage   = OutDir / SpriteAssetName;
	UPackage* SpritePkg = CreatePackage(*SpritePackage);
	if (!SpritePkg)
	{
		return MakeErrorJson(TEXT("Sprite 패키지 생성 실패"));
	}
	SpritePkg->FullyLoad();
	UPaperSprite* Sprite = BuildWholeSprite(SpritePkg, SpriteAssetName, Tex, PixelToWorld);
	if (!Sprite)
	{
		return MakeErrorJson(TEXT("UPaperSprite 빌드 실패"));
	}

	FAssetRegistryModule::AssetCreated(Sprite);
	SpritePkg->MarkPackageDirty();
	{
		const FString SpriteFile = FPackageName::LongPackageNameToFilename(
			SpritePackage, FPackageName::GetAssetPackageExtension());
		FSavePackageArgs SaveArgs;
		SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
		SaveArgs.SaveFlags     = SAVE_NoError;
		SaveArgs.Error         = GLog;
		UPackage::SavePackage(SpritePkg, Sprite, *SpriteFile, SaveArgs);
	}

	// 3) Visual DA upsert (StaticSprite 슬롯)
	UHktPaperActorVisualDataAsset* Visual = UpsertStaticVisual(
		OutDir, SafeTag, VisualTag, Sprite, PixelToWorld);
	if (!Visual)
	{
		return MakeErrorJson(TEXT("UHktPaperActorVisualDataAsset upsert 실패"));
	}

	TSharedPtr<FJsonObject> Root = MakeShared<FJsonObject>();
	Root->SetBoolField(TEXT("success"), true);
	Root->SetStringField(TEXT("visualTag"),       VisualTagStr);
	Root->SetStringField(TEXT("sourceImagePath"), PngPath);
	Root->SetStringField(TEXT("texturePath"),     TexturePackage);
	Root->SetStringField(TEXT("spritePath"),      SpritePackage);
	Root->SetStringField(TEXT("visualPath"),      OutDir / FString::Printf(TEXT("DA_PaperVisual_%s"), *SafeTag));
	Root->SetNumberField(TEXT("pixelToWorld"),    PixelToWorld);
	Root->SetNumberField(TEXT("textureWidth"),    Tex->GetSizeX());
	Root->SetNumberField(TEXT("textureHeight"),   Tex->GetSizeY());

	FString Out;
	const TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&Out);
	FJsonSerializer::Serialize(Root.ToSharedRef(), W);
	return Out;
}

FString UHktPaperSpriteBuilderFunctionLibrary::BuildPaperStaticFolder(
	const FString& BaseVisualTagStr,
	const FString& SourceFolder,
	float PixelToWorld,
	const FString& OutputDir)
{
	if (BaseVisualTagStr.IsEmpty()) return MakeErrorJson(TEXT("BaseVisualTagStr 필수"));
	if (SourceFolder.IsEmpty())     return MakeErrorJson(TEXT("SourceFolder 필수"));

	FString FolderAbs = SourceFolder;
	if (FPaths::IsRelative(FolderAbs))
	{
		FolderAbs = FPaths::ConvertRelativePathToFull(FPaths::ProjectDir(), FolderAbs);
	}
	if (!FPaths::DirectoryExists(FolderAbs))
	{
		return MakeErrorJson(FString::Printf(TEXT("폴더 없음: %s"), *FolderAbs));
	}

	TArray<FString> PngFiles;
	IFileManager::Get().FindFiles(PngFiles, *(FolderAbs / TEXT("*.png")), /*Files*/true, /*Dirs*/false);
	if (PngFiles.IsEmpty())
	{
		return MakeErrorJson(FString::Printf(TEXT("폴더에 PNG 가 없음: %s"), *FolderAbs));
	}

	TArray<TSharedPtr<FJsonValue>> Results;
	int32 OkCount = 0;
	for (const FString& PngName : PngFiles)
	{
		const FString Stem = FPaths::GetBaseFilename(PngName);
		const FString FullPath = FolderAbs / PngName;
		const FString VisualTagStr = FString::Printf(TEXT("%s.%s"), *BaseVisualTagStr, *Stem);

		const FString Single = BuildPaperStaticVisual(VisualTagStr, FullPath, PixelToWorld, OutputDir);

		TSharedPtr<FJsonObject> Obj;
		const TSharedRef<TJsonReader<>> R = TJsonReaderFactory<>::Create(Single);
		if (FJsonSerializer::Deserialize(R, Obj) && Obj.IsValid())
		{
			Results.Add(MakeShared<FJsonValueObject>(Obj));
			bool bOk = false;
			if (Obj->TryGetBoolField(TEXT("success"), bOk) && bOk) ++OkCount;
		}
	}

	TSharedPtr<FJsonObject> Root = MakeShared<FJsonObject>();
	Root->SetBoolField(TEXT("success"), OkCount > 0);
	Root->SetStringField(TEXT("baseVisualTag"), BaseVisualTagStr);
	Root->SetStringField(TEXT("sourceFolder"),  FolderAbs);
	Root->SetNumberField(TEXT("totalCount"),    PngFiles.Num());
	Root->SetNumberField(TEXT("okCount"),       OkCount);
	Root->SetArrayField (TEXT("entries"),       Results);
	if (OkCount == 0)
	{
		Root->SetStringField(TEXT("error"), TEXT("모든 PNG 빌드 실패"));
	}

	FString Out;
	const TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&Out);
	FJsonSerializer::Serialize(Root.ToSharedRef(), W);
	return Out;
}
