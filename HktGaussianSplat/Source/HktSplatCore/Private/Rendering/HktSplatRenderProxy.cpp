// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Rendering/HktSplatRenderProxy.h"
#include "HktSplatCoreLog.h"
#include "RHICommandList.h"
#include "RenderGraphUtils.h"

FHktSplatRenderProxy::FHktSplatRenderProxy(TArray<FHktSplatVertexGPU>&& InSplats, const FBox& InLocalBounds)
	: LocalBounds(InLocalBounds)
	, SplatsCPU(MoveTemp(InSplats))
{
	NumSplats = SplatsCPU.Num();
	SortedIndices.SetNumUninitialized(NumSplats);
	DepthKeys.SetNumUninitialized(NumSplats);
	for (int32 i = 0; i < NumSplats; ++i) { SortedIndices[i] = (uint32)i; }
}

FHktSplatRenderProxy::~FHktSplatRenderProxy()
{
	// 리소스는 ReleaseResources_RenderThread 에서 이미 해제되어 있어야 한다.
	check(!SplatBuffer.IsValid());
}

void FHktSplatRenderProxy::InitResources_RenderThread(FRHICommandListBase& RHICmdList)
{
	check(IsInRenderingThread());
	if (NumSplats <= 0) return;

	const uint32 Stride = sizeof(FHktSplatVertexGPU);
	const uint32 Size = Stride * (uint32)NumSplats;

	// ── 정적 스플랫 StructuredBuffer 생성 + 초기 데이터 업로드 ──
	// NOTE: UE5.5+ FRHIBufferCreateDesc 경로. 엔진 마이너 버전에 따라 생성 API 조정 가능.
	const FRHIBufferCreateDesc Desc =
		FRHIBufferCreateDesc::CreateStructured(TEXT("HktSplatBuffer"), Size, Stride)
		.AddUsage(EBufferUsageFlags::ShaderResource | EBufferUsageFlags::Static)
		.SetInitialState(ERHIAccess::SRVMask);
	SplatBuffer = RHICmdList.CreateBuffer(Desc);

	{
		void* Ptr = RHICmdList.LockBuffer(SplatBuffer, 0, Size, RLM_WriteOnly);
		FMemory::Memcpy(Ptr, SplatsCPU.GetData(), Size);
		RHICmdList.UnlockBuffer(SplatBuffer);
	}

	SplatBufferSRV = RHICmdList.CreateShaderResourceView(
		SplatBuffer,
		FRHIViewDesc::CreateBufferSRV().SetType(FRHIViewDesc::EBufferType::Structured));

	UE_LOG(LogHktSplat, Log, TEXT("SplatRenderProxy GPU 리소스 생성 — 스플랫 %d개 (%u bytes)"), NumSplats, Size);
}

void FHktSplatRenderProxy::ReleaseResources_RenderThread()
{
	check(IsInRenderingThread());
	SplatBufferSRV.SafeRelease();
	SplatBuffer.SafeRelease();
	SortedIndexSRV.SafeRelease();
	SortedIndexBuffer.SafeRelease();
	SortedIndexCapacity = 0;
}

int32 FHktSplatRenderProxy::UpdateSortedIndices_RenderThread(FRHICommandListBase& RHICmdList, const FVector3f& ViewOriginLocal)
{
	check(IsInRenderingThread());
	if (NumSplats <= 0 || !SplatBuffer.IsValid()) return 0;

	// ── back-to-front 정렬 키: 카메라로부터의 거리² (내림차순) ──
	for (int32 i = 0; i < NumSplats; ++i)
	{
		const FVector3f D = SplatsCPU[i].Position - ViewOriginLocal;
		DepthKeys[i] = D.SizeSquared();
		SortedIndices[i] = (uint32)i;
	}

	// 먼 것 먼저(over 블렌딩). Algo::Sort 는 안정성 불필요 — 인덱스 배열을 직접 정렬.
	SortedIndices.Sort([this](const uint32& A, const uint32& B)
	{
		return DepthKeys[A] > DepthKeys[B];
	});

	// ── SortedIndex StructuredBuffer<uint> 업로드 (용량 부족 시 재생성) ──
	const uint32 Size = sizeof(uint32) * (uint32)NumSplats;
	if (!SortedIndexBuffer.IsValid() || SortedIndexCapacity < (uint32)NumSplats)
	{
		SortedIndexSRV.SafeRelease();
		SortedIndexBuffer.SafeRelease();

		const FRHIBufferCreateDesc Desc =
			FRHIBufferCreateDesc::CreateStructured(TEXT("HktSplatSortedIndex"), Size, sizeof(uint32))
			.AddUsage(EBufferUsageFlags::ShaderResource | EBufferUsageFlags::Dynamic)
			.SetInitialState(ERHIAccess::SRVMask);
		SortedIndexBuffer = RHICmdList.CreateBuffer(Desc);
		SortedIndexSRV = RHICmdList.CreateShaderResourceView(
			SortedIndexBuffer,
			FRHIViewDesc::CreateBufferSRV().SetType(FRHIViewDesc::EBufferType::Structured));
		SortedIndexCapacity = (uint32)NumSplats;
	}

	{
		void* Ptr = RHICmdList.LockBuffer(SortedIndexBuffer, 0, Size, RLM_WriteOnly);
		FMemory::Memcpy(Ptr, SortedIndices.GetData(), Size);
		RHICmdList.UnlockBuffer(SortedIndexBuffer);
	}

	return NumSplats;
}
