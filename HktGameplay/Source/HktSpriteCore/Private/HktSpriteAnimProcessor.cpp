// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteAnimProcessor.h"
#include "HktSpriteAnimMappingAsset.h"
#include "HktSpriteCoreLog.h"
#include "HktRuntimeTags.h"

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

	FName TagLeafToActionId(const FGameplayTag& Tag)
	{
		if (!Tag.IsValid()) return NAME_None;
		const FString TagStr = Tag.ToString();
		int32 LastDot = INDEX_NONE;
		TagStr.FindLastChar(TEXT('.'), LastDot);
		const FString Leaf = (LastDot != INDEX_NONE && LastDot + 1 < TagStr.Len())
			? TagStr.RightChop(LastDot + 1)
			: TagStr;
		return FName(*Leaf.ToLower());
	}

	/**
	 * 주어진 태그를 매핑 테이블에서 찾거나, 없으면 leaf-fallback으로 ActionId 결정.
	 * 성공 시 true, OutActionId/bOutIsCombat 채움.
	 */
	bool ResolveTagToAction(const UHktSpriteAnimMappingAsset* Mapping, const FGameplayTag& Tag,
		FName& OutActionId, bool& bOutIsCombat)
	{
		if (Mapping)
		{
			if (const FHktSpriteAnimMappingEntry* Entry = Mapping->FindMapping(Tag))
			{
				OutActionId  = Entry->ActionId;
				bOutIsCombat = Entry->bIsCombat;
				return OutActionId != NAME_None;
			}
		}
		const bool bFallback = !Mapping || Mapping->bUseTagLeafFallback;
		if (bFallback)
		{
			OutActionId  = TagLeafToActionId(Tag);
			bOutIsCombat = false;
			return OutActionId != NAME_None;
		}
		return false;
	}

	FName ApplyStanceOverride(const UHktSpriteAnimMappingAsset* Mapping, FName BaseActionId, const FGameplayTag& StanceTag)
	{
		if (!Mapping || BaseActionId.IsNone() || !StanceTag.IsValid())
		{
			return BaseActionId;
		}
		if (const FHktSpriteStanceMapping* StanceMap = Mapping->StanceMappings.Find(StanceTag))
		{
			if (const FName* Override = StanceMap->ActionIdOverrides.Find(BaseActionId))
			{
				return *Override;
			}
		}
		return BaseActionId;
	}
} // namespace

// ============================================================================
// 상태 갱신
// ============================================================================

void SyncFromTagContainer(const UHktSpriteAnimMappingAsset* /*Mapping*/, FHktSpriteAnimFragment& Fragment,
	const FGameplayTagContainer& EntityTags, int64 CurrentTick)
{
	// Entity 태그 중 Anim.* 계열만 필터링 (UHktAnimInstance와 동일)
	const FGameplayTagContainer CurrentAnimTags = EntityTags.Filter(FGameplayTagContainer(HktGameplayTags::Anim));

	// 새로 추가된 태그 → ApplyAnimTag
	for (const FGameplayTag& Tag : CurrentAnimTags)
	{
		if (!Fragment.PrevAnimTags.HasTagExact(Tag))
		{
			ApplyAnimTag(Fragment, Tag, CurrentTick);
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

void ApplyAnimTag(FHktSpriteAnimFragment& Fragment, const FGameplayTag& AnimTag, int64 CurrentTick)
{
	if (!AnimTag.IsValid())
	{
		return;
	}

	const FGameplayTag LayerParent = ExtractLayerParent(AnimTag);

	FGameplayTag& Current = Fragment.AnimLayerTags.FindOrAdd(LayerParent);
	Current = AnimTag;

	// FullBody는 AnimStateTag와 동기화 (하위호환)
	if (LayerParent.MatchesTagExact(HktGameplayTags::Anim_FullBody))
	{
		Fragment.AnimStateTag = AnimTag;
	}

	// Montage/UpperBody/FullBody 모두 트리거 시점 tick을 기록.
	// ResolveRenderOutputs에서 활성 레이어에 따라 사용 여부 결정.
	Fragment.CurrentAnimTag       = AnimTag;
	Fragment.CurrentAnimStartTick = CurrentTick;
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

void SyncStance(FHktSpriteAnimFragment& Fragment, FGameplayTag NewStance)
{
	if (Fragment.StanceTag == NewStance)
	{
		return;
	}
	Fragment.StanceTag = NewStance;
}

// ============================================================================
// 결과 해석
// ============================================================================

namespace
{
	/**
	 * Locomotion 추론: 태그가 없을 때 Fragment의 Movement/물리 상태로 idle/walk/run/fall 결정.
	 * 성공 시 OutActionId/OutLocoPlayRate 채우고 true 반환.
	 *
	 * 우선순위: Fall > Run > Walk > Idle.
	 * FallActionId가 비어있으면 공중이어도 추론하지 않고 다음 폴백으로 넘김(낙하 중에도
	 * 다른 폴백 로직을 쓰고 싶은 프로젝트를 위함).
	 */
	bool ResolveLocomotion(const FHktSpriteLocomotionMapping& Loco, const FHktSpriteAnimFragment& Fragment,
		FName& OutActionId, float& OutLocoPlayRate)
	{
		if (!Loco.bEnabled)
		{
			return false;
		}

		// 공중/낙하: 명시 태그(Anim.FullBody.Jump 등)가 없는데도 IsGrounded=0이면 fall로 폴백
		if (Fragment.bIsFalling)
		{
			if (Loco.FallActionId.IsNone())
			{
				return false;
			}
			OutActionId     = Loco.FallActionId;
			OutLocoPlayRate = 1.f;
			return true;
		}

		if (Fragment.bIsMoving)
		{
			const bool bUseRun = !Loco.RunActionId.IsNone()
				&& Fragment.MoveSpeed >= Loco.RunSpeedThreshold;
			OutActionId = bUseRun ? Loco.RunActionId : Loco.WalkActionId;
			if (OutActionId.IsNone())
			{
				return false;
			}

			OutLocoPlayRate = 1.f;
			if (Loco.bScalePlayRateByMoveSpeed && Loco.ReferenceMoveSpeed > KINDA_SMALL_NUMBER)
			{
				const float Raw = Fragment.MoveSpeed / Loco.ReferenceMoveSpeed;
				OutLocoPlayRate = FMath::Clamp(Raw, Loco.MinPlayRate, Loco.MaxPlayRate);
			}
			return true;
		}

		if (Loco.IdleActionId.IsNone())
		{
			return false;
		}
		OutActionId     = Loco.IdleActionId;
		OutLocoPlayRate = 1.f;
		return true;
	}
}

void ResolveRenderOutputs(const UHktSpriteAnimMappingAsset* Mapping, const FHktSpriteAnimFragment& Fragment,
	int64 FallbackAnimStartTick, FName& OutActionId, float& OutPlayRate, int64& OutAnimStartTick)
{
	FName BaseActionId = NAME_None;
	bool  bIsCombat    = false;
	float LocoPlayRate = 1.f;      // Locomotion 추론이 산출한 속도 스케일 (1.0이 기본)
	bool  bFromLocomotion = false; // Locomotion 경로로 해석되었는지
	FGameplayTag ActiveLayer;

	// 1~3. 우선순위: Montage > UpperBody > FullBody
	static const FGameplayTag* kPriorityLayers[] = {
		&HktGameplayTags::Anim_Montage,
		&HktGameplayTags::Anim_UpperBody,
		&HktGameplayTags::Anim_FullBody,
	};

	bool bResolved = false;
	for (const FGameplayTag* LayerPtr : kPriorityLayers)
	{
		if (!LayerPtr) continue;
		if (const FGameplayTag* Found = Fragment.AnimLayerTags.Find(*LayerPtr))
		{
			if (Found->IsValid() && ResolveTagToAction(Mapping, *Found, BaseActionId, bIsCombat))
			{
				ActiveLayer = *LayerPtr;
				bResolved = true;
				break;
			}
		}
	}

	// 4. 기타 임의 Anim.* 레이어
	if (!bResolved)
	{
		for (const TPair<FGameplayTag, FGameplayTag>& Pair : Fragment.AnimLayerTags)
		{
			if (!Pair.Value.IsValid()) continue;
			if (ResolveTagToAction(Mapping, Pair.Value, BaseActionId, bIsCombat))
			{
				ActiveLayer = Pair.Key;
				bResolved = true;
				break;
			}
		}
	}

	// 5. Locomotion 추론 (Movement Property 기반). 3D BlendSpace를 대체.
	if (!bResolved && Mapping)
	{
		bResolved = bFromLocomotion = ResolveLocomotion(Mapping->Locomotion, Fragment, BaseActionId, LocoPlayRate);
	}

	// 6. 최종 폴백
	if (!bResolved)
	{
		BaseActionId = Mapping ? Mapping->DefaultActionId : FName(TEXT("idle"));
		bIsCombat    = false;
		ActiveLayer  = FGameplayTag();
	}

	OutActionId = ApplyStanceOverride(Mapping, BaseActionId, Fragment.StanceTag);

	// PlayRate 결정:
	//   - Combat 태그 → AttackPlayRate
	//   - Locomotion → MoveSpeed 기반 스케일(bScalePlayRateByMoveSpeed=true일 때만 != 1.0)
	//   - 그 외 → 1.0
	if (bIsCombat)
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

	// AnimStartTick:
	//   - Montage/UpperBody: 트리거 수신 시점(CurrentAnimStartTick) — 서버는 별도 프레임 권위값 없음
	//   - FullBody / Locomotion / Default: 서버 권위 SV.AnimStartTick
	const bool bUseLocalTick = ActiveLayer.IsValid()
		&& (ActiveLayer.MatchesTagExact(HktGameplayTags::Anim_Montage)
			|| ActiveLayer.MatchesTagExact(HktGameplayTags::Anim_UpperBody));
	OutAnimStartTick = bUseLocalTick ? Fragment.CurrentAnimStartTick : FallbackAnimStartTick;
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
