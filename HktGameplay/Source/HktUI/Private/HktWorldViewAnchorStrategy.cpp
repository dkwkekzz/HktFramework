// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktWorldViewAnchorStrategy.h"
#include "Engine/World.h"
#include "Engine/LocalPlayer.h"
#include "GameFramework/HUD.h"
#include "GameFramework/PlayerController.h"
#include "Subsystems/LocalPlayerSubsystem.h"
#include "DrawDebugHelpers.h"

static TAutoConsoleVariable<int32> CVarShowEntityHud(
	TEXT("hkt.Debug.ShowEntityHud"),
	0,
	TEXT("EntityHud 앵커 시각화. 0=끄기, 1=앵커+캡슐 중심"),
	ECVF_Default);

FVector UHktWorldViewAnchorStrategy::GetHeadWorldLocation() const
{
	// RenderLocation은 이미 지면 트레이스 + 캡슐 오프셋이 적용된 최종 렌더 위치 (캡슐 중심).
	// 캡슐 상단(머리) = RenderLocation + CapsuleHalfHeight, 거기에 약간의 여백(HeadClearance)을 추가.
	return CachedRenderLocation + FVector(0.f, 0.f, CapsuleHalfHeight + HeadClearance);
}

bool UHktWorldViewAnchorStrategy::CalculateScreenPosition(const UObject* WorldContext, FVector2D& OutScreenPos)
{
	if (TargetEntityId == InvalidEntityId || !WorldContext || !bHasWorldPosition)
	{
		return false;
	}

	const FVector WorldLocation = GetHeadWorldLocation();

	// WorldContext에서 World → PlayerController 획득
	UWorld* World = nullptr;
	APlayerController* PC = nullptr;
	if (const ULocalPlayerSubsystem* LPS = Cast<ULocalPlayerSubsystem>(WorldContext))
	{
		World = LPS->GetLocalPlayer() ? LPS->GetLocalPlayer()->GetWorld() : nullptr;
	}
	else if (const AHUD* HUD = Cast<AHUD>(WorldContext))
	{
		World = HUD->GetWorld();
		PC = HUD->GetOwningPlayerController();
	}
	if (!World) return false;
	if (!PC) PC = World->GetFirstPlayerController();
	if (!PC) return false;

	// 디버그 시각화: HUD 앵커 월드 위치 및 캡슐 중심 표시
#if ENABLE_DRAW_DEBUG
	if (CVarShowEntityHud.GetValueOnGameThread() > 0)
	{
		// 머리 위 앵커 포인트 (HUD가 투영되는 위치) — 노란색
		DrawDebugSphere(World, WorldLocation, 8.f, 8, FColor::Yellow, false, -1.f, SDPG_World, 1.5f);
		// 캡슐 중심 (RenderLocation) — 시안색
		DrawDebugSphere(World, CachedRenderLocation, 6.f, 8, FColor::Cyan, false, -1.f, SDPG_World, 1.0f);
		// 캡슐 중심 → 앵커까지 연결선
		DrawDebugLine(World, CachedRenderLocation, WorldLocation, FColor::Yellow, false, -1.f, SDPG_World, 0.8f);
	}
#endif

	// 카메라 뒤에 있는 엔티티 필터링: ProjectWorldLocationToScreen은 카메라 뒤 좌표도
	// 화면에 투영하여 잘못된 위치를 반환할 수 있음.
	FVector CamLoc;
	FRotator CamRot;
	PC->GetPlayerViewPoint(CamLoc, CamRot);
	const FVector ToEntity = WorldLocation - CamLoc;
	if (FVector::DotProduct(ToEntity, CamRot.Vector()) <= 0.f)
	{
		return false;
	}

	// 월드 → 뷰포트 픽셀 좌표 (뷰포트 상대)
	if (!PC->ProjectWorldLocationToScreen(WorldLocation, OutScreenPos, /*bPlayerViewportRelative=*/ true))
	{
		return false;
	}

	// 뷰포트 픽셀 크기 획득
	int32 ViewportX, ViewportY;
	PC->GetViewportSize(ViewportX, ViewportY);
	if (ViewportX <= 0 || ViewportY <= 0) return false;

	// 정규화 (0~1). SConstraintCanvas 앵커에서 캔버스 로컬 Slate 좌표로 변환하므로
	// DPI 스케일, 해상도 변경, 전체화면 전환에 무관하게 정확하다.
	OutScreenPos.X /= static_cast<float>(ViewportX);
	OutScreenPos.Y /= static_cast<float>(ViewportY);

	// 화면 경계 클램핑
	OutScreenPos.X = FMath::Clamp(OutScreenPos.X, 0.f, 1.f);
	OutScreenPos.Y = FMath::Clamp(OutScreenPos.Y, 0.f, 1.f);

	return true;
}
