// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteBillboardMaterial.h"
#include "HktSpriteCoreLog.h"
#include "Materials/Material.h"
#include "Materials/MaterialInterface.h"

#if WITH_EDITORONLY_DATA
#include "Materials/MaterialExpressionCustom.h"
#include "Materials/MaterialExpressionMultiply.h"
#include "Materials/MaterialExpressionTextureSampleParameter2D.h"
#include "Materials/MaterialExpressionVectorParameter.h"
#include "Materials/MaterialExpressionComponentMask.h"
#include "Materials/MaterialExpressionTextureCoordinate.h"
#endif

namespace HktSpriteBillboardMaterial
{
	const FName AtlasParamName     = TEXT("Atlas");
	const FName AtlasSizeParamName = TEXT("AtlasSize");
}

namespace
{
#if WITH_EDITORONLY_DATA
	// ----------------------------------------------------------------------------
	// WPO (Vertex Shader) HLSL
	//
	// Y-axis 빌보드: 월드 Up(+Z) 고정, 카메라 방향에 따라 Right만 회전.
	// Custom 노드는 단일 float 인풋(InTexCoord)만 받아 월드 좌표계 WPO(float3)를 반환.
	// ----------------------------------------------------------------------------
	static const TCHAR* kWPOCode = TEXT(R"(
		float AtlasIdx = GetPerInstanceCustomData(Parameters, 0, 0.0);
		float CellW    = GetPerInstanceCustomData(Parameters, 1, 64.0);
		float CellH    = GetPerInstanceCustomData(Parameters, 2, 64.0);
		float OffX     = GetPerInstanceCustomData(Parameters, 4, 0.0);
		float OffY     = GetPerInstanceCustomData(Parameters, 5, 0.0);
		float RotR     = GetPerInstanceCustomData(Parameters, 6, 0.0);
		float ScaleX   = GetPerInstanceCustomData(Parameters, 7, 50.0);
		float ScaleY   = GetPerInstanceCustomData(Parameters, 8, 50.0);
		float FlipV    = GetPerInstanceCustomData(Parameters, 14, 0.0);
		float ZBiasV   = GetPerInstanceCustomData(Parameters, 15, 0.0);

		// 쿼드 코너 파라미터: TexCoord[0] 사용 (UV 표준: y=0 top, y=1 bottom).
		// → X ∈ [-1, 1], Y ∈ [0, 2]로 매핑 (하단-피벗).
		float flipSign = FlipV > 0.5 ? -1.0 : 1.0;
		float2 Quad;
		Quad.x = (InTexCoord.x * 2.0 - 1.0) * flipSign;
		Quad.y = (1.0 - InTexCoord.y) * 2.0;

		// 평면 내 회전 (피벗=하단 중앙, (0,0) 기준)
		float cs = cos(RotR);
		float sn = sin(RotR);
		float2 RotQuad;
		RotQuad.x = cs * Quad.x - sn * Quad.y;
		RotQuad.y = sn * Quad.x + cs * Quad.y;

		// 스케일 + 피벗 오프셋 (world units)
		float2 PlanePos = RotQuad * float2(ScaleX, ScaleY) + float2(OffX, OffY);

		// Y-axis 빌보드 기반 basis: Up=+Z, Right=카메라-수평
		float3 ObjPos = GetObjectWorldPosition(Parameters);
		float3 CamPos = ResolvedView.WorldCameraOrigin;
		float2 ToCamH = CamPos.xy - ObjPos.xy;
		float lenSq = dot(ToCamH, ToCamH);
		float2 CamDir = lenSq > 1e-6 ? ToCamH * rsqrt(lenSq) : float2(0.0, -1.0);
		float3 RightDir = float3(-CamDir.y, CamDir.x, 0.0);
		float3 UpDir    = float3(0.0, 0.0, 1.0);

		float3 BillboardWS = ObjPos + RightDir * PlanePos.x + UpDir * PlanePos.y;

		// Z-bias: 카메라 쪽으로 ZBiasV(cm) × 0.1 만큼 당김
		float3 ToCamN = normalize(CamPos - BillboardWS);
		BillboardWS += ToCamN * (ZBiasV * 0.1);

		// WPO = 목표 월드좌표 - 버텍스 원본 월드좌표
		float3 AbsWS = GetWorldPosition(Parameters);
		return BillboardWS - AbsWS;
	)");

	// ----------------------------------------------------------------------------
	// UV (Pixel Shader) HLSL — AtlasIndex + Cell size + Atlas size → 최종 UV
	// ----------------------------------------------------------------------------
	static const TCHAR* kUVCode = TEXT(R"(
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
	static const TCHAR* kTintCode = TEXT(R"(
		float TR = GetPerInstanceCustomData(Parameters, 9,  1.0);
		float TG = GetPerInstanceCustomData(Parameters, 10, 1.0);
		float TB = GetPerInstanceCustomData(Parameters, 11, 1.0);
		float TA = GetPerInstanceCustomData(Parameters, 12, 1.0);
		return float4(TR, TG, TB, TA);
	)");

	static UMaterialExpressionCustom* MakeCustomExpr(UMaterial* Mat,
		const TCHAR* Description, const TCHAR* Code, ECustomMaterialOutputType OutputType)
	{
		UMaterialExpressionCustom* Expr = NewObject<UMaterialExpressionCustom>(Mat);
		Expr->Description = Description;
		Expr->Code        = Code;
		Expr->OutputType  = OutputType;
		Mat->GetExpressionCollection().AddExpression(Expr);
		return Expr;
	}

	static UMaterialInterface* BuildDefaultMaterial()
	{
		UMaterial* Mat = NewObject<UMaterial>(
			GetTransientPackage(), TEXT("M_HktSpriteYBillboard"), RF_Transient);
		Mat->AddToRoot();

		// --- 머티리얼 기본 프로퍼티 ---
		Mat->SetShadingModel(MSM_Unlit);
		Mat->BlendMode                        = BLEND_Masked;
		Mat->TwoSided                         = true;
		Mat->bUsedWithInstancedStaticMeshes   = true;
		Mat->bUsedWithStaticLighting          = false;
		Mat->DitheredLODTransition            = false;
		Mat->OpacityMaskClipValue             = 0.333f;

		// --- UV 계산 노드 ---
		UMaterialExpressionCustom* UVExpr = MakeCustomExpr(
			Mat, TEXT("HktSprite UV"), kUVCode, CMOT_Float2);
		UVExpr->Inputs.Reset();
		{
			FCustomInput UvIn;
			UvIn.InputName = TEXT("InTexCoord");
			UVExpr->Inputs.Add(UvIn);

			FCustomInput SzIn;
			SzIn.InputName = TEXT("InAtlasSize");
			UVExpr->Inputs.Add(SzIn);
		}

		// TexCoord[0] — 엔진 노드로 VS/PS 양쪽에서 안전하게 접근.
		UMaterialExpressionTextureCoordinate* TexCoordExpr =
			NewObject<UMaterialExpressionTextureCoordinate>(Mat);
		TexCoordExpr->CoordinateIndex = 0;
		Mat->GetExpressionCollection().AddExpression(TexCoordExpr);

		// AtlasSize 벡터 파라미터 (xy = 아틀라스 픽셀 해상도)
		UMaterialExpressionVectorParameter* AtlasSizeParam =
			NewObject<UMaterialExpressionVectorParameter>(Mat);
		AtlasSizeParam->ParameterName = HktSpriteBillboardMaterial::AtlasSizeParamName;
		AtlasSizeParam->DefaultValue  = FLinearColor(1024.f, 1024.f, 0.f, 0.f);
		Mat->GetExpressionCollection().AddExpression(AtlasSizeParam);

		UMaterialExpressionComponentMask* AtlasSizeXY =
			NewObject<UMaterialExpressionComponentMask>(Mat);
		AtlasSizeXY->R = 1;
		AtlasSizeXY->G = 1;
		AtlasSizeXY->B = 0;
		AtlasSizeXY->A = 0;
		AtlasSizeXY->Input.Connect(0, AtlasSizeParam);
		Mat->GetExpressionCollection().AddExpression(AtlasSizeXY);

		UVExpr->Inputs[0].Input.Connect(0, TexCoordExpr);
		UVExpr->Inputs[1].Input.Connect(0, AtlasSizeXY);

		// --- Atlas TextureSampleParameter ---
		UMaterialExpressionTextureSampleParameter2D* AtlasSample =
			NewObject<UMaterialExpressionTextureSampleParameter2D>(Mat);
		AtlasSample->ParameterName = HktSpriteBillboardMaterial::AtlasParamName;
		AtlasSample->Texture       = nullptr; // MID에서 바인딩
		AtlasSample->SamplerType   = SAMPLERTYPE_Color;
		AtlasSample->Coordinates.Connect(0, UVExpr);
		Mat->GetExpressionCollection().AddExpression(AtlasSample);

		// --- Tint 노드 ---
		UMaterialExpressionCustom* TintExpr = MakeCustomExpr(
			Mat, TEXT("HktSprite Tint"), kTintCode, CMOT_Float4);

		// Tint.RGB
		UMaterialExpressionComponentMask* TintRGB = NewObject<UMaterialExpressionComponentMask>(Mat);
		TintRGB->R = 1; TintRGB->G = 1; TintRGB->B = 1; TintRGB->A = 0;
		TintRGB->Input.Connect(0, TintExpr);
		Mat->GetExpressionCollection().AddExpression(TintRGB);

		// Tint.A
		UMaterialExpressionComponentMask* TintA = NewObject<UMaterialExpressionComponentMask>(Mat);
		TintA->R = 0; TintA->G = 0; TintA->B = 0; TintA->A = 1;
		TintA->Input.Connect(0, TintExpr);
		Mat->GetExpressionCollection().AddExpression(TintA);

		// Texture.RGB * Tint.RGB
		UMaterialExpressionMultiply* ColorMul = NewObject<UMaterialExpressionMultiply>(Mat);
		ColorMul->A.Connect(0, AtlasSample); // TextureSample output 0 = RGB
		ColorMul->B.Connect(0, TintRGB);
		Mat->GetExpressionCollection().AddExpression(ColorMul);

		// Texture.A * Tint.A
		UMaterialExpressionMultiply* AlphaMul = NewObject<UMaterialExpressionMultiply>(Mat);
		AlphaMul->A.Connect(4, AtlasSample); // TextureSample output 4 = A
		AlphaMul->B.Connect(0, TintA);
		Mat->GetExpressionCollection().AddExpression(AlphaMul);

		// --- WPO 노드 ---
		UMaterialExpressionCustom* WPOExpr = MakeCustomExpr(
			Mat, TEXT("HktSprite WPO"), kWPOCode, CMOT_Float3);
		WPOExpr->Inputs.Reset();
		{
			FCustomInput WpoIn;
			WpoIn.InputName = TEXT("InTexCoord");
			WPOExpr->Inputs.Add(WpoIn);
		}
		WPOExpr->Inputs[0].Input.Connect(0, TexCoordExpr);

		// --- 머티리얼 최종 핀 연결 ---
		Mat->GetEditorOnlyData()->EmissiveColor.Connect(0, ColorMul);
		Mat->GetEditorOnlyData()->OpacityMask.Connect(0, AlphaMul);
		Mat->GetEditorOnlyData()->WorldPositionOffset.Connect(0, WPOExpr);

		Mat->PostEditChange();

		UE_LOG(LogHktSpriteCore, Log,
			TEXT("[HktSpriteBillboardMaterial] 디폴트 Y-axis 빌보드 머티리얼 자동 생성 (M_HktSpriteYBillboard)"));

		return Mat;
	}
#endif // WITH_EDITORONLY_DATA
}

namespace HktSpriteBillboardMaterial
{
	UMaterialInterface* GetDefault()
	{
		static TWeakObjectPtr<UMaterialInterface> Cached;
		if (Cached.IsValid())
		{
			return Cached.Get();
		}

#if WITH_EDITORONLY_DATA
		UMaterialInterface* Mat = BuildDefaultMaterial();
		Cached = Mat;
		return Mat;
#else
		// Shipping: 에디터 온리 데이터 없이 UMaterial 편집 불가.
		// 프로덕션에서는 SpriteMaterialTemplate을 명시 할당해야 한다.
		UE_LOG(LogHktSpriteCore, Warning,
			TEXT("[HktSpriteBillboardMaterial] WITH_EDITORONLY_DATA=0 빌드 — 엔진 기본 머티리얼로 폴백. "
			     "UHktSpriteCrowdRenderer::SpriteMaterialTemplate을 명시 할당하세요."));
		return UMaterial::GetDefaultMaterial(MD_Surface);
#endif
	}
}
