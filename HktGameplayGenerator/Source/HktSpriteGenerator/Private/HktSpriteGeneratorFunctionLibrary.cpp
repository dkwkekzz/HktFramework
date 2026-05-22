// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteGeneratorFunctionLibrary.h"
#include "HktHISMSpriteVisualAsset.h"
#include "HktHISMSpriteAnimationDataAsset.h"
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

		// @goal: G-0113
		// 스프라이트 아틀라스 임포트 정책 (G-0113): 본 프로젝트 기준 톤은 일러스트/카툰 — Filter=TF_Bilinear.
		// LODGroup=UI 는 BaseDeviceProfiles.ini의 MaxLODSize 캡(보통 2048~4096)에 걸려
		// 큰 비디오 아틀라스가 강제 다운스케일된다. Pixels2D + MaxTextureSize=0 으로 원본 보존.
		// 픽셀아트 스타일이 필요한 호출자는 자산-단위에서 TF_Nearest 오버라이드.
		Tex->CompressionSettings = TC_EditorIcon;
		Tex->Filter              = TF_Bilinear;
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
	const FString VisualName     = FString::Printf(TEXT("DA_HISMSpriteVisual_%s"), *SafeTag);
	const FString AnimName       = FString::Printf(TEXT("DA_HISMSpriteAnim_%s"), *SafeTag);
	const FString AtlasPackage   = FString::Printf(TEXT("%s/%s"), *OutputDir, *AtlasName);
	const FString VisualPackage  = FString::Printf(TEXT("%s/%s"), *OutputDir, *VisualName);
	const FString AnimPackage    = FString::Printf(TEXT("%s/%s"), *OutputDir, *AnimName);

	// --- 1. Atlas 텍스처 임포트 ---
	UTexture2D* AtlasTex = ImportAtlasTexture(AtlasPng, AtlasPackage, AtlasName);
	if (!AtlasTex)
	{
		return MakeSpriteError(TEXT("Atlas 텍스처 임포트 실패"));
	}

	// --- 2. Animation 자산 생성 (Animations 가 있을 때만) ---
	UHktHISMSpriteAnimationDataAsset* AnimAsset = nullptr;
	UPackage* AnimPkg = nullptr;

	const TArray<TSharedPtr<FJsonValue>>* Animations = nullptr;
	const bool bHasAnimations = Root->TryGetArrayField(TEXT("animations"), Animations)
		&& Animations && Animations->Num() > 0;

	if (bHasAnimations)
	{
		AnimPkg = CreatePackage(*AnimPackage);
		if (!AnimPkg) return MakeSpriteError(TEXT("Animation 패키지 생성 실패"));
		AnimPkg->FullyLoad();

		AnimAsset = NewObject<UHktHISMSpriteAnimationDataAsset>(
			AnimPkg, FName(*AnimName), RF_Public | RF_Standalone);
		if (!AnimAsset) return MakeSpriteError(TEXT("UHktHISMSpriteAnimationDataAsset 생성 실패"));

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

			AnimAsset->Animations.Add(AnimTag, MoveTemp(Anim));
		}

		// --- DefaultAnimTag 설정 ---
		FString DefaultTagStr;
		if (Root->TryGetStringField(TEXT("defaultAnimTag"), DefaultTagStr) && !DefaultTagStr.IsEmpty())
		{
			AnimAsset->DefaultAnimTag = EnsureTag(DefaultTagStr);
		}
		else
		{
			const FGameplayTag IdleTag = EnsureTag(TEXT("Anim.FullBody.Locomotion.Idle"));
			if (AnimAsset->Animations.Contains(IdleTag))
			{
				AnimAsset->DefaultAnimTag = IdleTag;
			}
			else if (AnimAsset->Animations.Num() > 0)
			{
				for (const auto& Pair : AnimAsset->Animations)
				{
					AnimAsset->DefaultAnimTag = Pair.Key;
					break;
				}
			}
		}

		// Animation 패키지 저장.
		AnimAsset->MarkPackageDirty();
		const FString AnimFile = FPackageName::LongPackageNameToFilename(AnimPackage, FPackageName::GetAssetPackageExtension());
		FSavePackageArgs AnimSaveArgs;
		AnimSaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
		if (!UPackage::SavePackage(AnimPkg, AnimAsset, *AnimFile, AnimSaveArgs))
		{
			return MakeSpriteError(TEXT("Animation 패키지 저장 실패"));
		}
		FAssetRegistryModule::AssetCreated(AnimAsset);
	}

	// --- 3. Visual 자산 생성 ---
	UPackage* VisualPkg = CreatePackage(*VisualPackage);
	if (!VisualPkg) return MakeSpriteError(TEXT("Visual 패키지 생성 실패"));
	VisualPkg->FullyLoad();

	UHktHISMSpriteVisualAsset* Visual = NewObject<UHktHISMSpriteVisualAsset>(
		VisualPkg, FName(*VisualName), RF_Public | RF_Standalone);
	if (!Visual) return MakeSpriteError(TEXT("UHktHISMSpriteVisualAsset 생성 실패"));

	Visual->IdentifierTag  = EnsureTag(TagStr);
	Visual->Atlas          = AtlasTex;
	Visual->AtlasCellSize  = FVector2f(static_cast<float>(CellW), static_cast<float>(CellH));
	Visual->PixelToWorld   = static_cast<float>(PixelToWorld);
	Visual->AnimationAsset = AnimAsset;

	// Visual 패키지 저장.
	Visual->MarkPackageDirty();
	const FString VisualFile = FPackageName::LongPackageNameToFilename(VisualPackage, FPackageName::GetAssetPackageExtension());
	FSavePackageArgs VisualSaveArgs;
	VisualSaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
	if (!UPackage::SavePackage(VisualPkg, Visual, *VisualFile, VisualSaveArgs))
	{
		return MakeSpriteError(TEXT("Visual 패키지 저장 실패"));
	}
	FAssetRegistryModule::AssetCreated(Visual);

	const int32 NumAnims = AnimAsset ? AnimAsset->Animations.Num() : 0;
	UE_LOG(LogHktSpriteGenerator, Log, TEXT("HISMSprite 빌드 완료: Tag=%s Atlas=%s Visual=%s Anims=%d"),
		*TagStr, *AtlasPackage, *VisualPackage, NumAnims);

	return MakeResult(true, {
		{ TEXT("tag"),            TagStr },
		{ TEXT("atlasAssetPath"), FString::Printf(TEXT("%s.%s"), *AtlasPackage,    *AtlasName)    },
		{ TEXT("dataAssetPath"),  FString::Printf(TEXT("%s.%s"), *VisualPackage,   *VisualName)   },
		{ TEXT("animAssetPath"),  AnimAsset ? FString::Printf(TEXT("%s.%s"), *AnimPackage, *AnimName) : FString() },
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
					// FrameIdx 는 항상 순차 — 파일명 숫자가 띄엄띄엄(1,2,4 등) 이어도
					// atlas 셀은 빈 칸 없이 발견 순서대로 0,1,2,… 로 채운다.
					AppendImage(DirPath / F, ActionLower, DirIdx, FrameCounter++, OutFrames);
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

	// bSingleRow=true → 단일-방향(N프레임) 패킹용. cols=CellCount(가로 한 줄), rows=1.
	//   가로 8192px 한계만 지킨다. atlas PNG 의 소비자(예: HktPaperAssetBuilder)가
	//   OriginY=0 고정으로 가로 한 줄만 슬라이스하는 경로를 위한 옵션.
	// bSingleRow=false (기본) → 다방향 그리드 패킹용. cols=min(8, CellCount) 캡 적용 →
	//   N개 dir × M frame 레이아웃을 가정하는 BuildSpecJson 등 기존 경로 호환.
	static bool PackAtlas(TArray<FFrameEntry>& Frames, const FString& OutPngPath,
	                      int32& OutCellW, int32& OutCellH, int32& OutCols, int32& OutRows,
	                      TMap<TTuple<FString,int32,int32>, int32>& OutIndexMap, FString& OutError,
	                      bool bSingleRow = false,
	                      int32 InMaxAtlasPixelWidth = 0)
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
		// 1) 기본 cols = bSingleRow ? CellCount : min(kNumDirections, CellCount)
		// 2) Width 캡: cols ≤ 8192 / CellW
		// 3) Height 캡: rows ≤ 8192 / CellH → 필요 시 cols를 늘려 행 수를 줄임
		// 4) 셀 자체가 너무 커 둘 다 못 맞추는 경우 경고 로그 후 진행.
		constexpr int32 kMaxAtlasDim = 8192;
		// 사용자 가로 한계가 지정되면 GPU 한계(8192) 와 함께 둘 중 작은 값을 적용.
		const int32 EffectiveMaxWidth = (InMaxAtlasPixelWidth > 0)
			? FMath::Min(InMaxAtlasPixelWidth, kMaxAtlasDim)
			: kMaxAtlasDim;
		const int32 MaxColsByWidth  = FMath::Max(1, EffectiveMaxWidth / FMath::Max(1, OutCellW));
		const int32 MaxRowsByHeight = FMath::Max(1, kMaxAtlasDim / FMath::Max(1, OutCellH));
		const int32 MinColsByRows   = FMath::DivideAndRoundUp(CellCount, MaxRowsByHeight);

		int32 PreferredCols = bSingleRow ? CellCount : FMath::Min(kNumDirections, CellCount);
		PreferredCols = FMath::Max(PreferredCols, MinColsByRows);
		PreferredCols = FMath::Min(PreferredCols, MaxColsByWidth);
		OutCols = FMath::Max(1, PreferredCols);
		OutRows = FMath::DivideAndRoundUp(CellCount, OutCols);

		// 빈 셀 제거 — CellCount 가 OutCols 의 배수가 아니면 마지막 행에 빈 칸이 생긴다.
		// MaxColsByWidth 이하의 약수 중 가장 큰 값으로 OutCols 를 재선택해 grid 를 빈틈없이 채운다.
		// 약수가 1 뿐이면(=소수) 어쩔 수 없이 1 열 strip 으로 폴백.
		if (OutRows > 1 && (CellCount % OutCols) != 0)
		{
			int32 BestCols = 1;
			const int32 ColCap = FMath::Min(OutCols, MaxColsByWidth);
			for (int32 c = ColCap; c >= 1; --c)
			{
				if ((CellCount % c) == 0) { BestCols = c; break; }
			}
			OutCols = BestCols;
			OutRows = CellCount / OutCols;
		}

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
	if (!PackAtlas(Frames, AtlasPng, CellW, CellH, Cols, Rows, IndexMap, PackErr, /*bSingleRow*/true))
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
	const FString& AnimTagFilter,
	int32 MaxAtlasPixelWidth)
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
			if (!PackAtlas(Frames, AtlasPng, CellW, CellH, Cols, Rows, IndexMap, PackErr,
				/*bSingleRow*/true, MaxAtlasPixelWidth))
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
	const FString& OutputPngPath,
	int32 MaxAtlasPixelWidth)
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
	if (!PackAtlas(Frames, OutputPngPath, CellW, CellH, Cols, Rows, IndexMap, PackErr,
		/*bSingleRow*/true, MaxAtlasPixelWidth))
	{
		return MakeSpriteError(PackErr);
	}

	UE_LOG(LogHktSpriteGenerator, Log,
		TEXT("PackBundleFolderToAtlasPng: Frames=%d Cell=%dx%d Cols=%d Rows=%d MaxW=%d → %s"),
		Frames.Num(), CellW, CellH, Cols, Rows, MaxAtlasPixelWidth, *OutputPngPath);

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

	const FString SafeTag       = SanitizeForAssetName(CharacterTag);
	const FString VisualName    = FString::Printf(TEXT("DA_HISMSpriteVisual_%s"), *SafeTag);
	const FString AnimName      = FString::Printf(TEXT("DA_HISMSpriteAnim_%s"), *SafeTag);
	const FString VisualPackage = FString::Printf(TEXT("%s/%s"), *OutputDir, *VisualName);
	const FString AnimPackage   = FString::Printf(TEXT("%s/%s"), *OutputDir, *AnimName);

	const FString ResolvedAnimTag = AnimTagStr.IsEmpty()
		? TEXT("Anim.FullBody.Locomotion.Idle")
		: AnimTagStr;

	// --- 1. Animation 자산 ---
	UPackage* AnimPkg = CreatePackage(*AnimPackage);
	if (!AnimPkg) return MakeSpriteError(TEXT("Animation 패키지 생성 실패"));
	AnimPkg->FullyLoad();

	UHktHISMSpriteAnimationDataAsset* AnimAsset = NewObject<UHktHISMSpriteAnimationDataAsset>(
		AnimPkg, FName(*AnimName), RF_Public | RF_Standalone);
	if (!AnimAsset) return MakeSpriteError(TEXT("UHktHISMSpriteAnimationDataAsset 생성 실패"));

	FHktSpriteAnimation Anim;
	Anim.NumDirections       = NumDir;
	Anim.FramesPerDirection  = FMath::Max(Cols, 1);
	Anim.PivotOffset         = FVector2f(FrameWidth * 0.5f, static_cast<float>(FrameHeight));
	Anim.FrameDurationMs     = FrameDurationMs;
	Anim.bLooping            = bLooping;
	Anim.bMirrorWestFromEast = bMirrorWestFromEast;

	const FGameplayTag AnimTag = EnsureTag(ResolvedAnimTag);
	AnimAsset->Animations.Add(AnimTag, MoveTemp(Anim));
	AnimAsset->DefaultAnimTag = AnimTag;

	AnimAsset->MarkPackageDirty();
	const FString AnimFile = FPackageName::LongPackageNameToFilename(AnimPackage, FPackageName::GetAssetPackageExtension());
	FSavePackageArgs AnimSaveArgs;
	AnimSaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
	if (!UPackage::SavePackage(AnimPkg, AnimAsset, *AnimFile, AnimSaveArgs))
	{
		return MakeSpriteError(TEXT("Animation 패키지 저장 실패"));
	}
	FAssetRegistryModule::AssetCreated(AnimAsset);

	// --- 2. Visual 자산 ---
	UPackage* VisualPkg = CreatePackage(*VisualPackage);
	if (!VisualPkg) return MakeSpriteError(TEXT("Visual 패키지 생성 실패"));
	VisualPkg->FullyLoad();

	UHktHISMSpriteVisualAsset* Visual = NewObject<UHktHISMSpriteVisualAsset>(
		VisualPkg, FName(*VisualName), RF_Public | RF_Standalone);
	if (!Visual) return MakeSpriteError(TEXT("UHktHISMSpriteVisualAsset 생성 실패"));

	Visual->IdentifierTag  = EnsureTag(CharacterTag);
	Visual->Atlas          = Atlas;
	Visual->AtlasCellSize  = FVector2f(static_cast<float>(FrameWidth), static_cast<float>(FrameHeight));
	Visual->PixelToWorld   = PixelToWorld;
	Visual->AnimationAsset = AnimAsset;

	Visual->MarkPackageDirty();
	const FString VisualFile = FPackageName::LongPackageNameToFilename(VisualPackage, FPackageName::GetAssetPackageExtension());
	FSavePackageArgs VisualSaveArgs;
	VisualSaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
	if (!UPackage::SavePackage(VisualPkg, Visual, *VisualFile, VisualSaveArgs))
	{
		return MakeSpriteError(TEXT("Visual 패키지 저장 실패"));
	}
	FAssetRegistryModule::AssetCreated(Visual);

	UE_LOG(LogHktSpriteGenerator, Log, TEXT("AtlasGrid HISMSprite: Tag=%s Atlas=%dx%d Cell=%dx%d Cols=%d Rows=%d → NumDir=%d AnimTag=%s"),
		*CharacterTag, AtlasW, AtlasH, FrameWidth, FrameHeight, Cols, Rows, NumDir, *AnimTag.ToString());

	return MakeResult(true, {
		{ TEXT("tag"),           CharacterTag },
		{ TEXT("dataAssetPath"), FString::Printf(TEXT("%s.%s"), *VisualPackage, *VisualName) },
		{ TEXT("animAssetPath"), FString::Printf(TEXT("%s.%s"), *AnimPackage,   *AnimName)   },
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

	/** 기존 UHktHISMSpriteAnimationDataAsset 로드 또는 새로 생성. */
	static UHktHISMSpriteAnimationDataAsset* UpsertAnimation(
		const FString& AnimPackage, const FString& AnimName, UPackage*& OutPkg)
	{
		OutPkg = FindPackage(nullptr, *AnimPackage);
		if (OutPkg)
		{
			UHktHISMSpriteAnimationDataAsset* Existing = Cast<UHktHISMSpriteAnimationDataAsset>(
				StaticFindObject(UHktHISMSpriteAnimationDataAsset::StaticClass(), OutPkg, *AnimName));
			if (Existing) return Existing;
		}

		const FString AssetObjPath = FString::Printf(TEXT("%s.%s"), *AnimPackage, *AnimName);
		if (UHktHISMSpriteAnimationDataAsset* Loaded = LoadObject<UHktHISMSpriteAnimationDataAsset>(nullptr, *AssetObjPath))
		{
			OutPkg = Loaded->GetPackage();
			return Loaded;
		}

		OutPkg = CreatePackage(*AnimPackage);
		if (!OutPkg) return nullptr;
		OutPkg->FullyLoad();

		return NewObject<UHktHISMSpriteAnimationDataAsset>(
			OutPkg, FName(*AnimName), RF_Public | RF_Standalone);
	}

	/** 기존 UHktHISMSpriteVisualAsset 로드 또는 새로 생성. */
	static UHktHISMSpriteVisualAsset* UpsertVisual(
		const FString& VisualPackage, const FString& VisualName,
		const FString& CharTagStr, UPackage*& OutPkg)
	{
		OutPkg = FindPackage(nullptr, *VisualPackage);
		if (OutPkg)
		{
			UHktHISMSpriteVisualAsset* Existing = Cast<UHktHISMSpriteVisualAsset>(
				StaticFindObject(UHktHISMSpriteVisualAsset::StaticClass(), OutPkg, *VisualName));
			if (Existing) return Existing;
		}

		const FString AssetObjPath = FString::Printf(TEXT("%s.%s"), *VisualPackage, *VisualName);
		if (UHktHISMSpriteVisualAsset* Loaded = LoadObject<UHktHISMSpriteVisualAsset>(nullptr, *AssetObjPath))
		{
			OutPkg = Loaded->GetPackage();
			return Loaded;
		}

		OutPkg = CreatePackage(*VisualPackage);
		if (!OutPkg) return nullptr;
		OutPkg->FullyLoad();

		UHktHISMSpriteVisualAsset* Visual = NewObject<UHktHISMSpriteVisualAsset>(
			OutPkg, FName(*VisualName), RF_Public | RF_Standalone);
		if (Visual)
		{
			Visual->IdentifierTag = EnsureTag(CharTagStr);
		}
		return Visual;
	}

	/** DataAsset 저장 + AssetRegistry 등록. */
	static bool SaveAsset(UObject* Asset, UPackage* Pkg,
	                      const FString& PackagePath, FString& OutError)
	{
		Asset->MarkPackageDirty();
		const FString File = FPackageName::LongPackageNameToFilename(
			PackagePath, FPackageName::GetAssetPackageExtension());
		FSavePackageArgs SaveArgs;
		SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
		if (!UPackage::SavePackage(Pkg, Asset, *File, SaveArgs))
		{
			OutError = TEXT("DataAsset 패키지 저장 실패");
			return false;
		}
		FAssetRegistryModule::AssetCreated(Asset);
		return true;
	}

} // namespace HktSpriteGen

FString UHktSpriteGeneratorFunctionLibrary::BuildSpriteAnim(
	const FString& CharacterTagStr,
	const FString& AnimTagStr,
	const TArray<FHktSpriteAnimAtlasInput>& AtlasInputs,
	int32 CellWidthOverride,
	int32 CellHeightOverride,
	float PixelToWorld,
	float FrameDurationMsOverride,
	int32 LoopingOverride,
	int32 MirrorWestFromEastOverride)
{
	using namespace HktSpriteGen;

	if (CharacterTagStr.IsEmpty()) return MakeSpriteError(TEXT("CharacterTagStr 필수"));
	if (AnimTagStr.IsEmpty())      return MakeSpriteError(TEXT("AnimTagStr 필수"));
	if (AtlasInputs.Num() == 0)
	{
		return MakeSpriteError(FString::Printf(
			TEXT("AtlasInputs 비어있음 (char=%s, anim=%s) — 호출자(워크스페이스 빌더)가 atlas 입력을 채워야 합니다"),
			*CharacterTagStr, *AnimTagStr));
	}

	const bool         bLoop    = InferLooping(AnimTagStr);
	const FGameplayTag AnimTag  = EnsureTag(AnimTagStr);
	const FGameplayTag CharTag  = EnsureTag(CharacterTagStr);

	const FString SafeCharTag     = SanitizeForAssetName(CharacterTagStr);
	const FString VisualName      = FString::Printf(TEXT("DA_HISMSpriteVisual_%s"), *SafeCharTag);
	const FString AnimName        = FString::Printf(TEXT("DA_HISMSpriteAnim_%s"),   *SafeCharTag);
	// 산출물은 캐릭터 태그명을 폴더로 격리 — Static/Paper2D 빌더와 동일 컨벤션.
	// 여러 캐릭터 빌드 시 콘텐츠 브라우저가 평면적으로 뒤섞이는 것을 막는다.
	const FString CharOutputDir   = kDefaultOutputDir / SafeCharTag;
	const FString VisualPackage   = CharOutputDir / VisualName;
	const FString AnimPackage     = CharOutputDir / AnimName;

	struct FSlotEntry { int32 DirIdx; UTexture2D* Tex; int32 CellW; int32 CellH; int32 FrameCount; };
	TArray<FSlotEntry> Slots;

	for (const FHktSpriteAnimAtlasInput& In : AtlasInputs)
	{
		const int32 d = FMath::Clamp(In.DirIdx, 0, 7);
		if (In.PngPath.IsEmpty() || !FPaths::FileExists(In.PngPath))
		{
			UE_LOG(LogHktSpriteGenerator, Warning,
				TEXT("BuildSpriteAnim: 입력 PNG 없음 — Dir=%s, Path=%s"),
				kDirNamesNS[d], *In.PngPath);
			continue;
		}

		// Texture 자산 경로/이름은 안정적인 char/anim/dir 기반 컨벤션을 그대로 사용 — 산출물 식별 일관.
		const FString AssetName = ConventionDirAtlasAssetName(CharacterTagStr, AnimTagStr, d);
		const FString PkgPath   = ConventionDirAtlasPackagePath(CharacterTagStr, AnimTagStr, d, CharOutputDir);
		const FString ObjPath   = FString::Printf(TEXT("%s.%s"), *PkgPath, *AssetName);

		UTexture2D* Tex = LoadObject<UTexture2D>(nullptr, *ObjPath);
		if (!Tex)
		{
			Tex = ImportAtlasTexture(In.PngPath, PkgPath, AssetName);
			if (!Tex)
			{
				UE_LOG(LogHktSpriteGenerator, Warning, TEXT("BuildSpriteAnim: PNG 임포트 실패 (%s)"), *In.PngPath);
				continue;
			}
		}

		const int32 AtlasW = Tex->GetSizeX();
		const int32 AtlasH = Tex->GetSizeY();

		// 셀 크기 우선순위: anim 단위 override > 입력 사이드카 값 > atlas 종횡비 폴백.
		int32 UseW = (CellWidthOverride  > 0) ? CellWidthOverride  : In.CellW;
		int32 UseH = (CellHeightOverride > 0) ? CellHeightOverride : In.CellH;
		if (UseH <= 0) UseH = AtlasH;
		if (UseW <= 0)
		{
			int32 Frames = In.FrameCount;
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
			TEXT("BuildSpriteAnim: 임포트된 슬롯이 없습니다 (char=%s, anim=%s)"),
			*CharacterTagStr, *AnimTagStr));
	}

	// 양자화 — 발견된 DirIdx 집합으로 1/2/5/8 중 결정.
	auto HasDir = [&Slots](int32 D)
	{
		return Slots.ContainsByPredicate([D](const FSlotEntry& S){ return S.DirIdx == D; });
	};
	const bool bHasE = HasDir(2);
	const bool bHasW = HasDir(6);
	const bool bOnlyEW = (Slots.Num() <= 2) && bHasE
		&& !HasDir(0) && !HasDir(1) && !HasDir(3)
		&& !HasDir(4) && !HasDir(5) && !HasDir(7);

	int32 NumDirLocal;
	if (Slots.Num() == 1 && !bHasE && !bHasW)
	{
		NumDirLocal = 1;
	}
	else if (bOnlyEW)
	{
		// {E} 또는 {E,W} → 2방향 (좌/우). W 부재 시 mirror 로 보강.
		NumDirLocal = 2;
	}
	else if (Slots.Num() <= 5
		&& HasDir(0) && HasDir(1) && HasDir(2) && HasDir(3) && HasDir(4))
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

	// --- Animation 자산 upsert (anim 누적) ---
	UPackage* AnimPkg = nullptr;
	UHktHISMSpriteAnimationDataAsset* AnimAsset = UpsertAnimation(AnimPackage, AnimName, AnimPkg);
	if (!AnimAsset || !AnimPkg) return MakeSpriteError(TEXT("Animation DataAsset 생성/로드 실패"));

	FHktSpriteAnimation Anim;
	Anim.Atlas               = nullptr;
	Anim.AtlasCellSize       = FVector2f(static_cast<float>(SlotCellW), static_cast<float>(SlotCellH));
	Anim.NumDirections       = NumDirLocal;
	Anim.FramesPerDirection  = FPDLocal;
	Anim.PivotOffset         = FVector2f(SlotCellW * 0.5f, static_cast<float>(SlotCellH));
	// 호출자(워크스페이스 빌더) override 가 있으면 우선, 없으면 디폴트/추론.
	Anim.FrameDurationMs = (FrameDurationMsOverride > 0.f) ? FrameDurationMsOverride : 100.f;
	Anim.bLooping        = (LoopingOverride >= 0) ? (LoopingOverride != 0) : bLoop;
	// 5방향: 항상 W/SW/NW를 동측에서 미러.
	// 2방향: W 슬롯이 없을 때만 미러 (있으면 좌향 전용 아트 사용).
	Anim.bMirrorWestFromEast = (MirrorWestFromEastOverride >= 0)
		? (MirrorWestFromEastOverride != 0)
		: ((NumDirLocal == 5) || (NumDirLocal == 2 && !bHasW));

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
	else if (NumDirLocal == 2)
	{
		// 슬롯 0 = E(idx 2), 슬롯 1 = W(idx 6). W 부재 시 빈 슬롯 — Resolver 가 mirror 로 폴백.
		AssignSlot(0, /*E*/ 2);
		AssignSlot(1, /*W*/ 6);
	}
	else
	{
		for (int32 i = 0; i < NumDirLocal; ++i) AssignSlot(i, i);
	}

	// 프레임은 그리드 규약(AtlasIndex=frameIdx, AtlasSlotIdx=dirIdx)으로 합성 — 별도 배열 없음.

	AnimAsset->Animations.Add(AnimTag, MoveTemp(Anim));
	if (!AnimAsset->DefaultAnimTag.IsValid()) AnimAsset->DefaultAnimTag = AnimTag;

	FString SaveErr;
	if (!SaveAsset(AnimAsset, AnimPkg, AnimPackage, SaveErr))
	{
		return MakeSpriteError(SaveErr);
	}

	// --- Visual 자산 upsert (AnimationAsset 슬롯 바인딩) ---
	UPackage* VisualPkg = nullptr;
	UHktHISMSpriteVisualAsset* Visual = UpsertVisual(VisualPackage, VisualName, CharacterTagStr, VisualPkg);
	if (!Visual || !VisualPkg) return MakeSpriteError(TEXT("Visual DataAsset 생성/로드 실패"));
	if (!Visual->IdentifierTag.IsValid()) Visual->IdentifierTag = CharTag;
	if (Visual->PixelToWorld <= 0.f)      Visual->PixelToWorld  = PixelToWorld;
	Visual->AnimationAsset = AnimAsset;

	if (!SaveAsset(Visual, VisualPkg, VisualPackage, SaveErr))
	{
		return MakeSpriteError(SaveErr);
	}

	UE_LOG(LogHktSpriteGenerator, Log,
		TEXT("BuildSpriteAnim: Char=%s Anim=%s Slots=%d NumDir=%d FPD=%d Cell=%dx%d"),
		*CharacterTagStr, *AnimTagStr, Slots.Num(), NumDirLocal, FPDLocal, SlotCellW, SlotCellH);

	return MakeResult(true, {
		{ TEXT("dataAssetPath"),  FString::Printf(TEXT("%s.%s"), *VisualPackage, *VisualName) },
		{ TEXT("animAssetPath"),  FString::Printf(TEXT("%s.%s"), *AnimPackage,   *AnimName)   },
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
	 * HktTerrain/Public/HktTerrainVoxelTypes.h::EHktTerrainType 의 인덱스 순서와 동기화.
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

// ============================================================================
// EditorBuildHISMStaticVisual — 정적 객체 1장 (UHktHISMSpriteVisualAsset)
// ============================================================================

FString UHktSpriteGeneratorFunctionLibrary::EditorBuildHISMStaticVisual(
	const FString& VisualTagStr,
	const FString& SourceImagePath,
	float PixelToWorld,
	const FString& OutputDir)
{
	using namespace HktSpriteGen;

	if (VisualTagStr.IsEmpty())     return MakeSpriteError(TEXT("VisualTagStr 필수"));
	if (SourceImagePath.IsEmpty())  return MakeSpriteError(TEXT("SourceImagePath 필수"));

	FString PngPath = SourceImagePath;
	if (FPaths::IsRelative(PngPath))
	{
		PngPath = FPaths::ConvertRelativePathToFull(FPaths::ProjectDir(), PngPath);
	}
	if (!FPaths::FileExists(PngPath))
	{
		return MakeSpriteError(FString::Printf(TEXT("PNG 파일 없음: %s"), *PngPath));
	}

	const FGameplayTag VisualTag = EnsureTag(VisualTagStr);
	if (!VisualTag.IsValid())
	{
		return MakeSpriteError(FString::Printf(TEXT("VisualTag(%s) 등록 실패"), *VisualTagStr));
	}

	const FString SafeTag = SanitizeForAssetName(VisualTagStr);
	const FString OutDir  = !OutputDir.IsEmpty()
		? OutputDir
		: (TEXT("/Game/Generated/Sprites/Static/") + SafeTag);

	// 1) PNG → UTexture2D
	const FString TextureAssetName = FString::Printf(TEXT("T_HISMSpriteStatic_%s"), *SafeTag);
	const FString TexturePackage   = OutDir / TextureAssetName;
	UTexture2D* Tex = ImportAtlasTexture(PngPath, TexturePackage, TextureAssetName);
	if (!Tex)
	{
		return MakeSpriteError(FString::Printf(TEXT("ImportAtlasTexture 실패: %s"), *PngPath));
	}
	const int32 TexW = Tex->GetSizeX();
	const int32 TexH = Tex->GetSizeY();

	// 2) UHktHISMSpriteVisualAsset upsert
	const FString VisualAssetName = FString::Printf(TEXT("DA_HISMSpriteVisual_%s"), *SafeTag);
	const FString VisualPackage   = OutDir / VisualAssetName;
	const FString VisualObjectPath = VisualPackage + TEXT(".") + VisualAssetName;

	UHktHISMSpriteVisualAsset* Visual = LoadObject<UHktHISMSpriteVisualAsset>(nullptr, *VisualObjectPath);
	if (!Visual)
	{
		UPackage* Pkg = CreatePackage(*VisualPackage);
		if (!Pkg) return MakeSpriteError(TEXT("Visual 패키지 생성 실패"));
		Pkg->FullyLoad();
		Visual = NewObject<UHktHISMSpriteVisualAsset>(
			Pkg, FName(*VisualAssetName), RF_Public | RF_Standalone);
	}

	Visual->IdentifierTag  = VisualTag;
	Visual->Atlas          = Tex;
	Visual->AtlasCellSize  = FVector2f(static_cast<float>(TexW), static_cast<float>(TexH));
	Visual->PixelToWorld   = PixelToWorld;
	Visual->AnimationAsset = nullptr;  // 정적 경로

	// 저장
	UPackage* VisualPkg = Visual->GetPackage();
	if (VisualPkg)
	{
		VisualPkg->MarkPackageDirty();
		FAssetRegistryModule::AssetCreated(Visual);
		const FString PkgFile = FPackageName::LongPackageNameToFilename(
			VisualPkg->GetName(), FPackageName::GetAssetPackageExtension());
		FSavePackageArgs SaveArgs;
		SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
		SaveArgs.SaveFlags     = SAVE_NoError;
		SaveArgs.Error         = GLog;
		UPackage::SavePackage(VisualPkg, Visual, *PkgFile, SaveArgs);
	}

	return MakeResult(true, {
		{ TEXT("visualTag"),       VisualTagStr },
		{ TEXT("sourceImagePath"), PngPath },
		{ TEXT("texturePath"),     TexturePackage },
		{ TEXT("visualPath"),      VisualPackage },
		{ TEXT("pixelToWorld"),    FString::SanitizeFloat(PixelToWorld) },
		{ TEXT("textureWidth"),    FString::FromInt(TexW) },
		{ TEXT("textureHeight"),   FString::FromInt(TexH) },
	});
}

// ============================================================================
// EditorBuildHISMStaticFolder — 폴더 일괄
// ============================================================================

FString UHktSpriteGeneratorFunctionLibrary::EditorBuildHISMStaticFolder(
	const FString& BaseVisualTagStr,
	const FString& SourceFolder,
	float PixelToWorld,
	const FString& OutputDir)
{
	using namespace HktSpriteGen;

	if (BaseVisualTagStr.IsEmpty()) return MakeSpriteError(TEXT("BaseVisualTagStr 필수"));
	if (SourceFolder.IsEmpty())     return MakeSpriteError(TEXT("SourceFolder 필수"));

	FString FolderAbs = SourceFolder;
	if (FPaths::IsRelative(FolderAbs))
	{
		FolderAbs = FPaths::ConvertRelativePathToFull(FPaths::ProjectDir(), FolderAbs);
	}
	if (!FPaths::DirectoryExists(FolderAbs))
	{
		return MakeSpriteError(FString::Printf(TEXT("폴더 없음: %s"), *FolderAbs));
	}

	TArray<FString> PngFiles;
	IFileManager::Get().FindFiles(PngFiles, *(FolderAbs / TEXT("*.png")), /*Files*/true, /*Dirs*/false);
	if (PngFiles.IsEmpty())
	{
		return MakeSpriteError(FString::Printf(TEXT("폴더에 PNG 가 없음: %s"), *FolderAbs));
	}

	// 결과 누적. 개별 호출 결과 JSON 을 부분 파싱하는 대신 카운트만 트래킹.
	int32 OkCount = 0;
	FString FirstError;
	TArray<FString> EntryPaths;
	for (const FString& PngName : PngFiles)
	{
		const FString Stem        = FPaths::GetBaseFilename(PngName);
		const FString FullPath    = FolderAbs / PngName;
		const FString VisualTagStr = FString::Printf(TEXT("%s.%s"), *BaseVisualTagStr, *Stem);

		const FString Single = EditorBuildHISMStaticVisual(VisualTagStr, FullPath, PixelToWorld, OutputDir);

		TSharedPtr<FJsonObject> Obj;
		const TSharedRef<TJsonReader<>> R = TJsonReaderFactory<>::Create(Single);
		if (FJsonSerializer::Deserialize(R, Obj) && Obj.IsValid())
		{
			bool bOk = false;
			Obj->TryGetBoolField(TEXT("success"), bOk);
			if (bOk)
			{
				++OkCount;
				FString VP;
				if (Obj->TryGetStringField(TEXT("visualPath"), VP)) EntryPaths.Add(VP);
			}
			else if (FirstError.IsEmpty())
			{
				Obj->TryGetStringField(TEXT("error"), FirstError);
			}
		}
	}

	FString EntriesJson;
	{
		const TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&EntriesJson);
		W->WriteArrayStart();
		for (const FString& P : EntryPaths) W->WriteValue(P);
		W->WriteArrayEnd();
		W->Close();
	}

	TMap<FString, FString> Fields = {
		{ TEXT("baseVisualTag"), BaseVisualTagStr },
		{ TEXT("sourceFolder"),  FolderAbs },
		{ TEXT("totalCount"),    FString::FromInt(PngFiles.Num()) },
		{ TEXT("okCount"),       FString::FromInt(OkCount) },
		{ TEXT("entries"),       EntriesJson },
	};
	if (OkCount == 0 && !FirstError.IsEmpty())
	{
		Fields.Add(TEXT("error"), FirstError);
	}
	return MakeResult(OkCount > 0, Fields);
}
