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
#include "Materials/MaterialExpressionPerInstanceCustomData.h"
#include "Engine/Texture2D.h"

#include "UObject/Package.h"
#include "UObject/SavePackage.h"
#include "Misc/PackageName.h"
#include "HAL/FileManager.h"
#include "AssetRegistry/AssetRegistryModule.h"

namespace
{
	// ----------------------------------------------------------------------------
	// WPO (Vertex Shader) HLSL — Y-axis 빌보드
	// CPD 값들은 외부 PerInstanceCustomData 노드에서 입력 인자로 받는다.
	// (Custom HLSL 안의 GetPerInstanceCustomData() 호출은 컴파일러가 ISM 용도로
	//  감지하지 못해 bUsesPerInstanceCustomData 플래그가 안 켜진다.)
	// ----------------------------------------------------------------------------
	const TCHAR* kWPOCode = TEXT(R"(
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

		// UE5.7 LWC: GetObjectWorldPosition은 FLWCVector3, ResolvedView.WorldCameraOrigin은
		// FDFVector3를 리턴 — float3로 강제 demote 필요. 빌보드는 카메라 가까운 영역이므로
		// 정밀도 손실은 무시 가능.
		float3 ObjPos = LWCToFloat(GetObjectWorldPosition(Parameters));
		float3 CamPos = DFHackToFloat(ResolvedView.WorldCameraOrigin);
		float2 ToCamH = CamPos.xy - ObjPos.xy;
		float lenSq = dot(ToCamH, ToCamH);
		float2 CamDir = lenSq > 1e-6 ? ToCamH * rsqrt(lenSq) : float2(0.0, -1.0);
		float3 RightDir = float3(-CamDir.y, CamDir.x, 0.0);
		float3 UpDir    = float3(0.0, 0.0, 1.0);

		float3 BillboardWS = ObjPos + RightDir * PlanePos.x + UpDir * PlanePos.y;

		float3 ToCamN = normalize(CamPos - BillboardWS);
		BillboardWS += ToCamN * (ZBiasV * 0.1);

		float3 AbsWS = LWCToFloat(GetWorldPosition(Parameters));
		return BillboardWS - AbsWS;
	)");

	// ----------------------------------------------------------------------------
	// UV (Pixel Shader) HLSL — AtlasIndex + Cell size + Atlas size → 최종 UV
	// AtlasIdx/CellW/CellH/FlipV 는 외부 PerInstanceCustomData 노드에서 입력으로 받는다.
	// ----------------------------------------------------------------------------
	const TCHAR* kUVCode = TEXT(R"(
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
	// Tint (Pixel Shader) HLSL — CPD 9..12 입력 → float4
	// ----------------------------------------------------------------------------
	const TCHAR* kTintCode = TEXT(R"(
		return float4(TR, TG, TB, TA);
	)");

	// ----------------------------------------------------------------------------
	// PerInstanceCustomData 노드 헬퍼 — 슬롯/디폴트 지정해 생성 후 그래프에 추가.
	// 이 노드를 그래프에 두어야 머티리얼 컴파일러가 bUsesPerInstanceCustomData 를
	// 켜고, 셰이더에 CPD 버퍼 바인딩을 만든다.
	// ----------------------------------------------------------------------------
	UMaterialExpressionPerInstanceCustomData* MakeCPD(UMaterial* Mat, int32 SlotIndex, float DefaultValue)
	{
		UMaterialExpressionPerInstanceCustomData* Node = NewObject<UMaterialExpressionPerInstanceCustomData>(Mat);
		Node->DataIndex        = SlotIndex;
		Node->ConstDefaultValue = DefaultValue;
		Mat->GetExpressionCollection().AddExpression(Node);
		return Node;
	}

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

		// --- 공통 PerInstanceCustomData 노드들 ---
		// 컴파일러가 이 노드를 보고 bUsesPerInstanceCustomData 를 켜야 셰이더에
		// CPD 버퍼가 바인딩된다. Custom HLSL 의 GetPerInstanceCustomData() 호출만으로는
		// 인식되지 않으므로 반드시 이 expression 노드를 통해야 한다.
		UMaterialExpressionPerInstanceCustomData* CPD_AtlasIdx = MakeCPD(Mat, 0,  0.f);
		UMaterialExpressionPerInstanceCustomData* CPD_CellW    = MakeCPD(Mat, 1,  64.f);
		UMaterialExpressionPerInstanceCustomData* CPD_CellH    = MakeCPD(Mat, 2,  64.f);
		UMaterialExpressionPerInstanceCustomData* CPD_OffX     = MakeCPD(Mat, 4,  0.f);
		UMaterialExpressionPerInstanceCustomData* CPD_OffY     = MakeCPD(Mat, 5,  0.f);
		UMaterialExpressionPerInstanceCustomData* CPD_RotR     = MakeCPD(Mat, 6,  0.f);
		UMaterialExpressionPerInstanceCustomData* CPD_ScaleX   = MakeCPD(Mat, 7,  50.f);
		UMaterialExpressionPerInstanceCustomData* CPD_ScaleY   = MakeCPD(Mat, 8,  50.f);
		UMaterialExpressionPerInstanceCustomData* CPD_TR       = MakeCPD(Mat, 9,  1.f);
		UMaterialExpressionPerInstanceCustomData* CPD_TG       = MakeCPD(Mat, 10, 1.f);
		UMaterialExpressionPerInstanceCustomData* CPD_TB       = MakeCPD(Mat, 11, 1.f);
		UMaterialExpressionPerInstanceCustomData* CPD_TA       = MakeCPD(Mat, 12, 1.f);
		UMaterialExpressionPerInstanceCustomData* CPD_FlipV    = MakeCPD(Mat, 14, 0.f);
		UMaterialExpressionPerInstanceCustomData* CPD_ZBiasV   = MakeCPD(Mat, 15, 0.f);

		// UV 노드 — InTexCoord, InAtlasSize + CPD 입력 4개
		UMaterialExpressionCustom* UVExpr = MakeCustomExpr(
			Mat, TEXT("HktSprite UV"), kUVCode, CMOT_Float2);
		UVExpr->Inputs.Reset();
		{
			FCustomInput UvIn;       UvIn.InputName       = TEXT("InTexCoord");   UVExpr->Inputs.Add(UvIn);
			FCustomInput SzIn;       SzIn.InputName       = TEXT("InAtlasSize");  UVExpr->Inputs.Add(SzIn);
			FCustomInput AtlasIdxIn; AtlasIdxIn.InputName = TEXT("AtlasIdx");     UVExpr->Inputs.Add(AtlasIdxIn);
			FCustomInput CellWIn;    CellWIn.InputName    = TEXT("CellW");        UVExpr->Inputs.Add(CellWIn);
			FCustomInput CellHIn;    CellHIn.InputName    = TEXT("CellH");        UVExpr->Inputs.Add(CellHIn);
			FCustomInput FlipVIn;    FlipVIn.InputName    = TEXT("FlipV");        UVExpr->Inputs.Add(FlipVIn);
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
		UVExpr->Inputs[2].Input.Connect(0, CPD_AtlasIdx);
		UVExpr->Inputs[3].Input.Connect(0, CPD_CellW);
		UVExpr->Inputs[4].Input.Connect(0, CPD_CellH);
		UVExpr->Inputs[5].Input.Connect(0, CPD_FlipV);

		// Atlas 텍스처 파라미터 + 샘플
		UMaterialExpressionTextureSampleParameter2D* AtlasSample =
			NewObject<UMaterialExpressionTextureSampleParameter2D>(Mat);
		AtlasSample->ParameterName = HktSpriteBillboardMaterial::AtlasParamName;
		// 마스터 컴파일 시점에 디폴트 텍스처가 NULL 이면 SM6 셰이더 컴파일이 실패한다
		// (`Param2D> Found NULL, requires Texture2D`). 런타임에는 MID 가
		// SetTextureParameterValue로 실제 아틀라스로 덮어쓰므로 이 디폴트는 컴파일용.
		AtlasSample->Texture       = LoadObject<UTexture2D>(nullptr,
			TEXT("/Engine/EngineResources/WhiteSquareTexture.WhiteSquareTexture"));
		AtlasSample->SamplerType   = SAMPLERTYPE_Color;
		AtlasSample->Coordinates.Connect(0, UVExpr);
		Mat->GetExpressionCollection().AddExpression(AtlasSample);

		// Tint — CPD 4개 입력
		UMaterialExpressionCustom* TintExpr = MakeCustomExpr(
			Mat, TEXT("HktSprite Tint"), kTintCode, CMOT_Float4);
		TintExpr->Inputs.Reset();
		{
			FCustomInput TRIn; TRIn.InputName = TEXT("TR"); TintExpr->Inputs.Add(TRIn);
			FCustomInput TGIn; TGIn.InputName = TEXT("TG"); TintExpr->Inputs.Add(TGIn);
			FCustomInput TBIn; TBIn.InputName = TEXT("TB"); TintExpr->Inputs.Add(TBIn);
			FCustomInput TAIn; TAIn.InputName = TEXT("TA"); TintExpr->Inputs.Add(TAIn);
		}
		TintExpr->Inputs[0].Input.Connect(0, CPD_TR);
		TintExpr->Inputs[1].Input.Connect(0, CPD_TG);
		TintExpr->Inputs[2].Input.Connect(0, CPD_TB);
		TintExpr->Inputs[3].Input.Connect(0, CPD_TA);

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

		// WPO — InTexCoord + CPD 7개 입력
		UMaterialExpressionCustom* WPOExpr = MakeCustomExpr(
			Mat, TEXT("HktSprite WPO"), kWPOCode, CMOT_Float3);
		WPOExpr->Inputs.Reset();
		{
			FCustomInput WpoIn;     WpoIn.InputName     = TEXT("InTexCoord"); WPOExpr->Inputs.Add(WpoIn);
			FCustomInput OffXIn;    OffXIn.InputName    = TEXT("OffX");       WPOExpr->Inputs.Add(OffXIn);
			FCustomInput OffYIn;    OffYIn.InputName    = TEXT("OffY");       WPOExpr->Inputs.Add(OffYIn);
			FCustomInput RotRIn;    RotRIn.InputName    = TEXT("RotR");       WPOExpr->Inputs.Add(RotRIn);
			FCustomInput ScaleXIn;  ScaleXIn.InputName  = TEXT("ScaleX");     WPOExpr->Inputs.Add(ScaleXIn);
			FCustomInput ScaleYIn;  ScaleYIn.InputName  = TEXT("ScaleY");     WPOExpr->Inputs.Add(ScaleYIn);
			FCustomInput FlipVIn;   FlipVIn.InputName   = TEXT("FlipV");      WPOExpr->Inputs.Add(FlipVIn);
			FCustomInput ZBiasVIn;  ZBiasVIn.InputName  = TEXT("ZBiasV");     WPOExpr->Inputs.Add(ZBiasVIn);
		}
		WPOExpr->Inputs[0].Input.Connect(0, TexCoordExpr);
		WPOExpr->Inputs[1].Input.Connect(0, CPD_OffX);
		WPOExpr->Inputs[2].Input.Connect(0, CPD_OffY);
		WPOExpr->Inputs[3].Input.Connect(0, CPD_RotR);
		WPOExpr->Inputs[4].Input.Connect(0, CPD_ScaleX);
		WPOExpr->Inputs[5].Input.Connect(0, CPD_ScaleY);
		WPOExpr->Inputs[6].Input.Connect(0, CPD_FlipV);
		WPOExpr->Inputs[7].Input.Connect(0, CPD_ZBiasV);

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
