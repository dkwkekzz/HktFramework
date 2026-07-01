// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "SceneViewExtension.h"
#include <atomic>

class FHktSplatRenderProxy;

/**
 * FHktSplatSceneViewExtension — 스플랫 컴포짓 패스를 렌더 파이프라인에 삽입.
 *
 * 등록된 모든 FHktSplatRenderProxy 를 PrePostProcessPass 시점에 씬 컬러로
 * 알파 오버 블렌딩한다. 씬 깊이와 테스트하여 불투명 지오메트리에 가려지게 한다.
 *
 * 프록시 레지스트리는 렌더 스레드에서만 접근. 게임 스레드는 Register/Unregister/
 * UpdateTransform 헬퍼로 렌더 커맨드를 큐잉한다.
 *
 * 마일스톤 1: back-to-front CPU 정렬(프록시 내부) + 인스턴스드 쿼드 래스터.
 * 로드맵: GPU radix sort, 타일 기반 래스터, 뷰 의존 SH.
 */
class HKTSPLATCORE_API FHktSplatSceneViewExtension : public FSceneViewExtensionBase
{
public:
	FHktSplatSceneViewExtension(const FAutoRegister& AutoRegister);

	// ── 게임 스레드 API (렌더 커맨드로 위임) ──
	void RegisterProxy(FHktSplatRenderProxy* Proxy);
	void UnregisterProxy(FHktSplatRenderProxy* Proxy);   // RT 에서 리소스 해제 후 delete
	void UpdateProxyTransform(FHktSplatRenderProxy* Proxy, const FMatrix44f& LocalToWorld, bool bVisible, float OpacityScale);

	bool HasAnyProxies() const { return NumRegistered.load() > 0; }

	// ── ISceneViewExtension ──
	virtual void SetupViewFamily(FSceneViewFamily& InViewFamily) override {}
	virtual void SetupView(FSceneViewFamily& InViewFamily, FSceneView& InView) override {}
	virtual void BeginRenderViewFamily(FSceneViewFamily& InViewFamily) override {}
	virtual void PreRenderViewFamily_RenderThread(FRDGBuilder& GraphBuilder, FSceneViewFamily& InViewFamily) override {}
	virtual void PreRenderView_RenderThread(FRDGBuilder& GraphBuilder, FSceneView& InView) override {}

	virtual void PrePostProcessPass_RenderThread(
		FRDGBuilder& GraphBuilder,
		const FSceneView& View,
		const FPostProcessingInputs& Inputs) override;

	virtual int32 GetPriority() const override { return 0; }

protected:
	virtual bool IsActiveThisFrame_Internal(const FSceneViewExtensionContext& Context) const override;

private:
	// 렌더 스레드 전용 프록시 목록
	TArray<FHktSplatRenderProxy*> Proxies_RT;

	// 게임 스레드에서 "그릴 게 있는지" 싸게 확인하기 위한 원자 카운터
	std::atomic<int32> NumRegistered{ 0 };
};
