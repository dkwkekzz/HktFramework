// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPaperSpriteBuilderFunctionLibrary.h"
#include "HktPaperAssetBuilder.h"
#include "HktPaper2DGeneratorLog.h"

#include "HktPaperActorVisualDataAsset.h"
#include "HktSpritePaperActor.h"

#include "GameplayTagsManager.h"
#if WITH_EDITOR
#include "GameplayTagsEditorModule.h"
#include "Modules/ModuleManager.h"
#endif
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

	/**
	 * 안 등록된 GameplayTag 를 즉시 사용 가능하게 보장.
	 * AddNativeGameplayTag 는 bDoneAddingNativeTags=true 후 호출 시 ensure 트립이라 사용 불가.
	 * UGameplayTagsManager::AddNewGameplayTagToINI (editor 전용 공식 API) 가
	 * settings 갱신 + ini 저장 + EditorRefreshGameplayTagTree 까지 한번에 수행.
	 */
	FGameplayTag EnsureTag(const FString& TagStr)
	{
		if (TagStr.IsEmpty()) return FGameplayTag();

		UGameplayTagsManager& TagsMgr = UGameplayTagsManager::Get();
		FGameplayTag Tag = TagsMgr.RequestGameplayTag(FName(*TagStr), /*ErrorIfNotFound*/false);
		if (Tag.IsValid())
		{
			return Tag;
		}

#if WITH_EDITOR
		if (IGameplayTagsEditorModule::IsAvailable())
		{
			IGameplayTagsEditorModule::Get().AddNewGameplayTagToINI(
				TagStr,
				TEXT("PaperSprite auto-registered"),
				FName(TEXT("HktWorkspaceTags.ini")));
		}
#endif
		Tag = TagsMgr.RequestGameplayTag(FName(*TagStr), /*ErrorIfNotFound*/false);
		if (!Tag.IsValid())
		{
			UE_LOG(LogHktPaper2DGenerator, Warning,
				TEXT("[PaperSprite] GameplayTag 등록 실패(tree 반영 안됨): %s"), *TagStr);
		}
		return Tag;
	}
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
