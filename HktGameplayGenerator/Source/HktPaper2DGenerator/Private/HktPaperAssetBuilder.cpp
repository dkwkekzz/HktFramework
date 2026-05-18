// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPaperAssetBuilder.h"
#include "HktPaperUnlitMaterial.h"
#include "HktPaper2DGeneratorLog.h"

#include "HktPaperAnimationDataAsset.h"   // FHktPaperAnimDirKey / FHktPaperAnimMeta / UHktPaperAnimationDataAsset
#include "HktPaperActorVisualDataAsset.h"
#include "HktSpritePaperActor.h"

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
#include "HAL/IConsoleManager.h"
#include "UObject/Package.h"
#include "UObject/SavePackage.h"
#include "UObject/UObjectGlobals.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "UObject/MetaData.h"
#include "Misc/SecureHash.h"

// ----------------------------------------------------------------------------
// 콘솔 변수 — Sprite 임베드 (PR-5)
// ----------------------------------------------------------------------------
//
// 캐릭터 1명 = Animations × Directions × FramesPerDir 개의 UPaperSprite. 8 × 6 × 10
// = 480 개 — 미러 절약(8→5) 적용해도 캐릭터당 수백 개의 디스크 자산이 생긴다.
// EmbedSpritesInFlipbook=1 이면 sprite 의 Outer 를 Flipbook 패키지로 두어 Flipbook
// 자산의 inner subobject 로 만든다 → sprite 별도 디스크 자산 0, AssetRegistry 항목
// N분의 1.
//
// 트레이드오프:
//   - 에디터에서 sprite 를 Content Browser 로 직접 swap 하기는 불편 (일반적으로
//     불필요 — Paper2D 워크플로우는 sprite asset 직접 편집이 드물다).
//   - 같은 atlas 의 sprite 를 다른 flipbook 이 공유할 수 없음 (본 빌더는 dir 별로
//     별개 atlas + 별개 flipbook 이라 공유 사례 없음).
//
// 기본값 0 (검증 모드) — PS_* 가 Content Browser 에 별도 자산으로 노출되어 Sprite Editor
// 로 SourceUV/SourceDimension/BakedRenderData 를 직접 확인 가능. cell 단위 자르기가
// 정상 동작함을 검증한 뒤 1 로 올려 디스크 절감 효과를 누린다.
//   0 → 각 sprite 별 별도 패키지(.uasset) 생성 (검증/디폴트)
//   1 → UPaperSprite 를 UPaperFlipbook 패키지의 inner subobject 로 임베드 (별도 디스크 자산 X)
static TAutoConsoleVariable<int32> CVarHktPaperEmbedSprites(
	TEXT("hkt.PaperSprite.EmbedSpritesInFlipbook"),
	1,
	TEXT("0=각 sprite 별 별도 패키지(.uasset) 생성 — Content Browser 노출 (디폴트, 검증 용이). ")
	TEXT("1=UPaperSprite 를 UPaperFlipbook 패키지의 inner subobject 로 임베드 ")
	TEXT("(별도 디스크 자산 생성 안 함 — 디스크 폭증 완화)."),
	ECVF_Default);

namespace HktPaperAssetBuilder
{
	// ----------------------------------------------------------------------------
	// 8 방향 이름 — 워크스페이스 컨벤션과 일치 (HktWorkspaceConventions::GetDirectionName).
	// 본 모듈은 HktWorkspaceGenerator 헤더에 의존하지 않도록 로컬 사본을 둔다.
	// ----------------------------------------------------------------------------
	static const TCHAR* GetDirectionName(int32 DirIdx)
	{
		static const TCHAR* const Names[8] = {
			TEXT("N"), TEXT("NE"), TEXT("E"), TEXT("SE"),
			TEXT("S"), TEXT("SW"), TEXT("W"), TEXT("NW")
		};
		return Names[FMath::Clamp(DirIdx, 0, 7)];
	}

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
	// PNG → UTexture2D 임포트 (소스 해시 비교 → 미변경 시 재임포트 스킵)
	// ----------------------------------------------------------------------------
	//
	// 텍스처 자산 패키지에 소스 PNG 의 SHA1 을 메타데이터로 저장한다 (`HktSourceHash`).
	// 동일 PNG 로 재빌드 시 해시가 일치하면 `FactoryCreateBinary` 자체를 호출하지 않아
	// 1) "Overwrite assets?" 다이얼로그 회피, 2) 임포트/컴파일 비용 0, 3) Content Browser
	// thumbnail 캐시 무효화 0.
	//
	// 해시는 PNG 바이트 그대로(메타 변경 없이) 계산 — 픽셀 데이터가 정확히 같으면 재임포트
	// 불필요. 픽셀 아트 워크플로우 특성상 정확 일치 케이스가 절대 다수.
	static const FName kSourceHashMetaKey(TEXT("HktSourceHash"));

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

		// 소스 해시 — PNG 바이트 SHA1.
		const FString SourceHash = FSHA1::HashBuffer(Bytes.GetData(), Bytes.Num()).ToString();

		// 기존 자산이 있고 해시가 일치하면 재임포트 스킵.
		const FString ObjectPath = PackagePath + TEXT(".") + AssetName;
		if (UTexture2D* Existing = LoadObject<UTexture2D>(nullptr, *ObjectPath))
		{
			if (UPackage* ExistingPkg = Existing->GetPackage())
			{
				FMetaData& MetaData = ExistingPkg->GetMetaData();
				const FString PrevHash = MetaData.GetValue(Existing, kSourceHashMetaKey);
				if (!PrevHash.IsEmpty() && PrevHash == SourceHash)
				{
					UE_LOG(LogHktPaper2DGenerator, Verbose,
						TEXT("[ImportAtlasTexture] 소스 미변경 — 재임포트 스킵: %s (hash=%s)"),
						*PackagePath, *SourceHash);
					return Existing;
				}
			}
		}

		UPackage* Pkg = CreatePackage(*PackagePath);
		if (!Pkg) return nullptr;
		Pkg->FullyLoad();

		UTextureFactory* Factory = NewObject<UTextureFactory>();
		Factory->AddToRoot();
		Factory->NoAlpha       = false;
		Factory->bUseHashAsGuid = true;
		// 자동화 임포트 — "기존 자산 덮어쓰시겠습니까?" 모달 다이얼로그 억제.
		// 빌더는 항상 in-place 갱신이 의도이며, 사용자 확인이 필요한 상황이 아니다.
		// (소스 미변경 케이스는 위쪽 해시 비교로 이미 스킵됨.)
		Factory->SuppressImportOverwriteDialog();

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

		// 다음 빌드의 스킵 비교용 — 소스 PNG 의 SHA1 을 메타데이터에 저장.
		{
			FMetaData& MetaData = Pkg->GetMetaData();
			MetaData.SetValue(Tex, kSourceHashMetaKey, *SourceHash);
		}

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
		UMaterialInterface* Material,
		bool bStandaloneTopLevel)
	{
		// PR-5: 임베드 모드(bStandaloneTopLevel=false)에서는 RF_Standalone 을 제외 —
		// sprite 는 flipbook 의 inner subobject 라 top-level 자산이 아니다. flipbook 의
		// KeyFrames TArray 가 strong reference 라 GC 보존은 자동.
		const EObjectFlags Flags = bStandaloneTopLevel
			? (RF_Public | RF_Standalone)
			: RF_Public;
		UPaperSprite* Sprite = NewObject<UPaperSprite>(
			Pkg, FName(*AssetName), Flags);

		// UE 5.7: SetTextureAndFill 은 1-인자 (전체 텍스처)만 지원. atlas 의 cell 부분
		// 영역을 가리키려면 Texture/Offset/Dimension 을 직접 지정. 시퀀스는 엔진 정식
		// 패턴(PaperSpriteFactory / PaperJsonSpriteSheetImporter) 을 따른다:
		//   1) InitializeSprite(bRebuildData=false)
		//   2) SetTrim(false, ..., bRebuildData=false)
		//   3) SetPivotMode(..., bRebuildData=false)
		//   4) 마지막에 RebuildData() 한 번
		// PostEditChange() 는 호출하지 않는다 — bRebuilAtlas 경로가 BakedSourceTexture/UV/
		// Dimension 을 일순간 0 으로 만들어 atlas 전체가 셀로 잡히는 사고가 발생한다.
		FSpriteAssetInitParameters InitParams;
		InitParams.Texture   = AtlasTex;
		InitParams.Offset    = FIntPoint(OriginX, OriginY);
		InitParams.Dimension = FIntPoint(CellW, CellH);

		// 1 픽셀 = PixelToWorld cm — UPaperSprite::PixelsPerUnrealUnit 은 그 역수.
		// (PixelsPerUnrealUnit 멤버는 protected — InitParams 경유로만 설정 가능.)
		if (PixelToWorld > KINDA_SMALL_NUMBER)
		{
			InitParams.SetPixelsPerUnrealUnit(1.f / PixelToWorld);
		}

		Sprite->InitializeSprite(InitParams, /*bRebuildData=*/false);

		// 트림은 사용 안 함 — 명시 false 로 박아 둬야 cell 영역 외 잔여 데이터가 안 섞인다.
		Sprite->SetTrim(false, FVector2D::ZeroVector, FVector2D(CellW, CellH), /*bRebuildData=*/false);

		// 머티리얼은 PR-2 의 `AHktSpritePaperActor` 가 `UPaperFlipbookComponent::SetMaterial`
		// 로 직접 적용 (M_HktPaperUnlit). 자산 자체엔 기록 X — 사용자가 에디터에서 다른
		// 머티리얼로 swap 하기 쉽게.
		(void)Material;

		// 피벗 = 셀 하단 중앙 (캐릭터 발 기준). Custom pivot 좌표는 텍스처 공간 절대값 —
		// 셀 origin 을 더해 atlas 안에서의 절대 픽셀 위치로 지정.
		Sprite->SetPivotMode(
			ESpritePivotMode::Custom,
			FVector2D(OriginX + CellW * 0.5f, OriginY + CellH),
			/*bRebuildData=*/false);

		Sprite->RebuildData();
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
		int32 Cols,
		int32 FrameCount,
		float PixelToWorld,
		float FrameDurationMs)
	{
		if (!AtlasTex || CellW <= 0 || CellH <= 0 || FrameCount <= 0)
		{
			return nullptr;
		}
		// Cols<=0 폴백 — 단일 행 가정 (FrameCount 만큼 가로로 정렬).
		if (Cols <= 0) Cols = FrameCount;

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

		// PR-5: 임베드 모드면 sprite 의 Outer 를 Flipbook 패키지로 두어 별도 디스크 자산
		// 생성 자체를 회피. 0(legacy) 이면 dir 의 각 sprite 를 별도 패키지로 저장.
		const bool bEmbedSprites = CVarHktPaperEmbedSprites.GetValueOnAnyThread() != 0;

		TArray<UPaperSprite*> Sprites;
		Sprites.Reserve(FrameCount);
		for (int32 i = 0; i < FrameCount; ++i)
		{
			const FString SpriteAssetName = FString::Printf(TEXT("PS_%s_%d"), *BaseAssetName, i);

			UPackage* SpritePkg     = bEmbedSprites ? FlipbookPkg : nullptr;
			FString   SpritePkgPath = bEmbedSprites ? FlipbookPackagePath : (OutputPackageDir / SpriteAssetName);
			if (!bEmbedSprites)
			{
				SpritePkg = CreatePackage(*SpritePkgPath);
				if (!SpritePkg) continue;
				SpritePkg->FullyLoad();
			}

			// 동일 이름이 이미 있으면 재생성 — 셀 좌표나 atlas 변경에 대응.
			UPaperSprite* Sprite = FindObject<UPaperSprite>(SpritePkg, *SpriteAssetName);
			if (Sprite)
			{
				Sprite->Rename(nullptr, GetTransientPackage(), REN_DontCreateRedirectors | REN_NonTransactional | REN_DoNotDirty);
				Sprite = nullptr;
			}
			const int32 Col = i % Cols;
			const int32 Row = i / Cols;
			Sprite = BuildSprite(
				SpritePkg, SpriteAssetName, AtlasTex,
				/*OriginX*/ Col * CellW, /*OriginY*/ Row * CellH,
				CellW, CellH, PixelToWorld, Material,
				/*bStandaloneTopLevel*/ !bEmbedSprites);

			if (!bEmbedSprites)
			{
				FAssetRegistryModule::AssetCreated(Sprite);
				SpritePkg->MarkPackageDirty();

				const FString SpriteFile = FPackageName::LongPackageNameToFilename(
					SpritePkgPath, FPackageName::GetAssetPackageExtension());
				FSavePackageArgs SaveArgs;
				SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
				SaveArgs.SaveFlags     = SAVE_NoError;
				SaveArgs.Error         = GLog;
				UPackage::SavePackage(SpritePkg, Sprite, *SpriteFile, SaveArgs);
			}

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
	UHktPaperAnimationDataAsset* LoadOrCreateAnimation(
		const FString& OutputPackageDir,
		const FString& SafeCharName,
		float PixelToWorld)
	{
		const FString AssetName    = FString::Printf(TEXT("DA_PaperAnimation_%s"), *SafeCharName);
		const FString PackagePath  = OutputPackageDir / AssetName;
		const FString ObjectPath   = PackagePath + TEXT(".") + AssetName;

		if (UHktPaperAnimationDataAsset* Existing = LoadObject<UHktPaperAnimationDataAsset>(nullptr, *ObjectPath))
		{
			Existing->PixelToWorld = PixelToWorld;
			return Existing;
		}

		UPackage* Pkg = CreatePackage(*PackagePath);
		if (!Pkg) return nullptr;
		Pkg->FullyLoad();
		UHktPaperAnimationDataAsset* Anim = NewObject<UHktPaperAnimationDataAsset>(
			Pkg, FName(*AssetName), RF_Public | RF_Standalone);
		Anim->PixelToWorld = PixelToWorld;
		return Anim;
	}

	UHktPaperActorVisualDataAsset* LoadOrCreateVisual(
		const FString& OutputPackageDir,
		const FString& SafeCharName,
		const FGameplayTag& IdentifierTag,
		UHktPaperAnimationDataAsset* Animation)
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
		Visual->IdentifierTag  = IdentifierTag;
		Visual->AnimationAsset = Animation;
		Visual->ActorClass     = AHktSpritePaperActor::StaticClass();

		return Visual;
	}

	// ----------------------------------------------------------------------------
	// (Char, Anim) 빌드 — 호출자가 전달한 AtlasInputs(Dir / PNG / cell / frame)로 처리
	// ----------------------------------------------------------------------------
	FBuildAnimResult BuildAnim(
		const FString& CharacterTagStr,
		const FString& AnimTagStr,
		const FString& OutputPackageDir,
		const TArray<FAnimAtlasInput>& AtlasInputs,
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

		// 호출자가 워크스페이스에서 직접 수집한 atlas 입력들로 빌드.
		struct FDirBuilt
		{
			int32 DirIdx;
			UPaperFlipbook* Flipbook;
			int32 FrameCount;
		};
		TArray<FDirBuilt> Built;

		for (const FAnimAtlasInput& In : AtlasInputs)
		{
			const int32 d = FMath::Clamp(In.DirIdx, 0, 7);

			if (!FPaths::FileExists(In.PngPath))
			{
				UE_LOG(LogHktPaper2DGenerator, Warning,
					TEXT("[BuildAnim] AtlasInput PNG 없음 dir=%s path=%s"),
					GetDirectionName(d), *In.PngPath);
				continue;
			}

			// 미러 dir(SW=5, NW=7) 은 빌드 스킵 — 액터가 X-스케일로 처리.
			// W(=6) 는 2방향 모드에서 좌향 전용 아트로 쓰일 수 있으므로 입력에 있으면 빌드.
			const bool bIsMirrored = bMirrorWestFromEast && (d == 5 || d == 7);
			if (bIsMirrored)
			{
				continue;
			}

			// 텍스처 임포트.
			const FString TexAssetName = FString::Printf(TEXT("T_PaperAtlas_%s_%s_%s"),
				*SafeChar, *SafeAnim, GetDirectionName(d));
			const FString TexPackagePath = OutputPackageDir / TexAssetName;
			UTexture2D* AtlasTex = ImportAtlasTexture(In.PngPath, TexPackagePath, TexAssetName);
			if (!AtlasTex)
			{
				continue;
			}
			Result.AtlasAssetPaths.Add(TexPackagePath);

			// 셀 크기 우선순위: AtlasInput(워크스페이스 사이드카) > 인자 override > 종횡비 폴백.
			int32 UseW = In.CellW;
			int32 UseH = In.CellH;
			if (UseW <= 0) UseW = CellWidthOverride;
			if (UseH <= 0) UseH = CellHeightOverride;

			const int32 AtlasW = AtlasTex->GetSizeX();
			const int32 AtlasH = AtlasTex->GetSizeY();
			// 사이드카(anim_meta.json) 가 없거나 cellW/cellH 가 0 인 경우, atlas 종횡비로 셀 크기를
			// 무리하게 추정하지 않는다. 추정이 빗나가면 sprite 1개짜리 flipbook 이 묵묵히 만들어져
			// "재생 안 됨" 으로 늦게 발견됨. 명확히 빌드 실패시켜 즉시 사이드카 작성 유도.
			if (UseW <= 0 || UseH <= 0)
			{
				const FString Msg = FString::Printf(
					TEXT("Dir=%s 셀 크기 미정 (Atlas=%dx%d). anim_meta.json 에 cellW/cellH 명시 필요"),
					GetDirectionName(d), AtlasW, AtlasH);
				UE_LOG(LogHktPaper2DGenerator, Warning, TEXT("[BuildAnim] %s"), *Msg);
				if (Result.Error.IsEmpty()) Result.Error = Msg;
				continue;
			}
			if (AtlasW % UseW != 0)
			{
				UE_LOG(LogHktPaper2DGenerator, Warning,
					TEXT("[BuildAnim] Dir=%s AtlasW(%d) %% CellW(%d) != 0 — 마지막 cell 잘림"),
					GetDirectionName(d), AtlasW, UseW);
			}
			if (AtlasH % UseH != 0)
			{
				UE_LOG(LogHktPaper2DGenerator, Warning,
					TEXT("[BuildAnim] Dir=%s AtlasH(%d) %% CellH(%d) != 0 — 마지막 row 잘림"),
					GetDirectionName(d), AtlasH, UseH);
			}

			const int32 Cols = FMath::Max(1, AtlasW / UseW);
			const int32 Rows = FMath::Max(1, AtlasH / UseH);
			const int32 GridCount  = Cols * Rows;
			const int32 InFrames   = (In.FrameCount > 0) ? In.FrameCount : 0;
			const int32 FrameCount = (InFrames > 0)
				? FMath::Clamp(InFrames, 1, GridCount)
				: GridCount;

			const FString FlipbookBase = FString::Printf(TEXT("%s_%s_%s"),
				*SafeChar, *SafeAnim, GetDirectionName(d));
			UPaperFlipbook* Flipbook = BuildDirFlipbook(
				AtlasTex, OutputPackageDir, FlipbookBase,
				UseW, UseH, Cols, FrameCount, PixelToWorld, FrameDurationMs);
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
				TEXT("AtlasInputs 비어있음/모두 무효 (char=%s, anim=%s)"),
				*CharacterTagStr, *AnimTagStr);
			return Result;
		}

		// 양자화 — 1 / 2 / 5 / 8.
		// 발견된 source DirIdx 집합으로 결정:
		//   {E}            → 2 (단일 방향이지만 mirror 로 좌향 처리 — slot 0=E)
		//   {E, W}         → 2 (slot 0=E, 1=W)
		//   1 개 (E 외)    → 1 (slot 0 만 사용)
		//   N..S(0..4)     → 5
		//   그 외          → 8
		auto BuiltHas = [&Built](int32 D)
		{
			return Built.ContainsByPredicate([D](const FDirBuilt& B){ return B.DirIdx == D; });
		};
		const bool bBuiltHasE = BuiltHas(2);
		const bool bBuiltHasW = BuiltHas(6);
		const bool bOnlyEW = bBuiltHasE
			&& !BuiltHas(0) && !BuiltHas(1) && !BuiltHas(3)
			&& !BuiltHas(4) && !BuiltHas(5) && !BuiltHas(7);

		int32 NumDir;
		if (bOnlyEW)
		{
			NumDir = 2;
		}
		else if (Built.Num() == 1)
		{
			NumDir = 1;
		}
		else if (Built.Num() <= 5)
		{
			NumDir = 5;
		}
		else
		{
			NumDir = 8;
		}
		Result.NumDirections = NumDir;

		// source DirIdx → slot 인덱스 매핑 (런타임 ResolveStoredFacing 의 반환값 규약과 일치).
		auto SourceDirToSlot = [NumDir](int32 SrcDir) -> int32
		{
			switch (NumDir)
			{
				case 1: return 0;                     // 단일 슬롯
				case 2: return (SrcDir == 6) ? 1 : 0; // 0=E, 1=W
				case 5: return SrcDir;                // 0..4 = N..S
				case 8: default: return SrcDir;       // 0..7 그대로
			}
		};

		// Animation / Visual upsert.
		UHktPaperAnimationDataAsset* Template = LoadOrCreateAnimation(OutputPackageDir, SafeChar, PixelToWorld);
		if (!Template)
		{
			Result.Error = TEXT("Animation 자산 생성 실패");
			return Result;
		}

		FHktPaperAnimMeta Meta;
		Meta.NumDirections        = NumDir;
		Meta.FrameDurationMs      = FrameDurationMs;
		Meta.bLooping             = bLooping;
		// 2방향: W 슬롯 부재 시에만 mirror (있으면 좌향 전용 아트). 그 외는 입력 플래그 그대로.
		Meta.bMirrorWestFromEast  = (NumDir == 2)
			? !bBuiltHasW
			: bMirrorWestFromEast;
		Meta.Tint                 = FLinearColor::White;
		Meta.Scale                = FVector2f(1.f, 1.f);
		Template->Animations.Add(Result.AnimTag, Meta);

		// 같은 anim 의 stale 키 제거 — 이전 빌드가 다른 NumDir 에서 등록한 키가 남아 있으면
		// 런타임 룩업이 잘못된 슬롯에 매칭될 수 있다 (예: 5→1 로 줄였을 때 (anim,2) 잔존).
		for (auto It = Template->Flipbooks.CreateIterator(); It; ++It)
		{
			if (It.Key().AnimTag == Result.AnimTag) It.RemoveCurrent();
		}

		// 빌드 시점에 (AnimTag, slotIdx) → Flipbook 매핑. 키의 DirIdx 는 source 가 아니라
		// **slot 인덱스** — 런타임 ResolveStoredFacing 반환값과 1:1 매칭됨.
		for (const FDirBuilt& B : Built)
		{
			const int32 SlotIdx = SourceDirToSlot(B.DirIdx);

			FHktPaperAnimDirKey Key;
			Key.AnimTag = Result.AnimTag;
			Key.DirIdx  = static_cast<uint8>(SlotIdx);
			Template->Flipbooks.Add(Key, B.Flipbook);

			UE_LOG(LogHktPaper2DGenerator, Log,
				TEXT("[BuildAnim] Flipbooks.Add anim=%s, Slot=%u (source=%s), FB=%s, frames=%d"),
				*Result.AnimTag.ToString(), Key.DirIdx,
				GetDirectionName(B.DirIdx),
				*GetNameSafe(B.Flipbook), B.FrameCount);
		}

		// 누적된 Template->Flipbooks 의 anim 별 키 분포 요약 — 이전 빌드 잔존 키도 포함.
		{
			TArray<uint8> DirsForThisAnim;
			for (const TPair<FHktPaperAnimDirKey, TObjectPtr<UPaperFlipbook>>& Pair : Template->Flipbooks)
			{
				if (Pair.Key.AnimTag == Result.AnimTag)
				{
					DirsForThisAnim.Add(Pair.Key.DirIdx);
				}
			}
			DirsForThisAnim.Sort();
			FString DirList;
			for (uint8 D : DirsForThisAnim)
			{
				DirList += FString::Printf(TEXT("%u(%s) "), D, GetDirectionName(D));
			}
			UE_LOG(LogHktPaper2DGenerator, Log,
				TEXT("[BuildAnim] Template Flipbooks summary anim=%s NumDir=%d bMirror=%d → keys=[%s] (Built=%d)"),
				*Result.AnimTag.ToString(), Meta.NumDirections, Meta.bMirrorWestFromEast ? 1 : 0,
				*DirList, Built.Num());
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
