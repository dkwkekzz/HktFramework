// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteGeneratorFunctionLibrary.h"
#include "HktSpritePartTemplate.h"
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

	static EHktSpritePartSlot ParseSlot(const FString& S)
	{
		if (S.Equals(TEXT("Body"),        ESearchCase::IgnoreCase)) return EHktSpritePartSlot::Body;
		if (S.Equals(TEXT("Head"),        ESearchCase::IgnoreCase)) return EHktSpritePartSlot::Head;
		if (S.Equals(TEXT("Weapon"),      ESearchCase::IgnoreCase)) return EHktSpritePartSlot::Weapon;
		if (S.Equals(TEXT("Shield"),      ESearchCase::IgnoreCase)) return EHktSpritePartSlot::Shield;
		if (S.Equals(TEXT("HeadgearTop"), ESearchCase::IgnoreCase)) return EHktSpritePartSlot::HeadgearTop;
		if (S.Equals(TEXT("HeadgearMid"), ESearchCase::IgnoreCase)) return EHktSpritePartSlot::HeadgearMid;
		if (S.Equals(TEXT("HeadgearLow"), ESearchCase::IgnoreCase)) return EHktSpritePartSlot::HeadgearLow;
		return EHktSpritePartSlot::Body;
	}

	/** Tag 문자열을 네이티브 등록해 FGameplayTag로 반환. 파일명 안전 변환까지. */
	static FGameplayTag EnsureTag(const FString& TagStr)
	{
		UGameplayTagsManager& TM = UGameplayTagsManager::Get();
		FGameplayTag Existing = TM.RequestGameplayTag(FName(*TagStr), /*ErrorIfNotFound*/ false);
		if (Existing.IsValid()) return Existing;
		// 태그 미등록이면 일시적으로 네이티브 추가 (세션 수명). 영구 등록은 프로젝트 DataTable 관리.
		return TM.AddNativeGameplayTag(FName(*TagStr));
	}

	static FString SanitizeForAssetName(const FString& In)
	{
		return In.Replace(TEXT("."), TEXT("_"));
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

		// 스프라이트 아틀라스 표준 설정: 픽셀아트 Nearest, NoMipmap, UI 그룹 압축 X
		Tex->CompressionSettings = TC_EditorIcon;
		Tex->Filter              = TF_Nearest;
		Tex->MipGenSettings      = TMGS_NoMipmaps;
		Tex->LODGroup            = TEXTUREGROUP_UI;
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

	static void ParseFrame(const TSharedPtr<FJsonObject>& F, FHktSpriteFrame& Out)
	{
		Out.AtlasIndex       = static_cast<int32>(F->GetNumberField(TEXT("atlasIndex")));
		Out.PivotOffset.X    = static_cast<float>(F->GetNumberField(TEXT("pivotX")));
		Out.PivotOffset.Y    = static_cast<float>(F->GetNumberField(TEXT("pivotY")));

		double ScaleX = 1.0, ScaleY = 1.0;
		F->TryGetNumberField(TEXT("scaleX"), ScaleX);
		F->TryGetNumberField(TEXT("scaleY"), ScaleY);
		Out.Scale = FVector2f(static_cast<float>(ScaleX), static_cast<float>(ScaleY));

		double Rot = 0.0;
		F->TryGetNumberField(TEXT("rotation"), Rot);
		Out.Rotation = static_cast<float>(Rot);

		double ZBias = 0.0;
		F->TryGetNumberField(TEXT("zBias"), ZBias);
		Out.ZBias = static_cast<int32>(ZBias);

		const TSharedPtr<FJsonObject>* Tint = nullptr;
		if (F->TryGetObjectField(TEXT("tint"), Tint) && Tint && Tint->IsValid())
		{
			double R=1,G=1,B=1,A=1;
			(*Tint)->TryGetNumberField(TEXT("r"), R);
			(*Tint)->TryGetNumberField(TEXT("g"), G);
			(*Tint)->TryGetNumberField(TEXT("b"), B);
			(*Tint)->TryGetNumberField(TEXT("a"), A);
			Out.Tint = FLinearColor(R, G, B, A);
		}

		const TSharedPtr<FJsonObject>* Anchors = nullptr;
		if (F->TryGetObjectField(TEXT("childAnchors"), Anchors) && Anchors && Anchors->IsValid())
		{
			for (const auto& Pair : (*Anchors)->Values)
			{
				const TArray<TSharedPtr<FJsonValue>>* Arr = nullptr;
				if (Pair.Value.IsValid() && Pair.Value->TryGetArray(Arr) && Arr && Arr->Num() >= 2)
				{
					const float X = static_cast<float>((*Arr)[0]->AsNumber());
					const float Y = static_cast<float>((*Arr)[1]->AsNumber());
					Out.ChildAnchors.Add(FName(*Pair.Key), FVector2f(X, Y));
				}
			}
		}
	}
}

// ============================================================================
// McpBuildSpritePart
// ============================================================================

FString UHktSpriteGeneratorFunctionLibrary::McpBuildSpritePart(const FString& JsonSpec)
{
	using namespace HktSpriteGen;

	TSharedPtr<FJsonObject> Root;
	TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(JsonSpec);
	if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
	{
		return MakeSpriteError(TEXT("JsonSpec parse failed"));
	}

	const FString TagStr   = Root->GetStringField(TEXT("tag"));
	const FString SlotStr  = Root->GetStringField(TEXT("slot"));
	const FString AtlasPng = Root->GetStringField(TEXT("atlasPngPath"));
	if (TagStr.IsEmpty() || AtlasPng.IsEmpty())
	{
		return MakeSpriteError(TEXT("tag / atlasPngPath required"));
	}
	if (!FPaths::FileExists(AtlasPng))
	{
		return MakeSpriteError(FString::Printf(TEXT("Atlas PNG not found: %s"), *AtlasPng));
	}

	const double CellW         = Root->GetNumberField(TEXT("cellW"));
	const double CellH         = Root->GetNumberField(TEXT("cellH"));
	double PixelToWorld        = 2.0;
	Root->TryGetNumberField(TEXT("pixelToWorld"), PixelToWorld);

	FString OutputDir = TEXT("/Game/Generated/Sprites");
	Root->TryGetStringField(TEXT("outputDir"), OutputDir);

	// --- 에셋 경로 계산 ---
	const FString SafeTag        = SanitizeForAssetName(TagStr);
	const FString AtlasName      = FString::Printf(TEXT("T_SpriteAtlas_%s"), *SafeTag);
	const FString TemplateName   = FString::Printf(TEXT("DA_SpritePart_%s"),  *SafeTag);
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

	UHktSpritePartTemplate* Tmpl = NewObject<UHktSpritePartTemplate>(
		TmplPkg, FName(*TemplateName), RF_Public | RF_Standalone);
	if (!Tmpl) return MakeSpriteError(TEXT("UHktSpritePartTemplate 생성 실패"));

	Tmpl->IdentifierTag = EnsureTag(TagStr);
	Tmpl->PartSlot      = ParseSlot(SlotStr);
	Tmpl->Atlas         = AtlasTex;
	Tmpl->AtlasCellSize = FVector2f(static_cast<float>(CellW), static_cast<float>(CellH));
	Tmpl->PixelToWorld  = static_cast<float>(PixelToWorld);

	// --- 3. Actions 파싱 ---
	const TArray<TSharedPtr<FJsonValue>>* Actions = nullptr;
	if (Root->TryGetArrayField(TEXT("actions"), Actions) && Actions)
	{
		for (const TSharedPtr<FJsonValue>& V : *Actions)
		{
			const TSharedPtr<FJsonObject> A = V->AsObject();
			if (!A.IsValid()) continue;

			FHktSpriteAction Action;
			Action.ActionId = FName(*A->GetStringField(TEXT("id")));

			double FrameDur = 100.0;
			A->TryGetNumberField(TEXT("frameDurationMs"), FrameDur);
			Action.FrameDurationMs = static_cast<float>(FrameDur);

			bool bLoop = true, bMirror = true;
			A->TryGetBoolField(TEXT("looping"), bLoop);
			A->TryGetBoolField(TEXT("mirrorWestFromEast"), bMirror);
			Action.bLooping = bLoop;
			Action.bMirrorWestFromEast = bMirror;

			FString OnComplete;
			if (A->TryGetStringField(TEXT("onCompleteTransition"), OnComplete) && !OnComplete.IsEmpty())
			{
				Action.OnCompleteTransition = FName(*OnComplete);
			}

			const TArray<TSharedPtr<FJsonValue>>* PerFrame = nullptr;
			if (A->TryGetArrayField(TEXT("perFrameDurationMs"), PerFrame) && PerFrame)
			{
				for (const auto& F : *PerFrame) Action.PerFrameDurationMs.Add(static_cast<float>(F->AsNumber()));
			}

			const TArray<TSharedPtr<FJsonValue>>* Dirs = nullptr;
			if (A->TryGetArrayField(TEXT("framesByDirection"), Dirs) && Dirs)
			{
				Action.FramesByDirection.Reserve(Dirs->Num());
				for (const TSharedPtr<FJsonValue>& DirV : *Dirs)
				{
					FHktSpriteDirectionFrames DirFrames;
					const TArray<TSharedPtr<FJsonValue>>* FrameArr = nullptr;
					if (DirV.IsValid() && DirV->TryGetArray(FrameArr) && FrameArr)
					{
						DirFrames.Frames.Reserve(FrameArr->Num());
						for (const TSharedPtr<FJsonValue>& FV : *FrameArr)
						{
							const TSharedPtr<FJsonObject> FO = FV->AsObject();
							if (!FO.IsValid()) continue;
							FHktSpriteFrame Frame;
							ParseFrame(FO, Frame);
							DirFrames.Frames.Add(Frame);
						}
					}
					Action.FramesByDirection.Add(MoveTemp(DirFrames));
				}
			}

			Tmpl->Actions.Add(Action.ActionId, Action);
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

	UE_LOG(LogHktSpriteGenerator, Log, TEXT("SpritePart 빌드 완료: Tag=%s Slot=%s Atlas=%s Template=%s"),
		*TagStr, *SlotStr, *AtlasPackage, *TemplatePackage);

	return MakeResult(true, {
		{ TEXT("tag"),            TagStr },
		{ TEXT("atlasAssetPath"), FString::Printf(TEXT("%s.%s"), *AtlasPackage,    *AtlasName)    },
		{ TEXT("dataAssetPath"),  FString::Printf(TEXT("%s.%s"), *TemplatePackage, *TemplateName) },
	});
}

// ============================================================================
// EditorBuildSpritePartFromDirectory — MCP/Python 없이 에디터 단독 파이프라인
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
		if (E == TEXT("tga"))                     return EImageFormat::BMP; // TGA는 별도 처리 필요, 일단 BMP로 폴백 표시
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
		int32 Width = 0;
		int32 Height = 0;
	};

	/** 파일명 stem을 파싱: {action}[_{direction}][_{frame_idx}] */
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

	/** 디렉터리에서 이미지 파일을 모아 평탄한 프레임 리스트 반환. */
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

		// (b) 서브폴더 스캔: {action}/{direction}/{idx}.ext  또는  {action}/{direction}.ext
		TArray<FString> ActionDirs;
		FM.FindFiles(ActionDirs, *(InputDir / TEXT("*")), /*Files*/ false, /*Dirs*/ true);
		for (const FString& ActionDirName : ActionDirs)
		{
			const FString ActionPath = InputDir / ActionDirName;
			const FString ActionLower = ActionDirName.ToLower();

			// 먼저 direction 서브폴더가 있는지 확인
			TArray<FString> DirSubs;
			FM.FindFiles(DirSubs, *(ActionPath / TEXT("*")), false, true);
			bool bHasDirSub = false;
			for (const FString& Sub : DirSubs)
			{
				const int32 DirIdx = DirectionIndexFromName(Sub);
				if (DirIdx == INDEX_NONE) continue;
				bHasDirSub = true;

				// 서브폴더가 있으면 같은 액션의 플랫 결과 제거 (서브폴더 우선)
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

	/** 이미지 하나를 BGRA8 raw로 디코드. */
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
		// 1. 고유 파일만 한 번씩 디코드 — 이후 확장 복제본들은 같은 아틀라스 셀을 공유.
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

		// 2. INDEX_NONE 프레임은 명시 방향이 없는 방향에만 복제 (중복 키 방지).
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

		// 3. 아틀라스 셀 배정은 고유 파일 단위 — 같은 경로가 여러 방향에 확장돼도 한 셀만 차지.
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
		OutCols = FMath::Max(1, FMath::Min(kNumDirections, CellCount));
		OutRows = FMath::DivideAndRoundUp(CellCount, OutCols);

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

	/** 패킹 결과를 McpBuildSpritePart JsonSpec으로 변환. */
	static FString BuildSpecJson(
		const FString& Tag, const FString& SlotStr, const FString& AtlasPngPath,
		int32 CellW, int32 CellH, float PixelToWorld, const FString& OutputDir,
		const TArray<FFrameEntry>& Frames,
		const TMap<TTuple<FString,int32,int32>, int32>& IndexMap,
		float FrameDurationMs, bool bLooping, bool bMirrorWestFromEast)
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
		W->WriteValue(TEXT("tag"), Tag);
		W->WriteValue(TEXT("slot"), SlotStr);
		W->WriteValue(TEXT("atlasPngPath"), AtlasPngPath);
		W->WriteValue(TEXT("cellW"), CellW);
		W->WriteValue(TEXT("cellH"), CellH);
		W->WriteValue(TEXT("pixelToWorld"), PixelToWorld);
		if (!OutputDir.IsEmpty()) W->WriteValue(TEXT("outputDir"), OutputDir);

		W->WriteArrayStart(TEXT("actions"));
		TArray<FString> ActionKeys;
		Grouped.GenerateKeyArray(ActionKeys);
		ActionKeys.Sort();
		for (const FString& ActionId : ActionKeys)
		{
			const TArray<TArray<const FFrameEntry*>>& Dirs = Grouped[ActionId];
			W->WriteObjectStart();
			W->WriteValue(TEXT("id"), ActionId);
			W->WriteValue(TEXT("frameDurationMs"), FrameDurationMs);
			W->WriteValue(TEXT("looping"), bLooping);
			W->WriteValue(TEXT("mirrorWestFromEast"), bMirrorWestFromEast);

			W->WriteArrayStart(TEXT("framesByDirection"));
			for (int32 d = 0; d < kNumDirections; ++d)
			{
				W->WriteArrayStart();
				const TArray<const FFrameEntry*>& DirFrames = Dirs[d];
				for (const FFrameEntry* EP : DirFrames)
				{
					const int32* Idx = IndexMap.Find(MakeTuple(EP->Action, EP->DirectionIdx, EP->FrameIdx));
					W->WriteObjectStart();
					W->WriteValue(TEXT("atlasIndex"), Idx ? *Idx : 0);
					W->WriteValue(TEXT("pivotX"), static_cast<float>(CellW) * 0.5f);
					W->WriteValue(TEXT("pivotY"), static_cast<float>(CellH));
					W->WriteObjectEnd();
				}
				W->WriteArrayEnd();
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

FString UHktSpriteGeneratorFunctionLibrary::EditorBuildSpritePartFromDirectory(
	const FString& Tag, const FString& Slot, const FString& InputDir,
	const FString& OutputDir, float PixelToWorld, float FrameDurationMs,
	bool bLooping, bool bMirrorWestFromEast)
{
	using namespace HktSpriteGen;

	if (Tag.IsEmpty() || Slot.IsEmpty() || InputDir.IsEmpty())
	{
		return MakeSpriteError(TEXT("Tag / Slot / InputDir 필수"));
	}

	// 1. 디렉터리 스캔
	TArray<FFrameEntry> Frames;
	FString ScanError;
	if (!ScanDirectory(InputDir, Frames, ScanError))
	{
		return MakeSpriteError(ScanError);
	}

	// 2. Atlas PNG 출력 경로 — {ProjectSavedDir}/SpriteGenerator/{Tag_safe}.png
	const FString SafeTag = SanitizeForAssetName(Tag);
	const FString OutDir  = FPaths::ProjectSavedDir() / TEXT("SpriteGenerator");
	IFileManager::Get().MakeDirectory(*OutDir, /*Tree*/ true);
	const FString AtlasPng = OutDir / (SafeTag + TEXT(".png"));

	// 3. 패킹
	int32 CellW = 0, CellH = 0, Cols = 0, Rows = 0;
	TMap<TTuple<FString,int32,int32>, int32> IndexMap;
	FString PackError;
	if (!PackAtlas(Frames, AtlasPng, CellW, CellH, Cols, Rows, IndexMap, PackError))
	{
		return MakeSpriteError(PackError);
	}

	// 4. JsonSpec 빌드 + 기존 McpBuildSpritePart 재사용
	const FString Spec = BuildSpecJson(Tag, Slot, AtlasPng, CellW, CellH, PixelToWorld,
	                                   OutputDir, Frames, IndexMap,
	                                   FrameDurationMs, bLooping, bMirrorWestFromEast);

	UE_LOG(LogHktSpriteGenerator, Log, TEXT("EditorBuild: %d frames → Cell=%dx%d Grid=%dx%d"),
		Frames.Num(), CellW, CellH, Cols, Rows);

	return McpBuildSpritePart(Spec);
}
