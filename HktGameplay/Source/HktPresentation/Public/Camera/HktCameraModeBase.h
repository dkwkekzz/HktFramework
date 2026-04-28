// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktCoreDefs.h"
#include "UObject/Object.h"
#include "HktCameraModeBase.generated.h"

class AHktRtsCameraPawn;
class UInputMappingContext;
class UHktCameraFramingProfile;

/**
 * 카메라 모드 공통 베이스.
 *
 * 모든 모드의 공통 계약:
 *  - "내" 엔티티(SubjectEntityId)가 유효하면 그 위치를 추적한다.
 *  - 없으면 화면 가장자리 스크롤(edge-scroll)로 자체 이동을 허용한다.
 *  - 뷰 설정(투영/FOV/각도/거리)은 Framing 프로필이 일괄 관리한다.
 *
 * 파생 클래스는 생성자에서 Framing 디폴트만 세팅하면 기본 동작이 완성된다.
 * 특수 입력(어깨뷰 마우스룩, 아이소 Yaw 회전 등)이 필요한 경우에만 Tick을 오버라이드.
 */
UCLASS(Abstract, Blueprintable, DefaultToInstanced, EditInlineNew)
class UHktCameraModeBase : public UObject
{
	GENERATED_BODY()

public:
	virtual void OnActivate(AHktRtsCameraPawn* Pawn);
	virtual void OnDeactivate(AHktRtsCameraPawn* Pawn);
	virtual void TickMode(AHktRtsCameraPawn* Pawn, float DeltaTime);
	virtual void HandleZoom(AHktRtsCameraPawn* Pawn, float Value);
	virtual void OnSubjectChanged(AHktRtsCameraPawn* Pawn, FHktEntityId EntityId);

	/** 뷰 프로필 — Projection/FOV/Pitch/Yaw/ArmLength/SocketOffset/Pitch 클램프 */
	UPROPERTY(Instanced, EditAnywhere, Category = "Camera|Framing")
	TObjectPtr<UHktCameraFramingProfile> Framing;

	/** 이 모드가 활성화될 때 추가할 InputMappingContext (null이면 추가/제거 없음) */
	UPROPERTY(EditAnywhere, Category = "Input")
	TObjectPtr<UInputMappingContext> InputMappingContext;

	/** MappingContext 우선순위 (높을수록 우선, 공통 DefaultMappingContext=0) */
	UPROPERTY(EditAnywhere, Category = "Input")
	int32 MappingPriority = 1;

	/** 이 모드에서 마우스 커서를 표시할지 여부 */
	UPROPERTY(EditAnywhere, Category = "Input")
	bool bShowMouseCursor = true;

	// === 공통 추적 ===
	/** Subject 추적 보간 속도 (0 이하면 즉시 스냅) */
	UPROPERTY(EditAnywhere, Category = "Camera|Tracking")
	float FollowInterpSpeed = 8.0f;

	/** Subject 추적 시 Z축까지 따라갈지. RtsView는 false (탑뷰 높이 유지) */
	UPROPERTY(EditAnywhere, Category = "Camera|Tracking")
	bool bTrackSubjectZ = true;

	// === 자체 컨트롤 (Subject 없을 때) ===
	/** 화면 가장자리 스크롤 임계 (뷰포트 비율) */
	UPROPERTY(EditAnywhere, Category = "Camera|FreeMove")
	float EdgeScrollThickness = 0.05f;

	/** 화면 가장자리 스크롤 속도 (cm/s) */
	UPROPERTY(EditAnywhere, Category = "Camera|FreeMove")
	float EdgeScrollSpeed = 3000.0f;

	/**
	 * 명시적 Subject가 없을 때 새로 스폰된 엔티티를 자동 추적할지.
	 * RtsView처럼 "유닛이 등장하면 카메라가 따라가는" UX가 필요한 모드에서 ON.
	 */
	UPROPERTY(EditAnywhere, Category = "Camera|Tracking")
	bool bAutoFollowNewSpawn = false;

protected:
	/** 현재 추적 대상 (소유권 검증된 "내" 엔티티). InvalidEntityId면 자체 컨트롤. */
	FHktEntityId SubjectEntityId = InvalidEntityId;

	/** bAutoFollowNewSpawn=true일 때 마지막으로 추적 중인 자동 타겟 */
	FHktEntityId AutoFollowEntityId = InvalidEntityId;

	/** 지정된 엔티티 위치를 향해 보간 이동 (bTrackSubjectZ에 따라 Z 유지/추적) */
	void TrackEntity(AHktRtsCameraPawn* Pawn, FHktEntityId EntityId, float DeltaTime);

	/** 마우스 가장자리 스크롤로 카메라 이동 */
	void HandleEdgeScroll(AHktRtsCameraPawn* Pawn, float DeltaTime);

	/** 자동 추적 타겟을 갱신·유효성 검사 후 반환 (없으면 InvalidEntityId) */
	FHktEntityId ResolveAutoFollowTarget(AHktRtsCameraPawn* Pawn);
};
