// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/SceneComponent.h"
#include "HktSplatComponent.generated.h"

class FHktSplatRenderProxy;
class FHktSplatSceneViewExtension;

/**
 * UHktSplatComponent — 하나의 3D Gaussian Splatting 클라우드를 렌더링하는 컴포넌트.
 *
 * PLY 를 로드해 렌더 프록시를 만들고 UHktSplatSubsystem 의 SceneViewExtension 에
 * 등록한다. 컴포넌트 트랜스폼이 스플랫 클라우드를 월드에 배치한다.
 *
 * UPrimitiveComponent 가 아니라 USceneComponent 를 상속 — 기본 렌더 프리미티브
 * 파이프라인을 타지 않고 자체 SVE 컴포짓 경로로만 그린다 (완전 독립).
 */
UCLASS(ClassGroup = (HktSplat), meta = (BlueprintSpawnableComponent))
class HKTSPLATCORE_API UHktSplatComponent : public USceneComponent
{
	GENERATED_BODY()

public:
	UHktSplatComponent();

	/** 로드할 `.ply` 경로 (절대 경로 또는 프로젝트 상대). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HktSplat")
	FString PlyFilePath;

	/** 컴포넌트 등록 시 자동 로드 여부. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HktSplat")
	bool bAutoLoadOnRegister = true;

	/** 3DGS(오른손,y-down) → UE(z-up,왼손) 축 변환. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HktSplat|Import")
	bool bConvertCoordinateSystem = true;

	/** 위치/스케일 배율 (미터→cm = 100). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HktSplat|Import", meta = (ClampMin = "0.0001"))
	float UniformImportScale = 100.0f;

	/** 전역 불투명도 배율 (런타임 페이드 등). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSplat", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float OpacityScale = 1.0f;

	/** 지정 경로에서 PLY 로드 후 렌더 프록시 재생성. 성공 시 true. */
	UFUNCTION(BlueprintCallable, Category = "HktSplat")
	bool LoadPlyFromFile(const FString& InFilePath);

	/** 현재 클라우드/프록시 해제. */
	UFUNCTION(BlueprintCallable, Category = "HktSplat")
	void ClearCloud();

	/** 로드된 스플랫 수 (0 = 미로드). */
	UFUNCTION(BlueprintCallable, Category = "HktSplat")
	int32 GetNumSplats() const { return NumSplatsLoaded; }

	//~ USceneComponent
	virtual void OnRegister() override;
	virtual void OnUnregister() override;
	virtual void OnUpdateTransform(EUpdateTransformFlags UpdateTransformFlags, ETeleportType Teleport) override;
#if WITH_EDITOR
	virtual void PostEditChangeProperty(FPropertyChangedEvent& PropertyChangedEvent) override;
#endif

private:
	/** 소유 월드의 SVE 획득 (없으면 nullptr). */
	TSharedPtr<FHktSplatSceneViewExtension, ESPMode::ThreadSafe> GetViewExtension() const;

	/** 렌더 프록시를 SVE 에 등록 + 트랜스폼 푸시. */
	void RegisterProxy();
	/** 렌더 프록시 등록 해제 (RT 에서 delete). */
	void UnregisterProxy();
	/** 현재 컴포넌트 트랜스폼을 프록시에 전달. */
	void PushTransform();

	// 게임 스레드 소유. 등록 후에는 RT 가 수명 관리(해제 시 RT delete).
	FHktSplatRenderProxy* RenderProxy = nullptr;
	bool bProxyRegistered = false;   // SVE 에 등록되어 RT 가 GPU 리소스를 쥔 상태인지
	int32 NumSplatsLoaded = 0;
};
