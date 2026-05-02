// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPaperUnlitMaterialBuilder.h"
#include "HktPaper2DGeneratorLog.h"

#include "HktPaperUnlitMaterial.h"  // HktSpriteCore 의 상수·런타임 로더 공유

#include "Materials/Material.h"
#include "Materials/MaterialInterface.h"
#include "Materials/MaterialExpressionTextureSampleParameter2D.h"
#include "Materials/MaterialExpressionParticleColor.h"
#include "Materials/MaterialExpressionMultiply.h"
#include "Materials/MaterialExpressionComponentMask.h"
#include "Engine/Texture2D.h"

#include "UObject/Package.h"
#include "UObject/SavePackage.h"
#include "Misc/PackageName.h"
#include "HAL/FileManager.h"
#include "AssetRegistry/AssetRegistryModule.h"

namespace
{
	// ----------------------------------------------------------------------------
	// Paper2D 표준 Unlit 머티리얼 그래프:
	//     SpriteTexture (param "Texture") → BaseColor & OpacityMask
	//     ParticleColor (Tint via UPaperFlipbookComponent::SetSpriteColor)
	//
	//     BaseColor   = SpriteTex.RGB * ParticleColor.RGB
	//     OpacityMask = SpriteTex.A   * ParticleColor.A
	//
	//   - bUsedWithSprite = true  (Paper2D 호환 필수 — 누락 시 셰이더 컴파일 거부)
	//   - Blend = Masked, ClipValue = 0.5 (UE 기본 Sprite 머티리얼과 동일)
	//   - TwoSided = true, Unlit
	// ----------------------------------------------------------------------------
	UMaterial* ConstructMaterial(UPackage* Outer)
	{
		UMaterial* Mat = NewObject<UMaterial>(
			Outer, HktPaperUnlitMaterial::MaterialName, RF_Public | RF_Standalone);

		Mat->SetShadingModel(MSM_Unlit);
		Mat->BlendMode             = BLEND_Masked;
		Mat->TwoSided              = true;
		Mat->bUsedWithStaticLighting = false;
		Mat->DitheredLODTransition = false;
		Mat->OpacityMaskClipValue  = 0.5f;

		// Paper2D 컴포넌트 호환 플래그 — UPaperFlipbookComponent 가 사용할 머티리얼은
		// 반드시 bUsedWithSprite 가 켜져 있어야 한다 (UE 머티리얼 컴파일러가 검증).
		Mat->bUsedWithSprites = true;

		// Texture 파라미터 — UPaperSprite 의 BaseTexture 와 동일한 이름 ("Texture")
		// 이어야 Paper2D 가 자동으로 sprite atlas 를 바인딩한다.
		UMaterialExpressionTextureSampleParameter2D* TexSample =
			NewObject<UMaterialExpressionTextureSampleParameter2D>(Mat);
		TexSample->ParameterName = HktPaperUnlitMaterial::TextureParamName;
		// 마스터 컴파일 시점 디폴트 텍스처가 NULL 이면 SM6 컴파일이 실패한다.
		TexSample->Texture = LoadObject<UTexture2D>(nullptr,
			TEXT("/Engine/EngineResources/WhiteSquareTexture.WhiteSquareTexture"));
		TexSample->SamplerType = SAMPLERTYPE_Color;
		Mat->GetExpressionCollection().AddExpression(TexSample);

		// ParticleColor — UPaperFlipbookComponent::SetSpriteColor 가 자동 바인딩.
		UMaterialExpressionParticleColor* ParticleColor =
			NewObject<UMaterialExpressionParticleColor>(Mat);
		Mat->GetExpressionCollection().AddExpression(ParticleColor);

		// BaseColor = SpriteTex.RGB * ParticleColor.RGB
		UMaterialExpressionMultiply* BaseColorMul = NewObject<UMaterialExpressionMultiply>(Mat);
		BaseColorMul->A.Connect(0, TexSample);     // RGB
		BaseColorMul->B.Connect(0, ParticleColor); // RGB
		Mat->GetExpressionCollection().AddExpression(BaseColorMul);

		// OpacityMask = SpriteTex.A * ParticleColor.A
		UMaterialExpressionMultiply* AlphaMul = NewObject<UMaterialExpressionMultiply>(Mat);
		AlphaMul->A.Connect(4, TexSample);     // A 채널 (output index 4)
		AlphaMul->B.Connect(4, ParticleColor); // A 채널
		Mat->GetExpressionCollection().AddExpression(AlphaMul);

		Mat->GetEditorOnlyData()->EmissiveColor.Connect(0, BaseColorMul);
		Mat->GetEditorOnlyData()->OpacityMask.Connect(0, AlphaMul);

		Mat->PostEditChange();
		return Mat;
	}
}

namespace HktPaperUnlitMaterialBuilder
{
	bool Exists()
	{
		const FString PackageFileName = FPackageName::LongPackageNameToFilename(
			HktPaperUnlitMaterial::PackagePath, FPackageName::GetAssetPackageExtension());
		return IFileManager::Get().FileExists(*PackageFileName);
	}

	UMaterialInterface* BuildAndSave(bool bForceOverwrite)
	{
		const FString PackageName = HktPaperUnlitMaterial::PackagePath;

		if (!bForceOverwrite && Exists())
		{
			UE_LOG(LogHktPaper2DGenerator, Verbose,
				TEXT("[HktPaperUnlitMaterialBuilder] 에셋이 이미 존재한다 — 스킵: %s"), *PackageName);
			return HktPaperUnlitMaterial::GetDefault();
		}

		UPackage* Pkg = CreatePackage(*PackageName);
		if (!Pkg)
		{
			UE_LOG(LogHktPaper2DGenerator, Error,
				TEXT("[HktPaperUnlitMaterialBuilder] CreatePackage 실패: %s"), *PackageName);
			return nullptr;
		}

		UMaterial* Mat = ConstructMaterial(Pkg);
		if (!Mat)
		{
			UE_LOG(LogHktPaper2DGenerator, Error,
				TEXT("[HktPaperUnlitMaterialBuilder] Material 생성 실패"));
			return nullptr;
		}

		FAssetRegistryModule::AssetCreated(Mat);
		Pkg->MarkPackageDirty();

		const FString PackageFileName = FPackageName::LongPackageNameToFilename(
			PackageName, FPackageName::GetAssetPackageExtension());

		FSavePackageArgs SaveArgs;
		SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
		SaveArgs.SaveFlags     = SAVE_NoError;
		SaveArgs.Error         = GLog;

		const bool bSaved = UPackage::SavePackage(Pkg, Mat, *PackageFileName, SaveArgs);
		if (!bSaved)
		{
			UE_LOG(LogHktPaper2DGenerator, Warning,
				TEXT("[HktPaperUnlitMaterialBuilder] SavePackage 실패: %s"), *PackageFileName);
		}
		else
		{
			UE_LOG(LogHktPaper2DGenerator, Log,
				TEXT("[HktPaperUnlitMaterialBuilder] Paper2D Unlit 머티리얼 저장: %s"), *PackageFileName);
		}
		return Mat;
	}
}
