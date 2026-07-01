// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Rendering/HktSplatSceneViewExtension.h"
#include "Rendering/HktSplatRenderProxy.h"
#include "HktSplatCoreLog.h"

#include "GlobalShader.h"
#include "ShaderParameterStruct.h"
#include "RenderGraphBuilder.h"
#include "RenderGraphUtils.h"
#include "PixelShaderUtils.h"
#include "CommonRenderResources.h"
#include "SceneView.h"
#include "PostProcess/PostProcessInputs.h"
#include "RHIStaticStates.h"

// ============================================================================
// 셰이더 파라미터 (VS/PS 공용) + 전역 셰이더
// ============================================================================

BEGIN_SHADER_PARAMETER_STRUCT(FHktSplatPassParameters, )
	SHADER_PARAMETER_STRUCT_REF(FViewUniformShaderParameters, View)
	SHADER_PARAMETER_SRV(StructuredBuffer<FHktSplatData>, SplatBuffer)
	SHADER_PARAMETER_SRV(StructuredBuffer<uint>, SortedIndices)
	SHADER_PARAMETER(FMatrix44f, LocalToTranslatedWorld)
	SHADER_PARAMETER(FVector2f, ViewportSize)
	SHADER_PARAMETER(FVector2f, Focal)
	SHADER_PARAMETER(float, OpacityScale)
	SHADER_PARAMETER(uint32, NumSplats)
	RENDER_TARGET_BINDING_SLOTS()
END_SHADER_PARAMETER_STRUCT()

class FHktSplatVS : public FGlobalShader
{
	DECLARE_GLOBAL_SHADER(FHktSplatVS);
	SHADER_USE_PARAMETER_STRUCT(FHktSplatVS, FGlobalShader);
	using FParameters = FHktSplatPassParameters;

	static bool ShouldCompilePermutation(const FGlobalShaderPermutationParameters& Parameters)
	{
		return IsFeatureLevelSupported(Parameters.Platform, ERHIFeatureLevel::SM5);
	}
};

class FHktSplatPS : public FGlobalShader
{
	DECLARE_GLOBAL_SHADER(FHktSplatPS);
	SHADER_USE_PARAMETER_STRUCT(FHktSplatPS, FGlobalShader);
	using FParameters = FHktSplatPassParameters;

	static bool ShouldCompilePermutation(const FGlobalShaderPermutationParameters& Parameters)
	{
		return IsFeatureLevelSupported(Parameters.Platform, ERHIFeatureLevel::SM5);
	}
};

IMPLEMENT_GLOBAL_SHADER(FHktSplatVS, "/Plugin/HktSplat/HktSplat.usf", "MainVS", SF_Vertex);
IMPLEMENT_GLOBAL_SHADER(FHktSplatPS, "/Plugin/HktSplat/HktSplat.usf", "MainPS", SF_Pixel);

// ============================================================================
// CVar
// ============================================================================
static TAutoConsoleVariable<int32> CVarHktSplatEnable(
	TEXT("hkt.Splat.Enable"), 1,
	TEXT("HktGaussianSplat 컴포짓 패스 on/off"),
	ECVF_RenderThreadSafe);

static TAutoConsoleVariable<int32> CVarHktSplatMaxCount(
	TEXT("hkt.Splat.MaxCountPerProxy"), 4000000,
	TEXT("프록시당 렌더 스플랫 상한 (초과분은 정렬 상위만)"),
	ECVF_RenderThreadSafe);

// ============================================================================
// FHktSplatSceneViewExtension
// ============================================================================

FHktSplatSceneViewExtension::FHktSplatSceneViewExtension(const FAutoRegister& AutoRegister)
	: FSceneViewExtensionBase(AutoRegister)
{
}

bool FHktSplatSceneViewExtension::IsActiveThisFrame_Internal(const FSceneViewExtensionContext& Context) const
{
	return CVarHktSplatEnable.GetValueOnAnyThread() != 0 && NumRegistered.load() > 0;
}

void FHktSplatSceneViewExtension::RegisterProxy(FHktSplatRenderProxy* Proxy)
{
	if (!Proxy) return;
	NumRegistered.fetch_add(1);
	ENQUEUE_RENDER_COMMAND(HktSplatRegister)(
		[this, Proxy](FRHICommandListImmediate& RHICmdList)
		{
			Proxy->InitResources_RenderThread(RHICmdList);
			Proxies_RT.AddUnique(Proxy);
		});
}

void FHktSplatSceneViewExtension::UnregisterProxy(FHktSplatRenderProxy* Proxy)
{
	if (!Proxy) return;
	NumRegistered.fetch_sub(1);
	ENQUEUE_RENDER_COMMAND(HktSplatUnregister)(
		[this, Proxy](FRHICommandListImmediate& RHICmdList)
		{
			Proxies_RT.Remove(Proxy);
			Proxy->ReleaseResources_RenderThread();
			delete Proxy; // 렌더 스레드에서 소멸 — GPU 리소스 해제 이후
		});
}

void FHktSplatSceneViewExtension::UpdateProxyTransform(
	FHktSplatRenderProxy* Proxy, const FMatrix44f& LocalToWorld, bool bVisible, float OpacityScale)
{
	if (!Proxy) return;
	ENQUEUE_RENDER_COMMAND(HktSplatUpdateXform)(
		[Proxy, LocalToWorld, bVisible, OpacityScale](FRHICommandListImmediate&)
		{
			Proxy->LocalToWorld = LocalToWorld;
			Proxy->bVisible = bVisible;
			Proxy->GlobalOpacityScale = OpacityScale;
		});
}

void FHktSplatSceneViewExtension::PrePostProcessPass_RenderThread(
	FRDGBuilder& GraphBuilder, const FSceneView& View, const FPostProcessingInputs& Inputs)
{
	check(IsInRenderingThread());
	if (Proxies_RT.Num() == 0 || CVarHktSplatEnable.GetValueOnRenderThread() == 0)
	{
		return;
	}

	// ── 씬 컬러/깊이 확보 (컴포짓 대상 + 오클루전 테스트) ──
	Inputs.Validate();
	const FSceneTextureUniformParameters* SceneTex = Inputs.SceneTextures->GetParameters();
	FRDGTextureRef SceneColor = SceneTex ? SceneTex->SceneColorTexture : nullptr;
	FRDGTextureRef SceneDepth = SceneTex ? SceneTex->SceneDepthTexture : nullptr;
	if (!SceneColor || !SceneDepth)
	{
		return;
	}

	// NOTE: FViewInfo::ViewRect 는 Renderer private. 플러그인에서는 public 멤버 사용.
	// 스크린 퍼센티지 사용 시 실제 렌더 rect 와 다를 수 있음 — 첫 검증 포인트.
	const FIntRect ViewRect = View.UnscaledViewRect;
	const FVector2f ViewportSize((float)ViewRect.Width(), (float)ViewRect.Height());

	// 초점거리(픽셀) = 0.5 · 뷰포트 · 투영행렬 대각. 렌더 스레드에서 정확히 계산.
	const FMatrix& Proj = View.ViewMatrices.GetProjectionMatrix();
	const FVector2f Focal(
		0.5f * ViewportSize.X * (float)Proj.M[0][0],
		0.5f * ViewportSize.Y * (float)Proj.M[1][1]);

	const FVector PreViewTranslation = View.ViewMatrices.GetPreViewTranslation();
	const FVector ViewOriginWorld = View.ViewMatrices.GetViewOrigin();

	FGlobalShaderMap* GSM = GetGlobalShaderMap(View.GetFeatureLevel());
	TShaderMapRef<FHktSplatVS> VertexShader(GSM);
	TShaderMapRef<FHktSplatPS> PixelShader(GSM);

	const int32 MaxCount = CVarHktSplatMaxCount.GetValueOnRenderThread();

	// 프록시마다 별도 패스 — 각 패스는 이전 결과 위에 알파 오버.
	// (프록시 간 정렬은 미보정 — 마일스톤 1 한계. 로드맵: 전역 통합 정렬.)
	for (FHktSplatRenderProxy* Proxy : Proxies_RT)
	{
		if (!Proxy || !Proxy->bVisible || Proxy->GetNumSplats() <= 0)
		{
			continue;
		}

		// 로컬 공간 카메라 원점 → back-to-front 정렬
		const FMatrix44f LocalToWorld = Proxy->LocalToWorld;
		const FMatrix44f WorldToLocal = LocalToWorld.Inverse();
		const FVector4f OriginLocal4 = WorldToLocal.TransformPosition(FVector3f(ViewOriginWorld));
		const FVector3f ViewOriginLocal(OriginLocal4.X, OriginLocal4.Y, OriginLocal4.Z);

		const int32 NumDrawn = Proxy->UpdateSortedIndices_RenderThread(GraphBuilder.RHICmdList, ViewOriginLocal);
		if (NumDrawn <= 0 || !Proxy->HasValidResources())
		{
			continue;
		}
		const uint32 NumInstances = (uint32)FMath::Min(NumDrawn, MaxCount);

		// LocalToTranslatedWorld = LocalToWorld * Translate(PreViewTranslation)
		FMatrix44f LocalToTranslatedWorld = LocalToWorld;
		LocalToTranslatedWorld.M[3][0] += (float)PreViewTranslation.X;
		LocalToTranslatedWorld.M[3][1] += (float)PreViewTranslation.Y;
		LocalToTranslatedWorld.M[3][2] += (float)PreViewTranslation.Z;

		FHktSplatPassParameters* Pass = GraphBuilder.AllocParameters<FHktSplatPassParameters>();
		Pass->View = View.ViewUniformBuffer;
		Pass->SplatBuffer = Proxy->GetSplatSRV();
		Pass->SortedIndices = Proxy->GetSortedIndexSRV();
		Pass->LocalToTranslatedWorld = LocalToTranslatedWorld;
		Pass->ViewportSize = ViewportSize;
		Pass->Focal = Focal;
		Pass->OpacityScale = Proxy->GlobalOpacityScale;
		Pass->NumSplats = NumInstances;
		Pass->RenderTargets[0] = FRenderTargetBinding(SceneColor, ERenderTargetLoadAction::ELoad);
		Pass->RenderTargets.DepthStencil = FDepthStencilBinding(
			SceneDepth, ERenderTargetLoadAction::ENoAction, ERenderTargetLoadAction::ENoAction,
			FExclusiveDepthStencil::DepthRead_StencilNop);

		GraphBuilder.AddPass(
			RDG_EVENT_NAME("HktSplat(%d)", NumInstances),
			Pass,
			ERDGPassFlags::Raster,
			[Pass, VertexShader, PixelShader, ViewRect, NumInstances](FRHICommandList& RHICmdList)
			{
				RHICmdList.SetViewport(ViewRect.Min.X, ViewRect.Min.Y, 0.0f, ViewRect.Max.X, ViewRect.Max.Y, 1.0f);

				FGraphicsPipelineStateInitializer GPSI;
				RHICmdList.ApplyCachedRenderTargets(GPSI);
				GPSI.PrimitiveType = PT_TriangleStrip;
				GPSI.BoundShaderState.VertexDeclarationRHI = GEmptyVertexDeclaration.VertexDeclarationRHI;
				GPSI.BoundShaderState.VertexShaderRHI = VertexShader.GetVertexShader();
				GPSI.BoundShaderState.PixelShaderRHI = PixelShader.GetPixelShader();
				GPSI.RasterizerState = TStaticRasterizerState<FM_Solid, CM_None>::GetRHI();
				// 깊이 테스트만(쓰기 없음). 역-Z 이므로 "가깝거나 같으면 통과" = GreaterEqual.
				GPSI.DepthStencilState = TStaticDepthStencilState<false, CF_GreaterEqual>::GetRHI();
				// premultiplied over: Src=One, Dst=InvSrcAlpha
				GPSI.BlendState = TStaticBlendState<CW_RGBA,
					BO_Add, BF_One, BF_InverseSourceAlpha,
					BO_Add, BF_One, BF_InverseSourceAlpha>::GetRHI();

				SetGraphicsPipelineState(RHICmdList, GPSI, 0);
				SetShaderParameters(RHICmdList, VertexShader, VertexShader.GetVertexShader(), *Pass);
				SetShaderParameters(RHICmdList, PixelShader, PixelShader.GetPixelShader(), *Pass);

				// vertex buffer 없이 SV_VertexID 로 쿼드 생성. strip 2프리미티브(4버텍스) × N 인스턴스.
				RHICmdList.DrawPrimitive(0, 2, NumInstances);
			});
	}
}
