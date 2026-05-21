// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteAnimProcessor.h"
#include "HktSpriteCoreLog.h"
#include "HktSpriteFrameResolver.h"
#include "HktRuntimeTags.h"
#include "HktCoreEventLog.h"
#include "HktPresentationState.h"
#include "HAL/IConsoleManager.h"

// ============================================================================
// 콘솔 변수
// ============================================================================

static TAutoConsoleVariable<float> CVarHktSpriteRunSpeedThreshold(
	TEXT("hkt.Sprite.Loco.RunSpeedThreshold"),
	300.f,
	TEXT("Walk↔Run 전환 MoveSpeed 임계값 (cm/s). ")
	TEXT("Sprite AnimProcessor가 Anim.* 태그 없을 때 Locomotion 폴백을 선택할 때 사용."),
	ECVF_Default);

namespace HktSpriteAnimProcessor
{

// ============================================================================
// 내부 헬퍼 (파일 스코프)
// ============================================================================

namespace
{
	/**
	 * UHktAnimInstance::ExtractLayerParent와 동일 규약:
	 *   Anim.FullBody.Locomotion.Run → Anim.FullBody
	 *   Anim.UpperBody.Combat.Attack → Anim.UpperBody
	 *   Anim.Montage.Attack          → Anim.Montage
	 */
	FGameplayTag ExtractLayerParent(const FGameplayTag& AnimTag)
	{
		const FString TagStr = AnimTag.ToString();
		int32 FirstDot = INDEX_NONE;
		TagStr.FindChar(TEXT('.'), FirstDot);
		if (FirstDot == INDEX_NONE)
		{
			return AnimTag;
		}
		const int32 SecondDot = TagStr.Find(TEXT("."), ESearchCase::CaseSensitive, ESearchDir::FromStart, FirstDot + 1);
		if (SecondDot == INDEX_NONE)
		{
			return AnimTag;
		}
		const FString ParentStr = TagStr.Left(SecondDot);
		return FGameplayTag::RequestGameplayTag(FName(*ParentStr), false);
	}

	bool IsCombatLayerTag(const FGameplayTag& Tag)
	{
		return Tag.MatchesTag(HktGameplayTags::Anim_Montage)
			|| Tag.MatchesTag(HktGameplayTags::Anim_UpperBody);
	}

	// ========================================================================
	// Phase-shared group table
	//
	// 같은 그룹에 속하는 anim 태그들은 anchor (재생 시작 시각) 를 공유한다.
	// TagStartLocalSec 등록 시 key 가 *태그 자체* 가 아닌 *그룹 prefix* 로 들어가므로:
	//   - 그룹 내 태그 전환 (Idle ↔ Walk ↔ Run) 시 anchor 유지 → 발 위상 보존.
	//   - 그룹 entry 는 cleanup 에서도 보존되어, Action/Montage 가 그룹 멤버를 잠시
	//     가렸다 사라져도 그룹 anchor 가 살아남는다 → 복귀 시 phase 가 끊기지 않음.
	//
	// 신규 그룹 추가: 본 lambda 에 prefix tag 만 append. cleanup/lookup 분기 수정 불필요
	// — GetAnchorKey / IsPhaseSharedGroupKey 가 테이블 lookup 으로 자동 인식.
	const TArray<FGameplayTag>& GetPhaseSharedGroups()
	{
		// Lazy init — GameplayTag 등록이 완료된 후 첫 호출 시 build.
		static const TArray<FGameplayTag> Groups = []
		{
			TArray<FGameplayTag> Out;
			Out.Add(HktGameplayTags::Anim_FullBody_Locomotion); // Idle/Walk/Run/Fall — 발 위상 보존
			// 신규 그룹 추가 예시:
			// Out.Add(HktGameplayTags::Anim_UpperBody_Idle);   // 만약 상체 idle/breath 가 phase-shared 라면
			return Out;
		}();
		return Groups;
	}

	/**
	 * AnimTag → anchor key. 어떤 phase-shared group prefix 와 MatchesTag 면 *그룹 prefix
	 * 자체* 를 반환 (그룹 멤버끼리 anchor 공유), 아니면 태그 자체 반환.
	 *
	 * TagStartLocalSec 의 모든 키 lookup 은 본 함수를 경유한다.
	 */
	FGameplayTag GetAnchorKey(const FGameplayTag& AnimTag)
	{
		for (const FGameplayTag& Group : GetPhaseSharedGroups())
		{
			if (AnimTag.MatchesTag(Group))
			{
				return Group;
			}
		}
		return AnimTag;
	}

	/** Key 가 phase-shared group prefix 자체인가. Cleanup 에서 그룹 entry 를 보존하는 판정용. */
	bool IsPhaseSharedGroupKey(const FGameplayTag& Key)
	{
		for (const FGameplayTag& Group : GetPhaseSharedGroups())
		{
			if (Key == Group) return true;
		}
		return false;
	}
} // namespace

// ============================================================================
// 상태 갱신
// ============================================================================

void SyncFromTagContainer(FHktSpriteAnimFragment& Fragment,
	const FGameplayTagContainer& EntityTags)
{
	// Entity 태그 중 Anim.* 계열만 필터링 (UHktAnimInstance와 동일)
	const FGameplayTagContainer CurrentAnimTags = EntityTags.Filter(FGameplayTagContainer(HktGameplayTags::Anim));

	// 새로 추가된 태그 → ApplyAnimTag
	for (const FGameplayTag& Tag : CurrentAnimTags)
	{
		if (!Fragment.PrevAnimTags.HasTagExact(Tag))
		{
			ApplyAnimTag(Fragment, Tag);
		}
	}

	// 제거된 태그 → RemoveAnimTag
	for (const FGameplayTag& Tag : Fragment.PrevAnimTags)
	{
		if (!CurrentAnimTags.HasTagExact(Tag))
		{
			RemoveAnimTag(Fragment, Tag);
		}
	}

	Fragment.PrevAnimTags = CurrentAnimTags;
}

void ApplyAnimTag(FHktSpriteAnimFragment& Fragment, const FGameplayTag& AnimTag)
{
	if (!AnimTag.IsValid())
	{
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
			TEXT("Sprite|AnimProcessor: ApplyAnimTag 무시 — invalid tag"));
		return;
	}

	const FGameplayTag LayerParent = ExtractLayerParent(AnimTag);
	if (!LayerParent.IsValid())
	{
		HKT_EVENT_LOG_TAG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
			FString::Printf(TEXT("Sprite|AnimProcessor: ApplyAnimTag — Layer parent 추출 실패 (tag=%s, GameplayTag 미등록 가능성)"),
				*AnimTag.ToString()),
			InvalidEntityId, AnimTag);
	}

	FGameplayTag& Current = Fragment.AnimLayerTags.FindOrAdd(LayerParent);
	const FGameplayTag Prev = Current;
	Current = AnimTag;

	if (!Prev.MatchesTagExact(AnimTag))
	{
		HKT_EVENT_LOG_TAG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
			FString::Printf(TEXT("Sprite|AnimProcessor: ApplyAnimTag layer=%s %s → %s"),
				*LayerParent.ToString(),
				Prev.IsValid() ? *Prev.ToString() : TEXT("(none)"),
				*AnimTag.ToString()),
			InvalidEntityId, AnimTag);
	}

	// FullBody는 AnimStateTag와 동기화 (하위호환)
	if (LayerParent.MatchesTagExact(HktGameplayTags::Anim_FullBody))
	{
		Fragment.AnimStateTag = AnimTag;
	}

	Fragment.CurrentAnimTag = AnimTag;
}

void RemoveAnimTag(FHktSpriteAnimFragment& Fragment, const FGameplayTag& AnimTag)
{
	if (!AnimTag.IsValid())
	{
		return;
	}

	const FGameplayTag LayerParent = ExtractLayerParent(AnimTag);

	// 해당 레이어의 현재 태그가 이 태그이면 제거
	if (FGameplayTag* Current = Fragment.AnimLayerTags.Find(LayerParent))
	{
		if (Current->MatchesTagExact(AnimTag))
		{
			Fragment.AnimLayerTags.Remove(LayerParent);
			HKT_EVENT_LOG_TAG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|AnimProcessor: RemoveAnimTag layer=%s tag=%s"),
					*LayerParent.ToString(), *AnimTag.ToString()),
				InvalidEntityId, AnimTag);
		}
	}

	// FullBody는 AnimStateTag와 동기화
	if (LayerParent.MatchesTagExact(HktGameplayTags::Anim_FullBody) && Fragment.AnimStateTag.MatchesTagExact(AnimTag))
	{
		Fragment.AnimStateTag = FGameplayTag();
	}

	// CurrentAnimTag가 제거되는 태그이면 무효화 (선택 로직이 다음 우선순위로 폴백)
	if (Fragment.CurrentAnimTag.MatchesTagExact(AnimTag))
	{
		Fragment.CurrentAnimTag = FGameplayTag();
	}
}

// ============================================================================
// 결과 해석
// ============================================================================

namespace
{
	/**
	 * Locomotion 폴백: 태그가 없을 때 Fragment의 Movement/물리 상태로 idle/walk/run/fall을
	 * Anim.FullBody.Locomotion.* 태그로 합성.
	 *
	 * 우선순위: Fall > Run > Walk > Idle.
	 */
	FGameplayTag ResolveLocomotionTag(const FHktSpriteAnimFragment& Fragment, float& OutLocoPlayRate)
	{
		OutLocoPlayRate = 1.f;

		if (Fragment.bIsFalling)
		{
			return HktGameplayTags::Anim_FullBody_Locomotion_Fall;
		}

		if (Fragment.bIsMoving)
		{
			const float RunSpeedThreshold = CVarHktSpriteRunSpeedThreshold.GetValueOnGameThread();
			const bool bUseRun = Fragment.MoveSpeed >= RunSpeedThreshold;
			if (kScalePlayRateBySpeed && kReferenceMoveSpeed > KINDA_SMALL_NUMBER)
			{
				const float Raw = Fragment.MoveSpeed / kReferenceMoveSpeed;
				OutLocoPlayRate = FMath::Clamp(Raw, kMinLocoPlayRate, kMaxLocoPlayRate);
			}
			return bUseRun
				? HktGameplayTags::Anim_FullBody_Locomotion_Run
				: HktGameplayTags::Anim_FullBody_Locomotion_Walk;
		}

		return HktGameplayTags::Anim_FullBody_Locomotion_Idle;
	}
}

void ResolveRenderOutputs(const FHktSpriteAnimFragment& Fragment,
	FGameplayTag& OutAnimTag, float& OutPlayRate, bool& InOutLoggedFailure)
{
	FGameplayTag ResolvedTag;
	float LocoPlayRate = 1.f;
	bool  bFromLocomotion = false;

	// 1~4. 우선순위: Montage > UpperBody > Action > FullBody
	// Anim.Action 은 transient one-shot (Strike/Cast 등). Locomotion(FullBody) 보다 위에 두어
	// strike 트리거 직후 다음 SyncFromTagContainer 가 Anim.FullBody.Locomotion.* 를 채워도
	// 액션이 자기 flipbook 종료 시까지 우선 재생되도록 한다. 종료는 ExpireActionLayers 가
	// layer 자체를 제거.
	static const FGameplayTag kPriorityLayers[] = {
		HktGameplayTags::Anim_Montage,
		HktGameplayTags::Anim_UpperBody,
		HktGameplayTags::Anim_Action,
		HktGameplayTags::Anim_FullBody,
	};

	for (const FGameplayTag& Layer : kPriorityLayers)
	{
		if (const FGameplayTag* Found = Fragment.AnimLayerTags.Find(Layer))
		{
			if (Found->IsValid())
			{
				ResolvedTag = *Found;
				break;
			}
		}
	}

	// 5. 기타 임의 Anim.* 레이어 (위 4개가 아니지만 존재하는 경우)
	if (!ResolvedTag.IsValid())
	{
		for (const TPair<FGameplayTag, FGameplayTag>& Pair : Fragment.AnimLayerTags)
		{
			if (Pair.Value.IsValid())
			{
				ResolvedTag = Pair.Value;
				break;
			}
		}
	}

	// 6. Locomotion 폴백 (Movement Property → Anim.FullBody.Locomotion.* 합성)
	if (!ResolvedTag.IsValid())
	{
		ResolvedTag = ResolveLocomotionTag(Fragment, LocoPlayRate);
		bFromLocomotion = ResolvedTag.IsValid();
	}

	if (!ResolvedTag.IsValid())
	{
		// 정상 경로에서는 도달 불가 — Locomotion 폴백이 항상 Idle/Walk/Run/Fall을 반환한다.
		// 도달했다면 HktGameplayTags::Anim_FullBody_Locomotion_* 가 미등록 상태.
		if (!InOutLoggedFailure)
		{
			InOutLoggedFailure = true;
			HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Error, EHktLogSource::Client,
				TEXT("Sprite|AnimProcessor: ResolveRenderOutputs — Anim 태그 해석 실패 (Locomotion 폴백까지 무효). HktGameplayTags::Anim_FullBody_Locomotion_* 등록 확인 필요 (이후 동일 사유 묵음)"));
		}
	}

	OutAnimTag = ResolvedTag;

	// PlayRate 결정:
	//   - Combat 계열(Montage/UpperBody) → AttackPlayRate
	//   - Locomotion 합성 → MoveSpeed 기반 스케일(kScalePlayRateBySpeed=true일 때만 != 1.0)
	//   - 그 외 → 1.0
	if (IsCombatLayerTag(ResolvedTag))
	{
		OutPlayRate = FMath::Max(Fragment.AttackPlayRate, 0.01f);
	}
	else if (bFromLocomotion)
	{
		OutPlayRate = FMath::Max(LocoPlayRate, 0.01f);
	}
	else
	{
		OutPlayRate = 1.0f;
	}
}

FGameplayTag GetAnimLayerTag(const FHktSpriteAnimFragment& Fragment, const FGameplayTag& LayerTag)
{
	if (const FGameplayTag* Found = Fragment.AnimLayerTags.Find(LayerTag))
	{
		return *Found;
	}
	return FGameplayTag();
}

// ============================================================================
// 상위 API — Sprite 표현 수단들의 단일 진입점
// ============================================================================

bool AbsorbViews(FHktSpriteAnimFragment& Fragment,
	FHktPresentationState& State, FHktEntityId EntityId, int64 Frame,
	float MinFacingSpeed)
{
	bool bFacingSourceDirty = false;

	// --- Movement 흡수 ---
	if (const FHktMovementView* MV = State.GetMovement(EntityId))
	{
		if (MV->bIsMoving.IsDirty(Frame))  Fragment.bIsMoving  = MV->bIsMoving.Get();
		if (MV->bIsJumping.IsDirty(Frame)) Fragment.bIsFalling = MV->bIsJumping.Get();
		if (MV->Velocity.IsDirty(Frame))
		{
			const FVector Vel = MV->Velocity.Get();
			const FVector2D VelXY(Vel.X, Vel.Y);
			Fragment.MoveSpeed    = VelXY.Size();
			Fragment.FallingSpeed = Vel.Z;

			// Sticky: 임계 이상으로 움직였을 때만 facing 입력 갱신.
			if (Fragment.MoveSpeed >= MinFacingSpeed)
			{
				Fragment.LastMoveDirXY = VelXY;
				bFacingSourceDirty = true;
			}
		}
	}

	// --- Combat 흡수 ---
	if (const FHktCombatView* CV = State.GetCombat(EntityId))
	{
		if (CV->MotionPlayRate.IsDirty(Frame) || CV->AttackSpeed.IsDirty(Frame))
		{
			const int32 RawRate = CV->MotionPlayRate.Get();
			float SpeedScale = (RawRate > 0)
				? static_cast<float>(RawRate) / 100.0f
				: static_cast<float>(CV->AttackSpeed.Get()) / 100.0f;
			if (SpeedScale <= 0.0f) SpeedScale = 1.0f;
			Fragment.AttackPlayRate = SpeedScale;
		}
		if (CV->CPRatio.IsDirty(Frame))
		{
			Fragment.CPRatio = CV->CPRatio.Get();
		}
	}

	// --- Animation 흡수 (PendingAnimTriggers 소비 위해 Mutable). ---
	if (FHktAnimationView* AV = State.GetMutableAnimation(EntityId))
	{
		if (AV->TagsDirtyFrame == Frame)
		{
			SyncFromTagContainer(Fragment, AV->Tags);
		}
		if (AV->PendingAnimTriggers.Num() > 0)
		{
			for (const FGameplayTag& AnimTag : AV->PendingAnimTriggers)
			{
				ApplyAnimTag(Fragment, AnimTag);
			}
			AV->PendingAnimTriggers.Reset();
			// (Low) anim trigger 는 facing 입력에 영향 없으므로 bFacingSourceDirty 를 건드리지 않는다.
			// (A) 동일 태그 재트리거 시 anchor 강제 리셋용 — TickViewModel 가 소비.
			Fragment.bExplicitTriggerThisFrame = true;
		}
	}

	// --- 표적 방향 Facing 보정 ---
	// 공격 anim layer 활성 시 LastMoveDirXY 를 (Self → Target) 방향으로 덮어쓴다. 이동 정지 후에도
	// 표적을 바라보게 하기 위함 — 이동 sticky 만 사용하면 "사거리 도달 후 정지 → 공격" 시점에
	// 직전 이동 방향이 표적과 무관할 때 backshot 가 발생하기 때문 (예: 옆걸음 회피 후 공격,
	// 첫 명령부터 사거리 내 공격, 사거리 내 표적 교체). Combat anim 이 활성인 동안만 적용하므로
	// idle/이동 중에는 이동 방향 facing 이 그대로 유지된다.
	const bool bAttackAnimActive =
		Fragment.AnimLayerTags.Contains(HktGameplayTags::Anim_Montage)
		|| Fragment.AnimLayerTags.Contains(HktGameplayTags::Anim_UpperBody)
		|| Fragment.AnimLayerTags.Contains(HktGameplayTags::Anim_Action);
	if (bAttackAnimActive)
	{
		if (const FHktCombatView* CV = State.GetCombat(EntityId))
		{
			const int32 TargetId = CV->TargetEntityId.Get();
			// TargetId == 0 은 서버의 "no target" sentinel (Story_TargetAction.json 의 default).
			// 자기 자신 / voxel target / invalid 도 제외.
			if (TargetId > 0 && TargetId != EntityId && State.IsValid(TargetId))
			{
				const FHktTransformView* SelfTV = State.GetTransform(EntityId);
				const FHktTransformView* TgtTV  = State.GetTransform(TargetId);
				if (SelfTV && TgtTV)
				{
					const FVector SelfLoc = SelfTV->RenderLocation.Get();
					const FVector TgtLoc  = TgtTV->RenderLocation.Get();
					const FVector2D DirXY(TgtLoc.X - SelfLoc.X, TgtLoc.Y - SelfLoc.Y);
					// 너무 가까우면(같은 셀) 방향 산출 불가 — sticky 유지.
					if (DirXY.SizeSquared() > 1.f)
					{
						Fragment.LastMoveDirXY = DirXY;
						bFacingSourceDirty = true;
					}
				}
			}
		}
	}

	return bFacingSourceDirty;
}

void TickViewModel(FHktSpriteAnimFragment& Fragment,
	int32 AuthAnimStartTick, double DeltaSec, float CameraYawDeg,
	FHktSpriteAnimViewModel& OutVM,
	bool& InOutLoggedResolveFailure)
{
	// 1) 로컬 클럭 누적.
	Fragment.LocalNowSec += DeltaSec;

	// 2) AnimTag / PlayRate 결정.
	FGameplayTag AnimTag;
	float PlayRate = 1.f;
	ResolveRenderOutputs(Fragment, AnimTag, PlayRate, InOutLoggedResolveFailure);

	// 3) 태그별 anchor 갱신 (TagStartLocalSec). Key 는 GetAnchorKey() 경유 — phase-shared
	//    group 에 속하면 그룹 prefix, 아니면 태그 자체.
	//   (a) AnimLayerTags 의 활성 태그들 — 해당 anchor key 가 맵에 없으면 LocalNowSec 등록.
	//   (b) ResolvedTag 의 anchor key 도 동일하게 (Locomotion 합성 태그는 AnimLayerTags 에
	//       없으므로 본 분기로 등록).
	//   (c) 정리 — Cleanup 단계. 단 phase-shared group 키는 보존 (그룹 멤버가 Action/Montage 에
	//       잠시 가려졌다 복귀할 때 phase 가 살아있어야).
	//   (d) AuthAnimStartTick 변화 또는 bExplicitTriggerThisFrame → ResolvedTag 의 anchor key
	//       강제 리셋. 그룹 키여도 명시적 재시작/재트리거 시에는 0초부터.
	const FGameplayTag ResolvedKey = GetAnchorKey(AnimTag);

	for (const TPair<FGameplayTag, FGameplayTag>& Pair : Fragment.AnimLayerTags)
	{
		if (!Pair.Value.IsValid()) continue;
		const FGameplayTag K = GetAnchorKey(Pair.Value);
		if (!Fragment.TagStartLocalSec.Contains(K))
		{
			Fragment.TagStartLocalSec.Add(K, Fragment.LocalNowSec);
		}
	}
	if (AnimTag.IsValid() && !Fragment.TagStartLocalSec.Contains(ResolvedKey))
	{
		Fragment.TagStartLocalSec.Add(ResolvedKey, Fragment.LocalNowSec);
	}
	// Cleanup — 그룹 키 보존, 그 외에는 ResolvedKey 또는 AnimLayerTags 값들의 anchor key 외 제거.
	for (auto It = Fragment.TagStartLocalSec.CreateIterator(); It; ++It)
	{
		if (IsPhaseSharedGroupKey(It.Key())) continue; // 그룹 entry 는 entity 일생 동안 보존

		bool bKeep = (It.Key() == ResolvedKey);
		if (!bKeep)
		{
			for (const TPair<FGameplayTag, FGameplayTag>& Pair : Fragment.AnimLayerTags)
			{
				if (Pair.Value.IsValid() && GetAnchorKey(Pair.Value) == It.Key())
				{
					bKeep = true;
					break;
				}
			}
		}
		if (!bKeep) It.RemoveCurrent();
	}

	const bool bAuthTickChanged = (Fragment.LastAuthAnimStartTick != AuthAnimStartTick);
	if (bAuthTickChanged || Fragment.bExplicitTriggerThisFrame)
	{
		Fragment.LastAuthAnimStartTick = AuthAnimStartTick;
		if (AnimTag.IsValid())
		{
			Fragment.TagStartLocalSec.FindOrAdd(ResolvedKey) = Fragment.LocalNowSec;
		}
		Fragment.bExplicitTriggerThisFrame = false;
	}

	// 4) AnimStartLocalSec = ResolvedKey 의 anchor (VM 으로 emit).
	if (AnimTag.IsValid())
	{
		if (const double* P = Fragment.TagStartLocalSec.Find(ResolvedKey))
		{
			Fragment.AnimStartLocalSec = *P;
		}
	}

	// 5) Facing 산출 — sticky LastMoveDirXY + 현재 CameraYaw 로 매 호출 재계산.
	//   카메라가 캐릭터 주위를 돌면 화면-공간 dir 이 즉시 따라간다. LastMoveDirXY 가
	//   ZeroVector 면 직전 LastClientFacing 유지(아직 한 번도 움직이지 않은 엔터티는 S).
	if (!Fragment.LastMoveDirXY.IsNearlyZero())
	{
		const float DirYawDeg = FMath::RadiansToDegrees(
			FMath::Atan2(Fragment.LastMoveDirXY.Y, Fragment.LastMoveDirXY.X));
		Fragment.LastClientFacing = HktFacingFromYaw(DirYawDeg, CameraYawDeg);

		// 좌우 sticky: 화면 우측 = world (Y - X) > 0 (Iso 카메라 yaw=45 기준).
		// LastMoveDirXY 만으로 판단 — 8방향 Facing 의 N/S/NE/SE 양자화 손실을 우회.
		// 카메라 yaw 와 무관하게 world-frame 부호로 결정 → 캐릭터가 움직이지 않으면 sticky.
		const float ScreenX = Fragment.LastMoveDirXY.Y - Fragment.LastMoveDirXY.X;
		if (FMath::Abs(ScreenX) > KINDA_SMALL_NUMBER)
		{
			Fragment.bLastFacingRight = (ScreenX > 0.f);
		}
	}

	// 6) VM 채움.
	OutVM.bValid             = true;
	OutVM.AnimTag            = AnimTag;
	OutVM.PlayRate           = PlayRate;
	OutVM.Facing             = Fragment.LastClientFacing;
	OutVM.bFacingRight       = Fragment.bLastFacingRight;
	OutVM.LocalNowSec        = Fragment.LocalNowSec;
	OutVM.AnimStartLocalSec  = Fragment.AnimStartLocalSec;
}

void ExpireActionLayers(FHktSpriteAnimFragment& Fragment,
	double LocalNowSec,
	TFunctionRef<float(const FGameplayTag& /*AnimTag*/)> QueryDurationSec)
{
	TArray<FGameplayTag, TInlineAllocator<4>> ToRemove;
	int32 ActionLayerCount = 0;
	for (const TPair<FGameplayTag, FGameplayTag>& Pair : Fragment.AnimLayerTags)
	{
		// Layer key 는 ExtractLayerParent 결과 (예: "Anim.Action.Strike" → "Anim.Action").
		// MatchesTag 는 자기 자신과 자손 모두 매칭하므로 Anim.Action 본인 + 미래 하위 분류
		// (예: Anim.Action.Special) 까지 동일하게 transient 로 취급된다.
		if (!Pair.Key.MatchesTag(HktGameplayTags::Anim_Action)) continue;
		++ActionLayerCount;
		if (!Pair.Value.IsValid()) { ToRemove.Add(Pair.Value); continue; }

		// 자기 자신 duration 질의. <= 0 → 해당 anim 렌더 불가능 (자산 미등록) → 즉시 만료.
		const float LayerDur = QueryDurationSec(Pair.Value);
		if (LayerDur <= 0.f) { ToRemove.Add(Pair.Value); continue; }

		// (B) 패치: 이 layer 의 자체 시작 시각으로 elapsed 산출 — top-priority layer 의 anchor 와
		// 분리. Montage/UpperBody 와 동시 활성이어서 한 번도 ResolvedTag 가 된 적 없는 Action
		// layer 도 자신의 등록 시점부터 elapsed 가 정확히 누적된다. 만약 누락되어 있으면
		// (이론상 도달 불가) 즉시 만료 시켜 무한 잔존 방지.
		// Anchor key 는 phase-shared group 일 경우 그룹 prefix — Action 은 그룹 비대상이라
		// 통상 태그 자체이지만, 향후 그룹화될 가능성에 대비해 GetAnchorKey 경유.
		const FGameplayTag LayerKey = GetAnchorKey(Pair.Value);
		const double* LayerStartPtr = Fragment.TagStartLocalSec.Find(LayerKey);
		if (!LayerStartPtr) { ToRemove.Add(Pair.Value); continue; }
		const double RawElapsed = LocalNowSec - *LayerStartPtr;
		if (RawElapsed >= static_cast<double>(LayerDur))
		{
			ToRemove.Add(Pair.Value);
		}
	}

	// 디버그 — 만료 후보 entity 의 layer 상태 변화를 추적 (회귀 검증용, 주기적 emit).
	if (ActionLayerCount > 0 && ToRemove.Num() == 0)
	{
		static thread_local int32 sPendingDebugTick = 0;
		if (++sPendingDebugTick % 30 == 0)
		{
			HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|AnimProcessor: AnimLayer Anim.Action.* still active count=%d"),
					ActionLayerCount));
		}
	}

	for (const FGameplayTag& ExpireTag : ToRemove)
	{
		HKT_EVENT_LOG_TAG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
			FString::Printf(TEXT("Sprite|AnimProcessor: AnimLayer auto-expire %s"), *ExpireTag.ToString()),
			InvalidEntityId, ExpireTag);
		RemoveAnimTag(Fragment, ExpireTag);
	}
}

} // namespace HktSpriteAnimProcessor
