// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteBillboardMaterialBuilder.h"
#include "HktSpriteBillboardMaterial.h"  // HktSpriteCore의 상수·런타임 로더 공유
#include "HktSpriteCoreLog.h"

#include "Materials/Material.h"
#include "Materials/MaterialInterface.h"
#include "Materials/MaterialExpressionCustom.h"
#include "Materials/MaterialExpressionMultiply.h"
#include "Materials/MaterialExpressionTextureSampleParameter2D.h"
#include "Materials/MaterialExpressionVectorParameter.h"
#include "Materials/MaterialExpressionComponentMask.h"
#include "Materials/MaterialExpressionTextureCoordinate.h"

#include "UObject/Package.h"
#include "UObject/SavePackage.h"
#include "Misc/PackageName.h"
#include "HAL/FileManager.h"
#include "AssetRegistry/AssetRegistryModule.h"

namespace
{
	// ----------------------------------------------------------------------------
	// WPO (Vertex Shader) HLSL — Y-axis 빌보드
	// ----------------------------------------------------------------------------
	const TCHAR* kWPOCode = TEXT(R"(
		float OffX     = GetPerInstanceCustomData(Parameters, 4, 0.0);
		float OffY     = GetPerInstanceCustomData(Parameters, 5, 0.0);
		float RotR     = GetPerInstanceCustomData(Parameters, 6, 0.0);
		float ScaleX   = GetPerInstanceCustomData(Parameters, 7, 50.0);
		float ScaleY   = GetPerInstanceCustomData(Parameters, 8, 50.0);
		float FlipV    = GetPerInstanceCustomData(Parameters, 14, 0.0);
		float ZBiasV   = GetPerInstanceCustomData(Parameters, 15, 0.0);

		float flipSign = FlipV > 0.5 ? -1.0 : 1.0;
		float2 Quad;
		Quad.x = (InTexCoord.x * 2.0 - 1.0) * flipSign;
		Quad.y = (1.0 - InTexCoord.y) * 2.0;

		float cs = cos(RotR);
		float sn = sin(RotR);
		float2 RotQuad;
		RotQuad.x = cs * Quad.x - sn * Quad.y;
		RotQuad.y = sn * Quad.x + cs * Quad.y;

		float2 PlanePos = RotQuad * float2(ScaleX, ScaleY) + float2(OffX, OffY);

		float3 ObjPos = GetObjectWorldPosition(Parameters);
		float3 CamPos = ResolvedView.WorldCameraOrigin;
		float2 ToCamH = CamPos.xy - ObjPos.xy;
		float lenSq = dot(ToCamH, ToCamH);
		float2 CamDir = lenSq > 1e-6 ? ToCamH * rsqrt(lenSq) : float2(0.0, -1.0);
		float3 RightDir = float3(-CamDir.y, CamDir.x, 0.0);
		float3 UpDir    = float3(0.0, 0.0, 1.0);

		float3 BillboardWS = ObjPos + RightDir * PlanePos.x + UpDir * PlanePos.y;

		float3 ToCamN = normalize(CamPos - BillboardWS);
		BillboardWS += ToCamN * (ZBiasV * 0.1);

		float3 AbsWS = GetWorldPosition(Parameters);
		return BillboardWS - AbsWS;
	)");

	// ----------------------------------------------------------------------------
	// UV (Pixel Shader) HLSL — AtlasIndex + Cell size + Atlas size → 최종 UV
	// ----------------------------------------------------------------------------
	const TCHAR* kUVCode = TEXT(R"(
		float AtlasIdx = GetPerInstanceCustomData(Parameters, 0, 0.0);
		float CellW    = GetPerInstanceCustomData(Parameters, 1, 64.0);
		float CellH    = GetPerInstanceCustomData(Parameters, 2, 64.0);
		float FlipV    = GetPerInstanceCustomData(Parameters, 14, 0.0);

		float2 AtlasPx = max(InAtlasSize, float2(1.0, 1.0));
		float CellsPerRow = max(floor(AtlasPx.x / max(CellW, 1.0)), 1.0);

		int idx = (int)(AtlasIdx + 0.5);
		float cellCol = (float)(idx - (int)(floor((float)idx / CellsPerRow) * CellsPerRow));
		float cellRow = floor((float)idx / CellsPerRow);

		float localU = FlipV > 0.5 ? (1.0 - InTexCoord.x) : InTexCoord.x;

		float2 OriginUV = float2(cellCol * CellW, cellRow * CellH) / AtlasPx;
		float2 SizeUV   = float2(CellW, CellH) / AtlasPx;
		return OriginUV + float2(localU, InTexCoord.y) * SizeUV;
	)");

	// ----------------------------------------------------------------------------
	// Tint (Pixel Shader) HLSL — CPD 9..12 → float4
	// ----------------------------------------------------------------------------
	const TCHAR* kTintCode = TEXT(R"(
		float TR = GetPerInstanceCustomData(Parameters, 9,  1.0);
		float TG = GetPerInstanceCustomData(Parameters, 10, 1.0);
		float TB = GetPerInstanceCustomData(Parameters, 11, 1.0);
		float TA = GetPerInstanceCustomData(Parameters, 12, 1.0);
		return float4(TR, TG, TB, TA);
	)");

	UMaterialExpressionCustom* MakeCustomExpr(UMaterial* Mat,
		const TCHAR* Description, const TCHAR* Code, ECustomMaterialOutputType OutputType)
	{
		UMaterialExpressionCustom* Expr = NewObject<UMaterialExpressionCustom>(Mat);
		Expr->Description = Description;
		Expr->Code        = Code;
		Expr->OutputType  = OutputType;
		Mat->GetExpressionCollection().AddExpression(Expr);
		return Expr;
	}

	// ----------------------------------------------------------------------------
	// 머티리얼 그래프 구성 — 소유 패키지(`Outer`) 하위에 `UMaterial`을 생성하고
	// 모든 표현식을 연결해 반환.
	// ----------------------------------------------------------------------------
	UMaterial* ConstructMaterial(UPackage* Outer)
	{
		UMaterial* Mat = NewObject<UMaterial>(
			Outer, HktSpriteBillboardMaterial::MaterialName, RF_Public | RF_Standalone);

		Mat->SetShadingModel(MSM_Unlit);
		Mat->BlendMode                        = BLEND_Masked;
		Mat->TwoSided                         = true;
		Mat->bUsedWithInstancedStaticMeshes   = true;
		Mat->bUsedWithStaticLighting          = false;
		Mat->DitheredLODTransition            = false;
		Mat->OpacityMaskClipValue             = 0.333f;

		// UV 노드
		UMaterialExpressionCustom* UVExpr = MakeCustomExpr(
			Mat, TEXT("HktSprite UV"), kUVCode, CMOT_Float2);
		UVExpr->Inputs.Reset();
		{
			FCustomInput UvIn;  UvIn.InputName = TEXT("InTexCoord");   UVExpr->Inputs.Add(UvIn);
			FCustomInput SzIn;  SzIn.InputName = TEXT("InAtlasSize");  UVExpr->Inputs.Add(SzIn);
		}

		UMaterialExpressionTextureCoordinate* TexCoordExpr =
			NewObject<UMaterialExpressionTextureCoordinate>(Mat);
		TexCoordExpr->CoordinateIndex = 0;
		Mat->GetExpressionCollection().AddExpression(TexCoordExpr);

		UMaterialExpressionVectorParameter* AtlasSizeParam =
			NewObject<UMaterialExpressionVectorParameter>(Mat);
		AtlasSizeParam->ParameterName = HktSpriteBillboardMaterial::AtlasSizeParamName;
		AtlasSizeParam->DefaultValue  = FLinearColor(1024.f, 1024.f, 0.f, 0.f);
		Mat->GetExpressionCollection().AddExpression(AtlasSizeParam);

		UMaterialExpressionComponentMask* AtlasSizeXY = NewObject<UMaterialExpressionComponentMask>(Mat);
		AtlasSizeXY->R = 1; AtlasSizeXY->G = 1; AtlasSizeXY->B = 0; AtlasSizeXY->A = 0;
		AtlasSizeXY->Input.Connect(0, AtlasSizeParam);
		Mat->GetExpressionCollection().AddExpression(AtlasSizeXY);

		UVExpr->Inputs[0].Input.Connect(0, TexCoordExpr);
		UVExpr->Inputs[1].Input.Connect(0, AtlasSizeXY);

		// Atlas 텍스처 파라미터 + 샘플
		UMaterialExpressionTextureSampleParameter2D* AtlasSample =
			NewObject<UMaterialExpressionTextureSampleParameter2D>(Mat);
		AtlasSample->ParameterName = HktSpriteBillboardMaterial::AtlasParamName;
		AtlasSample->Texture       = nullptr;
		AtlasSample->SamplerType   = SAMPLERTYPE_Color;
		AtlasSample->Coordinates.Connect(0, UVExpr);
		Mat->GetExpressionCollection().AddExpression(AtlasSample);

		// Tint
		UMaterialExpressionCustom* TintExpr = MakeCustomExpr(
			Mat, TEXT("HktSprite Tint"), kTintCode, CMOT_Float4);

		UMaterialExpressionComponentMask* TintRGB = NewObject<UMaterialExpressionComponentMask>(Mat);
		TintRGB->R = 1; TintRGB->G = 1; TintRGB->B = 1; TintRGB->A = 0;
		TintRGB->Input.Connect(0, TintExpr);
		Mat->GetExpressionCollection().AddExpression(TintRGB);

		UMaterialExpressionComponentMask* TintA = NewObject<UMaterialExpressionComponentMask>(Mat);
		TintA->R = 0; TintA->G = 0; TintA->B = 0; TintA->A = 1;
		TintA->Input.Connect(0, TintExpr);
		Mat->GetExpressionCollection().AddExpression(TintA);

		UMaterialExpressionMultiply* ColorMul = NewObject<UMaterialExpressionMultiply>(Mat);
		ColorMul->A.Connect(0, AtlasSample);
		ColorMul->B.Connect(0, TintRGB);
		Mat->GetExpressionCollection().AddExpression(ColorMul);

		UMaterialExpressionMultiply* AlphaMul = NewObject<UMaterialExpressionMultiply>(Mat);
		AlphaMul->A.Connect(4, AtlasSample);
		AlphaMul->B.Connect(0, TintA);
		Mat->GetExpressionCollection().AddExpression(AlphaMul);

		// WPO
		UMaterialExpressionCustom* WPOExpr = MakeCustomExpr(
			Mat, TEXT("HktSprite WPO"), kWPOCode, CMOT_Float3);
		WPOExpr->Inputs.Reset();
		{
			FCustomInput WpoIn;  WpoIn.InputName = TEXT("InTexCoord");  WPOExpr->Inputs.Add(WpoIn);
		}
		WPOExpr->Inputs[0].Input.Connect(0, TexCoordExpr);

		Mat->GetEditorOnlyData()->EmissiveColor.Connect(0, ColorMul);
		Mat->GetEditorOnlyData()->OpacityMask.Connect(0, AlphaMul);
		Mat->GetEditorOnlyData()->WorldPositionOffset.Connect(0, WPOExpr);

		Mat->PostEditChange();
		return Mat;
	}
}

namespace HktSpriteBillboardMaterialBuilder
{
	bool Exists()
	{
		const FString PackageFileName = FPackageName::LongPackageNameToFilename(
			HktSpriteBillboardMaterial::PackagePath, FPackageName::GetAssetPackageExtension());
		return IFileManager::Get().FileExists(*PackageFileName);
	}

	UMaterialInterface* BuildAndSave(bool bForceOverwrite)
	{
		const FString PackageName = HktSpriteBillboardMaterial::PackagePath;

		if (!bForceOverwrite && Exists())
		{
			UE_LOG(LogHktSpriteCore, Verbose,
				TEXT("[HktSpriteBillboardMaterialBuilder] 에셋이 이미 존재한다 — 스킵: %s"),
				*PackageName);
			// 이미 존재하는 경우 로드만 시도해 반환.
			return HktSpriteBillboardMaterial::GetDefault();
		}

		UPackage* Pkg = CreatePackage(*PackageName);
		if (!Pkg)
		{
			UE_LOG(LogHktSpriteCore, Error,
				TEXT("[HktSpriteBillboardMaterialBuilder] CreatePackage 실패: %s"), *PackageName);
			return nullptr;
		}

		UMaterial* Mat = ConstructMaterial(Pkg);
		if (!Mat)
		{
			UE_LOG(LogHktSpriteCore, Error,
				TEXT("[HktSpriteBillboardMaterialBuilder] Material 생성 실패"));
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
			UE_LOG(LogHktSpriteCore, Warning,
				TEXT("[HktSpriteBillboardMaterialBuilder] SavePackage 실패: %s"), *PackageFileName);
		}
		else
		{
			UE_LOG(LogHktSpriteCore, Log,
				TEXT("[HktSpriteBillboardMaterialBuilder] Y-axis 빌보드 머티리얼 저장: %s"), *PackageFileName);
		}
		return Mat;
	}
}
