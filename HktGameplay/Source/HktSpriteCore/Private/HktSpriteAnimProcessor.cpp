// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteAnimProcessor.h"
#include "HktSpriteCoreLog.h"
#include "HktRuntimeTags.h"
#include "HktCoreEventLog.h"
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

	// 1~3. 우선순위: Montage > UpperBody > FullBody
	static const FGameplayTag kPriorityLayers[] = {
		HktGameplayTags::Anim_Montage,
		HktGameplayTags::Anim_UpperBody,
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

	// 4. 기타 임의 Anim.* 레이어 (위 3개가 아니지만 존재하는 경우)
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

	// 5. Locomotion 폴백 (Movement Property → Anim.FullBody.Locomotion.* 합성)
	if (!ResolvedTag.IsValid())
	{
		ResolvedTag = ResolveLocomotionTag(Fragment, LocoPlayRate);
		bFromLocomotion = ResolvedTag.IsValid();
	}

	if (!ResolvedTag.IsValid())
	{
		// 정상 경로에서는 도달 불가 — Locomotion 폴백이 항상 Idle/Walk/Run/Fall을 반환한다.
		// 도달했다면 HktGameplayTags::Anim_FullBody_Locomotion_* 가 미등록 상태.
		// 이 함수는 모든 sprite 엔티티에 대해 매 프레임 호출되므로 무가드 emit은
		// N×30Hz 스팸이 된다. dedup 플래그는 호출자가 소유 — 호스트 수명에 묶여
		// PIE 재시작/멀티 호스트에서 자동 리셋된다.
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

	// AnimStartTick은 CrowdHost가 SV.AnimStartTick(서버 권위값)으로 직접 설정.
	// 서버 VM이 Op_PlayAnim / AddTag(Anim.*) / IsMoving·IsGrounded 변경 시마다
	// PropertyId::AnimStartTick 을 갱신하므로 클라 측 추론 불필요.
}

FGameplayTag GetAnimLayerTag(const FHktSpriteAnimFragment& Fragment, const FGameplayTag& LayerTag)
{
	if (const FGameplayTag* Found = Fragment.AnimLayerTags.Find(LayerTag))
	{
		return *Found;
	}
	return FGameplayTag();
}

} // namespace HktSpriteAnimProcessor
