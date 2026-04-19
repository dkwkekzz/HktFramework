// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "HktCoreDefs.h"
#include "HktPresentationProcessor.h"

class ULocalPlayer;
class UHktVFXAssetBank;
class UNiagaraSystem;
class UNiagaraComponent;
class UHktTagDataAsset;
struct FHktVFXIntent;
struct FHktPresentationState;
enum class EHktVFXElement : uint8;

/**
 * 이벤트 기반 VFX 재생기.
 *
 * 에셋 로딩 경로:
 * - Tag 기반 (PlayVFXAtLocation): TagDataAsset → UHktVFXVisualDataAsset → NiagaraSystem 비동기 로드
 * - Intent 기반 (PlayVFXWithIntent): UHktVFXAssetBank → 퍼지 매칭
 */
class FHktVFXProcessor : public IHktPresentationProcessor
{
public:
	explicit FHktVFXProcessor(ULocalPlayer* InLP);

	// --- IHktPresentationProcessor ---
	virtual void Sync(FHktPresentationState& State) override;
	virtual void Teardown() override;

	/** AssetBank 설정 (에디터 DataAsset) */
	void SetAssetBank(UHktVFXAssetBank* InBank);

	/** 폴백 Niagara 시스템 설정 (AssetBank 매칭 실패 시) */
	void SetFallbackSystem(UNiagaraSystem* InSystem);

	/** 월드 위치에 VFX 스폰 (일회성, 자동 소멸) — 비동기 로드 후 재생 */
	void PlayVFXAtLocation(FGameplayTag VFXTag, FVector Location);

	/** Intent 기반 VFX 스폰 (AssetBank 퍼지 매칭 + RuntimeOverrides) */
	void PlayVFXWithIntent(const FHktVFXIntent& Intent);

	/** 엔터티에 부착된 지속형 VFX 스폰 (선택 인디케이터 등) — 비동기 로드 후 부착 */
	void AttachVFXToEntity(FGameplayTag VFXTag, FHktEntityId EntityId, FVector Location);

	/** 엔터티에 부착된 VFX 제거 */
	void DetachVFXFromEntity(FGameplayTag VFXTag, FHktEntityId EntityId);

private:
	/** TagDataAsset 기반 비동기 NiagaraSystem 로드 후 콜백 실행 */
	void LoadNiagaraSystemAsync(FGameplayTag VFXTag, TFunction<void(UNiagaraSystem*)> OnLoaded);

	void ApplyRuntimeOverrides(UNiagaraComponent* Comp, const FHktVFXIntent& Intent);
	static FLinearColor GetElementTintColor(EHktVFXElement Element);

	/** 엔터티 부착 VFX 키 (Tag + EntityId) */
	struct FEntityVFXKey
	{
		FGameplayTag Tag;
		FHktEntityId EntityId;
		bool operator==(const FEntityVFXKey& Other) const { return Tag == Other.Tag && EntityId == Other.EntityId; }
	};
	friend uint32 GetTypeHash(const FEntityVFXKey& Key)
	{
		return HashCombine(GetTypeHash(Key.Tag), GetTypeHash(Key.EntityId));
	}

	ULocalPlayer* LocalPlayer = nullptr;
	UHktVFXAssetBank* AssetBank = nullptr;
	UNiagaraSystem* FallbackSystem = nullptr;

	/** 비동기 콜백에서 this 유효성 확인용 (Teardown/소멸 시 리셋) */
	TSharedPtr<bool> AliveGuard = MakeShared<bool>(true);

	/** 태그별 NiagaraSystem 캐시 (TagDataAsset 로드 결과) */
	TMap<FGameplayTag, TWeakObjectPtr<UNiagaraSystem>> NiagaraSystemCache;

	/** 활성 엔터티 부착 VFX 컴포넌트 맵 */
	TMap<FEntityVFXKey, TWeakObjectPtr<UNiagaraComponent>> EntityVFXMap;
};
