// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteGeneratorFunctionLibrary.h"
#include "HktSpriteCharacterTemplate.h"
#include "HktSpriteGeneratorSettings.h"
#include "HktSpriteTypes.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Editor.h"
#include "Engine/Texture2D.h"
#include "Factories/TextureFactory.h"
#include "GameplayTagsManager.h"
#include "HAL/FileManager.h"
#include "IImageWrapper.h"
#include "IImageWrapperModule.h"
#include "Internationalization/Regex.h"
#include "Misc/FileHelper.h"
#include "Misc/PackageName.h"
#include "Misc/Paths.h"
#include "HAL/PlatformMisc.h"
#include "HAL/PlatformProcess.h"
#include "Modules/ModuleManager.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "UObject/Package.h"
#include "UObject/SavePackage.h"

DEFINE_LOG_CATEGORY_STATIC(LogHktSpriteGenerator, Log, All);

// ============================================================================
// 헬퍼
// ============================================================================

namespace HktSpriteGen
{
	static FString MakeResult(bool bSuccess, const TMap<FString, FString>& Fields)
	{
		FString Json;
		TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&Json);
		W->WriteObjectStart();
		W->WriteValue(TEXT("success"), bSuccess);
		for (const auto& P : Fields) W->WriteValue(P.Key, P.Value);
		W->WriteObjectEnd();
		W->Close();
		return Json;
	}

	static FString MakeSpriteError(const FString& Msg)
	{
		UE_LOG(LogHktSpriteGenerator, Warning, TEXT("%s"), *Msg);
		return MakeResult(false, { {TEXT("error"), Msg} });
	}

	/** Tag 문자열을 네이티브 등록해 FGameplayTag로 반환. */
	static FGameplayTag EnsureTag(const FString& TagStr)
	{
		UGameplayTagsManager& TM = UGameplayTagsManager::Get();
		FGameplayTag Existing = TM.RequestGameplayTag(FName(*TagStr), /*ErrorIfNotFound*/ false);
		if (Existing.IsValid()) return Existing;
		return TM.AddNativeGameplayTag(FName(*TagStr));
	}

	static FString SanitizeForAssetName(const FString& In)
	{
		return In.Replace(TEXT("."), TEXT("_"));
	}

	/**
	 * VideoExtract / BuildSpriteAnim 가 공유하는 산출물 규약 경로.
	 *   {ProjectSavedDir}/SpriteGenerator/{SafeCharTag}
	 * 이 한 곳을 두 코드 경로가 모두 보면 SourcePath 자동 해석이 일관된다.
	 */
	static FString ConventionBundleRoot(const FString& CharacterTagStr)
	{
		return FPaths::ProjectSavedDir() / TEXT("SpriteGenerator") / SanitizeForAssetName(CharacterTagStr);
	}

	static FString ConventionBundleDir(const FString& CharacterTagStr, const FString& AnimTagStr)
	{
		return ConventionBundleRoot(CharacterTagStr) / SanitizeForAssetName(AnimTagStr);
	}

	static FString ConventionAtlasPng(const FString& CharacterTagStr, const FString& AnimTagStr)
	{
		return ConventionBundleRoot(CharacterTagStr) / (SanitizeForAssetName(AnimTagStr) + TEXT("_atlas.png"));
	}

	// 방향별(분할) 컨벤션 — Stage 1/2/3 가 공유.
	// 디렉터리 이름은 kDirectionNames(N..NW) 와 정확히 일치.
	static const TCHAR* const kDirNamesNS[8] = {
		TEXT("N"), TEXT("NE"), TEXT("E"), TEXT("SE"),
		TEXT("S"), TEXT("SW"), TEXT("W"), TEXT("NW")
	};

	static FString ConventionDirBundleDir(const FString& CharacterTagStr, const FString& AnimTagStr, int32 DirIdx)
	{
		const int32 Safe = FMath::Clamp(DirIdx, 0, 7);
		return ConventionBundleDir(CharacterTagStr, AnimTagStr) / kDirNamesNS[Safe];
	}

	static FString ConventionDirAtlasPng(const FString& CharacterTagStr, const FString& AnimTagStr, int32 DirIdx)
	{
		const int32 Safe = FMath::Clamp(DirIdx, 0, 7);
		return ConventionBundleDir(CharacterTagStr, AnimTagStr)
			/ FString::Printf(TEXT("atlas_%s.png"), kDirNamesNS[Safe]);
	}

	static FString ConventionDirAtlasAssetName(const FString& CharacterTagStr, const FString& AnimTagStr, int32 DirIdx)
	{
		const int32 Safe = FMath::Clamp(DirIdx, 0, 7);
		return FString::Printf(TEXT("T_SpriteAtlas_%s_%s_%s"),
			*SanitizeForAssetName(CharacterTagStr),
			*SanitizeForAssetName(AnimTagStr),
			kDirNamesNS[Safe]);
	}

	static FString ConventionDirAtlasPackagePath(const FString& CharacterTagStr, const FString& AnimTagStr,
		int32 DirIdx, const FString& OutputDir)
	{
		return OutputDir / ConventionDirAtlasAssetName(CharacterTagStr, AnimTagStr, DirIdx);
	}

	/**
	 * 파일명에서 뽑아낸 action 문자열("idle","walk",...)을 표준 anim tag로 승격.
	 */
	static FString ActionNameToAnimTagString(const FString& ActionName)
	{
		const FString Lower = ActionName.ToLower();
		if (Lower == TEXT("idle")) return TEXT("Anim.FullBody.Locomotion.Idle");
		if (Lower == TEXT("walk")) return TEXT("Anim.FullBody.Locomotion.Walk");
		if (Lower == TEXT("run"))  return TEXT("Anim.FullBody.Locomotion.Run");
		if (Lower == TEXT("fall")) return TEXT("Anim.FullBody.Locomotion.Fall");

		FString Capitalized = Lower;
		if (Capitalized.Len() > 0)
		{
			Capitalized[0] = FChar::ToUpper(Capitalized[0]);
		}
		return FString::Printf(TEXT("Anim.FullBody.%s"), *Capitalized);
	}

	static UTexture2D* ImportAtlasTexture(const FString& PngPath, const FString& PackagePath, const FString& AssetName)
	{
		TArray<uint8> FileData;
		if (!FFileHelper::LoadFileToArray(FileData, *PngPath))
		{
			UE_LOG(LogHktSpriteGenerator, Error, TEXT("아틀라스 PNG 읽기 실패: %s"), *PngPath);
			return nullptr;
		}

		UPackage* Package = CreatePackage(*PackagePath);
		if (!Package) return nullptr;
		Package->FullyLoad();

		UTextureFactory* Factory = NewObject<UTextureFactory>();
		Factory->AddToRoot();
		Factory->NoAlpha = false;
		Factory->bUseHashAsGuid = true;

		const uint8* BufBegin = FileData.GetData();
		const uint8* BufEnd   = FileData.GetData() + FileData.Num();
		UObject* Imported = Factory->FactoryCreateBinary(
			UTexture2D::StaticClass(), Package, FName(*AssetName),
			RF_Public | RF_Standalone, nullptr,
			*FPaths::GetExtension(PngPath), BufBegin, BufEnd, GWarn);
		Factory->RemoveFromRoot();

		UTexture2D* Tex = Cast<UTexture2D>(Imported);
		if (!Tex) return nullptr;

		// 스프라이트 아틀라스 표준 설정: 픽셀아트 Nearest, NoMipmap, 비압축.
		// LODGroup=UI 는 BaseDeviceProfiles.ini의 MaxLODSize 캡(보통 2048~4096)에 걸려
		// 큰 비디오 아틀라스가 강제 다운스케일된다. Pixels2D + MaxTextureSize=0 으로 원본 보존.
		Tex->CompressionSettings = TC_EditorIcon;
		Tex->Filter              = TF_Nearest;
		Tex->MipGenSettings      = TMGS_NoMipmaps;
		Tex->LODGroup            = TEXTUREGROUP_Pixels2D;
		Tex->MaxTextureSize      = 0;
		Tex->SRGB                = true;
		Tex->UpdateResource();

		Tex->MarkPackageDirty();
		const FString PkgFile = FPackageName::LongPackageNameToFilename(PackagePath, FPackageName::GetAssetPackageExtension());
		FSavePackageArgs SaveArgs;
		SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
		UPackage::SavePackage(Package, Tex, *PkgFile, SaveArgs);

		FAssetRegistryModule::AssetCreated(Tex);
		return Tex;
	}

}

// ============================================================================
// McpBuildSpriteCharacter
// ============================================================================

FString UHktSpriteGeneratorFunctionLibrary::McpBuildSpriteCharacter(const FString& JsonSpec)
{
	using namespace HktSpriteGen;

	TSharedPtr<FJsonObject> Root;
	TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(JsonSpec);
	if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
	{
		return MakeSpriteError(TEXT("JsonSpec parse failed"));
	}

	const FString TagStr   = Root->GetStringField(TEXT("characterTag"));
	const FString AtlasPng = Root->GetStringField(TEXT("atlasPngPath"));
	if (TagStr.IsEmpty() || AtlasPng.IsEmpty())
	{
		return MakeSpriteError(TEXT("characterTag / atlasPngPath required"));
	}
	if (!FPaths::FileExists(AtlasPng))
	{
		return MakeSpriteError(FString::Printf(TEXT("Atlas PNG not found: %s"), *AtlasPng));
	}

	const double CellW  = Root->GetNumberField(TEXT("cellW"));
	const double CellH  = Root->GetNumberField(TEXT("cellH"));
	double PixelToWorld = 2.0;
	Root->TryGetNumberField(TEXT("pixelToWorld"), PixelToWorld);

	FString OutputDir = TEXT("/Game/Generated/Sprites");
	Root->TryGetStringField(TEXT("outputDir"), OutputDir);

	// --- 에셋 경로 계산 ---
	const FString SafeTag        = SanitizeForAssetName(TagStr);
	const FString AtlasName      = FString::Printf(TEXT("T_SpriteAtlas_%s"), *SafeTag);
	const FString TemplateName   = FString::Printf(TEXT("DA_SpriteCharacter_%s"), *SafeTag);
	const FString AtlasPackage   = FString::Printf(TEXT("%s/%s"), *OutputDir, *AtlasName);
	const FString TemplatePackage= FString::Printf(TEXT("%s/%s"), *OutputDir, *TemplateName);

	// --- 1. Atlas 텍스처 임포트 ---
	UTexture2D* AtlasTex = ImportAtlasTexture(AtlasPng, AtlasPackage, AtlasName);
	if (!AtlasTex)
	{
		return MakeSpriteError(TEXT("Atlas 텍스처 임포트 실패"));
	}

	// --- 2. DataAsset 패키지/오브젝트 생성 ---
	UPackage* TmplPkg = CreatePackage(*TemplatePackage);
	if (!TmplPkg) return MakeSpriteError(TEXT("DataAsset 패키지 생성 실패"));
	TmplPkg->FullyLoad();

	UHktSpriteCharacterTemplate* Tmpl = NewObject<UHktSpriteCharacterTemplate>(
		TmplPkg, FName(*TemplateName), RF_Public | RF_Standalone);
	if (!Tmpl) return MakeSpriteError(TEXT("UHktSpriteCharacterTemplate 생성 실패"));

	Tmpl->IdentifierTag = EnsureTag(TagStr);
	Tmpl->Atlas         = AtlasTex;
	Tmpl->AtlasCellSize = FVector2f(static_cast<float>(CellW), static_cast<float>(CellH));
	Tmpl->PixelToWorld  = static_cast<float>(PixelToWorld);

	// --- 3. Animations 파싱 ---
	const TArray<TSharedPtr<FJsonValue>>* Animations = nullptr;
	if (Root->TryGetArrayField(TEXT("animations"), Animations) && Animations)
	{
		for (const TSharedPtr<FJsonValue>& V : *Animations)
		{
			const TSharedPtr<FJsonObject> A = V->AsObject();
			if (!A.IsValid()) continue;

			FString AnimTagStr;
			if (!A->TryGetStringField(TEXT("animTag"), AnimTagStr) || AnimTagStr.IsEmpty())
			{
				UE_LOG(LogHktSpriteGenerator, Warning, TEXT("애니에 animTag 없음 (skipped)"));
				continue;
			}
			const FGameplayTag AnimTag = EnsureTag(AnimTagStr);
			if (!AnimTag.IsValid())
			{
				UE_LOG(LogHktSpriteGenerator, Warning, TEXT("animTag 등록 실패: %s (skipped)"), *AnimTagStr);
				continue;
			}

			FHktSpriteAnimation Anim;

			int32 NumDir = 1, FramesPerDir = 1;
			A->TryGetNumberField(TEXT("numDirections"),      NumDir);
			A->TryGetNumberField(TEXT("framesPerDirection"), FramesPerDir);
			Anim.NumDirections      = FMath::Clamp(NumDir, 1, 8);
			Anim.FramesPerDirection = FMath::Max(FramesPerDir, 1);

			double PivX = CellW * 0.5, PivY = CellH; // 바닥 중앙 기본
			A->TryGetNumberField(TEXT("pivotX"), PivX);
			A->TryGetNumberField(TEXT("pivotY"), PivY);
			Anim.PivotOffset = FVector2f(static_cast<float>(PivX), static_cast<float>(PivY));

			double FrameDur = 100.0;
			A->TryGetNumberField(TEXT("frameDurationMs"), FrameDur);
			Anim.FrameDurationMs = static_cast<float>(FrameDur);

			bool bLoop = true, bMirror = true;
			A->TryGetBoolField(TEXT("looping"), bLoop);
			A->TryGetBoolField(TEXT("mirrorWestFromEast"), bMirror);
			Anim.bLooping = bLoop;
			Anim.bMirrorWestFromEast = bMirror;

			FString OnComplete;
			if (A->TryGetStringField(TEXT("onCompleteTransition"), OnComplete) && !OnComplete.IsEmpty())
			{
				Anim.OnCompleteTransition = EnsureTag(OnComplete);
			}

			const TArray<TSharedPtr<FJsonValue>>* PerFrame = nullptr;
			if (A->TryGetArrayField(TEXT("perFrameDurationMs"), PerFrame) && PerFrame)
			{
				for (const auto& F : *PerFrame) Anim.PerFrameDurationMs.Add(static_cast<float>(F->AsNumber()));
			}

			// Per-frame 배열은 더 이상 저장하지 않는다 — 그리드 규약(AtlasIndex=frameIdx,
			// AtlasSlotIdx=dirIdx)으로 합성. startAtlasIndex JSON 필드는 무시.

			Tmpl->Animations.Add(AnimTag, MoveTemp(Anim));
		}
	}

	// --- DefaultAnimTag 설정 ---
	//   명시 필드 우선, 없으면 Anim.FullBody.Locomotion.Idle, 그것도 없으면 첫 번째 키.
	FString DefaultTagStr;
	if (Root->TryGetStringField(TEXT("defaultAnimTag"), DefaultTagStr) && !DefaultTagStr.IsEmpty())
	{
		Tmpl->DefaultAnimTag = EnsureTag(DefaultTagStr);
	}
	else
	{
		const FGameplayTag IdleTag = EnsureTag(TEXT("Anim.FullBody.Locomotion.Idle"));
		if (Tmpl->Animations.Contains(IdleTag))
		{
			Tmpl->DefaultAnimTag = IdleTag;
		}
		else if (Tmpl->Animations.Num() > 0)
		{
			for (const auto& Pair : Tmpl->Animations)
			{
				Tmpl->DefaultAnimTag = Pair.Key;
				break;
			}
		}
	}

	// --- 4. 패키지 저장 ---
	Tmpl->MarkPackageDirty();
	const FString TmplFile = FPackageName::LongPackageNameToFilename(TemplatePackage, FPackageName::GetAssetPackageExtension());
	FSavePackageArgs SaveArgs;
	SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
	if (!UPackage::SavePackage(TmplPkg, Tmpl, *TmplFile, SaveArgs))
	{
		return MakeSpriteError(TEXT("DataAsset 패키지 저장 실패"));
	}
	FAssetRegistryModule::AssetCreated(Tmpl);

	UE_LOG(LogHktSpriteGenerator, Log, TEXT("SpriteCharacter 빌드 완료: Tag=%s Atlas=%s Template=%s Anims=%d"),
		*TagStr, *AtlasPackage, *TemplatePackage, Tmpl->Animations.Num());

	return MakeResult(true, {
		{ TEXT("tag"),            TagStr },
		{ TEXT("atlasAssetPath"), FString::Printf(TEXT("%s.%s"), *AtlasPackage,    *AtlasName)    },
		{ TEXT("dataAssetPath"),  FString::Printf(TEXT("%s.%s"), *TemplatePackage, *TemplateName) },
	});
}

// ============================================================================
// EditorBuildSpriteCharacterFromDirectory — 에디터 단독 파이프라인
// ============================================================================

namespace HktSpriteGen
{
	constexpr int32 kNumDirections = 8;
	static const TCHAR* const kDirectionNames[kNumDirections] = {
		TEXT("N"), TEXT("NE"), TEXT("E"), TEXT("SE"),
		TEXT("S"), TEXT("SW"), TEXT("W"), TEXT("NW")
	};

	static int32 DirectionIndexFromName(const FString& Name)
	{
		for (int32 i = 0; i < kNumDirections; ++i)
		{
			if (Name.Equals(kDirectionNames[i], ESearchCase::CaseSensitive)) return i;
		}
		return INDEX_NONE;
	}

	static bool IsSupportedImageExt(const FString& Ext)
	{
		const FString E = Ext.ToLower();
		return E == TEXT("png") || E == TEXT("tga") || E == TEXT("jpg") ||
		       E == TEXT("jpeg") || E == TEXT("bmp") || E == TEXT("webp");
	}

	static EImageFormat ImageFormatFromExt(const FString& Ext)
	{
		const FString E = Ext.ToLower();
		if (E == TEXT("png"))                     return EImageFormat::PNG;
		if (E == TEXT("tga"))                     return EImageFormat::BMP;
		if (E == TEXT("jpg") || E == TEXT("jpeg")) return EImageFormat::JPEG;
		if (E == TEXT("bmp"))                     return EImageFormat::BMP;
		return EImageFormat::PNG;
	}

	/** 한 프레임 단위: action/direction/frameIdx/경로/크기. */
	struct FFrameEntry
	{
		FString Action;
		int32 DirectionIdx = INDEX_NONE;  // INDEX_NONE이면 "모든 방향 공통"
		int32 FrameIdx = 0;
		FString FilePath;
	};

	/** 파일명 stem: {action}[_{direction}][_{frame_idx}] */
	static bool ParseFlatStem(const FString& Stem, FString& OutAction, int32& OutDirIdx, int32& OutFrameIdx)
	{
		static const FRegexPattern Pattern(TEXT("^([A-Za-z][A-Za-z0-9]*)(?:_(NE|NW|SE|SW|N|E|S|W))?(?:_(\\d+))?$"));
		FRegexMatcher M(Pattern, Stem);
		if (!M.FindNext()) return false;

		OutAction = M.GetCaptureGroup(1).ToLower();
		const FString DirCap = M.GetCaptureGroup(2);
		const FString IdxCap = M.GetCaptureGroup(3);
		OutDirIdx   = DirCap.IsEmpty() ? INDEX_NONE : DirectionIndexFromName(DirCap);
		OutFrameIdx = IdxCap.IsEmpty() ? 0 : FCString::Atoi(*IdxCap);
		return true;
	}

	static bool ScanDirectory(const FString& InputDir, TArray<FFrameEntry>& OutFrames, FString& OutError)
	{
		IFileManager& FM = IFileManager::Get();
		if (!FM.DirectoryExists(*InputDir))
		{
			OutError = FString::Printf(TEXT("입력 폴더 없음: %s"), *InputDir);
			return false;
		}

		auto AppendImage = [](const FString& Path, FString Action, int32 DirIdx, int32 FrameIdx, TArray<FFrameEntry>& Out)
		{
			FFrameEntry E;
			E.Action = Action;
			E.DirectionIdx = DirIdx;
			E.FrameIdx = FrameIdx;
			E.FilePath = Path;
			Out.Add(MoveTemp(E));
		};

		// (a) 플랫 스캔
		TArray<FString> TopFiles;
		FM.FindFiles(TopFiles, *(InputDir / TEXT("*.*")), /*Files*/ true, /*Dirs*/ false);
		for (const FString& FileName : TopFiles)
		{
			if (!IsSupportedImageExt(FPaths::GetExtension(FileName))) continue;
			FString Stem = FPaths::GetBaseFilename(FileName);
			FString Action; int32 DirIdx = INDEX_NONE; int32 FrameIdx = 0;
			if (!ParseFlatStem(Stem, Action, DirIdx, FrameIdx)) continue;
			AppendImage(InputDir / FileName, Action, DirIdx, FrameIdx, OutFrames);
		}

		// (b) 서브폴더 스캔: {action}/{direction}/{idx}.ext 또는 {action}/{direction}.ext
		TArray<FString> ActionDirs;
		FM.FindFiles(ActionDirs, *(InputDir / TEXT("*")), /*Files*/ false, /*Dirs*/ true);
		for (const FString& ActionDirName : ActionDirs)
		{
			const FString ActionPath = InputDir / ActionDirName;
			const FString ActionLower = ActionDirName.ToLower();

			TArray<FString> DirSubs;
			FM.FindFiles(DirSubs, *(ActionPath / TEXT("*")), false, true);
			bool bHasDirSub = false;
			for (const FString& Sub : DirSubs)
			{
				const int32 DirIdx = DirectionIndexFromName(Sub);
				if (DirIdx == INDEX_NONE) continue;
				bHasDirSub = true;

				OutFrames.RemoveAll([&ActionLower](const FFrameEntry& E){ return E.Action == ActionLower; });

				const FString DirPath = ActionPath / Sub;
				TArray<FString> Files;
				FM.FindFiles(Files, *(DirPath / TEXT("*.*")), true, false);
				Files.Sort();
				int32 FrameCounter = 0;
				for (const FString& F : Files)
				{
					if (!IsSupportedImageExt(FPaths::GetExtension(F))) continue;
					int32 FrameIdx = FrameCounter++;
					FString Stem = FPaths::GetBaseFilename(F);
					if (Stem.IsNumeric()) FrameIdx = FCString::Atoi(*Stem);
					AppendImage(DirPath / F, ActionLower, DirIdx, FrameIdx, OutFrames);
				}
			}
			if (bHasDirSub) continue;

			// direction 서브폴더가 없으면 action/*.ext 파일명으로 direction 추정
			TArray<FString> Files;
			FM.FindFiles(Files, *(ActionPath / TEXT("*.*")), true, false);
			Files.Sort();
			if (Files.Num() == 0) continue;
			OutFrames.RemoveAll([&ActionLower](const FFrameEntry& E){ return E.Action == ActionLower; });
			int32 UnknownCounter = 0;
			for (const FString& F : Files)
			{
				if (!IsSupportedImageExt(FPaths::GetExtension(F))) continue;
				FString Stem = FPaths::GetBaseFilename(F);
				const int32 DirIdx = DirectionIndexFromName(Stem);
				if (DirIdx != INDEX_NONE)
				{
					AppendImage(ActionPath / F, ActionLower, DirIdx, 0, OutFrames);
				}
				else
				{
					AppendImage(ActionPath / F, ActionLower, INDEX_NONE, UnknownCounter++, OutFrames);
				}
			}
		}

		if (OutFrames.Num() == 0)
		{
			OutError = FString::Printf(TEXT("스프라이트 파일을 찾지 못했습니다: %s"), *InputDir);
			return false;
		}
		return true;
	}

	static bool DecodeImageFile(const FString& Path, TArray64<uint8>& OutBGRA, int32& OutW, int32& OutH)
	{
		TArray<uint8> FileData;
		if (!FFileHelper::LoadFileToArray(FileData, *Path)) return false;

		IImageWrapperModule& IWM = FModuleManager::LoadModuleChecked<IImageWrapperModule>(TEXT("ImageWrapper"));
		const EImageFormat Fmt = ImageFormatFromExt(FPaths::GetExtension(Path));
		TSharedPtr<IImageWrapper> Wrapper = IWM.CreateImageWrapper(Fmt);
		if (!Wrapper.IsValid() || !Wrapper->SetCompressed(FileData.GetData(), FileData.Num())) return false;
		OutW = Wrapper->GetWidth();
		OutH = Wrapper->GetHeight();
		return Wrapper->GetRaw(ERGBFormat::BGRA, 8, OutBGRA);
	}

	struct FDecodedImage
	{
		TArray64<uint8> BGRA;
		int32 Width = 0;
		int32 Height = 0;
	};

	static bool PackAtlas(TArray<FFrameEntry>& Frames, const FString& OutPngPath,
	                      int32& OutCellW, int32& OutCellH, int32& OutCols, int32& OutRows,
	                      TMap<TTuple<FString,int32,int32>, int32>& OutIndexMap, FString& OutError)
	{
		TMap<FString, FDecodedImage> DecodedByPath;
		int32 MaxW = 0, MaxH = 0;
		for (const FFrameEntry& E : Frames)
		{
			if (DecodedByPath.Contains(E.FilePath)) continue;
			FDecodedImage Img;
			if (!DecodeImageFile(E.FilePath, Img.BGRA, Img.Width, Img.Height))
			{
				OutError = FString::Printf(TEXT("이미지 디코드 실패: %s"), *E.FilePath);
				return false;
			}
			MaxW = FMath::Max(MaxW, Img.Width);
			MaxH = FMath::Max(MaxH, Img.Height);
			DecodedByPath.Add(E.FilePath, MoveTemp(Img));
		}
		if (MaxW == 0 || MaxH == 0)
		{
			OutError = TEXT("입력 이미지 크기가 0");
			return false;
		}
		OutCellW = MaxW;
		OutCellH = MaxH;

		Frames.Sort([](const FFrameEntry& A, const FFrameEntry& B)
		{
			if (A.Action != B.Action) return A.Action < B.Action;
			const int32 Ad = A.DirectionIdx == INDEX_NONE ? -1 : A.DirectionIdx;
			const int32 Bd = B.DirectionIdx == INDEX_NONE ? -1 : B.DirectionIdx;
			if (Ad != Bd) return Ad < Bd;
			return A.FrameIdx < B.FrameIdx;
		});

		// INDEX_NONE 프레임은 명시 방향이 없는 방향에만 복제.
		TMap<FString, TSet<int32>> ExplicitDirsPerAction;
		for (const FFrameEntry& E : Frames)
		{
			if (E.DirectionIdx != INDEX_NONE)
			{
				ExplicitDirsPerAction.FindOrAdd(E.Action).Add(E.DirectionIdx);
			}
		}
		TArray<FFrameEntry> Expanded;
		Expanded.Reserve(Frames.Num() * 2);
		for (const FFrameEntry& E : Frames)
		{
			if (E.DirectionIdx == INDEX_NONE)
			{
				const TSet<int32>* Explicit = ExplicitDirsPerAction.Find(E.Action);
				for (int32 d = 0; d < kNumDirections; ++d)
				{
					if (Explicit && Explicit->Contains(d)) continue;
					FFrameEntry Copy = E;
					Copy.DirectionIdx = d;
					Expanded.Add(Copy);
				}
			}
			else
			{
				Expanded.Add(E);
			}
		}
		Frames = MoveTemp(Expanded);

		// 아틀라스 셀은 고유 파일 단위.
		TMap<FString, int32> PathToCell;
		TArray<FString> CellOrder;
		CellOrder.Reserve(DecodedByPath.Num());
		for (const FFrameEntry& E : Frames)
		{
			if (!PathToCell.Contains(E.FilePath))
			{
				PathToCell.Add(E.FilePath, CellOrder.Num());
				CellOrder.Add(E.FilePath);
			}
		}

		const int32 CellCount = CellOrder.Num();

		// 아틀라스 한 변을 8192 이하로 제한(GPU 한계·LODGroup 캡 회피).
		// 1) 기본 cols = min(kNumDirections, CellCount)
		// 2) Width 캡: cols ≤ 8192 / CellW
		// 3) Height 캡: rows ≤ 8192 / CellH → 필요 시 cols를 늘려 행 수를 줄임
		// 4) 셀 자체가 너무 커 둘 다 못 맞추는 경우 경고 로그 후 진행.
		constexpr int32 kMaxAtlasDim = 8192;
		const int32 MaxColsByWidth  = FMath::Max(1, kMaxAtlasDim / FMath::Max(1, OutCellW));
		const int32 MaxRowsByHeight = FMath::Max(1, kMaxAtlasDim / FMath::Max(1, OutCellH));
		const int32 MinColsByRows   = FMath::DivideAndRoundUp(CellCount, MaxRowsByHeight);

		int32 PreferredCols = FMath::Min(kNumDirections, CellCount);
		PreferredCols = FMath::Max(PreferredCols, MinColsByRows);
		PreferredCols = FMath::Min(PreferredCols, MaxColsByWidth);
		OutCols = FMath::Max(1, PreferredCols);
		OutRows = FMath::DivideAndRoundUp(CellCount, OutCols);

		if (OutCols * OutCellW > kMaxAtlasDim || OutRows * OutCellH > kMaxAtlasDim)
		{
			UE_LOG(LogHktSpriteGenerator, Warning,
				TEXT("아틀라스가 %d 한계를 초과합니다(CellW=%d CellH=%d Cells=%d → %dx%d). 셀 크기가 너무 큽니다."),
				kMaxAtlasDim, OutCellW, OutCellH, CellCount,
				OutCols * OutCellW, OutRows * OutCellH);
		}

		const int32 AtlasW = OutCols * OutCellW;
		const int32 AtlasH = OutRows * OutCellH;
		TArray64<uint8> AtlasBuf;
		AtlasBuf.SetNumZeroed(static_cast<int64>(AtlasW) * AtlasH * 4);

		for (int32 i = 0; i < CellCount; ++i)
		{
			const FDecodedImage& Img = DecodedByPath[CellOrder[i]];
			const int32 Col = i % OutCols;
			const int32 Row = i / OutCols;
			const int32 DstX0 = Col * OutCellW;
			const int32 DstY0 = Row * OutCellH;
			for (int32 y = 0; y < Img.Height; ++y)
			{
				const int64 SrcOff = static_cast<int64>(y) * Img.Width * 4;
				const int64 DstOff = (static_cast<int64>(DstY0 + y) * AtlasW + DstX0) * 4;
				FMemory::Memcpy(AtlasBuf.GetData() + DstOff, Img.BGRA.GetData() + SrcOff, static_cast<SIZE_T>(Img.Width) * 4);
			}
		}

		for (const FFrameEntry& E : Frames)
		{
			OutIndexMap.Add(MakeTuple(E.Action, E.DirectionIdx, E.FrameIdx), PathToCell[E.FilePath]);
		}

		IImageWrapperModule& IWM = FModuleManager::LoadModuleChecked<IImageWrapperModule>(TEXT("ImageWrapper"));
		TSharedPtr<IImageWrapper> Wrapper = IWM.CreateImageWrapper(EImageFormat::PNG);
		if (!Wrapper.IsValid() || !Wrapper->SetRaw(AtlasBuf.GetData(), AtlasBuf.Num(), AtlasW, AtlasH, ERGBFormat::BGRA, 8))
		{
			OutError = TEXT("Atlas PNG 인코드 실패");
			return false;
		}
		const TArray64<uint8>& Compressed = Wrapper->GetCompressed();
		if (!FFileHelper::SaveArrayToFile(Compressed, *OutPngPath))
		{
			OutError = FString::Printf(TEXT("Atlas PNG 파일 저장 실패: %s"), *OutPngPath);
			return false;
		}
		return true;
	}

	/**
	 * 패킹 결과를 McpBuildSpriteCharacter JsonSpec으로 변환.
	 * animations[].frames 는 (dir, frame) 순으로 numDirections × framesPerDirection 개 채운다.
	 */
	static FString BuildSpecJson(
		const FString& Tag, const FString& AtlasPngPath,
		int32 CellW, int32 CellH, float PixelToWorld, const FString& OutputDir,
		const TArray<FFrameEntry>& Frames,
		const TMap<TTuple<FString,int32,int32>, int32>& IndexMap,
		float FrameDurationMs, bool bLooping, bool bMirrorWestFromEast,
		const FString& AnimTagOverride)
	{
		// action → dirIdx → sorted frames
		TMap<FString, TArray<TArray<const FFrameEntry*>>> Grouped;
		for (const FFrameEntry& E : Frames)
		{
			TArray<TArray<const FFrameEntry*>>& DirArr = Grouped.FindOrAdd(E.Action);
			if (DirArr.Num() < kNumDirections) DirArr.SetNum(kNumDirections);
			DirArr[E.DirectionIdx].Add(&E);
		}
		for (auto& Pair : Grouped)
		{
			for (int32 d = 0; d < kNumDirections; ++d)
			{
				Pair.Value[d].Sort([](const FFrameEntry& A, const FFrameEntry& B){ return A.FrameIdx < B.FrameIdx; });
			}
		}

		FString Json;
		TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&Json);
		W->WriteObjectStart();
		W->WriteValue(TEXT("characterTag"), Tag);
		W->WriteValue(TEXT("atlasPngPath"), AtlasPngPath);
		W->WriteValue(TEXT("cellW"), CellW);
		W->WriteValue(TEXT("cellH"), CellH);
		W->WriteValue(TEXT("pixelToWorld"), PixelToWorld);
		if (!OutputDir.IsEmpty()) W->WriteValue(TEXT("outputDir"), OutputDir);

		W->WriteArrayStart(TEXT("animations"));
		TArray<FString> ActionKeys;
		Grouped.GenerateKeyArray(ActionKeys);
		ActionKeys.Sort();
		for (const FString& ActionId : ActionKeys)
		{
			const TArray<TArray<const FFrameEntry*>>& Dirs = Grouped[ActionId];

			int32 MaxFrames = 0;
			for (int32 d = 0; d < kNumDirections; ++d)
			{
				MaxFrames = FMath::Max(MaxFrames, Dirs[d].Num());
			}
			if (MaxFrames == 0) continue;

			W->WriteObjectStart();
			// AnimTagOverride 가 지정된 경우 파일명 추론 결과를 무시하고 그대로 사용.
			// 단일 캡처 세션은 항상 ActionId 가 1개이므로 override 도 1:1 매핑.
			const FString AnimTagStr = AnimTagOverride.IsEmpty()
				? ActionNameToAnimTagString(ActionId) : AnimTagOverride;
			W->WriteValue(TEXT("animTag"), AnimTagStr);
			W->WriteValue(TEXT("numDirections"),      kNumDirections);
			W->WriteValue(TEXT("framesPerDirection"), MaxFrames);
			W->WriteValue(TEXT("pivotX"), static_cast<float>(CellW) * 0.5f);
			W->WriteValue(TEXT("pivotY"), static_cast<float>(CellH));
			W->WriteValue(TEXT("frameDurationMs"),  FrameDurationMs);
			W->WriteValue(TEXT("looping"),          bLooping);
			W->WriteValue(TEXT("mirrorWestFromEast"), bMirrorWestFromEast);

			// frames 배열 (dir × frame 선형): 각 셀은 아틀라스 패킹 결과의 고유 인덱스.
			W->WriteArrayStart(TEXT("frames"));
			for (int32 d = 0; d < kNumDirections; ++d)
			{
				const TArray<const FFrameEntry*>& DirFrames = Dirs[d];
				for (int32 f = 0; f < MaxFrames; ++f)
				{
					W->WriteObjectStart();
					int32 AtlasIndex = 0;
					if (f < DirFrames.Num())
					{
						const FFrameEntry* EP = DirFrames[f];
						const int32* Idx = IndexMap.Find(MakeTuple(EP->Action, EP->DirectionIdx, EP->FrameIdx));
						if (Idx) AtlasIndex = *Idx;
					}
					else if (DirFrames.Num() > 0)
					{
						// 부족한 프레임은 마지막 프레임 유지.
						const FFrameEntry* EP = DirFrames.Last();
						const int32* Idx = IndexMap.Find(MakeTuple(EP->Action, EP->DirectionIdx, EP->FrameIdx));
						if (Idx) AtlasIndex = *Idx;
					}
					W->WriteValue(TEXT("atlasIndex"), AtlasIndex);
					W->WriteObjectEnd();
				}
			}
			W->WriteArrayEnd();

			W->WriteObjectEnd();
		}
		W->WriteArrayEnd();
		W->WriteObjectEnd();
		W->Close();
		return Json;
	}
} // namespace HktSpriteGen

FString UHktSpriteGeneratorFunctionLibrary::EditorBuildSpriteCharacterFromDirectory(
	const FString& CharacterTag, const FString& InputDir,
	const FString& OutputDir, float PixelToWorld, float FrameDurationMs,
	bool bLooping, bool bMirrorWestFromEast,
	const FString& AnimTagOverride)
{
	using namespace HktSpriteGen;

	if (CharacterTag.IsEmpty() || InputDir.IsEmpty())
	{
		return MakeSpriteError(TEXT("CharacterTag / InputDir 필수"));
	}

	TArray<FFrameEntry> Frames;
	FString ScanError;
	if (!ScanDirectory(InputDir, Frames, ScanError))
	{
		return MakeSpriteError(ScanError);
	}

	const FString SafeTag = SanitizeForAssetName(CharacterTag);
	const FString OutDir  = FPaths::ProjectSavedDir() / TEXT("SpriteGenerator");
	IFileManager::Get().MakeDirectory(*OutDir, /*Tree*/ true);
	const FString AtlasPng = OutDir / (SafeTag + TEXT(".png"));

	int32 CellW = 0, CellH = 0, Cols = 0, Rows = 0;
	TMap<TTuple<FString,int32,int32>, int32> IndexMap;
	FString PackError;
	if (!PackAtlas(Frames, AtlasPng, CellW, CellH, Cols, Rows, IndexMap, PackError))
	{
		return MakeSpriteError(PackError);
	}

	const FString Spec = BuildSpecJson(CharacterTag, AtlasPng, CellW, CellH, PixelToWorld,
	                                   OutputDir, Frames, IndexMap,
	                                   FrameDurationMs, bLooping, bMirrorWestFromEast,
	                                   AnimTagOverride);

	UE_LOG(LogHktSpriteGenerator, Log, TEXT("EditorBuild: %d frames → Cell=%dx%d Grid=%dx%d"),
		Frames.Num(), CellW, CellH, Cols, Rows);

	return McpBuildSpriteCharacter(Spec);
}

// ============================================================================
// 동영상 → 프레임 추출 / 아틀라스 빌드 (ffmpeg 의존)
// ============================================================================

namespace HktSpriteGen
{
	static FString QuoteArg(const FString& In)
	{
		return FString::Printf(TEXT("\"%s\""), *In);
	}

	static bool ExtractVideoFramesImpl(
		const FString& VideoPath,
		const FString& OutputDir,
		int32 FrameWidth,
		int32 FrameHeight,
		float FrameRate,
		int32 MaxFrames,
		float StartTimeSec,
		float EndTimeSec,
		int32& OutFrameCount,
		FString& OutError)
	{
		OutFrameCount = 0;

		if (VideoPath.IsEmpty() || OutputDir.IsEmpty())
		{
			OutError = TEXT("VideoPath / OutputDir 필수");
			return false;
		}
		if (!FPaths::FileExists(VideoPath))
		{
			OutError = FString::Printf(TEXT("영상 파일 없음: %s"), *VideoPath);
			return false;
		}
		// FrameRate <= 0 → fps 필터 생략(원본 프레임 전부 보존). 모션·화질 손실 방지.
		IFileManager& FM = IFileManager::Get();
		FM.MakeDirectory(*OutputDir, /*Tree*/ true);

		const FString FFmpeg = UHktSpriteGeneratorSettings::ResolveFFmpegExecutable();

		FString VideoFilter;
		if (FrameRate > 0.0f)
		{
			VideoFilter = FString::Printf(TEXT("fps=%.6f"), FrameRate);
		}
		if (FrameWidth > 0 && FrameHeight > 0)
		{
			if (!VideoFilter.IsEmpty()) VideoFilter += TEXT(",");
			VideoFilter += FString::Printf(TEXT("scale=%d:%d:flags=lanczos"), FrameWidth, FrameHeight);
		}

		const FString OutPattern = OutputDir / TEXT("frame_%04d.png");
		const FString AbsVideoPath = FPaths::ConvertRelativePathToFull(VideoPath);

		FString Args;
		Args += TEXT("-y -hide_banner -loglevel error ");
		Args += FString::Printf(TEXT("-i %s "), *QuoteArg(AbsVideoPath));
		if (StartTimeSec > 0.0f)
		{
			Args += FString::Printf(TEXT("-ss %.3f "), StartTimeSec);
		}
		if (EndTimeSec > StartTimeSec && EndTimeSec > 0.0f)
		{
			Args += FString::Printf(TEXT("-t %.3f "), EndTimeSec - StartTimeSec);
		}
		if (!VideoFilter.IsEmpty())
		{
			Args += FString::Printf(TEXT("-vf \"%s\" "), *VideoFilter);
		}
		if (MaxFrames > 0)
		{
			Args += FString::Printf(TEXT("-frames:v %d "), MaxFrames);
		}
		Args += QuoteArg(OutPattern);

		UE_LOG(LogHktSpriteGenerator, Log, TEXT("ffmpeg %s"), *Args);

		{
			TArray<FString> OldFiles;
			FM.FindFiles(OldFiles, *(OutputDir / TEXT("frame_*.png")), true, false);
			for (const FString& F : OldFiles)
			{
				FM.Delete(*(OutputDir / F), /*RequireExists*/ false, /*EvenReadOnly*/ true);
			}
		}

		int32 ReturnCode = -1;
		FString StdErr;
		const bool bExecOk = FPlatformProcess::ExecProcess(*FFmpeg, *Args, &ReturnCode, /*StdOut*/ nullptr, &StdErr);
		if (!bExecOk)
		{
			OutError = FString::Printf(
				TEXT("ffmpeg 실행 불가: '%s'. Project Settings > Plugins > HKT Sprite Generator 의 FFmpeg Directory를 지정하세요."),
				*FFmpeg);
			return false;
		}
		if (ReturnCode != 0)
		{
			OutError = FString::Printf(TEXT("ffmpeg 실패 code=%d: %s"), ReturnCode, *StdErr.TrimStartAndEnd());
			return false;
		}

		TArray<FString> Files;
		FM.FindFiles(Files, *(OutputDir / TEXT("frame_*.png")), true, false);
		OutFrameCount = Files.Num();
		if (OutFrameCount == 0)
		{
			OutError = TEXT("ffmpeg는 성공했지만 추출된 프레임이 없습니다. 시간 범위/fps를 확인하세요.");
			return false;
		}
		return true;
	}
} // namespace HktSpriteGen

FString UHktSpriteGeneratorFunctionLibrary::EditorExtractVideoFrames(
	const FString& VideoPath, const FString& OutputDir,
	int32 FrameWidth, int32 FrameHeight, float FrameRate,
	int32 MaxFrames, float StartTimeSec, float EndTimeSec)
{
	using namespace HktSpriteGen;

	int32 FrameCount = 0;
	FString Err;
	if (!ExtractVideoFramesImpl(VideoPath, OutputDir,
		FrameWidth, FrameHeight, FrameRate, MaxFrames,
		StartTimeSec, EndTimeSec, FrameCount, Err))
	{
		return MakeSpriteError(Err);
	}

	UE_LOG(LogHktSpriteGenerator, Log, TEXT("비디오 프레임 추출 완료: %d frames → %s"), FrameCount, *OutputDir);
	return MakeResult(true, {
		{ TEXT("outputDir"),  OutputDir },
		{ TEXT("frameCount"), FString::FromInt(FrameCount) },
	});
}

// ============================================================================
// EditorExtractAtlasAndBundle — VideoPanel 전용 진입점
//   동영상 → 프레임 폴더(TextureBundle) + 패킹 Atlas PNG 까지만 만들고 종료.
//   DataAsset 빌드는 SpriteBuilder 가 같은 CharacterTag/AnimTag 로 호출 시 수행.
// ============================================================================

FString UHktSpriteGeneratorFunctionLibrary::EditorExtractAtlasAndBundle(
	const FString& CharacterTagStr,
	const FString& AnimTagStr,
	const FString& VideoPath,
	int32 FrameWidth, int32 FrameHeight, float FrameRate,
	int32 MaxFrames, float StartTimeSec, float EndTimeSec,
	const FString& OutputDir)
{
	using namespace HktSpriteGen;

	if (CharacterTagStr.IsEmpty()) return MakeSpriteError(TEXT("CharacterTag 필수"));
	if (AnimTagStr.IsEmpty())      return MakeSpriteError(TEXT("AnimTag 필수"));
	if (VideoPath.IsEmpty())       return MakeSpriteError(TEXT("VideoPath 필수"));
	if (!FPaths::FileExists(VideoPath))
	{
		return MakeSpriteError(FString::Printf(TEXT("동영상 파일 없음: %s"), *VideoPath));
	}

	const FString SafeAnim = SanitizeForAssetName(AnimTagStr);

	// OutputDir 가 지정되면 그 아래에 동일 규칙 적용 — 사용자가 임의 경로 지정 시에도
	// SpriteBuilder 의 SourcePath 자동 해석 규칙(파일명 패턴)이 그대로 동작.
	const FString ResolvedRoot = OutputDir.IsEmpty()
		? ConventionBundleRoot(CharacterTagStr)
		: OutputDir;
	const FString BundleDir = ResolvedRoot / SafeAnim;
	const FString AtlasPng  = ResolvedRoot / (SafeAnim + TEXT("_atlas.png"));

	IFileManager& FM = IFileManager::Get();
	// 이전 산출물 정리 — 다른 길이의 동영상으로 재실행 시 stale 프레임이 남지 않도록.
	FM.DeleteDirectory(*BundleDir, /*RequireExists*/ false, /*Tree*/ true);
	FM.MakeDirectory(*BundleDir, /*Tree*/ true);
	if (FPaths::FileExists(AtlasPng)) FM.Delete(*AtlasPng);
	FM.MakeDirectory(*ResolvedRoot, /*Tree*/ true);

	int32 FrameCount = 0;
	FString Err;
	if (!ExtractVideoFramesImpl(VideoPath, BundleDir,
		FrameWidth, FrameHeight, FrameRate, MaxFrames,
		StartTimeSec, EndTimeSec, FrameCount, Err))
	{
		return MakeSpriteError(Err);
	}

	// 추출 결과를 단일 방향 N프레임으로 라벨링한 뒤 PackAtlas 로 전달.
	TArray<FFrameEntry> Frames;
	TArray<FString> Files;
	FM.FindFiles(Files, *(BundleDir / TEXT("frame_*.png")), /*Files*/ true, /*Dirs*/ false);
	Files.Sort();
	for (int32 i = 0; i < Files.Num(); ++i)
	{
		FFrameEntry E;
		E.Action       = TEXT("anim");
		E.DirectionIdx = 0;
		E.FrameIdx     = i;
		E.FilePath     = BundleDir / Files[i];
		Frames.Add(MoveTemp(E));
	}
	if (Frames.IsEmpty())
	{
		return MakeSpriteError(TEXT("추출된 프레임 없음"));
	}

	int32 CellW = 0, CellH = 0, Cols = 0, Rows = 0;
	TMap<TTuple<FString,int32,int32>, int32> IndexMap;
	FString PackErr;
	if (!PackAtlas(Frames, AtlasPng, CellW, CellH, Cols, Rows, IndexMap, PackErr))
	{
		return MakeSpriteError(PackErr);
	}

	UE_LOG(LogHktSpriteGenerator, Log,
		TEXT("ExtractAtlasAndBundle: Char=%s Anim=%s Frames=%d Cell=%dx%d Bundle=%s Atlas=%s"),
		*CharacterTagStr, *AnimTagStr, Frames.Num(), CellW, CellH, *BundleDir, *AtlasPng);

	return MakeResult(true, {
		{ TEXT("characterTag"), CharacterTagStr },
		{ TEXT("animTag"),      AnimTagStr },
		{ TEXT("bundleDir"),    BundleDir },
		{ TEXT("atlasPath"),    AtlasPng },
		{ TEXT("frameCount"),   FString::FromInt(Frames.Num()) },
		{ TEXT("cellW"),        FString::FromInt(CellW) },
		{ TEXT("cellH"),        FString::FromInt(CellH) },
	});
}

// ============================================================================
// Convention 경로 헬퍼 — Public API 노출용 wrapper.
// ============================================================================

FString UHktSpriteGeneratorFunctionLibrary::GetConventionBundleRoot(const FString& CharacterTagStr)
{
	return HktSpriteGen::ConventionBundleRoot(CharacterTagStr);
}

FString UHktSpriteGeneratorFunctionLibrary::GetConventionBundleDir(
	const FString& CharacterTagStr, const FString& AnimTagStr)
{
	return HktSpriteGen::ConventionBundleDir(CharacterTagStr, AnimTagStr);
}

FString UHktSpriteGeneratorFunctionLibrary::GetConventionAtlasPng(
	const FString& CharacterTagStr, const FString& AnimTagStr)
{
	return HktSpriteGen::ConventionAtlasPng(CharacterTagStr, AnimTagStr);
}

FString UHktSpriteGeneratorFunctionLibrary::GetConventionDirectionalBundleDir(
	const FString& CharacterTagStr, const FString& AnimTagStr, int32 DirectionIdx)
{
	return HktSpriteGen::ConventionDirBundleDir(CharacterTagStr, AnimTagStr, DirectionIdx);
}

FString UHktSpriteGeneratorFunctionLibrary::GetConventionDirectionalAtlasPng(
	const FString& CharacterTagStr, const FString& AnimTagStr, int32 DirectionIdx)
{
	return HktSpriteGen::ConventionDirAtlasPng(CharacterTagStr, AnimTagStr, DirectionIdx);
}

FString UHktSpriteGeneratorFunctionLibrary::GetConventionDirectionalAtlasAssetPath(
	const FString& CharacterTagStr, const FString& AnimTagStr, int32 DirectionIdx, const FString& OutputDir)
{
	const FString Pkg = HktSpriteGen::ConventionDirAtlasPackagePath(
		CharacterTagStr, AnimTagStr, DirectionIdx, OutputDir);
	const FString Name = HktSpriteGen::ConventionDirAtlasAssetName(
		CharacterTagStr, AnimTagStr, DirectionIdx);
	return FString::Printf(TEXT("%s.%s"), *Pkg, *Name);
}

// ============================================================================
// EditorExtractVideoBundle — Stage 1: 단일 방향 TextureBundle 만 추출 (atlas 생성 X)
// ============================================================================

FString UHktSpriteGeneratorFunctionLibrary::EditorExtractVideoBundle(
	const FString& CharacterTagStr,
	const FString& AnimTagStr,
	int32 DirectionIdx,
	const FString& VideoPath,
	int32 FrameWidth, int32 FrameHeight, float FrameRate,
	int32 MaxFrames, float StartTimeSec, float EndTimeSec)
{
	using namespace HktSpriteGen;

	if (CharacterTagStr.IsEmpty()) return MakeSpriteError(TEXT("CharacterTag 필수"));
	if (AnimTagStr.IsEmpty())      return MakeSpriteError(TEXT("AnimTag 필수"));
	if (VideoPath.IsEmpty())       return MakeSpriteError(TEXT("VideoPath 필수"));
	if (DirectionIdx < 0 || DirectionIdx > 7)
	{
		return MakeSpriteError(FString::Printf(TEXT("DirectionIdx 범위 초과: %d (0..7)"), DirectionIdx));
	}
	if (!FPaths::FileExists(VideoPath))
	{
		return MakeSpriteError(FString::Printf(TEXT("동영상 파일 없음: %s"), *VideoPath));
	}

	// 항상 컨벤션 Workspace 사용 — Stage 2/3 가 같은 루트를 본다.
	const FString DirBundle = ConventionDirBundleDir(CharacterTagStr, AnimTagStr, DirectionIdx);

	IFileManager& FM = IFileManager::Get();
	// 같은 방향 재추출 시 잔여 frame_*.png 제거 — 길이가 다른 영상으로 덮어써도 stale 잔존 방지.
	FM.DeleteDirectory(*DirBundle, /*RequireExists*/ false, /*Tree*/ true);
	FM.MakeDirectory(*DirBundle, /*Tree*/ true);

	int32 FrameCount = 0;
	FString Err;
	if (!ExtractVideoFramesImpl(VideoPath, DirBundle,
		FrameWidth, FrameHeight, FrameRate, MaxFrames,
		StartTimeSec, EndTimeSec, FrameCount, Err))
	{
		return MakeSpriteError(Err);
	}

	UE_LOG(LogHktSpriteGenerator, Log,
		TEXT("ExtractVideoBundle: Char=%s Anim=%s Dir=%s Frames=%d → %s"),
		*CharacterTagStr, *AnimTagStr, kDirNamesNS[DirectionIdx], FrameCount, *DirBundle);

	return MakeResult(true, {
		{ TEXT("characterTag"), CharacterTagStr },
		{ TEXT("animTag"),      AnimTagStr },
		{ TEXT("direction"),    kDirNamesNS[DirectionIdx] },
		{ TEXT("bundleDir"),    DirBundle },
		{ TEXT("frameCount"),   FString::FromInt(FrameCount) },
	});
}

// ============================================================================
// EditorPackDirectionalAtlases — Stage 2: bundle 들 → 방향별 Atlas 패킹 + UE 임포트
// ============================================================================

FString UHktSpriteGeneratorFunctionLibrary::EditorPackDirectionalAtlases(
	const FString& CharacterTagStr,
	const FString& AnimTagFilter)
{
	using namespace HktSpriteGen;

	if (CharacterTagStr.IsEmpty()) return MakeSpriteError(TEXT("CharacterTag 필수"));

	const FString Root = ConventionBundleRoot(CharacterTagStr);
	IFileManager& FM = IFileManager::Get();
	if (!FM.DirectoryExists(*Root))
	{
		return MakeSpriteError(FString::Printf(TEXT("Bundle 루트 없음: %s — Stage 1 (Video Extract) 먼저 실행"), *Root));
	}

	// Anim 디렉터리 후보 수집. AnimTagFilter 가 있으면 그 하나만.
	TArray<FString> AnimDirs;
	if (!AnimTagFilter.IsEmpty())
	{
		const FString SafeFilter = SanitizeForAssetName(AnimTagFilter);
		const FString Candidate  = Root / SafeFilter;
		if (FM.DirectoryExists(*Candidate)) AnimDirs.Add(SafeFilter);
	}
	else
	{
		FM.IterateDirectory(*Root, [&AnimDirs](const TCHAR* Path, bool bIsDir) -> bool
		{
			if (bIsDir)
			{
				AnimDirs.Add(FPaths::GetCleanFilename(Path));
			}
			return true;
		});
	}

	// 결과 누적.
	TArray<TSharedPtr<FJsonValue>> Items;
	int32 OkCount = 0;
	FString FirstError;

	for (const FString& AnimSafe : AnimDirs)
	{
		// SafeAnim → 원래 AnimTag 로 복원 ('_'→'.').
		const FString AnimTagStr = AnimSafe.Replace(TEXT("_"), TEXT("."));
		const FString AnimRoot   = Root / AnimSafe;

		// anim 별 메타 사이드카 — 방향별 cellW/H/frameCount 를 기록해 Stage 3 가 추론에 사용.
		TSharedPtr<FJsonObject> Meta = MakeShared<FJsonObject>();
		Meta->SetStringField(TEXT("characterTag"), CharacterTagStr);
		Meta->SetStringField(TEXT("animTag"),      AnimTagStr);
		TArray<TSharedPtr<FJsonValue>> MetaDirs;

		for (int32 d = 0; d < 8; ++d)
		{
			const FString DirBundle = AnimRoot / kDirNamesNS[d];
			if (!FM.DirectoryExists(*DirBundle)) continue;

			TArray<FString> Files;
			FM.FindFiles(Files, *(DirBundle / TEXT("frame_*.png")), /*Files*/ true, /*Dirs*/ false);
			if (Files.IsEmpty()) continue;
			Files.Sort();

			TArray<FFrameEntry> Frames;
			Frames.Reserve(Files.Num());
			for (int32 i = 0; i < Files.Num(); ++i)
			{
				FFrameEntry E;
				E.Action       = TEXT("anim");
				E.DirectionIdx = 0;
				E.FrameIdx     = i;
				E.FilePath     = DirBundle / Files[i];
				Frames.Add(MoveTemp(E));
			}

			const FString AtlasPng = ConventionDirAtlasPng(CharacterTagStr, AnimTagStr, d);
			IFileManager::Get().MakeDirectory(*FPaths::GetPath(AtlasPng), true);
			if (FPaths::FileExists(AtlasPng)) FM.Delete(*AtlasPng);

			int32 CellW = 0, CellH = 0, Cols = 0, Rows = 0;
			TMap<TTuple<FString,int32,int32>, int32> IndexMap;
			FString PackErr;
			if (!PackAtlas(Frames, AtlasPng, CellW, CellH, Cols, Rows, IndexMap, PackErr))
			{
				if (FirstError.IsEmpty()) FirstError = PackErr;
				UE_LOG(LogHktSpriteGenerator, Warning, TEXT("PackAtlas 실패 (%s, %s): %s"),
					*AnimTagStr, kDirNamesNS[d], *PackErr);
				continue;
			}

			TSharedPtr<FJsonObject> MetaDir = MakeShared<FJsonObject>();
			MetaDir->SetStringField(TEXT("dir"),        kDirNamesNS[d]);
			MetaDir->SetNumberField(TEXT("cellW"),      CellW);
			MetaDir->SetNumberField(TEXT("cellH"),      CellH);
			MetaDir->SetNumberField(TEXT("frameCount"), Frames.Num());
			MetaDirs.Add(MakeShared<FJsonValueObject>(MetaDir));

			TSharedPtr<FJsonObject> Item = MakeShared<FJsonObject>();
			Item->SetStringField(TEXT("animTag"),    AnimTagStr);
			Item->SetStringField(TEXT("direction"),  kDirNamesNS[d]);
			Item->SetStringField(TEXT("atlasPng"),   AtlasPng);
			Item->SetNumberField(TEXT("cellW"),      CellW);
			Item->SetNumberField(TEXT("cellH"),      CellH);
			Item->SetNumberField(TEXT("frameCount"), Frames.Num());
			Items.Add(MakeShared<FJsonValueObject>(Item));
			++OkCount;

			UE_LOG(LogHktSpriteGenerator, Log,
				TEXT("PackDirectionalAtlas: Anim=%s Dir=%s Frames=%d Cell=%dx%d → %s"),
				*AnimTagStr, kDirNamesNS[d], Frames.Num(), CellW, CellH, *AtlasPng);
		}

		// 사이드카 저장 — 빈 anim 은 스킵.
		if (MetaDirs.Num() > 0)
		{
			Meta->SetArrayField(TEXT("directions"), MetaDirs);
			FString MetaJson;
			TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&MetaJson);
			FJsonSerializer::Serialize(Meta.ToSharedRef(), W);
			const FString MetaPath = AnimRoot / TEXT("atlas_meta.json");
			FFileHelper::SaveStringToFile(MetaJson, *MetaPath);
		}
	}

	// 결과 JSON.
	TSharedPtr<FJsonObject> Root2 = MakeShared<FJsonObject>();
	Root2->SetBoolField(TEXT("success"),  OkCount > 0);
	Root2->SetNumberField(TEXT("count"),  OkCount);
	Root2->SetArrayField(TEXT("items"),   Items);
	if (OkCount == 0 && !FirstError.IsEmpty())
	{
		Root2->SetStringField(TEXT("error"), FirstError);
	}
	else if (OkCount == 0)
	{
		Root2->SetStringField(TEXT("error"), TEXT("패킹 대상 bundle 이 발견되지 않음"));
	}

	FString Out;
	const TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&Out);
	FJsonSerializer::Serialize(Root2.ToSharedRef(), W);
	return Out;
}

// ============================================================================
// EditorPackBundleFolderToAtlasPng — 단일 폴더 → 1 row strip atlas PNG (UE 임포트 X)
// ============================================================================

FString UHktSpriteGeneratorFunctionLibrary::EditorPackBundleFolderToAtlasPng(
	const FString& InputDir,
	const FString& OutputPngPath)
{
	using namespace HktSpriteGen;

	if (InputDir.IsEmpty())     return MakeSpriteError(TEXT("InputDir 필수"));
	if (OutputPngPath.IsEmpty()) return MakeSpriteError(TEXT("OutputPngPath 필수"));

	IFileManager& FM = IFileManager::Get();
	if (!FM.DirectoryExists(*InputDir))
	{
		return MakeSpriteError(FString::Printf(TEXT("InputDir 없음: %s"), *InputDir));
	}

	TArray<FString> Files;
	FM.FindFiles(Files, *(InputDir / TEXT("frame_*.png")), /*Files*/ true, /*Dirs*/ false);
	if (Files.IsEmpty())
	{
		return MakeSpriteError(FString::Printf(TEXT("frame_*.png 없음: %s"), *InputDir));
	}
	Files.Sort();

	TArray<FFrameEntry> Frames;
	Frames.Reserve(Files.Num());
	for (int32 i = 0; i < Files.Num(); ++i)
	{
		FFrameEntry E;
		E.Action       = TEXT("anim");
		E.DirectionIdx = 0;
		E.FrameIdx     = i;
		E.FilePath     = InputDir / Files[i];
		Frames.Add(MoveTemp(E));
	}

	FM.MakeDirectory(*FPaths::GetPath(OutputPngPath), /*Tree*/ true);
	if (FPaths::FileExists(OutputPngPath)) FM.Delete(*OutputPngPath);

	int32 CellW = 0, CellH = 0, Cols = 0, Rows = 0;
	TMap<TTuple<FString,int32,int32>, int32> IndexMap;
	FString PackErr;
	if (!PackAtlas(Frames, OutputPngPath, CellW, CellH, Cols, Rows, IndexMap, PackErr))
	{
		return MakeSpriteError(PackErr);
	}

	UE_LOG(LogHktSpriteGenerator, Log,
		TEXT("PackBundleFolderToAtlasPng: Frames=%d Cell=%dx%d → %s"),
		Frames.Num(), CellW, CellH, *OutputPngPath);

	return MakeResult(true, {
		{ TEXT("atlasPath"),  OutputPngPath },
		{ TEXT("frameCount"), FString::FromInt(Frames.Num()) },
		{ TEXT("cellW"),      FString::FromInt(CellW) },
		{ TEXT("cellH"),      FString::FromInt(CellH) },
	});
}

FString UHktSpriteGeneratorFunctionLibrary::EditorBuildSpriteCharacterFromVideo(
	const FString& CharacterTag, const FString& VideoPath,
	const FString& ActionId,
	int32 FrameWidth, int32 FrameHeight, float FrameRate,
	int32 MaxFrames, float StartTimeSec, float EndTimeSec,
	const FString& OutputDir, float PixelToWorld, float FrameDurationMs,
	bool bLooping, bool bMirrorWestFromEast)
{
	using namespace HktSpriteGen;

	if (CharacterTag.IsEmpty() || VideoPath.IsEmpty())
	{
		return MakeSpriteError(TEXT("CharacterTag / VideoPath 필수"));
	}

	const FString SafeTag      = SanitizeForAssetName(CharacterTag);
	const FString ActionLower  = ActionId.IsEmpty() ? TEXT("idle") : ActionId.ToLower();
	const FString WorkRoot     = FPaths::ProjectSavedDir() / TEXT("SpriteGenerator") / TEXT("VideoFrames") / SafeTag;
	const FString FramesDir    = WorkRoot / ActionLower;

	IFileManager& FM = IFileManager::Get();
	FM.DeleteDirectory(*FramesDir, /*RequireExists*/ false, /*Tree*/ true);
	FM.MakeDirectory(*FramesDir, /*Tree*/ true);

	int32 FrameCount = 0;
	FString Err;
	if (!ExtractVideoFramesImpl(VideoPath, FramesDir,
		FrameWidth, FrameHeight, FrameRate, MaxFrames,
		StartTimeSec, EndTimeSec, FrameCount, Err))
	{
		return MakeSpriteError(Err);
	}

	UE_LOG(LogHktSpriteGenerator, Log, TEXT("비디오 → 아틀라스: Tag=%s Action=%s Frames=%d Video=%s"),
		*CharacterTag, *ActionLower, FrameCount, *VideoPath);

	return EditorBuildSpriteCharacterFromDirectory(
		CharacterTag, WorkRoot, OutputDir,
		PixelToWorld, FrameDurationMs, bLooping, bMirrorWestFromEast);
}

// ============================================================================
// EditorBuildSpriteCharacterFromAtlas — 가장 간단한 경로
//   아틀라스는 "행=방향, 열=프레임" 그리드로 이미 패킹돼 있다고 가정.
// ============================================================================

FString UHktSpriteGeneratorFunctionLibrary::EditorBuildSpriteCharacterFromAtlas(
	const FString& CharacterTag, const FString& AtlasAssetPath,
	int32 FrameWidth, int32 FrameHeight,
	const FString& AnimTagStr, const FString& OutputDir,
	float PixelToWorld, float FrameDurationMs,
	bool bLooping, bool bMirrorWestFromEast)
{
	using namespace HktSpriteGen;

	if (CharacterTag.IsEmpty())
	{
		return MakeSpriteError(TEXT("CharacterTag 필수"));
	}
	if (AtlasAssetPath.IsEmpty())
	{
		return MakeSpriteError(TEXT("AtlasAssetPath가 비어있습니다"));
	}
	UTexture2D* Atlas = LoadObject<UTexture2D>(nullptr, *AtlasAssetPath);
	if (!Atlas)
	{
		return MakeSpriteError(FString::Printf(
			TEXT("Atlas 텍스처 로드 실패: %s"), *AtlasAssetPath));
	}
	if (FrameWidth <= 0 || FrameHeight <= 0)
	{
		return MakeSpriteError(TEXT("FrameWidth / FrameHeight는 양수여야 합니다"));
	}

	const int32 AtlasW = Atlas->GetSizeX();
	const int32 AtlasH = Atlas->GetSizeY();
	if (AtlasW < FrameWidth || AtlasH < FrameHeight)
	{
		return MakeSpriteError(FString::Printf(
			TEXT("아틀라스(%dx%d)가 프레임 크기(%dx%d)보다 작습니다"),
			AtlasW, AtlasH, FrameWidth, FrameHeight));
	}

	const int32 Cols = AtlasW / FrameWidth;
	const int32 Rows = AtlasH / FrameHeight;

	int32 NumDir = 1;
	if      (Rows >= 8) NumDir = 8;
	else if (Rows >= 5) NumDir = 5;
	else if (Rows >= 1) NumDir = 1;

	const FString SafeTag        = SanitizeForAssetName(CharacterTag);
	const FString TemplateName   = FString::Printf(TEXT("DA_SpriteCharacter_%s"), *SafeTag);
	const FString TemplatePackage= FString::Printf(TEXT("%s/%s"), *OutputDir, *TemplateName);

	UPackage* TmplPkg = CreatePackage(*TemplatePackage);
	if (!TmplPkg) return MakeSpriteError(TEXT("DataAsset 패키지 생성 실패"));
	TmplPkg->FullyLoad();

	UHktSpriteCharacterTemplate* Tmpl = NewObject<UHktSpriteCharacterTemplate>(
		TmplPkg, FName(*TemplateName), RF_Public | RF_Standalone);
	if (!Tmpl) return MakeSpriteError(TEXT("UHktSpriteCharacterTemplate 생성 실패"));

	Tmpl->IdentifierTag = EnsureTag(CharacterTag);
	Tmpl->Atlas         = Atlas;
	Tmpl->AtlasCellSize = FVector2f(static_cast<float>(FrameWidth), static_cast<float>(FrameHeight));
	Tmpl->PixelToWorld  = PixelToWorld;

	const FString ResolvedAnimTag = AnimTagStr.IsEmpty()
		? TEXT("Anim.FullBody.Locomotion.Idle")
		: AnimTagStr;

	FHktSpriteAnimation Anim;
	Anim.NumDirections       = NumDir;
	Anim.FramesPerDirection  = FMath::Max(Cols, 1);
	Anim.PivotOffset         = FVector2f(FrameWidth * 0.5f, static_cast<float>(FrameHeight));
	Anim.FrameDurationMs     = FrameDurationMs;
	Anim.bLooping            = bLooping;
	Anim.bMirrorWestFromEast = bMirrorWestFromEast;

	// 프레임은 그리드 규약(AtlasIndex=frameIdx)으로 합성 — 별도 배열 없음.

	const FGameplayTag AnimTag = EnsureTag(ResolvedAnimTag);
	Tmpl->Animations.Add(AnimTag, MoveTemp(Anim));
	Tmpl->DefaultAnimTag = AnimTag;

	Tmpl->MarkPackageDirty();
	const FString TmplFile = FPackageName::LongPackageNameToFilename(TemplatePackage, FPackageName::GetAssetPackageExtension());
	FSavePackageArgs SaveArgs;
	SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
	if (!UPackage::SavePackage(TmplPkg, Tmpl, *TmplFile, SaveArgs))
	{
		return MakeSpriteError(TEXT("DataAsset 패키지 저장 실패"));
	}
	FAssetRegistryModule::AssetCreated(Tmpl);

	UE_LOG(LogHktSpriteGenerator, Log, TEXT("AtlasGrid CharacterTemplate: Tag=%s Atlas=%dx%d Cell=%dx%d Cols=%d Rows=%d → NumDir=%d AnimTag=%s"),
		*CharacterTag, AtlasW, AtlasH, FrameWidth, FrameHeight, Cols, Rows, NumDir, *AnimTag.ToString());

	return MakeResult(true, {
		{ TEXT("tag"),           CharacterTag },
		{ TEXT("dataAssetPath"), FString::Printf(TEXT("%s.%s"), *TemplatePackage, *TemplateName) },
		{ TEXT("atlasCols"),     FString::FromInt(Cols) },
		{ TEXT("atlasRows"),     FString::FromInt(Rows) },
		{ TEXT("numDirections"), FString::FromInt(NumDir) },
	});
}

// ============================================================================
// BuildSpriteAnim — 단일 진입점
// ============================================================================

namespace HktSpriteGen
{
	static const FString kDefaultOutputDir = TEXT("/Game/Generated/Sprites");

	/** AnimTag 이름에서 bLooping 자동 추론. */
	static bool InferLooping(const FString& AnimTagStr)
	{
		// Montage/Death/Hit/Attack 등 원샷 계열 키워드는 비루프.
		static const TCHAR* const kOneShotHints[] = {
			TEXT("Montage"), TEXT("Death"), TEXT("Hit"),
			TEXT("Attack"),  TEXT("Cast"),  TEXT("Dodge"),
		};
		for (const TCHAR* H : kOneShotHints)
		{
			if (AnimTagStr.Contains(H, ESearchCase::CaseSensitive)) return false;
		}
		return true;
	}

	/** 기존 UHktSpriteCharacterTemplate 로드 또는 새로 생성. */
	static UHktSpriteCharacterTemplate* UpsertTemplate(
		const FString& TemplatePackage, const FString& TemplateName,
		const FString& CharTagStr, UPackage*& OutPkg)
	{
		OutPkg = FindPackage(nullptr, *TemplatePackage);
		if (OutPkg)
		{
			UHktSpriteCharacterTemplate* Existing = Cast<UHktSpriteCharacterTemplate>(
				StaticFindObject(UHktSpriteCharacterTemplate::StaticClass(), OutPkg, *TemplateName));
			if (Existing) return Existing;
		}

		const FString AssetObjPath = FString::Printf(TEXT("%s.%s"), *TemplatePackage, *TemplateName);
		if (UHktSpriteCharacterTemplate* Loaded = LoadObject<UHktSpriteCharacterTemplate>(nullptr, *AssetObjPath))
		{
			OutPkg = Loaded->GetPackage();
			return Loaded;
		}

		OutPkg = CreatePackage(*TemplatePackage);
		if (!OutPkg) return nullptr;
		OutPkg->FullyLoad();

		UHktSpriteCharacterTemplate* Tmpl = NewObject<UHktSpriteCharacterTemplate>(
			OutPkg, FName(*TemplateName), RF_Public | RF_Standalone);
		if (Tmpl)
		{
			Tmpl->IdentifierTag = EnsureTag(CharTagStr);
		}
		return Tmpl;
	}

	/** DataAsset 저장 + AssetRegistry 등록. */
	static bool SaveTemplate(UHktSpriteCharacterTemplate* Tmpl, UPackage* Pkg,
	                         const FString& TemplatePackage, FString& OutError)
	{
		Tmpl->MarkPackageDirty();
		const FString TmplFile = FPackageName::LongPackageNameToFilename(
			TemplatePackage, FPackageName::GetAssetPackageExtension());
		FSavePackageArgs SaveArgs;
		SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
		if (!UPackage::SavePackage(Pkg, Tmpl, *TmplFile, SaveArgs))
		{
			OutError = TEXT("DataAsset 패키지 저장 실패");
			return false;
		}
		FAssetRegistryModule::AssetCreated(Tmpl);
		return true;
	}

} // namespace HktSpriteGen

FString UHktSpriteGeneratorFunctionLibrary::BuildSpriteAnim(
	const FString& CharacterTagStr,
	const FString& AnimTagStr,
	int32 CellWidth,
	int32 CellHeight,
	float PixelToWorld)
{
	using namespace HktSpriteGen;

	if (CharacterTagStr.IsEmpty()) return MakeSpriteError(TEXT("CharacterTagStr 필수"));
	if (AnimTagStr.IsEmpty())      return MakeSpriteError(TEXT("AnimTagStr 필수"));

	const bool         bLoop    = InferLooping(AnimTagStr);
	const FGameplayTag AnimTag  = EnsureTag(AnimTagStr);
	const FGameplayTag CharTag  = EnsureTag(CharacterTagStr);

	const FString SafeCharTag      = SanitizeForAssetName(CharacterTagStr);
	const FString TemplateName     = FString::Printf(TEXT("DA_SpriteCharacter_%s"), *SafeCharTag);
	const FString TemplatePackage  = FString::Printf(TEXT("%s/%s"), *kDefaultOutputDir, *TemplateName);

	// Stage 2 가 남긴 atlas_meta.json 사이드카 — 셀 크기/프레임 수 폴백.
	const FString MetaPath = ConventionBundleDir(CharacterTagStr, AnimTagStr) / TEXT("atlas_meta.json");
	TMap<int32, TPair<int32,int32>> MetaCellByDir;
	TMap<int32, int32>              MetaFramesByDir;
	if (FPaths::FileExists(MetaPath))
	{
		FString MetaJson;
		if (FFileHelper::LoadFileToString(MetaJson, *MetaPath))
		{
			TSharedPtr<FJsonObject> MetaObj;
			TSharedRef<TJsonReader<>> R = TJsonReaderFactory<>::Create(MetaJson);
			if (FJsonSerializer::Deserialize(R, MetaObj) && MetaObj.IsValid())
			{
				const TArray<TSharedPtr<FJsonValue>>* Dirs = nullptr;
				if (MetaObj->TryGetArrayField(TEXT("directions"), Dirs))
				{
					for (const TSharedPtr<FJsonValue>& V : *Dirs)
					{
						const TSharedPtr<FJsonObject>& O = V->AsObject();
						if (!O.IsValid()) continue;
						const FString DirName = O->GetStringField(TEXT("dir"));
						int32 d = -1;
						for (int32 i = 0; i < 8; ++i) if (DirName == kDirNamesNS[i]) { d = i; break; }
						if (d < 0) continue;
						const int32 CW = O->GetIntegerField(TEXT("cellW"));
						const int32 CH = O->GetIntegerField(TEXT("cellH"));
						const int32 FC = O->GetIntegerField(TEXT("frameCount"));
						MetaCellByDir.Add(d, TPair<int32,int32>(CW, CH));
						MetaFramesByDir.Add(d, FC);
					}
				}
			}
		}
	}

	struct FSlotEntry { int32 DirIdx; UTexture2D* Tex; int32 CellW; int32 CellH; int32 FrameCount; };
	TArray<FSlotEntry> Slots;

	for (int32 d = 0; d < 8; ++d)
	{
		const FString AssetName = ConventionDirAtlasAssetName(CharacterTagStr, AnimTagStr, d);
		const FString PkgPath   = ConventionDirAtlasPackagePath(CharacterTagStr, AnimTagStr, d, kDefaultOutputDir);
		const FString ObjPath   = FString::Printf(TEXT("%s.%s"), *PkgPath, *AssetName);

		UTexture2D* Tex = LoadObject<UTexture2D>(nullptr, *ObjPath);
		if (!Tex)
		{
			// Workspace 의 atlas_{Dir}.png 를 즉석 임포트 (Stage 2 산출).
			const FString PngPath = ConventionDirAtlasPng(CharacterTagStr, AnimTagStr, d);
			if (!FPaths::FileExists(PngPath)) continue;
			Tex = ImportAtlasTexture(PngPath, PkgPath, AssetName);
			if (!Tex)
			{
				UE_LOG(LogHktSpriteGenerator, Warning, TEXT("DirectionalAtlas: PNG 임포트 실패 (%s)"), *PngPath);
				continue;
			}
		}

		const int32 AtlasW = Tex->GetSizeX();
		const int32 AtlasH = Tex->GetSizeY();

		// 셀 크기 우선순위: 사용자 입력 > meta sidecar > atlas 종횡비 폴백.
		int32 UseW = CellWidth;
		int32 UseH = CellHeight;
		if (UseW <= 0 || UseH <= 0)
		{
			if (const TPair<int32,int32>* M = MetaCellByDir.Find(d))
			{
				if (UseW <= 0) UseW = M->Key;
				if (UseH <= 0) UseH = M->Value;
			}
		}
		if (UseH <= 0) UseH = AtlasH;
		if (UseW <= 0)
		{
			int32 Frames = 0;
			if (const int32* MF = MetaFramesByDir.Find(d)) Frames = *MF;
			if (Frames <= 0 && AtlasH > 0) Frames = FMath::Max(1, AtlasW / AtlasH);
			UseW = (Frames > 0) ? FMath::Max(1, AtlasW / Frames) : AtlasW;
		}
		if (UseW <= 0 || UseH <= 0)
		{
			return MakeSpriteError(FString::Printf(TEXT("DirectionalAtlas 셀 크기 추론 실패 (Dir=%s, Atlas=%dx%d)"),
				kDirNamesNS[d], AtlasW, AtlasH));
		}

		FSlotEntry S;
		S.DirIdx = d;
		S.Tex = Tex;
		S.CellW = UseW;
		S.CellH = UseH;
		S.FrameCount = FMath::Max(1, AtlasW / UseW);
		Slots.Add(S);
	}

	if (Slots.IsEmpty())
	{
		return MakeSpriteError(FString::Printf(
			TEXT("DirectionalAtlas: Workspace 에 atlas_{Dir}.png 가 없음 (char=%s, anim=%s) — Stage 2 (Atlas Pack) 먼저 실행"),
			*CharacterTagStr, *AnimTagStr));
	}

	int32 NumDirLocal;
	if (Slots.Num() == 1)
	{
		NumDirLocal = 1;
	}
	else if (Slots.Num() <= 5
		&& Slots.ContainsByPredicate([](const FSlotEntry& S){ return S.DirIdx == 0; })
		&& Slots.ContainsByPredicate([](const FSlotEntry& S){ return S.DirIdx == 1; })
		&& Slots.ContainsByPredicate([](const FSlotEntry& S){ return S.DirIdx == 2; })
		&& Slots.ContainsByPredicate([](const FSlotEntry& S){ return S.DirIdx == 3; })
		&& Slots.ContainsByPredicate([](const FSlotEntry& S){ return S.DirIdx == 4; }))
	{
		NumDirLocal = 5;
	}
	else
	{
		NumDirLocal = 8;
	}

	int32 FPDLocal = 0;
	for (const FSlotEntry& S : Slots) FPDLocal = FMath::Max(FPDLocal, S.FrameCount);
	if (FPDLocal <= 0) FPDLocal = 1;

	const int32 SlotCellW = Slots[0].CellW;
	const int32 SlotCellH = Slots[0].CellH;
	for (const FSlotEntry& S : Slots)
	{
		if (S.CellW != SlotCellW || S.CellH != SlotCellH)
		{
			UE_LOG(LogHktSpriteGenerator, Warning,
				TEXT("DirectionalAtlas: Dir=%s 셀 크기 불일치 (%dx%d vs %dx%d) — 첫 슬롯 값 채택"),
				kDirNamesNS[S.DirIdx], S.CellW, S.CellH, SlotCellW, SlotCellH);
		}
	}

	UPackage* Pkg = nullptr;
	UHktSpriteCharacterTemplate* Tmpl = UpsertTemplate(TemplatePackage, TemplateName, CharacterTagStr, Pkg);
	if (!Tmpl || !Pkg) return MakeSpriteError(TEXT("DataAsset 생성/로드 실패"));
	if (!Tmpl->IdentifierTag.IsValid()) Tmpl->IdentifierTag = CharTag;
	if (Tmpl->PixelToWorld <= 0.f)      Tmpl->PixelToWorld  = PixelToWorld;

	FHktSpriteAnimation Anim;
	Anim.Atlas               = nullptr;
	Anim.AtlasCellSize       = FVector2f(static_cast<float>(SlotCellW), static_cast<float>(SlotCellH));
	Anim.NumDirections       = NumDirLocal;
	Anim.FramesPerDirection  = FPDLocal;
	Anim.PivotOffset         = FVector2f(SlotCellW * 0.5f, static_cast<float>(SlotCellH));
	Anim.FrameDurationMs     = 100.f;
	Anim.bLooping            = bLoop;
	Anim.bMirrorWestFromEast = (NumDirLocal == 5);

	auto FindSlot = [&Slots](int32 DirIdx) -> const FSlotEntry*
	{
		for (const FSlotEntry& S : Slots) if (S.DirIdx == DirIdx) return &S;
		return nullptr;
	};

	Anim.AtlasSlots.SetNum(NumDirLocal);
	auto AssignSlot = [&](int32 StorageIdx, int32 SourceDirIdx)
	{
		const FSlotEntry* S = FindSlot(SourceDirIdx);
		FHktSpriteAtlasSlot Out;
		if (S)
		{
			Out.Atlas    = S->Tex;
			Out.CellSize = FVector2f(static_cast<float>(S->CellW), static_cast<float>(S->CellH));
		}
		Anim.AtlasSlots[StorageIdx] = Out;
	};
	if (NumDirLocal == 1)
	{
		AssignSlot(0, Slots[0].DirIdx);
	}
	else
	{
		for (int32 i = 0; i < NumDirLocal; ++i) AssignSlot(i, i);
	}

	// 프레임은 그리드 규약(AtlasIndex=frameIdx, AtlasSlotIdx=dirIdx)으로 합성 — 별도 배열 없음.

	Tmpl->Animations.Add(AnimTag, MoveTemp(Anim));
	if (!Tmpl->DefaultAnimTag.IsValid()) Tmpl->DefaultAnimTag = AnimTag;

	FString SaveErr;
	if (!SaveTemplate(Tmpl, Pkg, TemplatePackage, SaveErr))
	{
		return MakeSpriteError(SaveErr);
	}

	UE_LOG(LogHktSpriteGenerator, Log,
		TEXT("BuildSpriteAnim: Char=%s Anim=%s Slots=%d NumDir=%d FPD=%d Cell=%dx%d"),
		*CharacterTagStr, *AnimTagStr, Slots.Num(), NumDirLocal, FPDLocal, SlotCellW, SlotCellH);

	return MakeResult(true, {
		{ TEXT("dataAssetPath"),  FString::Printf(TEXT("%s.%s"), *TemplatePackage, *TemplateName) },
		{ TEXT("characterTag"),   CharacterTagStr },
		{ TEXT("animTag"),        AnimTagStr },
		{ TEXT("numSlots"),       FString::FromInt(Slots.Num()) },
		{ TEXT("numDirections"),  FString::FromInt(NumDirLocal) },
		{ TEXT("framesPerDir"),   FString::FromInt(FPDLocal) },
		{ TEXT("cellW"),          FString::FromInt(SlotCellW) },
		{ TEXT("cellH"),          FString::FromInt(SlotCellH) },
	});
}


// ============================================================================
// EditorBuildTerrainAtlasFromBundle — 33프레임 1D strip 테레인 아틀라스
// ============================================================================

namespace HktSpriteGen
{
	/**
	 * HktVoxelTerrainTypes.h::HktTerrainType 의 인덱스 순서와 동기화.
	 * 타입을 추가하면 양쪽 모두 갱신해야 한다 (cross-plugin 의존을 피하기 위한 의도적 복제).
	 */
	static const TCHAR* const kTerrainTypeNames[] = {
		TEXT("Air"),            // 0
		TEXT("Grass"),          // 1
		TEXT("Dirt"),           // 2
		TEXT("Stone"),          // 3
		TEXT("Sand"),           // 4
		TEXT("Water"),          // 5
		TEXT("Snow"),           // 6
		TEXT("Ice"),            // 7
		TEXT("Gravel"),         // 8
		TEXT("Clay"),           // 9
		TEXT("Bedrock"),        // 10
		TEXT("Glass"),          // 11
		TEXT("GrassFlower"),    // 12
		TEXT("StoneMossy"),     // 13
		TEXT("CrystalGrass"),   // 14
		TEXT("GrassEthereal"),  // 15
		TEXT("MossGlow"),       // 16
		TEXT("SoilDark"),       // 17
		TEXT("SandBleached"),   // 18
		TEXT("StoneFractured"), // 19
		TEXT("BoneFragment"),   // 20
		TEXT("CrystalShard"),   // 21
		TEXT("Wood"),           // 22
		TEXT("Leaves"),         // 23
		TEXT("LeavesSnow"),     // 24
		TEXT("Cactus"),         // 25
		TEXT("Mushroom"),       // 26
		TEXT("MushroomGlow"),   // 27
		TEXT("OreCoal"),        // 28
		TEXT("OreIron"),        // 29
		TEXT("OreGold"),        // 30
		TEXT("OreCrystal"),     // 31
		TEXT("OreVoidstone"),   // 32
	};
	static constexpr int32 kTerrainTypeCount = UE_ARRAY_COUNT(kTerrainTypeNames);

	/** InputDir 내에서 stem이 TypeName과 일치하는 첫 이미지 파일을 찾는다 (대소문자 무시). */
	static FString FindFrameFileByStem(const FString& InputDir, const FString& TypeName)
	{
		IFileManager& FM = IFileManager::Get();
		TArray<FString> Files;
		FM.FindFiles(Files, *(InputDir / TEXT("*.*")), /*Files*/ true, /*Dirs*/ false);
		for (const FString& F : Files)
		{
			if (!IsSupportedImageExt(FPaths::GetExtension(F))) continue;
			if (FPaths::GetBaseFilename(F).Equals(TypeName, ESearchCase::IgnoreCase))
			{
				return InputDir / F;
			}
		}
		return FString();
	}
} // namespace HktSpriteGen

FString UHktSpriteGeneratorFunctionLibrary::EditorBuildTerrainAtlasFromBundle(
	const FString& InputDir,
	const FString& OutputAssetPath,
	int32 ForcedFrameSize)
{
	using namespace HktSpriteGen;

	IFileManager& FM = IFileManager::Get();
	if (!FM.DirectoryExists(*InputDir))
	{
		return MakeSpriteError(FString::Printf(TEXT("입력 폴더 없음: %s"), *InputDir));
	}
	if (OutputAssetPath.IsEmpty() || !OutputAssetPath.StartsWith(TEXT("/Game/")))
	{
		return MakeSpriteError(TEXT("OutputAssetPath는 /Game/... 으로 시작해야 합니다"));
	}

	// 1) 타입 이름 → 디스크 파일 매핑 (없는 칸은 빈 문자열).
	TArray<FString> FilePerIndex;
	FilePerIndex.SetNum(kTerrainTypeCount);
	TArray<FString> Missing;
	int32 MaxW = 0, MaxH = 0;
	TMap<int32, FDecodedImage> Decoded;

	for (int32 i = 0; i < kTerrainTypeCount; ++i)
	{
		const FString TypeName = kTerrainTypeNames[i];
		const FString FoundPath = FindFrameFileByStem(InputDir, TypeName);
		if (FoundPath.IsEmpty())
		{
			Missing.Add(TypeName);
			continue;
		}
		FDecodedImage Img;
		if (!DecodeImageFile(FoundPath, Img.BGRA, Img.Width, Img.Height))
		{
			return MakeSpriteError(FString::Printf(TEXT("이미지 디코드 실패: %s"), *FoundPath));
		}
		MaxW = FMath::Max(MaxW, Img.Width);
		MaxH = FMath::Max(MaxH, Img.Height);
		FilePerIndex[i] = FoundPath;
		Decoded.Add(i, MoveTemp(Img));
	}

	if (Decoded.Num() == 0)
	{
		return MakeSpriteError(FString::Printf(
			TEXT("InputDir에서 HktTerrainType과 매칭되는 이미지를 하나도 찾지 못했습니다: %s"), *InputDir));
	}

	// 2) 프레임 크기 결정.
	const int32 FrameSize = (ForcedFrameSize > 0)
		? ForcedFrameSize
		: FMath::Max(MaxW, MaxH);
	if (FrameSize <= 0)
	{
		return MakeSpriteError(TEXT("프레임 크기 결정 실패 (입력 이미지 모두 0 크기)"));
	}

	// 3) 1×33 가로 strip 버퍼 합성 (BGRA, 0=투명으로 zero-init).
	const int32 AtlasW = FrameSize * kTerrainTypeCount;
	const int32 AtlasH = FrameSize;
	TArray64<uint8> AtlasBuf;
	AtlasBuf.SetNumZeroed(static_cast<int64>(AtlasW) * AtlasH * 4);

	for (const TPair<int32, FDecodedImage>& Pair : Decoded)
	{
		const int32 Index = Pair.Key;
		const FDecodedImage& Img = Pair.Value;

		// 셀 좌상단 (정사각 셀에 좌상단 정렬 — pivot은 머티리얼/Sprite Renderer가 처리).
		const int32 DstX0 = Index * FrameSize;
		const int32 DstY0 = 0;
		const int32 CopyW = FMath::Min(Img.Width, FrameSize);
		const int32 CopyH = FMath::Min(Img.Height, FrameSize);

		for (int32 y = 0; y < CopyH; ++y)
		{
			const int64 SrcOff = static_cast<int64>(y) * Img.Width * 4;
			const int64 DstOff = (static_cast<int64>(DstY0 + y) * AtlasW + DstX0) * 4;
			FMemory::Memcpy(AtlasBuf.GetData() + DstOff, Img.BGRA.GetData() + SrcOff, static_cast<SIZE_T>(CopyW) * 4);
		}
	}

	// 4) PNG 임시 파일로 인코드 → 임포트.
	const FString AtlasName = FPaths::GetCleanFilename(OutputAssetPath);
	if (AtlasName.IsEmpty())
	{
		return MakeSpriteError(FString::Printf(TEXT("OutputAssetPath 파싱 실패: %s"), *OutputAssetPath));
	}

	const FString TmpPng = FPaths::ProjectSavedDir() / TEXT("SpriteGenerator") / TEXT("TerrainAtlas")
		/ FString::Printf(TEXT("%s_%lld.png"), *AtlasName, FDateTime::UtcNow().GetTicks());
	FM.MakeDirectory(*FPaths::GetPath(TmpPng), /*Tree*/ true);

	{
		IImageWrapperModule& IWM = FModuleManager::LoadModuleChecked<IImageWrapperModule>(TEXT("ImageWrapper"));
		TSharedPtr<IImageWrapper> Wrapper = IWM.CreateImageWrapper(EImageFormat::PNG);
		if (!Wrapper.IsValid() || !Wrapper->SetRaw(AtlasBuf.GetData(), AtlasBuf.Num(), AtlasW, AtlasH, ERGBFormat::BGRA, 8))
		{
			return MakeSpriteError(TEXT("Atlas PNG 인코드 실패"));
		}
		const TArray64<uint8>& Compressed = Wrapper->GetCompressed();
		if (!FFileHelper::SaveArrayToFile(Compressed, *TmpPng))
		{
			return MakeSpriteError(FString::Printf(TEXT("Atlas PNG 임시 저장 실패: %s"), *TmpPng));
		}
	}

	UTexture2D* AtlasTex = ImportAtlasTexture(TmpPng, OutputAssetPath, AtlasName);
	if (!AtlasTex)
	{
		return MakeSpriteError(TEXT("Atlas 텍스처 임포트 실패"));
	}

	UE_LOG(LogHktSpriteGenerator, Log,
		TEXT("TerrainAtlas: 프레임 %d × %dpx → %s (누락 %d)"),
		kTerrainTypeCount, FrameSize, *OutputAssetPath, Missing.Num());

	// missing 배열은 보고용 — JSON으로 직렬화.
	FString MissingJson;
	{
		TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&MissingJson);
		W->WriteArrayStart();
		for (const FString& Name : Missing) W->WriteValue(Name);
		W->WriteArrayEnd();
		W->Close();
	}

	return MakeResult(true, {
		{ TEXT("atlasAssetPath"), FString::Printf(TEXT("%s.%s"), *OutputAssetPath, *AtlasName) },
		{ TEXT("frameCount"),     FString::FromInt(kTerrainTypeCount) },
		{ TEXT("frameSize"),      FString::FromInt(FrameSize) },
		{ TEXT("missing"),        MissingJson },
	});
}
