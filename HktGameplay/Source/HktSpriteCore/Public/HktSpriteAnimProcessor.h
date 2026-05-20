// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "HktCoreDefs.h"
#include "HktSpriteTypes.h"
#include "Templates/Function.h"

struct FHktPresentationState;

// ============================================================================
// FHktSpriteAnimFragment — 엔터티 한 명의 스프라이트 애니메이션 런타임 상태
//
// MassEntity 스타일의 POD fragment. UObject 오버헤드 없이 TMap<EntityId, Fragment>
// 로 크라우드 규모(수백~수천 엔터티)에 대응.
//
// 상태 전이는 HktSpriteAnimProcessor 네임스페이스의 순수 함수들이 담당한다.
// ============================================================================

struct HKTSPRITECORE_API FHktSpriteAnimFragment
{
	// --- 태그 레이어 상태 ---
	/** 부모 레이어 태그 → 현재 재생 중 AnimTag. 예: Anim.FullBody → Anim.FullBody.Locomotion.Run. */
	TMap<FGameplayTag, FGameplayTag> AnimLayerTags;

	/** FullBody 태그 — UHktAnimInstance::AnimStateTag와 동일 의미(하위 호환). */
	FGameplayTag AnimStateTag;

	/** 가장 최근에 재생 시작한 태그(주로 Montage trigger). 디버그/조회용. */
	FGameplayTag CurrentAnimTag;

	// 주: AnimStartTick은 서버 VM이 PropertyId::AnimStartTick 으로 권위 기록 →
	//     SV.AnimStartTick으로 전달되므로 클라 Fragment에는 별도로 저장하지 않는다.

	// --- 움직임 ---
	bool  bIsMoving   = false;
	bool  bIsFalling  = false;
	float MoveSpeed    = 0.f;
	float FallingSpeed = 0.f;

	/**
	 * 최근 XY 속도(cm/s, world space). 임계 속도 이상으로 움직였을 때만 갱신되며
	 * 정지 후에도 마지막 방향이 유지(sticky)된다. Facing 은 서버 VM 이 아닌 클라이언트가
	 * 매 프레임 (atan2(LastMoveDirXY), CameraYaw) 로 재산출하므로 카메라 회전에도
	 * 자연스럽게 반응한다 (UHktAnimInstance 의 Velocity → Locomotion 패턴 동일).
	 */
	FVector2D LastMoveDirXY = FVector2D::ZeroVector;

	// --- 전투 ---
	/** AttackSpeed/MotionPlayRate에서 파생된 전투 애니 재생 속도. */
	float AttackPlayRate = 1.f;
	float CPRatio        = 0.f;

	// --- 델타 트래킹 ---
	/** 이전 프레임의 Anim.* 태그 스냅샷(변화 감지용). */
	FGameplayTagContainer PrevAnimTags;

	// --- 처리 상태 캐시 (Tick 간 sticky 유지용) ---
	// 모든 sprite 표현 수단(PaperActor / HISM Crowd / Niagara Crowd) 공통 — anim 결정 로직이
	// HktSpriteAnimProcessor 로 단일화되면서 이전엔 액터/호스트가 따로 들고 있던 sticky 상태도
	// Fragment 안으로 옮겨졌다.

	/** 로컬 실시간 클럭(초). TickViewModel 이 매 호출마다 DeltaSec 누적. */
	double LocalNowSec = 0.0;

	/** 현재 ResolvedTag 의 재생 시작 LocalNowSec — VM 으로 emit. = TagStartLocalSec[ResolvedTag]. */
	double AnimStartLocalSec = 0.0;

	/**
	 * 태그별 시작 시각 (LocalNowSec). 각 Anim.* 태그가 활성화된 시점의 클럭값.
	 *
	 * 키 = 실제 AnimTag (예 `Anim.Action.Strike`, `Anim.FullBody.Locomotion.Run`). 값 = 그
	 * 태그가 활성화된 LocalNowSec. ExpireActionLayers 는 이 맵을 lookup 해 layer 별 정확한
	 * elapsed 를 계산한다 (이전 단일 AnimStartLocalSec 공유로 인한 anchor 충돌 해소 — Action
	 * 과 Montage/UpperBody 가 동시 활성일 때 Action 의 anchor 가 top-priority layer 에 의해
	 * 덮어쓰여 만료가 잘못된 시점에 일어나던 문제).
	 *
	 * Locomotion 합성 태그도 동일하게 등록된다 (Idle/Walk/Run/Fall 전환마다 새 anchor).
	 * AnimLayerTags 에서 사라지면서 ResolvedTag 도 아니게 되면 자동 정리.
	 */
	TMap<FGameplayTag, double> TagStartLocalSec;

	/** 마지막으로 관측한 서버 권위 AnimStartTick. 변하면 현 ResolvedTag 의 anchor 강제 리셋. */
	int32 LastAuthAnimStartTick = MIN_int32;

	/**
	 * 이번 프레임에 PendingAnimTriggers 가 소비되었는가. TickViewModel 가 anchor 강제 리셋
	 * 후 false 로 되돌린다. 동일 태그 재트리거 (콤보 공격 등) 가 서버 dedup 으로
	 * AuthAnimStartTick 을 건드리지 않아도 클라가 자력으로 0초부터 재생하도록 보장.
	 */
	bool bExplicitTriggerThisFrame = false;

	/** Sticky facing. TickViewModel 이 매 호출마다 sticky LastMoveDirXY + 현재 CameraYaw 로
	 *  재산출 (카메라 yaw 회전 시 화면-공간 dir 도 따라가야 하므로). LastMoveDirXY 가
	 *  ZeroVector 면 직전 값 유지(아직 한 번도 움직이지 않은 엔터티는 EHktSpriteFacing::S). */
	EHktSpriteFacing LastClientFacing = EHktSpriteFacing::S;
	bool             bLastFacingRight = true;
};

// ============================================================================
// FHktSpriteAnimViewModel — Processor 가 매 프레임 산출하는 *최종* 렌더 입력.
//
// 모든 sprite 표현 수단(PaperActor / HISM Crowd / Niagara Crowd) 의 단일 통로.
// Renderer 는 본 VM 의 필드만 읽어 그릴 수 있어야 한다 — 추가 의사결정 금지.
// ============================================================================

struct HKTSPRITECORE_API FHktSpriteAnimViewModel
{
	/** Processor 가 한 번이라도 채웠는가. false 면 Renderer 는 그리지 않음(대기). */
	bool bValid = false;

	/** ResolveRenderOutputs 결과 — Renderer 가 FindAnimationOrFallback 로 룩업할 키. */
	FGameplayTag AnimTag;

	/** 재생 속도 (Combat 계열은 AttackPlayRate, 그 외 1.0). */
	float PlayRate = 1.f;

	/** 클라 산출 8방향 Facing. */
	EHktSpriteFacing Facing = EHktSpriteFacing::S;

	/** 화면-공간 좌우 sticky (NumDirections<=2 mirror 결정에 사용). */
	bool bFacingRight = true;

	/** 로컬 실시간 클럭(초) — Renderer 가 ElapsedSec 계산용으로 소비. */
	double LocalNowSec = 0.0;

	/** Anim 전환 anchor(초). ElapsedSec = (LocalNowSec - AnimStartLocalSec) * PlayRate. */
	double AnimStartLocalSec = 0.0;
};

// ============================================================================
// HktSpriteAnimProcessor
//
// 스프라이트 전용 애니메이션 *결정* 로직의 단일 출처. 순수 C++ 네임스페이스 —
// UObject/vtable 없음, GC root 없음.
//
// 설계 원칙:
//  - WorldView(FHktPresentationState 의 SOA 뷰) → AbsorbViews → Fragment 갱신.
//  - Fragment + 권위 AuthAnimStartTick + DeltaSec + CameraYaw → TickViewModel → FHktSpriteAnimViewModel.
//  - 표현 수단(PaperActor / HISM Crowd / Niagara) 은 VM 만 소비. 추가 anim 결정 금지.
//
// 태그 계층 우선순위(UHktAnimInstance와 동일):
//  1. Anim.Montage.*   — 최상위. 원샷 액션(공격 발동 등).
//  2. Anim.UpperBody.* — 상체 오버라이드 (공격/캐스트 지속).
//  3. Anim.Action.*    — Strike/Cast 등 transient one-shot.
//  4. Anim.FullBody.*  — 기본 상태(Locomotion/Idle/Death).
//  5. 없음             — Movement 상태로 Anim.FullBody.Locomotion.{Idle,Walk,Run,Fall} 합성 폴백.
// ============================================================================

namespace HktSpriteAnimProcessor
{
	// --- Locomotion 튜닝 상수 ---
	// Walk↔Run 전환 임계는 콘솔 변수 `hkt.Sprite.Loco.RunSpeedThreshold`로 런타임 조정.
	// 나머지 상수는 Processor 로컬 constexpr로 유지 — 필요 시 UPROPERTY나 CVar로 승격.
	constexpr float kReferenceMoveSpeed  = 200.f; // cm/s — PlayRate=1.0 기준
	constexpr float kMinLocoPlayRate     = 0.25f;
	constexpr float kMaxLocoPlayRate     = 3.0f;
	constexpr bool  kScalePlayRateBySpeed = false;

	// === 저수준 태그 조작 (이전 API 보존) ===

	/**
	 * Entity 태그 컨테이너에서 Anim.* 변화를 감지해 AnimLayerTags를 갱신한다.
	 * 추가된 태그는 ApplyAnimTag, 제거된 태그는 RemoveAnimTag로 반영.
	 */
	HKTSPRITECORE_API void SyncFromTagContainer(FHktSpriteAnimFragment& Fragment,
		const FGameplayTagContainer& EntityTags);

	/** 단일 AnimTag 재생 (PendingAnimTriggers 소비용). AnimLayerTags에 layer 매핑만 갱신. */
	HKTSPRITECORE_API void ApplyAnimTag(FHktSpriteAnimFragment& Fragment, const FGameplayTag& AnimTag);

	/** AnimTag 제거 — AnimLayerTags에서 해당 레이어 엔트리 정리. */
	HKTSPRITECORE_API void RemoveAnimTag(FHktSpriteAnimFragment& Fragment, const FGameplayTag& AnimTag);

	/**
	 * 현재 상태로부터 Renderer에 전달할 AnimTag/PlayRate를 결정 (저수준).
	 * 상위 API 인 TickViewModel 가 호출하므로 외부 직접 호출은 지양 — 단위 테스트/디버그용.
	 *
	 * @param InOutLoggedFailure  태그 해석 실패 dedup 플래그(호출자 소유).
	 */
	HKTSPRITECORE_API void ResolveRenderOutputs(const FHktSpriteAnimFragment& Fragment,
		FGameplayTag& OutAnimTag, float& OutPlayRate, bool& InOutLoggedFailure);

	/** 특정 레이어(Anim.FullBody 등)의 현재 태그 조회. */
	HKTSPRITECORE_API FGameplayTag GetAnimLayerTag(const FHktSpriteAnimFragment& Fragment, const FGameplayTag& LayerTag);

	// === 상위 API — Sprite 표현 수단들의 단일 진입점 ===

	/**
	 * Movement / Combat / Animation 뷰를 Fragment 로 흡수. PaperActor 와 CrowdHost 가 가지고 있던
	 * 동일한 dirty-check + 흡수 로직을 단일 함수로 통합.
	 *
	 * @param Fragment            엔터티 상태.
	 * @param State               PresentationState — Movement/Combat/Animation 뷰 조회.
	 * @param EntityId            엔터티.
	 * @param Frame               현재 PresentationState frame (dirty check 기준).
	 * @param MinFacingSpeed      Facing 갱신 최소 XY 속도(cm/s). 이 미만이면 LastMoveDirXY sticky.
	 * @return                    true = facing 소스(LastMoveDirXY) 가 dirty — 호출자가
	 *                            SpriteView.Facing 으로 write-back 할 시점. anim trigger 는
	 *                            facing 입력과 무관하므로 facing dirty 를 켜지 않는다. 동일
	 *                            태그 재트리거의 anchor 리셋은 bExplicitTriggerThisFrame 으로
	 *                            별도 전달.
	 */
	HKTSPRITECORE_API bool AbsorbViews(FHktSpriteAnimFragment& Fragment,
		FHktPresentationState& State, FHktEntityId EntityId, int64 Frame,
		float MinFacingSpeed);

	/**
	 * Per-frame 처리 — AuthAnimStartTick 변화 추적 + ResolveRenderOutputs + Facing 산출 → VM 출력.
	 *
	 *   1) Fragment.LocalNowSec += DeltaSec
	 *   2) ResolveRenderOutputs(Fragment) → AnimTag / PlayRate
	 *   3) TagStartLocalSec 갱신 — 새 태그 등록 / 사라진 태그 정리 / AuthAnimStartTick 변화 또는
	 *      bExplicitTriggerThisFrame 시 ResolvedTag 의 anchor 강제 리셋. AnimStartLocalSec
	 *      = TagStartLocalSec[ResolvedTag].
	 *   4) sticky LastMoveDirXY + 현재 CameraYawDeg 로 Facing/FacingRight 매 호출 재산출.
	 *      (LastMoveDirXY 가 ZeroVector 이면 직전 LastClientFacing 유지 — 한 번도 움직이지 않은
	 *       엔터티는 EHktSpriteFacing::S 기본값.)
	 *   5) VM 채움
	 *
	 * Facing 을 매 호출 재산출하는 이유: 카메라 yaw 회전 시 디스플레이 dir 이 즉시 따라가도록.
	 * (캐릭터가 N 을 보고 정지 → 카메라가 캐릭터 주위를 동쪽으로 90° 돌면 화면-우향 → 디스플레이
	 *  dir 도 E 로 전환되어야 자연스러움.) SpriteView.Facing 으로의 write-back 여부는
	 *  호출자가 AbsorbViews 의 반환값으로 별도 게이트.
	 *
	 * @param InOutLoggedResolveFailure  ResolveRenderOutputs 의 dedup 플래그(호출자 소유).
	 */
	HKTSPRITECORE_API void TickViewModel(FHktSpriteAnimFragment& Fragment,
		int32 AuthAnimStartTick, double DeltaSec, float CameraYawDeg,
		FHktSpriteAnimViewModel& OutVM,
		bool& InOutLoggedResolveFailure);

	/**
	 * Anim.Action.* 자동 만료 — PlayAnim 일회성 트리거는 ApplyAnimTag 로 layer 를 켜지만
	 * 끄는 메커니즘이 없어 ResolveRenderOutputs 가 영원히 Action layer 를 픽 → Locomotion
	 * 합성이 도달 못함. 본 함수가 layer 의 expected duration 을 query 해 경과 시 layer 제거.
	 *
	 * Anim.Action.* 는 by-design transient namespace — bLooping 자산 설정과 무관하게 1회
	 * 재생 후 만료한다.
	 *
	 * @param Fragment           엔터티 상태.
	 * @param LocalNowSec        현재 로컬 시각. AnimStartLocalSec 와의 차이로 elapsed 산출.
	 * @param QueryDurationSec   (AnimTag) → seconds. <= 0 또는 nullptr 반환 시 즉시 만료.
	 *                           Renderer 별로 데이터 소스가 다름 (Paper: Flipbook->GetTotalDuration,
	 *                           HISM/Niagara: Anim->FramesPerDirection * FrameDurationMs / 1000).
	 */
	HKTSPRITECORE_API void ExpireActionLayers(FHktSpriteAnimFragment& Fragment,
		double LocalNowSec,
		TFunctionRef<float(const FGameplayTag& /*AnimTag*/)> QueryDurationSec);
}
