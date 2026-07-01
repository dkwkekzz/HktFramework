// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "RHIResources.h"
#include "Data/HktSplatTypes.h"

class FRHICommandListBase;

/**
 * FHktSplatRenderProxy — 하나의 스플랫 클라우드에 대한 렌더 스레드 표현.
 *
 * 게임 스레드의 UHktSplatComponent 가 생성하지만, GPU 리소스 생성/해제/그리기는
 * 전부 렌더 스레드에서만 접근한다 (FPrimitiveSceneProxy 와 동일한 계약).
 *
 * 보유 리소스:
 *  - SplatBuffer  : StructuredBuffer<FHktSplatData> — 스플랫 원본(위치/공분산/색/불투명도)
 *  - SortedIndex  : StructuredBuffer<uint>          — 뷰 깊이 정렬된 인덱스 (프레임마다 갱신)
 *
 * 정렬은 마일스톤 1 에서 렌더 스레드 CPU 정렬(back-to-front)로 수행한다.
 * GPU radix sort 는 로드맵.
 */
class HKTSPLATCORE_API FHktSplatRenderProxy
{
public:
	explicit FHktSplatRenderProxy(TArray<FHktSplatVertexGPU>&& InSplats, const FBox& InLocalBounds);
	~FHktSplatRenderProxy();

	/** 렌더 스레드: 정적 GPU 버퍼(SplatBuffer) 생성 */
	void InitResources_RenderThread(FRHICommandListBase& RHICmdList);

	/** 렌더 스레드: 모든 GPU 리소스 해제 */
	void ReleaseResources_RenderThread();

	/**
	 * 렌더 스레드: 카메라 위치 기준 back-to-front 정렬 후 SortedIndex 버퍼 갱신.
	 * @param ViewOriginLocal  로컬 공간으로 변환된 카메라 원점 (LocalToWorld⁻¹ 적용)
	 * @return 정렬/업로드된 스플랫 수
	 */
	int32 UpdateSortedIndices_RenderThread(FRHICommandListBase& RHICmdList, const FVector3f& ViewOriginLocal);

	int32 GetNumSplats() const { return NumSplats; }
	bool HasValidResources() const { return SplatBufferSRV.IsValid() && SortedIndexSRV[SortRingCursor].IsValid(); }

	// ── 게임 스레드에서 세팅, 렌더 스레드에서 읽음 (등록/트랜스폼 커맨드로 동기화) ──
	FMatrix44f LocalToWorld = FMatrix44f::Identity;
	FBox       LocalBounds = FBox(ForceInit);
	bool       bVisible = true;
	float      GlobalOpacityScale = 1.0f;

	FRHIShaderResourceView* GetSplatSRV() const { return SplatBufferSRV; }
	FRHIShaderResourceView* GetSortedIndexSRV() const { return SortedIndexSRV[SortRingCursor]; }

private:
	// 렌더 스레드 전용 CPU 캐시 — 정렬 키 계산용 위치/깊이
	TArray<FHktSplatVertexGPU> SplatsCPU;
	TArray<uint32> SortedIndices;
	TArray<float>  DepthKeys;
	int32 NumSplats = 0;

	FBufferRHIRef SplatBuffer;
	FShaderResourceViewRHIRef SplatBufferSRV;

	// SortedIndex 는 매 프레임 CPU 로 재작성된다. 직전 프레임 패스가 아직 GPU 에서
	// SRV 를 읽는 중일 수 있으므로 단일 버퍼를 재-lock 하면 경쟁이 난다.
	// N-슬롯 링으로 프레임마다 다른 버퍼를 써서 in-flight 읽기와 충돌하지 않게 한다.
	static constexpr int32 kSortRing = 3;
	FBufferRHIRef SortedIndexBuffer[kSortRing];
	FShaderResourceViewRHIRef SortedIndexSRV[kSortRing];
	uint32 SortedIndexCapacity[kSortRing] = { 0 };
	int32 SortRingCursor = 0;
};
