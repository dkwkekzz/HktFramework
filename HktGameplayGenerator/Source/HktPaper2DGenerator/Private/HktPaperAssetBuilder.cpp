// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPaperAssetBuilder.h"
#include "HktPaperUnlitMaterial.h"
#include "HktPaperWorkspaceScanner.h"
#include "HktPaper2DGeneratorLog.h"

#include "HktPaperCharacterTemplate.h"
#include "HktPaperActorVisualDataAsset.h"
#include "HktSpritePaperActor.h"
#include "HktSpriteGeneratorFunctionLibrary.h"

#include "PaperSprite.h"
#include "PaperFlipbook.h"
#include "SpriteEditorOnlyTypes.h"

#include "Engine/Texture2D.h"
#include "Materials/MaterialInterface.h"
#include "Factories/TextureFactory.h"

#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Misc/PackageName.h"
#include "HAL/FileManager.h"
#include "UObject/Package.h"
#include "UObject/SavePackage.h"
#include "UObject/UObjectGlobals.h"
#include "AssetRegistry/AssetRegistryModule.h"

namespace HktPaperAssetBuilder
{
	// ----------------------------------------------------------------------------
	// 헬퍼
	// ----------------------------------------------------------------------------
	FString SanitizeForAssetName(const FString& In)
	{
		FString Out;
		Out.Reserve(In.Len());
		for (TCHAR Ch : In)
		{
			const bool bAlnum  = (Ch >= TCHAR('0') && Ch <= TCHAR('9'))
				|| (Ch >= TCHAR('A') && Ch <= TCHAR('Z'))
				|| (Ch >= TCHAR('a') && Ch <= TCHAR('z'));
			const bool bAllow  = (Ch == TCHAR('_'));
			Out.AppendChar((bAlnum || bAllow) ? Ch : TCHAR('_'));
		}
		while (Out.RemoveFromStart(TEXT("_"))) {}
		while (Out.RemoveFromEnd(TEXT("_")))   {}
		return Out.IsEmpty() ? TEXT("Unnamed") : Out;
	}

	bool SaveDataAsset(UObject* Asset)
	{
		if (!Asset) return false;
		UPackage* Pkg = Asset->GetPackage();
		if (!Pkg) return false;

		Pkg->MarkPackageDirty();
		FAssetRegistryModule::AssetCreated(Asset);

		const FString PackageName     = Pkg->GetName();
		const FString PackageFileName = FPackageName::LongPackageNameToFilename(
			PackageName, FPackageName::GetAssetPackageExtension());

		FSavePackageArgs SaveArgs;
		SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
		SaveArgs.SaveFlags     = SAVE_NoError;
		SaveArgs.Error         = GLog;

		const bool bSaved = UPackage::SavePackage(Pkg, Asset, *PackageFileName, SaveArgs);
		if (!bSaved)
		{
			UE_LOG(LogHktPaper2DGenerator, Warning,
				TEXT("[HktPaperAssetBuilder] SavePackage 실패: %s"), *PackageFileName);
		}
		return bSaved;
	}

	// ----------------------------------------------------------------------------
	// PNG → UTexture2D 임포트
	// ----------------------------------------------------------------------------
	UTexture2D* ImportAtlasTexture(const FString& PngPath, const FString& PackagePath, const FString& AssetName)
	{
		if (!FPaths::FileExists(PngPath))
		{
			UE_LOG(LogHktPaper2DGenerator, Warning,
				TEXT("[ImportAtlasTexture] PNG 없음: %s"), *PngPath);
			return nullptr;
		}

		TArray<uint8> Bytes;
		if (!FFileHelper::LoadFileToArray(Bytes, *PngPath) || Bytes.Num() == 0)
		{
			UE_LOG(LogHktPaper2DGenerator, Warning,
				TEXT("[ImportAtlasTexture] 파일 로드 실패: %s"), *PngPath);
			return nullptr;
		}

		UPackage* Pkg = CreatePackage(*PackagePath);
		if (!Pkg) return nullptr;
		Pkg->FullyLoad();

		UTextureFactory* Factory = NewObject<UTextureFactory>();
		Factory->AddToRoot();
		Factory->NoAlpha       = false;
		Factory->bUseHashAsGuid = true;

		const uint8* BufBegin = Bytes.GetData();
		const uint8* BufEnd   = BufBegin + Bytes.Num();
		const FString Ext     = FPaths::GetExtension(PngPath); // "png"

		UObject* Imported = Factory->FactoryCreateBinary(
			UTexture2D::StaticClass(), Pkg, FName(*AssetName),
			RF_Public | RF_Standalone, nullptr,
			*Ext, BufBegin, BufEnd, GWarn);
		Factory->RemoveFromRoot();

		UTexture2D* Tex = Cast<UTexture2D>(Imported);
		if (!Tex)
		{
			UE_LOG(LogHktPaper2DGenerator, Warning,
				TEXT("[ImportAtlasTexture] 임포트 실패: %s → %s"), *PngPath, *PackagePath);
			return nullptr;
		}

		// Paper2D 픽셀 아트 표준 설정.
		Tex->CompressionSettings = TC_EditorIcon; // BGRA8 — 픽셀 아트 손실 0
		Tex->Filter              = TF_Nearest;
		Tex->MipGenSettings      = TMGS_NoMipmaps;
		Tex->LODGroup            = TEXTUREGROUP_Pixels2D;
		Tex->SRGB                = true;
		Tex->UpdateResource();

		FAssetRegistryModule::AssetCreated(Tex);
		Pkg->MarkPackageDirty();

		const FString PackageFileName = FPackageName::LongPackageNameToFilename(
			PackagePath, FPackageName::GetAssetPackageExtension());

		FSavePackageArgs SaveArgs;
		SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
		SaveArgs.SaveFlags     = SAVE_NoError;
		SaveArgs.Error         = GLog;
		UPackage::SavePackage(Pkg, Tex, *PackageFileName, SaveArgs);

		return Tex;
	}

	// ----------------------------------------------------------------------------
	// UPaperSprite 1 개 빌드 (atlas 의 단일 cell)
	// ----------------------------------------------------------------------------
	static UPaperSprite* BuildSprite(
		UPackage* Pkg,
		const FString& AssetName,
		UTexture2D* AtlasTex,
		int32 OriginX, int32 OriginY,
		int32 CellW, int32 CellH,
		float PixelToWorld,
		UMaterialInterface* Material)
	{
		UPaperSprite* Sprite = NewObject<UPaperSprite>(
			Pkg, FName(*AssetName), RF_Public | RF_Standalone);

		FSpriteAssetInitParameters InitParams;
		InitParams.SetTextureAndFill(
			AtlasTex,
			FVector2D(OriginX, OriginY),
			FVector2D(CellW, CellH));
		Sprite->InitializeSprite(InitParams);

		// 머티리얼은 PR-2 의 `AHktSpritePaperActor` 가 `UPaperFlipbookComponent::SetMaterial`
		// 로 직접 적용 (M_HktPaperUnlit). 자산 자체엔 기록 X — 사용자가 에디터에서 다른
		// 머티리얼로 swap 하기 쉽게.
		(void)Material;

		// 피벗 = 셀 하단 중앙 (캐릭터 발 기준). Custom pivot 좌표는 텍스처 공간 절대값 —
		// 셀 origin 을 더해 atlas 안에서의 절대 픽셀 위치로 지정.
		Sprite->SetPivotMode(
			ESpritePivotMode::Custom,
			FVector2D(OriginX + CellW * 0.5f, OriginY + CellH));

		// 1 픽셀 = PixelToWorld cm — UPaperSprite::PixelsPerUnrealUnit 은 그 역수.
		if (PixelToWorld > KINDA_SMALL_NUMBER)
		{
			Sprite->PixelsPerUnrealUnit = 1.f / PixelToWorld;
		}

		Sprite->PostEditChange();
		return Sprite;
	}

	// ----------------------------------------------------------------------------
	// 한 dir 의 atlas → Sprite N + Flipbook 1 빌드 (in-place)
	// ----------------------------------------------------------------------------
	UPaperFlipbook* BuildDirFlipbook(
		UTexture2D* AtlasTex,
		const FString& OutputPackageDir,
		const FString& BaseAssetName,
		int32 CellW, int32 CellH,
		int32 FrameCount,
		float PixelToWorld,
		float FrameDurationMs)
	{
		if (!AtlasTex || CellW <= 0 || CellH <= 0 || FrameCount <= 0)
		{
			return nullptr;
		}

		// Sprite 들은 자기 패키지에 둔다 (Flipbook 패키지는 별도) — 에디터에서 개별 swap 용이.
		// 머티리얼은 PR-2 액터에서 적용하므로 여기서는 nullptr 전달.
		UMaterialInterface* Material = nullptr;
		const FString FlipbookPackagePath = OutputPackageDir / FString::Printf(TEXT("PFB_%s"), *BaseAssetName);
		UPackage* FlipbookPkg = CreatePackage(*FlipbookPackagePath);
		if (!FlipbookPkg) return nullptr;
		FlipbookPkg->FullyLoad();

		const FName FlipbookName(*FString::Printf(TEXT("PFB_%s"), *BaseAssetName));
		UPaperFlipbook* Flipbook = FindObject<UPaperFlipbook>(FlipbookPkg, *FlipbookName.ToString());
		if (!Flipbook)
		{
			Flipbook = NewObject<UPaperFlipbook>(
				FlipbookPkg, FlipbookName, RF_Public | RF_Standalone);
		}

		// 모든 sprite 를 sprite 전용 패키지에 둔다.
		TArray<UPaperSprite*> Sprites;
		Sprites.Reserve(FrameCount);
		for (int32 i = 0; i < FrameCount; ++i)
		{
			const FString SpriteAssetName = FString::Printf(TEXT("PS_%s_%d"), *BaseAssetName, i);
			const FString SpritePackagePath = OutputPackageDir / SpriteAssetName;
			UPackage* SpritePkg = CreatePackage(*SpritePackagePath);
			if (!SpritePkg) continue;
			SpritePkg->FullyLoad();

			// 동일 이름이 이미 있으면 재생성 — 셀 좌표나 atlas 변경에 대응.
			UPaperSprite* Sprite = FindObject<UPaperSprite>(SpritePkg, *SpriteAssetName);
			if (Sprite)
			{
				Sprite->Rename(nullptr, GetTransientPackage(), REN_DontCreateRedirectors | REN_NonTransactional | REN_DoNotDirty);
				Sprite = nullptr;
			}
			Sprite = BuildSprite(
				SpritePkg, SpriteAssetName, AtlasTex,
				/*OriginX*/ i * CellW, /*OriginY*/ 0,
				CellW, CellH, PixelToWorld, Material);

			FAssetRegistryModule::AssetCreated(Sprite);
			SpritePkg->MarkPackageDirty();

			const FString SpriteFile = FPackageName::LongPackageNameToFilename(
				SpritePackagePath, FPackageName::GetAssetPackageExtension());
			FSavePackageArgs SaveArgs;
			SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
			SaveArgs.SaveFlags     = SAVE_NoError;
			SaveArgs.Error         = GLog;
			UPackage::SavePackage(SpritePkg, Sprite, *SpriteFile, SaveArgs);

			Sprites.Add(Sprite);
		}

		// Flipbook KeyFrames 채우기 — FScopedFlipbookMutator 가 dirty 처리.
		{
			FScopedFlipbookMutator Mutator(Flipbook);
			Mutator.KeyFrames.Reset();
			for (UPaperSprite* Sprite : Sprites)
			{
				FPaperFlipbookKeyFrame KF;
				KF.Sprite   = Sprite;
				KF.FrameRun = 1;
				Mutator.KeyFrames.Add(KF);
			}
			Mutator.FramesPerSecond = (FrameDurationMs > 0.f) ? (1000.f / FrameDurationMs) : 10.f;
		}

		FAssetRegistryModule::AssetCreated(Flipbook);
		FlipbookPkg->MarkPackageDirty();

		const FString FlipbookFile = FPackageName::LongPackageNameToFilename(
			FlipbookPackagePath, FPackageName::GetAssetPackageExtension());
		FSavePackageArgs SaveArgs;
		SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
		SaveArgs.SaveFlags     = SAVE_NoError;
		SaveArgs.Error         = GLog;
		UPackage::SavePackage(FlipbookPkg, Flipbook, *FlipbookFile, SaveArgs);

		return Flipbook;
	}

	// ----------------------------------------------------------------------------
	// Template / Visual upsert
	// ----------------------------------------------------------------------------
	UHktPaperCharacterTemplate* LoadOrCreateTemplate(
		const FString& OutputPackageDir,
		const FString& SafeCharName,
		float PixelToWorld)
	{
		const FString AssetName    = FString::Printf(TEXT("DA_PaperCharacter_%s"), *SafeCharName);
		const FString PackagePath  = OutputPackageDir / AssetName;
		const FString ObjectPath   = PackagePath + TEXT(".") + AssetName;

		if (UHktPaperCharacterTemplate* Existing = LoadObject<UHktPaperCharacterTemplate>(nullptr, *ObjectPath))
		{
			Existing->PixelToWorld = PixelToWorld;
			return Existing;
		}

		UPackage* Pkg = CreatePackage(*PackagePath);
		if (!Pkg) return nullptr;
		Pkg->FullyLoad();
		UHktPaperCharacterTemplate* Template = NewObject<UHktPaperCharacterTemplate>(
			Pkg, FName(*AssetName), RF_Public | RF_Standalone);
		Template->PixelToWorld = PixelToWorld;
		return Template;
	}

	UHktPaperActorVisualDataAsset* LoadOrCreateVisual(
		const FString& OutputPackageDir,
		const FString& SafeCharName,
		const FGameplayTag& IdentifierTag,
		UHktPaperCharacterTemplate* Template)
	{
		const FString AssetName    = FString::Printf(TEXT("DA_PaperVisual_%s"), *SafeCharName);
		const FString PackagePath  = OutputPackageDir / AssetName;
		const FString ObjectPath   = PackagePath + TEXT(".") + AssetName;

		UHktPaperActorVisualDataAsset* Visual = LoadObject<UHktPaperActorVisualDataAsset>(nullptr, *ObjectPath);
		if (!Visual)
		{
			UPackage* Pkg = CreatePackage(*PackagePath);
			if (!Pkg) return nullptr;
			Pkg->FullyLoad();
			Visual = NewObject<UHktPaperActorVisualDataAsset>(
				Pkg, FName(*AssetName), RF_Public | RF_Standalone);
		}

		// IdentifierTag 는 부모 UHktTagDataAsset 의 protected/public field — 직접 set.
		// (UHktActorVisualDataAsset 도 같은 필드를 EditDefaultsOnly 로 노출.)
		Visual->IdentifierTag = IdentifierTag;
		Visual->Animation     = Template;
		Visual->ActorClass    = AHktSpritePaperActor::StaticClass();

		return Visual;
	}

	// ----------------------------------------------------------------------------
	// (Char, Anim) 빌드 — Workspace 의 atlas_{Dir}.png 를 모두 읽어 처리
	// ----------------------------------------------------------------------------
	FBuildAnimResult BuildAnim(
		const FString& CharacterTagStr,
		const FString& AnimTagStr,
		const FString& OutputPackageDir,
		float PixelToWorld,
		float FrameDurationMs,
		bool bLooping,
		bool bMirrorWestFromEast,
		int32 CellWidthOverride,
		int32 CellHeightOverride)
	{
		FBuildAnimResult Result;
		Result.AnimTag = FGameplayTag::RequestGameplayTag(FName(*AnimTagStr), /*ErrorIfNotFound*/false);
		if (!Result.AnimTag.IsValid())
		{
			Result.Error = FString::Printf(TEXT("AnimTag(%s) 등록 안됨"), *AnimTagStr);
			return Result;
		}

		const FString SafeChar = SanitizeForAssetName(CharacterTagStr);
		const FString SafeAnim = SanitizeForAssetName(AnimTagStr);

		// Stage 2 가 남긴 atlas_meta.json — 셀 크기/프레임 수 폴백.
		const FString AnimDir = UHktSpriteGeneratorFunctionLibrary::GetConventionBundleDir(
			CharacterTagStr, AnimTagStr);
		const FString MetaPath = AnimDir / TEXT("atlas_meta.json");
		TArray<HktPaperWorkspace::FDirMeta> MetaDirs;
		HktPaperWorkspace::LoadAtlasMeta(MetaPath, MetaDirs);
		TMap<int32, HktPaperWorkspace::FDirMeta> MetaByDir;
		for (const HktPaperWorkspace::FDirMeta& M : MetaDirs)
		{
			MetaByDir.Add(M.DirIdx, M);
		}

		// 워크스페이스 dir 발견 + Flipbook 빌드.
		struct FDirBuilt
		{
			int32 DirIdx;
			UPaperFlipbook* Flipbook;
			int32 FrameCount;
		};
		TArray<FDirBuilt> Built;

		for (int32 d = 0; d < 8; ++d)
		{
			const FString PngPath = UHktSpriteGeneratorFunctionLibrary::GetConventionDirectionalAtlasPng(
				CharacterTagStr, AnimTagStr, d);
			if (!FPaths::FileExists(PngPath))
			{
				continue;
			}

			// 미러 dir(W=6, SW=5, NW=7) 은 빌드 스킵 — 액터가 X-스케일로 처리.
			const bool bIsMirrored = bMirrorWestFromEast && (d == 5 || d == 6 || d == 7);
			if (bIsMirrored)
			{
				continue;
			}

			// 텍스처 임포트.
			const FString TexAssetName = FString::Printf(TEXT("T_PaperAtlas_%s_%s_%s"),
				*SafeChar, *SafeAnim, HktPaperWorkspace::GetDirectionName(d));
			const FString TexPackagePath = OutputPackageDir / TexAssetName;
			UTexture2D* AtlasTex = ImportAtlasTexture(PngPath, TexPackagePath, TexAssetName);
			if (!AtlasTex)
			{
				continue;
			}
			Result.AtlasAssetPaths.Add(TexPackagePath);

			// 셀 크기 우선순위: 인자 override > meta sidecar > atlas 종횡비 폴백.
			int32 UseW = CellWidthOverride;
			int32 UseH = CellHeightOverride;
			const HktPaperWorkspace::FDirMeta* DirMeta = MetaByDir.Find(d);
			if (DirMeta)
			{
				if (UseW <= 0) UseW = DirMeta->CellW;
				if (UseH <= 0) UseH = DirMeta->CellH;
			}
			const int32 AtlasW = AtlasTex->GetSizeX();
			const int32 AtlasH = AtlasTex->GetSizeY();
			if (UseH <= 0) UseH = AtlasH;
			if (UseW <= 0)
			{
				int32 Frames = DirMeta ? DirMeta->FrameCount : 0;
				if (Frames <= 0 && AtlasH > 0) Frames = FMath::Max(1, AtlasW / AtlasH);
				UseW = (Frames > 0) ? FMath::Max(1, AtlasW / Frames) : AtlasW;
			}
			if (UseW <= 0 || UseH <= 0)
			{
				UE_LOG(LogHktPaper2DGenerator, Warning,
					TEXT("[BuildAnim] Dir=%s 셀 크기 추론 실패 (Atlas=%dx%d)"),
					HktPaperWorkspace::GetDirectionName(d), AtlasW, AtlasH);
				continue;
			}
			// frameCount 정수 검증.
			if (AtlasW % UseW != 0)
			{
				UE_LOG(LogHktPaper2DGenerator, Warning,
					TEXT("[BuildAnim] Dir=%s AtlasW(%d) %% CellW(%d) != 0 — 마지막 cell 잘림"),
					HktPaperWorkspace::GetDirectionName(d), AtlasW, UseW);
			}
			const int32 FrameCount = FMath::Max(1, AtlasW / UseW);

			const FString FlipbookBase = FString::Printf(TEXT("%s_%s_%s"),
				*SafeChar, *SafeAnim, HktPaperWorkspace::GetDirectionName(d));
			UPaperFlipbook* Flipbook = BuildDirFlipbook(
				AtlasTex, OutputPackageDir, FlipbookBase,
				UseW, UseH, FrameCount, PixelToWorld, FrameDurationMs);
			if (!Flipbook)
			{
				continue;
			}

			FDirBuilt Entry;
			Entry.DirIdx     = d;
			Entry.Flipbook   = Flipbook;
			Entry.FrameCount = FrameCount;
			Built.Add(Entry);

			Result.FlipbookAssetPaths.Add(OutputPackageDir / FString::Printf(TEXT("PFB_%s"), *FlipbookBase));
			if (Result.FramesPerDir == 0)
			{
				Result.FramesPerDir = FrameCount;
			}
		}

		if (Built.IsEmpty())
		{
			Result.Error = FString::Printf(
				TEXT("Workspace 에 atlas_{Dir}.png 가 없음 (char=%s, anim=%s) — Stage 2 (Atlas Pack) 먼저 실행"),
				*CharacterTagStr, *AnimTagStr);
			return Result;
		}

		// 양자화 — 1 / 5 / 8.
		// (미러 dir 은 빌드 안 했으므로 발견된 non-mirror dir 수로 결정 — N(0), NE(1), E(2), SE(3), S(4))
		int32 NumDir = 8;
		if (Built.Num() == 1)
		{
			NumDir = 1;
		}
		else if (Built.Num() <= 5)
		{
			NumDir = 5;
		}
		Result.NumDirections = NumDir;

		// Template / Visual upsert.
		UHktPaperCharacterTemplate* Template = LoadOrCreateTemplate(OutputPackageDir, SafeChar, PixelToWorld);
		if (!Template)
		{
			Result.Error = TEXT("Template 자산 생성 실패");
			return Result;
		}

		FHktPaperAnimMeta Meta;
		Meta.NumDirections        = NumDir;
		Meta.FrameDurationMs      = FrameDurationMs;
		Meta.bLooping             = bLooping;
		Meta.bMirrorWestFromEast  = bMirrorWestFromEast;
		Meta.Tint                 = FLinearColor::White;
		Meta.Scale                = FVector2f(1.f, 1.f);
		Template->Animations.Add(Result.AnimTag, Meta);

		for (const FDirBuilt& B : Built)
		{
			FHktPaperAnimDirKey Key;
			Key.AnimTag = Result.AnimTag;
			Key.DirIdx  = static_cast<uint8>(B.DirIdx);
			Template->Flipbooks.Add(Key, B.Flipbook);
		}

		// DefaultAnimTag 가 비어 있으면 첫 빌드의 anim 으로.
		if (!Template->DefaultAnimTag.IsValid())
		{
			Template->DefaultAnimTag = Result.AnimTag;
		}

		SaveDataAsset(Template);

		Result.bSuccess = true;
		return Result;
	}
}
