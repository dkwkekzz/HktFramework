// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAnimInstance.h"
#include "HktCoreEventLog.h"
#include "HktPresentationLog.h"
#include "HktRuntimeTags.h"
#include "Animation/AnimMontage.h"
#include "Animation/AnimSequence.h"
#include "Animation/BlendSpace.h"

void UHktAnimInstance::NativeInitializeAnimation()
{
	Super::NativeInitializeAnimation();

	if (!OnMontageEnded.IsAlreadyBound(this, &UHktAnimInstance::OnMontageEnd))
	{
		OnMontageEnded.AddDynamic(this, &UHktAnimInstance::OnMontageEnd);
	}
}

FGameplayTag UHktAnimInstance::ExtractLayerParent(const FGameplayTag& AnimTag)
{
	// Anim.FullBody.Locomotion.Run → Anim.FullBody
	// Anim.UpperBody.Combat.Attack → Anim.UpperBody
	// Anim.Montage.Attack → Anim.Montage
	FString TagStr = AnimTag.ToString();
	int32 FirstDot = INDEX_NONE;
	int32 SecondDot = INDEX_NONE;
	TagStr.FindChar(TEXT('.'), FirstDot);
	if (FirstDot != INDEX_NONE)
	{
		SecondDot = TagStr.Find(TEXT("."), ESearchCase::CaseSensitive, ESearchDir::FromStart, FirstDot + 1);
	}
	if (SecondDot != INDEX_NONE)
	{
		FString ParentStr = TagStr.Left(SecondDot);
		return FGameplayTag::RequestGameplayTag(FName(*ParentStr), false);
	}
	return AnimTag;
}

void UHktAnimInstance::SyncFromTagContainer(const FGameplayTagContainer& EntityTags)
{
	// Entity 태그 중 Anim.* 계열만 필터링
	FGameplayTagContainer CurrentAnimTags = EntityTags.Filter(FGameplayTagContainer(HktGameplayTags::Anim));

	// 새로 추가된 태그 → 애니메이션 재생
	for (const FGameplayTag& Tag : CurrentAnimTags)
	{
		if (!PrevAnimTags.HasTagExact(Tag))
		{
			ApplyAnimTag(Tag);
		}
	}

	// 제거된 태그 → 애니메이션 중지
	for (const FGameplayTag& Tag : PrevAnimTags)
	{
		if (!CurrentAnimTags.HasTagExact(Tag))
		{
			RemoveAnimTag(Tag);
		}
	}

	PrevAnimTags = CurrentAnimTags;
}

void UHktAnimInstance::ApplyAnimTag(const FGameplayTag& AnimTag)
{
	if (!AnimTag.IsValid())
	{
		return;
	}

	FGameplayTag LayerParent = ExtractLayerParent(AnimTag);

	FGameplayTag& Current = AnimLayerTags.FindOrAdd(LayerParent);
	Current = AnimTag;

	// FullBody는 AnimStateTag와 동기화 (하위호환)
	if (LayerParent.MatchesTagExact(HktGameplayTags::Anim_FullBody))
	{
		AnimStateTag = AnimTag;
	}

	// 매핑 테이블에서 에셋을 찾아 자동 재생
	if (const FHktAnimMappingEntry* Entry = FindMapping(AnimTag))
	{
		// 공격/스킬 몽타주는 AttackPlayRate 적용
		const bool bIsCombatAnim = LayerParent.MatchesTagExact(HktGameplayTags::Anim_UpperBody)
			|| LayerParent.MatchesTagExact(HktGameplayTags::Anim_Montage);
		const float PlayRate = bIsCombatAnim ? AttackPlayRate : 1.0f;

		if (Entry->Montage)
		{
			Montage_Play(Entry->Montage, PlayRate);
			if (Entry->StartSection != NAME_None)
			{
				Montage_JumpToSection(Entry->StartSection, Entry->Montage);
				Montage_SetNextSection(Entry->StartSection, NAME_None, Entry->Montage);
			}
			ActiveMontageTagMap.Add(Entry->Montage, AnimTag);
			HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
				FString::Printf(TEXT("[HktAnimInst] PlayMontage: %s -> %s Section=%s (Rate=%.2f)"),
				*AnimTag.ToString(), *Entry->Montage->GetName(),
				*Entry->StartSection.ToString(), PlayRate));
		}
		else if (Entry->Sequence)
		{
			UAnimMontage* DynMontage = PlaySlotAnimationAsDynamicMontage(Entry->Sequence, FName(TEXT("DefaultSlot")), 0.25f, 0.25f, PlayRate);
			if (DynMontage)
			{
				ActiveMontageTagMap.Add(DynMontage, AnimTag);
			}
			HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
				FString::Printf(TEXT("[HktAnimInst] PlaySequence: %s -> %s (Rate=%.2f)"),
				*AnimTag.ToString(), *Entry->Sequence->GetName(), PlayRate));
		}

		if (Entry->BlendSpace && ActiveBlendSpace != Entry->BlendSpace)
		{
			ActiveBlendSpace = Entry->BlendSpace;
			HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
				FString::Printf(TEXT("[HktAnimInst] SetBlendSpace: %s -> %s"),
				*AnimTag.ToString(), *Entry->BlendSpace->GetName()));
		}
	}

	HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
		FString::Printf(TEXT("[HktAnimInst] ApplyAnimTag: Parent=%s Anim=%s on %s"),
		*LayerParent.ToString(), *AnimTag.ToString(), *GetOwningActor()->GetName()));
}

void UHktAnimInstance::RemoveAnimTag(const FGameplayTag& AnimTag)
{
	if (!AnimTag.IsValid())
	{
		return;
	}

	FGameplayTag LayerParent = ExtractLayerParent(AnimTag);

	// 해당 레이어의 현재 태그가 제거되는 태그와 일치하면 클리어
	if (FGameplayTag* Current = AnimLayerTags.Find(LayerParent))
	{
		if (Current->MatchesTagExact(AnimTag))
		{
			AnimLayerTags.Remove(LayerParent);
		}
	}

	// FullBody는 AnimStateTag와 동기화
	if (LayerParent.MatchesTagExact(HktGameplayTags::Anim_FullBody) && AnimStateTag.MatchesTagExact(AnimTag))
	{
		AnimStateTag = FGameplayTag();
	}

	// 몽타주 계열 태그가 제거되면 몽타주 중지
	if (LayerParent.MatchesTagExact(HktGameplayTags::Anim_Montage) || LayerParent.MatchesTagExact(HktGameplayTags::Anim_UpperBody))
	{
		if (const FHktAnimMappingEntry* Entry = FindMapping(AnimTag))
		{
			if (Entry->Montage && IsPlayingMontageAnim())
			{
				Montage_Stop(0.25f, Entry->Montage);
			}
		}
	}

	HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
		FString::Printf(TEXT("[HktAnimInst] RemoveAnimTag: Parent=%s Anim=%s on %s"),
		*LayerParent.ToString(), *AnimTag.ToString(), *GetOwningActor()->GetName()));
}

void UHktAnimInstance::OnMontageEnd(UAnimMontage* Montage, bool bInterrupted)
{
	FGameplayTag AnimTag;
	if (!ActiveMontageTagMap.RemoveAndCopyValue(Montage, AnimTag))
	{
		return;
	}

	HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
		FString::Printf(TEXT("[HktAnimInst] MontageEnd: %s on %s (Interrupted=%d)"),
		*AnimTag.ToString(), *GetOwningActor()->GetName(), bInterrupted));
}

FGameplayTag UHktAnimInstance::GetAnimLayerTag(const FGameplayTag& LayerTag) const
{
	if (const FGameplayTag* Found = AnimLayerTags.Find(LayerTag))
	{
		return *Found;
	}
	return FGameplayTag();
}

bool UHktAnimInstance::IsPlayingMontageAnim() const
{
	return IsAnyMontagePlaying();
}

const FHktAnimMappingEntry* UHktAnimInstance::FindMapping(const FGameplayTag& Tag) const
{
	for (const FHktAnimMappingEntry& Entry : AnimMappings)
	{
		if (Entry.AnimTag.MatchesTagExact(Tag))
		{
			return &Entry;
		}
	}
	return nullptr;
}

// ============================================================================
// 동적 매핑 등록 API
// ============================================================================

void UHktAnimInstance::RegisterAnimMapping(FGameplayTag AnimTag, UAnimMontage* Montage, FName StartSection, UAnimSequence* Sequence, UBlendSpace* InBlendSpace)
{
	if (!AnimTag.IsValid()) return;

	// 기존 매핑이 있으면 덮어쓰기
	for (FHktAnimMappingEntry& Entry : AnimMappings)
	{
		if (Entry.AnimTag.MatchesTagExact(AnimTag))
		{
			Entry.Montage = Montage;
			Entry.StartSection = StartSection;
			Entry.Sequence = Sequence;
			Entry.BlendSpace = InBlendSpace;
			HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
				FString::Printf(TEXT("[HktAnimInst] Updated mapping: %s"), *AnimTag.ToString()));
			return;
		}
	}

	// 새 매핑 추가
	FHktAnimMappingEntry NewEntry;
	NewEntry.AnimTag = AnimTag;
	NewEntry.Montage = Montage;
	NewEntry.StartSection = StartSection;
	NewEntry.Sequence = Sequence;
	NewEntry.BlendSpace = InBlendSpace;
	AnimMappings.Add(NewEntry);

	HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
		FString::Printf(TEXT("[HktAnimInst] Registered mapping: %s (Montage=%s, Sequence=%s, BlendSpace=%s)"),
		*AnimTag.ToString(),
		Montage ? *Montage->GetName() : TEXT("none"),
		Sequence ? *Sequence->GetName() : TEXT("none"),
		InBlendSpace ? *InBlendSpace->GetName() : TEXT("none")));
}

void UHktAnimInstance::UnregisterAnimMapping(FGameplayTag AnimTag)
{
	AnimMappings.RemoveAll([&AnimTag](const FHktAnimMappingEntry& Entry)
	{
		return Entry.AnimTag.MatchesTagExact(AnimTag);
	});
}

bool UHktAnimInstance::HasAnimMapping(FGameplayTag AnimTag) const
{
	return FindMapping(AnimTag) != nullptr;
}

// ============================================================================
// Stance — AnimBP 레이어 교체
// ============================================================================

void UHktAnimInstance::SyncStance(FGameplayTag NewStanceTag)
{
	if (StanceTag == NewStanceTag)
	{
		return;
	}

	FGameplayTag OldTag = StanceTag;
	StanceTag = NewStanceTag;

	// StanceAnimClassMap에서 새 Stance Tag에 해당하는 AnimClass 조회
	TSubclassOf<UAnimInstance>* FoundClass = StanceAnimClassMap.Find(NewStanceTag);
	TSubclassOf<UAnimInstance> NewStanceClass = FoundClass ? *FoundClass : nullptr;

	// 같은 클래스면 스킵
	if (NewStanceClass == CurrentLinkedStanceClass)
	{
		return;
	}

	// 기존 레이어 해제
	if (CurrentLinkedStanceClass)
	{
		UnlinkAnimClassLayers(CurrentLinkedStanceClass);
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
			FString::Printf(TEXT("[HktAnimInst] UnlinkStanceLayer: %s (Stance %s)"),
			*CurrentLinkedStanceClass->GetName(), *OldTag.ToString()));
	}

	// 새 레이어 연결
	if (NewStanceClass)
	{
		LinkAnimClassLayers(NewStanceClass);
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
			FString::Printf(TEXT("[HktAnimInst] LinkStanceLayer: %s (Stance %s)"),
			*NewStanceClass->GetName(), *NewStanceTag.ToString()));
	}

	CurrentLinkedStanceClass = NewStanceClass;
}
