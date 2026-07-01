// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Scene/HktSplatComponent.h"
#include "Scene/HktSplatSubsystem.h"
#include "Rendering/HktSplatRenderProxy.h"
#include "Rendering/HktSplatSceneViewExtension.h"
#include "IO/HktSplatPlyLoader.h"
#include "Data/HktSplatTypes.h"
#include "HktSplatCoreLog.h"
#include "Engine/World.h"
#include "Misc/Paths.h"
#include "RenderingThread.h"

UHktSplatComponent::UHktSplatComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
	bWantsOnUpdateTransform = true; // OnUpdateTransform 콜백 활성화
}

TSharedPtr<FHktSplatSceneViewExtension, ESPMode::ThreadSafe> UHktSplatComponent::GetViewExtension() const
{
	if (const UWorld* World = GetWorld())
	{
		if (UHktSplatSubsystem* Sub = World->GetSubsystem<UHktSplatSubsystem>())
		{
			return Sub->GetViewExtension();
		}
	}
	return nullptr;
}

bool UHktSplatComponent::LoadPlyFromFile(const FString& InFilePath)
{
	FString Path = InFilePath;
	if (FPaths::IsRelative(Path))
	{
		Path = FPaths::ConvertRelativePathToFull(FPaths::ProjectDir() / Path);
	}

	FHktSplatImportOptions Options;
	Options.bConvertCoordinateSystem = bConvertCoordinateSystem;
	Options.UniformScale = UniformImportScale;

	FHktSplatCloud Cloud;
	FString Error;
	if (!FHktSplatPlyLoader::LoadFromFile(Path, Options, Cloud, Error))
	{
		UE_LOG(LogHktSplat, Error, TEXT("PLY 로드 실패 (%s): %s"), *Path, *Error);
		return false;
	}

	// 기존 프록시 해제 후 새 프록시 등록
	UnregisterProxy();

	NumSplatsLoaded = Cloud.Num();
	RenderProxy = new FHktSplatRenderProxy(MoveTemp(Cloud.Splats), Cloud.LocalBounds);
	PlyFilePath = InFilePath;
	RegisterProxy();

	UE_LOG(LogHktSplat, Log, TEXT("UHktSplatComponent 로드 완료 — %d 스플랫 (%s)"), NumSplatsLoaded, *Path);
	return true;
}

void UHktSplatComponent::ClearCloud()
{
	UnregisterProxy();
	NumSplatsLoaded = 0;
}

void UHktSplatComponent::RegisterProxy()
{
	if (!RenderProxy || bProxyRegistered) return; // 중복 등록 방지 (NumRegistered drift 차단)
	TSharedPtr<FHktSplatSceneViewExtension, ESPMode::ThreadSafe> SVE = GetViewExtension();
	if (!SVE.IsValid())
	{
		UE_LOG(LogHktSplat, Warning, TEXT("SVE 없음 — 스플랫 등록 보류 (월드 서브시스템 미초기화?)"));
		return;
	}
	PushTransform();
	SVE->RegisterProxy(RenderProxy);
	bProxyRegistered = true;
}

void UHktSplatComponent::UnregisterProxy()
{
	if (!RenderProxy) return;

	if (bProxyRegistered)
	{
		if (TSharedPtr<FHktSplatSceneViewExtension, ESPMode::ThreadSafe> SVE = GetViewExtension())
		{
			// 정상 경로: SVE 가 RT 에서 리소스 해제 + delete + 리스트 제거.
			SVE->UnregisterProxy(RenderProxy);
		}
		else
		{
			// SVE 가 먼저 사라진 경로(서브시스템 선-Deinit, GC 중 World null).
			// 엔진은 이 raw 포인터를 모르므로 직접 RT 에서 해제+delete 해야 누수가 없다.
			FHktSplatRenderProxy* Orphan = RenderProxy;
			ENQUEUE_RENDER_COMMAND(HktSplatOrphanRelease)(
				[Orphan](FRHICommandListImmediate&)
				{
					Orphan->ReleaseResources_RenderThread();
					delete Orphan;
				});
		}
	}
	else
	{
		// 등록된 적 없음 → GPU 리소스 미생성, 게임 스레드에서 즉시 파기 안전.
		delete RenderProxy;
	}

	RenderProxy = nullptr; // 이후 접근 금지
	bProxyRegistered = false;
}

void UHktSplatComponent::PushTransform()
{
	if (!RenderProxy) return;
	TSharedPtr<FHktSplatSceneViewExtension, ESPMode::ThreadSafe> SVE = GetViewExtension();
	if (!SVE.IsValid()) return;

	const FMatrix44f LocalToWorld(GetComponentTransform().ToMatrixWithScale());
	SVE->UpdateProxyTransform(RenderProxy, LocalToWorld, IsVisible(), OpacityScale);
}

void UHktSplatComponent::OnRegister()
{
	Super::OnRegister();
	if (bAutoLoadOnRegister && !PlyFilePath.IsEmpty() && !RenderProxy)
	{
		LoadPlyFromFile(PlyFilePath);
	}
	else if (RenderProxy)
	{
		RegisterProxy();
	}
}

void UHktSplatComponent::OnUnregister()
{
	UnregisterProxy();
	Super::OnUnregister();
}

void UHktSplatComponent::OnUpdateTransform(EUpdateTransformFlags UpdateTransformFlags, ETeleportType Teleport)
{
	Super::OnUpdateTransform(UpdateTransformFlags, Teleport);
	PushTransform();
}

#if WITH_EDITOR
void UHktSplatComponent::PostEditChangeProperty(FPropertyChangedEvent& PropertyChangedEvent)
{
	Super::PostEditChangeProperty(PropertyChangedEvent);

	const FName Name = PropertyChangedEvent.GetPropertyName();
	if (Name == GET_MEMBER_NAME_CHECKED(UHktSplatComponent, PlyFilePath)
		|| Name == GET_MEMBER_NAME_CHECKED(UHktSplatComponent, bConvertCoordinateSystem)
		|| Name == GET_MEMBER_NAME_CHECKED(UHktSplatComponent, UniformImportScale))
	{
		if (!PlyFilePath.IsEmpty())
		{
			LoadPlyFromFile(PlyFilePath); // 에디터에서 즉시 리로드
		}
	}
	else if (Name == GET_MEMBER_NAME_CHECKED(UHktSplatComponent, OpacityScale))
	{
		PushTransform(); // 불투명도 배율만 갱신
	}
}
#endif
